"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutGrid, Building2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlatformSidebarProps {
  adminName: string;
  role: "SUPER_ADMIN" | "PLATFORM_ADMIN";
}

export function PlatformSidebar({ adminName, role }: PlatformSidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { href: "/platform", label: "Platform Overview", icon: LayoutGrid },
    { href: "/platform/organizations", label: "Organizations", icon: Building2 },
    // Managing platform staff is reserved to the Super Admin — a Platform
    // Admin managing their own peers is the exact privilege escalation
    // this tier boundary exists to prevent.
    ...(role === "SUPER_ADMIN" ? [{ href: "/platform/staff", label: "Platform Staff", icon: Users }] : []),
  ];

  return (
    <aside className="flex h-screen w-[220px] flex-none flex-col border-r border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]">
      <div className="flex h-14 items-center gap-2 border-b border-[hsl(var(--border-subtle))] px-4">
        <Image src="/brand/icon-192.png" alt="Kelela Solutions" width={24} height={24} className="rounded-[5px]" />
        <div className="leading-none">
          <div className="text-[13px] font-semibold tracking-tight">Kelela Solutions</div>
          <div className="text-[10px] text-[hsl(var(--text-tertiary))]">Platform Console</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/platform" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-[var(--radius)] px-2.5 py-1.5 text-[13px] transition-colors",
                isActive
                  ? "bg-[hsl(var(--surface-3))] text-[hsl(var(--text-primary))]"
                  : "text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text-primary))]"
              )}
            >
              <Icon className="h-[15px] w-[15px]" strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[hsl(var(--border-subtle))] px-3 py-3">
        <div className="rounded-[var(--radius)] bg-[hsl(var(--surface-2))] px-2.5 py-2">
          <div className="truncate text-[12px] font-medium">{adminName}</div>
          <div className="text-[11px] text-[hsl(var(--text-tertiary))]">
            {role === "SUPER_ADMIN" ? "Super Admin" : "Platform Admin"}
          </div>
        </div>
      </div>
    </aside>
  );
}
