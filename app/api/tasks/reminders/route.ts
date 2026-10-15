import { NextResponse } from "next/server";
import {
  serviceClient, requester, memberKeys, rowToTask,
  taskReminderHtml, sendEmail,
  type Row,
} from "@/lib/tasks/server";
import {
  groupPendingByAssignee, reminderSubject, reminderLine,
  type ReminderSlot,
} from "@/lib/tasks/delegated";
import type { ProfileRow } from "@/lib/crm/auth";

function authorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const url = new URL(req.url);
  return header === `Bearer ${secret}` || url.searchParams.get("secret") === secret;
}

function slotOf(req: Request, body?: { slot?: string }): ReminderSlot {
  const url = new URL(req.url);
  const raw = (body?.slot ?? url.searchParams.get("slot") ?? "midday").toLowerCase();
  return raw === "closing" ? "closing" : "midday";
}

// Shared runner: one summary notification + one email per assignee with open tasks.
async function runReminders(slot: ReminderSlot) {
  const svc = serviceClient();
  const { data, error } = await svc
    .from("followup_tasks")
    .select("*")
    .not("crm_ref", "is", null)
    .neq("status", "done")
    .limit(1000);
  if (error) return { error: `Couldn't load open tasks: ${error.message}` };

  const tasks = ((data ?? []) as Row[]).map(rowToTask).filter((t) => t.status !== "done");
  if (!tasks.length) return { ok: true as const, slot, reminded: 0, tasks: 0, emailed: 0, emailQueued: false };

  const { data: profiles } = await svc.from("profiles").select("*").limit(500);
  const all = ((profiles ?? []) as ProfileRow[]);
  const byKey = new Map<string, ProfileRow>();
  for (const p of all) for (const k of memberKeys(p)) byKey.set(k, p);

  const groups = groupPendingByAssignee(tasks);
  const today = new Date().toISOString().slice(0, 10);
  let reminded = 0;
  let emailed = 0;
  let emailQueued = false;
  const details: { assignee: string; tasks: number; emailed: boolean }[] = [];

  for (const g of groups) {
    const prof = byKey.get(g.assigneeId);
    if (!prof) continue; // demo/seed assignee with no login — nothing to notify
    const lines = g.tasks.map(reminderLine);
    const subject = reminderSubject(slot, g.tasks.length);
    const body = `${slot === "closing" ? "Before you close today" : "Midday check-in"} — ${g.tasks.length} open ${g.tasks.length === 1 ? "task" : "tasks"}:\n${lines.slice(0, 8).join("\n")}${g.tasks.length > 8 ? `\n… and ${g.tasks.length - 8} more.` : ""}`;

    const { error: nErr } = await svc.from("notifications").insert({
      profile_id: prof.id,
      app_ref: `reminder:${today}:${slot}:${g.assigneeId}`.slice(0, 120),
      title: subject,
      body: body.slice(0, 500),
      link: "/tasks",
      read: false,
    });
    let mailed = false;
    if (prof.email) {
      const mail = await sendEmail({
        to: [prof.email],
        subject,
        html: taskReminderHtml({ slot, lines, total: g.tasks.length }),
      });
      mailed = mail.sent > 0;
      if (mail.sent > 0) emailed += 1;
      if (mail.queued) emailQueued = true;
    }
    if (!nErr) reminded += 1;
    details.push({ assignee: prof.display_name ?? prof.email ?? g.assigneeId, tasks: g.tasks.length, emailed: mailed });
  }

  await svc.from("audit_log").insert({
    actor: "system",
    action: slot === "closing" ? "Closing reminders sent" : "Midday reminders sent",
    entity: "task-reminders",
    entity_id: `${today}:${slot}`,
    detail: `${reminded} ${reminded === 1 ? "person" : "people"} reminded about ${tasks.length} open ${tasks.length === 1 ? "task" : "tasks"}`,
  });

  return { ok: true as const, slot, reminded, tasks: tasks.length, emailed, emailQueued, details };
}

// GET — called by Vercel Cron (Bearer CRON_SECRET) or a signed-in owner testing it.
export async function GET(req: Request) {
  if (authorizedCron(req)) {
    const res = await runReminders(slotOf(req));
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: 500 });
    return NextResponse.json(res);
  }
  const svc = serviceClient();
  const r = await requester(svc);
  if ("error" in r) return NextResponse.json({ error: "Cron secret or owner sign-in required." }, { status: 401 });
  if (!["owner", "admin"].includes(r.role)) {
    return NextResponse.json({ error: "Only owners and admins can trigger reminders." }, { status: 403 });
  }
  const res = await runReminders(slotOf(req));
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json(res);
}

// POST — manual trigger from the Tasks page (owner/admin only).
export async function POST(req: Request) {
  const svc = serviceClient();
  const r = await requester(svc);
  if ("error" in r) return r.error;
  if (!["owner", "admin"].includes(r.role)) {
    return NextResponse.json({ error: "Only owners and admins can trigger reminders." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const res = await runReminders(slotOf(req, body));
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json(res);
}
