// Delegated tasks — pure shared logic (client + server safe, no I/O).
// Thin API routes in app/api/tasks/* own the DB + email side effects.

import type { CrmTask, Role } from "@/lib/crm/types";

export type ReminderSlot = "midday" | "closing";

export const DELEGATE_ROLES: Role[] = ["owner", "admin", "captain"];

/** Roles the owner can delegate to (everyone who does work). */
export const ASSIGNABLE_ROLES: Role[] = ["bdp", "sales", "captain", "admin", "owner"];

export interface TaskInput {
  title: string;
  description?: string;
  assigneeIds: string[];
  dueAt: string;
  priority?: string;
  leadId?: string | null;
  companyId?: string | null;
}

export function validateTaskInput(body: Partial<TaskInput>): string | null {
  const title = (body.title ?? "").trim();
  if (!title) return "Give the task a title.";
  if (title.length > 200) return "Title must be 200 characters or less.";
  if (!Array.isArray(body.assigneeIds) || body.assigneeIds.length === 0) {
    return "Pick at least one person to assign.";
  }
  if (new Set(body.assigneeIds).size !== body.assigneeIds.length) {
    return "Remove duplicate assignees.";
  }
  if (!body.dueAt) return "Set a due date.";
  const due = new Date(body.dueAt).getTime();
  if (Number.isNaN(due)) return "Due date is not a valid date.";
  if (body.priority && !["low", "normal", "high"].includes(body.priority)) {
    return "Priority must be low, normal or high.";
  }
  if ((body.description ?? "").length > 4000) return "Description must be 4,000 characters or less.";
  return null;
}

export function canDelegate(role: Role): boolean {
  return DELEGATE_ROLES.includes(role);
}

/**
 * Who may edit a task:
 * - owner / admin: anything
 * - captain: tasks they created, or tasks assigned to their squad (checked by caller)
 * - assignee: their own tasks (title/description/due — reassignment stays with delegators)
 */
export function canEditTask(opts: {
  role: Role;
  actorId: string;
  task: Pick<CrmTask, "ownerId" | "createdBy">;
  sameSquad?: boolean;
}): boolean {
  const { role, actorId, task, sameSquad = false } = opts;
  if (role === "owner" || role === "admin") return true;
  if (task.ownerId === actorId) return true;
  if (role === "captain" && (task.createdBy === actorId || sameSquad)) return true;
  return false;
}

/** Who may clear (complete) a task: the assignee, the delegator, or owner/admin. */
export function canClearTask(opts: {
  role: Role;
  actorId: string;
  task: Pick<CrmTask, "ownerId" | "createdBy">;
}): boolean {
  const { role, actorId, task } = opts;
  if (role === "owner" || role === "admin") return true;
  return task.ownerId === actorId || task.createdBy === actorId;
}

export interface PendingGroup {
  assigneeId: string;
  tasks: CrmTask[];
}

/** Group open (non-done) tasks by assignee, overdue first within each group. */
export function groupPendingByAssignee(tasks: CrmTask[]): PendingGroup[] {
  const open = tasks.filter((t) => t.status !== "done");
  const by = new Map<string, CrmTask[]>();
  for (const t of open) {
    const list = by.get(t.ownerId) ?? [];
    list.push(t);
    by.set(t.ownerId, list);
  }
  const groups: PendingGroup[] = [...by.entries()].map(([assigneeId, list]) => ({
    assigneeId,
    tasks: list.sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt)),
  }));
  groups.sort((a, b) => b.tasks.length - a.tasks.length);
  return groups;
}

export function reminderSubject(slot: ReminderSlot, count: number): string {
  const label = slot === "midday" ? "Midday check-in" : "End-of-day wrap-up";
  return `${label}: ${count} open ${count === 1 ? "task" : "tasks"}`;
}

export function reminderLine(t: CrmTask): string {
  const overdue = new Date(t.dueAt).getTime() < Date.now();
  return `• ${t.title} — due ${new Date(t.dueAt).toLocaleString()}${overdue ? " (OVERDUE)" : ""}`;
}

/** Nairobi (EAT, UTC+3) clock — used to label reminder runs. */
export function nowInNairobi(): Date {
  return new Date(Date.now() + 3 * 3600 * 1000);
}
