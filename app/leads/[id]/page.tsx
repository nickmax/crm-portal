"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useCrm, uid, fmtKES, audit } from "@/lib/crm/store";
import { Eyebrow, LeadBadge, StageBadge } from "@/components/crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LeadStatus } from "@/lib/crm/types";

const QUICK = ["No answer", "Replied", "Interested", "Meeting booked", "Follow up later", "Not interested"] as const;

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const s = useCrm();
  const router = useRouter();
  const [logOpen, setLogOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextDue, setNextDue] = useState("");

  const lead = s.leads.find((l) => l.id === params.id);
  if (!lead) return <div className="py-20 text-center"><p className="font-display text-3xl">Lead not found</p><Link href="/leads" className="underline">Back to leads</Link></div>;

  const company = s.companies.find((c) => c.id === lead.companyId);
  const owner = s.members.find((m) => m.id === lead.ownerId);
  const contacts = s.contacts.filter((c) => c.companyId === lead.companyId);
  const activities = s.activities.filter((a) => a.leadId === lead.id).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const tasks = s.tasks.filter((t) => t.leadId === lead.id);
  const opps = s.opportunities.filter((o) => o.leadId === lead.id);
  const meetings = s.meetings.filter((m) => m.leadId === lead.id);
  const canReview = ["owner", "admin", "captain"].includes(s.currentUser.role);

  const setStatus = (status: LeadStatus, reason?: string) => {
    s.mutate((st) => ({
      ...st,
      leads: st.leads.map((l) => l.id === lead.id ? { ...l, status, rejectReason: reason ?? l.rejectReason, lastActivityAt: new Date().toISOString() } : l),
      activities: [...st.activities, { id: uid("a"), leadId: lead.id, companyId: lead.companyId, actorId: st.currentUserId, kind: "status" as const, summary: `Status → ${status}${reason ? ` — ${reason}` : ""}`, createdAt: new Date().toISOString() }],
      audit: audit(st, st.currentUserId, "Lead status change", "lead", lead.id, `${lead.id} → ${status}`),
    }));
  };

  const logInteraction = () => {
    if (!logOpen) return;
    s.mutate((st) => ({
      ...st,
      leads: st.leads.map((l) => l.id === lead.id ? {
        ...l,
        lastActivityAt: new Date().toISOString(),
        nextAction: nextAction || l.nextAction,
        nextDueAt: nextDue ? new Date(nextDue).toISOString() : l.nextDueAt,
        status: logOpen === "Interested" ? "qualified" : logOpen === "Meeting booked" ? "meeting_booked" : logOpen === "Not interested" ? "lost" : l.status,
      } : l),
      activities: [...st.activities, { id: uid("a"), leadId: lead.id, companyId: lead.companyId, actorId: st.currentUserId, kind: "note" as const, summary: `${logOpen}: ${note || nextAction || "logged"}`, outcome: logOpen, createdAt: new Date().toISOString() }],
      tasks: nextAction ? [...st.tasks, { id: uid("t"), leadId: lead.id, companyId: lead.companyId, ownerId: lead.ownerId, title: nextAction, dueAt: nextDue ? new Date(nextDue).toISOString() : new Date(Date.now() + 3 * 86400000).toISOString(), status: "open" as const, createdAt: new Date().toISOString() }] : st.tasks,
    }));
    setLogOpen(null); setNote(""); setNextAction(""); setNextDue("");
  };

  const qualify = () => {
    s.mutate((st) => {
      if (st.opportunities.some((o) => o.leadId === lead.id)) return st;
      const opp = { id: uid("op"), leadId: lead.id, companyId: lead.companyId, ownerId: st.members.find((m) => m.role === "sales")?.id ?? st.currentUserId, bdpId: lead.ownerId, stage: "qualified" as const, value: lead.valuePotential, expectedClose: new Date(Date.now() + 21 * 86400000).toISOString(), problem: lead.observedProblem, decisionMaker: lead.decisionMakerName ?? "TBC", qualificationNotes: note || "Qualified from lead profile", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      return {
        ...st,
        opportunities: [...st.opportunities, opp],
        leads: st.leads.map((l) => l.id === lead.id ? { ...l, status: "qualified" as LeadStatus, lastActivityAt: new Date().toISOString() } : l),
        audit: audit(st, st.currentUserId, "Opportunity created", "opportunity", opp.id, `from ${lead.id}`),
      };
    });
  };

  return (
    <div>
      <Eyebrow>Company &amp; lead profile</Eyebrow>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl tracking-tight lg:text-5xl">{company?.name}</h1>
        <LeadBadge status={lead.status} />
      </div>
      <p className="mt-2 text-muted-foreground">{company?.industry} · {company?.location} · Owner {owner?.name} · Source: {lead.source}</p>

      {/* 30-second quick log */}
      <Card className="mt-5 rounded-xl border-foreground/15">
        <CardContent className="px-5 py-4">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Log an interaction · under 30 seconds</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK.map((k) => (
              <button key={k} onClick={() => setLogOpen(k)} className="rounded-full border border-foreground/15 px-4 py-2 text-[13px] font-medium hover:bg-foreground hover:text-background">{k}</button>
            ))}
          </div>
          {logOpen && (
            <div className="mt-3 grid gap-2 rounded-xl bg-foreground/5 p-4">
              <p className="text-sm font-medium">{logOpen} — only the details needed</p>
              <Label>Note</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Result of the conversation…" className="rounded-xl" />
              <div className="grid gap-2 sm:grid-cols-2">
                <div><Label>Next action *</Label><Input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Call back Thursday 10am" className="h-10 rounded-xl" /></div>
                <div><Label>Due *</Label><Input type="datetime-local" value={nextDue} onChange={(e) => setNextDue(e.target.value)} className="h-10 rounded-xl" /></div>
              </div>
              <div className="flex gap-2"><Button variant="outline" className="rounded-full" onClick={() => setLogOpen(null)}>Cancel</Button><Button className="rounded-full bg-foreground text-background" onClick={logInteraction}>Save · keeps owner + next step</Button></div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="rounded-xl">
            <CardHeader><CardTitle className="font-display text-2xl">Overview</CardTitle></CardHeader>
            <CardContent className="grid gap-3 px-6 pb-6 sm:grid-cols-2 text-sm">
              <Fact k="Website" v={company?.website ?? "—"} />
              <Fact k="Email / phone" v={`${company?.email ?? "—"} · ${company?.phone ?? "—"}`} />
              <Fact k="Observed problem" v={lead.observedProblem} />
              <Fact k="Decision-maker" v={lead.decisionMakerName ?? "Unknown — capture on next contact"} />
              <Fact k="Potential value" v={fmtKES(lead.valuePotential)} />
              <Fact k="Next action" v={`${lead.nextAction} · due ${new Date(lead.nextDueAt).toLocaleString()}`} />
              {company?.priorOutcome && <Fact k="Prior history" v={company.priorOutcome} />}
              {lead.rejectReason && <Fact k="Rejected / lost reason" v={lead.rejectReason} />}
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader><CardTitle className="font-display text-2xl">Activity timeline</CardTitle></CardHeader>
            <CardContent className="space-y-2.5 px-6 pb-6">
              {activities.map((a) => (
                <div key={a.id} className="flex gap-3 rounded-xl border border-foreground/10 px-4 py-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-foreground" />
                  <div><p className="text-sm">{a.summary}</p><p className="font-mono text-[11px] text-muted-foreground">{new Date(a.createdAt).toLocaleString()} · {s.members.find((m) => m.id === a.actorId)?.name}</p></div>
                </div>
              ))}
              {activities.length === 0 && <p className="text-sm text-muted-foreground">No activity yet — log the first interaction above.</p>}
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader><CardTitle className="font-display text-2xl">Meetings &amp; opportunities</CardTitle></CardHeader>
            <CardContent className="space-y-2 px-6 pb-6">
              {meetings.map((m) => <div key={m.id} className="rounded-xl border border-foreground/10 px-4 py-3 text-sm"><p className="font-medium">{new Date(m.date).toLocaleString()} — {m.outcome}</p><p className="text-muted-foreground">{m.notes} · Next: {m.nextAction}</p></div>)}
              {opps.map((o) => <div key={o.id} className="flex items-center justify-between rounded-xl border border-foreground/10 px-4 py-3 text-sm"><span className="font-medium">{fmtKES(o.value)} · closes {new Date(o.expectedClose).toLocaleDateString()}</span><StageBadge stage={o.stage} /></div>)}
              {meetings.length === 0 && opps.length === 0 && <p className="text-sm text-muted-foreground">No meetings or opportunities yet.</p>}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="rounded-full" onClick={qualify}>Mark interested &amp; qualify →</Button>
                <Button asChild variant="outline" className="rounded-full"><Link href="/pipeline">Open pipeline</Link></Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="rounded-xl">
            <CardHeader><CardTitle className="font-display text-2xl">Review</CardTitle></CardHeader>
            <CardContent className="grid gap-2 px-6 pb-6">
              {canReview ? (
                <>
                  <Button className="rounded-full bg-foreground text-background" onClick={() => setStatus("accepted")}>Accept + assign owner</Button>
                  <Button variant="outline" className="rounded-full" onClick={() => setStatus("info_requested", "Need decision-maker + evidence")}>Return for info</Button>
                  <Button variant="outline" className="rounded-full" onClick={() => setStatus("duplicate", "Matches existing company record")}>Mark duplicate</Button>
                  <Button variant="outline" className="rounded-full" onClick={() => { const r = prompt("Rejection reason (required):"); if (r) setStatus("rejected", r); }}>Reject with reason</Button>
                </>
              ) : <p className="text-sm text-muted-foreground">Your captain or admin reviews new leads. Keep logging outreach meanwhile.</p>}
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardHeader><CardTitle className="font-display text-2xl">Contacts</CardTitle></CardHeader>
            <CardContent className="space-y-2 px-6 pb-6 text-sm">
              {contacts.map((c) => <div key={c.id} className="rounded-xl border border-foreground/10 px-3 py-2"><p className="font-medium">{c.name} {c.decisionMaker && "· decision-maker"}</p><p className="text-muted-foreground">{c.role} · {c.email}</p></div>)}
              {contacts.length === 0 && <p className="text-muted-foreground">No contacts linked yet.</p>}
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardHeader><CardTitle className="font-display text-2xl">Tasks</CardTitle></CardHeader>
            <CardContent className="space-y-2 px-6 pb-6 text-sm">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded-xl border border-foreground/10 px-3 py-2">
                  <span className={t.status === "done" ? "line-through text-muted-foreground" : ""}>{t.title}</span>
                  {t.status !== "done" && <button className="rounded-full border px-3 py-1 text-xs" onClick={() => s.mutate((st) => ({ ...st, tasks: st.tasks.map((x) => x.id === t.id ? { ...x, status: "done" as const } : x) }))}>Done</button>}
                </div>
              ))}
              {tasks.length === 0 && <p className="text-muted-foreground">No tasks.</p>}
            </CardContent>
          </Card>
          <Button variant="outline" className="w-full rounded-full" onClick={() => router.push("/leads")}>← All leads</Button>
        </div>
      </div>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return <div className="rounded-xl bg-foreground/5 p-3"><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{k}</p><p className="mt-0.5">{v}</p></div>;
}
