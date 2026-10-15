import { NextResponse } from "next/server";
import {
  serviceClient, requester, memberKeys, rowToTask,
  taskClearedHtml, sendEmail,
  type Row,
} from "@/lib/tasks/server";
import { canClearTask } from "@/lib/tasks/delegated";
import type { ProfileRow } from "@/lib/crm/auth";

// POST /api/tasks/:id/clear — mark a delegated task done.
// Retires its notifications, emails the delegator + owner(s) that it was cleared.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svc = serviceClient();
  const r = await requester(svc);
  if ("error" in r) return r.error;

  const { data: existing } = await svc.from("followup_tasks").select("*").eq("crm_ref", id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Task not found." }, { status: 404 });
  const row = existing as Row;
  const task = rowToTask(row);
  if (task.status === "done") return NextResponse.json({ ok: true, already: true, task });

  if (!canClearTask({ role: r.role as "owner", actorId: r.actorMemberId, task })) {
    return NextResponse.json({ error: "Only the assignee, the delegator or an owner can clear this task." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note.slice(0, 500) : "";

  const { error: updErr } = await svc.from("followup_tasks").update({
    status: "done",
    completed_at: new Date().toISOString(),
  }).eq("id", row.id);
  if (updErr) return NextResponse.json({ error: `Couldn't clear task: ${updErr.message}` }, { status: 500 });

  // Retire every notification tied to this task — it has been dealt with.
  await svc.from("notifications").update({ read: true }).eq("app_ref", id);

  // Tell the delegator + every owner (except the person clearing) by
  // notification AND email.
  const { data: profiles } = await svc.from("profiles").select("*").limit(500);
  const all = ((profiles ?? []) as ProfileRow[]);
  const byKey = new Map<string, ProfileRow>();
  for (const p of all) for (const k of memberKeys(p)) byKey.set(k, p);
  const clearerName = r.profile.display_name ?? r.profile.email ?? "A team member";

  const recipients = new Map<string, ProfileRow>();
  const creator = task.createdBy ? byKey.get(task.createdBy) : undefined;
  if (creator && creator.id !== r.user.id) recipients.set(creator.id, creator);
  for (const p of all) {
    const role = p.role === "admin" ? "owner" : p.crm_role;
    if (role === "owner" && p.id !== r.user.id) recipients.set(p.id, p);
  }
  let ownerNotified = 0;
  for (const p of recipients.values()) {
    const { error: nErr } = await svc.from("notifications").insert({
      profile_id: p.id,
      app_ref: id,
      title: `Task cleared: ${task.title}`,
      body: `${clearerName} marked "${task.title}" done.${note ? ` Note: ${note.slice(0, 180)}` : ""}`,
      link: "/tasks",
      read: false,
    });
    if (!nErr) ownerNotified += 1;
  }
  const emails = [...recipients.values()].map((p) => p.email).filter(Boolean) as string[];
  const mail = await sendEmail({
    to: emails,
    subject: `Task cleared: ${task.title}`,
    html: taskClearedHtml({ title: task.title, clearedBy: clearerName, note }),
  });

  await svc.from("audit_log").insert({
    actor: r.user.id, action: "Task cleared", entity: "task", entity_id: id,
    detail: `${task.title} — cleared by ${clearerName}${note ? `: ${note.slice(0, 140)}` : ""}`,
  });

  const { data: fresh } = await svc.from("followup_tasks").select("*").eq("crm_ref", id).maybeSingle();
  return NextResponse.json({
    ok: true,
    task: fresh ? rowToTask(fresh as Row) : { ...task, status: "done" as const },
    ownerNotified,
    emailed: mail.sent,
    emailQueued: mail.queued,
  });
}
