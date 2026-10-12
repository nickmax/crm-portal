import { NextResponse } from "next/server";

// Entry point for all email links. Forwards everything to /auth/confirm,
// where one human tap verifies (prefetch-safe: scanners can't burn the token).
// Links already consumed by Supabase-side verification (default templates)
// arrive without a token — they still land on `next` instead of erroring.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/";
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  const confirm = new URL("/auth/confirm", url.origin);
  if (token_hash) confirm.searchParams.set("token_hash", token_hash);
  if (type) confirm.searchParams.set("type", type);
  confirm.searchParams.set("next", next);
  return NextResponse.redirect(confirm);
}
