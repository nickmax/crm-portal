import type { Lead, Member, Opportunity, Role } from "./types";

export const PERMISSIONS: Record<Role, string[]> = {
  owner: ["*"],
  admin: ["members.read", "members.write", "cohorts.write", "leads.read_all", "leads.review", "campaigns.write", "reports.all", "commissions.review"],
  captain: ["squad.read", "squad.leads", "squad.tasks", "leads.review_squad"],
  bdp: ["leads.own", "tasks.own", "meetings.own", "commissions.own"],
  sales: ["opps.assigned", "proposals.write", "deals.write", "meetings.assigned"],
};

export function can(role: Role, perm: string): boolean {
  if (role === "owner") return true;
  return PERMISSIONS[role]?.includes(perm) ?? false;
}

export function visibleLeads(leads: Lead[], member: Member): Lead[] {
  if (member.role === "owner" || member.role === "admin") return leads;
  if (member.role === "sales") return leads; // sales see qualified+ via pipeline; keep full for continuity
  if (member.role === "captain" && member.squadId) return leads.filter((l) => l.squadId === member.squadId);
  return leads.filter((l) => l.ownerId === member.id);
}

export function visibleOpportunities(opps: Opportunity[], member: Member): Opportunity[] {
  if (member.role === "owner" || member.role === "admin") return opps;
  if (member.role === "sales") return opps.filter((o) => o.ownerId === member.id);
  if (member.role === "captain" && member.squadId) {
    return opps; // filtered upstream by squad leads; simplified
  }
  return opps.filter((o) => o.bdpId === member.id);
}

export function isSensitiveFinance(action: string): boolean {
  return ["commission.pay", "commission.edit_paid", "payment.verify"].includes(action);
}

// Owner must approve sensitive finance actions; admins can only propose.
export function requiresOwnerApproval(role: Role, action: string): boolean {
  if (!isSensitiveFinance(action)) return false;
  return role !== "owner";
}

export const NAV_BY_ROLE: Record<Role, { href: string; label: string; icon: string }[]> = {
  owner: [
    { href: "/", label: "Command centre", icon: "layout-dashboard" },
    { href: "/leads", label: "Leads", icon: "target" },
    { href: "/pipeline", label: "Pipeline", icon: "kanban" },
    { href: "/tasks", label: "Tasks", icon: "check" },
    { href: "/meetings", label: "Meetings", icon: "calendar" },
    { href: "/cohorts", label: "Cohorts & squads", icon: "users" },
    { href: "/deals", label: "Deals & commissions", icon: "wallet" },
    { href: "/campaigns", label: "Campaigns", icon: "megaphone" },
    { href: "/comms", label: "Comms hub", icon: "send" },
    { href: "/files", label: "Files", icon: "folder" },
    { href: "/reports", label: "Reports", icon: "chart" },
    { href: "/team", label: "Team", icon: "id" },
    { href: "/settings", label: "Settings & audit", icon: "settings" },
  ],
  admin: [
    { href: "/", label: "Overview", icon: "layout-dashboard" },
    { href: "/leads", label: "Leads", icon: "target" },
    { href: "/pipeline", label: "Pipeline", icon: "kanban" },
    { href: "/tasks", label: "Tasks", icon: "check" },
    { href: "/meetings", label: "Meetings", icon: "calendar" },
    { href: "/cohorts", label: "Cohorts & squads", icon: "users" },
    { href: "/campaigns", label: "Campaigns", icon: "megaphone" },
    { href: "/comms", label: "Comms hub", icon: "send" },
    { href: "/files", label: "Files", icon: "folder" },
    { href: "/reports", label: "Reports", icon: "chart" },
    { href: "/team", label: "Team", icon: "id" },
    { href: "/settings", label: "Settings & audit", icon: "settings" },
  ],
  captain: [
    { href: "/", label: "Squad home", icon: "layout-dashboard" },
    { href: "/leads", label: "Squad leads", icon: "target" },
    { href: "/pipeline", label: "Pipeline", icon: "kanban" },
    { href: "/tasks", label: "Tasks", icon: "check" },
    { href: "/meetings", label: "Meetings", icon: "calendar" },
    { href: "/campaigns", label: "Campaigns", icon: "megaphone" },
    { href: "/comms", label: "Comms hub", icon: "send" },
    { href: "/files", label: "Files", icon: "folder" },
    { href: "/reports", label: "Reports", icon: "chart" },
    { href: "/team", label: "My squad", icon: "id" },
    { href: "/guide", label: "BDP guide", icon: "book" },
  ],
  bdp: [
    { href: "/", label: "My workspace", icon: "layout-dashboard" },
    { href: "/leads", label: "My leads", icon: "target" },
    { href: "/tasks", label: "Tasks", icon: "check" },
    { href: "/meetings", label: "Meetings", icon: "calendar" },
    { href: "/pipeline", label: "Opportunities", icon: "kanban" },
    { href: "/deals", label: "My earnings", icon: "wallet" },
    { href: "/campaigns", label: "Campaigns", icon: "megaphone" },
    { href: "/files", label: "Files", icon: "folder" },
    { href: "/guide", label: "BDP guide", icon: "book" },
  ],
  sales: [
    { href: "/", label: "Closing home", icon: "layout-dashboard" },
    { href: "/pipeline", label: "My opportunities", icon: "kanban" },
    { href: "/leads", label: "Leads", icon: "target" },
    { href: "/meetings", label: "Meetings", icon: "calendar" },
    { href: "/tasks", label: "Tasks", icon: "check" },
    { href: "/deals", label: "Deals", icon: "wallet" },
    { href: "/campaigns", label: "Resources", icon: "megaphone" },
    { href: "/files", label: "Files", icon: "folder" },
  ],
};
