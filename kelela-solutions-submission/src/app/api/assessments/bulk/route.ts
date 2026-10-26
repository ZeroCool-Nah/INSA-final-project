import { z } from "zod";
import { db } from "@/lib/db";
import { withTenantRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";

const bulkSchema = z.object({
  assessmentIds: z.array(z.string().cuid()).min(1).max(200),
  assignedToId: z.string().cuid().nullable(),
});

export const PATCH = withTenantRole(["ORG_ADMIN", "COMPLIANCE_OFFICER", "IT_MANAGER"], async (req, session) => {
  const body = await req.json().catch(() => null);
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: { code: "VALIDATION_ERROR", message: "Invalid payload." } }, { status: 422 });
  }

  const assessments = await db.controlAssessment.findMany({
    where: { id: { in: parsed.data.assessmentIds }, organizationId: session.orgId },
  });

  let updatedCount = 0;
  for (const existing of assessments) {
    const updated = await db.controlAssessment.update({
      where: { id: existing.id },
      data: { assignedToId: parsed.data.assignedToId },
    });
    await writeAuditLog({
      organizationId: session.orgId,
      actorId: session.sub,
      action: "UPDATE",
      entityType: "ControlAssessment",
      entityId: updated.id,
      controlAssessmentId: updated.id,
      beforeState: { assignedToId: existing.assignedToId },
      afterState: { assignedToId: updated.assignedToId },
      ipAddress: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    });
    updatedCount++;
  }

  return Response.json({ data: { updatedCount } });
});
