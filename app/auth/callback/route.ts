import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "@/lib/supabase/config";

// Completes email-link flows (team invites, password resets):
// /auth/callback?token_hash=…&type=invite|recovery|email_change&next=/set-password
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? "magiclink") as
    "signup" | "invite" | "magiclink" | "recovery" | "email_change";
  const next = url.searchParams.get("next") ?? "/";
  const login = new URL("/login", url.origin);

  if (!token_hash) {
    login.searchParams.set("error", "That link is missing its token. Ask your administrator for a fresh one.");
    return NextResponse.redirect(login);
  }

  const store = await cookies();
  const { url: sbUrl, publishableKey } = supabaseEnv();
  const supabase = createServerClient(sbUrl, publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try { toSet.forEach(({ name, value, options }) => store.set(name, value, options)); } catch {}
      },
    },
  });
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) {
    login.searchParams.set("error", "That link is invalid or has expired. Ask your administrator for a fresh one.");
    return NextResponse.redirect(login);
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
