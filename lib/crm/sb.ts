import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Activity, AuditEntry, Campaign, Cohort, Commission, Company, Contact, CrmTask,
  Deal, Lead, Meeting, Member, Notification, Opportunity, Payment, Proposal, Squad,
} from "./types";
import type { CrmState } from "./store";
import type { ProfileRow } from "./auth";

// ---------------------------------------------------------------------------
// Supabase ↔ CRM mapping + sync. Conventions:
// - Money: app KES major units <-> cents in value_cents/amount_cents.
// - Company <-> businesses via legacy_place_id = app company id.
// - Lead    <-> SAME businesses row via crm_lead_ref = app lead id.
// - Contact <-> contacts via crm_ref.  Task <-> followup_tasks via crm_ref.
// - Meeting <-> meetings via crm_ref.  Opportunity <-> deals via crm_ref.
// - Won/lost Deal reuses its opportunity's deals row (crm_kind flips to 'deal').
// - Activity <-> lead_events. Audit <-> audit_log. Notification <-> notifications.
// - App member ids of real users are their profile uuids (app_ref wins when set).
// Never deletes remote rows. Missing (pre-migration) tables are skipped.
// ---------------------------------------------------------------------------

export interface TableAvailability {
  cohorts: boolean; squads: boolean; proposals: boolean; commissions: boolean;
  commissionEvents: boolean; notifications: boolean; audit: boolean; core: boolean;
}

export interface SbCtx {
  businessIdByLegacy: Map<string, number>;
  businessIdByLeadRef: Map<string, number>;
  dealIdByRef: Map<string, number>;      // opp/deal app id -> deals.id
  dealAppIdByRow: Map<number, string>;   // deals.id -> opp app id (crm_ref)
  taskIdByRef: Map<string, number>;
  meetingIdByRef: Map<string, number>;
  paymentIdByRef: Map<string, number>;
  proposalIdByRef: Map<string, number>;
  commissionIdByRef: Map<string, number>;
  notificationIdByRef: Map<string, number>;
  contactIdByRef: Map<string, number>;
  squadIdByApp: Map<string, number>;
  squadAppById: Map<number, string>;
  cohortIdByApp: Map<string, number>;
  profileUuidByMember: Map<string, string>;
  pushedActivityIds: Set<string>;
  pushedAuditIds: Set<string>;
  pushedCommissionHistory: Map<string, number>;
  tables: TableAvailability;
}

export function emptyCtx(): SbCtx {
  const tables: TableAvailability = {
    cohorts: false, squads: false, proposals: false, commissions: false,
    commissionEvents: false, notifications: false, audit: false, core: false,
  };
  return {
    businessIdByLegacy: new Map(), businessIdByLeadRef: new Map(),
    dealIdByRef: new Map(), dealAppIdByRow: new Map(),
    taskIdByRef: new Map(), meetingIdByRef: new Map(), paymentIdByRef: new Map(),
    proposalIdByRef: new Map(), commissionIdByRef: new Map(),
    notificationIdByRef: new Map(), contactIdByRef: new Map(),
    squadIdByApp: new Map(), squadAppById: new Map(), cohortIdByApp: new Map(), profileUuidByMember: new Map(),
    pushedActivityIds: new Set(), pushedAuditIds: new Set(),
    pushedCommissionHistory: new Map(), tables,
  };
}

const toCents = (major: number) => Math.round((Number(major) || 0) * 100);
const toMajor = (cents: number | null | undefined) => Math.round((Number(cents) || 0) / 100);
const iso = (v: unknown): string => {
  if (!v) return new Date().toISOString();
  const d = new Date(v as string);
  return isNaN(+d) ? new Date().toISOString() : d.toISOString();
};

function isMissingTableError(e: unknown): boolean {
  const msg = JSON.stringify(e);
  return /PGRST205|404|does not exist|schema cache/i.test(msg);
}

async function safeSelect<T>(sb: SupabaseClient, table: string, query: string, onlyCrmLeads = false): Promise<{ rows: T[]; available: boolean }> {
  let q = sb.from(table).select(query);
  // The discovery table holds tens of thousands of pipeline businesses.
  // Only rows the CRM has claimed (crm_lead_ref set) are leads.
  if (onlyCrmLeads) q = q.not("crm_lead_ref", "is", null);
  const { data, error } = await q;
  if (error) {
    if (isMissingTableError(error)) return { rows: [], available: false };
    throw error;
  }
  return { rows: (data ?? []) as T[], available: true };
}

// ------------------------------------------------------------------ FETCH
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export async function fetchCrmState(
  sb: SupabaseClient, profiles: ProfileRow[], seedSquads: Squad[], seedCohorts: Cohort[]
): Promise<{ partial: Partial<CrmState>; ctx: SbCtx }> {
  const ctx = emptyCtx();
  for (const p of profiles) {
    const memberId = p.app_ref ?? p.id;
    ctx.profileUuidByMember.set(memberId, p.id);
  }
  const partial: Partial<CrmState> = {};

  // Cohorts / squads (optional until migration applied)
  try {
    const { rows, available } = await safeSelect<Row>(sb, "cohorts", "*");
    ctx.tables.cohorts = available;
    if (available) {
      partial.cohorts = rows.map((r) => {
        if (r.app_ref) ctx.cohortIdByApp.set(r.app_ref, r.id);
        return { id: r.app_ref ?? `coh-${r.id}`, name: r.name, description: r.description ?? "", startDate: r.start_date ?? "", active: !!r.active } as Cohort;
      });
    }
  } catch { /* offline */ }
  try {
    const { rows, available } = await safeSelect<Row>(sb, "squads", "*");
    ctx.tables.squads = available;
    if (available) {
      const cohortApp = new Map<number, string>();
      (partial.cohorts ?? []).forEach(() => {});
      for (const r of rows) {
        if (r.app_ref) ctx.squadIdByApp.set(r.app_ref, r.id);
      }
      // resolve cohort app ids
      const { rows: cohRows } = await safeSelect<Row>(sb, "cohorts", "id,app_ref");
      for (const c of cohRows) {
        if (c.app_ref) { ctx.cohortIdByApp.set(c.app_ref, c.id); cohortApp.set(c.id, c.app_ref); }
      }
      for (const r of rows) {
        if (r.app_ref) ctx.squadIdByApp.set(r.app_ref, r.id);
        ctx.squadAppById.set(r.id, r.app_ref ?? `sq-${r.id}`);
      }
      partial.squads = rows.map((r) => ({
        id: r.app_ref ?? `sq-${r.id}`,
        name: r.name,
        cohortId: (r.cohort_id != null && cohortApp.get(r.cohort_id)) || seedCohorts[0]?.id || "co-2026-q1",
        captainId: r.captain_id ? String(r.captain_id ?? "") : "",
        industry: r.industry ?? "",
        target: r.target ?? 30,
      } as Squad));
    }
  } catch { /* offline */ }
  void seedSquads;

  // CRM businesses only (keeps the 29k-row discovery table out of memory)
  const { rows: bizRows, available: coreAvailable } = await safeSelect<Row>(
    sb, "businesses",
    "id,legacy_place_id,name,website,phone_e164,industry,country,owner,sales_stage,lead_score,follow_up_due_at,crm_lead_ref,crm_squad_id,crm_status,crm_next_action,crm_source,crm_value_cents,crm_urgency,crm_decision_maker,crm_evidence,updated_at,created_at",
    true
  ).catch(() => ({ rows: [] as Row[], available: false }));
  ctx.tables.core = coreAvailable;
  if (!coreAvailable) return { partial, ctx };

  // Probe post-migration tables (empty tables still count as available).
  for (const [table, flag] of [
    ["proposals", "proposals"],
    ["commissions", "commissions"],
    ["commission_events", "commissionEvents"],
    ["notifications", "notifications"],
    ["audit_log", "audit"],
  ] as const) {
    try {
      ctx.tables[flag] = (await safeSelect<Row>(sb, table, "id")).available;
    } catch {
      ctx.tables[flag] = false;
    }
  }

  for (const r of bizRows) {
    if (r.legacy_place_id) ctx.businessIdByLegacy.set(r.legacy_place_id, r.id);
    if (r.crm_lead_ref) ctx.businessIdByLeadRef.set(r.crm_lead_ref, r.id);
  }
  const crmBizIds = bizRows.map((r) => r.id);

  partial.companies = bizRows.map((r) => ({
    id: r.legacy_place_id ?? `biz-${r.id}`,
    name: r.name ?? "Unknown business",
    website: r.website ?? undefined,
    phone: r.phone_e164 ?? undefined,
    industry: r.industry ?? "General",
    location: r.country ?? undefined,
  } as Company));

  partial.leads = bizRows.map((r) => ({
    id: r.crm_lead_ref ?? `ld-biz-${r.id}`,
    companyId: r.legacy_place_id ?? `biz-${r.id}`,
    ownerId: r.owner ?? "",
    squadId: (r.crm_squad_id != null && ctx.squadAppById.get(r.crm_squad_id)) || "",
    status: (r.crm_status ?? "new") as Lead["status"],
    source: r.crm_source ?? "Supabase pipeline",
    observedProblem: r.crm_evidence ?? "",
    valuePotential: toMajor(r.crm_value_cents),
    urgency: (r.crm_urgency ?? "medium") as Lead["urgency"],
    decisionMakerName: r.crm_decision_maker ?? undefined,
    lastActivityAt: iso(r.updated_at),
    nextAction: r.crm_next_action ?? "Review + first outreach",
    nextDueAt: iso(r.follow_up_due_at ?? r.updated_at),
    createdAt: iso(r.created_at),
  } as Lead));

  // Contacts for CRM businesses (chunked)
  const contacts: Contact[] = [];
  for (let i = 0; i < crmBizIds.length; i += 500) {
    const chunk = crmBizIds.slice(i, i + 500);
    if (!chunk.length) break;
    const { data, error } = await sb.from("contacts").select("*").in("business_id", chunk);
    if (error) { if (!isMissingTableError(error)) throw error; break; }
    for (const r of (data ?? []) as Row[]) {
      if (r.crm_ref) ctx.contactIdByRef.set(r.crm_ref, r.id);
      const biz = bizRows.find((b) => b.id === r.business_id);
      contacts.push({
        id: r.crm_ref ?? `ct-${r.id}`,
        companyId: biz?.legacy_place_id ?? `biz-${r.business_id}`,
        name: r.crm_name ?? r.value,
        role: r.crm_role ?? undefined,
        email: r.kind === "email" ? r.value : undefined,
        phone: r.kind === "phone" || r.kind === "whatsapp" ? r.value : undefined,
        decisionMaker: !!r.crm_is_decision_maker,
      });
    }
  }
  partial.contacts = contacts;

  // Tasks / meetings for CRM leads
  const leadRefs = bizRows.map((r) => r.crm_lead_ref).filter(Boolean) as string[];
  const tasks: CrmTask[] = [];
  if (leadRefs.length) {
    const { data } = await sb.from("followup_tasks").select("*").in("lead_ref", leadRefs);
    for (const r of (data ?? []) as Row[]) {
      if (r.crm_ref) ctx.taskIdByRef.set(r.crm_ref, r.id);
      const biz = bizRows.find((b) => b.crm_lead_ref === r.lead_ref);
      tasks.push({
        id: r.crm_ref ?? `t-${r.id}`,
        leadId: r.lead_ref ?? null,
        companyId: biz?.legacy_place_id ?? null,
        ownerId: r.assignee ?? "",
        title: r.title,
        dueAt: iso(r.due_at),
        status: r.status === "done" ? "done" : "open",
        createdAt: iso(r.created_at),
      });
    }
  }
  partial.tasks = tasks;

  const meetings: Meeting[] = [];
  if (leadRefs.length) {
    const { data } = await sb.from("meetings").select("*").in("lead_ref", leadRefs);
    for (const r of (data ?? []) as Row[]) {
      if (r.crm_ref) ctx.meetingIdByRef.set(r.crm_ref, r.id);
      const biz = bizRows.find((b) => b.crm_lead_ref === r.lead_ref);
      meetings.push({
        id: r.crm_ref ?? `m-${r.id}`,
        opportunityId: null,
        leadId: r.lead_ref ?? "",
        companyId: biz?.legacy_place_id ?? "",
        date: iso(r.scheduled_at),
        attendees: r.attendees ?? [],
        outcome: (r.outcome ?? "pending") as Meeting["outcome"],
        notes: r.notes ?? "",
        nextAction: r.next_action ?? "",
      });
    }
  }

  // Deals (opportunities + won/lost) + payments + proposals + commissions
  const { rows: dealRows } = await safeSelect<Row>(sb, "deals", "*").catch(() => ({ rows: [] as Row[], available: false }));
  const crmDeals = dealRows.filter((r) => r.crm_ref);
  const opportunities: Opportunity[] = [];
  const appDeals: Deal[] = [];
  for (const r of crmDeals) {
    ctx.dealIdByRef.set(r.crm_ref, r.id);
    ctx.dealAppIdByRow.set(r.id, r.crm_ref);
    const biz = bizRows.find((b) => b.id === r.business_id);
    const oppId: string = r.crm_ref;
    opportunities.push({
      id: oppId,
      leadId: biz?.crm_lead_ref ?? "",
      companyId: biz?.legacy_place_id ?? "",
      ownerId: memberIdForProfile(r.sales_owner_id, profiles) ?? "",
      bdpId: memberIdForProfile(r.bdp_id, profiles) ?? (biz?.owner ?? ""),
      stage: (r.stage ?? "qualified") as Opportunity["stage"],
      value: toMajor(r.value_cents),
      expectedClose: iso(r.expected_close_at),
      problem: biz?.crm_evidence ?? "",
      decisionMaker: biz?.crm_decision_maker ?? "TBC",
      qualificationNotes: "",
      createdAt: iso(r.created_at),
      updatedAt: iso(r.created_at),
    });
    if (r.crm_kind === "deal") {
      const ms = Array.isArray(r.milestones) ? r.milestones : [];
      appDeals.push({
        id: `dl-${oppId}`,
        opportunityId: oppId,
        companyId: biz?.legacy_place_id ?? "",
        contractValue: toMajor(r.value_cents),
        signedAt: iso(r.created_at),
        milestones: ms.map((m: Row) => ({ label: m.label ?? "", amount: toMajor(m.amount_cents ?? m.amount), due: m.due ?? "", collected: !!m.collected })),
        collected: 0, // filled from payments below
        handover: [],
        outcome: r.stage === "lost" ? "lost" : "won",
        lossReason: r.lost_reason ?? undefined,
      });
    }
  }
  partial.opportunities = opportunities;
  // link meetings to opportunities
  for (const m of meetings) {
    const biz = bizRows.find((b) => b.crm_lead_ref === m.leadId);
    const opp = opportunities.find((o) => biz && o.companyId === (biz.legacy_place_id ?? ""));
    if (opp) m.opportunityId = opp.id;
  }
  partial.meetings = meetings;

  const dealIds = crmDeals.map((r) => r.id);
  const payments: Payment[] = [];
  if (dealIds.length) {
    for (let i = 0; i < dealIds.length; i += 500) {
      const { data } = await sb.from("payments").select("*").in("deal_id", dealIds.slice(i, i + 500));
      for (const r of (data ?? []) as Row[]) {
        if (r.crm_ref) ctx.paymentIdByRef.set(r.crm_ref, r.id);
        const oppRef = ctx.dealAppIdByRow.get(r.deal_id);
        payments.push({
          id: r.crm_ref ?? `pay-${r.id}`,
          dealId: oppRef ? `dl-${oppRef}` : "",
          amount: toMajor(r.amount_cents),
          receivedAt: iso(r.collected_at),
          method: r.method ?? "Bank transfer",
          verified: r.verified ?? true,
        });
        const d = appDeals.find((x) => x.id === (oppRef ? `dl-${oppRef}` : ""));
        if (d && (r.verified ?? true)) d.collected += toMajor(r.amount_cents);
      }
    }
  }
  partial.deals = appDeals;
  partial.payments = payments;

  if (ctx.tables.proposals) {
    const { rows } = await safeSelect<Row>(sb, "proposals", "*");
    partial.proposals = rows.map((r) => {
      if (r.crm_ref) ctx.proposalIdByRef.set(r.crm_ref, r.id);
      const oppRef = ctx.dealAppIdByRow.get(r.deal_id) ?? "";
      const biz = bizRows.find((b) => b.id === (dealRows.find((d) => d.id === r.deal_id)?.business_id));
      return {
        id: r.crm_ref ?? `p-${r.id}`, opportunityId: oppRef,
        companyId: biz?.legacy_place_id ?? "",
        value: toMajor(r.value_cents), sentAt: iso(r.sent_at),
        revisions: r.revisions ?? 0, status: (r.status ?? "sent") as Proposal["status"],
        openDecisions: r.open_decisions ?? "",
      } as Proposal;
    });
  }

  if (ctx.tables.commissions) {
    const { rows } = await safeSelect<Row>(sb, "commissions", "*");
    const { rows: events } = await safeSelect<Row>(sb, "commission_events", "*");
    partial.commissions = rows.map((r) => {
      if (r.crm_ref) {
        ctx.commissionIdByRef.set(r.crm_ref, r.id);
        ctx.pushedCommissionHistory.set(r.crm_ref, events.filter((e) => e.commission_id === r.id).length);
      }
      const oppRef = ctx.dealAppIdByRow.get(r.deal_id) ?? "";
      return {
        id: r.crm_ref ?? `cm-${r.id}`, dealId: oppRef ? `dl-${oppRef}` : "",
        bdpId: memberIdForProfile(r.bdp_id, profiles) ?? (r.app_bdp ?? ""),
        rate: Number(r.rate ?? 0.1), eligibleRevenue: toMajor(r.eligible_cents),
        earned: toMajor(r.earned_cents), status: (r.status ?? "pending") as Commission["status"],
        paidAt: r.paid_at ? iso(r.paid_at) : undefined,
        history: events.filter((e) => e.commission_id === r.id).map((e) => ({ at: iso(e.created_at), by: e.actor ?? "", action: e.action ?? "" })),
      } as Commission;
    });
  }

  // Activities + audit + notifications (append-only trackers)
  if (leadRefs.length) {
    const { data } = await sb.from("lead_events").select("id,legacy_place_id,dimension,new_value,reason,actor,created_at").in("legacy_place_id", leadRefs);
    const activities: Activity[] = [];
    for (const r of (data ?? []) as Row[]) {
      const biz = bizRows.find((b) => b.crm_lead_ref === r.legacy_place_id);
      activities.push({
        id: `a-${r.id}`, leadId: r.legacy_place_id, companyId: biz?.legacy_place_id ?? "",
        actorId: r.actor ?? "system", kind: (r.dimension ?? "note") as Activity["kind"],
        summary: r.new_value ?? "", outcome: r.reason ?? undefined, createdAt: iso(r.created_at),
      });
      ctx.pushedActivityIds.add(`a-${r.id}`);
    }
    partial.activities = activities;
  }
  if (ctx.tables.audit) {
    const { rows } = await safeSelect<Row>(sb, "audit_log", "*").catch(() => ({ rows: [] as Row[], available: false }));
    partial.audit = rows.map((r) => {
      ctx.pushedAuditIds.add(`au-${r.id}`);
      return { id: `au-${r.id}`, at: iso(r.created_at), actorId: r.actor ?? "", action: r.action ?? "", entity: r.entity ?? "", entityId: r.entity_id ?? "", detail: r.detail ?? "" } as AuditEntry;
    });
  }
  if (ctx.tables.notifications) {
    const { rows } = await safeSelect<Row>(sb, "notifications", "*").catch(() => ({ rows: [] as Row[], available: false }));
    partial.notifications = rows.map((r) => {
      const ref = r.app_ref ?? `n-${r.id}`;
      ctx.notificationIdByRef.set(ref, r.id);
      return { id: ref, userId: profileMemberId(r.profile_id, profiles) ?? (r.app_ref ?? ""), title: r.title ?? "", body: r.body ?? "", createdAt: iso(r.created_at), read: !!r.read, link: r.link ?? "/" } as Notification;
    });
  }

  // Campaigns (match by name)
  try {
    const { rows } = await safeSelect<Row>(sb, "campaigns", "*");
    if (rows.length) {
      partial.campaigns = rows.map((r) => {
        const d = (r.details ?? {}) as Row;
        return {
          id: `camp-${r.id}`, name: r.name, industry: r.target_profile ?? "",
          icp: r.target_profile ?? "", offers: d.offers ?? (r.offer ? [r.offer] : []),
          templates: d.templates ?? [], checklist: d.checklist ?? [],
          resources: d.resources ?? [], targets: d.targets ?? [], active: (r.status ?? "draft") === "active",
        } as Campaign;
      });
    }
  } catch { /* keep seed */ }

  return { partial, ctx };
}

function memberIdForProfile(profileUuid: string | null | undefined, profiles: ProfileRow[]): string | null {
  if (!profileUuid) return null;
  const p = profiles.find((x) => x.id === profileUuid);
  return p ? (p.app_ref ?? p.id) : null;
}
function profileMemberId(profileUuid: string | null | undefined, profiles: ProfileRow[]): string | null {
  return memberIdForProfile(profileUuid, profiles);
}

// Live duplicate/prior-contact search across the FULL discovery table.
export interface BusinessHit {
  id: number; name: string; website: string | null; industry: string | null;
  salesStage: string; conversationStatus: string; isClient: boolean;
}
export async function searchBusinesses(sb: SupabaseClient, term: string): Promise<BusinessHit[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const { data, error } = await sb.from("businesses")
    .select("id,name,website,industry,sales_stage,conversation_status")
    .or(`name.ilike.%${q}%,website.ilike.%${q}%,domain.ilike.%${q}%`)
    .limit(20);
  if (error) return [];
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id, name: r.name, website: r.website, industry: r.industry,
    salesStage: r.sales_stage, conversationStatus: r.conversation_status,
    isClient: r.sales_stage === "won" || r.sales_stage === "client",
  }));
}

// ------------------------------------------------------------------- PUSH
export interface PushResult { ok: boolean; errors: string[]; seeded: boolean }

function profileUuid(memberId: string, ctx: SbCtx): string | null {
  return ctx.profileUuidByMember.get(memberId) ?? null;
}

export async function pushDiff(
  sb: SupabaseClient, prev: CrmState, next: CrmState, ctx: SbCtx, profiles: ProfileRow[]
): Promise<PushResult> {
  const errors: string[] = [];
  if (!ctx.tables.core) return { ok: false, errors: ["core tables unavailable"], seeded: false };
  for (const p of profiles) {
    const memberId = p.app_ref ?? p.id;
    ctx.profileUuidByMember.set(memberId, p.id);
  }
  const bizIdForCompany = (companyId: string) => ctx.businessIdByLegacy.get(companyId);

  const diff = <T extends { id: string }>(a: T[], b: T[]) => {
    const prevMap = new Map(a.map((x) => [x.id, x]));
    return b.filter((x) => {
      const p = prevMap.get(x.id);
      return !p || JSON.stringify(p) !== JSON.stringify(x);
    });
  };

  // --- companies + leads (same businesses row) ---
  for (const c of diff(prev.companies, next.companies)) {
    const lead = next.leads.find((l) => l.companyId === c.id);
    const owner = next.members.find((m) => m.id === lead?.ownerId);
    void owner;
    const payload: Row = {
      legacy_place_id: c.id, name: c.name, website: c.website ?? null,
      phone_e164: c.phone ?? null, industry: c.industry, country: c.location ?? null,
    };
    if (lead) {
      payload.crm_lead_ref = lead.id;
      payload.owner = lead.ownerId || null;
      const sqNum = lead.squadId.startsWith("sq-") && /^\d+$/.test(lead.squadId.slice(3))
        ? Number(lead.squadId.slice(3)) : ctx.squadIdByApp.get(lead.squadId) ?? null;
      payload.crm_squad_id = sqNum;
      payload.crm_status = lead.status;
      payload.crm_next_action = lead.nextAction;
      payload.crm_source = lead.source;
      payload.crm_value_cents = toCents(lead.valuePotential);
      payload.crm_urgency = lead.urgency;
      payload.crm_decision_maker = lead.decisionMakerName ?? null;
      payload.crm_evidence = lead.evidence ?? lead.observedProblem ?? null;
      payload.follow_up_due_at = lead.nextDueAt;
    }
    const { data, error } = await sb.from("businesses").upsert(payload, { onConflict: "legacy_place_id" }).select("id");
    if (error) { errors.push(`businesses/${c.id}: ${error.message}`); continue; }
    const id = (data as Row[])?.[0]?.id;
    if (id) {
      ctx.businessIdByLegacy.set(c.id, id);
      if (lead) ctx.businessIdByLeadRef.set(lead.id, id);
    }
  }
  // leads whose company row already existed
  for (const l of diff(prev.leads, next.leads)) {
    if (!ctx.businessIdByLeadRef.get(l.id) && !bizIdForCompany(l.companyId)) continue; // company upsert above handles it
    const bizId = ctx.businessIdByLeadRef.get(l.id) ?? bizIdForCompany(l.companyId);
    if (!bizId) continue;
    const sqNum = /^\d+$/.test(l.squadId.replace(/^sq-/, "")) && l.squadId.startsWith("sq-")
      ? Number(l.squadId.slice(3)) : (ctx.squadIdByApp.get(l.squadId) ?? null);
    const { error } = await sb.from("businesses").update({
      crm_lead_ref: l.id, owner: l.ownerId || null, crm_squad_id: sqNum,
      crm_status: l.status, crm_next_action: l.nextAction, crm_source: l.source,
      crm_value_cents: toCents(l.valuePotential), crm_urgency: l.urgency,
      crm_decision_maker: l.decisionMakerName ?? null,
      crm_evidence: l.evidence ?? l.observedProblem ?? null,
      follow_up_due_at: l.nextDueAt,
    }).eq("id", bizId);
    if (error) errors.push(`lead/${l.id}: ${error.message}`);
    else ctx.businessIdByLeadRef.set(l.id, bizId);
  }

  // --- contacts ---
  for (const c of diff(prev.contacts, next.contacts)) {
    const bizId = bizIdForCompany(c.companyId);
    if (!bizId) continue;
    const value = c.email ?? c.phone ?? "";
    if (!value) continue;
    const { data, error } = await sb.from("contacts").upsert({
      crm_ref: c.id, business_id: bizId,
      kind: c.email ? "email" : "phone", value,
      crm_name: c.name, crm_role: c.role ?? null, crm_is_decision_maker: c.decisionMaker,
    }, { onConflict: "crm_ref" }).select("id");
    if (error) errors.push(`contacts/${c.id}: ${error.message}`);
    else if ((data as Row[])?.[0]?.id) ctx.contactIdByRef.set(c.id, (data as Row[])[0].id);
  }

  // --- tasks ---
  const prevTasks = new Map(prev.tasks.map((t) => [t.id, t]));
  for (const t of diff(prev.tasks, next.tasks)) {
    const bizId = t.companyId ? bizIdForCompany(t.companyId) : undefined;
    if (!bizId) continue;
    const was = prevTasks.get(t.id);
    const payload: Row = {
      crm_ref: t.id, business_id: bizId, title: t.title,
      status: t.status === "done" ? "done" : "pending",
      assignee: t.ownerId || null, due_at: t.dueAt, lead_ref: t.leadId,
    };
    if (t.status === "done" && was?.status !== "done") payload.completed_at = new Date().toISOString();
    const { data, error } = await sb.from("followup_tasks").upsert(payload, { onConflict: "crm_ref" }).select("id");
    if (error) errors.push(`tasks/${t.id}: ${error.message}`);
    else if ((data as Row[])?.[0]?.id) ctx.taskIdByRef.set(t.id, (data as Row[])[0].id);
  }

  // --- meetings ---
  for (const m of diff(prev.meetings, next.meetings)) {
    const bizId = bizIdForCompany(m.companyId);
    if (!bizId) continue;
    const { data, error } = await sb.from("meetings").upsert({
      crm_ref: m.id, business_id: bizId, scheduled_at: m.date,
      outcome: m.outcome, notes: m.notes, attendees: m.attendees,
      next_action: m.nextAction, lead_ref: m.leadId,
    }, { onConflict: "crm_ref" }).select("id");
    if (error) errors.push(`meetings/${m.id}: ${error.message}`);
    else if ((data as Row[])?.[0]?.id) ctx.meetingIdByRef.set(m.id, (data as Row[])[0].id);
  }

  // --- opportunities (deals rows, kind=opportunity) ---
  for (const o of diff(prev.opportunities, next.opportunities)) {
    const bizId = bizIdForCompany(o.companyId);
    if (!bizId) continue;
    const { data, error } = await sb.from("deals").upsert({
      crm_ref: o.id, business_id: bizId, stage: o.stage,
      value_cents: toCents(o.value), currency: "KES",
      expected_close_at: o.expectedClose,
      bdp_id: profileUuid(o.bdpId, ctx), sales_owner_id: profileUuid(o.ownerId, ctx),
      crm_kind: "opportunity",
    }, { onConflict: "crm_ref" }).select("id");
    if (error) errors.push(`opportunity/${o.id}: ${error.message}`);
    else if ((data as Row[])?.[0]?.id) {
      ctx.dealIdByRef.set(o.id, (data as Row[])[0].id);
      ctx.dealAppIdByRow.set((data as Row[])[0].id, o.id);
    }
  }

  // --- won/lost deals: fold into the opportunity's deals row ---
  for (const d of diff(prev.deals, next.deals)) {
    let rowId = ctx.dealIdByRef.get(d.opportunityId);
    if (!rowId) {
      const bizId = bizIdForCompany(d.companyId);
      if (!bizId) continue;
      const { data, error } = await sb.from("deals").upsert({
        crm_ref: d.opportunityId, business_id: bizId, stage: d.outcome,
        value_cents: toCents(d.contractValue), currency: "KES", crm_kind: "deal",
        lost_reason: d.lossReason ?? null,
        milestones: d.milestones.map((m) => ({ label: m.label, amount_cents: toCents(m.amount), due: m.due, collected: m.collected })),
      }, { onConflict: "crm_ref" }).select("id");
      if (error) { errors.push(`deal/${d.id}: ${error.message}`); continue; }
      rowId = (data as Row[])?.[0]?.id;
      if (rowId) {
        ctx.dealIdByRef.set(d.opportunityId, rowId);
        ctx.dealAppIdByRow.set(rowId, d.opportunityId);
      }
    } else {
      const { error } = await sb.from("deals").update({
        stage: d.outcome, value_cents: toCents(d.contractValue), crm_kind: "deal",
        lost_reason: d.lossReason ?? null,
        milestones: d.milestones.map((m) => ({ label: m.label, amount_cents: toCents(m.amount), due: m.due, collected: m.collected })),
      }).eq("id", rowId);
      if (error) { errors.push(`deal/${d.id}: ${error.message}`); continue; }
    }
    if (rowId) ctx.dealIdByRef.set(d.id, rowId);
  }

  // --- payments ---
  for (const p of diff(prev.payments, next.payments)) {
    const oppRef = next.deals.find((d) => d.id === p.dealId)?.opportunityId;
    const rowId = (oppRef && ctx.dealIdByRef.get(oppRef)) || ctx.dealIdByRef.get(p.dealId);
    if (!rowId) continue;
    const { data, error } = await sb.from("payments").upsert({
      crm_ref: p.id, deal_id: rowId, amount_cents: toCents(p.amount),
      method: p.method, verified: p.verified, collected_at: p.receivedAt,
    }, { onConflict: "crm_ref" }).select("id");
    if (error) errors.push(`payments/${p.id}: ${error.message}`);
    else if ((data as Row[])?.[0]?.id) ctx.paymentIdByRef.set(p.id, (data as Row[])[0].id);
  }

  // --- proposals / commissions (post-migration tables) ---
  if (ctx.tables.proposals) {
    for (const p of diff(prev.proposals, next.proposals)) {
      const rowId = ctx.dealIdByRef.get(p.opportunityId);
      if (!rowId) continue;
      const { data, error } = await sb.from("proposals").upsert({
        crm_ref: p.id, deal_id: rowId, value_cents: toCents(p.value),
        sent_at: p.sentAt, revisions: p.revisions, status: p.status, open_decisions: p.openDecisions,
      }, { onConflict: "crm_ref" }).select("id");
      if (error) errors.push(`proposals/${p.id}: ${error.message}`);
      else if ((data as Row[])?.[0]?.id) ctx.proposalIdByRef.set(p.id, (data as Row[])[0].id);
    }
  }
  if (ctx.tables.commissions) {
    for (const c of diff(prev.commissions, next.commissions)) {
      const oppRef = next.deals.find((d) => d.id === c.dealId)?.opportunityId;
      const rowId = (oppRef && ctx.dealIdByRef.get(oppRef)) || ctx.dealIdByRef.get(c.dealId);
      if (!rowId) continue;
      const { data, error } = await sb.from("commissions").upsert({
        crm_ref: c.id, deal_id: rowId, bdp_id: profileUuid(c.bdpId, ctx), app_bdp: c.bdpId,
        rate: c.rate, eligible_cents: toCents(c.eligibleRevenue), earned_cents: toCents(c.earned),
        status: c.status, paid_at: c.paidAt ?? null,
      }, { onConflict: "crm_ref" }).select("id");
      if (error) { errors.push(`commissions/${c.id}: ${error.message}`); continue; }
      const cid = (data as Row[])?.[0]?.id;
      if (cid) {
        ctx.commissionIdByRef.set(c.id, cid);
        const pushed = ctx.pushedCommissionHistory.get(c.id) ?? 0;
        const fresh = c.history.slice(pushed);
        if (ctx.tables.commissionEvents) {
          for (const h of fresh) {
            const { error: e2 } = await sb.from("commission_events").insert({ commission_id: cid, actor: h.by, action: h.action });
            if (e2) { errors.push(`commission_events/${c.id}: ${e2.message}`); break; }
          }
        }
        ctx.pushedCommissionHistory.set(c.id, c.history.length);
      }
    }
  }

  // --- activities + audit (append-only) ---
  for (const a of next.activities) {
    if (ctx.pushedActivityIds.has(a.id)) continue;
    const bizId = ctx.businessIdByLeadRef.get(a.leadId) ?? bizIdForCompany(a.companyId);
    if (!bizId) continue;
    const { error } = await sb.from("lead_events").insert({
      business_id: bizId, legacy_place_id: a.leadId, dimension: a.kind,
      new_value: a.summary, reason: a.outcome ?? null, actor: a.actorId,
    });
    if (error) errors.push(`activity/${a.id}: ${error.message}`);
    else ctx.pushedActivityIds.add(a.id);
  }
  if (ctx.tables.audit) {
    for (const a of next.audit) {
      if (ctx.pushedAuditIds.has(a.id)) continue;
      const { error } = await sb.from("audit_log").insert({
        actor: a.actorId, action: a.action, entity: a.entity, entity_id: a.entityId, detail: a.detail,
      });
      if (error) errors.push(`audit/${a.id}: ${error.message}`);
      else ctx.pushedAuditIds.add(a.id);
    }
  }

  // --- notifications ---
  if (ctx.tables.notifications) {
    const prevN = new Map(prev.notifications.map((n) => [n.id, n]));
    for (const n of next.notifications) {
      const rowId = ctx.notificationIdByRef.get(n.id);
      if (!rowId) {
        const { data, error } = await sb.from("notifications").insert({
          profile_id: profileUuid(n.userId, ctx), app_ref: n.userId,
          title: n.title, body: n.body, link: n.link, read: n.read,
        }).select("id");
        if (error) errors.push(`notifications/${n.id}: ${error.message}`);
        else if ((data as Row[])?.[0]?.id) ctx.notificationIdByRef.set(n.id, (data as Row[])[0].id);
      } else if (prevN.get(n.id)?.read !== n.read) {
        const { error } = await sb.from("notifications").update({ read: n.read }).eq("id", rowId);
        if (error) errors.push(`notifications/${n.id}: ${error.message}`);
      }
    }
  }

  // --- cohorts / squads / campaigns (rarely change, sync by ref/name) ---
  if (ctx.tables.cohorts) {
    for (const c of diff(prev.cohorts, next.cohorts)) {
      const { data, error } = await sb.from("cohorts")
        .upsert({ app_ref: c.id, name: c.name, description: "", start_date: null, active: true }, { onConflict: "app_ref" })
        .select("id");
      if (error) errors.push(`cohorts/${c.id}: ${error.message}`);
      else if ((data as Row[])?.[0]?.id) ctx.cohortIdByApp.set(c.id, (data as Row[])[0].id);
    }
  }
  if (ctx.tables.squads) {
    for (const q of diff(prev.squads, next.squads)) {
      const { data, error } = await sb.from("squads")
        .upsert({
          app_ref: q.id, name: q.name,
          cohort_id: ctx.cohortIdByApp.get(q.cohortId) ?? null,
          captain_id: profileUuid(q.captainId, ctx),
          industry: q.industry, target: q.target,
        }, { onConflict: "app_ref" })
        .select("id");
      if (error) errors.push(`squads/${q.id}: ${error.message}`);
      else if ((data as Row[])?.[0]?.id) ctx.squadIdByApp.set(q.id, (data as Row[])[0].id);
    }
  }
  for (const c of diff(prev.campaigns, next.campaigns)) {
    const { error } = await sb.from("campaigns").upsert({
      name: c.name, status: c.active ? "active" : "draft", target_profile: c.icp,
      details: { offers: c.offers, templates: c.templates, checklist: c.checklist, resources: c.resources, targets: c.targets },
    }, { onConflict: "name" });
    if (error && !isMissingTableError(error)) errors.push(`campaigns/${c.id}: ${error.message}`);
  }

  return { ok: errors.length === 0, errors, seeded: false };
}

// Seed the remote with local demo data — ONLY when no CRM businesses exist.
export async function seedRemoteIfEmpty(
  sb: SupabaseClient, seed: CrmState, ctx: SbCtx, profiles: ProfileRow[]
): Promise<PushResult> {
  const { count } = await sb.from("businesses").select("id", { count: "exact", head: true }).not("crm_lead_ref", "is", null);
  if ((count ?? 0) > 0) return { ok: true, errors: [], seeded: false };
  // Squads/cohorts first so company rows can reference their numeric ids.
  if (ctx.tables.cohorts) {
    for (const c of seed.cohorts) {
      const { data } = await sb.from("cohorts").upsert({ app_ref: c.id, name: c.name }, { onConflict: "app_ref" }).select("id");
      const id = (data as Row[])?.[0]?.id;
      if (id) ctx.cohortIdByApp.set(c.id, id);
    }
  }
  if (ctx.tables.squads) {
    for (const q of seed.squads) {
      const { data } = await sb.from("squads").upsert({
        app_ref: q.id, name: q.name,
        cohort_id: ctx.cohortIdByApp.get(q.cohortId) ?? null,
        industry: q.industry, target: q.target,
      }, { onConflict: "app_ref" }).select("id");
      const id = (data as Row[])?.[0]?.id;
      if (id) { ctx.squadIdByApp.set(q.id, id); ctx.squadAppById.set(id, q.id); }
    }
  }
  const empty = emptyState();
  const res = await pushDiff(sb, { ...empty, cohorts: seed.cohorts, squads: seed.squads },
    seed, ctx, profiles);
  return { ...res, seeded: true };
}

function emptyState(): CrmState {
  return {
    cohorts: [], squads: [], members: [], companies: [], contacts: [], leads: [],
    opportunities: [], tasks: [], meetings: [], proposals: [], deals: [], payments: [],
    commissions: [], activities: [], campaigns: [], audit: [], notifications: [],
    currentUserId: "",
  };
}

export type { CrmState };
