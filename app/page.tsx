"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useCrm, fmtKES } from "@/lib/crm/store";
import { computeExceptions, companyName, memberName } from "@/lib/crm/insights";
import { visibleLeads } from "@/lib/crm/permissions";
import { Eyebrow, StatCard, LeadBadge } from "@/components/crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, AlertTriangle } from "lucide-react";

export default function HomePage() {
  const s = useCrm();
  const { currentUser } = s;

  const leads = useMemo(() => visibleLeads(s.leads, currentUser), [s.leads, currentUser]);
  const myTasks = s.tasks.filter((t) => t.ownerId === currentUser.id && t.status !== "done");
  const myOverdue = myTasks.filter((t) => new Date(t.dueAt).getTime() < Date.now());
  const myLeads = s.leads.filter((l) => l.ownerId === currentUser.id);
  const myOpps = s.opportunities.filter((o) => o.bdpId === currentUser.id && !["won", "lost"].includes(o.stage));
  const myMeetings = s.meetings.filter((m) => { const l = s.leads.find((x) => x.id === m.leadId); return l?.ownerId === currentUser.id && m.outcome === "pending"; });
  const myCommissions = s.commissions.filter((c) => c.bdpId === currentUser.id);

  if (currentUser.role === "owner" || currentUser.role === "admin") return <OwnerHome />;
  if (currentUser.role === "bdp") {
    return (
      <div>
        <Eyebrow>My workspace</Eyebrow>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl lg:text-5xl">Karibu, {currentUser.name.split(" ")[0]}</h1>
          <Button asChild className="rounded-full bg-foreground text-background"><Link href="/leads?new=1">+ Register lead</Link></Button>
        </div>
        <p className="mt-2 text-muted-foreground">Update a lead from your phone in under a minute. Everything here is yours only.</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="My leads" value={String(myLeads.length)} hint="Across all statuses" href="/leads" />
          <StatCard label="Follow-ups due" value={String(myTasks.length)} hint={myOverdue.length ? `${myOverdue.length} overdue — act first` : "All clear"} href="/tasks" />
          <StatCard label="Active opportunities" value={String(myOpps.length)} hint="Qualified and beyond" href="/pipeline" />
          <StatCard label="Meetings booked" value={String(myMeetings.length)} hint="Upcoming" href="/meetings" />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card className="rounded-xl">
            <CardHeader><CardTitle className="font-display text-2xl">Today&apos;s priorities</CardTitle></CardHeader>
            <CardContent className="space-y-3 px-6 pb-6">
              {myTasks.slice(0, 5).map((t) => {
                const overdue = new Date(t.dueAt).getTime() < Date.now();
                const lead = s.leads.find((l) => l.id === t.leadId);
                return (
                  <Link key={t.id} href={lead ? `/leads/${lead.id}` : "/tasks"} className="flex items-center justify-between gap-3 rounded-xl border border-foreground/10 px-4 py-3 hover:bg-foreground/5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">Due {new Date(t.dueAt).toLocaleString()} {overdue && <span className="font-medium text-red-700">· Overdue</span>}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </Link>
                );
              })}
              {myTasks.length === 0 && <p className="text-sm text-muted-foreground">Nothing due. Register a lead or log an interaction.</p>}
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardHeader><CardTitle className="font-display text-2xl">Quick actions</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 px-6 pb-6">
              {[
                ["No answer", "/leads"], ["Replied", "/leads"], ["Interested", "/leads?new=1"],
                ["Meeting booked", "/meetings"], ["Follow up later", "/tasks"], ["Not interested", "/leads"],
              ].map(([label, href]) => (
                <Link key={label} href={href} className="rounded-full border border-foreground/15 px-4 py-3 text-center text-sm font-medium transition-colors hover:bg-foreground hover:text-background">
                  {label}
                </Link>
              ))}
              <div className="col-span-2 mt-2 rounded-xl bg-foreground/5 p-4 text-[13px] text-muted-foreground">
                Earnings so far: <span className="font-medium text-foreground">{fmtKES(myCommissions.reduce((a, c) => a + c.earned, 0))}</span>
                {" "}· <Link href="/deals" className="underline">View statement</Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (currentUser.role === "sales") {
    const mine = s.opportunities.filter((o) => o.ownerId === currentUser.id && !["won", "lost"].includes(o.stage));
    return (
      <div>
        <Eyebrow>Closing home</Eyebrow>
        <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl lg:text-5xl">Your deals, end to end</h1>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <StatCard label="Assigned opportunities" value={String(mine.length)} href="/pipeline" />
          <StatCard label="Proposal value" value={fmtKES(mine.filter((o) => ["proposal", "negotiation"].includes(o.stage)).reduce((a, o) => a + o.value, 0))} href="/pipeline" />
          <StatCard label="Meetings upcoming" value={String(s.meetings.filter((m) => m.outcome === "pending").length)} href="/meetings" />
        </div>
        <Card className="mt-6 rounded-xl">
          <CardHeader><CardTitle className="font-display text-2xl">Assigned opportunities</CardTitle></CardHeader>
          <CardContent className="space-y-2 px-6 pb-6">
            {mine.map((o) => (
              <Link key={o.id} href="/pipeline" className="flex items-center justify-between rounded-xl border border-foreground/10 px-4 py-3 hover:bg-foreground/5">
                <span className="text-sm font-medium">{companyName(s, o.companyId)} — {fmtKES(o.value)}</span>
                <span className="font-mono text-xs uppercase text-muted-foreground">{o.stage.replace(/_/g, " ")}</span>
              </Link>
            ))}
            {mine.length === 0 && <p className="text-sm text-muted-foreground">No open assignments.</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Captain home
  const squadLeads = currentUser.squadId ? s.leads.filter((l) => l.squadId === currentUser.squadId) : [];
  const squadOverdue = s.tasks.filter((t) => squadLeads.some((l) => l.id === t.leadId) && t.status !== "done" && new Date(t.dueAt).getTime() < Date.now());
  return (
    <div>
      <Eyebrow>Squad home</Eyebrow>
      <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl lg:text-5xl">Unblock your squad</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Squad leads" value={String(squadLeads.length)} href="/leads" />
        <StatCard label="Overdue tasks" value={String(squadOverdue.length)} hint="Review first" href="/tasks" />
        <StatCard label="Active opportunities" value={String(s.opportunities.filter((o) => !["won", "lost"].includes(o.stage)).length)} href="/pipeline" />
      </div>
      <Card className="mt-6 rounded-xl">
        <CardHeader><CardTitle className="font-display text-2xl">Needs your attention</CardTitle></CardHeader>
        <CardContent className="space-y-2 px-6 pb-6">
          {squadOverdue.slice(0, 6).map((t) => (
            <Link key={t.id} href="/tasks" className="flex items-center justify-between rounded-xl border border-foreground/10 px-4 py-3 hover:bg-foreground/5">
              <span className="text-sm font-medium">{t.title}</span>
              <span className="text-xs text-muted-foreground">{memberName(s, t.ownerId)}</span>
            </Link>
          ))}
          {squadOverdue.length === 0 && <p className="text-sm text-muted-foreground">Squad is clear. Review lead quality next.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function OwnerHome() {
  const s = useCrm();
  const newThisWeek = s.leads.filter((l) => Date.now() - new Date(l.createdAt).getTime() < 7 * 86400000);
  const qualifiedValue = s.opportunities.filter((o) => !["won", "lost"].includes(o.stage)).reduce((a, o) => a + o.value, 0);
  const won = s.deals.filter((d) => d.outcome === "won").reduce((a, d) => a + d.contractValue, 0);
  const collected = s.deals.reduce((a, d) => a + d.collected, 0);
  const meetingsHeld = s.meetings.filter((m) => m.outcome === "held").length;
  const meetingsBooked = s.meetings.filter((m) => m.outcome === "pending").length;
  const exceptions = computeExceptions(s);

  return (
    <div>
      <Eyebrow>Mathenge Inc. — Sales Command Centre</Eyebrow>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl lg:text-5xl">The whole business, one screen</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="rounded-full"><Link href="/reports">Auto reports</Link></Button>
          <Button asChild className="rounded-full bg-foreground text-background"><Link href="/leads?new=1">+ Register lead</Link></Button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="New leads · this week" value={String(newThisWeek.length)} hint="By source & squad →" href="/leads" />
        <StatCard label="Qualified pipeline" value={fmtKES(qualifiedValue)} hint="By expected close →" href="/pipeline" />
        <StatCard label="Meetings booked / held" value={`${meetingsBooked} / ${meetingsHeld}`} hint="Outcomes recorded →" href="/meetings" />
        <StatCard label="Won / collected" value={`${fmtKES(won)}`} hint={`${fmtKES(collected)} cash in →`} href="/deals" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="rounded-xl lg:col-span-2">
          <CardHeader><CardTitle className="font-display text-2xl">Exceptions requiring attention</CardTitle></CardHeader>
          <CardContent className="space-y-2 px-6 pb-6">
            {exceptions.slice(0, 8).map((e, i) => (
              <Link key={i} href={e.link} className="flex items-start gap-3 rounded-xl border border-foreground/10 px-4 py-3 hover:bg-foreground/5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{e.detail}</p>
                </div>
              </Link>
            ))}
            {exceptions.length === 0 && <p className="text-sm text-muted-foreground">All clear — no overdue, stalled or missing-step records.</p>}
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardHeader><CardTitle className="font-display text-2xl">Squad comparison</CardTitle></CardHeader>
          <CardContent className="space-y-3 px-6 pb-6">
            {s.squads.map((q) => {
              const qLeads = s.leads.filter((l) => l.squadId === q.id);
              const qVal = s.opportunities.filter((o) => qLeads.some((l) => l.id === o.leadId)).reduce((a, o) => a + o.value, 0);
              const cap = s.members.find((m) => m.id === q.captainId);
              return (
                <Link key={q.id} href="/cohorts" className="block rounded-xl border border-foreground/10 p-4 hover:bg-foreground/5">
                  <p className="text-sm font-medium">{q.name}</p>
                  <p className="text-xs text-muted-foreground">{cap?.name} · {q.industry}</p>
                  <p className="mt-1 font-mono text-xs">{qLeads.length} leads · {fmtKES(qVal)} pipeline</p>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
