// Exercises the app's own sync layer (lib/crm/sb.ts) against live Supabase:
// fetch -> push canary lead/task/meeting -> refetch -> cleanup. Exit 0 = green.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { fetchCrmState, pushDiff, emptyCtx, searchBusinesses } from "../lib/crm/sb";

const env: Record<string, string> = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim();
}
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = env.SUPABASE_SECRET_KEY;
const PUB = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(SB_URL, SECRET);

let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// 1. fetchCrmState with the exact code path the browser uses
const { partial, ctx } = await fetchCrmState(admin, [], [], []);
check("fetch: core tables", ctx.tables.core);
check("fetch: cohorts/squads/proposals/commissions/notifications/audit",
  ctx.tables.cohorts && ctx.tables.squads && ctx.tables.proposals &&
  ctx.tables.commissions && ctx.tables.notifications && ctx.tables.audit);
check("fetch: existing slices readable", Array.isArray(partial.companies));

// 2. push a canary company + lead + task + meeting through pushDiff
const tag = randomUUID().slice(0, 8);
const coId = `__co_${tag}__`, ldId = `__ld_${tag}__`, tId = `__t_${tag}__`, mId = `__m_${tag}__`;
const empty: any = {
  cohorts: [], squads: [], members: [], companies: [], contacts: [], leads: [],
  opportunities: [], tasks: [], meetings: [], proposals: [], deals: [], payments: [],
  commissions: [], activities: [], campaigns: [], audit: [], notifications: [], currentUserId: "",
};
const next = {
  ...empty,
  companies: [{ id: coId, name: "__CRM Sync Canary__", industry: "Testing" }],
  leads: [{
    id: ldId, companyId: coId, ownerId: "", squadId: "", status: "new",
    source: "sync-test", observedProblem: "canary", valuePotential: 1000,
    urgency: "low", lastActivityAt: new Date().toISOString(),
    nextAction: "delete me", nextDueAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }],
  tasks: [{ id: tId, leadId: ldId, companyId: coId, ownerId: "", title: "canary task", dueAt: new Date().toISOString(), status: "open", createdAt: new Date().toISOString() }],
  meetings: [{ id: mId, opportunityId: null, leadId: ldId, companyId: coId, date: new Date().toISOString(), attendees: [], outcome: "pending", notes: "canary", nextAction: "none" }],
};
const res = await pushDiff(admin, empty, next as any, ctx, []);
check("push: canary lead+task+meeting", res.ok, res.errors.slice(0, 2).join(" · "));

// 3. refetch proves the rows round-trip through fetchCrmState
const re = await fetchCrmState(admin, [], [], []);
const foundLead = (re.partial.leads ?? []).some((l: any) => l.id === ldId);
const foundTask = (re.partial.tasks ?? []).some((t: any) => t.id === tId);
check("roundtrip: lead refetched", foundLead);
check("roundtrip: task refetched", foundTask);

// 4. live dedup search finds the canary
const hits = await searchBusinesses(admin, "__CRM Sync Canary__");
check("search: canary found via ilike", hits.some((h) => h.name === "__CRM Sync Canary__"));

// 5. authenticated (non-admin) reads on CRM tables, as the browser does post-login
const testEmail = `crm-sync-${tag}@example.com`;
const testPass = `Sync-${tag}!Aa`;
const created = await admin.auth.admin.createUser({ email: testEmail, password: testPass, email_confirm: true });
const uid = (created.data.user as any)?.id;
let userToken: string | null = null;
if (uid) {
  const sess = await createClient(SB_URL, PUB).auth.signInWithPassword({ email: testEmail, password: testPass });
  userToken = sess.data.session?.access_token ?? null;
}
check("auth: temp user sign-in", !!userToken);
if (userToken) {
  const userSb = createClient(SB_URL, PUB, { global: { headers: { Authorization: `Bearer ${userToken}` } } });
  for (const t of ["businesses", "cohorts", "squads", "followup_tasks", "meetings", "deals", "commissions", "notifications"]) {
    const r = await userSb.from(t).select("id").limit(1);
    check(`authed read: ${t}`, !r.error, r.error ? r.error.message.slice(0, 100) : "200");
  }
  // self-provision profile row (what first login does)
  const prof = await userSb.from("profiles").upsert({ id: uid, email: testEmail }, { onConflict: "id" }).select("id");
  check("authed write: own profile", !prof.error, prof.error ? prof.error.message.slice(0, 100) : "upserted");
  if (!prof.error) await admin.from("profiles").delete().eq("id", uid);
}
if (uid) await admin.auth.admin.deleteUser(uid);

// 6. cleanup canary rows (children first for FKs)
await admin.from("followup_tasks").delete().eq("crm_ref", tId);
await admin.from("meetings").delete().eq("crm_ref", mId);
const del = await admin.from("businesses").delete().eq("legacy_place_id", coId);
check("cleanup: canary removed", !del.error, del.error ? del.error.message.slice(0, 100) : "deleted");

console.log(`\n${pass}/${pass + fail} app-sync checks passed.`);
process.exit(fail ? 1 : 0);
