export type Role = "owner" | "admin" | "captain" | "bdp" | "sales";

export type LeadStatus =
  | "draft"
  | "new"
  | "under_review"
  | "accepted"
  | "info_requested"
  | "duplicate"
  | "rejected"
  | "contacting"
  | "qualified"
  | "meeting_booked"
  | "meeting_held"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost"
  | "paused";

export type OppStage =
  | "qualified"
  | "discovery"
  | "meeting_booked"
  | "meeting_held"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export type TaskStatus = "open" | "done" | "overdue";
export type MeetingOutcome = "held" | "no_show" | "rescheduled" | "pending";
export type CommissionStatus = "pending" | "approved" | "paid";
export type MemberStatus = "active" | "onboarding" | "inactive";

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  squadId: string | null;
  cohortId: string;
  status: MemberStatus;
  joinedAt: string;
  lastActiveAt: string;
  commissionRate: number; // e.g. 0.1 = 10%
}

export interface Squad {
  id: string;
  name: string;
  cohortId: string;
  captainId: string;
  industry: string;
  target: number;
}

export interface Cohort {
  id: string;
  name: string;
  description: string;
  startDate: string;
  active: boolean;
}

export interface Company {
  id: string;
  name: string;
  website?: string;
  email?: string;
  phone?: string;
  industry: string;
  size?: string;
  location?: string;
  priorContact?: boolean;
  priorOutcome?: string;
  isClient?: boolean;
}

export interface Contact {
  id: string;
  companyId: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  decisionMaker: boolean;
}

export interface Lead {
  id: string;
  companyId: string;
  ownerId: string;
  squadId: string;
  status: LeadStatus;
  source: string;
  observedProblem: string;
  valuePotential: number;
  urgency: "low" | "medium" | "high";
  decisionMakerName?: string;
  evidence?: string;
  lastActivityAt: string;
  nextAction: string;
  nextDueAt: string;
  createdAt: string;
  rejectReason?: string;
  duplicateOfId?: string;
}

export interface Activity {
  id: string;
  leadId: string;
  companyId: string;
  actorId: string;
  kind: "note" | "call" | "email" | "whatsapp" | "visit" | "status" | "transfer" | "meeting" | "system";
  summary: string;
  outcome?: string;
  createdAt: string;
}

export type TaskPriority = "low" | "normal" | "high";

export interface CrmTask {
  id: string;
  leadId: string | null;
  companyId: string | null;
  ownerId: string; // assignee (member id: profile uuid or app ref)
  title: string;
  description?: string;
  dueAt: string;
  status: TaskStatus;
  createdAt: string;
  createdBy?: string; // member id of the delegator
  priority?: TaskPriority;
}

export interface Opportunity {
  id: string;
  leadId: string;
  companyId: string;
  ownerId: string; // sales owner after qualification
  bdpId: string;
  stage: OppStage;
  value: number;
  expectedClose: string;
  problem: string;
  decisionMaker: string;
  qualificationNotes: string;
  stalledSince?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Meeting {
  id: string;
  opportunityId: string | null;
  leadId: string;
  companyId: string;
  date: string;
  attendees: string[];
  outcome: MeetingOutcome;
  notes: string;
  nextAction: string;
}

export interface Proposal {
  id: string;
  opportunityId: string;
  companyId: string;
  value: number;
  sentAt: string;
  revisions: number;
  status: "draft" | "sent" | "accepted" | "rejected" | "negotiating";
  openDecisions: string;
}

export interface Deal {
  id: string;
  opportunityId: string;
  companyId: string;
  contractValue: number;
  signedAt: string;
  milestones: { label: string; amount: number; due: string; collected: boolean }[];
  collected: number;
  handover: string[];
  outcome: "won" | "lost";
  lossReason?: string;
}

export interface Payment {
  id: string;
  dealId: string;
  amount: number;
  receivedAt: string;
  method: string;
  verified: boolean;
}

export interface Commission {
  id: string;
  dealId: string;
  bdpId: string;
  rate: number;
  eligibleRevenue: number;
  earned: number;
  status: CommissionStatus;
  paidAt?: string;
  history: { at: string; by: string; action: string }[];
}

export interface Campaign {
  id: string;
  name: string;
  industry: string;
  icp: string;
  offers: string[];
  templates: { name: string; body: string }[];
  checklist: string[];
  resources: { title: string; kind: string; url: string }[];
  targets: { squadId: string; leads: number; meetings: number }[];
  active: boolean;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  detail: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  link: string;
}

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  draft: "Draft",
  new: "New",
  under_review: "Under review",
  accepted: "Accepted",
  info_requested: "Info requested",
  duplicate: "Duplicate",
  rejected: "Rejected",
  contacting: "Contacting",
  qualified: "Qualified",
  meeting_booked: "Meeting booked",
  meeting_held: "Meeting held",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
  paused: "Paused",
};

export const OPP_STAGES: OppStage[] = [
  "qualified",
  "discovery",
  "meeting_booked",
  "meeting_held",
  "proposal",
  "negotiation",
  "won",
  "lost",
];

export const OPP_STAGE_LABEL: Record<OppStage, string> = {
  qualified: "Qualified",
  discovery: "Discovery",
  meeting_booked: "Meeting booked",
  meeting_held: "Meeting held",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Founder / Owner",
  admin: "BDP Programme Admin",
  captain: "Squad Captain",
  bdp: "BDP Member",
  sales: "Sales / Closing Team",
};
