"use client";

import Link from "next/link";
import { PageHead } from "@/components/crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const APP = "https://crm.mathengeinc.com";

function Step({ n, title, body, link }: { n: string; title: string; body: string; link?: [string, string] }) {
  return (
    <div className="flex gap-4 rounded-xl border border-foreground/10 px-4 py-3.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground font-display text-sm text-background">{n}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
        {link && <a href={link[0]} className="mt-1.5 inline-block rounded-full border border-foreground/15 px-3.5 py-1.5 text-[13px] font-medium hover:bg-foreground hover:text-background">Open: {link[1]}</a>}
      </div>
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
  ["home", "2 · Your home screen"],
  ["register", "3 · Add a lead in 60 seconds"],
  ["log", "4 · Record your work in 30 seconds"],
  ["followups", "5 · Never miss a follow-up"],
  ["meetings", "6 · Meetings"],
  ["money", "7 · Your pipeline & pay"],
  ["toolkit", "8 · What to sell & where files live"],
  ["measured", "9 · How you're measured"],
  ["rules", "10 · Rules of the road"],
  ["faq", "11 · Quick answers"],
];

export default function GuidePage() {
  return (
    <div>
      <PageHead
        eyebrow="BDP handbook · read once, then work"
        title="Your guide to winning"
        sub="Welcome to the sales team. This page teaches you the system: finding businesses, recording your work from your phone, and getting paid. Every blue button below opens the exact screen it talks about."
        action={<Button asChild className="rounded-full bg-foreground text-background"><a href={`${APP}/leads?new=1`}>+ Add your first lead</a></Button>}
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
          <details className="rounded-xl border border-foreground/15 bg-card px-4 py-3 lg:hidden">
            <summary className="cursor-pointer py-1 text-sm font-medium">Contents — jump to a chapter</summary>
            <nav className="grid gap-0.5 pb-2 pt-2" aria-label="Guide contents">
              {CONTENTS.map(([id, label]) => (
                <a key={id} href={`#${id}`} className="rounded-lg px-3 py-2.5 text-sm text-foreground/80 hover:bg-foreground/5">{label}</a>
              ))}
            </nav>
          </details>

          <Link href="/guide/field-manual" className="block rounded-2xl border border-foreground bg-foreground p-6 text-background transition-transform hover:-translate-y-0.5 sm:p-8">
            <p className="font-mono text-[11px] uppercase tracking-widest opacity-70">The full playbook · 25 chapters + scripts</p>
            <p className="mt-1 font-display text-3xl tracking-tight sm:text-4xl">BDP Field Guide →</p>
            <p className="mt-2 max-w-xl text-sm opacity-80">Signals, industry maps, every email, WhatsApp and call script, answers to objections, follow-up wordings — ready to copy. Keep it open on your phone. ({APP}/guide/field-manual)</p>
          </Link>

          <Chapter id="start" eyebrow="Chapter 1" title="Your first day">
            <Step n="1" title="Open your invite email" body="Tap the button inside, confirm it's you, and choose your password. The link lasts 24 hours — ask your captain for a fresh invite if it runs out." />
            <Step n="2" title="Sign in" body="Use your work email and the password you just chose. If you ever forget it, the sign-in screen has a “Forgot password?” link that emails you a reset." link={[`${APP}/login`, "Sign-in screen"]} />
            <Step n="3" title="Say hello to your home screen" body="It shows your numbers and exactly what to do first. Open it every morning before anything else." link={[`${APP}/`, "My workspace"]} />
          </Chapter>

          <Chapter id="home" eyebrow="Chapter 2" title="Your home screen">
            <Step n="1" title="Four numbers" body="My leads (every business you're working on), Follow-ups due (promises with dates), Active opportunities (leads the closing team is working, with you attached), Meetings booked (what's coming)." link={[`${APP}/`, "My workspace"]} />
            <Step n="2" title="Today's priorities" body="The most urgent things, top first. Tap any of them — it opens the right business so you can act in seconds." />
          </Chapter>

          <Chapter id="register" eyebrow="Chapter 3" title="Add a lead in 60 seconds">
            <Step n="1" title="A lead is any business that could buy from us" body="Tap the button below. You only need six things: the business name, a website or something that identifies it (Instagram, street, landmark), who you spoke to, the industry, the problem you SAW with your own eyes, and where you found them." link={[`${APP}/leads?new=1`, "Add a lead"]} />
            <Step n="2" title="Write what you saw, not what you guess" body="Good: “Paper order book, three missed calls while I waited.” Weak: “Might need a website.” The closing team can only work with what you actually observed." />
            <Step n="3" title="Red warning? Stop." body="If the screen says the business is already in our records, it will show you who owns it and whether we've contacted them before. Never pitch a business another partner owns — hand it over instead." />
            <Step n="4" title="Missing details? Save a draft." body="A draft keeps the business yours while you go back for the rest. Your list lives here:" link={[`${APP}/leads`, "My leads"]} />
          </Chapter>

          <Chapter id="log" eyebrow="Chapter 4" title="Record your work in 30 seconds">
            <Step n="1" title="Open the business, tap one outcome" body="No answer, Replied, Interested, Meeting booked, Follow up later, Not interested. Then write the next step and its date — that part is required." link={[`${APP}/leads`, "My leads"]} />
            <Step n="2" title="No business sits still" body="Every lead must always have a next step with a date. If one goes overdue, the system reminds you — and then it tells your captain. Do it right after the call, from your phone, while it's fresh." />
          </Chapter>

          <Chapter id="followups" eyebrow="Chapter 5" title="Never miss a follow-up">
            <Step n="1" title="Work this list top-down" body="Overdue first, always. Each task opens its business with one tap." link={[`${APP}/tasks`, "My tasks"]} />
            <Step n="2" title="Tap Done the moment it's done" body="Don't save updates for the evening. Thirty seconds now keeps every record true." />
            <Step n="3" title="Stuck? Write what's blocking you" body="“Waiting on the MD, back Thursday” gives your captain something to unblock. Silence gives them nothing." />
          </Chapter>

          <Chapter id="meetings" eyebrow="Chapter 6" title="Meetings">
            <Step n="1" title="Prepare in five minutes" body="Re-read the business: the problem, the decision-maker, what happened last time. Grab the right demo from the campaigns page." link={[`${APP}/campaigns`, "Campaigns & offers"]} />
            <Step n="2" title="Record the outcome the same day" body="Open the meeting, tap Record outcome, write what was agreed and the next step with a date. A meeting without a recorded outcome counts for nothing." link={[`${APP}/meetings`, "My meetings"]} />
          </Chapter>

          <Chapter id="money" eyebrow="Chapter 7" title="Your pipeline & pay">
            <Step n="1" title="Real interest? Qualify it." body="Genuine problem, named decision-maker, some urgency — tap “Interested & qualify” on the business. It moves to the pipeline and the closing team takes over." link={[`${APP}/pipeline`, "Opportunities"]} />
            <Step n="2" title="You stay attached — and paid" body="The commission stays yours when the deal pays out. Watch it all here: what you've earned, what's waiting for approval, what's been paid. If a number looks wrong, ask your captain before payday, not after." link={[`${APP}/deals`, "My earnings"]} />
          </Chapter>

          <Chapter id="toolkit" eyebrow="Chapter 8" title="What to sell & where files live">
            <Step n="1" title="Check campaigns before you pitch" body="Current offers, who they're for, messages you can copy word-for-word, and the checklist for a good lead. Never invent prices — use what's approved here." link={[`${APP}/campaigns`, "Campaigns & offers"]} />
            <Step n="2" title="Files live in one shared place" body="Price lists, decks, playbooks — download anytime. When your captain shares something new, you get a notification." link={[`${APP}/files`, "Files & resources"]} />
            <Step n="3" title="Read your messages" body="Announcements, meeting notices and new files arrive as notifications (the bell, top right) and by email. They often change what you're selling that week." />
          </Chapter>

          <Chapter id="measured" eyebrow="Chapter 9" title="How you're measured">
            <Card className="rounded-xl"><CardContent className="px-5 py-4 text-sm">
              <p><strong>Quality beats volume.</strong> Flooding the system with weak businesses hurts your score — duplicates get filtered. What counts:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                <li>Good leads that get accepted — did your businesses hold up?</li>
                <li>Real conversations — replies and interest, not just dials.</li>
                <li>Meetings held and value created in the pipeline.</li>
                <li>Cash collected — the number that pays everyone.</li>
                <li>Keeping your promises — did you do what you said, when you said?</li>
                <li>Clean records — can the business trust your updates?</li>
              </ul>
            </CardContent></Card>
          </Chapter>

          <Chapter id="rules" eyebrow="Chapter 10" title="Rules of the road">
            <Step n="1" title="If it isn't written here, it didn't happen" body="WhatsApp is for coordinating. Ownership, updates, meeting results and money live in this system." />
            <Step n="2" title="One owner per business" body="Never work a business owned by someone else. Flag duplicates instead of adding them again." />
            <Step n="3" title="Your phone is your office" body="Everything here is built for phones — big buttons, minimal typing, under a minute. Log from the field." />
            <Step n="4" title="Ask early" body="Captain for stuck businesses, admin for access problems. Silence is the only real failure." />
          </Chapter>

          <Chapter id="faq" eyebrow="Chapter 11" title="Quick answers">
            <Card className="rounded-xl">
              <CardHeader><CardTitle className="font-display text-xl">FAQ</CardTitle></CardHeader>
              <CardContent className="space-y-2.5 px-6 pb-6 text-sm">
                {[
                  ["I can't sign in.", "Use “Forgot password?” on the sign-in screen. Still stuck? Your captain or admin will sort you out — accounts are created by them, never by you.", `${APP}/forgot-password`, "Reset password"],
                  ["My invite link expired.", "Links last 24 hours. Ask your captain for a fresh invite.", null, null],
                  ["The business says someone already contacted them.", "Stop pitching. The warning on the screen names the owner — hand the business over with a note.", `${APP}/leads`, "My leads"],
                  ["I added the wrong business.", "Write an honest note on it (“wrong entry — please reject”) and add the right one. Don't leave bad data behind.", null, null],
                  ["I'm leaving, or a business must move to someone else.", "Tell your captain. Transfers keep the FULL history — nothing is lost.", null, null],
                  ["When do I get paid?", "When the client's payment is confirmed, your commission is calculated automatically. Watch it here:", `${APP}/deals`, "My earnings"],
                ].map(([q, a, href, label]) => (
                  <div key={q as string} className="rounded-xl bg-foreground/5 px-4 py-3">
                    <p className="font-medium">{q}</p>
                    <p className="mt-0.5 text-muted-foreground">{a} {href && <a href={href as string} className="font-medium text-foreground underline underline-offset-4">{label}</a>}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </Chapter>

          <div className="flex flex-col items-center gap-3 rounded-2xl border border-foreground/10 bg-card p-8 text-center">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">The whole job, in one line</p>
            <p className="font-display text-3xl">Every lead has an owner. Every action has a next step.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild className="rounded-full bg-foreground text-background"><a href={`${APP}/leads?new=1`}>Add a lead</a></Button>
              <Button asChild variant="outline" className="rounded-full"><a href={`${APP}/guide/field-manual`}>Open the Field Guide</a></Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
