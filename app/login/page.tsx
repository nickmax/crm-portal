"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/lib/crm/auth";
import { useCrm } from "@/lib/crm/store";
import { ROLE_LABEL } from "@/lib/crm/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const auth = useAuth();
  return (
    <div className="mx-auto flex min-h-screen max-w-[720px] flex-col items-center justify-center px-6 py-16">
      <Image src="/logo.png" alt="Mathenge Inc" width={606} height={447} className="h-12 w-auto object-contain" />
      <span className="mt-4 rounded-full border border-foreground/15 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        BDP CRM · Sign in
      </span>
      <h1 className="mt-4 text-center font-display text-5xl tracking-tight">The operating system for your sales network</h1>
      {auth.ready ? (
        <Suspense fallback={<p className="mt-8 font-mono text-xs text-muted-foreground">Loading…</p>}>
          <SignInForm />
        </Suspense>
      ) : (
        <>
          <p className="mt-3 text-center text-muted-foreground">Pick a demo profile to explore.</p>
          <DemoPicker />
        </>
      )}
    </div>
  );
}

function SignInForm() {
  const auth = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("error") ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth.loading && auth.user) router.replace("/");
  }, [auth.loading, auth.user, router]);

  const submit = async () => {
    setError(null);
    if (!email || !password) { setError("Enter your work email and password."); return; }
    setBusy(true);
    const res = await auth.signIn(email.trim(), password);
    setBusy(false);
    if (res.error) setError("Those details didn't match. Check with your administrator if you're stuck.");
    else router.replace("/");
  };

  return (
    <div className="mt-8 w-full max-w-md">
      <Card className="rounded-2xl">
        <CardContent className="space-y-3 px-6 py-6">
          <div><Label>Work email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mathengeinc.com" className="mt-1 h-11 rounded-xl" autoComplete="email" inputMode="email" /></div>
          <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1 h-11 rounded-xl" autoComplete="current-password"
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }} /></div>
          {error && <p className="rounded-xl bg-red-600/10 px-4 py-2.5 text-[13px] text-red-800">{error}</p>}
          <Button className="w-full rounded-full bg-foreground text-background" disabled={busy || auth.loading} onClick={submit}>
            {busy ? "Signing you in…" : "Sign in"}
          </Button>
          <div className="flex items-center justify-between pt-1 text-[13px]">
            <Link href="/forgot-password" className="text-muted-foreground underline underline-offset-4 hover:text-foreground">Forgot password?</Link>
            <span className="font-mono text-[11px] text-muted-foreground">No account yet? Your administrator creates one when you join.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DemoPicker() {
  const { members, switchUser } = useCrm();
  const router = useRouter();
  return (
    <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
      {members.map((m) => (
        <Card key={m.id} className="rounded-xl py-0 transition-transform hover:-translate-y-0.5">
          <CardContent className="flex items-center gap-3 px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground font-display text-lg text-background">{m.name.charAt(0)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{m.name}</p>
              <p className="truncate font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{ROLE_LABEL[m.role]}</p>
            </div>
            <Button size="sm" className="rounded-full bg-foreground text-background" onClick={() => { switchUser(m.id); router.push("/"); }}>Enter</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
