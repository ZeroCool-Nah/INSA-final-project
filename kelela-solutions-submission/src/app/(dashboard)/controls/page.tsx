import { requireTenantSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ControlsTable } from "@/components/compliance/controls-table";
import type { ComplianceControlRow } from "@/types/compliance";

export default async function ControlsPage({ searchParams }: { searchParams: { highlight?: string } }) {
  const session = await requireTenantSession();

  // Self-healing backfill: any org onboarded before ControlAssessment
  // auto-provisioning was added to org creation would otherwise show an
  // empty matrix with nothing clickable. Cheap to check, and idempotent.
  const [controlCount, assessmentCount] = await Promise.all([
    db.complianceControl.count(),
    db.controlAssessment.count({ where: { organizationId: session.orgId } }),
  ]);
  if (assessmentCount < controlCount) {
    const missing = await db.complianceControl.findMany({
      where: { assessments: { none: { organizationId: session.orgId } } },
      select: { id: true },
    });
    if (missing.length > 0) {
      await db.controlAssessment.createMany({
        data: missing.map((c) => ({ controlId: c.id, organizationId: session.orgId, status: "NOT_STARTED" as const })),
        skipDuplicates: true,
      });
    }
  }

  const controls = await db.complianceControl.findMany({
    include: {
      framework: true,
      assessments: {
        where: { organizationId: session.orgId },
        include: { assignedTo: true, incidents: true },
        take: 1,
      },
    },
    orderBy: [{ riskLevel: "asc" }, { controlRef: "asc" }],
  });

  const rows: ComplianceControlRow[] = controls.map((c) => {
    const assessment = c.assessments[0];
    return {
      id: c.id,
      controlRef: c.controlRef,
      framework: c.framework.code,
      category: c.category,
      requirementText: c.requirementText,
      riskLevel: c.riskLevel,
      mappedIsoRefs: c.mappedIsoRefs,
      assessment: assessment
        ? {
            id: assessment.id,
            status: assessment.status,
            assignedTo: assessment.assignedTo
              ? { id: assessment.assignedTo.id, fullName: assessment.assignedTo.fullName }
              : null,
            dueDate: assessment.dueDate?.toISOString() ?? null,
            evidenceFileName: assessment.evidenceFileName,
            evidenceHash: assessment.evidenceHash,
            linkedAssetName: assessment.linkedAssetName,
            notes: assessment.notes,
            slaAutoFlag: assessment.slaAutoFlag,
            linkedIncidents: assessment.incidents.map((i) => ({
              id: i.id,
              title: i.title,
              status: i.status,
              severity: i.severity,
              slaDeadline: i.slaDeadline.toISOString(),
            })),
          }
        : null,
    };
  });

  return (
    <div className="mx-auto max-w-[1200px]">
      <ControlsTable controls={rows} highlightId={searchParams.highlight} />
    </div>
  );
}
