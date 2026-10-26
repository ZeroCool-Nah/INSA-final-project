import { redirect } from "next/navigation";
import { requireTenantSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncNotifications } from "@/lib/notifications";
import { syncSlaAutoFlags } from "@/lib/sla-sync";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireTenantSession();

  // Best-effort, non-blocking: refresh SLA/due-date notifications and
  // auto-flag any controls whose linked incident breached its 48h window.
  // Fine at this scale; move both to a scheduled job for a multi-tenant
  // production deployment so neither sits on the request path.
  syncSlaAutoFlags(session.orgId)
    .then(() => syncNotifications(session.orgId))
    .catch(() => {});

  const [user, activeIncidentCount] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: session.sub },
      include: { organization: true },
    }),
    db.incident.count({
      where: {
        organizationId: session.orgId,
        status: { notIn: ["REPORTED_TO_INSA", "CLOSED"] },
      },
    }),
  ]);

  // Guaranteed non-null: requireTenantSession() already redirected away any
  // user without an organization (SUPER_ADMIN or PLATFORM_ADMIN).
  const organization = user.organization!;

  // Mandatory MFA is an org-wide policy (see Settings), not a per-user
  // suggestion — enforced here, not just recommended in the UI, so it
  // actually gates access rather than being something a user can ignore.
  if (organization.requireMfa && !user.mfaEnabled) {
    redirect("/mfa-required");
  }

  const initials = user.fullName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        orgName={organization.name}
        sector={organization.sector}
        activeIncidentCount={activeIncidentCount}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar userInitials={initials} userRole={user.role.replace("_", " ")} />
        <main className="flex-1 overflow-y-auto bg-[hsl(var(--surface-0))] px-6 py-5">
          {children}
        </main>
      </div>
    </div>
  );
}
