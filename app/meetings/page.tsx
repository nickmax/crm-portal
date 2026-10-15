"use client";
import Link from "next/link";
import { useState } from "react";
import { useCrm, uid, audit } from "@/lib/crm/store";
import { companyName } from "@/lib/crm/insights";
import { PageHead } from "@/components/crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function MeetingsPage() {
  const s = useCrm();
  const [open, setOpen] = useState(false);
  const [leadId, setLeadId] = useState(s.leads[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [attendees, setAttendees] = useState("");
  const [outcomeFor, setOutcomeFor] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [next, setNext] = useState("");

  const book = () => {
    const lead = s.leads.find((l) => l.id === leadId);
    if (!lead || !date) return;
    s.mutate((st) => ({
      ...st,
      meetings: [...st.meetings, { id: uid("m"), opportunityId: st.opportunities.find((o) => o.leadId === leadId)?.id ?? null, leadId, companyId: lead.companyId, date: new Date(date).toISOString(), attendees: attendees.split(",").map((x) => x.trim()).filter(Boolean), outcome: "pending" as const, notes: "Booked — outcome to be recorded after.", nextAction: "Hold meeting + record outcome" }],
      leads: st.leads.map((l) => l.id === leadId ? { ...l, status: "meeting_booked" as const, nextAction: "Hold meeting + record outcome", nextDueAt: new Date(date).toISOString(), lastActivityAt: new Date().toISOString() } : l),
      tasks: [...st.tasks, { id: uid("t"), leadId, companyId: lead.companyId, ownerId: lead.ownerId, title: `Record outcome — meeting ${new Date(date).toLocaleDateString()}`, dueAt: new Date(new Date(date).getTime() + 24 * 3600000).toISOString(), status: "open" as const, createdAt: new Date().toISOString() }],
      audit: audit(st, st.currentUserId, "Meeting booked", "meeting", leadId, date),
    }));
    setOpen(false);
  };

  const saveOutcome = (id: string) => {
    s.mutate((st) => {
      const m = st.meetings.find((x) => x.id === id);
      if (!m) return st;
      return {
        ...st,
        meetings: st.meetings.map((x) => x.id === id ? { ...x, outcome: "held" as const, notes: notes || x.notes, nextAction: next || x.nextAction } : x),
        leads: st.leads.map((l) => l.id === m.leadId ? { ...l, status: "meeting_held" as const, nextAction: next || l.nextAction, lastActivityAt: new Date().toISOString() } : l),
        activities: [...st.activities, { id: uid("a"), leadId: m.leadId, companyId: m.companyId, actorId: st.currentUserId, kind: "meeting" as const, summary: `Meeting held — ${notes}`, outcome: "held", createdAt: new Date().toISOString() }],
        audit: audit(st, st.currentUserId, "Meeting outcome recorded", "meeting", id, next),
      };
    });
    setOutcomeFor(null); setNotes(""); setNext("");
  };

  return (
    <div>
      <PageHead eyebrow="Meetings booked & held" title="Meetings" sub="Book, hold, then record the outcome and next action. No meeting ends without a next step."
        action={<Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="rounded-full btn-brand">+ Book meeting</Button></DialogTrigger>
          <DialogContent className="rounded-2xl"><DialogHeader><DialogTitle className="font-display text-2xl">Book a meeting</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Lead</Label><select value={leadId} onChange={(e) => setLeadId(e.target.value)} className="h-10 w-full rounded-xl border px-3 text-sm">{s.leads.map((l) => <option key={l.id} value={l.id}>{companyName(s, l.companyId)}</option>)}</select></div>
              <div><Label>Date &amp; time</Label><Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-xl" /></div>
              <div><Label>Attendees (comma separated)</Label><Input value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="Jane (MD), David (sales)" className="h-10 rounded-xl" /></div>
              <Button className="w-full rounded-full btn-brand" onClick={book}>Book + create reminder task</Button>
            </div>
          </DialogContent></Dialog>} />
      <div className="grid gap-3">
        {s.meetings.map((m) => (
          <Card key={m.id} className="rounded-xl py-0">
            <CardContent className="flex flex-col gap-2 px-5 py-4 lg:flex-row lg:items-center">
              <div className="flex-1">
                <Link href={`/leads/${m.leadId}`} className="font-medium hover:underline">{companyName(s, m.companyId)}</Link>
                <p className="text-[13px] text-muted-foreground">{new Date(m.date).toLocaleString()} · {m.attendees.join(", ")}</p>
                <p className="text-[13px]">{m.notes} · Next: {m.nextAction}</p>
              </div>
              <span className={`w-fit rounded-full px-3 py-1 font-mono text-[11px] uppercase ${m.outcome === "held" ? "bg-green-600/15 text-green-800" : "bg-foreground text-background"}`}>{m.outcome}</span>
              {m.outcome === "pending" && outcomeFor !== m.id && (
                <div className="flex shrink-0 gap-1.5">
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => setOutcomeFor(m.id)}>Record outcome</Button>
                  <Button size="sm" variant="outline" className="rounded-full" asChild>
                    <Link href={`/comms?type=meeting&meeting=${encodeURIComponent(`${companyName(s, m.companyId)} — ${new Date(m.date).toLocaleString()}`)}`}>Announce</Link>
                  </Button>
                </div>
              )}
              {outcomeFor === m.id && (
                <div className="grid w-full gap-2 rounded-xl bg-foreground/5 p-3 lg:max-w-sm">
                  <Label className="text-xs">Outcome notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" placeholder="What was agreed?" />
                  <Label className="text-xs">Agreed next action</Label><Input value={next} onChange={(e) => setNext(e.target.value)} className="h-9 rounded-xl" placeholder="Send proposal by Friday" />
                  <div className="flex gap-2"><Button size="sm" variant="outline" className="rounded-full" onClick={() => setOutcomeFor(null)}>Cancel</Button><Button size="sm" className="rounded-full btn-brand" onClick={() => saveOutcome(m.id)}>Save</Button></div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
