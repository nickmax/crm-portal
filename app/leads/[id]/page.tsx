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
import type { LeadStatus, Lead } from "@/lib/crm/types";
import { LEAD_STATUS_LABEL } from "@/lib/crm/types";

const QUICK = ["No answer", "Replied", "Interested", "Meeting booked", "Follow up later", "Not interested"] as const;

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const s = useCrm();
  const router = useRouter();
  const [logOpen, setLogOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextDue, setNextDue] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [editingContact, setEditingContact] = useState<string | null>(null);

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
  const canEdit =
    ["owner", "admin"].includes(s.currentUser.role) ||
    (s.currentUser.role === "captain" && s.currentUser.squadId != null && s.currentUser.squadId === lead.squadId) ||
    lead.ownerId === s.currentUser.id;

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
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl lg:text-5xl">{company?.name}</h1>
        <LeadBadge status={lead.status} />
        {canEdit && <Button size="sm" variant="outline" className="rounded-full" onClick={() => setShowEdit(true)}>Edit everything</Button>}
      </div>
      <p className="mt-2 text-muted-foreground">{company?.industry} · {company?.location} · Owner {owner?.name} · Source: {lead.source}</p>

      {/* 30-second quick log */}
      <Card className="mt-5 rounded-xl border-foreground/15">
        <CardContent className="px-5 py-4">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Log an interaction · under 30 seconds</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK.map((k) => (
              <button key={k} onClick={() => setLogOpen(k)} className="inline-flex min-h-[44px] items-center rounded-full border border-foreground/15 px-4 py-2 text-[13px] font-medium hover:bg-foreground hover:text-background">{k}</button>
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
              <div className="flex gap-2"><Button variant="outline" className="rounded-full" onClick={() => setLogOpen(null)}>Cancel</Button><Button className="rounded-full btn-brand" onClick={logInteraction}>Save · keeps owner + next step</Button></div>
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
                  <Button className="rounded-full btn-brand" onClick={() => setStatus("accepted")}>Accept + assign owner</Button>
                  <Button variant="outline" className="rounded-full" onClick={() => setStatus("info_requested", "Need decision-maker + evidence")}>Return for info</Button>
                  <Button variant="outline" className="rounded-full" onClick={() => setStatus("duplicate", "Matches existing company record")}>Mark duplicate</Button>
                  <Button variant="outline" className="rounded-full" onClick={() => { const r = prompt("Rejection reason (required):"); if (r) setStatus("rejected", r); }}>Reject with reason</Button>
                </>
              ) : <p className="text-sm text-muted-foreground">Your captain or admin reviews new leads. Keep logging outreach meanwhile.</p>}
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardHeader><CardTitle className="font-display text-2xl">Contacts <span className="font-mono text-sm text-muted-foreground">· {contacts.length}</span></CardTitle></CardHeader>
            <CardContent className="space-y-2 px-6 pb-6 text-sm">
              {contacts.map((c) => (
                <div key={c.id}>
                  {editingContact === c.id ? (
                    <ContactForm
                      companyId={lead.companyId}
                      initial={c}
                      onDone={() => setEditingContact(null)}
                    />
                  ) : (
                    <div className="rounded-xl border border-foreground/10 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{c.name} {c.decisionMaker && <span className="ml-1 rounded-full bg-brand/15 px-2 py-0.5 text-[11px] text-brand-deep">decision-maker</span>}</p>
                        {canEdit && (
                          <div className="flex shrink-0 gap-1">
                            <button className="rounded-full border border-foreground/15 px-2.5 py-1 text-[11px] hover:bg-foreground hover:text-background" onClick={() => setEditingContact(c.id)}>Edit</button>
                            <button className="rounded-full border border-red-300 px-2.5 py-1 text-[11px] text-red-700 hover:bg-red-600 hover:text-white" onClick={() => {
                              if (!confirm(`Remove ${c.name} from this lead? This syncs to the team.`)) return;
                              s.mutate((st) => ({ ...st, contacts: st.contacts.filter((x) => x.id !== c.id) }));
                            }}>Remove</button>
                          </div>
                        )}
                      </div>
                      <p className="text-muted-foreground">{c.role ?? "—"}</p>
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        {c.email && <a className="text-brand-deep underline" href={`mailto:${c.email}`}>{c.email}</a>}
                        {c.phone && <a className="text-brand-deep underline" href={`tel:${c.phone.replace(/\s/g, "")}`}>{c.phone}</a>}
                        {!c.email && !c.phone && <span className="text-muted-foreground">No email or phone yet</span>}
                      </p>
                    </div>
                  )}
                </div>
              ))}
              {contacts.length === 0 && !showAddContact && <p className="text-muted-foreground">No contacts linked yet.</p>}
              {canEdit && !showAddContact && (
                <Button variant="outline" size="sm" className="w-full rounded-full" onClick={() => setShowAddContact(true)}>+ Add contact</Button>
              )}
              {showAddContact && <ContactForm companyId={lead.companyId} onDone={() => setShowAddContact(false)} />}
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
      {showEdit && company && (
        <EditLeadDialog leadId={lead.id} companyId={company.id} onClose={() => setShowEdit(false)} />
      )}
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return <div className="rounded-xl bg-foreground/5 p-3"><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{k}</p><p className="mt-0.5">{v}</p></div>;
}

function ContactForm({ companyId, initial, onDone }: {
  companyId: string;
  initial?: { id: string; name: string; role?: string; email?: string; phone?: string; decisionMaker: boolean };
  onDone: () => void;
}) {
  const s = useCrm();
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [dm, setDm] = useState(initial?.decisionMaker ?? false);
  const [err, setErr] = useState<string | null>(null);

  const save = () => {
    if (!name.trim()) { setErr("Name is required."); return; }
    if (!email.trim() && !phone.trim()) { setErr("Add an email or a phone number — that's what makes the phonebook useful."); return; }
    s.mutate((st) => {
      if (initial) {
        return { ...st, contacts: st.contacts.map((c) => c.id === initial.id ? { ...c, name: name.trim(), role: role.trim() || undefined, email: email.trim() || undefined, phone: phone.trim() || undefined, decisionMaker: dm } : c) };
      }
      return {
        ...st,
        contacts: [...st.contacts, { id: uid("ct"), companyId, name: name.trim(), role: role.trim() || undefined, email: email.trim() || undefined, phone: phone.trim() || undefined, decisionMaker: dm }],
      };
    });
    onDone();
  };

  return (
    <div className="space-y-2 rounded-xl border border-brand/30 bg-brand/[0.04] p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="mt-1 h-10 rounded-xl" /></div>
        <div><Label>Role</Label><Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Operations Director" className="mt-1 h-10 rounded-xl" /></div>
        <div><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.co.ke" inputMode="email" className="mt-1 h-10 rounded-xl" /></div>
        <div><Label>Phone / WhatsApp</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2547…" inputMode="tel" className="mt-1 h-10 rounded-xl" /></div>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-[13px]">
        <input type="checkbox" className="h-4 w-4" checked={dm} onChange={(e) => setDm(e.target.checked)} /> Decision-maker
      </label>
      {err && <p className="text-[13px] text-red-700">{err}</p>}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 rounded-full" onClick={onDone}>Cancel</Button>
        <Button size="sm" className="flex-1 rounded-full btn-brand" onClick={save}>{initial ? "Save contact" : "Add contact"}</Button>
      </div>
    </div>
  );
}

const LEAD_STATUSES = Object.keys(LEAD_STATUS_LABEL) as LeadStatus[];

function EditLeadDialog({ leadId, companyId, onClose }: { leadId: string; companyId: string; onClose: () => void }) {
  const s = useCrm();
  const lead = s.leads.find((l) => l.id === leadId);
  const company = s.companies.find((c) => c.id === companyId);
  const canAssign = ["owner", "admin", "captain"].includes(s.currentUser.role);
  const sel = "mt-1 h-11 w-full rounded-xl border border-foreground/15 bg-card px-3 text-sm";

  const [cName, setCName] = useState(company?.name ?? "");
  const [cWebsite, setCWebsite] = useState(company?.website ?? "");
  const [cEmail, setCEmail] = useState(company?.email ?? "");
  const [cPhone, setCPhone] = useState(company?.phone ?? "");
  const [cIndustry, setCIndustry] = useState(company?.industry ?? "General");
  const [cSize, setCSize] = useState(company?.size ?? "11–50");
  const [cLocation, setCLocation] = useState(company?.location ?? "");
  const [cPrior, setCPrior] = useState(!!company?.priorContact);
  const [cOutcome, setCOutcome] = useState(company?.priorOutcome ?? "");
  const [cClient, setCClient] = useState(!!company?.isClient);
  const [status, setStatus] = useState<LeadStatus>(lead?.status ?? "new");
  const [ownerId, setOwnerId] = useState(lead?.ownerId ?? "");
  const [squadId, setSquadId] = useState(lead?.squadId ?? "");
  const [source, setSource] = useState(lead?.source ?? "");
  const [problem, setProblem] = useState(lead?.observedProblem ?? "");
  const [evidence, setEvidence] = useState(lead?.evidence ?? "");
  const [lValue, setLValue] = useState(String(lead?.valuePotential ?? 0));
  const [urgency, setUrgency] = useState(lead?.urgency ?? "medium");
  const [dmName, setDmName] = useState(lead?.decisionMakerName ?? "");
  const [nextAction, setNextAction] = useState(lead?.nextAction ?? "");
  const [nextDue, setNextDue] = useState(lead ? toLocalInput(new Date(lead.nextDueAt)) : "");
  const [rejectReason, setRejectReason] = useState(lead?.rejectReason ?? "");
  const [busy, setBusy] = useState(false);

  if (!lead || !company) return null;

  const save = () => {
    if (!cName.trim()) return;
    setBusy(true);
    s.mutate((st) => ({
      ...st,
      companies: st.companies.map((c) => c.id === companyId ? {
        ...c, name: cName.trim(), website: cWebsite.trim() || undefined,
        email: cEmail.trim() || undefined, phone: cPhone.trim() || undefined,
        industry: cIndustry.trim() || "General", size: cSize, location: cLocation.trim() || undefined,
        priorContact: cPrior, priorOutcome: cOutcome.trim() || undefined, isClient: cClient,
      } : c),
      leads: st.leads.map((l) => l.id === leadId ? {
        ...l, status, ownerId: canAssign && ownerId ? ownerId : l.ownerId,
        squadId: canAssign && squadId ? squadId : l.squadId,
        source, observedProblem: problem, evidence: evidence || undefined,
        valuePotential: Number(lValue) || 0, urgency: urgency as Lead["urgency"],
        decisionMakerName: dmName.trim() || undefined,
        nextAction: nextAction.trim() || l.nextAction,
        nextDueAt: nextDue ? new Date(nextDue).toISOString() : l.nextDueAt,
        rejectReason: rejectReason.trim() || undefined,
        lastActivityAt: new Date().toISOString(),
      } : l),
      activities: [...st.activities, { id: uid("a"), leadId, companyId, actorId: st.currentUserId, kind: "note" as const, summary: "Lead record edited", createdAt: new Date().toISOString() }],
      audit: audit(st, st.currentUserId, "Lead edited", "lead", leadId, cName.trim()),
    }));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-4 sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl border border-foreground/10 bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Edit lead">
        <div className="flex items-center justify-between">
          <p className="font-display text-2xl">Edit lead — every field</p>
          <button onClick={onClose} className="rounded-full border border-foreground/15 px-3 py-1 text-xs hover:bg-foreground hover:text-background" aria-label="Close">Close</button>
        </div>
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Business</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Business name *</Label><Input value={cName} onChange={(e) => setCName(e.target.value)} className="mt-1 h-11 rounded-xl" /></div>
            <div><Label>Website</Label><Input value={cWebsite} onChange={(e) => setCWebsite(e.target.value)} className="mt-1 h-11 rounded-xl" /></div>
            <div><Label>Business email</Label><Input value={cEmail} onChange={(e) => setCEmail(e.target.value)} inputMode="email" className="mt-1 h-11 rounded-xl" /></div>
            <div><Label>Business phone</Label><Input value={cPhone} onChange={(e) => setCPhone(e.target.value)} inputMode="tel" className="mt-1 h-11 rounded-xl" /></div>
            <div><Label>Industry</Label><Input value={cIndustry} onChange={(e) => setCIndustry(e.target.value)} className="mt-1 h-11 rounded-xl" /></div>
            <div>
              <Label>Company size</Label>
              <select value={cSize} onChange={(e) => setCSize(e.target.value)} className={sel}>
                {(["1–10", "11–50", "50–200", "200+"] as const).map((x) => <option key={x} value={x}>{x} staff</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><Label>Location</Label><Input value={cLocation} onChange={(e) => setCLocation(e.target.value)} className="mt-1 h-11 rounded-xl" /></div>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={cPrior} onChange={(e) => setCPrior(e.target.checked)} /> Prior contact</label>
            <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={cClient} onChange={(e) => setCClient(e.target.checked)} /> Already a client</label>
          </div>
          {(cPrior || cClient) && <div className="mt-2"><Label>Prior outcome / history</Label><Input value={cOutcome} onChange={(e) => setCOutcome(e.target.value)} placeholder="Discovery call held Sep 2025 — paused, no budget" className="mt-1 h-11 rounded-xl" /></div>}
        </div>
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Pipeline</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Status</Label>
              <select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)} className={sel}>
                {LEAD_STATUSES.map((st) => <option key={st} value={st}>{LEAD_STATUS_LABEL[st]}</option>)}
              </select>
            </div>
            <div>
              <Label>Urgency</Label>
              <select value={urgency} onChange={(e) => setUrgency(e.target.value as Lead["urgency"])} className={sel}>
                {(["low", "medium", "high"] as const).map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            {canAssign && (
              <>
                <div>
                  <Label>Owner</Label>
                  <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={sel}>
                    {s.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Squad</Label>
                  <select value={squadId} onChange={(e) => setSquadId(e.target.value)} className={sel}>
                    {s.squads.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
                  </select>
                </div>
              </>
            )}
            <div><Label>Potential value (KES)</Label><Input value={lValue} onChange={(e) => setLValue(e.target.value)} inputMode="numeric" className="mt-1 h-11 rounded-xl" /></div>
            <div><Label>Decision-maker</Label><Input value={dmName} onChange={(e) => setDmName(e.target.value)} className="mt-1 h-11 rounded-xl" /></div>
            <div className="sm:col-span-2"><Label>Source</Label><Input value={source} onChange={(e) => setSource(e.target.value)} className="mt-1 h-11 rounded-xl" /></div>
            <div className="sm:col-span-2"><Label>Observed problem</Label><Textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={2} className="mt-1 rounded-xl" /></div>
            <div className="sm:col-span-2"><Label>Evidence</Label><Textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={2} className="mt-1 rounded-xl" /></div>
            <div><Label>Next action</Label><Input value={nextAction} onChange={(e) => setNextAction(e.target.value)} className="mt-1 h-11 rounded-xl" /></div>
            <div><Label>Next due</Label><Input type="datetime-local" value={nextDue} onChange={(e) => setNextDue(e.target.value)} className="mt-1 h-11 rounded-xl" /></div>
            <div className="sm:col-span-2"><Label>Rejected / lost reason</Label><Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Empty unless rejected or lost" className="mt-1 h-11 rounded-xl" /></div>
          </div>
        </div>
        <Button className="w-full rounded-full btn-brand" disabled={busy || !cName.trim()} onClick={save}>
          {busy ? "Saving…" : "Save all changes"}
        </Button>
      </div>
    </div>
  );
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
