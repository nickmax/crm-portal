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
  return "bdp";
}

async function gate() {
  const sb = await createServerSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const svc = serviceClient();
  const { data: profile } = await svc.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const role = resolveRole(profile ?? {});
  if (!["owner", "admin"].includes(role)) {
    return { error: NextResponse.json({ error: "Only owners and admins manage cohorts and squads." }, { status: 403 }) };
  }
  return { user, svc };
}

// POST /api/team/structure { op: 'cohort'|'squad'|'captain'|'assign', ... }
export async function POST(req: Request) {
  const g = await gate();
  if ("error" in g) return g.error;
  const { user, svc } = g;
  const body = await req.json().catch(() => ({}));
  const { op } = body as { op?: string };

  if (op === "cohort") {
    const { name = "", description = "" } = body as { name?: string; description?: string };
    if (!name.trim()) return NextResponse.json({ error: "Cohort name required." }, { status: 400 });
    const { data, error } = await svc.from("cohorts").insert({ name: name.trim(), description: description.trim() || null, active: true }).select("id").maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await svc.from("audit_log").insert({ actor: user.id, action: "Cohort created", entity: "cohort", entity_id: String((data as { id?: number })?.id ?? ""), detail: name.trim() });
    return NextResponse.json({ ok: true, id: (data as { id?: number })?.id });
  }

  if (op === "squad") {
    const { name = "", cohortId = null, industry = "", target = 30 } = body as { name?: string; cohortId?: number | null; industry?: string; target?: number };
    if (!name.trim()) return NextResponse.json({ error: "Squad name required." }, { status: 400 });
    const { data, error } = await svc.from("squads").insert({ name: name.trim(), cohort_id: cohortId, industry: industry.trim() || null, target: Number(target) || 30 }).select("id").maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await svc.from("audit_log").insert({ actor: user.id, action: "Squad created", entity: "squad", entity_id: String((data as { id?: number })?.id ?? ""), detail: name.trim() });
    return NextResponse.json({ ok: true, id: (data as { id?: number })?.id });
  }

  if (op === "captain") {
    const { squadId = null, profileId = null } = body as { squadId?: number | null; profileId?: string | null };
    if (!squadId) return NextResponse.json({ error: "Squad required." }, { status: 400 });
    if (profileId) {
      await svc.from("profiles").update({ crm_role: "captain", squad_id: squadId }).eq("id", profileId);
    }
    const { error } = await svc.from("squads").update({ captain_id: profileId }).eq("id", squadId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await svc.from("audit_log").insert({ actor: user.id, action: "Captain assigned", entity: "squad", entity_id: String(squadId), detail: String(profileId ?? "cleared") });
    return NextResponse.json({ ok: true });
  }

  if (op === "assign") {
    const { profileId = "", squadId = null, commissionRate = null } = body as { profileId?: string; squadId?: number | null; commissionRate?: number | null };
    if (!profileId) return NextResponse.json({ error: "Member required." }, { status: 400 });
    const patch: Record<string, unknown> = { squad_id: squadId };
    if (commissionRate != null && Number.isFinite(Number(commissionRate))) patch.commission_rate = Number(commissionRate);
    const { error } = await svc.from("profiles").update(patch).eq("id", profileId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await svc.from("audit_log").insert({ actor: user.id, action: "Member assigned", entity: "profile", entity_id: profileId, detail: `squad ${squadId ?? "—"}` });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown op." }, { status: 400 });
}
