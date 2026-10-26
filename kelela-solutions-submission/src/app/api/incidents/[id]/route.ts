import { z } from "zod";
import { db } from "@/lib/db";
import { withTenantRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";

const updateSchema = z.object({
  status: z.enum(["DETECTED", "CONTAINED", "ERADICATED", "RECOVERED", "REPORTED_TO_INSA", "CLOSED"]).optional(),
  insaReportedAt: z.string().datetime().optional(),
  description: z.string().max(10000).optional(),
});

export const PATCH = withTenantRole(
  ["ORG_ADMIN", "COMPLIANCE_OFFICER", "IT_MANAGER"],
  async (req, session, ctx: { params: { id: string } }) => {
    const body = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid payload.", fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const existing = await db.incident.findUnique({ where: { id: ctx.params.id } });
    if (!existing || existing.organizationId !== session.orgId) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Incident not found." } }, { status: 404 });
    }

    // Reporting to INSA requires a timestamp so on-time/late can be judged
    // against slaDeadline for the audit trail.
    if (parsed.data.status === "REPORTED_TO_INSA" && !parsed.data.insaReportedAt) {
      parsed.data.insaReportedAt = new Date().toISOString();
    }

    const updated = await db.incident.update({
      where: { id: ctx.params.id },
      data: {
        ...parsed.data,
        insaReportedAt: parsed.data.insaReportedAt ? new Date(parsed.data.insaReportedAt) : undefined,
      },
    });

    await writeAuditLog({
      organizationId: session.orgId,
      actorId: session.sub,
      action: "STATUS_CHANGE",
      entityType: "Incident",
      entityId: updated.id,
      incidentId: updated.id,
      beforeState: existing,
      afterState: updated,
      ipAddress: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    });

    return Response.json({ data: updated });
  }
);
