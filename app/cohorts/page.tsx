"use client";
import { useCrm, fmtKES } from "@/lib/crm/store";
import { scorecard } from "@/lib/crm/insights";
import { PageHead } from "@/components/crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function CohortsPage() {
  const s = useCrm();
  const rows = scorecard(s);
  return (
    <div>
      <PageHead eyebrow="Cohorts & squads" title="Cohorts & squads" sub="Membership, captains, industries, activity, performance and inactive members. Compare squads, see individual contributions." />
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
