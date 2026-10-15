"use client";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

// One human tap verifies the email link (safe against link prefetchers),
// then lands the user where the email intended.
export default function ConfirmPage() {
  return (
    <Suspense fallback={<p className="py-24 text-center font-mono text-xs text-muted-foreground">Loading…</p>}>
      <ConfirmInner />
    </Suspense>
  );
}

function ConfirmInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token_hash = params.get("token_hash") ?? "";
  const type = (params.get("type") ?? "") as "signup" | "invite" | "magiclink" | "recovery" | "email_change";
  const next = params.get("next") ?? "/";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titles: Record<string, { eyebrow: string; head: string; body: string; cta: string }> = {
    invite: { eyebrow: "You're invited", head: "One tap to step in", body: "Confirm this was you, then choose your password.", cta: "Confirm & continue" },
    recovery: { eyebrow: "Password reset", head: "Confirm it's you", body: "Then choose a new password. This link expires in one hour.", cta: "Confirm & continue" },
    email_change: { eyebrow: "New email", head: "Confirm the change", body: "This confirms your new sign-in address.", cta: "Confirm new email" },
    signup: { eyebrow: "Welcome", head: "Confirm your email", body: "One tap to finish setting up your account.", cta: "Confirm & continue" },
    magiclink: { eyebrow: "Sign in", head: "Confirm it's you", body: "This link expires shortly and works once.", cta: "Sign me in" },
  };
  const t = titles[type] ?? titles.magiclink;

  const confirm = async () => {
    setBusy(true); setError(null);
    const { error } = await createClient().auth.verifyOtp({ token_hash, type });
    setBusy(false);
    if (error) setError("That link is invalid or has expired. Ask your administrator for a fresh one.");
    else router.replace(next);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col items-center justify-center px-6 py-16">
      <Image src="/logo.png" alt="Mathenge Inc" width={606} height={447} className="h-11 w-auto object-contain" />
      <span className="mt-4 rounded-full border border-foreground/15 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        {t.eyebrow}
      </span>
      <h1 className="mt-4 text-center font-display text-4xl tracking-tight">{t.head}</h1>
      <Card className="mt-8 w-full rounded-2xl">
        <CardContent className="space-y-3 px-6 py-6">
          <p className="text-center text-sm text-muted-foreground">{t.body}</p>
          {!token_hash && <p className="rounded-xl bg-red-600/10 px-4 py-2.5 text-[13px] text-red-800">This link is incomplete — ask your administrator for a fresh one.</p>}
          {error && <p className="rounded-xl bg-red-600/10 px-4 py-2.5 text-[13px] text-red-800">{error}</p>}
          <Button className="w-full rounded-full btn-brand" disabled={busy || !token_hash} onClick={confirm}>
            {busy ? "Confirming…" : t.cta}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
