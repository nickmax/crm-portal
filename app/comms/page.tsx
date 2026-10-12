"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHead, Eyebrow } from "@/components/crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { useCrm } from "@/lib/crm/store";

const ROLES = ["owner", "admin", "captain", "bdp", "sales"] as const;
const KINDS = [
  ["announcement", "Announcement", "Team-wide update — targets, wins, changes."],
  ["meeting", "Meeting notice", "Call a meeting — date, agenda, who must attend."],
  ["resource", "Resource share", "Point everyone at a new file or guide in the hub."],
  ["custom", "Custom email", "Free-form email to exactly the people you pick."],
] as const;

interface Person { id: string; email: string; name: string; role: string; squad: number | null }
interface SquadRow { id: number; name: string }

export default function CommsPage() {
  return (
    <Suspense fallback={<p className="py-10 font-mono text-sm text-muted-foreground">Loading comms…</p>}>
      <CommsInner />
    </Suspense>
  );
}

function CommsInner() {
  const params = useSearchParams();
  const { currentUser } = useCrm();
  const canSend = ["owner", "admin", "captain"].includes(currentUser.role);
  const [kind, setKind] = useState<string>(params.get("type") ?? "announcement");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState(params.get("meeting") ? `Meeting — ${params.get("meeting")}\nDate/time: \nAgenda: \nAttendees: ` : "");
  const [roles, setRoles] = useState<string[]>([]);
  const [squadIds, setSquadIds] = useState<number[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [email, setEmail] = useState(true);
  const [people, setPeople] = useState<Person[]>([]);
  const [squads, setSquads] = useState<SquadRow[]>([]);
  const [status, setStatus] = useState<{ resendConfigured: boolean; from: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [log, setLog] = useState<{ action: string; detail: string; at: string }[]>([]);

  useEffect(() => {
    const sb = createClient();
    fetch("/api/notify").then((r) => r.json()).then(setStatus).catch(() => {});
    sb.from("profiles").select("id,email,display_name,crm_role,role,squad_id").limit(500).then(({ data }) => {
      setPeople(((data ?? []) as Record<string, unknown>[]).map((p) => ({
        id: String(p.id), email: String(p.email ?? ""), name: String((p.display_name as string) ?? p.email ?? "Member"),
        role: p.role === "admin" ? "owner" : ["owner", "admin", "captain", "bdp", "sales"].includes(String(p.crm_role ?? "")) ? String(p.crm_role) : "bdp",
        squad: (p.squad_id as number) ?? null,
      })));
    });
    sb.from("squads").select("id,name").then(({ data }) => setSquads((data ?? []) as SquadRow[]));
    sb.from("audit_log").select("action,detail,created_at").order("created_at", { ascending: false }).limit(40).then(({ data }) => {
      setLog(((data ?? []) as Record<string, string>[]).filter((r) => /sent|shared|uploaded|notice/i.test(r.action ?? "")).map((r) => ({ action: r.action, detail: r.detail, at: r.created_at })));
    });
  }, []);

  const toggle = (list: string[], v: string, set: (x: string[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const send = async () => {
    setSending(true); setResult(null);
    try {
      const r = await fetch("/api/notify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, subject, message, audience: { roles, squadIds, memberIds }, email, meetingId: params.get("meeting") }),
      });
      const j = await r.json();
      setResult(r.ok
        ? `Sent — ${j.notified} notified in-app${email ? (j.emailQueued ? " · email queued (Resend not configured)" : ` · ${j.emailed} emailed`) : ""}.`
        : `Failed — ${j.error}`);
      if (r.ok) { setSubject(""); setMessage(""); }
    } catch { setResult("Failed — network error."); }
    setSending(false);
  };

  if (!canSend) {
    return (
      <div>
        <PageHead eyebrow="Comms hub" title="Comms hub" sub="Broadcasts from your leaders land here as notifications — and by email when enabled." />
        <Card className="rounded-xl"><CardContent className="px-6 py-6 text-sm text-muted-foreground">Only owners, admins and captains can send. You will receive announcements, meeting notices and resources automatically.</CardContent></Card>
      </div>
    );
  }

  const audienceCount =
    (roles.length || squadIds.length || memberIds.length)
      ? people.filter((p) => roles.includes(p.role) || (p.squad != null && squadIds.includes(p.squad)) || memberIds.includes(p.id)).length
      : people.length;

  return (
    <div>
      <PageHead
        eyebrow="Comms hub · announcements, meetings, custom email"
        title="Broadcast to the network"
        sub={status ? (status.resendConfigured ? `Email live via Resend (${status.from}). In-app notifications always send.` : "In-app notifications send now — email queues until a Resend key is added.") : "Loading send status…"}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-xl lg:col-span-2">
          <CardHeader><CardTitle className="font-display text-2xl">Compose</CardTitle></CardHeader>
          <CardContent className="space-y-3 px-6 pb-6">
            <div className="grid gap-2 sm:grid-cols-4">
              {KINDS.map(([v, label, hint]) => (
                <button key={v} onClick={() => setKind(v)} title={hint}
                  className={`rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${kind === v ? "border-foreground bg-foreground text-background" : "border-foreground/15 hover:bg-foreground/5"}`}>
                  {label}
                </button>
              ))}
            </div>
            <div><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Q1 sprint kickoff — Monday 9am" className="mt-1 h-11 rounded-xl" /></div>
            <div><Label>Message</Label><Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} placeholder="What, when, who must attend, and the one action you need…" className="mt-1 rounded-xl" /></div>
            <div>
              <Label>Who receives it <span className="font-mono text-[11px] text-muted-foreground">· {audienceCount} people (all if none picked)</span></Label>
              <p className="mb-1.5 mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Roles</p>
              <div className="flex flex-wrap gap-1.5">
                {ROLES.map((r) => (
                  <button key={r} onClick={() => toggle(roles, r, setRoles)}
                    className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${roles.includes(r) ? "border-foreground bg-foreground text-background" : "border-foreground/15 hover:bg-foreground/5"}`}>{r}</button>
                ))}
              </div>
              {squads.length > 0 && (
                <><p className="mb-1.5 mt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Squads</p>
                <div className="flex flex-wrap gap-1.5">
                  {squads.map((q) => (
                    <button key={q.id} onClick={() => setSquadIds(squadIds.includes(q.id) ? squadIds.filter((x) => x !== q.id) : [...squadIds, q.id])}
                      className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${squadIds.includes(q.id) ? "border-foreground bg-foreground text-background" : "border-foreground/15 hover:bg-foreground/5"}`}>{q.name}</button>
                  ))}
                </div></>
              )}
              <p className="mb-1.5 mt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Individuals</p>
              <div className="grid max-h-44 gap-1 overflow-y-auto rounded-xl border border-foreground/10 p-2">
                {people.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] hover:bg-foreground/5">
                    <input type="checkbox" className="h-4 w-4" checked={memberIds.includes(p.id)}
                      onChange={() => setMemberIds(memberIds.includes(p.id) ? memberIds.filter((x) => x !== p.id) : [...memberIds, p.id])} />
                    <span className="font-medium">{p.name}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{p.role}{p.email ? ` · ${p.email}` : " · no email (in-app only)"}</span>
                  </label>
                ))}
                {people.length === 0 && <p className="p-2 text-[13px] text-muted-foreground">No profiles yet — invite the team first.</p>}
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-foreground/10 px-4 py-3 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={email} onChange={(e) => setEmail(e.target.checked)} />
              Also send by email {status && !status.resendConfigured && <span className="font-mono text-[11px] text-muted-foreground">(queues until Resend key added)</span>}
            </label>
            {result && <p className={`rounded-xl px-4 py-3 text-sm ${result.startsWith("Sent") ? "bg-green-600/10 text-green-800" : "bg-red-600/10 text-red-800"}`}>{result}</p>}
            <Button className="w-full rounded-full bg-foreground text-background" disabled={sending || !subject.trim() || !message.trim()} onClick={send}>
              {sending ? "Sending…" : `Notify ${audienceCount} ${audienceCount === 1 ? "person" : "people"}`}
            </Button>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardHeader><CardTitle className="font-display text-2xl">Recent sends</CardTitle></CardHeader>
          <CardContent className="space-y-2 px-6 pb-6">
            {log.map((l, i) => (
              <div key={i} className="rounded-xl border border-foreground/10 px-3.5 py-2.5 text-[13px]">
                <p className="font-medium">{l.action}</p>
                <p className="text-muted-foreground">{l.detail}</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{new Date(l.at).toLocaleString()}</p>
              </div>
            ))}
            {log.length === 0 && <p className="text-sm text-muted-foreground">Nothing broadcast yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
