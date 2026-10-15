"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email) { setError("Enter your work email."); return; }
    setBusy(true);
    const sb = createClient();
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/set-password`,
    });
    setBusy(false);
    if (error) setError("Something went wrong — try again or ask your administrator.");
    else setDone(true);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col items-center justify-center px-6 py-16">
      <Image src="/logo.png" alt="Mathenge Inc" width={606} height={447} className="h-11 w-auto object-contain" />
      <span className="mt-4 rounded-full border border-foreground/15 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        Reset password
      </span>
      <h1 className="mt-4 text-center font-display text-4xl tracking-tight">We&apos;ll email you a reset link</h1>
      <Card className="mt-8 w-full rounded-2xl">
        <CardContent className="space-y-3 px-6 py-6">
          {done ? (
            <p className="rounded-xl bg-green-600/10 px-4 py-3 text-sm text-green-800">
              If that email has an account, a reset link is on its way. It expires in one hour.
            </p>
          ) : (
            <>
              <div><Label>Work email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mathengeinc.com" className="mt-1 h-11 rounded-xl" autoComplete="email" inputMode="email"
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }} /></div>
              {error && <p className="rounded-xl bg-red-600/10 px-4 py-2.5 text-[13px] text-red-800">{error}</p>}
              <Button className="w-full rounded-full btn-brand" disabled={busy} onClick={submit}>
                {busy ? "Sending…" : "Send reset link"}
              </Button>
            </>
          )}
          <Link href="/login" className="block text-center text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground">Back to sign in</Link>
        </CardContent>
      </Card>
    </div>
  );
}
