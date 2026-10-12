"use client";

import { useEffect, useState } from "react";
import { PageHead } from "@/components/crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCrm } from "@/lib/crm/store";

interface FileRow { name: string; size: number; updated: string }

export default function FilesPage() {
  const { currentUser } = useCrm();
  const canUpload = ["owner", "admin", "captain"].includes(currentUser.role);
  const canDelete = ["owner", "admin"].includes(currentUser.role);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [notify, setNotify] = useState(true);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/files");
      const j = await r.json();
      if (r.ok) setFiles(j.files);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const upload = async () => {
    if (!file) return;
    setBusy(true); setMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("notify", String(notify));
      form.append("message", note || "A new file was shared in the management hub.");
      const r = await fetch("/api/files", { method: "POST", body: form });
      const j = await r.json();
      setMsg(r.ok ? `Uploaded — ${j.notified} teammates notified.` : `Failed — ${j.error}`);
      if (r.ok) { setFile(null); setNote(""); load(); }
    } catch { setMsg("Failed — network error."); }
    setBusy(false);
  };

  const remove = async (name: string) => {
    if (!confirm(`Delete ${name}?`)) return;
    const r = await fetch(`/api/files?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    if (r.ok) load();
  };

  return (
    <div>
      <PageHead
        eyebrow="Management hub · one shared home for team files"
        title="Files & resources"
        sub="Playbooks, price lists, decks, contracts, training — uploaded once, visible to everyone signed in, announced to the team."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-xl lg:col-span-2">
          <CardHeader><CardTitle className="font-display text-2xl">Shared files</CardTitle></CardHeader>
          <CardContent className="space-y-2 px-6 pb-6">
            {loading && <p className="font-mono text-xs text-muted-foreground">Loading…</p>}
            {!loading && files.length === 0 && <p className="text-sm text-muted-foreground">No files yet — upload the first playbook.</p>}
            {files.map((f) => (
              <div key={f.name} className="flex items-center justify-between gap-3 rounded-xl border border-foreground/10 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{f.name.split("/").pop()}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{Math.max(1, Math.round(f.size / 1024))} KB · {new Date(f.updated).toLocaleDateString()}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <a href={`/api/files?download=${encodeURIComponent(f.name)}`} className="rounded-full border border-foreground/15 px-3.5 py-1.5 text-[13px] font-medium hover:bg-foreground hover:text-background">Download</a>
                  {canDelete && <button onClick={() => remove(f.name)} className="rounded-full border border-red-300 px-3.5 py-1.5 text-[13px] text-red-700 hover:bg-red-600 hover:text-white">Delete</button>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardHeader><CardTitle className="font-display text-2xl">Upload</CardTitle></CardHeader>
          <CardContent className="space-y-3 px-6 pb-6">
            {canUpload ? (
              <>
                <div>
                  <Label>File (25 MB max)</Label>
                  <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 rounded-xl" />
                </div>
                <div>
                  <Label>Note for the team</Label>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Q1 price list — use this version" className="mt-1 h-10 rounded-xl" />
                </div>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-foreground/10 px-4 py-3 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                  Notify the whole team
                </label>
                {msg && <p className="rounded-xl bg-foreground/5 px-4 py-2.5 text-[13px]">{msg}</p>}
                <Button className="w-full rounded-full bg-foreground text-background" disabled={busy || !file} onClick={upload}>
                  {busy ? "Uploading…" : "Upload & share"}
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Only owners, admins and captains can upload. Everything here is downloadable by you.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
