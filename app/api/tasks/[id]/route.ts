import { NextResponse } from "next/server";
import {
  serviceClient, requester, memberKeys, rowToTask, updateTaskRow,
  taskAssignedHtml, sendEmail,
  type Row,
} from "@/lib/tasks/server";
import { canEditTask } from "@/lib/tasks/delegated";
import type { ProfileRow } from "@/lib/crm/auth";

// PATCH /api/tasks/:id — edit title / description / due / priority / assignee / lead.
// Assignees may fix their own tasks; reassignment stays with owner/admin/captain.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svc = serviceClient();
  const r = await requester(svc);
  if ("error" in r) return r.error;

  const { data: existing } = await svc.from("followup_tasks").select("*").eq("crm_ref", id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Task not found." }, { status: 404 });
  const row = existing as Row;
  const task = rowToTask(row);

  const keys = new Set(memberKeys(r.profile));
  const sameSquad = await (async () => {
    if (r.role !== "captain") return false;
    const { data: profiles } = await svc.from("profiles").select("id,app_ref,squad_id").limit(500);
    const all = ((profiles ?? []) as { id: string; app_ref: string | null; squad_id: number | null }[]);
    const mine = all.find((p) => p.id === r.user.id)?.squad_id ?? null;
    const target = all.find((p) => p.id === task.ownerId || p.app_ref === task.ownerId)?.squad_id ?? null;
    return mine != null && mine === target;
  })();

  if (!canEditTask({ role: r.role as "owner", actorId: r.actorMemberId, task, sameSquad }) &&
      ![...keys].some((k) => k === task.ownerId)) {
    return NextResponse.json({ error: "You can't edit this task." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const patch: Row = {};
  if (typeof body.title === "string" && body.title.trim()) {
    if (body.title.trim().length > 200) return NextResponse.json({ error: "Title must be 200 characters or less." }, { status: 400 });
    patch.title = body.title.trim();
  }
  if (typeof body.description === "string") {
    if (body.description.length > 4000) return NextResponse.json({ error: "Description must be 4,000 characters or less." }, { status: 400 });
    patch.description = body.description;
  }
  if (typeof body.dueAt === "string" && body.dueAt) {
    if (Number.isNaN(new Date(body.dueAt).getTime())) return NextResponse.json({ error: "Due date is not valid." }, { status: 400 });
    patch.due_at = new Date(body.dueAt).toISOString();
  }
  if (typeof body.priority === "string") {
    if (!["low", "normal", "high"].includes(body.priority)) return NextResponse.json({ error: "Bad priority." }, { status: 400 });
    patch.priority = body.priority;
  }
  let reassignedTo: string | null = null;
  if (typeof body.assigneeId === "string" && body.assigneeId && body.assigneeId !== task.ownerId) {
    if (!["owner", "admin", "captain"].includes(r.role)) {
      return NextResponse.json({ error: "Only owners, admins and captains can reassign." }, { status: 403 });
    }
    patch.assignee = body.assigneeId;
    reassignedTo = body.assigneeId;
  }
  if (body.leadId !== undefined) patch.lead_ref = body.leadId || null;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const upd = await updateTaskRow(svc, row.id, patch);
  if (upd.error) return NextResponse.json({ error: `Update failed: ${upd.error}` }, { status: 500 });

  let renotified = false;
  if (reassignedTo) {
    const { data: profiles } = await svc.from("profiles").select("*").limit(500);
    const prof = ((profiles ?? []) as ProfileRow[]).find((p) => memberKeys(p).includes(reassignedTo as string));
    if (prof) {
      await svc.from("notifications").insert({
        profile_id: prof.id,
        app_ref: id,
        title: `New task: ${patch.title ?? task.title}`,
        body: `Reassigned to you by ${r.profile.display_name ?? r.profile.email ?? "your team"}. Due ${new Date(patch.due_at ?? task.dueAt).toLocaleString()}`,
        link: `/tasks?task=${id}`,
        read: false,
      });
      if (prof.email) {
        await sendEmail({
          to: [prof.email],
          subject: `Task reassigned to you: ${patch.title ?? task.title}`,
          html: taskAssignedHtml({
            title: patch.title ?? task.title,
            description: patch.description ?? task.description ?? "",
            dueAt: patch.due_at ?? task.dueAt,
            priority: patch.priority ?? task.priority ?? "normal",
            fromName: r.profile.display_name ?? r.profile.email ?? "Your team",
          }),
        });
      }
      renotified = true;
    }
  }

  await svc.from("audit_log").insert({
    actor: r.user.id, action: "Task edited", entity: "task", entity_id: id,
    detail: `${task.title} — edited by ${r.profile.display_name ?? r.profile.email ?? r.user.id}${reassignedTo ? `, reassigned to ${reassignedTo}` : ""}`,
  });

  const { data: fresh } = await svc.from("followup_tasks").select("*").eq("crm_ref", id).maybeSingle();
  return NextResponse.json({ ok: true, task: fresh ? rowToTask(fresh as Row) : null, renotified });
}
