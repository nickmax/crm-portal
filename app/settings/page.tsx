"use client";
import { useCrm } from "@/lib/crm/store";
import { PageHead } from "@/components/crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PERMISSIONS } from "@/lib/crm/permissions";

export default function SettingsPage() {
  const s = useCrm();
  const isOwner = s.currentUser.role === "owner";

  return (
    <div>
      <PageHead eyebrow="Settings & audit" title="Settings & audit" sub="Role permissions, escalation rules, integration health, and the full audit trail. Sensitive finance actions require owner approval."
        action={<Button variant="outline" className="rounded-full" onClick={() => { if (confirm("Reset demo data to seed?")) s.reset(); }}>Reset demo data</Button>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-xl">
          <CardHeader><CardTitle className="font-display text-2xl">Role permissions</CardTitle></CardHeader>
          <CardContent className="space-y-2 px-6 pb-6 text-sm">
            {(Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]).map((r) => (
              <div key={r} className="rounded-xl border border-foreground/10 p-3"><p className="font-medium">{r}{r === "owner" && " (you)"}</p><p className="font-mono text-xs text-muted-foreground">{PERMISSIONS[r].join(" · ")}</p></div>
            ))}
            <p className="rounded-xl bg-foreground/5 p-3 text-[13px]">Admins cannot alter paid commissions or financial records. Those actions require owner approval and leave an audit record.</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardHeader><CardTitle className="font-display text-2xl">Automation &amp; integrations</CardTitle></CardHeader>
          <CardContent className="space-y-2 px-6 pb-6 text-sm">
            {[
              ["New lead submitted", "Duplicate check → validate → queue for review", "live"],
              ["Lead accepted", "Assign owner + squad + follow-up deadline", "live"],
              ["Task overdue", "Notify owner → escalate to captain", "live"],
              ["Meeting booked", "Calendar event + reminder (integration)", "needs setup"],
              ["Opportunity stalls 7d", "Notify owner + captain → escalate", "live"],
              ["Proposal sent", "Schedule follow-up task", "live"],
              ["Payment recorded", "Update collected revenue + commission", "live"],
              ["Email sync / reply detection", "Provider integration with delivery checks", "needs setup"],
            ].map(([t, d, st]) => (
              <div key={t} className="flex items-center justify-between gap-3 rounded-xl border border-foreground/10 px-4 py-2.5">
                <div><p className="font-medium">{t}</p><p className="text-xs text-muted-foreground">{d}</p></div>
                <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase ${st === "live" ? "bg-green-600/15 text-green-800" : "bg-foreground/10 text-muted-foreground"}`}>{st}</span>
              </div>
            ))}
            {!isOwner && <p className="text-xs text-muted-foreground">Integration credentials are owner-managed.</p>}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4 rounded-xl">
        <CardHeader><CardTitle className="font-display text-2xl">Audit history</CardTitle></CardHeader>
        <CardContent className="space-y-1.5 px-6 pb-6 text-sm">
          {[...s.audit].reverse().slice(0, 30).map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-foreground/10 px-4 py-2">
              <span><span className="font-medium">{a.action}</span> <span className="text-muted-foreground">· {a.entity}/{a.entityId} · {a.detail}</span></span>
              <span className="font-mono text-[11px] text-muted-foreground">{new Date(a.at).toLocaleString()} · {s.members.find((m) => m.id === a.actorId)?.name ?? a.actorId}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
