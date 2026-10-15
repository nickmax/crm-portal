"use client";
import { useState } from "react";
import { useCrm, uid, fmtKES, audit } from "@/lib/crm/store";
import { companyName, memberName } from "@/lib/crm/insights";
import { requiresOwnerApproval } from "@/lib/crm/permissions";
import { PageHead } from "@/components/crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function DealsPage() {
  const s = useCrm();
  const isBdpView = s.currentUser.role === "bdp";
  const deals = isBdpView
    ? s.deals.filter((d) => { const o = s.opportunities.find((x) => x.id === d.opportunityId); return o?.bdpId === s.currentUserId; })
    : s.deals;
  const commissions = isBdpView ? s.commissions.filter((c) => c.bdpId === s.currentUserId) : s.commissions;
  const [payAmount, setPayAmount] = useState("");
  const [payFor, setPayFor] = useState<string | null>(null);

  const recordPayment = (dealId: string) => {
    const amt = Number(payAmount);
    if (!amt) return;
    s.mutate((st) => {
      const deal = st.deals.find((d) => d.id === dealId);
      if (!deal) return st;
      const opp = st.opportunities.find((o) => o.id === deal.opportunityId);
      const bdp = opp ? st.members.find((m) => m.id === opp.bdpId) : undefined;
      const rate = bdp?.commissionRate ?? 0.1;
      const earned = Math.round(amt * rate);
      const commId = uid("cm");
      return {
        ...st,
        payments: [...st.payments, { id: uid("pay"), dealId, amount: amt, receivedAt: new Date().toISOString(), method: "Bank transfer", verified: true }],
        deals: st.deals.map((d) => d.id === dealId ? { ...d, collected: d.collected + amt, milestones: d.milestones.map((m, i) => i === d.milestones.findIndex((x) => !x.collected) ? { ...m, collected: true } : m) } : d),
        commissions: [...st.commissions, { id: commId, dealId, bdpId: opp?.bdpId ?? "", rate, eligibleRevenue: amt, earned, status: "pending" as const, history: [{ at: new Date().toISOString(), by: "system", action: `Calculated on verified payment ${fmtKES(amt)} @ ${rate * 100}%` }] }],
        notifications: [...st.notifications, { id: uid("n"), userId: "u-owner", title: "Commission pending approval", body: `${bdp?.name} · ${fmtKES(earned)}`, createdAt: new Date().toISOString(), read: false, link: "/deals" }],
        audit: audit(st, st.currentUserId, "Payment recorded", "payment", dealId, `${fmtKES(amt)} → commission ${fmtKES(earned)} pending`),
      };
    });
    setPayFor(null); setPayAmount("");
  };

  const approve = (id: string) => {
    if (requiresOwnerApproval(s.currentUser.role, "commission.pay") && s.currentUser.role !== "owner") {
      alert("Only the owner can approve commissions. Your request has been logged for approval.");
    }
    s.mutate((st) => ({
      ...st,
      commissions: st.commissions.map((c) => c.id === id ? { ...c, status: s.currentUser.role === "owner" ? "approved" as const : c.status, history: [...c.history, { at: new Date().toISOString(), by: st.currentUserId, action: s.currentUser.role === "owner" ? "Approved" : "Approval requested" }] } : c),
      audit: audit(st, st.currentUserId, "Commission approval", "commission", id, s.currentUser.role),
    }));
  };

  const pay = (id: string) => {
    if (s.currentUser.role !== "owner") { alert("Only the owner can mark commissions paid. This is a financial control."); return; }
    s.mutate((st) => ({
      ...st,
      commissions: st.commissions.map((c) => c.id === id ? { ...c, status: "paid" as const, paidAt: new Date().toISOString(), history: [...c.history, { at: new Date().toISOString(), by: st.currentUserId, action: "Paid" }] } : c),
      audit: audit(st, st.currentUserId, "Commission paid", "commission", id, "payout recorded"),
    }));
  };

  const wonTotal = deals.filter((d) => d.outcome === "won").reduce((a, d) => a + d.contractValue, 0);
  const collected = deals.reduce((a, d) => a + d.collected, 0);

  return (
    <div>
      <PageHead eyebrow={isBdpView ? "My earnings" : "Deals & commissions"} title={isBdpView ? "My earnings" : "Deals & commissions"} sub={isBdpView ? "Your statements: eligible revenue, earned, pending approval, paid." : "Signed value vs cash collected. Admins cannot alter paid commissions — owner approval + audit trail required."} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border p-4"><p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Signed (won)</p><p className="font-display text-3xl">{fmtKES(wonTotal)}</p></div>
        <div className="rounded-xl border p-4"><p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Collected cash</p><p className="font-display text-3xl">{fmtKES(collected)}</p></div>
        <div className="rounded-xl border p-4"><p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Commissions earned</p><p className="font-display text-3xl">{fmtKES(commissions.reduce((a, c) => a + c.earned, 0))}</p></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-xl">
          <CardHeader><CardTitle className="font-display text-2xl">Deals</CardTitle></CardHeader>
          <CardContent className="space-y-2 px-6 pb-6">
            {deals.map((d) => (
              <div key={d.id} className="rounded-xl border border-foreground/10 p-4 text-sm">
                <div className="flex items-center justify-between"><p className="font-medium">{companyName(s, d.companyId)}</p><Badge className={`rounded-full border-0 ${d.outcome === "won" ? "bg-green-700 text-white" : "bg-red-600/15 text-red-800"}`}>{d.outcome}</Badge></div>
                <p className="mt-1 text-muted-foreground">Contract {fmtKES(d.contractValue)} · Collected {fmtKES(d.collected)} {d.lossReason && `· Lost: ${d.lossReason}`}</p>
                {d.milestones.length > 0 && <p className="mt-1 break-words font-mono text-xs text-muted-foreground">{d.milestones.map((m) => `${m.label} ${fmtKES(m.amount)}${m.collected ? " ✓" : ""}`).join(" · ")}</p>}
                {d.outcome === "won" && s.currentUser.role !== "bdp" && (
                  payFor === d.id ? (
                    <div className="mt-2 flex gap-2"><Input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} inputMode="numeric" placeholder="Amount received" className="h-9 rounded-xl" /><Button size="sm" className="rounded-full btn-brand" onClick={() => recordPayment(d.id)}>Save</Button><Button size="sm" variant="outline" className="rounded-full" onClick={() => setPayFor(null)}>×</Button></div>
                  ) : <Button size="sm" variant="outline" className="mt-2 rounded-full" onClick={() => setPayFor(d.id)}>Record client payment</Button>
                )}
              </div>
            ))}
            {deals.length === 0 && <p className="text-sm text-muted-foreground">No deals yet — close one from the pipeline.</p>}
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardHeader><CardTitle className="font-display text-2xl">Commissions</CardTitle></CardHeader>
          <CardContent className="space-y-2 px-6 pb-6">
            {commissions.map((c) => (
              <div key={c.id} className="rounded-xl border border-foreground/10 p-4 text-sm">
                <div className="flex items-center justify-between"><p className="font-medium">{memberName(s, c.bdpId)} · {fmtKES(c.earned)}</p><Badge className={`rounded-full border-0 ${c.status === "paid" ? "bg-green-700 text-white" : c.status === "approved" ? "bg-foreground text-background" : "bg-foreground/10"}`}>{c.status}</Badge></div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">Eligible {fmtKES(c.eligibleRevenue)} @ {c.rate * 100}% · {c.history.map((h) => h.action).join(" → ")}</p>
                {s.currentUser.role !== "bdp" && c.status === "pending" && <Button size="sm" className="mt-2 rounded-full btn-brand" onClick={() => approve(c.id)}>Approve (owner)</Button>}
                {s.currentUser.role === "owner" && c.status === "approved" && <Button size="sm" variant="outline" className="ml-2 mt-2 rounded-full" onClick={() => pay(c.id)}>Mark paid</Button>}
              </div>
            ))}
            {commissions.length === 0 && <p className="text-sm text-muted-foreground">No commissions yet. They calculate automatically on verified payments.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
