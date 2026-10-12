import { NextResponse } from "next/server";

// Entry point for all email links. Deliberately does NOT verify the token:
// some email security tools prefetch links, which would burn single-use
// tokens before the human taps them. Instead we forward to /auth/confirm,
// where the user taps a button that verifies (docs: "Option 2" pattern).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next") ?? "/";
  const login = new URL("/login", url.origin);

  if (!token_hash || !type) {
    login.searchParams.set("error", "That link is missing its token. Ask your administrator for a fresh one.");
    return NextResponse.redirect(login);
  }
  const confirm = new URL("/auth/confirm", url.origin);
  confirm.searchParams.set("token_hash", token_hash);
  confirm.searchParams.set("type", type);
  confirm.searchParams.set("next", next);
  return NextResponse.redirect(confirm);
}
