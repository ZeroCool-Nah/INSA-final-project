import { requireTenantSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { IncidentLogClient } from "@/components/incidents/incident-log-client";

export default async function IncidentsPage() {
  const session = await requireTenantSession();

  const [incidents, assessments] = await Promise.all([
    db.incident.findMany({
      where: { organizationId: session.orgId },
      include: { linkedControlAssessment: { include: { control: true } } },
      orderBy: { detectedAt: "desc" },
    }),
    db.controlAssessment.findMany({
      where: { organizationId: session.orgId },
      include: { control: true },
      orderBy: { control: { controlRef: "asc" } },
    }),
  ]);

  const rows = incidents.map((i) => ({
    id: i.id,
    title: i.title,
    severity: i.severity,
    status: i.status,
    detectedAt: i.detectedAt.toISOString(),
    slaDeadline: i.slaDeadline.toISOString(),
    affectedSystems: i.affectedSystems,
    linkedControlRef: i.linkedControlAssessment?.control.controlRef ?? null,
  }));

  const controlOptions = assessments.map((a) => ({
    assessmentId: a.id,
    controlRef: a.control.controlRef,
    category: a.control.category,
  }));

  return <IncidentLogClient initialIncidents={rows} controlOptions={controlOptions} />;
}
