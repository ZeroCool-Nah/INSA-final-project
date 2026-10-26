import { notFound } from "next/navigation";
import { requirePlatformSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { OrganizationDetailClient } from "@/components/platform/organization-detail-client";

export default async function OrganizationDetailPage({ params }: { params: { id: string } }) {
  const session = await requirePlatformSession();

  const org = await db.organization.findUnique({
    where: { id: params.id },
    include: {
      users: { select: { id: true, fullName: true, email: true, role: true, lastLoginAt: true } },
    },
  });
  if (!org) notFound();

  const [total, compliant, activeIncidentCount] = await Promise.all([
    db.controlAssessment.count({ where: { organizationId: org.id } }),
    db.controlAssessment.count({ where: { organizationId: org.id, status: "COMPLIANT" } }),
    db.incident.count({ where: { organizationId: org.id, status: { notIn: ["REPORTED_TO_INSA", "CLOSED"] } } }),
  ]);

  return (
    <OrganizationDetailClient
      org={{
        id: org.id,
        name: org.name,
        sector: org.sector,
        status: org.status,
        planTier: org.planTier,
        primaryContactEmail: org.primaryContactEmail,
        readinessPct: total ? Math.round((compliant / total) * 100) : 0,
        totalControls: total,
        activeIncidentCount,
        users: org.users.map((u) => ({
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          role: u.role,
          lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        })),
      }}
      canManage={session.role === "SUPER_ADMIN"}
    />
  );
}
