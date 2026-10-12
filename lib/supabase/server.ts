import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./config";

export async function createServerSupabase() {
  const { url, publishableKey } = supabaseEnv();
  const store = await cookies();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component where writes are ignored;
          // proxy.ts refresh handles persistence.
        }
      },
    },
  });
}
