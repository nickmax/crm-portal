"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./config";

let shared: SupabaseClient | null = null;

// One shared browser client: session state (and its async storage hydration)
// is consistent across every fetch/push, avoiding unauthenticated races.
export function createClient(): SupabaseClient {
  if (!shared) {
    const { url, publishableKey } = supabaseEnv();
    shared = createBrowserClient(url, publishableKey);
  }
  return shared;
}
