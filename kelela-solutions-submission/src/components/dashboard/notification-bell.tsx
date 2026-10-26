"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, AlertTriangle, Clock, FileCheck2, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  type: "SLA_BREACH" | "SLA_AT_RISK" | "CONTROL_DUE_SOON" | "CONTROL_OVERDUE" | "EVIDENCE_UPLOADED" | "CONTROL_ASSIGNED";
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const ICONS: Record<NotificationItem["type"], typeof AlertTriangle> = {
  SLA_BREACH: AlertTriangle,
  SLA_AT_RISK: Clock,
  CONTROL_DUE_SOON: Clock,
  CONTROL_OVERDUE: AlertTriangle,
  EVIDENCE_UPLOADED: FileCheck2,
  CONTROL_ASSIGNED: UserCheck,
};

const URGENT_TYPES: NotificationItem["type"][] = ["SLA_BREACH", "CONTROL_OVERDUE"];

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  async function fetchNotifications() {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const json = await res.json();
    setItems(json.data);
    setUnreadCount(json.unreadCount);
  }

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 60_000); // poll every 60s
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative rounded-[var(--radius)] p-1.5 text-[hsl(var(--text-tertiary))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text-primary))]"
      >
        <Bell className="h-4 w-4" strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-[hsl(var(--risk-critical))] px-1 text-[9px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-[340px] rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] shadow-2xl">
          <div className="border-b border-[hsl(var(--border-subtle))] px-3 py-2.5 text-[11.5px] font-medium text-[hsl(var(--text-primary))]">
            Notifications
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-3 py-6 text-center text-[11.5px] text-[hsl(var(--text-tertiary))]">
                Nothing needs your attention.
              </div>
            ) : (
              items.map((n) => {
                const Icon = ICONS[n.type];
                const urgent = URGENT_TYPES.includes(n.type);
                const content = (
                  <div
                    className={cn(
                      "flex items-start gap-2.5 border-b border-[hsl(var(--border-subtle))] px-3 py-2.5 text-left last:border-b-0 hover:bg-[hsl(var(--surface-2))]",
                      !n.read && "bg-[hsl(var(--surface-2)/0.5)]"
                    )}
                  >
                    <Icon
                      className="mt-0.5 h-3.5 w-3.5 flex-none"
                      style={{ color: urgent ? "hsl(var(--risk-critical))" : "hsl(var(--accent))" }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-medium text-[hsl(var(--text-primary))]">{n.title}</span>
                        {!n.read && <span className="h-1.5 w-1.5 flex-none rounded-full bg-[hsl(var(--accent))]" />}
                      </div>
                      <p className="mt-0.5 text-[11.5px] leading-snug text-[hsl(var(--text-secondary))]">{n.message}</p>
                    </div>
                  </div>
                );

                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => !n.read && markRead(n.id)}>
                    {content}
                  </Link>
                ) : (
                  <button key={n.id} onClick={() => !n.read && markRead(n.id)} className="block w-full">
                    {content}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
