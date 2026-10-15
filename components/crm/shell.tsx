"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Target, KanbanSquare, CheckSquare, CalendarDays,
  Users, Wallet, Megaphone, BarChart3, IdCard, Settings, Menu, X, LogOut, Send, FolderOpen, BookOpen,
} from "lucide-react";
import { NotificationsPanel } from "@/components/crm/notifications-panel";
import { useCrm } from "@/lib/crm/store";
import { useAuth } from "@/lib/crm/auth";
import { NAV_BY_ROLE } from "@/lib/crm/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {  "layout-dashboard": LayoutDashboard, target: Target, kanban: KanbanSquare,
  check: CheckSquare, calendar: CalendarDays, users: Users, wallet: Wallet,
  megaphone: Megaphone, chart: BarChart3, id: IdCard, settings: Settings,
  send: Send, folder: FolderOpen, book: BookOpen,
};

const PUBLIC_AUTH_ROUTES = ["/login", "/forgot-password", "/set-password", "/auth/"];

function isPublicAuthRoute(pathname: string): boolean {
  return PUBLIC_AUTH_ROUTES.some((r) => pathname === r || pathname.startsWith(r));
}

export function CrmShell({ children }: { children: React.ReactNode }) {
  const { currentUser, members, switchUser, tasks, remote, syncStatus, syncError, retrySync } = useCrm();
  const auth = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Seed data contains relative timestamps evaluated at module load, which
  // differ between server prerender and client hydration (React #418).
  // This is a signed-in app, so render shell chrome only after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isPublicAuthRoute(pathname)) return;
    if (auth.ready && !auth.loading && !auth.user) router.replace("/login");
  }, [auth.ready, auth.loading, auth.user, router, pathname]);

  // Public auth routes render without the shell or the sign-in gate —
  // they must work with NO session (invite links, resets, new passwords).
  // (Shell chrome itself renders post-mount — see below.)
  if (!mounted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Mathenge Inc. · BDP CRM</span>
        <span className="font-display text-2xl">Opening your workspace…</span>
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full w-1/2 rounded-full bg-foreground/60 marquee" />
        </div>
      </div>
    );
  }
  if (isPublicAuthRoute(pathname)) return <>{children}</>;

  const nav = NAV_BY_ROLE[currentUser.role] ?? NAV_BY_ROLE.bdp;
  const myOverdue = tasks.filter((t) => t.ownerId === currentUser.id && t.status !== "done" && new Date(t.dueAt).getTime() < Date.now()).length;

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Brand — mirrors sitev2 header logo lockup */}
      <Link href="/" className="flex items-center gap-3 px-5 pt-6 pb-5">
        <Image src="/logo.png" alt="Mathenge Inc" width={606} height={447} className="h-9 w-auto object-contain" priority />
        <span className="rounded-full border border-foreground/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          BDP CRM
        </span>
      </Link>
      {/* Session card: signed-in user, otherwise demo switcher */}
      <div className="px-4 pb-4">
        {auth.user ? (
          <div className="rounded-xl border border-foreground/10 bg-card p-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Signed in</p>
            <p className="mt-0.5 truncate text-sm font-medium">{currentUser.name}</p>
            <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{auth.user.email}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase ${remote ? "bg-green-600/15 text-green-800" : "bg-foreground/10 text-muted-foreground"}`}>
                {remote ? `Live · ${syncStatus}` : "local"}
              </span>
              <button onClick={() => auth.signOut()} className="ml-auto flex items-center gap-1 rounded-full border border-foreground/15 px-2.5 py-1 text-xs hover:bg-foreground hover:text-background">
                <LogOut className="h-3 w-3" /> Out
              </button>
            </div>
            {syncStatus === "error" && (
              <button onClick={retrySync} className="mt-1.5 w-full truncate text-left text-[11px] text-red-700 underline" title={syncError ?? ""}>
                Sync error — tap to retry
              </button>
            )}
          </div>
        ) : (
          <>
            <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Acting as · demo mode
            </label>
            <select
              value={currentUser.id}
              onChange={(e) => switchUser(e.target.value)}
              className="h-10 w-full rounded-xl border border-foreground/15 bg-card px-3 text-sm"
              aria-label="Switch role"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.role}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="CRM">
        {nav.map((item) => {
          const Icon = ICONS[item.icon] ?? LayoutDashboard;
          const activeItem = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={activeItem ? "page" : undefined}
              onClick={() => setOpen(false)}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors",
                activeItem
                  ? "bg-foreground font-medium text-background"
                  : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
              {item.href === "/tasks" && myOverdue > 0 && (
                <Badge className={cn("ml-auto rounded-full text-[10px]", activeItem ? "bg-background text-foreground" : "bg-foreground text-background")}>
                  {myOverdue}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-foreground/10 p-4">
        <div className="rounded-xl border border-foreground/10 bg-card p-3.5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Today&apos;s rule</p>
          <p className="mt-1 text-[13px] leading-snug">Every lead has an owner. Every action has a next step.</p>
        </div>
        <div className="mt-3 flex items-center gap-2.5 px-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground font-display text-sm text-background">
            {currentUser.name.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">{currentUser.name}</p>
            <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{currentUser.role}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-[1440px]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[280px] shrink-0 border-r border-foreground/10 bg-background/80 backdrop-blur-xl lg:block">
        {sidebar}
      </aside>
      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/30" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[300px] bg-background shadow-xl">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded-full border border-foreground/15 p-2.5" aria-label="Close menu">
              <X className="h-4 w-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar — same pill-on-scroll language as sitev2 Navigation */}
        <header className="sticky top-0 z-40 px-4 pt-4 lg:px-8">
          <div className="flex h-14 items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-background/80 px-4 shadow-sm backdrop-blur-xl lg:px-6">
            <div className="flex items-center gap-3">
              <button className="rounded-full border border-foreground/15 p-2.5 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
                <Menu className="h-4 w-4" />
              </button>
              <span className="hidden items-center gap-3 font-mono text-xs text-muted-foreground sm:flex">
                <span className="h-px w-8 bg-foreground/30" />
                Mathenge Inc. · BDP sales network
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <NotificationsPanel />
              <Button asChild size="sm" className="rounded-full bg-foreground text-background hover:bg-foreground/90">
                <Link href="/leads?new=1">+ Register lead</Link>
              </Button>
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 pb-16 pt-6 lg:px-8">{children}</main>
        <footer className="border-t border-foreground/10 px-4 py-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground md:flex-row">
            <p className="flex items-center gap-2">
              <Image src="/primary-logo.png" alt="" width={2192} height={1369} className="h-5 w-auto opacity-70" />
              © {new Date().getFullYear()} Mathenge Inc. · BDP CRM
            </p>
            <p className="flex items-center gap-2 font-mono text-xs">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Nairobi, Kenya · Dubai, UAE
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
