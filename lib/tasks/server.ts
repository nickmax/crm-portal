// Server-only helpers for the delegated-tasks API (DB + email side effects).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/crm/auth";
import { sendBulkEmail, announcementHtml } from "@/lib/notify/email";
import type { CrmTask } from "@/lib/crm/types";

export function resolveRole(p: { crm_role?: string | null; role?: string | null }): string {
  if (p?.role === "admin") return "owner";
  if (["owner", "admin", "captain", "bdp", "sales"].includes(p?.crm_role ?? "")) return p!.crm_role as string;
  return p?.role === "sales_manager" ? "sales" : "bdp";
}

export function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export async function requester(svc: ReturnType<typeof serviceClient>) {
  const sb = await createServerSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const { data: profile } = await svc.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) return { error: NextResponse.json({ error: "No team profile for this account." }, { status: 403 }) };
  const p = profile as ProfileRow;
  return {
    user,
    profile: p,
    role: resolveRole(p),
    actorMemberId: p.app_ref ?? p.id,
    svc,
  };
}

/** All ids that may appear in a task's assignee/created_by columns for this profile. */
export function memberKeys(p: ProfileRow): string[] {
  return [...new Set([p.id, p.app_ref].filter(Boolean) as string[])];
}

export function rowToTask(r: Row): CrmTask {
  return {
    id: r.crm_ref ?? `t-${r.id}`,
    leadId: r.lead_ref ?? null,
    companyId: null, // resolved client-side via lead → company when linked
    ownerId: r.assignee ?? "",
    title: r.title ?? "",
    description: r.description ?? "",
    dueAt: r.due_at ?? r.created_at ?? new Date().toISOString(),
    status: r.status === "done" ? "done" : "open",
    createdAt: r.created_at ?? new Date().toISOString(),
    createdBy: r.created_by ?? undefined,
    priority: ["low", "normal", "high"].includes(r.priority) ? r.priority : "normal",
  };
}

function missingColumn(err: string): boolean {
  return /column|schema cache|PGRST/i.test(err);
}

/** Insert a followup_tasks row, tolerating a backend that hasn't run the new migration yet. */
export async function insertTaskRow(
  svc: ReturnType<typeof serviceClient>,
  full: Row
): Promise<{ id?: number; error?: string }> {
  const attempt = async (payload: Row) => {
    const { data, error } = await svc.from("followup_tasks").insert(payload).select("id");
    if (error) return { error: error.message };
    return { id: (data as Row[])?.[0]?.id as number | undefined };
  };
  const first = await attempt(full);
  if (!first.error) return first;
  if (!missingColumn(first.error)) return first;
  const { description: _d, created_by: _c, priority: _p, ...minimal } = full;
  void _d; void _c; void _p;
  return attempt(minimal);
}

/** Update a followup_tasks row by numeric id, with the same migration tolerance. */
export async function updateTaskRow(
  svc: ReturnType<typeof serviceClient>,
  id: number,
  full: Row
): Promise<{ error?: string }> {
  const { error } = await svc.from("followup_tasks").update(full).eq("id", id);
  if (!error) return {};
  if (!missingColumn(error.message)) return { error: error.message };
  const { description: _d, created_by: _c, priority: _p, ...minimal } = full;
  void _d; void _c; void _p;
  const retry = await svc.from("followup_tasks").update(minimal).eq("id", id);
  return retry.error ? { error: retry.error.message } : {};
}

/** Resolve a numeric businesses.id for an optional lead/company app id. */
export async function resolveBusinessId(
  svc: ReturnType<typeof serviceClient>,
  leadId?: string | null,
  companyId?: string | null
): Promise<number | null> {
  if (leadId) {
    const { data } = await svc.from("businesses").select("id").eq("crm_lead_ref", leadId).maybeSingle();
    if ((data as Row | null)?.id) return (data as Row).id;
  }
  if (companyId) {
    const { data } = await svc.from("businesses").select("id").eq("legacy_place_id", companyId).maybeSingle();
    if ((data as Row | null)?.id) return (data as Row).id;
  }
  return null;
}

export function taskAssignedHtml(opts: {
  title: string; description: string; dueAt: string; priority: string; fromName: string;
}): string {
  const due = new Date(opts.dueAt).toLocaleString();
  return announcementHtml(
    `New task: ${opts.title}`,
    `${opts.fromName} assigned you a task.\n\n${opts.description || "(no details)"}\n\nDue: ${due} · Priority: ${opts.priority}\n\nIt stays in your notifications until you clear it. Open Tasks to edit or mark it done.`
  );
}

export function taskClearedHtml(opts: { title: string; clearedBy: string; note?: string }): string {
  return announcementHtml(
    `Task cleared: ${opts.title}`,
    `${opts.clearedBy} marked this task done.${opts.note ? `\n\nNote: ${opts.note}` : ""}\n\nNo further reminders will go out for it.`
  );
}

export function taskReminderHtml(opts: { slot: string; lines: string[]; total: number }): string {
  const label = opts.slot === "closing" ? "before close of business" : "at midday";
  const shown = opts.lines.slice(0, 10).join("\n");
  const more = opts.total > 10 ? `\n… and ${opts.total - 10} more.` : "";
  return announcementHtml(
    `Reminder ${label}: ${opts.total} open ${opts.total === 1 ? "task" : "tasks"}`,
    `You still have ${opts.total} open ${opts.total === 1 ? "task" : "tasks"}:\n\n${shown}${more}\n\nOpen Tasks to clear them — your captain is notified when each one is done.`
  );
}

export async function sendEmail(opts: { to: string[]; subject: string; html: string }) {
  return sendBulkEmail({ to: opts.to, subject: opts.subject, html: opts.html });
}

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}
