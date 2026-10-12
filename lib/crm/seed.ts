import type {
  AuditEntry, Campaign, Cohort, Commission, Company, Contact, CrmTask,
  Deal, Lead, Meeting, Member, Notification, Opportunity, Payment, Activity, Proposal,
} from "./types";

const d = (daysOffset: number, h = 9) => {
  const t = new Date();
  t.setDate(t.getDate() + daysOffset);
  t.setHours(h, 0, 0, 0);
  return t.toISOString();
};

export const seedCohorts: Cohort[] = [
  { id: "co-2026-q1", name: "Cohort 7 — Q1 2026", description: "SME growth & retail distribution intake", startDate: "2026-01-12", active: true },
  { id: "co-2025-q4", name: "Cohort 6 — Q4 2025", description: "Hospitality, logistics & professional services", startDate: "2025-10-06", active: true },
];

export const seedSquads = [
  { id: "sq-mamba", name: "Mamba Squad", cohortId: "co-2026-q1", captainId: "u-captain-1", industry: "Distribution & Retail", target: 40 },
  { id: "sq-zawadi", name: "Zawadi Squad", cohortId: "co-2026-q1", captainId: "u-captain-2", industry: "Hospitality & F&B", target: 35 },
  { id: "sq-jumuiya", name: "Jumuiya Squad", cohortId: "co-2025-q4", captainId: "u-captain-3", industry: "Logistics & Services", target: 30 },
];

export const seedMembers: Member[] = [
  { id: "u-owner", name: "Founder (You)", email: "founder@mathengeinc.com", role: "owner", squadId: null, cohortId: "co-2026-q1", status: "active", joinedAt: "2024-01-02", lastActiveAt: new Date().toISOString(), commissionRate: 0 },
  { id: "u-admin", name: "Programme Admin", email: "admin@mathengeinc.com", role: "admin", squadId: null, cohortId: "co-2026-q1", status: "active", joinedAt: "2024-06-01", lastActiveAt: d(0, 8), commissionRate: 0 },
  { id: "u-stacy", name: "Stacy — Marketing Lead", email: "stacy@mathengeinc.com", role: "admin", squadId: null, cohortId: "co-2026-q1", status: "active", joinedAt: "2024-09-01", lastActiveAt: d(-1, 10), commissionRate: 0 },
  { id: "u-captain-1", name: "Brian M. — Captain", email: "brian@mathengeinc.com", role: "captain", squadId: "sq-mamba", cohortId: "co-2026-q1", status: "active", joinedAt: "2025-02-01", lastActiveAt: d(0, 9), commissionRate: 0.05 },
  { id: "u-captain-2", name: "Wanjiru K. — Captain", email: "wanjiru@mathengeinc.com", role: "captain", squadId: "sq-zawadi", cohortId: "co-2026-q1", status: "active", joinedAt: "2025-03-01", lastActiveAt: d(-1, 14), commissionRate: 0.05 },
  { id: "u-captain-3", name: "Otieno O. — Captain", email: "otieno@mathengeinc.com", role: "captain", squadId: "sq-jumuiya", cohortId: "co-2025-q4", status: "active", joinedAt: "2025-05-01", lastActiveAt: d(-3, 11), commissionRate: 0.05 },
  { id: "u-bdp-1", name: "Amina N.", email: "amina@bdp.mathengeinc.com", role: "bdp", squadId: "sq-mamba", cohortId: "co-2026-q1", status: "active", joinedAt: "2026-01-12", lastActiveAt: d(0, 10), commissionRate: 0.1 },
  { id: "u-bdp-2", name: "Kevin O.", email: "kevin@bdp.mathengeinc.com", role: "bdp", squadId: "sq-mamba", cohortId: "co-2026-q1", status: "active", joinedAt: "2026-01-12", lastActiveAt: d(-1, 9), commissionRate: 0.1 },
  { id: "u-bdp-3", name: "Faith W.", email: "faith@bdp.mathengeinc.com", role: "bdp", squadId: "sq-zawadi", cohortId: "co-2026-q1", status: "active", joinedAt: "2026-01-12", lastActiveAt: d(-2, 9), commissionRate: 0.1 },
  { id: "u-bdp-4", name: "Dennis K.", email: "dennis@bdp.mathengeinc.com", role: "bdp", squadId: "sq-zawadi", cohortId: "co-2026-q1", status: "inactive", joinedAt: "2026-01-12", lastActiveAt: d(-12, 9), commissionRate: 0.1 },
  { id: "u-bdp-5", name: "Sharon A.", email: "sharon@bdp.mathengeinc.com", role: "bdp", squadId: "sq-jumuiya", cohortId: "co-2025-q4", status: "onboarding", joinedAt: "2026-02-02", lastActiveAt: d(-1, 12), commissionRate: 0.1 },
  { id: "u-sales-1", name: "Closing — David M.", email: "david@mathengeinc.com", role: "sales", squadId: null, cohortId: "co-2026-q1", status: "active", joinedAt: "2025-01-10", lastActiveAt: d(0, 9), commissionRate: 0.04 },
  { id: "u-sales-2", name: "Closing — Lucy N.", email: "lucy@mathengeinc.com", role: "sales", squadId: null, cohortId: "co-2026-q1", status: "active", joinedAt: "2025-04-10", lastActiveAt: d(-1, 9), commissionRate: 0.04 },
];

export const seedCompanies: Company[] = [
  { id: "co-abc", name: "ABC Distributors Ltd", website: "abcdistributors.co.ke", email: "sales@abcdistributors.co.ke", phone: "+254722000111", industry: "Distribution", size: "50–200", location: "Nairobi, Industrial Area", priorContact: false },
  { id: "co-sweven", name: "Sweven Café Group", website: "sweven.co.ke", email: "ops@sweven.co.ke", phone: "+254733111222", industry: "Hospitality", size: "11–50", location: "Nairobi, Westlands", priorContact: true, priorOutcome: "Discovery call held Sep 2025 — paused, no budget" },
  { id: "co-prime", name: "Prime Variable Covers", website: "primevariablecovers.com", email: "info@primevariablecovers.com", phone: "+254720333444", industry: "Manufacturing", size: "50–200", location: "Athi River", isClient: false },
  { id: "co-velvet", name: "Velvet Trails Safaris", website: "velvettrails.co.ke", email: "hello@velvettrails.co.ke", phone: "+254711555666", industry: "Travel", size: "11–50", location: "Nairobi, Karen" },
  { id: "co-furaha", name: "Furaha Foods", website: "furahafoods.co.ke", email: "trade@furahafoods.co.ke", phone: "+254700777888", industry: "F&B Distribution", size: "50–200", location: "Thika" },
  { id: "co-savannah", name: "Savannah Logistics EA", website: "savannahlogistics.co.ke", email: "ops@savannahlogistics.co.ke", phone: "+254722999000", industry: "Logistics", size: "200+", location: "Mombasa Road" },
  { id: "co-elimu", name: "ElimuX Advisory", website: "elimux.co.ke", email: "admissions@elimux.co.ke", phone: "+254799121212", industry: "Education", size: "11–50", location: "Nairobi, Kilimani", isClient: true },
  { id: "co-whitewave", name: "White Wave Trading", website: "whitewavetoc.com", email: "sales@whitewavetoc.com", phone: "+254734343434", industry: "Wholesale", size: "11–50", location: "Nairobi, Eastleigh" },
];

export const seedContacts: Contact[] = [
  { id: "ct-1", companyId: "co-abc", name: "George Mwangi", role: "Operations Director", email: "gmwangi@abcdistributors.co.ke", phone: "+254722000111", decisionMaker: true },
  { id: "ct-2", companyId: "co-abc", name: "Susan Achieng", role: "Procurement", email: "susan@abcdistributors.co.ke", decisionMaker: false },
  { id: "ct-3", companyId: "co-sweven", name: "Daniel K.", role: "Founder", email: "daniel@sweven.co.ke", decisionMaker: true },
  { id: "ct-4", companyId: "co-prime", name: "Jane Nyambura", role: "MD", email: "jane@primevariablecovers.com", decisionMaker: true },
  { id: "ct-5", companyId: "co-velvet", name: "Laura M.", role: "Reservations Lead", email: "laura@velvettrails.co.ke", decisionMaker: false },
  { id: "ct-6", companyId: "co-savannah", name: "Peter O.", role: "COO", email: "peter@savannahlogistics.co.ke", decisionMaker: true },
];

export const seedLeads: Lead[] = [
  { id: "ld-1001", companyId: "co-abc", ownerId: "u-bdp-1", squadId: "sq-mamba", status: "contacting", source: "Field visit — Industrial Area", observedProblem: "Manual stock sheets; no online ordering", valuePotential: 1800000, urgency: "high", decisionMakerName: "George Mwangi", evidence: "Photo of paper ledger; 14 delivery vans observed", lastActivityAt: d(-1, 15), nextAction: "Follow up with George — share distribution case study", nextDueAt: d(-1, 17), createdAt: d(-9, 10) },
  { id: "ld-1002", companyId: "co-sweven", ownerId: "u-bdp-3", squadId: "sq-zawadi", status: "meeting_booked", source: "Campaign: Hospitality growth", observedProblem: "No online reservations; Instagram-only orders", valuePotential: 950000, urgency: "medium", decisionMakerName: "Daniel K.", evidence: "Prior discovery Sep 2025; re-engaged via new menu feature", lastActivityAt: d(0, 9), nextAction: "Discovery meeting — demo reservations flow", nextDueAt: d(1, 10), createdAt: d(-14, 11) },
  { id: "ld-1003", companyId: "co-prime", ownerId: "u-bdp-2", squadId: "sq-mamba", status: "qualified", source: "BDP referral", observedProblem: "Quote follow-ups slow; loses aquaculture tenders", valuePotential: 2400000, urgency: "high", decisionMakerName: "Jane Nyambura", evidence: "Tender docs shared; decision in 30 days", lastActivityAt: d(-2, 12), nextAction: "Hand over to closing team for discovery", nextDueAt: d(1, 12), createdAt: d(-12, 9) },
  { id: "ld-1004", companyId: "co-velvet", ownerId: "u-bdp-3", squadId: "sq-zawadi", status: "new", source: "Event — Tourism expo", observedProblem: "Concierge requests handled over phone only", valuePotential: 1200000, urgency: "medium", evidence: "Booth conversation; brochure collected", lastActivityAt: d(-3, 10), nextAction: "First outreach call + WhatsApp intro", nextDueAt: d(0, 14), createdAt: d(-4, 10) },
  { id: "ld-1005", companyId: "co-furaha", ownerId: "u-bdp-1", squadId: "sq-mamba", status: "under_review", source: "Lead database — enrichment queue", observedProblem: "Distributor onboarding is paper-based", valuePotential: 1500000, urgency: "medium", evidence: "Enriched record: 40 SKUs, 200+ outlets", lastActivityAt: d(-1, 8), nextAction: "Admin review — confirm no duplicate", nextDueAt: d(1, 9), createdAt: d(-1, 8) },
  { id: "ld-1006", companyId: "co-savannah", ownerId: "u-bdp-5", squadId: "sq-jumuiya", status: "proposal", source: "Inbound — website", observedProblem: "Client tracking portal outdated", valuePotential: 3200000, urgency: "high", decisionMakerName: "Peter O.", evidence: "RFP received; 3 vendors shortlisted", lastActivityAt: d(-1, 11), nextAction: "Proposal follow-up — confirm board date", nextDueAt: d(2, 10), createdAt: d(-20, 9) },
  { id: "ld-1007", companyId: "co-whitewave", ownerId: "u-bdp-2", squadId: "sq-mamba", status: "contacting", source: "Field visit — Eastleigh", observedProblem: "Wholesale price lists shared as PDFs on WhatsApp", valuePotential: 800000, urgency: "low", evidence: "WhatsApp catalogue screenshots", lastActivityAt: d(-8, 10), nextAction: "Re-engage — share TUQO-style catalogue demo", nextDueAt: d(-5, 10), createdAt: d(-16, 10) },
  { id: "ld-1008", companyId: "co-elimu", ownerId: "u-bdp-1", squadId: "sq-mamba", status: "won", source: "Existing client expansion", observedProblem: "Parent portal needed for admissions tracking", valuePotential: 1100000, urgency: "medium", decisionMakerName: "Admissions Head", evidence: "Signed SOW", lastActivityAt: d(-6, 14), nextAction: "Delivery handover complete", nextDueAt: d(-6, 14), createdAt: d(-40, 9) },
];

export const seedOpportunities: Opportunity[] = [
  { id: "op-2001", leadId: "ld-1003", companyId: "co-prime", ownerId: "u-sales-1", bdpId: "u-bdp-2", stage: "discovery", value: 2400000, expectedClose: d(21, 12), problem: "Quote follow-ups slow; tender leakage", decisionMaker: "Jane Nyambura (MD)", qualificationNotes: "Budget confirmed; decision in 30 days; IT contact identified", createdAt: d(-6, 10), updatedAt: d(-1, 12) },
  { id: "op-2002", leadId: "ld-1002", companyId: "co-sweven", ownerId: "u-sales-2", bdpId: "u-bdp-3", stage: "meeting_booked", value: 950000, expectedClose: d(14, 12), problem: "Reservations fragmented across channels", decisionMaker: "Daniel K. (Founder)", qualificationNotes: "2 venues; wants online deposits", createdAt: d(-5, 10), updatedAt: d(0, 9) },
  { id: "op-2003", leadId: "ld-1006", companyId: "co-savannah", ownerId: "u-sales-1", bdpId: "u-bdp-5", stage: "proposal", value: 3200000, expectedClose: d(10, 12), problem: "Client tracking portal outdated", decisionMaker: "Peter O. (COO)", qualificationNotes: "RFP shortlist of 3; board meets in 2 weeks", stalledSince: d(-9, 9), createdAt: d(-18, 9), updatedAt: d(-9, 9) },
  { id: "op-2004", leadId: "ld-1008", companyId: "co-elimu", ownerId: "u-sales-1", bdpId: "u-bdp-1", stage: "won", value: 1100000, expectedClose: d(-6, 12), problem: "Parent portal for admissions", decisionMaker: "Admissions Head", qualificationNotes: "Expansion of existing engagement", createdAt: d(-38, 9), updatedAt: d(-6, 14) },
  { id: "op-2005", leadId: "ld-1001", companyId: "co-abc", ownerId: "u-sales-2", bdpId: "u-bdp-1", stage: "qualified", value: 1800000, expectedClose: d(28, 12), problem: "Manual stock sheets", decisionMaker: "George Mwangi", qualificationNotes: "Interested; needs case study + site visit", createdAt: d(-2, 10), updatedAt: d(-1, 15) },
];

export const seedTasks: CrmTask[] = [
  { id: "t-1", leadId: "ld-1001", companyId: "co-abc", ownerId: "u-bdp-1", title: "Follow up with ABC Distributors — share case study", dueAt: d(-1, 17), status: "open", createdAt: d(-3, 9) },
  { id: "t-2", leadId: "ld-1002", companyId: "co-sweven", ownerId: "u-bdp-3", title: "Prepare for discovery meeting (demo + questions)", dueAt: d(1, 9), status: "open", createdAt: d(-1, 9) },
  { id: "t-3", leadId: "ld-1007", companyId: "co-whitewave", ownerId: "u-bdp-2", title: "Re-engage White Wave — catalogue demo", dueAt: d(-5, 10), status: "open", createdAt: d(-10, 9) },
  { id: "t-4", leadId: "ld-1003", companyId: "co-prime", ownerId: "u-sales-1", title: "Run discovery — decision criteria + budget", dueAt: d(1, 12), status: "open", createdAt: d(-2, 10) },
  { id: "t-5", leadId: "ld-1006", companyId: "co-savannah", ownerId: "u-sales-1", title: "Proposal follow-up — confirm board date", dueAt: d(2, 10), status: "open", createdAt: d(-4, 10) },
  { id: "t-6", leadId: "ld-1004", companyId: "co-velvet", ownerId: "u-bdp-3", title: "First outreach call — Velvet Trails", dueAt: d(0, 14), status: "open", createdAt: d(-4, 10) },
];

export const seedMeetings: Meeting[] = [
  { id: "m-1", opportunityId: "op-2002", leadId: "ld-1002", companyId: "co-sweven", date: d(1, 10), attendees: ["Daniel K.", "Faith W.", "Lucy N."], outcome: "pending", notes: "Discovery: reservations flow + deposits.", nextAction: "Send proposal draft within 48h of meeting" },
  { id: "m-2", opportunityId: "op-2001", leadId: "ld-1003", companyId: "co-prime", date: d(2, 11), attendees: ["Jane Nyambura", "David M.", "Kevin O."], outcome: "pending", notes: "Discovery: tender workflow + approvals.", nextAction: "Record outcome + next step after meeting" },
  { id: "m-3", opportunityId: "op-2003", leadId: "ld-1006", companyId: "co-savannah", date: d(-9, 10), attendees: ["Peter O.", "David M."], outcome: "held", notes: "Proposal walkthrough; board decision pending.", nextAction: "Chase board date" },
];

export const seedProposals: Proposal[] = [
  { id: "p-1", opportunityId: "op-2003", companyId: "co-savannah", value: 3200000, sentAt: d(-9, 11), revisions: 2, status: "sent", openDecisions: "Board approval; hosting location" },
];

export const seedDeals: Deal[] = [
  { id: "dl-1", opportunityId: "op-2004", companyId: "co-elimu", contractValue: 1100000, signedAt: d(-6, 14), milestones: [{ label: "Deposit", amount: 400000, due: d(-6, 0).slice(0, 10), collected: true }, { label: "Launch", amount: 400000, due: d(14, 0).slice(0, 10), collected: false }, { label: "Handover", amount: 300000, due: d(30, 0).slice(0, 10), collected: false }], collected: 400000, handover: ["Kickoff scheduled", "Scope doc signed", "Delivery owner assigned"], outcome: "won" },
];

export const seedPayments: Payment[] = [
  { id: "pay-1", dealId: "dl-1", amount: 400000, receivedAt: d(-5, 10), method: "Bank transfer", verified: true },
];

export const seedCommissions: Commission[] = [
  { id: "cm-1", dealId: "dl-1", bdpId: "u-bdp-1", rate: 0.1, eligibleRevenue: 400000, earned: 40000, status: "approved", history: [{ at: d(-5, 11), by: "system", action: "Calculated on verified payment" }, { at: d(-4, 10), by: "u-owner", action: "Approved" }] },
];

export const seedActivities: Activity[] = [
  { id: "a-1", leadId: "ld-1001", companyId: "co-abc", actorId: "u-bdp-1", kind: "visit", summary: "Site visit — met George, saw paper ledgers", outcome: "Interested", createdAt: d(-3, 14) },
  { id: "a-2", leadId: "ld-1001", companyId: "co-abc", actorId: "u-bdp-1", kind: "email", summary: "Sent distribution case study", createdAt: d(-1, 15) },
  { id: "a-3", leadId: "ld-1003", companyId: "co-prime", actorId: "u-captain-1", kind: "status", summary: "Qualification reviewed — accepted, handed to sales", createdAt: d(-2, 12) },
  { id: "a-4", leadId: "ld-1006", companyId: "co-savannah", actorId: "u-sales-1", kind: "meeting", summary: "Proposal walkthrough held", outcome: "Proposal sent", createdAt: d(-9, 11) },
  { id: "a-5", leadId: "ld-1002", companyId: "co-sweven", actorId: "u-bdp-3", kind: "call", summary: "Re-engagement call — booked discovery", outcome: "Meeting booked", createdAt: d(0, 9) },
];

export const seedCampaigns: Campaign[] = [
  {
    id: "camp-q1", name: "Q1 Growth Sprint — Ordering & Reservations", industry: "Distribution, Hospitality, F&B",
    icp: "11–200 staff, owner-led, manual ordering or bookings, active on WhatsApp/Instagram, Nairobi + Mombasa",
    offers: ["Ordering & catalogue portal", "Reservations + deposits", "Tender & quote tracker"],
    templates: [
      { name: "First WhatsApp intro", body: "Hi {name}, we help distributors like {company} replace paper ledgers with simple online ordering. 15-min demo this week?" },
      { name: "Follow-up nudge", body: "Quick one {name} — sharing how a Nairobi distributor cut order errors in 3 weeks. Worth a look?" },
      { name: "Meeting confirm", body: "Confirmed: {date} with {attendee}. Agenda: current process, demo, next steps. Reply YES to lock in." },
    ],
    checklist: ["Confirm decision-maker", "Capture observed problem + photo", "Note urgency + timeline", "Log next action + date"],
    resources: [
      { title: "Distribution case study (PDF)", kind: "Case study", url: "#" },
      { title: "Reservations demo video", kind: "Video", url: "#" },
      { title: "Qualification one-pager", kind: "Guide", url: "#" },
      { title: "Objection handling sheet", kind: "Guide", url: "#" },
    ],
    targets: [{ squadId: "sq-mamba", leads: 40, meetings: 12 }, { squadId: "sq-zawadi", leads: 35, meetings: 10 }, { squadId: "sq-jumuiya", leads: 30, meetings: 8 }],
    active: true,
  },
];

export const seedAudit: AuditEntry[] = [
  { id: "au-1", at: d(-5, 11), actorId: "system", action: "Commission calculated", entity: "commission", entityId: "cm-1", detail: "KES 40,000 on verified KES 400,000 (10%)" },
  { id: "au-2", at: d(-4, 10), actorId: "u-owner", action: "Commission approved", entity: "commission", entityId: "cm-1", detail: "Approved for payout" },
  { id: "au-3", at: d(-2, 12), actorId: "u-captain-1", action: "Lead qualified", entity: "lead", entityId: "ld-1003", detail: "Accepted + assigned to sales" },
];

export const seedNotifications: Notification[] = [
  { id: "n-1", userId: "u-bdp-1", title: "Follow-up overdue", body: "ABC Distributors — follow-up was due yesterday.", createdAt: d(0, 8), read: false, link: "/leads/ld-1001" },
  { id: "n-2", userId: "u-captain-1", title: "Squad has 2 overdue tasks", body: "Mamba Squad: ABC + White Wave need unblocking.", createdAt: d(0, 8), read: false, link: "/tasks" },
  { id: "n-3", userId: "u-owner", title: "Commission awaiting payout", body: "KES 40,000 approved for Amina N.", createdAt: d(-4, 10), read: false, link: "/deals" },
  { id: "n-4", userId: "u-sales-1", title: "Opportunity stalling", body: "Savannah Logistics — no progress in 9 days.", createdAt: d(0, 7), read: false, link: "/pipeline" },
];

export function seedAll() {
  return {
    cohorts: seedCohorts, squads: seedSquads, members: seedMembers,
    companies: seedCompanies, contacts: seedContacts, leads: seedLeads,
    opportunities: seedOpportunities, tasks: seedTasks, meetings: seedMeetings,
    proposals: seedProposals, deals: seedDeals, payments: seedPayments,
    commissions: seedCommissions, activities: seedActivities,
    campaigns: seedCampaigns, audit: seedAudit, notifications: seedNotifications,
  };
}
