"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHead } from "@/components/crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-foreground/15 px-3 py-1.5 text-xs font-medium hover:bg-foreground hover:text-background"
      aria-label="Copy to clipboard"
    >
      {done ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
    </button>
  );
}

function Chapter({ id, n, title, children }: { id: string; n: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Chapter {n}</p>
      <h2 className="mt-1 font-display text-3xl tracking-tight">{title}</h2>
      <div className="mt-3 space-y-2.5 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-foreground/10 bg-card px-4 py-3">{children}</p>;
}

function Script({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-card px-4 py-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <CopyBtn text={body} />
      </div>
      <p className="whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-foreground/10">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead><tr className="border-b border-foreground/10 bg-foreground/5">
          {head.map((h) => <th key={h} className="px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{h}</th>)}
        </tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i} className="border-b border-foreground/10 last:border-0">
            {r.map((c, j) => <td key={j} className={`px-4 py-2.5 align-top ${j === 0 ? "font-medium" : "text-muted-foreground"}`}>{c}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

const CONTENTS: [string, string][] = [
  ["role", "1 · Your role"], ["looking", "2 · What you're looking for"], ["signals", "3 · Opportunity signals"],
  ["find", "4 · Where to find prospects"], ["research", "5 · How to research"], ["industries", "6 · Industry map"],
  ["audit", "7 · Five-minute audit"], ["workflow", "8 · Understanding the workflow"], ["outreach", "9 · Outreach principles"],
  ["email", "10 · Email templates"], ["social", "11 · WhatsApp & LinkedIn"], ["calling", "12 · Calling + call scripts"],
  ["discovery", "13 · Discovery"], ["qualify", "14 · Qualifying"], ["buying", "15 · Buying signals"],
  ["objections", "16 · Handling responses"], ["sending", "17 · Sending information"], ["followup", "18 · Follow-up"],
  ["crm", "19 · CRM discipline"], ["handoff", "20 · Handoff"], ["redflags", "21 · Red flags"],
  ["daily", "22 · Daily execution"], ["scorecard", "23 · Scorecard"], ["mindset", "24 · Think like a BDP"],
  ["standard", "25 · The standard"], ["quickref", "★ Quick reference"],
];

export default function FieldManualPage() {
  return (
    <div>
      <PageHead
        eyebrow="Mathenge Inc. · Internal playbook"
        title="BDP Field Guide"
        sub="Prospecting, outreach, qualification & sales playbook. Your permanent reference — the scripts, templates, tables and checklists live here. Find the problem. Start the conversation. Qualify the opportunity. Bring Mathenge in."
        action={<Button asChild variant="outline" className="rounded-full"><Link href="/guide">← Handbook</Link></Button>}
      />
      <div className="grid gap-8 lg:grid-cols-[250px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 max-h-[75vh] space-y-0.5 overflow-y-auto" aria-label="Field guide contents">
            {CONTENTS.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="block rounded-lg px-3 py-1.5 text-[13px] text-foreground/70 hover:bg-foreground/5 hover:text-foreground">{label}</a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-10">
          <Card className="rounded-xl border-foreground/20">
            <CardContent className="px-5 py-5">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Operating principle</p>
              <p className="mt-1 font-display text-2xl leading-snug">Find the problem. Understand the impact. Reach the right person. Start the conversation. Qualify the opportunity. Bring Mathenge in.</p>
              <p className="mt-3 text-sm text-muted-foreground">A BDP is not a generic salesperson and is not expected to be a software engineer. Your value is learning to see business problems before the business describes them as technology problems.</p>
            </CardContent>
          </Card>

          <Chapter id="role" n="1" title="Your role">
            <P>Mathenge Inc. builds technology that helps businesses operate, sell and scale: websites and digital experiences, custom software, CRM and sales systems, portals, e-commerce, payments, booking systems, RFQ and quotation systems, dashboards, AI and workflow automation, analytics, integrations, SEO and digital growth. Your role is to identify organisations where these capabilities could solve a meaningful problem. You own prospecting, research, decision-makers, outreach, follow-up, early discovery, qualification, CRM updates and handoff. Mathenge handles deeper technical discovery, architecture, scoping, pricing, proposals, negotiations, contracts and implementation.</P>
            <div className="rounded-xl border border-red-300 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">What you must never do</p>
              <p className="mt-1 text-[13px] text-red-700">Never invent a price, discount, capability, client relationship, result or delivery timeline. Never guarantee an integration before the technical team confirms it. Never claim industry experience that isn't true. Never make contractual commitments. When you don't know, say: “I don&apos;t want to give you an inaccurate answer. Let me confirm that with our technical team.” That is considerably better than improvising.</p>
            </div>
          </Chapter>

          <Chapter id="looking" n="2" title="What you are actually looking for">
            <P>Don&apos;t ask “who needs a website?” Ask: <strong>where is this company losing money, customers, time or information because of how it operates?</strong></P>
            <Table head={["Area", "What it looks like"]} rows={[
              ["Money", "Poor conversion, slow quotations, no payments, weak acquisition, missed upsells, abandoned enquiries, admin cost."],
              ["Customers", "Missed enquiries, slow response, no follow-up, hard booking, outdated site, weak Google visibility, no customer history."],
              ["Time", "Repetitive data entry, manual reports, repeated messages, copying between systems, manual quotes, scheduling, approvals."],
              ["Information", "Scattered spreadsheets, no dashboards, customer data across WhatsApp/email/Excel, no audit trail, no management visibility."],
            ]} />
            <P>The strongest opportunities combine several at once. A company pushing 300 WhatsApp enquiries into Excel doesn&apos;t have a “CRM prospect” — it has a sales, automation, reporting and experience problem simultaneously.</P>
          </Chapter>

          <Chapter id="signals" n="3" title="Opportunity signals">
            <P>Investigate when a business says: “WhatsApp us to order”, “email us for a quotation”, “call us to book”, “download this PDF”, “contact us for pricing”, “send documents by email”, “DM to order”. And when employees say: “Sarah normally handles that.” “It's in the spreadsheet.” “I'll check with accounts.” “Send it again on WhatsApp.” “We manually update it.” “Only the manager has access.” “We prepare the report at month end.” “Someone enters it into the other system.”</P>
            <P><strong>The Excel test</strong> — ask “what does the business still run through Excel?” Excel becomes an opportunity when forced to act as CRM, inventory, multi-user operations, booking, project management or reporting. Leads → CRM. Quotations → quotation automation. Inventory → order management. Customer records → CRM/portals. Reporting → dashboards.</P>
            <P><strong>The WhatsApp test</strong> — ask “what happens inside their WhatsApp that belongs in a proper system?” Orders, enquiries, approvals, quotations, bookings, support, documents, updates, lead assignment. The goal usually isn't removing WhatsApp — it's connecting it to the real workflow.</P>
          </Chapter>

          <Chapter id="find" n="4" title="Where to find prospects">
            <P><strong>Google Maps & Search</strong> — try: logistics companies Nairobi · manufacturers Kenya · real estate agencies Dubai · hotels Nairobi · construction companies UAE · freight forwarders Kenya · schools Dubai · tour operators Kenya · interior designers Dubai. Maps shows category, website, reviews, location, phone, photos. Don&apos;t stop at the listing — open the website.</P>
            <P><strong>LinkedIn</strong> — find the person: Founder, CEO, MD, GM, Operations, Commercial, Head of Sales, Marketing, IT, Digital Transformation, E-commerce. Match contact to problem: broken sales → Sales/Commercial; automation → Operations; acquisition → Marketing; company-wide → MD/CEO.</P>
            <P><strong>Websites</strong> — check Home, About, Services, Products, Contact, Shop, Book, Quote, Careers, Blog, socials. Behave like a customer: can you understand, enquire, buy, book, get a quotation? What happens after you submit? Does mobile work?</P>
            <P><strong>Social media</strong> — demand with poor conversion: price-asking comments, “DM us”, products buried in posts, engagement with no checkout, manual-looking enquiry handling.</P>
            <P><strong>Directories, associations, events</strong> — chambers, associations, trade-show exhibitor lists (exhibitors already invest in growth), sponsors, business parks, sector directories.</P>
          </Chapter>

          <Chapter id="research" n="5" title="How to research a prospect">
            <P>Cold prospecting shouldn&apos;t take an hour per company. Record: company (name, industry, city, site, scale) · contact (decision-maker, title, email, phone/WhatsApp, LinkedIn) · presence (site, Google, LinkedIn, Instagram, Facebook, TikTok) · observation (what exactly you noticed) · problem · impact (money/customers/time/information) · opportunity (solution category) · source · pipeline (status, last contact, next action).</P>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-[13px] text-red-700"><p className="font-medium text-red-800">Bad entry</p>ABC Logistics — might need website.</div>
              <div className="rounded-xl border border-green-700/30 bg-green-600/10 p-4 text-[13px]"><p className="font-medium text-green-800">Useful entry</p>ABC Logistics — freight quotations via a general enquiry form; likely unstructured RFQ/manual follow-up. Operations Director found on LinkedIn. RFQ/quotation workflow opportunity. Initial email not yet sent.</div>
            </div>
            <P>Before a meeting, go deeper: services, locations, leadership, customer types, competitors, current technology, digital channels — anything touching the problem.</P>
          </Chapter>

          <Chapter id="industries" n="6" title="Industry opportunity map">
            <P>Not exhaustive — follow the problem beyond these sectors.</P>
            <Table head={["Industry", "Look for", "Ask", "Opportunity"]} rows={[
              ["Logistics & Freight", "WhatsApp/email RFQs, generic forms, slow quotes, no portal, manual documents", "How are RFQs received? How long does quoting take? Where tracked? Re-entered?", "RFQ/quotation system, CRM, customer portal, notifications, dashboards, AI documents"],
              ["Manufacturing & Distribution", "WhatsApp orders, Excel inventory, PDF catalogues, phone dealer orders, no live reporting", "How do distributors order? Availability checks? Live sales visibility?", "Distributor portal, B2B ordering, inventory, CRM, quotations, dashboards, reorder automation"],
              ["Real Estate", "Leads scattered across portals/WhatsApp, manual assignment, stale listings, poor follow-up", "Where do leads go? Assigned how fast? Which source closes?", "CRM, property platform, lead routing, viewing booking, WhatsApp automation, analytics"],
              ["Hotels & Travel", "WhatsApp booking, OTA dependence, no deposits, outdated packages, slow replies", "% direct bookings? Online deposits? Enquiry tracking?", "Direct booking, payments, CRM, package CMS, automation, SEO, email, analytics"],
              ["Restaurants", "PDF menus, manual reservations, weak Google presence, no ordering/loyalty", "Reservations/orders handled how? Customer data kept? Direct order/book?", "Reservations, ordering, loyalty, CRM, Google optimisation, marketing"],
              ["Schools & Education", "PDF/email applications, manual admissions, scattered documents, weak parent comms", "Applications reviewed where? Documents stored? Applicant updates?", "Admissions portal, forms, payments, parent/student portals, notifications"],
              ["Clinics / Vets", "Call/WhatsApp booking, manual reminders, poor intake, weak site", "Booking/confirmation? Intake? Missed appointments?", "Booking, reminders, intake, CRM, website, SEO"],
              ["Construction", "Email RFQs, Excel tracking, manual approvals, scattered comms", "RFQs, quotes, approvals, client updates handled how?", "RFQ/quotation systems, project dashboards, client portals, approvals, documents"],
              ["Professional Services", "Email-heavy onboarding, no CRM, manual documents, repetitive admin", "What happens between enquiry and signed client? What's repeated manually?", "CRM, intake, client portals, document/workflow automation, AI knowledge tools"],
              ["Retail / E-commerce", "DM/WhatsApp ordering, no checkout, manual inventory/orders", "Social enquiries converted how? Orders recorded? Inventory updated?", "E-commerce, payments, inventory, order management, CRM, abandoned-cart automation"],
            ]} />
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-[13px] text-red-700"><span className="font-medium text-red-800">Healthcare caution: </span>never promise medical-record systems, compliance or sensitive-data handling without escalation. Same for any highly regulated industry.</div>
          </Chapter>

          <Chapter id="audit" n="7" title="The five-minute digital audit">
            <P>Can a customer immediately understand the company, find the product, trust it, complete the action, and do it on mobile? Then the conversion path: sellers — can someone buy? Bookers — can someone book? Services — can someone submit quotation-ready information? Check Google and socials: great engagement with a terrible conversion system is often worth more than a redesign. Identify commercial friction, not cosmetic complaints.</P>
          </Chapter>

          <Chapter id="workflow" n="8" title="Understanding the workflow">
            <P>Best discovery technique: <strong>“And then what happens?”</strong> Quotations on WhatsApp → receptionist gathers info → salesperson → Excel → calls warehouse → PDF quote → customer replies → Excel updated → accounts emailed. A “WhatsApp problem” is now a sales-and-operations opportunity. Understand the process before discussing the solution.</P>
          </Chapter>

          <Chapter id="outreach" n="9" title="Outreach principles">
            <P>Never lead with the catalogue (“we offer websites, AI, SEO… interested?”). Use <strong>Observation → Relevance → Question</strong>: “I noticed quotation requests go through your general contact form. I was curious how your team handles them once they arrive.” Personalisation must be genuine — specific observations beat compliments.</P>
          </Chapter>

          <Chapter id="email" n="10" title="Email templates">
            <Script title="General problem-based — Quick question about [Company]'s [process]" body={`Hi [Name],\n\nI was looking at [Company] and noticed [specific observation].\n\nI was curious how you're currently handling [process] once [event/customer action] happens.\n\nI'm with Mathenge Inc. We build business systems, software and digital solutions around processes like this, and I had an idea that may be relevant.\n\nWould it be useful if I sent you a short breakdown?\n\nBest,\n[Name]\nBusiness Development Partner\nMathenge Inc.`} />
            <Script title="RFQ / Quotation — Your quotation process" body={`Hi [Name],\n\nI noticed customers looking for [service/product] are currently directed to [email/contact form/WhatsApp].\n\nI was curious how your team handles those requests once they arrive.\n\nThere may be an opportunity to structure the process so the right information is collected upfront and quotations are easier to prepare, track and follow up.\n\nIf this is something your team is dealing with, I'd be happy to arrange a short conversation with Mathenge Inc.\n\nBest,\n[Name]`} />
            <Script title="Manual operations — Question about [process] at [Company]" body={`Hi [Name],\n\nI came across [Company] while researching businesses in [industry] and noticed [specific observation].\n\nI'm curious whether your team is still handling [process] manually or whether you already have a system behind it.\n\nMathenge Inc. builds software and automated workflows around processes like these, so I thought it was worth asking.\n\nWould you be open to a short conversation?\n\nBest,\n[Name]`} />
            <Script title="AI / Automation — Automating [specific process]" body={`Hi [Name],\n\nI noticed your team handles [specific process].\n\nIf a significant part of that involves repeatedly reading, copying, categorising, responding to or entering the same information, there may be an opportunity to automate part of it.\n\nMathenge Inc. builds AI and workflow automation around specific business processes.\n\nWould you be open to a short call to see whether there's anything worth improving here?\n\nBest,\n[Name]`} />
            <P>Avoid empty phrases like “revolutionize your business with cutting-edge AI.” Name the process.</P>
          </Chapter>

          <Chapter id="social" n="11" title="WhatsApp & LinkedIn">
            <Script title="WhatsApp — first contact" body={`Hi James, I'm [Name] from Mathenge Inc. I came across ABC Logistics while looking at freight companies in Nairobi. I noticed quotation requests currently go through the general contact channel and had an idea around making that process more structured. Who would be the best person to speak to about it?`} />
            <Script title="WhatsApp — direct decision-maker" body={`Hi Sarah, I'm [Name] from Mathenge Inc. I was looking at [Company] and noticed [specific issue]. We work on software, automation and digital systems for businesses, and I think there may be a straightforward opportunity here. Can I send you the idea?`} />
            <Script title="LinkedIn" body={`Hi David, I came across [Company] while researching [industry]. I noticed [specific observation] and had an idea around improving [process]. I'm with Mathenge Inc. Mind if I send you the short version?`} />
            <P>Shorter than email. Never open with a massive pitch — earn the next message.</P>
          </Chapter>

          <Chapter id="calling" n="12" title="Calling + call scripts">
            <Script title="Opener (under 20 seconds, then STOP)" body={`Hi James, I'm [Name] from Mathenge Inc. I'll keep this brief. I was looking at [Company] and noticed [observation]. I wanted to understand how you're currently handling [process].\n\n[Stop. Let them answer.]`} />
            <Script title="Gatekeeper / reception" body={`Hi, perhaps you can point me in the right direction. Who handles your digital systems or operations?\n\nOr, specific: Who would be the best person to speak to about your customer quotation process?\n\n[Get a NAME, not info@company.com. Then ask the best way to reach them.]`} />
            <Script title="Voicemail (20 seconds max)" body={`Hi [Name], it's [Your Name] from Mathenge Inc. I was looking at [Company] and noticed [one-line observation] — I had a quick idea around [process]. I'll also send it by email so you have it in writing. My number is [number]. Thanks!`} />
            <Script title="Follow-up call" body={`Hi [Name], it's [Your Name] from Mathenge Inc. — I sent you a note about [specific issue] last week. Do you have 30 seconds? I just wanted to check whether [problem] is something on your radar right now, or already solved.`} />
            <Script title="Meeting confirmation call" body={`Hi [Name], confirming we're still good for [day, time]. I'll bring [one relevant thing]. It'll take [15/30] minutes and you'll leave with [specific value]. Is there anyone else who should join?`} />
            <P>Never open with a 30-second corporate introduction. Ask, then listen. For technical questions you can't answer: “I'm not certain and don't want to give you the wrong answer. Let me confirm with the technical team.”</P>
          </Chapter>

          <Chapter id="discovery" n="13" title="Discovery">
            <P>Goal: understand, not impress. How do you handle this today? Who owns it? How often? Where is the information stored? What happens when something is missed? How long does it take? What have you tried? Biggest frustration? Who approves change? Is it a priority now? What would ideal look like? When should it improve? Don&apos;t machine-gun them — follow the conversation, and keep returning to “and then what happens?”</P>
          </Chapter>

          <Chapter id="qualify" n="14" title="Qualifying a lead">
            <Table head={["Area", "What you need"]} rows={[
              ["Problem", "Something genuinely wrong or inefficient"],
              ["Impact", "Affects money, customers, time, information or risk"],
              ["Current process", "How it's handled today"],
              ["Desired result", "What better looks like"],
              ["Urgency", "Why change now?"],
              ["Authority", "Who approves?"],
              ["Budget reality", "Can they invest?"],
              ["Timeline", "When could it realistically happen?"],
            ]} />
            <Table head={["Priority", "Meaning"]} rows={[
              ["Hot", "Real problem, real impact, decision-maker in, wants action, plausible timeline. Escalate immediately."],
              ["Warm", "Genuine problem + interest, but timing/budget/authority unclear. Nurture."],
              ["Cold", "Possible fit, no confirmed priority or engagement. Follow up appropriately."],
              ["Poor fit", "No real need, unrealistic expectations, can't invest, no path to decision-maker. Don't over-invest."],
            ]} />
          </Chapter>

          <Chapter id="buying" n="15" title="Buying signals">
            <P>“Can you integrate with our system?” · “How long would this take?” · “Can you send a proposal?” · “Could you demonstrate something?” · “Who have you done this for?” · “What would this cost?” · “Can you meet my partner/director?” — curiosity is turning into evaluation. Bring Mathenge in; don&apos;t play technical consultant.</P>
          </Chapter>

          <Chapter id="objections" n="16" title="Handling common responses">
            <Table head={["They say", "You say"]} rows={[
              ["How much?", "It depends on what needs building and integrating — I don't want to give an inaccurate figure before our team understands it. Let me arrange a short discovery call to scope it."],
              ["We already have a website.", "Absolutely — not necessarily replacing it. What I noticed was [problem]. How are you handling that today?"],
              ["We have IT / a team.", "Completely fine — we work alongside existing teams. Is [problem] already solved internally?"],
              ["We use Zoho / Odoo / Salesforce / SAP.", "Understood. Are there still processes outside it running on Excel, WhatsApp or email?"],
              ["Send me information.", "Absolutely — which matters more right now, [A] or [B]? I'll send what's most useful."],
              ["Not interested.", "Respect it. Is the issue already solved, or just not a priority? (Never argue.)"],
              ["[Technical question]", "I'm not certain and don't want to give the wrong answer. Let me confirm with the technical team."],
            ]} />
          </Chapter>

          <Chapter id="sending" n="17" title="Sending information">
            <P>When asked for “company profile/information”, first learn what they care about. Useful resources — website mathengeinc.com · portfolio mathengeinc.com/Portfolio · meeting calendly.com/mathengeinc/new-meeting · email info@mathengeinc.com. Send only what moves this conversation forward.</P>
          </Chapter>

          <Chapter id="followup" n="18" title="Follow-up sequence">
            <Script title="Day 0 — initial outreach" body={`[Your first personalised email / WhatsApp from the templates above.]`} />
            <Script title="~Day 3 — short nudge" body={`Hi [Name], just following up on my note about [specific issue]. Happy to send the idea in writing if that's easier.`} />
            <Script title="~Day 7 — add value, don't nag" body={`Hi [Name], I took another look at the process and there are actually two areas I'd suggest considering: [X] and [Y]. If useful, I can have our team walk you through them.`} />
            <Script title="~Day 14 — close the loop" body={`Hi [Name], I'll close the loop on this for now rather than keep chasing you. If improving [problem] becomes a priority, I'm happy to reconnect.`} />
            <P>Then stop unless there's a legitimate reason to reconnect. Persistent ≠ annoying.</P>
          </Chapter>

          <Chapter id="crm" n="19" title="CRM discipline">
            <P>If it isn't recorded, Mathenge can't act on it. Every active lead must let anyone understand: who is this? What's the problem? Who have we spoken to? What happened? What's next? Keep contacts, source, observation, opportunity, communications, qualification, stage, next action and date current. Suggested pipeline: Qualification → Needs Analysis → Value Proposition → Identify Decision Makers → Proposal/Price Quote → Negotiation/Review → Closed Won / Lost. Never leave leads sitting without a next action.</P>
          </Chapter>

          <Chapter id="handoff" n="20" title="Handoff to Mathenge">
            <Script title="Useful handoff (copy + fill)" body={`Company: [ABC Logistics]\nContact: [Jane Doe, Operations Director]\nProblem: [RFQs via general email + WhatsApp; missing shipment info gathered manually; quotes tracked in Excel]\nImpact: [Quotes take 1–2 days; follow-up inconsistent]\nCurrent systems: [Email, WhatsApp, Excel]\nInterest: [Wants to know if RFQ/quotation can be centralised]\nDecision: [Jane involves the MD if the initial solution makes sense]\nTimeline: [Wants improvement this quarter]\nNext step: [Discovery meeting Thursday, 11:00 AM]`} />
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-[13px] text-red-700"><span className="font-medium text-red-800">Useless handoff: </span>“ABC Logistics interested in software. Please call them.”</div>
          </Chapter>

          <Chapter id="redflags" n="21" title="Red flags">
            <P>Extensive unpaid speculative work · refuses discovery · unrealistic guarantees · constantly shifting requirements · unauthorised discounts · “copy this product exactly” · unethical/illegal asks · third-party confidential data · decision-maker permanently absent · major work before signing. Escalate unusual commercial, legal, security, financial or regulatory demands. Your job is better opportunities, not more deals.</P>
          </Chapter>

          <Chapter id="daily" n="22" title="Daily execution">
            <P>Work systematically: new-company research, decision-maker identification, personalised first outreach, follow-ups, CRM updates, industry learning. Illustrative target: 10 researched businesses, 5 suitable prospects, 5 personalised contacts — not 100 generic emails. Quality is not an excuse for inactivity: consistent volume × relevance.</P>
          </Chapter>

          <Chapter id="scorecard" n="23" title="Performance scorecard">
            <Table head={["Metric", "Why it matters"]} rows={[
              ["Companies researched", "Prospecting activity"], ["Decision-makers identified", "Research quality"],
              ["First contacts", "Outreach volume"], ["Replies", "Message effectiveness"], ["Positive replies", "Opportunity creation"],
              ["Discovery conversations", "Engagement"], ["Qualified opportunities", "Commercial quality"], ["Meetings booked", "Progression"],
              ["Proposals", "Serious pipeline"], ["Deals won", "Conversion"], ["Revenue generated", "Business impact"], ["Commission earned", "Partner outcome"],
            ]} />
            <P>Watch reply rate, positive-reply rate, qualification rate, meeting rate, proposal-to-close rate, average deal value. 100 contacts → 2 replies: fix targeting or messaging. 30 replies → 0 qualified: wrong problem. Meetings → no proposals: qualification or discovery needs work. Numbers diagnose; they aren't the job.</P>
          </Chapter>

          <Chapter id="mindset" n="24" title="How to think like a BDP">
            <P>Hotel: how are direct reservations handled? Quotation form: what happens after this? “DM to order”: where is it recorded? PDF catalogue: how do dealers actually order? “WhatsApp the manager”: why does the process depend on one person's phone? Monthly report: where's the data from — why isn't it a dashboard? Form submission: where does it go? “Let me check the spreadsheet”: what else depends on that spreadsheet? See operations everywhere.</P>
          </Chapter>

          <Chapter id="standard" n="25" title="The standard">
            <Card className="rounded-xl"><CardContent className="space-y-2 px-5 py-4 text-sm">
              <p><strong>Before contacting a prospect, say:</strong> I know who they are. I know what I noticed. I understand why it might matter. I know who to contact. I know what question I&apos;m asking.</p>
              <p><strong>Before handing to Mathenge, say:</strong> I understand the problem, current process, likely impact, people involved and next step. You don&apos;t need to know what we&apos;ll build — that&apos;s the technical team&apos;s job. The BDP finds the opening. Mathenge turns it into a solution.</p>
              <p className="font-display text-xl">Businesses don&apos;t wake up wanting custom software. They think: “We&apos;re losing enquiries.” “Quotations take too long.” “Nobody knows what's happening.” “Too much manual work.” “Everything is in Excel.” Those are your conversations. Don&apos;t sell technology — find an expensive problem worth solving.</p>
            </CardContent></Card>
          </Chapter>

          <Chapter id="quickref" n="★" title="Quick reference — copy & go">
            <P>Everything below is copy-ready for the field. Open this chapter on your phone before a prospecting session.</P>
            <Script title="5-minute audit checklist" body={`1. Understand offer in 5 seconds?\n2. Find the product/service fast?\n3. Trust signals (reviews, clients, contact)?\n4. Complete the action (buy/book/quote)?\n5. Works on mobile?\n6. What happens after submit?\n7. Google + socials: engagement vs conversion gap?`} />
            <Script title="Objection one-liners" body={`Price → "Depends on scope — let me arrange a short discovery call so we quote accurately."\nHave website → "Not replacing it — how are you handling [problem] today?"\nHave IT → "We work alongside teams — is [problem] solved internally?"\nHave ERP/CRM → "What still runs outside it on Excel/WhatsApp/email?"\nSend info → "Which matters more, [A] or [B]? I'll send what's useful."\nNot interested → "Solved already, or just not a priority?" (respect it)\nDon't know → "I don't want to give you an inaccurate answer — let me confirm with our technical team."`} />
            <Script title="Daily session checklist" body={`[ ] 10 businesses researched\n[ ] Decision-makers identified\n[ ] 5 personalised first contacts sent\n[ ] All follow-ups actioned\n[ ] CRM updated same-day\n[ ] 1 industry thing learned`} />
          </Chapter>

          <Card className="rounded-xl">
            <CardHeader><CardTitle className="font-display text-2xl">Mathenge Inc.</CardTitle></CardHeader>
            <CardContent className="space-y-1 px-6 pb-6 text-sm text-muted-foreground">
              <p>info@mathengeinc.com · Dubai Digital Park, Building A5 · mathengeinc.com</p>
              <p>Portfolio: mathengeinc.com/Portfolio · Book a meeting: calendly.com/mathengeinc/new-meeting</p>
              <p className="font-display text-xl text-foreground">Build Tomorrow, Today.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
