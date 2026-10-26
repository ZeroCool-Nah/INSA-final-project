import { requireTenantSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { AuditReadinessClient } from "@/components/audit/audit-readiness-client";

export default async function AuditReadinessPage() {
  const session = await requireTenantSession();

  const [user, totalControls, compliantControls, criticalGapCount] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: session.sub } }),
    db.controlAssessment.count({ where: { organizationId: session.orgId } }),
    db.controlAssessment.count({ where: { organizationId: session.orgId, status: "COMPLIANT" } }),
    db.controlAssessment.count({
      where: {
        organizationId: session.orgId,
        status: { not: "COMPLIANT" },
        control: { riskLevel: "CRITICAL" },
      },
    }),
  ]);

  const readinessPct = totalControls ? Math.round((compliantControls / totalControls) * 100) : 0;

  return (
    <AuditReadinessClient
      userRole={user.role}
      readinessPct={readinessPct}
      totalControls={totalControls}
      compliantControls={compliantControls}
      criticalGapCount={criticalGapCount}
    />
  );
}
