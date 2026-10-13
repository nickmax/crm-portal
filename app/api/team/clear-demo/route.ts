import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { seedAll } from "@/lib/crm/seed";

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

// DELETE /api/team/clear-demo — owner only. Removes every demo seed row by
// exact id. Never touches real rows (seed ids are fixed strings like ld-1001).
export async function DELETE() {
  const sb = await createServerSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const svc = serviceClient();
  const { data: profile } = await svc.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (resolveRole(profile ?? {}) !== "owner") {
    return NextResponse.json({ error: "Only the owner can clear demo data." }, { status: 403 });
  }

  const seed = seedAll() as unknown as Record<string, { id: string }[]>;
  const ids = (key: string) => (seed[key] ?? []).map((r) => r.id);
  const removed: Record<string, number> = {};
  const skipped: Record<string, string> = {};
  const wipe = async (table: string, column: string, values: string[]) => {
    if (!values.length) return;
    for (let i = 0; i < values.length; i += 100) {
      try {
        const { error, count } = await svc.from(table).delete({ count: "exact" }).in(column, values.slice(i, i + 100));
        if (error) throw new Error(error.message);
        removed[table] = (removed[table] ?? 0) + (count ?? 0);
      } catch (e) {
        // Never abort halfway: record and continue so one stubborn table
        // can't block the rest. The response lists anything left behind.
        skipped[table] = e instanceof Error ? e.message.slice(0, 160) : "failed";
        return;
      }
    }
  };

  try {
    const leadIds = ids("leads");
    const companyIds = (seedAll() as unknown as { companies: { id: string }[] }).companies.map((c) => c.id);
    // Children first — lead_events references businesses (RESTRICT), so it
    // must go before companies or the whole wipe aborts on a FK violation.
    await wipe("lead_events", "legacy_place_id", leadIds);
    await wipe("payments", "crm_ref", ids("payments"));
    await wipe("proposals", "crm_ref", ids("proposals"));
    await wipe("commissions", "crm_ref", ids("commissions"));
    await wipe("meetings", "crm_ref", ids("meetings"));
    await wipe("followup_tasks", "crm_ref", ids("tasks"));
    await wipe("contacts", "crm_ref", ids("contacts"));
    await wipe("deals", "crm_ref", ids("opportunities"));
    await wipe("businesses", "legacy_place_id", companyIds);
    await wipe("notifications", "app_ref", ids("notifications"));
    await wipe("squads", "app_ref", ids("squads"));
    await wipe("cohorts", "app_ref", ids("cohorts"));
    // Seed campaign is matched by name (campaigns has no app ref).
    await svc.from("campaigns").delete().eq("name", "Q1 Growth Sprint — Ordering & Reservations");
    await svc.from("audit_log").insert({
      actor: user.id, action: "Demo data cleared", entity: "system",
      entity_id: "seed", detail: JSON.stringify(removed),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Clear failed partway." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, removed, skipped });
}
