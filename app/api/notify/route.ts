import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import type { ProfileRow } from "@/lib/crm/auth";
import { sendBulkEmail, announcementHtml, resendConfigured, resendFrom } from "@/lib/notify/email";

// Role resolution mirrors profileToMember in auth.tsx; kept local so this
// route stays server-only.
function resolveRole(p: { crm_role?: string | null; role?: string | null }): string {
  if (p.role === "admin") return "owner";
  if (["owner", "admin", "captain", "bdp", "sales"].includes(p.crm_role ?? "")) return p.crm_role as string;
  return p.role === "sales_manager" ? "sales" : "bdp";
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );
}

async function gate() {
  const sb = await createServerSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const svc = serviceClient();
  const { data: profile } = await svc.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const role = resolveRole((profile ?? {}) as ProfileRow);
  if (!["owner", "admin", "captain"].includes(role)) {
    return { error: NextResponse.json({ error: "Only owners, admins and captains can broadcast." }, { status: 403 }) };
  }
  return { user, profile: profile as ProfileRow | null, role, svc };
}

export async function GET() {
  return NextResponse.json({ resendConfigured: resendConfigured(), from: resendFrom() });
}

export async function POST(req: Request) {
  const g = await gate();
  if ("error" in g) return g.error;
  const { user, profile, role, svc } = g;

  const body = await req.json().catch(() => ({}));
  const { kind = "announcement", subject = "", message = "", audience = {}, email = true, meetingId = null } = body as {
    kind?: string; subject?: string; message?: string;
    audience?: { roles?: string[]; squadIds?: number[]; memberIds?: string[] };
    email?: boolean; meetingId?: string | null;
  };
  if (!subject.trim() || !message.trim()) {
    return NextResponse.json({ error: "Subject and message are required." }, { status: 400 });
  }

  // Resolve recipients from real profiles (they hold the emails).
  const { data: profiles } = await svc.from("profiles").select("*").limit(500);
  const all = ((profiles ?? []) as ProfileRow[]).map((p) => ({ p, role: resolveRole(p) }));
  let targets = all;
  const { roles = [], squadIds = [], memberIds = [] } = audience;
  const narrowed = roles.length > 0 || squadIds.length > 0 || memberIds.length > 0;
  if (narrowed) {
    targets = all.filter(({ p, role: r }) =>
      (roles.length > 0 && roles.includes(r)) ||
      (squadIds.length > 0 && p.squad_id != null && squadIds.includes(p.squad_id)) ||
      (memberIds.length > 0 && memberIds.includes(p.id))
    );
  }
  // Captains may only reach their own squad.
  if (role === "captain") {
    const mySquad = (profile as ProfileRow | null)?.squad_id ?? null;
    targets = targets.filter(({ p }) => mySquad == null || p.squad_id === mySquad || p.id === user.id);
  }
  if (!targets.length) return NextResponse.json({ error: "No recipients matched." }, { status: 400 });

  // 1. In-app notifications (always).
  const notifRows = targets.map(({ p }) => ({
    profile_id: p.id,
    title: subject.trim(),
    body: `${kind === "meeting" ? "Meeting notice" : kind === "resource" ? "New resource" : "Announcement"}: ${message.trim().slice(0, 280)}`,
    link: meetingId ? "/meetings" : kind === "resource" ? "/files" : "/",
  }));
  const { error: nErr } = await svc.from("notifications").insert(notifRows);
  if (nErr) return NextResponse.json({ error: `Notifications failed: ${nErr.message}` }, { status: 500 });

  // 2. Email via Resend (optional, queued when unconfigured).
  let emailResult = { sent: 0, queued: false };
  if (email) {
    const emails = targets.map(({ p }) => p.email).filter(Boolean) as string[];
    const r = await sendBulkEmail({ to: emails, subject: subject.trim(), html: announcementHtml(subject.trim(), message.trim()) });
    emailResult = { sent: r.sent, queued: r.queued };
    if (!r.ok) return NextResponse.json({ error: `Email failed: ${r.error}`, notified: targets.length }, { status: 502 });
  }

  // 3. Audit trail (doubles as the Comms "recent sends" log).
  await svc.from("audit_log").insert({
    actor: user.id,
    action: kind === "meeting" ? "Meeting notice sent" : kind === "resource" ? "Resource shared" : email ? "Announcement + email sent" : "Announcement sent",
    entity: "broadcast",
    entity_id: meetingId ?? String(Date.now()),
    detail: `${subject.trim()} → ${targets.length} notified${email ? (emailResult.queued ? " (email queued — Resend not configured)" : ` (${emailResult.sent} emailed)`) : ""}`,
  });

  return NextResponse.json({
    ok: true, notified: targets.length,
    emailed: emailResult.sent, emailQueued: emailResult.queued,
  });
}
