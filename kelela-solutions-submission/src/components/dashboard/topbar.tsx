"use client";

import { usePathname } from "next/navigation";
import { NotificationBell } from "./notification-bell";
import { GlobalSearch } from "./global-search";

interface TopbarProps {
  userInitials: string;
  userRole: string;
}

const TITLES: Record<string, string> = {
  "/": "Overview",
  "/controls": "Regulatory Frameworks & Controls Mapping",
  "/incidents": "Incident Reporting & Escalation Log",
  "/audit": "Audit Readiness & Report Generator",
  "/audit-log": "Audit Log",
  "/settings": "Settings",
};

export function Topbar({ userInitials, userRole }: TopbarProps) {
  const pathname = usePathname();
  const title = TITLES[pathname] ?? "Compliance Console";

  return (
    <header className="flex h-14 flex-none items-center justify-between border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))] px-5">
      <h1 className="text-[13px] font-medium text-[hsl(var(--text-primary))]">{title}</h1>

      <div className="flex items-center gap-3">
        <GlobalSearch />

        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--accent-muted))] text-[11px] font-medium text-[hsl(var(--accent))]">
            {userInitials}
          </div>
          <span className="text-[11px] text-[hsl(var(--text-tertiary))]">{userRole}</span>
        </div>

        <NotificationBell />
      </div>
    </header>
  );
}
