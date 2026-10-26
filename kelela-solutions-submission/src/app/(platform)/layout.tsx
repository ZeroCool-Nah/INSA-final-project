import { redirect } from "next/navigation";
import { requirePlatformSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PlatformSidebar } from "@/components/platform/platform-sidebar";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePlatformSession();

  const admin = await db.user.findUniqueOrThrow({ where: { id: session.sub } });

  // MFA is mandatory for platform staff, full stop — no org-level toggle
  // here, since this console can see and manage every tenant. Unlike the
  // tenant side, this isn't a policy a Super Admin can opt out of.
  if (!admin.mfaEnabled) {
    redirect("/mfa-required");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <PlatformSidebar adminName={admin.fullName} role={session.role as "SUPER_ADMIN" | "PLATFORM_ADMIN"} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-y-auto bg-[hsl(var(--surface-0))] px-6 py-5">{children}</main>
      </div>
    </div>
  );
}
