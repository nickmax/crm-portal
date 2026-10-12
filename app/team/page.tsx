"use client";
import { useCrm } from "@/lib/crm/store";
import { scorecard } from "@/lib/crm/insights";
import { PageHead } from "@/components/crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL } from "@/lib/crm/types";

export default function TeamPage() {
  const s = useCrm();
  const rows = scorecard(s);
  const canManage = ["owner", "admin"].includes(s.currentUser.role);

  const setStatus = (id: string, status: "active" | "onboarding" | "inactive") => {
    s.mutate((st) => ({ ...st, members: st.members.map((m) => m.id === id ? { ...m, status } : m) }));
  };

  return (
    <div>
      <PageHead eyebrow="Team · onboarding to performance" title="Team" sub="BDP membership, onboarding, captains, activity and scorecards. Captains unblock; admins run the programme." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {s.members.map((m) => {
          const r = rows.find((x) => x.memberId === m.id);
          const squad = s.squads.find((q) => q.id === m.squadId)?.name ?? "—";
          return (
            <Card key={m.id} className="rounded-xl py-0">
              <CardContent className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground font-display text-lg text-background">{m.name.charAt(0)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <p className="truncate font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{ROLE_LABEL[m.role]} · {squad}</p>
                  </div>
                  <Badge className={`rounded-full border-0 ${m.status === "active" ? "bg-green-600/15 text-green-800" : m.status === "onboarding" ? "bg-foreground text-background" : "bg-red-600/15 text-red-800"}`}>{m.status}</Badge>
                </div>
                {r && <p className="mt-2 font-mono text-[11px] text-muted-foreground">{r.leads} leads · {r.qualified} qual · {r.meetings} mtgs · {r.followupRate}% follow-up · last active {new Date(m.lastActiveAt).toLocaleDateString()}</p>}
                {canManage && m.role === "bdp" && (
                  <div className="mt-2 flex gap-1.5">
                    {(["active", "onboarding", "inactive"] as const).map((st) => (
                      <button key={st} onClick={() => setStatus(m.id, st)} className={`rounded-full border px-2.5 py-1 text-[11px] ${m.status === st ? "bg-foreground text-background" : "hover:bg-foreground/5"}`}>{st}</button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Card className="mt-4 rounded-xl">
        <CardHeader><CardTitle className="font-display text-2xl">Weekly operating rhythm</CardTitle></CardHeader>
        <CardContent className="grid gap-2 px-6 pb-6 text-sm md:grid-cols-2">
          {[["BDPs", "Maintain leads, complete follow-ups, submit meeting outcomes."], ["Squad captains", "Review overdue, lead quality, activity and stalled deals."], ["Programme admin", "Onboarding, training, campaigns, disputes, data quality, weekly reporting."], ["Owner", "Qualified opportunities, strategic accounts, negotiations, closing."]].map(([k, v]) => (
            <p key={k} className="rounded-xl bg-foreground/5 px-4 py-3"><span className="font-medium">{k}:</span> {v}</p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
