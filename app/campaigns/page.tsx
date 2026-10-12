"use client";
import { useCrm } from "@/lib/crm/store";
import { PageHead } from "@/components/crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CampaignsPage() {
  const s = useCrm();
  const camp = s.campaigns[0];
  if (!camp) return <p>No campaign.</p>;
  return (
    <div>
      <PageHead eyebrow="Campaigns & resources" title={camp.name} sub={`${camp.industry} · Ideal customer: ${camp.icp}`} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-xl"><CardHeader><CardTitle className="font-display text-2xl">Approved offers</CardTitle></CardHeader>
          <CardContent className="space-y-2 px-6 pb-6">{camp.offers.map((o) => <p key={o} className="rounded-xl bg-foreground/5 px-4 py-3 text-sm font-medium">{o}</p>)}</CardContent></Card>
        <Card className="rounded-xl"><CardHeader><CardTitle className="font-display text-2xl">Qualification checklist</CardTitle></CardHeader>
          <CardContent className="space-y-2 px-6 pb-6">{camp.checklist.map((c) => <label key={c} className="flex items-center gap-2.5 rounded-xl border border-foreground/10 px-4 py-2.5 text-sm"><input type="checkbox" className="h-4 w-4" />{c}</label>)}</CardContent></Card>
        <Card className="rounded-xl"><CardHeader><CardTitle className="font-display text-2xl">Targets by squad</CardTitle></CardHeader>
          <CardContent className="space-y-2 px-6 pb-6">{camp.targets.map((t) => { const q = s.squads.find((x) => x.id === t.squadId); const got = s.leads.filter((l) => l.squadId === t.squadId).length; return <div key={t.squadId} className="rounded-xl border border-foreground/10 p-3 text-sm"><p className="font-medium">{q?.name}</p><p className="font-mono text-xs text-muted-foreground">{got}/{t.leads} leads · {t.meetings} meetings target</p><div className="mt-1.5 h-1.5 rounded-full bg-foreground/10"><div className="h-full rounded-full bg-foreground" style={{ width: `${Math.min(100, Math.round((got / t.leads) * 100))}%` }} /></div></div>; })}</CardContent></Card>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="rounded-xl"><CardHeader><CardTitle className="font-display text-2xl">Outreach templates</CardTitle></CardHeader>
          <CardContent className="space-y-2.5 px-6 pb-6">{camp.templates.map((t) => <div key={t.name} className="rounded-xl border border-foreground/10 p-4"><p className="text-sm font-medium">{t.name}</p><p className="mt-1 text-[13px] text-muted-foreground">{t.body}</p><button onClick={() => navigator.clipboard?.writeText(t.body)} className="mt-2 rounded-full border px-3 py-1 text-xs hover:bg-foreground hover:text-background">Copy</button></div>)}</CardContent></Card>
        <Card className="rounded-xl"><CardHeader><CardTitle className="font-display text-2xl">Training &amp; case studies</CardTitle></CardHeader>
          <CardContent className="space-y-2 px-6 pb-6">{camp.resources.map((r) => <div key={r.title} className="flex items-center justify-between rounded-xl border border-foreground/10 px-4 py-3 text-sm"><span>{r.title}</span><span className="font-mono text-[11px] uppercase text-muted-foreground">{r.kind}</span></div>)}</CardContent></Card>
      </div>
    </div>
  );
}
