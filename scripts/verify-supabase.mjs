// Verifies the BDP CRM ↔ Supabase wiring end to end.
// Usage: node scripts/verify-supabase.mjs
// Reads .env.local (never commit it). Creates a throwaway auth user + one
// canary businesses row, then deletes both. Exit 0 = all green.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const PUB = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = env.SUPABASE_SECRET_KEY;

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

if (!URL || !PUB || !SECRET) {
  console.error("FAIL  env — .env.local missing keys");
  process.exit(1);
}
check("env keys present", true);

const adminH = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" };
const pubH = { apikey: PUB, Authorization: `Bearer ${PUB}`, "Content-Type": "application/json" };
const j = async (r) => ({ status: r.status, body: await r.text() });

// 1. REST reachability
{
  const { status } = await fetch(`${SB_URL}/rest/v1/businesses?select=id&limit=1`, { headers: adminH }).then(j);
  check("REST reachable (businesses)", status === 200, `HTTP ${status}`);
}

// 2. Existing tables readable
for (const t of ["businesses", "contacts", "campaigns", "meetings", "followup_tasks", "deals", "payments", "lead_events", "profiles"]) {
  const { status } = await fetch(`${SB_URL}/rest/v1/${t}?select=*&limit=1`, { headers: adminH }).then(j);
  check(`table readable: ${t}`, status === 200, `HTTP ${status}`);
}

// 3. Migration artefacts (new tables + crm_* columns)
const newTables = ["cohorts", "squads", "proposals", "commissions", "commission_events", "notifications", "audit_log"];
let migrationApplied = true;
for (const t of newTables) {
  const { status } = await fetch(`${SB_URL}/rest/v1/${t}?select=*&limit=1`, { headers: adminH }).then(j);
  check(`migration table: ${t}`, status === 200, status === 200 ? "present" : `HTTP ${status} — run supabase/migrations/20261012_bdp_crm_additive.sql`);
  if (status !== 200) migrationApplied = false;
}
for (const col of ["crm_lead_ref", "crm_status", "crm_next_action", "crm_value_cents"]) {
  const r = await fetch(`${SB_URL}/rest/v1/businesses?select=${col}&limit=1`, { headers: adminH });
  const ok = r.status === 200;
  check(`businesses.${col}`, ok, ok ? "present" : `HTTP ${r.status} — migration not applied`);
  if (!ok) migrationApplied = false;
}

// 4. Auth roundtrip: create throwaway user -> sign in -> getUser -> delete
const testEmail = `crm-verify-${randomUUID().slice(0, 8)}@example.com`;
const testPass = `Verify-${randomUUID().slice(0, 8)}!`;
let userId = null;
{
  const r = await fetch(`${SB_URL}/auth/v1/admin/users`, {
    method: "POST", headers: adminH,
    body: JSON.stringify({ email: testEmail, password: testPass, email_confirm: true }),
  }).then(j);
  let created = null;
  try { created = JSON.parse(r.body); } catch {}
  userId = created?.id ?? created?.user?.id ?? null;
  check("auth admin: create user", r.status < 300 && !!userId, `HTTP ${r.status}`);
}
let userToken = null;
if (userId) {
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: pubH, body: JSON.stringify({ email: testEmail, password: testPass }),
  }).then(j);
  let tok = null;
  try { tok = JSON.parse(r.body); } catch {}
  userToken = tok?.access_token ?? null;
  check("auth: sign in with password", r.status === 200 && !!userToken, `HTTP ${r.status}`);
}
if (userToken) {
  const r = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: PUB, Authorization: `Bearer ${userToken}` },
  }).then(j);
  check("auth: getUser", r.status === 200, `HTTP ${r.status}`);
  // profile self-read (needs migration RLS policy; diagnostic only)
  const r2 = await fetch(`${SB_URL}/rest/v1/profiles?select=id&limit=1`, {
    headers: { apikey: PUB, Authorization: `Bearer ${userToken}` },
  }).then(j);
  check("profiles readable as signed-in user", r2.status === 200, `HTTP ${r2.status}${r2.status !== 200 ? " — apply migration for RLS policies" : ""}`);
}

// 5. Write path: canary row insert + delete (base columns only, works pre/post migration)
{
  const ref = `__crm_verify_${randomUUID().slice(0, 8)}__`;
  const ins = await fetch(`${SB_URL}/rest/v1/businesses`, {
    method: "POST", headers: { ...adminH, Prefer: "return=representation" },
    body: JSON.stringify({ legacy_place_id: ref, name: "__CRM Verify Canary__" }),
  }).then(j);
  let rowId = null;
  try { rowId = JSON.parse(ins.body)?.[0]?.id; } catch {}
  check("write: insert canary business", ins.status < 300 && !!rowId, `HTTP ${ins.status}`);
  if (rowId) {
    const del = await fetch(`${SB_URL}/rest/v1/businesses?id=eq.${rowId}`, { method: "DELETE", headers: adminH }).then(j);
    check("write: delete canary business", del.status < 300, `HTTP ${del.status}`);
  }
}

// 6. Cleanup: delete throwaway user
if (userId) {
  const r = await fetch(`${SB_URL}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: adminH }).then(j);
  check("auth admin: delete user", r.status < 300, `HTTP ${r.status}`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (!migrationApplied) console.log("NOTE: migration not fully applied — app runs in local/demo mode until supabase/migrations/20261012_bdp_crm_additive.sql is run in the Dashboard SQL Editor.");
process.exit(failed.length ? 1 : 0);
