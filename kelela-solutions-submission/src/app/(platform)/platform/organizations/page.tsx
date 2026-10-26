import { requirePlatformSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { OrganizationsClient } from "@/components/platform/organizations-client";

export default async function OrganizationsPage() {
  await requirePlatformSession();

  const organizations = await db.organization.findMany({
    where: { status: { not: "DELETED" } },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true } } },
  });

  const orgs = await Promise.all(
    organizations.map(async (org) => {
      const [total, compliant, activeIncidentCount] = await Promise.all([
        db.controlAssessment.count({ where: { organizationId: org.id } }),
        db.controlAssessment.count({ where: { organizationId: org.id, status: "COMPLIANT" } }),
        db.incident.count({ where: { organizationId: org.id, status: { notIn: ["REPORTED_TO_INSA", "CLOSED"] } } }),
      ]);
      return {
        id: org.id,
        name: org.name,
        sector: org.sector,
        status: org.status,
        planTier: org.planTier,
        userCount: org._count.users,
        activeIncidentCount,
        readinessPct: total ? Math.round((compliant / total) * 100) : 0,
        createdAt: org.createdAt.toISOString(),
      };
    })
  );

  return <OrganizationsClient initialOrgs={orgs} />;
}
