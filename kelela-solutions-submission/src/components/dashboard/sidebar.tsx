"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  ShieldCheck,
  AlertTriangle,
  FileCheck2,
  ScrollText,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/controls", label: "Controls Matrix", icon: ShieldCheck },
  { href: "/incidents", label: "Incidents", icon: AlertTriangle, badgeKey: "activeIncidents" as const },
  { href: "/audit", label: "Audit Readiness", icon: FileCheck2 },
  { href: "/audit-log", label: "Audit Log", icon: ScrollText },
];

interface SidebarProps {
  orgName: string;
  sector: string;
  activeIncidentCount?: number;
}

export function Sidebar({ orgName, sector, activeIncidentCount = 0 }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-[220px] flex-none flex-col border-r border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]">
      <div className="flex h-14 items-center gap-2 border-b border-[hsl(var(--border-subtle))] px-4">
        <Image src="/brand/icon-192.png" alt="Kelela Solutions" width={24} height={24} className="rounded-[5px]" />
        <div className="leading-none">
          <div className="text-[13px] font-semibold tracking-tight">Kelela Solutions</div>
          <div className="text-[10px] text-[hsl(var(--text-tertiary))]">Compliance Console</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          const badge = item.badgeKey === "activeIncidents" ? activeIncidentCount : 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center justify-between rounded-[var(--radius)] px-2.5 py-1.5 text-[13px] transition-colors",
                isActive
                  ? "bg-[hsl(var(--surface-3))] text-[hsl(var(--text-primary))]"
                  : "text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text-primary))]"
              )}
            >
              <span className="flex items-center gap-2">
                <Icon className="h-[15px] w-[15px]" strokeWidth={1.75} />
                {item.label}
              </span>
              {badge > 0 && (
                <span className="rounded-full bg-[hsl(var(--risk-critical)/0.18)] px-1.5 py-0.5 text-[10px] font-medium leading-none text-[hsl(var(--risk-critical))]">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[hsl(var(--border-subtle))] px-3 py-3">
        <Link
          href="/settings"
          className="mb-2 flex items-center gap-2 rounded-[var(--radius)] px-2.5 py-1.5 text-[13px] text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text-primary))]"
        >
          <Settings className="h-[15px] w-[15px]" strokeWidth={1.75} />
          Settings
        </Link>
        <div className="rounded-[var(--radius)] bg-[hsl(var(--surface-2))] px-2.5 py-2">
          <div className="truncate text-[12px] font-medium">{orgName}</div>
          <div className="text-[11px] text-[hsl(var(--text-tertiary))]">{sector}</div>
        </div>
      </div>
    </aside>
  );
}
