// Verifies delegated tasks end to end. Usage: npx tsx scripts/verify-delegated-tasks.mts
// 1. Pure logic unit tests (validation, permissions, reminder grouping)
// 2. Email-off behavior (queued when Resend unconfigured — never sends in tests)
// 3. Live REST roundtrip: standalone task insert/select/update/delete +
//    notification insert/read/delete (service key, canary rows, cleaned up)
// 4. Config: Vercel crons, migration file, API routes present
// Exit 0 = all green.
import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  validateTaskInput, canDelegate, canEditTask, canClearTask,
  groupPendingByAssignee, reminderSubject, reminderLine,
} from "../lib/tasks/delegated";
import { sendBulkEmail } from "../lib/notify/email";

const env: Record<string, string> = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim();
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) { pass++; } else { fail++; }
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// ---- 1. validation ---------------------------------------------------------
check("validate: good input", validateTaskInput({ title: "Call George", assigneeIds: ["x"], dueAt: new Date().toISOString() }) === null);
check("validate: empty title", validateTaskInput({ title: "  ", assigneeIds: ["x"], dueAt: new Date().toISOString() }) !== null);
check("validate: no assignees", validateTaskInput({ title: "T", assigneeIds: [], dueAt: new Date().toISOString() }) !== null);
check("validate: dup assignees", validateTaskInput({ title: "T", assigneeIds: ["x", "x"], dueAt: new Date().toISOString() }) !== null);
check("validate: bad date", validateTaskInput({ title: "T", assigneeIds: ["x"], dueAt: "not-a-date" }) !== null);
check("validate: bad priority", validateTaskInput({ title: "T", assigneeIds: ["x"], dueAt: new Date().toISOString(), priority: "urgent" }) !== null);
check("validate: long description", validateTaskInput({ title: "T", assigneeIds: ["x"], dueAt: new Date().toISOString(), description: "z".repeat(4001) }) !== null);

// ---- 2. permissions ---------------------------------------------------------
check("delegate: owner/admin/captain", canDelegate("owner") && canDelegate("admin") && canDelegate("captain"));
check("delegate: bdp/sales blocked", !canDelegate("bdp") && !canDelegate("sales"));
const t = { ownerId: "assignee-1", createdBy: "owner-1" };
check("edit: owner anything", canEditTask({ role: "owner", actorId: "any", task: t }));
check("edit: assignee own", canEditTask({ role: "bdp", actorId: "assignee-1", task: t }));
check("edit: stranger blocked", !canEditTask({ role: "bdp", actorId: "stranger", task: t }));
check("edit: captain own-squad", canEditTask({ role: "captain", actorId: "cap", task: t, sameSquad: true }));
check("edit: captain outsider blocked", !canEditTask({ role: "captain", actorId: "cap", task: t, sameSquad: false }));
check("clear: assignee/creator/owner", canClearTask({ role: "bdp", actorId: "assignee-1", task: t }) && canClearTask({ role: "owner", actorId: "owner-1", task: t }) && canClearTask({ role: "admin", actorId: "adm", task: t }));
check("clear: stranger blocked", !canClearTask({ role: "bdp", actorId: "stranger", task: t }));

// ---- 3. reminder grouping ----------------------------------------------------
const now = Date.now();
const tasks = [
  { id: "a", leadId: null, companyId: null, ownerId: "u1", title: "Later", dueAt: new Date(now + 86400000).toISOString(), status: "open" as const, createdAt: new Date().toISOString() },
  { id: "b", leadId: null, companyId: null, ownerId: "u1", title: "Overdue", dueAt: new Date(now - 86400000).toISOString(), status: "open" as const, createdAt: new Date().toISOString() },
  { id: "c", leadId: null, companyId: null, ownerId: "u2", title: "Done one", dueAt: new Date().toISOString(), status: "done" as const, createdAt: new Date().toISOString() },
  { id: "d", leadId: null, companyId: null, ownerId: "u2", title: "Open one", dueAt: new Date().toISOString(), status: "open" as const, createdAt: new Date().toISOString() },
];
const groups = groupPendingByAssignee(tasks);
check("group: two assignees, done excluded", groups.length === 2 && groups.every((g) => g.tasks.every((x) => x.status !== "done")));
check("group: overdue first", groups.find((g) => g.assigneeId === "u1")?.tasks[0]?.id === "b");
check("reminder: subjects", reminderSubject("midday", 2).includes("Midday") && reminderSubject("closing", 1).includes("1 open task"));
check("reminder: overdue flagged", reminderLine(tasks[1]).includes("OVERDUE"));

// ---- 4. email stays queued in tests (never sends) ----------------------------
delete process.env.RESEND_API_KEY;
const mail = await sendBulkEmail({ to: ["test@example.com"], subject: "t", html: "<p>t</p>" });
check("email: queued without key", mail.ok && mail.queued && mail.sent === 0);

// ---- 5. live REST roundtrip (standalone task + notification) ------------------
const tag = randomUUID().slice(0, 8);
const ref = `__task_verify_${tag}__`;
const full = {
  crm_ref: ref, business_id: null, title: "__verify standalone task__",
  description: "rich details here", created_by: "__owner__", assignee: "__assignee__",
  status: "pending", due_at: new Date().toISOString(), lead_ref: null, priority: "high",
};
let ins = await admin.from("followup_tasks").insert(full).select("id");
let migrationPending = false;
if (ins.error && /column|schema cache|PGRST/i.test(ins.error.message)) {
  migrationPending = true;
  const { description: _d, created_by: _c, priority: _p, ...minimal } = full;
  void _d; void _c; void _p;
  ins = await admin.from("followup_tasks").insert(minimal).select("id");
}
check("db: insert standalone task (null business)", !ins.error, ins.error?.message ?? "");
const rowId = (ins.data as { id: number }[] | null)?.[0]?.id;
check("db: select standalone task back", !!rowId && (await admin.from("followup_tasks").select("crm_ref").eq("crm_ref", ref).maybeSingle()).data !== null);
const upd = rowId ? await admin.from("followup_tasks").update({ title: "__verify edited__", status: "done" }).eq("id", rowId) : { error: "no row" as unknown as Error };
check("db: edit task (title + clear)", !("message" in (upd.error ?? {})) && !(upd as { error?: Error }).error);
console.log(migrationPending
  ? "NOTE  followup_tasks lacks description/created_by/priority — run supabase/migrations/20261015_delegated_tasks.sql for rich fields (code degrades gracefully)."
  : "NOTE  migration columns present (description/created_by/priority).");

const { data: ownerProf } = await admin.from("profiles").select("id").limit(1).maybeSingle();
const profId = (ownerProf as { id: string } | null)?.id;
if (profId) {
  const nref = `__verify_notif_${tag}__`;
  const nin = await admin.from("notifications").insert({
    profile_id: profId, app_ref: nref, title: "__verify task notif__",
    body: "stays until cleared", link: "/tasks", read: false,
  }).select("id");
  check("db: insert task notification", !nin.error, nin.error?.message ?? "");
  const nid = (nin.data as { id: number }[] | null)?.[0]?.id;
  const nupd = nid ? await admin.from("notifications").update({ read: true }).eq("id", nid) : null;
  check("db: notification clear (read=true)", !nupd?.error);
  if (nid) await admin.from("notifications").delete().eq("id", nid);
  check("db: notification cleanup", (await admin.from("notifications").select("id").eq("app_ref", nref)).data?.length === 0);
} else {
  check("db: insert task notification", false, "no profiles row to attach to");
}
if (rowId) await admin.from("followup_tasks").delete().eq("id", rowId);
check("db: task cleanup", (await admin.from("followup_tasks").select("id").eq("crm_ref", ref)).data?.length === 0);

// reminder scan shape: open app tasks query the cron uses
const scan = await admin.from("followup_tasks").select("crm_ref,status").not("crm_ref", "is", null).neq("status", "done").limit(5);
check("db: reminder scan query", !scan.error);

// ---- 6. config ----------------------------------------------------------------
const root = new URL("../", import.meta.url);
const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const crons = vercel.crons ?? [];
check("config: midday cron (09:00 UTC)", crons.some((c: { path: string; schedule: string }) => c.schedule === "0 9 * * *" && c.path.includes("slot=midday")));
check("config: closing cron (14:00 UTC)", crons.some((c: { path: string; schedule: string }) => c.schedule === "0 14 * * *" && c.path.includes("slot=closing")));
check("config: migration file", existsSync(new URL("../supabase/migrations/20261015_delegated_tasks.sql", import.meta.url)));
for (const f of ["app/api/tasks/route.ts", "app/api/tasks/[id]/route.ts", "app/api/tasks/[id]/clear/route.ts", "app/api/tasks/reminders/route.ts", "components/crm/notifications-panel.tsx", "lib/tasks/delegated.ts", "lib/tasks/server.ts"]) {
  check(`config: ${f}`, existsSync(new URL(`../${f}`, import.meta.url)));
}
void root;

console.log(`\n${pass}/${pass + fail} checks passed.`);
process.exit(fail ? 1 : 0);
