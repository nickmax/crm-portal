"use client";

import Link from "next/link";
import { useState } from "react";
import { useCrm, uid, fmtKES, audit } from "@/lib/crm/store";
import { companyName } from "@/lib/crm/insights";
import { PageHead, StageBadge } from "@/components/crm/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OPP_STAGES, type OppStage } from "@/lib/crm/types";

export default function PipelinePage() {
  const s = useCrm();
  const [lossFor, setLossFor] = useState<string | null>(null);
  const [lossReason, setLossReason] = useState("");
  const [winFor, setWinFor] = useState<string | null>(null);
  const [contractValue, setContractValue] = useState("");

  const open = s.opportunities.filter((o) => !["won", "lost"].includes(o.stage));

  const move = (id: string, stage: OppStage) => {
    s.mutate((st) => ({
      ...st,
      opportunities: st.opportunities.map((o) => o.id === id ? { ...o, stage, updatedAt: new Date().toISOString(), stalledSince: undefined } : o),
      leads: st.leads.map((l) => {
        const o = st.opportunities.find((x) => x.id === id);
        return o && l.id === o.leadId ? { ...l, status: stage as unknown as typeof l.status, lastActivityAt: new Date().toISOString() } : l;
      }),
      meetings: stage === "meeting_booked" ? st.meetings : st.meetings,
      audit: audit(st, st.currentUserId, "Opportunity moved", "opportunity", id, `→ ${stage}`),
    }));
  };

  const closeLost = (id: string) => {
    if (!lossReason.trim()) return;
    s.mutate((st) => ({
      ...st,
      opportunities: st.opportunities.map((o) => o.id === id ? { ...o, stage: "lost" as OppStage, updatedAt: new Date().toISOString() } : o),
      deals: [...st.deals, { id: uid("dl"), opportunityId: id, companyId: st.opportunities.find((o) => o.id === id)?.companyId ?? "", contractValue: 0, signedAt: new Date().toISOString(), milestones: [], collected: 0, handover: [], outcome: "lost" as const, lossReason }],
      audit: audit(st, st.currentUserId, "Opportunity lost", "opportunity", id, lossReason),
    }));
    setLossFor(null); setLossReason("");
  };

  const closeWon = (id: string) => {
    const val = Number(contractValue) || 0;
    if (!val) return;
    s.mutate((st) => {
      const opp = st.opportunities.find((o) => o.id === id);
      if (!opp) return st;
      const dealId = uid("dl");
      const bdp = st.members.find((m) => m.id === opp.bdpId);
      const rate = bdp?.commissionRate ?? 0.1;
      return {
        ...st,
        opportunities: st.opportunities.map((o) => o.id === id ? { ...o, stage: "won" as OppStage, value: val, updatedAt: new Date().toISOString() } : o),
        leads: st.leads.map((l) => l.id === opp.leadId ? { ...l, status: "won" as const, lastActivityAt: new Date().toISOString() } : l),
        deals: [...st.deals, { id: dealId, opportunityId: id, companyId: opp.companyId, contractValue: val, signedAt: new Date().toISOString(), milestones: [{ label: "Deposit 40%", amount: Math.round(val * 0.4), due: new Date().toISOString().slice(0, 10), collected: false }, { label: "Balance", amount: Math.round(val * 0.6), due: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), collected: false }], collected: 0, handover: ["Kickoff scheduled", "Scope doc signed", "Delivery owner assigned", "Commission eligibility confirmed"], outcome: "won" as const }],
        notifications: [...st.notifications, { id: uid("n"), userId: "u-owner", title: "Deal won — handover created", body: `${companyName(st, opp.companyId)} · ${fmtKES(val)}`, createdAt: new Date().toISOString(), read: false, link: "/deals" }],
        audit: audit(st, st.currentUserId, "Deal won", "deal", dealId, `${fmtKES(val)}`),
      };
    });
    setWinFor(null); setContractValue("");
  };

  return (
    <div>
      <PageHead eyebrow="Opportunities pipeline" title="Pipeline" sub="Qualified → discovery → meetings → proposal → negotiation → won / lost. You can see where each deal is stuck and who must act next." />
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
        {OPP_STAGES.filter((x) => x !== "lost").map((stage) => {
          const cards = s.opportunities.filter((o) => o.stage === stage);
          const total = cards.reduce((a, o) => a + o.value, 0);
          return (
            <div key={stage} className="rounded-2xl border border-foreground/10 bg-card p-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <StageBadge stage={stage} />
                <span className="font-mono text-[11px] text-muted-foreground">{cards.length} · {fmtKES(total)}</span>
              </div>
              <div className="space-y-2">
                {cards.map((o) => (
                  <Card key={o.id} className="rounded-xl py-0">
                    <CardContent className="px-4 py-3">
                      <Link href={`/leads/${o.leadId}`} className="font-medium hover:underline">{companyName(s, o.companyId)}</Link>
                      <p className="font-display text-xl">{fmtKES(o.value)}</p>
                      <p className="text-xs text-muted-foreground">Close {new Date(o.expectedClose).toLocaleDateString()} · {o.decisionMaker}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {OPP_STAGES.filter((x) => x !== stage && x !== "lost" && x !== "won").slice(0, 3).map((nx) => (
                          <button key={nx} onClick={() => move(o.id, nx)} className="inline-flex min-h-[40px] items-center rounded-full border border-foreground/15 px-3 py-1.5 text-[11px] hover:bg-foreground hover:text-background">→ {nx.replace(/_/g, " ")}</button>
                        ))}
                      </div>
                      <div className="mt-2 flex gap-1.5">
                        <button onClick={() => { setWinFor(o.id); setContractValue(String(o.value)); }} className="flex-1 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-medium text-background">Win</button>
                        <button onClick={() => setLossFor(o.id)} className="flex-1 rounded-full border px-3 py-1.5 text-[11px]">Lose</button>
                      </div>
                      {lossFor === o.id && (
                        <div className="mt-2 rounded-xl bg-foreground/5 p-2.5">
                          <Label className="text-xs">Loss reason (required)</Label>
                          <Input value={lossReason} onChange={(e) => setLossReason(e.target.value)} placeholder="Price, timing, competitor…" className="mt-1 h-9 rounded-xl" />
                          <div className="mt-1.5 flex gap-1.5"><Button size="sm" variant="outline" className="rounded-full" onClick={() => setLossFor(null)}>Cancel</Button><Button size="sm" className="rounded-full bg-foreground text-background" onClick={() => closeLost(o.id)}>Save loss</Button></div>
                        </div>
                      )}
                      {winFor === o.id && (
                        <div className="mt-2 rounded-xl bg-foreground/5 p-2.5">
                          <Label className="text-xs">Signed contract value (KES)</Label>
                          <Input value={contractValue} onChange={(e) => setContractValue(e.target.value)} inputMode="numeric" className="mt-1 h-9 rounded-xl" />
                          <div className="mt-1.5 flex gap-1.5"><Button size="sm" variant="outline" className="rounded-full" onClick={() => setWinFor(null)}>Cancel</Button><Button size="sm" className="rounded-full bg-foreground text-background" onClick={() => closeWon(o.id)}>Record win</Button></div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {cards.length === 0 && <p className="px-2 py-4 text-center font-mono text-xs text-muted-foreground">— empty —</p>}
              </div>
            </div>
          );
        })}
      </div>
      {s.opportunities.some((o) => o.stage === "lost") && (
        <p className="mt-4 font-mono text-xs text-muted-foreground">{s.opportunities.filter((o) => o.stage === "lost").length} lost — reasons recorded in Deals &amp; reports.</p>
      )}
    </div>
  );
}
