"use client";
import { useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { scorecard } from "@/lib/crm/insights";
import { PageHead } from "@/components/crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      {s.currentUser.role !== "owner" && <ClaimOwner />}
      {canManage && <InviteMember />}
      {s.currentUser.role === "owner" && <ClearDemo />}
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

function ClaimOwner() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const claim = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/team/claim-owner", { method: "POST" });
      const j = await r.json();
      setMsg(r.ok ? "You're the owner now — sign out and back in to pick it up." : j.error);
    } catch { setMsg("Network error — try again."); }
    setBusy(false);
  };
  return (
    <Card className="mb-4 rounded-xl border-foreground">
      <CardContent className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="font-medium">No owner on this system yet</p>
          <p className="text-[13px] text-muted-foreground">If you're setting the CRM up, claim ownership. This works once — afterwards only an owner can grant access.</p>
          {msg && <p className="mt-1 text-[13px]">{msg}</p>}
        </div>
        <Button className="rounded-full bg-foreground text-background" disabled={busy} onClick={claim}>
          {busy ? "Claiming…" : "Claim owner access"}
        </Button>
      </CardContent>
    </Card>
  );
}

function InviteMember() {
  const s = useCrm();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("bdp");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const invite = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/team/invite", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role }),
      });
      const j = await r.json();
      setMsg(r.ok
        ? (j.invited ? `Invite sent to ${email} — they'll choose a password from the email.` : `Account updated for ${email}.`)
        : `Failed — ${j.error}`);
      if (r.ok) { setEmail(""); setName(""); }
    } catch { setMsg("Network error — try again."); }
    setBusy(false);
  };

  return (
    <Card className="mb-4 rounded-xl">
      <CardHeader><CardTitle className="font-display text-2xl">Invite a member</CardTitle></CardHeader>
      <CardContent className="px-6 pb-6">
        <p className="mb-3 text-[13px] text-muted-foreground">They get an email, choose a password, and land in the role you pick. Do this when a contract is signed.</p>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div><Label>Work email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="amina@mathengeinc.com" className="mt-1 h-10 rounded-xl" inputMode="email" /></div>
          <div><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Amina N." className="mt-1 h-10 rounded-xl" /></div>
          <div><Label>Role</Label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-foreground/15 bg-card px-3 text-sm">
              {(["bdp", "captain", "sales", "admin", "owner"] as const).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>
          <div className="flex items-end"><Button className="w-full rounded-full bg-foreground text-background" disabled={busy || !email} onClick={invite}>{busy ? "Inviting…" : "Send invite"}</Button></div>
        </div>
        {msg && <p className="mt-2 rounded-xl bg-foreground/5 px-4 py-2.5 text-[13px]">{msg}</p>}
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">Squads are assigned under Cohorts & squads after they join · {s.members.filter((m) => m.email).length} members with emails</p>
      </CardContent>
    </Card>
  );
}

function ClearDemo() {
  const { clearDemo } = useCrm();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const clear = async () => {
    if (!confirm("Remove ALL demo data (sample squads, members, leads, deals)? Real records are never touched. This can't be undone.")) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/team/clear-demo", { method: "DELETE" });
      const j = await r.json();
      if (r.ok) {
        clearDemo();
        const n = Object.values(j.removed as Record<string, number>).reduce((a, b) => a + b, 0);
        setMsg(`Done — ${n} demo rows removed everywhere. The system is clean.`);
      } else setMsg(`Failed — ${j.error}`);
    } catch { setMsg("Network error — try again."); }
    setBusy(false);
  };
  return (
    <Card className="mb-4 rounded-xl border-red-300">
      <CardContent className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="font-medium">Demo data</p>
          <p className="text-[13px] text-muted-foreground">Sample squads (Mamba, Zawadi…), members and leads. Remove it to start clean — matched by exact demo ids, real rows are never touched.</p>
          {msg && <p className="mt-1 text-[13px]">{msg}</p>}
        </div>
        <Button variant="outline" className="rounded-full border-red-300 text-red-700 hover:bg-red-600 hover:text-white" disabled={busy} onClick={clear}>
          {busy ? "Clearing…" : "Remove demo data"}
        </Button>
      </CardContent>
    </Card>
  );
}
