"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./config";

export function createClient() {
  const { url, publishableKey } = supabaseEnv();
  return createBrowserClient(url, publishableKey);
}
