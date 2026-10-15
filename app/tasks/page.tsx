"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCrm, uid, isOverdue } from "@/lib/crm/store";
import { useAuth } from "@/lib/crm/auth";
import { PageHead } from "@/components/crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL, type CrmTask } from "@/lib/crm/types";
import { canDelegate as roleCanDelegate } from "@/lib/tasks/delegated";
import { cn } from "@/lib/utils";

const PRIORITIES = ["low", "normal", "high"] as const;

export default function TasksPage() {
  return (
    <Suspense fallback={<p className="py-10 font-mono text-sm text-muted-foreground">Loading tasks…</p>}>
      <TasksInner />
    </Suspense>
  );
}

function TasksInner() {
  const s = useCrm();
  const auth = useAuth();
  const params = useSearchParams();
  const focusId = params.get("task");
  const canDelegate = roleCanDelegate(s.currentUser.role);
  const canRemind = ["owner", "admin"].includes(s.currentUser.role);

  const [showDelegate, setShowDelegate] = useState(false);
  const [editing, setEditing] = useState<CrmTask | null>(null);
  const [clearing, setClearing] = useState<CrmTask | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [remindMsg, setRemindMsg] = useState<string | null>(null);
  const [remindBusy, setRemindBusy] = useState<string | null>(null);

  // Pull server truth (delegated tasks + edits from other devices) on entry.
  useEffect(() => {
    if (!auth.user) return;
    fetch("/api/tasks").then(async (r) => {
      if (!r.ok) return;
      const j = await r.json();
      const server = (j.tasks ?? []) as CrmTask[];
      if (!server.length) return;
      s.mutate((st) => {
        const ids = new Set(server.map((t) => t.id));
        const localOnly = st.tasks.filter((t) => !ids.has(t.id));
        // Server wins on conflict; keep local-only rows (offline work).
        const withCompany = server.map((t) => ({
          ...t,
          companyId: t.companyId ?? st.leads.find((l) => l.id === t.leadId)?.companyId ?? null,
        }));
        return { ...st, tasks: [...withCompany, ...localOnly] };
      });
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user?.id]);

  useEffect(() => {
    if (focusId) {
      const el = document.getElementById(`task-${focusId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusId, s.tasks.length]);

  const mine = useMemo(
    () => s.tasks.filter((t) => t.ownerId === s.currentUser.id && t.status !== "done")
      .sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt)),
    [s.tasks, s.currentUser.id]
  );
  const delegated = useMemo(() => {
    const me = s.currentUser.id;
    const open = s.tasks.filter((t) => t.status !== "done");
    if (s.currentUser.role === "owner" || s.currentUser.role === "admin") {
      return open.filter((t) => t.ownerId !== me).sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt));
    }
    return open.filter((t) => t.createdBy === me && t.ownerId !== me)
      .sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt));
  }, [s.tasks, s.currentUser.id, s.currentUser.role]);
  const doneRecent = useMemo(
    () => s.tasks.filter((t) => (t.ownerId === s.currentUser.id || t.createdBy === s.currentUser.id) && t.status === "done")
      .sort((a, b) => +new Date(b.dueAt) - +new Date(a.dueAt)).slice(0, 8),
    [s.tasks, s.currentUser.id]
  );

  const memberName = (id: string) => s.members.find((m) => m.id === id)?.name ?? "Unknown";

  const clearTask = async (task: CrmTask, note: string) => {
    setFlash(null);
    // Local/demo mode: no server — clear locally.
    if (!auth.user) {
      s.mutate((st) => ({
        ...st,
        tasks: st.tasks.map((t) => t.id === task.id ? { ...t, status: "done" as const } : t),
        notifications: st.notifications.map((n) => n.id === task.id || n.link.includes(task.id) ? { ...n, read: true } : n),
      }));
      setClearing(null);
      setFlash(`Cleared “${task.title}”. (Demo mode — sign in for email + team sync.)`);
      return;
    }
    try {
      const r = await fetch(`/api/tasks/${task.id}/clear`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const j = await r.json();
      if (!r.ok) { setFlash(`Couldn't clear — ${j.error}`); return; }
      s.mutate((st) => ({
        ...st,
        tasks: st.tasks.map((t) => t.id === task.id ? { ...(j.task ?? t), status: "done" as const } : t),
        notifications: st.notifications.map((n) => n.id === task.id || n.link.includes(task.id) ? { ...n, read: true } : n),
      }));
      setClearing(null);
      setFlash(`Cleared “${task.title}” — ${j.ownerNotified ?? 0} notified${j.emailQueued ? " · email queued (connect sending to deliver)" : j.emailed ? ` · ${j.emailed} emailed` : ""}.`);
    } catch {
      setFlash("Network error — try again.");
    }
  };

  const sendReminders = async (slot: "midday" | "closing") => {
    setRemindBusy(slot); setRemindMsg(null);
    try {
      const r = await fetch("/api/tasks/reminders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot }),
      });
      const j = await r.json();
      setRemindMsg(r.ok
        ? `${slot === "midday" ? "Midday" : "Closing"} reminders sent — ${j.reminded} ${j.reminded === 1 ? "person" : "people"}, ${j.tasks} open ${j.tasks === 1 ? "task" : "tasks"}${j.emailQueued ? " · email queued" : j.emailed ? ` · ${j.emailed} emailed` : ""}.`
        : `Failed — ${j.error}`);
    } catch {
      setRemindMsg("Network error — try again.");
    }
    setRemindBusy(null);
  };

  return (
    <div>
      <PageHead
        eyebrow="Follow-up discipline · delegation"
        title="Tasks"
        sub="The owner delegates work here. Assignees get a notification that stays until they clear it — plus an email, plus midday and end-of-day reminders."
        action={
          <div className="flex flex-wrap gap-2">
            {canRemind && (
              <>
                <Button variant="outline" size="sm" className="rounded-full" disabled={!!remindBusy} onClick={() => sendReminders("midday")}>
                  {remindBusy === "midday" ? "Sending…" : "Send midday reminders"}
                </Button>
                <Button variant="outline" size="sm" className="rounded-full" disabled={!!remindBusy} onClick={() => sendReminders("closing")}>
                  {remindBusy === "closing" ? "Sending…" : "Send closing reminders"}
                </Button>
              </>
            )}
            {canDelegate && (
              <Button size="sm" className="rounded-full bg-brand text-white" onClick={() => setShowDelegate(true)}>
                + Delegate a task
              </Button>
            )}
          </div>
        }
      />
      {remindMsg && <p className="mb-4 rounded-xl bg-foreground/5 px-4 py-3 text-sm">{remindMsg}</p>}
      {flash && <p className="mb-4 rounded-xl bg-green-600/10 px-4 py-3 text-sm text-green-900">{flash}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <TaskGroup
          title="My open tasks"
          items={mine}
          focusId={focusId}
          empty="Nothing assigned to you. Clear skies."
          memberName={memberName}
          leadHref={(t) => (t.leadId ? `/leads/${t.leadId}` : null)}
          onEdit={setEditing}
          onClear={setClearing}
        />
        <TaskGroup
          title={s.currentUser.role === "owner" || s.currentUser.role === "admin" ? "Everyone else's open tasks" : "Delegated by me"}
          items={delegated}
          focusId={focusId}
          empty={canDelegate ? "Nothing delegated yet — hit “Delegate a task” above." : "Tasks delegated to you appear under “My open tasks”."}
          memberName={memberName}
          leadHref={(t) => (t.leadId ? `/leads/${t.leadId}` : null)}
          onEdit={setEditing}
          onClear={setClearing}
          showAssignee
        />
      </div>

      {doneRecent.length > 0 && (
        <Card className="mt-4 rounded-xl">
          <CardHeader><CardTitle className="font-display text-2xl">Recently cleared</CardTitle></CardHeader>
          <CardContent className="space-y-2 px-6 pb-6">
            {doneRecent.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-foreground/10 px-4 py-2.5 text-sm">
                <span className="truncate text-muted-foreground line-through">{t.title}</span>
                <span className="shrink-0 font-mono text-[11px] uppercase text-muted-foreground">{memberName(t.ownerId)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {showDelegate && (
        <DelegateDialog
          onClose={() => setShowDelegate(false)}
          onDone={(msg) => { setShowDelegate(false); setFlash(msg); }}
        />
      )}
      {editing && (
        <EditDialog
          task={editing}
          onClose={() => setEditing(null)}
          onDone={(msg) => { setEditing(null); setFlash(msg); }}
        />
      )}
      {clearing && (
        <ClearDialog
          task={clearing}
          memberName={memberName(clearing.ownerId)}
          onClose={() => setClearing(null)}
          onConfirm={(note) => clearTask(clearing, note)}
        />
      )}
    </div>
  );
}

function TaskGroup({ title, items, focusId, empty, memberName, leadHref, onEdit, onClear, showAssignee }: {
  title: string; items: CrmTask[]; focusId: string | null; empty: string;
  memberName: (id: string) => string; leadHref: (t: CrmTask) => string | null;
  onEdit: (t: CrmTask) => void; onClear: (t: CrmTask) => void; showAssignee?: boolean;
}) {
  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="font-display text-2xl">{title} <span className="font-mono text-sm text-muted-foreground">· {items.length}</span></CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-6 pb-6">
        {items.map((t) => {
          const overdue = isOverdue(t.dueAt);
          const href = leadHref(t);
          return (
            <div
              key={t.id}
              id={`task-${t.id}`}
              className={cn(
                "rounded-xl border px-4 py-3",
                focusId === t.id ? "border-foreground ring-2 ring-foreground/20" : "border-foreground/10",
                overdue && "border-red-300"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t.title}</p>
                  {t.description && <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">{t.description}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Due {new Date(t.dueAt).toLocaleString()}
                    {overdue && <span className="font-medium text-red-700"> · Overdue</span>}
                    {(t.priority ?? "normal") !== "normal" && <span> · {t.priority} priority</span>}
                    {showAssignee && <span> · {memberName(t.ownerId)}</span>}
                    {href && <> · <Link href={href} className="underline">open lead</Link></>}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => onEdit(t)}>Edit</Button>
                  <Button size="sm" className="rounded-full bg-brand text-white" onClick={() => onClear(t)}>Clear</Button>
                </div>
              </div>
            </div>
          );
        })}
        {items.length === 0 && <p className="text-sm text-muted-foreground">{empty}</p>}
      </CardContent>
    </Card>
  );
}

function useAssignees() {
  const s = useCrm();
  return useMemo(() => {
    const list = [...s.members].sort((a, b) => a.name.localeCompare(b.name));
    return { list, byId: new Map(list.map((m) => [m.id, m])) };
  }, [s.members]);
}

function DelegateDialog({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const s = useCrm();
  const auth = useAuth();
  const { list } = useAssignees();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(17, 0, 0, 0);
    return toLocalInput(d);
  });
  const [priority, setPriority] = useState("normal");
  const [leadId, setLeadId] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggle = (id: string) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const submit = async () => {
    setBusy(true); setErr(null);
    const payload = {
      title: title.trim(), description: description.trim(), assigneeIds: picked,
      dueAt: new Date(due).toISOString(), priority, leadId: leadId || null,
    };
    // Signed out (demo mode): keep it local.
    if (!auth.user) {
      const now = new Date().toISOString();
      const companyId = s.leads.find((l) => l.id === payload.leadId)?.companyId ?? null;
      s.mutate((st) => {
        const tasks = picked.map((assignee) => ({
          id: uid("task"), leadId: payload.leadId, companyId, ownerId: assignee,
          title: payload.title, description: payload.description, dueAt: payload.dueAt,
          status: "open" as const, createdAt: now, createdBy: s.currentUser.id, priority: payload.priority as CrmTask["priority"],
        }));
        const notifs = tasks.map((t) => ({
          id: t.id, userId: t.ownerId, title: `New task: ${t.title}`,
          body: `${s.currentUser.name}: ${(t.description || t.title).slice(0, 220)}\nDue ${new Date(t.dueAt).toLocaleString()}`,
          createdAt: now, read: false, link: `/tasks?task=${t.id}`,
        }));
        return { ...st, tasks: [...st.tasks, ...tasks], notifications: [...st.notifications, ...notifs] };
      });
      setBusy(false);
      onDone(`Delegated “${payload.title}” to ${picked.length} ${picked.length === 1 ? "person" : "people"}. (Demo mode — sign in for email + team sync.)`);
      return;
    }
    try {
      const r = await fetch("/api/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error ?? "Failed."); setBusy(false); return; }
      const server = (j.tasks ?? []) as CrmTask[];
      s.mutate((st) => {
        const withCompany = server.map((t) => ({
          ...t, companyId: st.leads.find((l) => l.id === t.leadId)?.companyId ?? null,
        }));
        return { ...st, tasks: [...st.tasks, ...withCompany] };
      });
      onDone(`Delegated “${payload.title}” — ${j.notified} notified in-app${j.emailQueued ? " · email queued (connect sending to deliver)" : j.emailed ? ` · ${j.emailed} emailed` : ""}${j.warnings ? ` · note: ${j.warnings.join("; ").slice(0, 160)}` : ""}.`);
    } catch {
      setErr("Network error — try again.");
    }
    setBusy(false);
  };

  return (
    <Overlay onClose={onClose} title="Delegate a task">
      <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Call ABC Distributors — confirm order volume" className="mt-1 h-11 rounded-xl" /></div>
      <div><Label>Details <span className="font-mono text-[11px] text-muted-foreground">(what done looks like)</span></Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Call George, confirm monthly volume + delivery days, log outcome on the lead." className="mt-1 rounded-xl" /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Due</Label><Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="mt-1 h-11 rounded-xl" /></div>
        <div>
          <Label>Priority</Label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-foreground/15 bg-card px-3 text-sm">
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div>
        <Label>Link a lead <span className="font-mono text-[11px] text-muted-foreground">(optional)</span></Label>
        <select value={leadId} onChange={(e) => setLeadId(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-foreground/15 bg-card px-3 text-sm">
          <option value="">No lead — standalone task</option>
          {s.leads.map((l) => <option key={l.id} value={l.id}>{s.companies.find((c) => c.id === l.companyId)?.name ?? l.id} — {l.nextAction.slice(0, 40)}</option>)}
        </select>
      </div>
      <div>
        <Label>Assign to <span className="font-mono text-[11px] text-muted-foreground">· {picked.length} picked</span></Label>
        <div className="mt-1.5 grid max-h-48 gap-1 overflow-y-auto rounded-xl border border-foreground/10 p-2">
          {list.map((m) => (
            <label key={m.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] hover:bg-foreground/5">
              <input type="checkbox" className="h-4 w-4" checked={picked.includes(m.id)} onChange={() => toggle(m.id)} />
              <span className="font-medium">{m.name}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{ROLE_LABEL[m.role]}{m.email ? ` · ${m.email}` : ""}</span>
            </label>
          ))}
        </div>
      </div>
      {err && <p className="rounded-xl bg-red-600/10 px-4 py-2.5 text-sm text-red-800">{err}</p>}
      <Button className="w-full rounded-full bg-brand text-white" disabled={busy || !title.trim() || !picked.length || !due} onClick={submit}>
        {busy ? "Delegating…" : `Delegate to ${picked.length} ${picked.length === 1 ? "person" : "people"}`}
      </Button>
    </Overlay>
  );
}

function EditDialog({ task, onClose, onDone }: { task: CrmTask; onClose: () => void; onDone: (msg: string) => void }) {
  const s = useCrm();
  const auth = useAuth();
  const { list } = useAssignees();
  const canReassign = ["owner", "admin", "captain"].includes(s.currentUser.role);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [due, setDue] = useState(toLocalInput(new Date(task.dueAt)));
  const [priority, setPriority] = useState<string>(task.priority ?? "normal");
  const [assignee, setAssignee] = useState(task.ownerId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setErr(null);
    const patch = {
      title: title.trim(), description,
      dueAt: new Date(due).toISOString(), priority,
      assigneeId: assignee !== task.ownerId ? assignee : undefined,
    };
    if (!auth.user) {
      const localPriority = (["low", "normal", "high"].includes(priority) ? priority : "normal") as CrmTask["priority"];
      s.mutate((st) => ({
        ...st,
        tasks: st.tasks.map((t) => t.id === task.id
          ? { ...t, title: patch.title, description: patch.description, dueAt: patch.dueAt, priority: localPriority, ownerId: assignee }
          : t),
      }));
      setBusy(false);
      onDone(`Updated “${patch.title}”. (Demo mode — sign in for team sync.)`);
      return;
    }
    try {
      const r = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error ?? "Failed."); setBusy(false); return; }
      const updated = (j.task ?? null) as CrmTask | null;
      s.mutate((st) => ({
        ...st,
        tasks: st.tasks.map((t) => t.id === task.id
          ? (updated ?? { ...t, title: patch.title, description: patch.description, dueAt: patch.dueAt, priority: patch.priority as CrmTask["priority"], ownerId: assignee })
          : t),
      }));
      onDone(`Updated “${patch.title}”${j.renotified ? " — new assignee notified + emailed" : ""}.`);
    } catch {
      setErr("Network error — try again.");
    }
    setBusy(false);
  };

  return (
    <Overlay onClose={onClose} title="Edit task">
      <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 h-11 rounded-xl" /></div>
      <div><Label>Details</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="mt-1 rounded-xl" /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Due</Label><Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="mt-1 h-11 rounded-xl" /></div>
        <div>
          <Label>Priority</Label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-foreground/15 bg-card px-3 text-sm">
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      {canReassign && (
        <div>
          <Label>Assignee</Label>
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-foreground/15 bg-card px-3 text-sm">
            {list.map((m) => <option key={m.id} value={m.id}>{m.name} — {ROLE_LABEL[m.role]}</option>)}
          </select>
          {assignee !== task.ownerId && <p className="mt-1 text-xs text-muted-foreground">Reassigning notifies + emails the new person.</p>}
        </div>
      )}
      {err && <p className="rounded-xl bg-red-600/10 px-4 py-2.5 text-sm text-red-800">{err}</p>}
      <Button className="w-full rounded-full bg-brand text-white" disabled={busy || !title.trim() || !due} onClick={submit}>
        {busy ? "Saving…" : "Save changes"}
      </Button>
    </Overlay>
  );
}

function ClearDialog({ task, memberName, onClose, onConfirm }: {
  task: CrmTask; memberName: string; onClose: () => void; onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <Overlay onClose={onClose} title="Clear this task?">
      <p className="text-sm">“{task.title}” <span className="text-muted-foreground">· {memberName}</span></p>
      <p className="text-[13px] text-muted-foreground">Clearing retires its notification and emails the delegator that it&apos;s done. No more reminders go out.</p>
      <div><Label>Done-note <span className="font-mono text-[11px] text-muted-foreground">(optional — sent to the owner)</span></Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Called George — 200 units/month confirmed." className="mt-1 rounded-xl" /></div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 rounded-full" onClick={onClose}>Keep it</Button>
        <Button className="flex-1 rounded-full bg-brand text-white" onClick={() => onConfirm(note.trim())}>Mark done</Button>
      </div>
    </Overlay>
  );
}

function Overlay({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-4 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-lg space-y-3 rounded-2xl border border-foreground/10 bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="flex items-center justify-between">
          <p className="font-display text-2xl">{title}</p>
          <button onClick={onClose} className="rounded-full border border-foreground/15 px-3 py-1 text-xs hover:bg-foreground hover:text-background" aria-label="Close">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TaskOverdueBadge({ count }: { count: number }) {
  if (!count) return null;
  return <Badge className="ml-auto rounded-full bg-brand text-white">{count}</Badge>;
}
