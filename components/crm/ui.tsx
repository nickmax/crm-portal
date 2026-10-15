"use client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LeadStatus, OppStage } from "@/lib/crm/types";
import { LEAD_STATUS_LABEL, OPP_STAGE_LABEL } from "@/lib/crm/types";

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-3 font-mono text-xs text-muted-foreground">
      <span className="h-px w-8 bg-brand" />
      {children}
    </span>
  );
}

export function PageHead({ eyebrow, title, sub, action }: { eyebrow: string; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl lg:text-5xl">{title}</h1>
        {sub && <p className="mt-2 max-w-xl text-muted-foreground">{sub}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, href }: { label: string; value: string; hint?: string; href?: string }) {
  const inner = (
    <Card className="rounded-xl py-4 transition-transform hover:-translate-y-0.5">
      <CardContent className="px-5">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-3xl">{value}</p>
        {hint && <p className="mt-1 text-[13px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
  return href ? <a href={href} className="block">{inner}</a> : inner;
}

const LEAD_TONE: Record<string, string> = {
  new: "bg-brand text-white",
  under_review: "bg-foreground/10 text-foreground",
  accepted: "bg-green-600/15 text-green-800",
  contacting: "bg-foreground/10 text-foreground",
  qualified: "bg-green-600/15 text-green-800",
  meeting_booked: "bg-brand text-white",
  proposal: "bg-brand text-white",
  won: "bg-green-700 text-white",
  lost: "bg-red-600/15 text-red-800",
  rejected: "bg-red-600/15 text-red-800",
  duplicate: "bg-foreground/10 text-muted-foreground",
  paused: "bg-foreground/10 text-muted-foreground",
};

export function LeadBadge({ status }: { status: LeadStatus }) {
  return <Badge className={cn("rounded-full border-0", LEAD_TONE[status] ?? "bg-secondary text-secondary-foreground")}>{LEAD_STATUS_LABEL[status]}</Badge>;
}

export function StageBadge({ stage }: { stage: OppStage }) {
  const hot = ["proposal", "negotiation"].includes(stage);
  const done = stage === "won";
  const bad = stage === "lost";
  return (
    <Badge className={cn("rounded-full border-0", done ? "bg-green-700 text-white" : bad ? "bg-red-600/15 text-red-800" : hot ? "bg-brand text-white" : "bg-secondary text-secondary-foreground")}>
      {OPP_STAGE_LABEL[stage]}
    </Badge>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <Card className="rounded-xl">
      <CardHeader><CardTitle className="font-display text-2xl">{title}</CardTitle><CardDescription>{body}</CardDescription></CardHeader>
    </Card>
  );
}
