"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/crm/auth";
import { useCrm } from "@/lib/crm/store";
import { ROLE_LABEL } from "@/lib/crm/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.ready && !auth.loading && auth.user) router.replace("/");
  }, [auth.ready, auth.loading, auth.user, router]);

  return (
    <div className="mx-auto flex min-h-screen max-w-[720px] flex-col items-center justify-center px-6 py-16">
      <Image src="/logo.png" alt="Mathenge Inc" width={606} height={447} className="h-12 w-auto object-contain" />
      <span className="mt-4 rounded-full border border-foreground/15 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        BDP CRM · Sign in
      </span>
      <h1 className="mt-4 text-center font-display text-5xl tracking-tight">The operating system for your sales network</h1>
      {auth.ready ? (
        <SupabaseLogin />
      ) : (
        <>
          <p className="mt-3 text-center text-muted-foreground">Supabase is not configured — pick a demo profile. Permissions match the real roles.</p>
          <DemoPicker />
        </>
      )}
    </div>
  );
}

function SupabaseLogin() {
  const auth = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email || password.length < 6) { setError("Enter a valid email and a 6+ character password."); return; }
    setBusy(true);
    const res = mode === "in"
      ? await auth.signIn(email.trim(), password)
      : await auth.signUp(email.trim(), password, name.trim() || email.split("@")[0]);
    setBusy(false);
    if (res.error) setError(res.error);
  };

  return (
    <div className="mt-8 w-full max-w-md">
      <Card className="rounded-2xl">
        <CardContent className="space-y-3 px-6 py-6">
          <div className="flex rounded-full border border-foreground/15 p-1 text-sm">
            {(["in", "up"] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(null); }}
                className={`flex-1 rounded-full px-4 py-2 font-medium transition-colors ${mode === m ? "bg-foreground text-background" : "text-muted-foreground"}`}>
                {m === "in" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>
          {mode === "up" && (
            <div><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Amina N." className="mt-1 h-11 rounded-xl" autoComplete="name" /></div>
          )}
          <div><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mathengeinc.com" className="mt-1 h-11 rounded-xl" autoComplete="email" inputMode="email" /></div>
          <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1 h-11 rounded-xl" autoComplete={mode === "in" ? "current-password" : "new-password"}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }} /></div>
          {error && <p className="rounded-xl bg-red-600/10 px-4 py-2.5 text-[13px] text-red-800">{error}</p>}
          <Button className="w-full rounded-full bg-foreground text-background" disabled={busy || auth.loading} onClick={submit}>
            {busy ? "Please wait…" : mode === "in" ? "Sign in with Supabase Auth" : "Create account"}
          </Button>
          <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
            New accounts start as BDP. An owner sets captain / admin / sales roles in
            Supabase → profiles → crm_role. The existing admin profile signs in as owner.
          </p>
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
