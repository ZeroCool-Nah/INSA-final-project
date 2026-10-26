import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { recordReadinessSnapshot } from "@/lib/snapshot";

/**
 * Finds incidents whose 48h disclosure SLA has breached, are not yet
 * resolved, and are linked to a control assessment that still allows
 * auto-flagging (slaAutoFlag = true) — then flips that assessment to
 * NON_COMPLIANT and logs it. Called cheaply on page load rather than via
 * a background job, since this project has no cron/queue infra.
 *
 * Manual status edits in the UI set slaAutoFlag = false, so this never
 * clobbers a human's explicit call.
 */
export async function syncSlaAutoFlags(organizationId: string): Promise<void> {
  const breachedIncidents = await db.incident.findMany({
    where: {
      organizationId,
      status: { notIn: ["REPORTED_TO_INSA", "CLOSED"] },
      slaDeadline: { lt: new Date() },
      linkedControlAssessmentId: { not: null },
    },
    include: { linkedControlAssessment: true },
  });

  if (breachedIncidents.length === 0) return;

  // Audit entries require an actor; system-triggered changes are attributed
  // to an org admin since there's no dedicated service-account concept yet.
  const systemActor = await db.user.findFirst({ where: { organizationId, role: "ORG_ADMIN" } });
  if (!systemActor) return;

  let flaggedAny = false;

  for (const incident of breachedIncidents) {
    const assessment = incident.linkedControlAssessment;
    if (!assessment || !assessment.slaAutoFlag || assessment.status === "NON_COMPLIANT") continue;

    const before = { ...assessment };
    const updated = await db.controlAssessment.update({
      where: { id: assessment.id },
      data: {
        status: "NON_COMPLIANT",
        notes: [assessment.notes, `Auto-flagged non-compliant: linked incident "${incident.title}" breached its 48h SLA.`]
          .filter(Boolean)
          .join("\n\n"),
      },
    });

    await writeAuditLog({
      organizationId,
      actorId: systemActor.id,
      action: "STATUS_CHANGE",
      entityType: "ControlAssessment",
      entityId: updated.id,
      controlAssessmentId: updated.id,
      incidentId: incident.id,
      beforeState: before,
      afterState: updated,
    });

    flaggedAny = true;
  }

  if (flaggedAny) {
    await recordReadinessSnapshot(organizationId);
  }
}
