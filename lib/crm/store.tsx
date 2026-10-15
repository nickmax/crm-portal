"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type {
  Activity, AuditEntry, Campaign, Cohort, Commission, Company, Contact, CrmTask,
  Deal, Lead, Meeting, Member, Notification, Opportunity, Payment, Proposal, Squad,
} from "./types";
import { seedAll, seedCohorts, seedSquads, isSeedId } from "./seed";
import { useAuth } from "./auth";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchCrmState, pushDiff, emptyCtx, type SbCtx } from "./sb";

export interface CrmState {
  cohorts: Cohort[]; squads: Squad[]; members: Member[];
  companies: Company[]; contacts: Contact[]; leads: Lead[];
  opportunities: Opportunity[]; tasks: CrmTask[]; meetings: Meeting[];
  proposals: Proposal[]; deals: Deal[]; payments: Payment[];
  commissions: Commission[]; activities: Activity[];
  campaigns: Campaign[]; audit: AuditEntry[]; notifications: Notification[];
  currentUserId: string;
}

export type SyncStatus = "local" | "loading" | "synced" | "error";

interface CrmContextValue extends CrmState {
  currentUser: Member;
  remote: boolean;
  syncStatus: SyncStatus;
  syncError: string | null;
  switchUser: (id: string) => void;
  update: <K extends keyof CrmState>(key: K, value: CrmState[K]) => void;
  mutate: (fn: (s: CrmState) => CrmState) => void;
  reset: () => void;
  clearDemo: () => void;
  retrySync: () => void;
}

const CrmContext = createContext<CrmContextValue | null>(null);
const KEY = "mathenge-bdp-crm-v1";

function initial(): CrmState {
  const s = seedAll() as unknown as Omit<CrmState, "currentUserId">;
  return { ...s, currentUserId: "u-owner" };
}

function loadLocal(): CrmState {
  const base = initial();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CrmState;
      if (parsed && parsed.leads && parsed.members) return parsed;
    }
  } catch { /* keep seed */ }
  return base;
}

export function CrmProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [state, setState] = useState<CrmState>(() =>
    typeof window === "undefined" ? initial() : loadLocal()
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [remoteBooted, setRemoteBooted] = useState(false);
  const ctxRef = useRef<SbCtx>(emptyCtx());
  const lastPushedRef = useRef<CrmState | null>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const profilesRef = useRef(auth.profiles);
  profilesRef.current = auth.profiles;

  const remote = isSupabaseConfigured() && !!auth.user;

  // Single source of truth for "who is acting": when signed in, every write
  // (ownerId, actorId, assignee) must carry the authenticated member — never a
  // stale id left in storage by another session or the demo default.
  useEffect(() => {
    if (auth.loading || !auth.currentMember) return;
    const id = auth.currentMember.id;
    setState((s) => (s.currentUserId === id ? s : { ...s, currentUserId: id }));
  }, [auth.loading, auth.currentMember]);

  // Demo seed is for logged-out exploration only. The moment a real session
  // exists, strip every seed row from the on-screen state at once — BDPs
  // never see sample leads, squads or members, even mid-session, even if a
  // previous clear only ran on the server.
  useEffect(() => {
    if (!remote || !auth.user) return;
    // Returns the previous state untouched when nothing is seeded, so this
    // never cascades — it fires once per session change at most.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => {
      const scrub = <T extends { id: string }>(rows: T[]): T[] =>
        rows.filter((r) => !isSeedId(r.id));
      const dirty =
        s.cohorts.some((r) => isSeedId(r.id)) || s.squads.some((r) => isSeedId(r.id)) ||
        s.members.some((r) => isSeedId(r.id)) || s.companies.some((r) => isSeedId(r.id)) ||
        s.contacts.some((r) => isSeedId(r.id)) || s.leads.some((r) => isSeedId(r.id)) ||
        s.opportunities.some((r) => isSeedId(r.id)) || s.tasks.some((r) => isSeedId(r.id)) ||
        s.meetings.some((r) => isSeedId(r.id)) || s.proposals.some((r) => isSeedId(r.id)) ||
        s.deals.some((r) => isSeedId(r.id)) || s.payments.some((r) => isSeedId(r.id)) ||
        s.commissions.some((r) => isSeedId(r.id)) || s.activities.some((r) => isSeedId(r.id)) ||
        s.campaigns.some((r) => isSeedId(r.id)) || s.audit.some((r) => isSeedId(r.id)) ||
        s.notifications.some((r) => isSeedId(r.id));
      if (!dirty) return s;
      return {
        ...s,
        cohorts: scrub(s.cohorts), squads: scrub(s.squads), members: scrub(s.members),
        companies: scrub(s.companies), contacts: scrub(s.contacts), leads: scrub(s.leads),
        opportunities: scrub(s.opportunities), tasks: scrub(s.tasks), meetings: scrub(s.meetings),
        proposals: scrub(s.proposals), deals: scrub(s.deals), payments: scrub(s.payments),
        commissions: scrub(s.commissions), activities: scrub(s.activities),
        campaigns: scrub(s.campaigns), audit: scrub(s.audit), notifications: scrub(s.notifications),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote, auth.user?.id]);

  // Persist locally (offline fallback + instant reloads)
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  const schedulePush = () => {
    if (!remote || !remoteBooted) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    setSyncStatus((s) => (s === "error" ? s : "loading"));
    pushTimer.current = setTimeout(async () => {
      const sb = createClient();
      const prev = lastPushedRef.current;
      const next = stateRef.current;
      if (!prev) return;
      try {
        // Never push anonymously: RLS tables (e.g. lead_events) reject it and
        // the rows would be wrongly treated as synced. Just wait for the next
        // mutate — all push ops are idempotent, so a retry is always safe.
        const { data: { session } } = await sb.auth.getSession();
        if (!session) return;
        const res = await pushDiff(sb, prev, next, ctxRef.current, profilesRef.current);
        if (res.ok) {
          lastPushedRef.current = next;
          setSyncStatus("synced"); setSyncError(null);
        } else {
          // Keep lastPushed where it was: the next push retries everything,
          // and every op is idempotent (unique refs + pushed-id sets).
          setSyncStatus("error"); setSyncError(res.errors.slice(0, 3).join(" · "));
        }
      } catch (e) {
        setSyncStatus("error");
        setSyncError(e instanceof Error ? e.message.slice(0, 200) : "Sync failed");
      }
    }, 900);
  };

  // Boot from Supabase on sign-in (waits for the member directory so every
  // id mapping is exact — no orphaned owners or notifications).
  useEffect(() => {
    if (!remote || auth.loading || !auth.profilesReady) return;
    if (remoteBooted) return;
    let cancelled = false;
    (async () => {
      setSyncStatus("loading");
      try {
        const sb = createClient();
        const { partial, ctx } = await fetchCrmState(sb, auth.profiles, seedSquads, seedCohorts);
        if (cancelled) return;
        ctxRef.current = ctx;
        if (!ctx.tables.core) throw new Error("Core tables unreachable — check the migration + Data API grants.");

        const local = stateRef.current;
        // Scrub the demo seed out of the local cache: any signed-in device
        // adopts remote as truth, and seed rows must never resurrect from
        // localStorage after the owner clears them (nor be visible to BDPs).
        // Logged-out demo mode is unaffected — it never reaches this branch.
        const scrub = <T extends { id: string }>(rows: T[]): T[] =>
          rows.filter((r) => !isSeedId(r.id));
        const sieved: CrmState = {
          ...local,
          cohorts: scrub(local.cohorts), squads: scrub(local.squads),
          members: scrub(local.members), companies: scrub(local.companies),
          contacts: scrub(local.contacts), leads: scrub(local.leads),
          opportunities: scrub(local.opportunities), tasks: scrub(local.tasks),
          meetings: scrub(local.meetings), proposals: scrub(local.proposals),
          deals: scrub(local.deals), payments: scrub(local.payments),
          commissions: scrub(local.commissions), activities: scrub(local.activities),
          campaigns: scrub(local.campaigns), audit: scrub(local.audit),
          notifications: scrub(local.notifications),
        };
        const hasRemoteLeads = (partial.leads?.length ?? 0) > 0;
        if (!hasRemoteLeads) {
          // Fresh backend: no CRM rows exist anywhere. Start empty — demo seed
          // is local-only (logged-out demo mode) and must never pollute a live
          // system. Real cohorts/squads are created under Cohorts & squads.
          const clean: CrmState = {
            cohorts: [], squads: [], members: sieved.members, companies: [], contacts: [],
            leads: [], opportunities: [], tasks: [], meetings: [], proposals: [], deals: [],
            payments: [], commissions: [], activities: [], campaigns: [], audit: [],
            notifications: [], currentUserId: sieved.currentUserId,
          };
          setState(clean);
          lastPushedRef.current = clean;
          setSyncStatus("synced");
        } else {
          // Adopt remote as truth, but UNION in local-only rows (created
          // offline or still awaiting push) so no device-side work is dropped.
          // Remote wins on id conflicts.
          const union = <T extends { id: string }>(remoteRows: T[] | undefined, localRows: T[], fallback: T[]): T[] => {
            const base = remoteRows && remoteRows.length ? remoteRows : fallback;
            const ids = new Set(base.map((r) => r.id));
            return [...base, ...localRows.filter((r) => !ids.has(r.id))];
          };
          const merged: CrmState = {
            ...sieved,
            cohorts: partial.cohorts?.length ? partial.cohorts : sieved.cohorts,
            squads: partial.squads?.length ? partial.squads : sieved.squads,
            companies: union(partial.companies, sieved.companies, sieved.companies),
            contacts: union(partial.contacts, sieved.contacts, sieved.contacts),
            leads: union(partial.leads, sieved.leads, sieved.leads),
            opportunities: union(partial.opportunities, sieved.opportunities, sieved.opportunities),
            tasks: union(partial.tasks, sieved.tasks, sieved.tasks),
            meetings: union(partial.meetings, sieved.meetings, sieved.meetings),
            proposals: partial.proposals?.length ? partial.proposals : sieved.proposals,
            deals: union(partial.deals, sieved.deals, sieved.deals),
            payments: union(partial.payments, sieved.payments, sieved.payments),
            commissions: union(partial.commissions, sieved.commissions, sieved.commissions),
            activities: partial.activities ?? sieved.activities,
            campaigns: partial.campaigns?.length ? partial.campaigns : sieved.campaigns,
            audit: partial.audit ?? [...sieved.audit],
            notifications: union(partial.notifications, sieved.notifications, sieved.notifications),
          };
          // Append-only trackers: merge remote + any local-only entries.
          const remoteAct = new Set((partial.activities ?? []).map((a) => `${a.leadId}|${a.summary}|${a.createdAt}`));
          merged.activities = [...(partial.activities ?? []), ...sieved.activities.filter((a) => !ctx.pushedActivityIds.has(a.id) && !remoteAct.has(`${a.leadId}|${a.summary}|${a.createdAt}`))];
          setState(merged);
          lastPushedRef.current = merged;
          setSyncStatus("synced");
        }
        setRemoteBooted(true);
      } catch (e) {
        if (!cancelled) {
          setSyncStatus("error");
          setSyncError(e instanceof Error ? e.message.slice(0, 240) : "Remote boot failed — using local data.");
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote, auth.loading, auth.profilesReady, auth.user?.id, remoteBooted]);

  const value = useMemo<CrmContextValue>(() => {
    // Members = real Supabase profiles first, then local/seed directory.
    const seen = new Set<string>();
    const members: Member[] = [];
    for (const m of auth.members) {
      const key = (m.email || m.id).toLowerCase();
      if (!seen.has(key)) { seen.add(key); members.push(remapSquad(m)); }
    }
    for (const m of state.members) {
      const key = (m.email || m.id).toLowerCase();
      if (!seen.has(key)) { seen.add(key); members.push(m); }
    }
    const currentUser =
      (auth.ready && (auth.loading || (auth.user && !auth.currentMember)))
        ? {
            id: "resolving", name: "Loading…", email: "",
            role: "bdp" as const, squadId: null, cohortId: "", status: "active" as const,
            joinedAt: new Date().toISOString(), lastActiveAt: new Date().toISOString(), commissionRate: 0,
          }
        : (auth.currentMember && members.find((m) => m.id === remapSquad(auth.currentMember as Member).id)) ??
      members.find((m) => m.id === state.currentUserId) ??
      members[0] ??
      state.members[0] ?? {
        id: state.currentUserId || "u-owner", name: "Owner", email: "",
        role: "owner" as const, squadId: null, cohortId: "", status: "active" as const,
        joinedAt: new Date().toISOString(), lastActiveAt: new Date().toISOString(), commissionRate: 0,
      };

    function remapSquad(m: Member): Member {
      const num = m.squadId && m.squadId.startsWith("sq-") && /^\d+$/.test(m.squadId.slice(3))
        ? Number(m.squadId.slice(3)) : null;
      if (num != null) {
        const app = ctxRef.current.squadAppById.get(num);
        if (app) return { ...m, squadId: app };
      }
      return m;
    }

    return {
      ...state,
      members,
      currentUser,
      remote,
      syncStatus,
      syncError,
      switchUser: (id: string) => {
        if (auth.user) return; // authenticated sessions are fixed
        setState((s) => ({ ...s, currentUserId: id }));
      },
      update: (key, val) => { setState((s) => ({ ...s, [key]: val })); schedulePush(); },
      mutate: (fn) => { setState((s) => fn(s)); schedulePush(); },
      reset: () => {
        const fresh = initial();
        setState(fresh);
        lastPushedRef.current = fresh; // local-only reset, never deletes remote rows
      },
      clearDemo: () => {
        // Wipe every demo slice locally. Remote demo rows are deleted by
        // /api/team/clear-demo; remaining diffs are deletions, which never push.
        setState((st) => {
          const cleared: CrmState = {
            ...st,
            cohorts: [], squads: [], members: [], companies: [], contacts: [], leads: [],
            opportunities: [], tasks: [], meetings: [], proposals: [], deals: [], payments: [],
            commissions: [], activities: [], campaigns: [], audit: [], notifications: [],
          };
          lastPushedRef.current = cleared;
          return cleared;
        });
      },
      retrySync: () => {
        lastPushedRef.current = null;
        setRemoteBooted(false);
        setSyncError(null);
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, auth.members, auth.currentMember, auth.user, remote, syncStatus, syncError, remoteBooted]);

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm(): CrmContextValue {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error("useCrm must be used inside CrmProvider");
  return ctx;
}

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

export function audit(state: CrmState, actorId: string, action: string, entity: string, entityId: string, detail: string): AuditEntry[] {
  return [...state.audit, { id: uid("au"), at: new Date().toISOString(), actorId, action, entity, entityId, detail }];
}

export const fmtKES = (n: number) =>
  `KES ${Math.round(n).toLocaleString("en-KE")}`;

export const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

export const isOverdue = (iso: string) => new Date(iso).getTime() < Date.now();

export function findDuplicates(
  companies: Company[],
  leads: Lead[],
  candidate: { name: string; website?: string; email?: string; phone?: string }
): { company: Company; reason: string }[] {
  const norm = (s?: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const out: { company: Company; reason: string }[] = [];
  for (const c of companies) {
    const reasons: string[] = [];
    if (candidate.name && norm(c.name) === norm(candidate.name)) reasons.push("same business name");
    if (candidate.website && c.website && norm(c.website) === norm(candidate.website)) reasons.push("same website");
    if (candidate.email && c.email && c.email.toLowerCase() === candidate.email.toLowerCase()) reasons.push("same email");
    if (candidate.phone && c.phone && norm(c.phone) === norm(candidate.phone)) reasons.push("same phone");
    if (reasons.length) out.push({ company: c, reason: reasons.join(", ") });
  }
  return out;
}
