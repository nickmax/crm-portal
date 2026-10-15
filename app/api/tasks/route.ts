import { NextResponse } from "next/server";
import {
  serviceClient, requester, memberKeys, rowToTask, insertTaskRow,
  resolveBusinessId, taskAssignedHtml, sendEmail, uid,
  type Row,
} from "@/lib/tasks/server";
import { validateTaskInput, canDelegate } from "@/lib/tasks/delegated";
import type { ProfileRow } from "@/lib/crm/auth";

// GET /api/tasks — tasks relevant to the caller.
// owner/admin: every app task. Everyone else: assigned to me + delegated by me.
export async function GET() {
  const svc = serviceClient();
  const r = await requester(svc);
  if ("error" in r) return r.error;

  const { data, error } = await svc
    .from("followup_tasks")
    .select("*")
    .not("crm_ref", "is", null)
    .order("due_at", { ascending: true })
    .limit(500);
  if (error) return NextResponse.json({ error: `Couldn't load tasks: ${error.message}` }, { status: 500 });

  const rows = (data ?? []) as Row[];
  const keys = new Set(memberKeys(r.profile));
  const all = rows.map(rowToTask);
  const mine = all.filter((t) => keys.has(t.ownerId));
  const delegatedByMe = all.filter((t) => t.createdBy && keys.has(t.createdBy));
  const tasks = r.role === "owner" || r.role === "admin" ? all : [...new Map([...mine, ...delegatedByMe].map((t) => [t.id, t])).values()];
  return NextResponse.json({ ok: true, tasks, mine: mine.map((t) => t.id), delegatedByMe: delegatedByMe.map((t) => t.id) });
}

// POST /api/tasks — owner/admin/captain delegates task(s).
// Body: { title, description?, assigneeIds[], dueAt, priority?, leadId?, companyId? }
// Creates ONE task row per assignee so each person clears their own copy.
export async function POST(req: Request) {
  const svc = serviceClient();
  const r = await requester(svc);
  if ("error" in r) return r.error;
  if (!canDelegate(r.role as "owner" | "admin" | "captain" | "bdp" | "sales")) {
    return NextResponse.json({ error: "Only owners, admins and captains can delegate tasks." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const invalid = validateTaskInput(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const { title, description = "", assigneeIds, dueAt, priority = "normal", leadId = null, companyId = null } = body as {
    title: string; description?: string; assigneeIds: string[]; dueAt: string;
    priority?: string; leadId?: string | null; companyId?: string | null;
  };

  // Resolve assignees against real profiles (uuid or app_ref).
  const { data: profiles } = await svc.from("profiles").select("*").limit(500);
  const all = ((profiles ?? []) as ProfileRow[]);
  const byKey = new Map<string, ProfileRow>();
  for (const p of all) for (const k of memberKeys(p)) byKey.set(k, p);

  // Captains may only assign within their own squad.
  if (r.role === "captain") {
    const mySquad = r.profile.squad_id ?? null;
    const outsiders = assigneeIds.filter((id) => {
      const p = byKey.get(id);
      if (!p) return false; // demo/seed ids pass through (no profile to scope)
      return mySquad != null && p.squad_id !== mySquad && p.id !== r.user.id;
    });
    if (outsiders.length) {
      return NextResponse.json({ error: "Captains can only delegate to their own squad." }, { status: 403 });
    }
  }

  const bizId = await resolveBusinessId(svc, leadId, companyId);
  const fromName = r.profile.display_name ?? r.profile.email ?? "Your captain";
  const created: Row[] = [];
  const skipped: string[] = [];
  let notified = 0;

  for (const assigneeId of assigneeIds) {
    const ref = uid("task");
    const prof = byKey.get(assigneeId);
    const ins = await insertTaskRow(svc, {
      crm_ref: ref,
      business_id: bizId,
      title: title.trim(),
      description: description.trim(),
      created_by: r.actorMemberId,
      assignee: assigneeId,
      status: "pending",
      due_at: new Date(dueAt).toISOString(),
      lead_ref: leadId,
      priority,
    });
    if (ins.error) {
      skipped.push(`${assigneeId}: ${ins.error.slice(0, 120)}`);
      continue;
    }
    // Persistent in-app notification — stays unread until the task is cleared.
    if (prof) {
      const due = new Date(dueAt).toLocaleString();
      const { error: nErr } = await svc.from("notifications").insert({
        profile_id: prof.id,
        app_ref: ref,
        title: `New task: ${title.trim()}`,
        body: `${fromName}: ${(description.trim() || title.trim()).slice(0, 220)}\nDue ${due} · Priority ${priority}`,
        link: `/tasks?task=${ref}`,
        read: false,
      });
      if (!nErr) notified += 1;
    } else {
      skipped.push(`${assigneeId}: no team profile — task saved, no notification/email`);
    }
    created.push({ crm_ref: ref, assignee: assigneeId });
  }

  if (!created.length) {
    return NextResponse.json({ error: `Nothing saved. ${skipped.join(" · ").slice(0, 240)}` }, { status: 500 });
  }

  // Email every real assignee immediately.
  const emails = [...new Set(
    created.map((c) => byKey.get(c.assignee)?.email).filter(Boolean) as string[]
  )];
  const subject = `New task: ${title.trim()} — due ${new Date(dueAt).toLocaleDateString()}`;
  const html = taskAssignedHtml({
    title: title.trim(), description: description.trim(),
    dueAt, priority, fromName,
  });
  const mail = await sendEmail({ to: emails, subject, html });

  await svc.from("audit_log").insert({
    actor: r.user.id,
    action: "Task delegated",
    entity: "task",
    entity_id: created.map((c) => c.crm_ref).join(",").slice(0, 200),
    detail: `${title.trim()} → ${created.length} ${created.length === 1 ? "person" : "people"}${mail.queued ? " (email queued — Resend not configured)" : ` (${mail.sent} emailed)`}`,
  });

  // Return full task objects for the client's optimistic update.
  const { data: rows } = await svc.from("followup_tasks").select("*").in("crm_ref", created.map((c) => c.crm_ref));
  return NextResponse.json({
    ok: true,
    tasks: ((rows ?? []) as Row[]).map(rowToTask),
    notified,
    emailed: mail.sent,
    emailQueued: mail.queued,
    warnings: skipped.length ? skipped : undefined,
  });
}
