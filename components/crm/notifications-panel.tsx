"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { useCrm, timeAgo } from "@/lib/crm/store";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Notification } from "@/lib/crm/types";
import { cn } from "@/lib/utils";

// Bell + dropdown notification panel. Task notifications stay unread here
// until the task is cleared (clearing marks them read server-side).
export function NotificationsPanel() {
  const { notifications, currentUser, mutate } = useCrm();
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const mine = notifications
    .filter((n) => n.userId === currentUser.id)
    .sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      return +new Date(b.createdAt) - +new Date(a.createdAt);
    });
  const unread = mine.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open ]);

  const markRead = (id: string, read = true) => {
    mutate((st) => ({ ...st, notifications: st.notifications.map((n) => n.id === id ? { ...n, read } : n) }));
  };

  const markAllRead = () => {
    mutate((st) => ({
      ...st,
      notifications: st.notifications.map((n) => n.userId === currentUser.id ? { ...n, read: true } : n),
    }));
  };

  // Pull the latest notifications (e.g. a task just delegated to me).
  const refresh = async () => {
    if (!isSupabaseConfigured()) return;
    setRefreshing(true);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { data } = await sb.from("notifications").select("*").eq("profile_id", user.id).order("created_at", { ascending: false }).limit(60);
      if (data) {
        const rows = (data as Record<string, unknown>[]) as unknown as Notification[];
        const fresh: Notification[] = rows.map((r) => {
          const rec = r as unknown as Record<string, string | boolean>;
          return {
            id: String(rec.app_ref ?? rec.id),
            userId: currentUser.id,
            title: String(rec.title ?? ""),
            body: String(rec.body ?? ""),
            createdAt: String(rec.created_at ?? new Date().toISOString()),
            read: Boolean(rec.read),
            link: String(rec.link ?? "/tasks"),
          };
        });
        mutate((st) => {
          const others = st.notifications.filter((n) => n.userId !== currentUser.id);
          const ids = new Set(fresh.map((n) => n.id));
          const localOnly = st.notifications.filter((n) => n.userId === currentUser.id && !ids.has(n.id));
          return { ...st, notifications: [...others, ...fresh, ...localOnly] };
        });
      }
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full border border-foreground/15 p-2.5 transition-colors hover:bg-foreground/5"
        aria-label={`Notifications, ${unread} unread`}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-medium text-background">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-foreground/10 bg-background shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b border-foreground/10 px-4 py-3">
            <p className="text-sm font-medium">
              Notifications {unread > 0 && <span className="font-mono text-xs text-muted-foreground">· {unread} unread</span>}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={refresh} className="rounded-full p-2 hover:bg-foreground/5" aria-label="Refresh notifications" title="Refresh">
                <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              </button>
              {unread > 0 && (
                <button onClick={markAllRead} className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs hover:bg-foreground/5" title="Mark all read">
                  <CheckCheck className="h-3.5 w-3.5" /> All read
                </button>
              )}
            </div>
          </div>
          <div className="max-h-[50vh] overflow-y-auto">
            {mine.slice(0, 30).map((n) => (
              <div key={n.id} className={cn("border-b border-foreground/5 px-4 py-3 last:border-0", !n.read && "bg-foreground/[0.04]")}>
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={n.link || "/tasks"}
                    onClick={() => setOpen(false)}
                    className="min-w-0 flex-1"
                  >
                    <p className="text-[13px] font-medium leading-snug">{n.title}</p>
                    <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">{n.body}</p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{timeAgo(n.createdAt)}</p>
                  </Link>
                  {!n.read && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="shrink-0 rounded-full border border-foreground/15 px-2.5 py-1 text-[11px] hover:bg-foreground hover:text-background"
                      title="Dismiss this notification"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            ))}
            {mine.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Nothing here. Delegated tasks, reminders and announcements land here — and stay until you clear them.
              </p>
            )}
          </div>
          <Link
            href="/tasks"
            onClick={() => setOpen(false)}
            className="block border-t border-foreground/10 px-4 py-2.5 text-center text-[13px] font-medium hover:bg-foreground/5"
          >
            Open Tasks
          </Link>
        </div>
      )}
    </div>
  );
}
