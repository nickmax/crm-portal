import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

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

async function requester(svc: ReturnType<typeof serviceClient>) {
  const sb = await createServerSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const { data: profile } = await svc.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return { user, role: resolveRole(profile ?? {}), svc };
}

const VALID_ROLES = ["owner", "admin", "captain", "bdp", "sales"];

// POST /api/team/invite { email, name, role, squadId?, commissionRate? }
// Owner/admin only. Sends the branded invite email; sets role + squad on the profile.
export async function POST(req: Request) {
  const svc = serviceClient();
  const r = await requester(svc);
  if ("error" in r) return r.error;
  if (!["owner", "admin"].includes(r.role)) {
    return NextResponse.json({ error: "Only owners and admins can invite." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { email = "", name = "", role = "bdp", squadId = null, commissionRate = 0.1 } = body as {
    email?: string; name?: string; role?: string; squadId?: number | null; commissionRate?: number;
  };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
    return NextResponse.json({ error: "Enter a valid work email." }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Unknown role." }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  let userId: string | null = null;
  let invited = false;

  const { data: invitedData, error: inviteErr } = await svc.auth.admin.inviteUserByEmail(email.trim(), {
    redirectTo: `${origin}/auth/callback?next=/set-password`,
  });
  if (inviteErr) {
    // Already registered? Fall back to updating their profile.
    const alreadyThere = /already|exists|registered/i.test(inviteErr.message);
    if (!alreadyThere) return NextResponse.json({ error: `Invite failed: ${inviteErr.message}` }, { status: 502 });
    const { data: existing } = await svc.from("profiles").select("id").eq("email", email.trim()).maybeSingle();
    userId = (existing as { id?: string } | null)?.id ?? null;
    if (!userId) return NextResponse.json({ error: "That email already has an account; ask them to sign in." }, { status: 409 });
  } else {
    userId = invitedData.user?.id ?? null;
    invited = true;
  }
  if (!userId) return NextResponse.json({ error: "Couldn't resolve the account." }, { status: 500 });

  const { error: profErr } = await svc.from("profiles").upsert({
    id: userId,
    email: email.trim(),
    display_name: name.trim() || email.trim().split("@")[0],
    crm_role: role,
    squad_id: squadId,
    commission_rate: commissionRate,
  }, { onConflict: "id" });
  if (profErr) return NextResponse.json({ error: `Account ready but role not saved: ${profErr.message}` }, { status: 500 });

  await svc.from("audit_log").insert({
    actor: r.user.id, action: invited ? "Member invited" : "Member role updated",
    entity: "profile", entity_id: userId,
    detail: `${email.trim()} → ${role}${squadId ? ` · squad ${squadId}` : ""}`,
  });

  return NextResponse.json({ ok: true, invited, userId });
}
