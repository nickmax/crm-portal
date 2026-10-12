"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

// Used for first-time invites AND password resets — both arrive here with a
// valid session via /auth/callback?next=/set-password.
export default function SetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => {
      if (!data.session) setError("This link is invalid or has expired. Ask your administrator for a fresh one.");
      setReady(true);
    });
  }, []);

  const submit = async () => {
    setError(null);
    if (password.length < 8) { setError("Use at least 8 characters."); return; }
    if (password !== confirm) { setError("The two passwords don't match."); return; }
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) setError("Couldn't save that password — try again.");
    else router.replace("/");
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col items-center justify-center px-6 py-16">
      <Image src="/logo.png" alt="Mathenge Inc" width={606} height={447} className="h-11 w-auto object-contain" />
      <span className="mt-4 rounded-full border border-foreground/15 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        Set password
      </span>
      <h1 className="mt-4 text-center font-display text-4xl tracking-tight">Choose your password</h1>
      <Card className="mt-8 w-full rounded-2xl">
        <CardContent className="space-y-3 px-6 py-6">
          {!ready && <p className="font-mono text-xs text-muted-foreground">Checking your link…</p>}
          {ready && error && !password && <p className="rounded-xl bg-red-600/10 px-4 py-2.5 text-[13px] text-red-800">{error}</p>}
          {ready && (
            <>
              <div><Label>New password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8+ characters" className="mt-1 h-11 rounded-xl" autoComplete="new-password" /></div>
              <div><Label>Repeat password</Label><Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat it" className="mt-1 h-11 rounded-xl" autoComplete="new-password"
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }} /></div>
              {error && password && <p className="rounded-xl bg-red-600/10 px-4 py-2.5 text-[13px] text-red-800">{error}</p>}
              <Button className="w-full rounded-full bg-foreground text-background" disabled={busy} onClick={submit}>
                {busy ? "Saving…" : "Save & enter"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
