"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  const s = useCrm();
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [showNew, setShowNew] = useState(params.get("new") === "1");

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
            <DialogTrigger asChild><Button className="rounded-full bg-foreground text-background">+ Register lead · 60s</Button></DialogTrigger>
            <DialogContent className="max-w-lg rounded-2xl"><DialogHeader><DialogTitle className="font-display text-2xl">Register a lead</DialogTitle></DialogHeader><NewLeadForm onDone={() => setShowNew(false)} /></DialogContent>
          </Dialog>
        }
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search business, industry, source, next action…" className="h-11 rounded-full lg:max-w-md" />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-4 py-2 text-[13px] font-medium transition-colors ${filter === f ? "border-foreground bg-foreground text-background" : "border-foreground/15 hover:bg-foreground/5"}`}>
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
                  <div className="flex items-center gap-4 lg:text-right">
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

function NewLeadForm({ onDone }: { onDone: () => void }) {
  const s = useCrm();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [contact, setContact] = useState("");
  const [industry, setIndustry] = useState("Distribution");
  const [problem, setProblem] = useState("");
  const [source, setSource] = useState("Field visit");
  const [value, setValue] = useState("1000000");

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
    s.mutate((st) => {
      let companies = st.companies;
      if (!prior) {
        companies = [...companies, { id: companyId, name: name.trim(), website: website.trim() || undefined, industry, priorContact: false }];
      }
      const lead = {
        id: uid("ld"), companyId, ownerId: st.currentUserId,
        squadId: st.members.find((m) => m.id === st.currentUserId)?.squadId ?? st.squads[0]?.id ?? "sq-mamba",
        status: (asDraft ? "draft" : "new") as LeadStatus,
        source, observedProblem: problem, valuePotential: Number(value) || 0,
        urgency: "medium" as const, decisionMakerName: contact || undefined,
        evidence: source, lastActivityAt: new Date().toISOString(),
        nextAction: "Review + first outreach", nextDueAt: new Date(Date.now() + 2 * 86400000).toISOString(),
        createdAt: new Date().toISOString(),
      };
      return {
        ...st, companies,
        leads: [...st.leads, lead],
        activities: [...st.activities, { id: uid("a"), leadId: lead.id, companyId, actorId: st.currentUserId, kind: "system" as const, summary: asDraft ? "Draft lead saved" : "Lead submitted — queued for duplicate + ownership check", createdAt: new Date().toISOString() }],
        tasks: [...st.tasks, { id: uid("t"), leadId: lead.id, companyId, ownerId: st.currentUserId, title: `First outreach — ${name.trim()}`, dueAt: new Date(Date.now() + 2 * 86400000).toISOString(), status: "open" as const, createdAt: new Date().toISOString() }],
        audit: audit(st, st.currentUserId, "Lead registered", "lead", lead.id, `${name.trim()} · ${source}`),
      };
    });
    onDone();
  };

  return (
    <div className="space-y-3">
      <p className="font-mono text-xs text-muted-foreground">60-SECOND RULE · business name, identifier, contact, industry, problem, source.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Business name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ABC Distributors Ltd" className="h-11 rounded-xl" /></div>
        <div><Label>Website / identifier</Label><Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="company.co.ke" className="h-11 rounded-xl" /></div>
        <div><Label>Contact (if known)</Label><Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="George — Operations" className="h-11 rounded-xl" /></div>
        <div><Label>Industry</Label><Input value={industry} onChange={(e) => setIndustry(e.target.value)} className="h-11 rounded-xl" /></div>
      </div>
      <div><Label>Observed problem</Label><Input value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="Manual stock sheets; no online ordering" className="h-11 rounded-xl" /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Source / evidence</Label><Input value={source} onChange={(e) => setSource(e.target.value)} className="h-11 rounded-xl" /></div>
        <div><Label>Potential value (KES)</Label><Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="numeric" className="h-11 rounded-xl" /></div>
      </div>
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
        <Button className="flex-1 rounded-full bg-foreground text-background" onClick={() => submit(false)}>Submit lead</Button>
      </div>
    </div>
  );
}
