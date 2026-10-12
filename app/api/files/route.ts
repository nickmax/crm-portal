import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "crm-files";
const UPLOAD_ROLES = ["owner", "admin", "captain"];
const DELETE_ROLES = ["owner", "admin"];

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );
}

function resolveRole(p: { crm_role?: string | null; role?: string | null }): string {
  if (p?.role === "admin") return "owner";
  if (["owner", "admin", "captain", "bdp", "sales"].includes(p?.crm_role ?? "")) return p!.crm_role as string;
  return p?.role === "sales_manager" ? "sales" : "bdp";
}

async function session() {
  const sb = await createServerSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const svc = serviceClient();
  const { data: profile } = await svc.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return { user, role: resolveRole(profile ?? {}), svc };
}

const safeName = (n: string) => n.replace(/[^a-zA-Z0-9._\-/ ]/g, "_").slice(0, 180);

// GET /api/files → list · GET /api/files?download=<name> → file bytes
export async function GET(req: Request) {
  const s = await session();
  if ("error" in s) return s.error;
  const { searchParams } = new URL(req.url);
  const dl = searchParams.get("download");
  if (dl) {
    const { data, error } = await s.svc.storage.from(BUCKET).download(safeName(dl));
    if (error || !data) return NextResponse.json({ error: "File not found." }, { status: 404 });
    const buf = Buffer.from(await data.arrayBuffer());
    return new NextResponse(buf, {
      headers: {
        "Content-Type": data.type || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName(dl).split("/").pop()}"`,
      },
    });
  }
  const { data, error } = await s.svc.storage.from(BUCKET).list("", { limit: 200, sortBy: { column: "updated_at", order: "desc" } });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    files: (data ?? [])
      .filter((f) => f.id != null)
      .map((f) => ({ name: f.name, size: f.metadata?.size ?? 0, updated: f.updated_at })),
  });
}

// POST /api/files (multipart: file, notify=true/false, subject, message, email=true/false)
export async function POST(req: Request) {
  const s = await session();
  if ("error" in s) return s.error;
  if (!UPLOAD_ROLES.includes(s.role)) {
    return NextResponse.json({ error: "Only owners, admins and captains can upload." }, { status: 403 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Attach a file." }, { status: 400 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "25 MB limit per file." }, { status: 400 });
  }
  const name = `${new Date().toISOString().slice(0, 10)}_${safeName(file.name)}`;
  const { error } = await s.svc.storage.from(BUCKET).upload(name, file, { contentType: file.type || undefined });
  if (error) return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 500 });

  await s.svc.from("audit_log").insert({
    actor: s.user.id, action: "Resource uploaded", entity: "file",
    entity_id: name, detail: `${file.name} (${Math.round(file.size / 1024)} KB) by ${s.user.email}`,
  });

  // Optional team notification (reuses the broadcast path).
  let notified = 0;
  if (String(form?.get("notify") ?? "false") === "true") {
    const { data: profiles } = await s.svc.from("profiles").select("id");
    const rows = ((profiles ?? []) as { id: string }[]).map((p) => ({
      profile_id: p.id,
      title: `New resource: ${file.name}`,
      body: String(form?.get("message") ?? "A new file was shared in the management hub."),
      link: "/files",
    }));
    await s.svc.from("notifications").insert(rows);
    notified = rows.length;
  }
  return NextResponse.json({ ok: true, name, notified });
}

export async function DELETE(req: Request) {
  const s = await session();
  if ("error" in s) return s.error;
  if (!DELETE_ROLES.includes(s.role)) {
    return NextResponse.json({ error: "Only owners and admins can delete files." }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  if (!name) return NextResponse.json({ error: "Missing file name." }, { status: 400 });
  const { error } = await s.svc.storage.from(BUCKET).remove([safeName(name)]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await s.svc.from("audit_log").insert({
    actor: s.user.id, action: "Resource deleted", entity: "file", entity_id: name, detail: name,
  });
  return NextResponse.json({ ok: true });
}
