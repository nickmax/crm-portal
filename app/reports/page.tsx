"use client";
import { useCrm, fmtKES } from "@/lib/crm/store";
import { computeExceptions, scorecard, companyName } from "@/lib/crm/insights";
import { PageHead } from "@/components/crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportsPage() {
  const s = useCrm();
  const exceptions = computeExceptions(s);
  const rows = scorecard(s);
  const newQ = s.leads.filter((l) => ["qualified", "meeting_booked", "meeting_held", "proposal", "negotiation", "won"].includes(l.status)).length;
  const conv = s.leads.length ? Math.round((newQ / s.leads.length) * 100) : 0;

  return (
    <div>
      <PageHead eyebrow="Reports · generated from activity, not assembled by hand" title="Reports" sub="Daily exceptions, weekly performance, monthly revenue and scorecards. Every number traces back to its records." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-xl"><CardHeader><CardTitle className="font-display text-2xl">Daily — exceptions</CardTitle></CardHeader>
          <CardContent className="space-y-2 px-6 pb-6 text-sm">{exceptions.slice(0, 6).map((e, i) => <p key={i} className="rounded-xl border border-foreground/10 px-3 py-2"><span className="font-medium">{e.title}</span><br /><span className="text-muted-foreground">{e.detail}</span></p>)}{exceptions.length === 0 && <p className="text-muted-foreground">All clear.</p>}</CardContent></Card>
        <Card className="rounded-xl"><CardHeader><CardTitle className="font-display text-2xl">Weekly — performance</CardTitle></CardHeader>
          <CardContent className="space-y-2 px-6 pb-6 text-sm">
            <p>New qualified opportunities: <b>{s.opportunities.length}</b></p>
            <p>Meetings held: <b>{s.meetings.filter((m) => m.outcome === "held").length}</b> · booked: <b>{s.meetings.filter((m) => m.outcome === "pending").length}</b></p>
            <p>Proposals issued: <b>{s.proposals.length}</b> · Deals won: <b>{s.deals.filter((d) => d.outcome === "won").length}</b></p>
            <p className="font-mono text-xs text-muted-foreground">Next week: clear overdue, hold {s.meetings.filter((m) => m.outcome === "pending").length} booked meetings, chase proposals.</p>
          </CardContent></Card>
        <Card className="rounded-xl"><CardHeader><CardTitle className="font-display text-2xl">Monthly — revenue</CardTitle></CardHeader>
          <CardContent className="space-y-2 px-6 pb-6 text-sm">
            <p>Revenue collected: <b>{fmtKES(s.deals.reduce((a, d) => a + d.collected, 0))}</b></p>
            <p>Conversion (lead → qualified): <b>{conv}%</b></p>
            <p>Commissions payable: <b>{fmtKES(s.commissions.filter((c) => c.status !== "paid").reduce((a, c) => a + c.earned, 0))}</b></p>
            <p>Pipeline forecast: <b>{fmtKES(s.opportunities.filter((o) => !["won", "lost"].includes(o.stage)).reduce((a, o) => a + o.value, 0))}</b></p>
          </CardContent></Card>
      </div>
      <Card className="mt-4 rounded-xl">
        <CardHeader><CardTitle className="font-display text-2xl">Balanced scorecard — quality over volume</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto px-6 pb-6">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead><tr className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground"><th className="py-2">BDP</th><th>Squad</th><th>Qualified</th><th>Conversations*</th><th>Meetings</th><th>Pipeline</th><th>Wins</th><th>Collected</th><th>Follow-up %</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.memberId} className="border-t border-foreground/10"><td className="py-2.5 font-medium">{r.name}</td><td>{r.squad}</td><td>{r.qualified}</td><td>{r.leads}</td><td>{r.meetings}</td><td>{fmtKES(r.pipeline)}</td><td>{r.wins}</td><td>{fmtKES(r.collected)}</td><td>{r.followupRate}%</td></tr>)}</tbody>
          </table>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">*Meaningful conversations proxied by qualified + meetings; duplicate/low-quality submissions are deduplicated at review and do not inflate scores.</p>
        </CardContent>
      </Card>
    </div>
  );
}
