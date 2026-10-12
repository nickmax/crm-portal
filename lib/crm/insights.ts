import type { CrmState } from "./store";
import type { Lead, Opportunity } from "./types";

// Automation + health rules from spec §7.
export interface Exception {
  kind: "overdue" | "stalled" | "inactive" | "unassigned" | "duplicate" | "commission" | "missing_next";
  title: string;
  detail: string;
  link: string;
  severity: "high" | "medium" | "low";
}

export function computeExceptions(s: CrmState): Exception[] {
  const out: Exception[] = [];
  const now = Date.now();

  for (const t of s.tasks) {
    if (t.status !== "done" && new Date(t.dueAt).getTime() < now) {
      const lead = s.leads.find((l) => l.id === t.leadId);
      const owner = s.members.find((m) => m.id === t.ownerId);
      out.push({
        kind: "overdue",
        title: `Overdue: ${t.title}`,
        detail: `Owner ${owner?.name ?? t.ownerId}${lead ? ` · ${companyName(s, lead.companyId)}` : ""}`,
        link: lead ? `/leads/${lead.id}` : "/tasks",
        severity: "high",
      });
    }
  }

  for (const o of s.opportunities) {
    const daysSince = (now - new Date(o.updatedAt).getTime()) / 86400000;
    if (!["won", "lost"].includes(o.stage) && daysSince > 7) {
      out.push({
        kind: "stalled",
        title: `Stalled opportunity: ${companyName(s, o.companyId)}`,
        detail: `${Math.floor(daysSince)}d without progress · ${o.stage} · ${o.value.toLocaleString()} KES`,
        link: "/pipeline",
        severity: daysSince > 14 ? "high" : "medium",
      });
    }
  }

  for (const m of s.members.filter((x) => x.role === "bdp")) {
    const daysInactive = (now - new Date(m.lastActiveAt).getTime()) / 86400000;
    if (m.status === "inactive" || daysInactive > 7) {
      out.push({
        kind: "inactive",
        title: `BDP needs review: ${m.name}`,
        detail: m.status === "inactive" ? "Marked inactive" : `No activity for ${Math.floor(daysInactive)}d`,
        link: "/team",
        severity: "medium",
      });
    }
  }

  for (const l of s.leads) {
    if (!l.nextAction || !l.nextDueAt) {
      out.push({ kind: "missing_next", title: `Lead missing next step: ${companyName(s, l.companyId)}`, detail: "Every active lead needs an owner, status and next action.", link: `/leads/${l.id}`, severity: "medium" });
    }
    if (["new", "under_review"].includes(l.status)) {
      out.push({ kind: "unassigned", title: `Awaiting review: ${companyName(s, l.companyId)}`, detail: `Status: ${l.status}`, link: `/leads/${l.id}`, severity: "low" });
    }
  }

  for (const c of s.commissions.filter((c) => c.status === "pending")) {
    const bdp = s.members.find((m) => m.id === c.bdpId);
    out.push({ kind: "commission", title: `Commission pending approval`, detail: `${bdp?.name} · KES ${c.earned.toLocaleString()}`, link: "/deals", severity: "medium" });
  }

  return out.slice(0, 30);
}

export function companyName(s: CrmState, companyId: string): string {
  return s.companies.find((c) => c.id === companyId)?.name ?? companyId;
}

export function memberName(s: CrmState, memberId: string): string {
  return s.members.find((m) => m.id === memberId)?.name ?? memberId;
}

// Balanced scorecard §8
export interface ScoreRow {
  memberId: string;
  name: string;
  squad: string;
  leads: number;
  qualified: number;
  meetings: number;
  pipeline: number;
  wins: number;
  collected: number;
  followupRate: number;
}

export function scorecard(s: CrmState): ScoreRow[] {
  return s.members.filter((m) => ["bdp", "captain"].includes(m.role)).map((m) => {
    const myLeads = s.leads.filter((l) => l.ownerId === m.id);
    const myOpps = s.opportunities.filter((o) => o.bdpId === m.id);
    const myMeetings = s.meetings.filter((mt) => {
      const lead = s.leads.find((l) => l.id === mt.leadId);
      return lead?.ownerId === m.id && mt.outcome === "held";
    });
    const myDeals = s.deals.filter((dl) => {
      const opp = s.opportunities.find((o) => o.id === dl.opportunityId);
      return opp?.bdpId === m.id && dl.outcome === "won";
    });
    const done = s.tasks.filter((t) => t.ownerId === m.id && t.status === "done").length;
    const total = s.tasks.filter((t) => t.ownerId === m.id).length;
    const squad = s.squads.find((q) => q.id === m.squadId)?.name ?? "—";
    return {
      memberId: m.id, name: m.name, squad,
      leads: myLeads.length,
      qualified: myLeads.filter((l) => ["qualified", "meeting_booked", "meeting_held", "proposal", "negotiation", "won"].includes(l.status)).length,
      meetings: myMeetings.length,
      pipeline: myOpps.filter((o) => !["won", "lost"].includes(o.stage)).reduce((a, o) => a + o.value, 0),
      wins: myDeals.length,
      collected: myDeals.reduce((a, dl) => a + dl.collected, 0),
      followupRate: total ? Math.round((done / total) * 100) : 100,
    };
  });
}

export function pipelineByStage(opps: Opportunity[]) {
  const map = new Map<string, { count: number; value: number }>();
  for (const o of opps) {
    const e = map.get(o.stage) ?? { count: 0, value: 0 };
    e.count += 1; e.value += o.value;
    map.set(o.stage, e);
  }
  return map;
}

export function leadIsStale(l: Lead): boolean {
  return Date.now() - new Date(l.lastActivityAt).getTime() > 7 * 86400000 && !["won", "lost", "rejected", "duplicate"].includes(l.status);
}
