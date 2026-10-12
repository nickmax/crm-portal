"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Member, Role } from "@/lib/crm/types";

export interface ProfileRow {
  id: string;
  email: string | null;
  role: string | null;
  crm_role?: string | null;
  display_name?: string | null;
  app_ref?: string | null;
  commission_rate?: number | null;
  squad_id?: number | null;
}

interface AuthValue {
  ready: boolean; // supabase configured?
  loading: boolean;
  user: User | null;
  profile: ProfileRow | null;
  profiles: ProfileRow[];
  members: Member[]; // profiles mapped to CRM members
  currentMember: Member | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

const LEGACY_ROLE_MAP: Record<string, Role> = {
  admin: "owner",
  sales_manager: "sales",
  operator: "bdp",
  analyst: "bdp",
};

export function profileToMember(p: ProfileRow): Member {
  // Legacy `admin` profiles predate crm_role (which defaults to 'bdp' on old
  // rows) — they own the business, so they map to owner first.
  const role: Role =
    p.role === "admin"
      ? "owner"
      : ["owner", "admin", "captain", "bdp", "sales"].includes(p.crm_role ?? "")
        ? (p.crm_role as Role)
        : (LEGACY_ROLE_MAP[p.role ?? ""] ?? "bdp");
  return {
    id: p.app_ref ?? p.id,
    name: p.display_name ?? p.email ?? "Team member",
    email: p.email ?? "",
    role,
    squadId: p.squad_id != null ? `sq-${p.squad_id}` : null,
    cohortId: "co-2026-q1",
    status: "active",
    joinedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    commissionRate: Number(p.commission_rate ?? 0.1),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const ready = isSupabaseConfigured();
  const [loading, setLoading] = useState(ready);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [allProfiles, setAllProfiles] = useState<ProfileRow[]>([]);

  const loadProfile = useCallback(async (userId: string, email?: string | null) => {
    const sb = createClient();
    const { data } = await sb.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (data) {
      setProfile(data as ProfileRow);
      return data as ProfileRow;
    }
    // First login: self-provision (migration grants INSERT on own id)
    const { data: created } = await sb
      .from("profiles")
      .insert({ id: userId, email: email ?? null })
      .select("*")
      .maybeSingle();
    if (created) setProfile(created as ProfileRow);
    return (created as ProfileRow | null) ?? null;
  }, []);

  const loadAll = useCallback(async () => {
    const sb = createClient();
    const { data } = await sb.from("profiles").select("*").limit(200);
    if (data) setAllProfiles(data as ProfileRow[]);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const sb = createClient();
    sb.auth.getSession().then(async ({ data }) => {
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        await loadProfile(data.session.user.id, data.session.user.email);
        await loadAll();
      }
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange(async (_ev, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadProfile(session.user.id, session.user.email);
        await loadAll();
      } else {
        setProfile(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [ready, loadProfile, loadAll]);

  const signIn = useCallback(async (email: string, password: string) => {
    const sb = createClient();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const sb = createClient();
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      // Best effort: provision + name immediately (RLS self-provision covers it)
      await sb.from("profiles").upsert(
        { id: data.user.id, email, display_name: name },
        { onConflict: "id" }
      );
      await loadProfile(data.user.id, email);
      await loadAll();
    }
    return {};
  }, [loadProfile, loadAll]);

  const signOut = useCallback(async () => {
    const sb = createClient();
    await sb.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthValue>(() => {
    const members = allProfiles.map(profileToMember);
    const currentMember = profile ? profileToMember(profile) : null;
    return {
      ready, loading, user, profile, profiles: allProfiles, members, currentMember,
      signIn, signUp, signOut,
      refreshProfile: async () => { if (user) await loadProfile(user.id, user.email); },
    };
  }, [ready, loading, user, profile, allProfiles, signIn, signUp, signOut, loadProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
