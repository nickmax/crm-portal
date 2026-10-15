"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCrm, fmtKES } from "@/lib/crm/store";
import { PageHead, LeadBadge } from "@/components/crm/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const FILTERS = ["All", "Decision-makers", "Missing phone", "Missing email"] as const;

function digits(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0")) d = `254${d.slice(1)}`;
  return d;
}

export default function PhonebookPage() {
  const s = useCrm();
  const allowed = ["owner", "admin"].includes(s.currentUser.role);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const rows = useMemo(() => {
    if (!allowed) return [];
    let list = s.contacts.map((c) => {
      const company = s.companies.find((x) => x.id === c.companyId);
      const lead = s.leads.find((l) => l.companyId === c.companyId);
      const owner = lead ? s.members.find((m) => m.id === lead.ownerId) : undefined;
      const squad = lead ? s.squads.find((sq) => sq.id === lead.squadId) : undefined;
      return { c, company, lead, owner, squad };
    });
    if (filter === "Decision-makers") list = list.filter((r) => r.c.decisionMaker);
    if (filter === "Missing phone") list = list.filter((r) => !r.c.phone);
    if (filter === "Missing email") list = list.filter((r) => !r.c.email);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((r) =>
        r.c.name.toLowerCase().includes(needle) ||
        (r.c.role ?? "").toLowerCase().includes(needle) ||
        (r.c.email ?? "").toLowerCase().includes(needle) ||
        (r.c.phone ?? "").includes(needle) ||
        (r.company?.name ?? "").toLowerCase().includes(needle) ||
        (r.company?.industry ?? "").toLowerCase().includes(needle)
      );
    }
    return [...list].sort((a, b) => a.c.name.localeCompare(b.c.name));
  }, [s.contacts, s.companies, s.leads, s.members, s.squads, allowed, filter, q]);

  const stats = useMemo(() => ({
    total: s.contacts.length,
    dm: s.contacts.filter((c) => c.decisionMaker).length,
    withPhone: s.contacts.filter((c) => c.phone).length,
    missing: s.contacts.filter((c) => !c.email || !c.phone).length,
  }), [s.contacts]);

  if (!allowed) {
    return (
      <div>
        <PageHead eyebrow="Phonebook" title="Phonebook" sub="Every contact across every lead." />
        <Card className="rounded-xl"><CardContent className="px-6 py-6 text-sm text-muted-foreground">Only owners and admins can open the phonebook.</CardContent></Card>
      </div>
    );
  }

  return (
    <div>
      <PageHead
        eyebrow="Phonebook · every contact, one directory"
        title="Phonebook"
        sub={`${stats.total} contacts · ${stats.dm} decision-makers · ${stats.withPhone} with phone · ${stats.missing} missing email or phone.`}
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, role, email, phone, company, industry…" className="h-11 rounded-full lg:max-w-md" />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn(
              "inline-flex min-h-[44px] items-center rounded-full border px-4 py-2 text-[13px] font-medium transition-colors",
              filter === f ? "pill-brand" : "border-foreground/15 hover:bg-foreground/5"
            )}>{f}</button>
          ))}
        </div>
      </div>
      {rows.length === 0 && (
        <Card className="rounded-xl"><CardContent className="px-6 py-6 text-sm text-muted-foreground">No contacts match. Add contacts from any lead profile — they land here automatically.</CardContent></Card>
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ c, company, lead, owner, squad }) => (
          <Card key={c.id} className="rounded-xl py-0 transition-transform hover:-translate-y-0.5">
            <CardContent className="px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand font-display text-xl text-white">
                  {c.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="truncate text-[13px] text-muted-foreground">{c.role ?? "Role unknown"}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {c.decisionMaker && <Badge className="rounded-full border-0 bg-brand/15 text-brand-deep">Decision-maker</Badge>}
                    {lead && <LeadBadge status={lead.status} />}
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-[13px]">
                {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-brand-deep hover:underline"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{c.email}</span></a>}
                {c.phone && (
                  <span className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span>{c.phone}</span>
                  </span>
                )}
                {!c.email && !c.phone && <p className="text-muted-foreground">No email or phone — edit the contact to add one.</p>}
                <p className="truncate text-muted-foreground">
                  {company ? <>{company.name} · {company.industry}{company.location ? ` · ${company.location}` : ""}</> : "Company removed"}
                </p>
                {lead && (
                  <p className="truncate font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {owner?.name ?? "Unassigned"}{squad ? ` · ${squad.name}` : ""} · {fmtKES(lead.valuePotential)}
                  </p>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.phone && <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-deep"><Phone className="h-3.5 w-3.5" /> Call</a>}
                {c.phone && <a href={`https://wa.me/${digits(c.phone)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-foreground/15 px-4 py-2 text-[13px] font-medium hover:bg-foreground hover:text-background"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>}
                {c.email && <a href={`mailto:${c.email}`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-foreground/15 px-4 py-2 text-[13px] font-medium hover:bg-foreground hover:text-background"><Mail className="h-3.5 w-3.5" /> Email</a>}
                {lead && <Link href={`/leads/${lead.id}`} className="inline-flex min-h-[44px] items-center rounded-full border border-foreground/15 px-4 py-2 text-[13px] font-medium hover:bg-foreground hover:text-background">Open lead</Link>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
