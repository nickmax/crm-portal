"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type {
  Activity, AuditEntry, Campaign, Cohort, Commission, Company, Contact, CrmTask,
  Deal, Lead, Meeting, Member, Notification, Opportunity, Payment, Proposal, Squad,
} from "./types";
import { seedAll, seedCohorts, seedSquads } from "./seed";
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
        const hasRemoteLeads = (partial.leads?.length ?? 0) > 0;
        if (!hasRemoteLeads) {
          // Fresh backend: no CRM rows exist anywhere. Start empty — demo seed
          // is local-only (logged-out demo mode) and must never pollute a live
          // system. Real cohorts/squads are created under Cohorts & squads.
          const clean: CrmState = {
            cohorts: [], squads: [], members: local.members, companies: [], contacts: [],
            leads: [], opportunities: [], tasks: [], meetings: [], proposals: [], deals: [],
            payments: [], commissions: [], activities: [], campaigns: [], audit: [],
            notifications: [], currentUserId: local.currentUserId,
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
            ...local,
            cohorts: partial.cohorts?.length ? partial.cohorts : local.cohorts,
            squads: partial.squads?.length ? partial.squads : local.squads,
            companies: union(partial.companies, local.companies, local.companies),
            contacts: union(partial.contacts, local.contacts, local.contacts),
            leads: union(partial.leads, local.leads, local.leads),
            opportunities: union(partial.opportunities, local.opportunities, local.opportunities),
            tasks: union(partial.tasks, local.tasks, local.tasks),
            meetings: union(partial.meetings, local.meetings, local.meetings),
            proposals: partial.proposals?.length ? partial.proposals : local.proposals,
            deals: union(partial.deals, local.deals, local.deals),
            payments: union(partial.payments, local.payments, local.payments),
            commissions: union(partial.commissions, local.commissions, local.commissions),
            activities: partial.activities ?? local.activities,
            campaigns: partial.campaigns?.length ? partial.campaigns : local.campaigns,
            audit: partial.audit ?? [...local.audit],
            notifications: union(partial.notifications, local.notifications, local.notifications),
          };
          // Append-only trackers: merge remote + any local-only entries.
          const remoteAct = new Set((partial.activities ?? []).map((a) => `${a.leadId}|${a.summary}|${a.createdAt}`));
          merged.activities = [...(partial.activities ?? []), ...local.activities.filter((a) => !ctx.pushedActivityIds.has(a.id) && !remoteAct.has(`${a.leadId}|${a.summary}|${a.createdAt}`))];
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
