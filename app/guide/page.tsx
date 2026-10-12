"use client";

import Link from "next/link";
import { PageHead } from "@/components/crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="flex gap-4 rounded-xl border border-foreground/10 px-4 py-3.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground font-display text-sm text-background">{n}</span>
      <div><p className="text-sm font-medium">{title}</p><p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{body}</p></div>
    </div>
  );
}

function Chapter({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{eyebrow}</p>
      <h2 className="mt-1 font-display text-3xl tracking-tight">{title}</h2>
      <div className="mt-3 space-y-2.5">{children}</div>
    </section>
  );
}

const CONTENTS: [string, string][] = [
  ["start", "1 · Your first day"],
  ["register", "2 · Register a lead in 60 seconds"],
  ["log", "3 · Log anything in 30 seconds"],
  ["followups", "4 · Follow-ups — your promise keeper"],
  ["meetings", "5 · Meetings"],
  ["money", "6 · Pipeline & your earnings"],
  ["toolkit", "7 · Campaigns, files & messages"],
  ["measured", "8 · How you're measured"],
  ["rules", "9 · Rules of the road"],
  ["faq", "10 · Quick answers"],
];

export default function GuidePage() {
  return (
    <div>
      <PageHead
        eyebrow="BDP handbook · read once, then work"
        title="Your guide to winning"
        sub="Everything a Business Development Partner needs: finding leads, logging work from your phone, getting paid. Nothing here is paperwork for its own sake — every step moves a deal forward."
        action={<Button asChild className="rounded-full bg-foreground text-background"><Link href="/leads?new=1">+ Register your first lead</Link></Button>}
      />
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1" aria-label="Guide contents">
            {CONTENTS.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="block rounded-lg px-3 py-2 text-[13px] text-foreground/70 hover:bg-foreground/5 hover:text-foreground">{label}</a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-10">
          <Chapter id="start" eyebrow="Chapter 1" title="Your first day">
            <Step n="1" title="Open your invite email" body="Tap the button, confirm it's you, and choose your password. The link lasts 24 hours — ask your captain for a fresh one if it expires." />
            <Step n="2" title="Sign in at crm.mathengeinc.com" body="Use your work email. Forgot it later? Tap “Forgot password?” on the sign-in screen." />
            <Step n="3" title="Look at My workspace" body="Four numbers: your leads, follow-ups due, active opportunities, meetings booked. Below them, Today's priorities tells you exactly what to do first. Start there every morning." />
          </Chapter>

          <Chapter id="register" eyebrow="Chapter 2" title="Register a lead in 60 seconds">
            <Card className="rounded-xl"><CardContent className="space-y-2 px-5 py-4 text-sm">
              <p>A <strong>lead</strong> is any business that could buy from us. Tap <strong>+ Register lead</strong> and fill only six things:</p>
              <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
                <li><strong className="text-foreground">Business name</strong> — exact name on the signboard or receipt.</li>
                <li><strong className="text-foreground">Website or identifier</strong> — website, Instagram, or “walk-in, Moi Avenue”.</li>
                <li><strong className="text-foreground">Contact</strong> — who you spoke to and their role. “Unknown yet” is fine.</li>
                <li><strong className="text-foreground">Industry</strong> — shop, restaurant, distributor, school…</li>
                <li><strong className="text-foreground">Observed problem</strong> — what you SAW, not guessed. “Paper order book, 3 missed calls while I waited.”</li>
                <li><strong className="text-foreground">Source</strong> — where you found them.</li>
              </ol>
              <p className="rounded-xl bg-red-600/10 px-4 py-2.5 text-[13px] text-red-800">If the screen warns the business is already in our records — STOP. It shows who owns it and whether we already contacted them. Never pitch a business another BDP owns.</p>
              <p>Missing details? <strong>Save draft</strong> and complete it after your next visit. A draft still counts as yours.</p>
            </CardContent></Card>
          </Chapter>

          <Chapter id="log" eyebrow="Chapter 3" title="Log anything in 30 seconds">
            <Card className="rounded-xl"><CardContent className="space-y-2 px-5 py-4 text-sm">
              <p>Open any lead and tap one quick action — then add only the next step and its date:</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {[
                  ["No answer", "Tried calling, no pickup. Set when to try again."],
                  ["Replied", "They responded. Note what they said."],
                  ["Interested", "They want more — this can qualify the lead."],
                  ["Meeting booked", "Date set — it appears under Meetings."],
                  ["Follow up later", "Not now — pick the exact return date."],
                  ["Not interested", "Record why. A clean no beats a silent maybe."],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-foreground/10 px-3 py-2"><p className="font-medium">{k}</p><p className="text-xs text-muted-foreground">{v}</p></div>
                ))}
              </div>
              <p><strong>Golden rule: no lead ever sits without a next step and a date.</strong> The system will chase you when one goes overdue — and then it tells your captain.</p>
            </CardContent></Card>
          </Chapter>

          <Chapter id="followups" eyebrow="Chapter 4" title="Follow-ups — your promise keeper">
            <Step n="1" title="Work the Tasks page top-down" body="Overdue first, always. Each task links straight to its lead — one tap and you're logging." />
            <Step n="2" title="Tap Done the moment it's done" body="Don't batch your updates at night. A 30-second log right after the call keeps every record true." />
            <Step n="3" title="Stuck? Say so" body="If a lead won't move, write what's blocking you in the next action. Your captain's job is unblocking — give them something to work with." />
          </Chapter>

          <Chapter id="meetings" eyebrow="Chapter 5" title="Meetings">
            <Step n="1" title="Prepare in 5 minutes" body="Re-read the lead: problem, decision-maker, last outcome. Open the Campaigns page for the right demo and one-pager." />
            <Step n="2" title="Record the outcome the same day" body="Meetings → your meeting → Record outcome. What was agreed, and the next step with a date. A meeting without a recorded outcome didn't happen as far as the business is concerned." />
          </Chapter>

          <Chapter id="money" eyebrow="Chapter 6" title="Pipeline & your earnings">
            <Card className="rounded-xl"><CardContent className="space-y-2 px-5 py-4 text-sm">
              <p>When a lead is genuinely interested — real problem, named decision-maker, urgency — mark it <strong>Interested & qualify</strong>. It moves to the pipeline and the closing team takes it from there. <strong>You stay attached to it forever:</strong> the commission is yours when it pays.</p>
              <p>Track everything under <strong>My earnings</strong>: eligible revenue, earned commission, what's awaiting approval, what's paid. Commission is calculated automatically when the client's payment lands — per the rate on your profile. If a number looks wrong, ask your captain before payday, not after.</p>
            </CardContent></Card>
          </Chapter>

          <Chapter id="toolkit" eyebrow="Chapter 7" title="Campaigns, files & messages">
            <Step n="1" title="Campaigns page before outreach" body="Current offers, who they're for, message templates you can copy, and the qualification checklist. Never freelance the pricing — use the approved offers." />
            <Step n="2" title="Files page for everything shared" body="Price lists, decks, playbooks — download anytime. If your captain uploads something new, you'll be notified." />
            <Step n="3" title="Watch your notifications" body="Announcements, meeting notices and new resources arrive in-app (bell, top right) and by email. Read them — they often change what you're selling that week." />
          </Chapter>

          <Chapter id="measured" eyebrow="Chapter 8" title="How you're measured">
            <Card className="rounded-xl"><CardContent className="px-5 py-4 text-sm">
              <p><strong>Quality beats volume.</strong> Flooding the system with weak leads hurts your score — duplicates and low-quality entries are filtered at review. What counts:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                <li>Qualified leads accepted — did your leads hold up?</li>
                <li>Real conversations — replies and interest, not dials.</li>
                <li>Meetings held and pipeline value created.</li>
                <li>Cash collected — the number that pays everyone.</li>
                <li>Follow-up completion — did you do what you said, when you said?</li>
                <li>Record quality — can the business trust your updates?</li>
              </ul>
            </CardContent></Card>
          </Chapter>

          <Chapter id="rules" eyebrow="Chapter 9" title="Rules of the road">
            <Step n="1" title="The CRM is the truth" body="WhatsApp is for coordinating. Ownership, updates, meeting outcomes and money live HERE. If it isn't in the CRM, it didn't happen." />
            <Step n="2" title="One owner per lead" body="Never work a lead owned by someone else. Flag duplicates instead of re-registering." />
            <Step n="3" title="Phones first" body="Everything works on your phone. Log from the field — large buttons, minimal typing, under a minute." />
            <Step n="4" title="Ask early" body="Captain for stuck leads, admin for access and disputes. Silence is the only real failure." />
          </Chapter>

          <Chapter id="faq" eyebrow="Chapter 10" title="Quick answers">
            <Card className="rounded-xl">
              <CardHeader><CardTitle className="font-display text-xl">FAQ</CardTitle></CardHeader>
              <CardContent className="space-y-2.5 px-6 pb-6 text-sm">
                {[
                  ["I can't sign in.", "Use “Forgot password?” on the sign-in page. Still stuck? Your captain or admin will sort you out — accounts are created by them, never by you."],
                  ["My invite link expired.", "Links last 24 hours. Ask your captain for a fresh invite."],
                  ["The business says someone already contacted them.", "Stop pitching. Check the duplicate warning — it names the owner. Hand it over with a note."],
                  ["I registered the wrong business.", "Log it honestly on the lead (“wrong entry — please reject”) and register the right one. Don't leave bad data."],
                  ["I'm leaving / a lead must move to someone else.", "Tell your captain. Transfers keep the FULL history — nothing is lost."],
                  ["When do I get paid?", "When the client's payment is verified, commission is calculated automatically. Watch My earnings; approved amounts are paid out on the normal cycle."],
                ].map(([q, a]) => (
                  <div key={q} className="rounded-xl bg-foreground/5 px-4 py-3"><p className="font-medium">{q}</p><p className="mt-0.5 text-muted-foreground">{a}</p></div>
                ))}
              </CardContent>
            </Card>
          </Chapter>

          <div className="flex flex-col items-center gap-3 rounded-2xl border border-foreground/10 bg-card p-8 text-center">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">The whole job, in one line</p>
            <p className="font-display text-3xl">Every lead has an owner. Every action has a next step.</p>
            <Button asChild className="rounded-full bg-foreground text-background"><Link href="/leads?new=1">Go register a lead</Link></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
