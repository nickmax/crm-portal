"use client";
import Link from "next/link";
import { useCrm } from "@/lib/crm/store";
import { PageHead } from "@/components/crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function TasksPage() {
  const s = useCrm();
  const mine = s.tasks.filter((t) => t.ownerId === s.currentUserId);
  const open = mine.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => new Date(t.dueAt).getTime() < Date.now());
  const upcoming = open.filter((t) => new Date(t.dueAt).getTime() >= Date.now());

  const done = (id: string) => s.mutate((st) => ({ ...st, tasks: st.tasks.map((t) => t.id === id ? { ...t, status: "done" as const } : t) }));

  const Group = ({ title, items, tone }: { title: string; items: typeof mine; tone?: string }) => (
    <Card className="rounded-xl">
      <CardHeader><CardTitle className="font-display text-2xl">{title} <span className={`font-mono text-sm ${tone ?? "text-muted-foreground"}`}>· {items.length}</span></CardTitle></CardHeader>
      <CardContent className="space-y-2 px-6 pb-6">
        {items.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-foreground/10 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{t.title}</p>
              <p className="text-xs text-muted-foreground">Due {new Date(t.dueAt).toLocaleString()} {t.leadId && <Link href={`/leads/${t.leadId}`} className="underline">· open lead</Link>}</p>
            </div>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => done(t.id)}>Done</Button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">Nothing here.</p>}
      </CardContent>
    </Card>
  );

  return (
    <div>
      <PageHead eyebrow="Follow-up discipline" title="Tasks" sub="One obvious next step per lead. Overdue items escalate to your captain automatically." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Group title="Overdue — act first" items={overdue} tone="text-red-700" />
        <Group title="Upcoming" items={upcoming} />
      </div>
    </div>
  );
}
