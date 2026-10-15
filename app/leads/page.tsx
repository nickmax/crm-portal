"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCrm, uid, fmtKES, audit, findDuplicates, isOverdue } from "@/lib/crm/store";
import { visibleLeads } from "@/lib/crm/permissions";
import { PageHead, LeadBadge, Empty } from "@/components/crm/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { LeadStatus } from "@/lib/crm/types";
import { createClient } from "@/lib/supabase/client";
import { searchBusinesses, type BusinessHit } from "@/lib/crm/sb";

const FILTERS = ["All", "My Leads", "My Squad", "Overdue", "Uncontacted", "Qualified", "Recently Updated"] as const;

export default function LeadsPage() {
  return (
    <Suspense fallback={<p className="py-10 font-mono text-sm text-muted-foreground">Loading leads…</p>}>
      <LeadsInner />
    </Suspense>
  );
}

function LeadsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const s = useCrm();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [showNew, setShowNew] = useState(params.get("new") === "1");

  const closeNew = () => {
    setShowNew(false);
    router.replace("/leads"); // drop ?new=1 so a remount never reopens the form
  };

  const rows = useMemo(() => {
    let list = visibleLeads(s.leads, s.currentUser);
    if (filter === "My Leads") list = list.filter((l) => l.ownerId === s.currentUserId);
    if (filter === "My Squad" && s.currentUser.squadId) list = list.filter((l) => l.squadId === s.currentUser.squadId);
    if (filter === "Overdue") list = list.filter((l) => isOverdue(l.nextDueAt) && !["won", "lost", "rejected", "duplicate"].includes(l.status));
    if (filter === "Uncontacted") list = list.filter((l) => ["new", "under_review", "accepted"].includes(l.status));
    if (filter === "Qualified") list = list.filter((l) => ["qualified", "meeting_booked", "meeting_held", "proposal", "negotiation", "won"].includes(l.status));
    if (filter === "Recently Updated") list = [...list].sort((a, b) => +new Date(b.lastActivityAt) - +new Date(a.lastActivityAt)).slice(0, 20);
    if (q) {
      const needle = q.toLowerCase();
      list = list.filter((l) => {
        const c = s.companies.find((x) => x.id === l.companyId);
        return c?.name.toLowerCase().includes(needle) || c?.industry.toLowerCase().includes(needle) || l.source.toLowerCase().includes(needle) || l.nextAction.toLowerCase().includes(needle);
      });
    }
    return [...list].sort((a, b) => +new Date(a.nextDueAt) - +new Date(b.nextDueAt));
  }, [s.leads, s.companies, s.currentUser, s.currentUserId, filter, q]);

  return (
    <div>
      <PageHead
        eyebrow="Leads · every business, one record"
        title="Leads"
        sub="Searchable across owner, squad, industry, status, source, last contact, next action and value. Duplicates are flagged before outreach."
        action={
          <Dialog open={showNew} onOpenChange={setShowNew}>
            <DialogTrigger asChild><Button className="rounded-full btn-brand">+ Register lead · 60s</Button></DialogTrigger>
            <DialogContent className="max-w-2xl rounded-2xl"><DialogHeader><DialogTitle className="font-display text-2xl">Register a lead</DialogTitle></DialogHeader><NewLeadForm onDone={() => setShowNew(false)} /></DialogContent>
          </Dialog>
        }
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search business, industry, source, next action…" className="h-11 rounded-full lg:max-w-md" />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`inline-flex min-h-[44px] items-center rounded-full border px-4 py-2 text-[13px] font-medium transition-colors ${filter === f ? "pill-brand" : "border-foreground/15 hover:bg-foreground/5"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 && <Empty title="No leads match" body="Adjust filters or register the first lead for this view." />}
      <div className="grid gap-3">
        {rows.map((l) => {
          const c = s.companies.find((x) => x.id === l.companyId);
          const owner = s.members.find((m) => m.id === l.ownerId);
          const overdue = isOverdue(l.nextDueAt) && !["won", "lost", "rejected", "duplicate"].includes(l.status);
          return (
            <Link key={l.id} href={`/leads/${l.id}`}>
              <Card className="rounded-xl py-0 transition-transform hover:-translate-y-0.5">
                <CardContent className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{c?.name}</p>
                      <LeadBadge status={l.status} />
                      {overdue && <Badge className="rounded-full border-0 bg-red-600/15 text-red-800">Overdue</Badge>}
                      {c?.priorContact && <Badge variant="outline" className="rounded-full">Prior contact</Badge>}
                    </div>
                    <p className="mt-1 truncate text-[13px] text-muted-foreground">{c?.industry} · {owner?.name} · Last: {new Date(l.lastActivityAt).toLocaleDateString()} · Next: {l.nextAction}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 lg:text-right">
                    <div><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Potential</p><p className="font-display text-xl">{fmtKES(l.valuePotential)}</p></div>
                    <div><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Due</p><p className={`text-sm font-medium ${overdue ? "text-red-700" : ""}`}>{new Date(l.nextDueAt).toLocaleDateString()}</p></div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

const INDUSTRIES = ["Distribution", "Hospitality", "F&B", "Manufacturing", "Travel", "Logistics", "Education", "Wholesale", "Retail", "Services", "Other"] as const;
const SIZES = ["1–10", "11–50", "50–200", "200+"] as const;
const URGENCIES = ["low", "medium", "high"] as const;

function NewLeadForm({ onDone }: { onDone: () => void }) {
  const s = useCrm();
  const canAssign = ["owner", "admin", "captain"].includes(s.currentUser.role);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [industry, setIndustry] = useState<string>("Distribution");
  const [size, setSize] = useState<string>("11–50");
  const [problem, setProblem] = useState("");
  const [source, setSource] = useState("Field visit");
  const [value, setValue] = useState("1000000");
  const [urgency, setUrgency] = useState<string>("medium");
  // Decision-maker / first contact — saved as a real Contact row.
  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactDM, setContactDM] = useState(true);
  const [ownerId, setOwnerId] = useState(s.currentUserId);
  const [squadId, setSquadId] = useState(s.currentUser.squadId ?? s.squads[0]?.id ?? "");
  const [nextAction, setNextAction] = useState("Review + first outreach");
  const [nextDue, setNextDue] = useState(() => {
    const d = new Date(Date.now() + 2 * 86400000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  const dupes = findDuplicates(s.companies, s.leads, { name, website });

  // Live check against the FULL discovery table in Supabase (29k+ businesses),
  // including prior contact / client history the local cache may not hold.
  const [hits, setHits] = useState<BusinessHit[]>([]);
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    if (!s.remote || name.trim().length < 2) { setHits([]); return; }
    setChecking(true);
    const t = setTimeout(async () => {
      try { setHits(await searchBusinesses(createClient(), name.trim())); }
      catch { /* stay local */ }
      setChecking(false);
    }, 400);
    return () => clearTimeout(t);
  }, [name, s.remote]);
  const prior = s.companies.find((c) =>
    (website && c.website?.toLowerCase() === website.toLowerCase()) ||
    c.name.toLowerCase() === name.toLowerCase()
  );

  const submit = (asDraft: boolean) => {
    if (!name.trim()) return;
    const companyId = prior?.id ?? uid("co");
    const dmName = contactName.trim() || undefined;
    s.mutate((st) => {
      let companies = st.companies;
      if (!prior) {
        companies = [...companies, {
          id: companyId, name: name.trim(), website: website.trim() || undefined,
          email: email.trim() || undefined, phone: phone.trim() || undefined,
          industry, size, location: location.trim() || undefined, priorContact: false,
        }];
      }
      const lead = {
        id: uid("ld"), companyId, ownerId,
        squadId: squadId || st.members.find((m) => m.id === ownerId)?.squadId || st.squads[0]?.id || "sq-mamba",
        status: (asDraft ? "draft" : "new") as LeadStatus,
        source, observedProblem: problem, valuePotential: Number(value) || 0,
        urgency: urgency as "low" | "medium" | "high", decisionMakerName: dmName,
        evidence: source, lastActivityAt: new Date().toISOString(),
        nextAction: nextAction.trim() || "Review + first outreach",
        nextDueAt: nextDue ? new Date(nextDue).toISOString() : new Date(Date.now() + 2 * 86400000).toISOString(),
        createdAt: new Date().toISOString(),
      };
      const now = new Date().toISOString();
      const contacts = (contactName.trim() && (contactEmail.trim() || contactPhone.trim()))
        ? [...st.contacts, {
            id: uid("ct"), companyId, name: contactName.trim(),
            role: contactRole.trim() || undefined,
            email: contactEmail.trim() || undefined, phone: contactPhone.trim() || undefined,
            decisionMaker: contactDM,
          }]
        : st.contacts;
      return {
        ...st, companies, contacts,
        leads: [...st.leads, lead],
        activities: [...st.activities, { id: uid("a"), leadId: lead.id, companyId, actorId: st.currentUserId, kind: "system" as const, summary: asDraft ? "Draft lead saved" : "Lead submitted — queued for duplicate + ownership check", createdAt: now }],
        tasks: [...st.tasks, { id: uid("t"), leadId: lead.id, companyId, ownerId, title: `${lead.nextAction} — ${name.trim()}`, dueAt: lead.nextDueAt, status: "open" as const, createdAt: now }],
        audit: audit(st, st.currentUserId, "Lead registered", "lead", lead.id, `${name.trim()} · ${source}`),
      };
    });
    onDone();
  };

  const sel = "mt-1 h-11 w-full rounded-xl border border-foreground/15 bg-card px-3 text-sm";

  return (
    <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
      <p className="font-mono text-xs text-muted-foreground">BUSINESS → CONTACT → DEAL BASICS. Everything stays editable later.</p>
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Business</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Business name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ABC Distributors Ltd" className="mt-1 h-11 rounded-xl" /></div>
          <div><Label>Website</Label><Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="company.co.ke" className="mt-1 h-11 rounded-xl" /></div>
          <div><Label>Business email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sales@company.co.ke" inputMode="email" className="mt-1 h-11 rounded-xl" /></div>
          <div><Label>Business phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2547…" inputMode="tel" className="mt-1 h-11 rounded-xl" /></div>
          <div>
            <Label>Industry</Label>
            <select value={industry} onChange={(e) => setIndustry(e.target.value)} className={sel}>
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <Label>Company size</Label>
            <select value={size} onChange={(e) => setSize(e.target.value)} className={sel}>
              {SIZES.map((i) => <option key={i} value={i}>{i} staff</option>)}
            </select>
          </div>
          <div className="sm:col-span-2"><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Nairobi, Industrial Area" className="mt-1 h-11 rounded-xl" /></div>
        </div>
      </div>
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">First contact <span className="normal-case">(saved to the phonebook)</span></p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Full name</Label><Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="George Mwangi" className="mt-1 h-11 rounded-xl" /></div>
          <div><Label>Role</Label><Input value={contactRole} onChange={(e) => setContactRole(e.target.value)} placeholder="Operations Director" className="mt-1 h-11 rounded-xl" /></div>
          <div><Label>Email</Label><Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="george@company.co.ke" inputMode="email" className="mt-1 h-11 rounded-xl" /></div>
          <div><Label>Phone / WhatsApp</Label><Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+2547…" inputMode="tel" className="mt-1 h-11 rounded-xl" /></div>
        </div>
        <label className="mt-2 flex cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={contactDM} onChange={(e) => setContactDM(e.target.checked)} />
          Decision-maker <span className="font-mono text-[11px] text-muted-foreground">(needs email or phone to save)</span>
        </label>
      </div>
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Deal basics</p>
        <div><Label>Observed problem</Label><Input value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="Manual stock sheets; no online ordering" className="mt-1 h-11 rounded-xl" /></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><Label>Source / evidence</Label><Input value={source} onChange={(e) => setSource(e.target.value)} className="mt-1 h-11 rounded-xl" /></div>
          <div><Label>Potential value (KES)</Label><Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="numeric" className="mt-1 h-11 rounded-xl" /></div>
          <div>
            <Label>Urgency</Label>
            <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className={sel}>
              {URGENCIES.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div><Label>First follow-up due</Label><Input type="datetime-local" value={nextDue} onChange={(e) => setNextDue(e.target.value)} className="mt-1 h-11 rounded-xl" /></div>
        </div>
        <div className="mt-3"><Label>First next action</Label><Input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Call George — intro + needs check" className="mt-1 h-11 rounded-xl" /></div>
      </div>
      {canAssign && (
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Ownership</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Owner</Label>
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={sel}>
                {s.members.filter((m) => ["bdp", "captain", "sales"].includes(m.role)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Squad</Label>
              <select value={squadId} onChange={(e) => setSquadId(e.target.value)} className={sel}>
                {s.squads.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
      {dupes.length > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-[13px]">
          <p className="font-medium text-red-800">Possible duplicate — review before outreach</p>
          {dupes.map((d) => <p key={d.company.id} className="text-red-700">{d.company.name} ({d.reason})</p>)}
        </div>
      )}
      {checking && <p className="font-mono text-xs text-muted-foreground">Checking 29k+ discovery records…</p>}
      {hits.length > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-[13px]">
          <p className="font-medium text-red-800">Found in discovery database — review before outreach</p>
          {hits.slice(0, 5).map((h) => (
            <p key={h.id} className="text-red-700">
              {h.name}{h.website ? ` · ${h.website}` : ""} — stage: {h.salesStage}, replies: {h.conversationStatus}{h.isClient ? " · ALREADY A CLIENT" : ""}
            </p>
          ))}
        </div>
      )}
      {prior?.priorOutcome && <div className="rounded-xl border p-3 text-[13px]">History: {prior.priorOutcome}</div>}
      {(prior?.isClient) && <div className="rounded-xl border p-3 text-[13px]">Already a client — route as expansion, not new outreach.</div>}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1 rounded-full" onClick={() => submit(true)}>Save draft</Button>
        <Button className="flex-1 rounded-full btn-brand" onClick={() => submit(false)}>Submit lead</Button>
      </div>
    </div>
  );
}
