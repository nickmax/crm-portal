"use client";
import { useEffect, useState } from "react";
import { useCrm, fmtKES } from "@/lib/crm/store";
import { scorecard } from "@/lib/crm/insights";
import { PageHead } from "@/components/crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gate } from "@/components/crm/gate";
import { createClient } from "@/lib/supabase/client";

export default function CohortsPage() {
  return (
    <Gate roles={["owner", "admin", "captain"]}>
      <CohortsInner />
    </Gate>
  );
}

function CohortsInner() {
  const s = useCrm();
  const rows = scorecard(s);
  return (
    <div>
      <PageHead eyebrow="Cohorts & squads" title="Cohorts & squads" sub="Membership, captains, industries, activity, performance and inactive members. Compare squads, see individual contributions." />
      {(s.currentUser.role === "owner" || s.currentUser.role === "admin") && <ManageStructure />}
      {s.cohorts.map((c) => (
        <div key={c.id} className="mb-6">
          <h2 className="font-display text-2xl">{c.name}</h2>
          <p className="text-sm text-muted-foreground">{c.description} · Started {c.startDate}</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {s.squads.filter((q) => q.cohortId === c.id).map((q) => {
              const members = s.members.filter((m) => m.squadId === q.id);
              const qLeads = s.leads.filter((l) => l.squadId === q.id);
              const cap = s.members.find((m) => m.id === q.captainId);
              const t = s.campaigns[0]?.targets.find((x) => x.squadId === q.id);
              return (
                <Card key={q.id} className="rounded-xl">
                  <CardHeader><CardTitle className="font-display text-xl">{q.name}</CardTitle>
                    <p className="text-[13px] text-muted-foreground">Captain {cap?.name} · {q.industry} · Target {q.target} leads</p></CardHeader>
                  <CardContent className="space-y-2 px-6 pb-6 text-sm">
                    <p className="font-mono text-xs text-muted-foreground">{qLeads.length} / {t?.leads ?? q.target} leads · {fmtKES(s.opportunities.filter((o) => qLeads.some((l) => l.id === o.leadId)).reduce((a, o) => a + o.value, 0))} pipeline</p>
                    {members.map((m) => {
                      const r = rows.find((x) => x.memberId === m.id);
                      return (
                        <div key={m.id} className="flex items-center justify-between rounded-xl border border-foreground/10 px-3 py-2">
                          <span>{m.name} <span className="font-mono text-[11px] text-muted-foreground">· {r?.qualified ?? 0} qual · {r?.meetings ?? 0} mtgs · {r?.followupRate ?? 100}%</span></span>
                          {m.status !== "active" && <Badge className="rounded-full border-0 bg-red-600/15 text-red-800">{m.status}</Badge>}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

interface CohortRow { id: number; name: string }
interface SquadRow { id: number; name: string; cohort_id: number | null; captain_id: string | null; industry: string | null; target: number }
interface ProfRow { id: string; email: string | null; display_name: string | null; crm_role: string | null; squad_id: number | null }

function ManageStructure() {
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [squads, setSquads] = useState<SquadRow[]>([]);
  const [people, setPeople] = useState<ProfRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cName, setCName] = useState("");
  const [qName, setQName] = useState("");
  const [qCohort, setQCohohort] = useState("");
  const [qIndustry, setQIndustry] = useState("");

  const load = async () => {
    const sb = createClient();
    const [c, q, p] = await Promise.all([
      sb.from("cohorts").select("id,name").order("id"),
      sb.from("squads").select("id,name,cohort_id,captain_id,industry,target").order("id"),
      sb.from("profiles").select("id,email,display_name,crm_role,squad_id").order("display_name").limit(200),
    ]);
    if (c.data) setCohorts(c.data as CohortRow[]);
    if (q.data) setSquads(q.data as SquadRow[]);
    if (p.data) setPeople(p.data as ProfRow[]);
  };
  useEffect(() => { load(); }, []);

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/team/structure", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json();
      setMsg(r.ok ? "Saved." : `Failed — ${j.error}`);
      if (r.ok) { setCName(""); setQName(""); setQIndustry(""); await load(); }
    } catch { setMsg("Network error."); }
    setBusy(false);
  };

  return (
    <Card className="mb-6 rounded-xl border-foreground/20">
      <CardHeader><CardTitle className="font-display text-2xl">Set up the structure</CardTitle></CardHeader>
      <CardContent className="space-y-4 px-6 pb-6">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-foreground/10 p-4">
            <p className="text-sm font-medium">New cohort</p>
            <div className="mt-2 flex gap-2">
              <Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Cohort 8 — Q2 2026" className="h-10 rounded-xl" />
              <Button className="rounded-full btn-brand" disabled={busy || !cName.trim()} onClick={() => post({ op: "cohort", name: cName })}>Add</Button>
            </div>
          </div>
          <div className="rounded-xl border border-foreground/10 p-4">
            <p className="text-sm font-medium">New squad</p>
            <div className="mt-2 grid gap-2">
              <Input value={qName} onChange={(e) => setQName(e.target.value)} placeholder="Squad name" className="h-10 rounded-xl" />
              <div className="flex gap-2">
                <select value={qCohort} onChange={(e) => setQCohohort(e.target.value)} className="h-10 flex-1 rounded-xl border border-foreground/15 bg-card px-2 text-sm">
                  <option value="">No cohort</option>
                  {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Input value={qIndustry} onChange={(e) => setQIndustry(e.target.value)} placeholder="Industry" className="h-10 flex-1 rounded-xl" />
                <Button className="rounded-full btn-brand" disabled={busy || !qName.trim()} onClick={() => post({ op: "squad", name: qName, cohortId: qCohort ? Number(qCohort) : null, industry: qIndustry })}>Add</Button>
              </div>
            </div>
          </div>
        </div>
        {msg && <p className="rounded-xl bg-foreground/5 px-4 py-2.5 text-[13px]">{msg}</p>}
        <div className="space-y-2">
          {squads.map((q) => (
            <div key={q.id} className="grid items-center gap-2 rounded-xl border border-foreground/10 px-4 py-3 text-sm md:grid-cols-[1fr_1fr_1fr]">
              <p className="font-medium">{q.name} <span className="font-mono text-[11px] text-muted-foreground">· {q.industry ?? "—"} · {people.filter((p) => p.squad_id === q.id).length} members</span></p>
              <label className="flex items-center gap-2 text-[13px] text-muted-foreground">Captain
                <select value={q.captain_id ?? ""} onChange={(e) => post({ op: "captain", squadId: q.id, profileId: e.target.value || null })} className="h-9 min-w-0 flex-1 rounded-xl border border-foreground/15 bg-card px-2 text-sm text-foreground">
                  <option value="">— none —</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.display_name ?? p.email} ({p.crm_role})</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-[13px] text-muted-foreground">Move member
                <select defaultValue="" onChange={(e) => { if (e.target.value) post({ op: "assign", profileId: e.target.value, squadId: q.id }); e.target.value = ""; }} className="h-9 min-w-0 flex-1 rounded-xl border border-foreground/15 bg-card px-2 text-sm text-foreground">
                  <option value="">Pick someone…</option>
                  {people.filter((p) => p.squad_id !== q.id).map((p) => <option key={p.id} value={p.id}>{p.display_name ?? p.email} ({p.crm_role})</option>)}
                </select>
              </label>
            </div>
          ))}
          {squads.length === 0 && <p className="text-sm text-muted-foreground">No squads yet — create the first one above.</p>}
        </div>
        {people.filter((p) => p.squad_id == null).length > 0 && (
          <p className="font-mono text-xs text-muted-foreground">Unassigned: {people.filter((p) => p.squad_id == null).map((p) => p.display_name ?? p.email).join(", ")}</p>
        )}
      </CardContent>
    </Card>
  );
}
