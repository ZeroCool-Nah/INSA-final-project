import { requireTenantSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { SettingsClient } from "@/components/settings/settings-client";

export default async function SettingsPage() {
  const session = await requireTenantSession();

  const user = await db.user.findUniqueOrThrow({
    where: { id: session.sub },
    include: { organization: true },
  });

  // Team roster is only fetched (and only rendered) for ORG_ADMIN — other
  // roles don't need or get a "manage teammates" surface.
  const teammates =
    user.role === "ORG_ADMIN"
      ? await db.user.findMany({
          where: { organizationId: session.orgId, id: { not: session.sub } },
          select: { id: true, fullName: true, email: true, role: true, lastLoginAt: true, lockedUntil: true },
          orderBy: { fullName: "asc" },
        })
      : [];

  return (
    <SettingsClient
      user={{ id: user.id, fullName: user.fullName, email: user.email, role: user.role, mfaEnabled: user.mfaEnabled }}
      organization={{ id: user.organization.id, name: user.organization.name, sector: user.organization.sector, requireMfa: user.organization.requireMfa }}
      teammates={teammates.map((t) => ({
        id: t.id,
        fullName: t.fullName,
        email: t.email,
        role: t.role,
        lastLoginAt: t.lastLoginAt?.toISOString() ?? null,
        disabled: !!(t.lockedUntil && t.lockedUntil > new Date()),
      }))}
    />
  );
}
