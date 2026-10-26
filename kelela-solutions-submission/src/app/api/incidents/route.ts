import { z } from "zod";
import { db } from "@/lib/db";
import { withTenantRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";

const createSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(1).max(10000),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
  detectedAt: z.string().datetime(),
  affectedSystems: z.array(z.string()).default([]),
  linkedControlAssessmentId: z.string().cuid().optional(),
});

export const GET = withTenantRole(
  ["ORG_ADMIN", "COMPLIANCE_OFFICER", "IT_MANAGER", "AUDITOR"],
  async (req, session) => {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const severity = searchParams.get("severity");
    const activeOnly = searchParams.get("active") === "true";

    const incidents = await db.incident.findMany({
      where: {
        organizationId: session.orgId,
        ...(status ? { status: status as any } : {}),
        ...(severity ? { severity: severity as any } : {}),
        ...(activeOnly ? { status: { notIn: ["REPORTED_TO_INSA", "CLOSED"] } } : {}),
      },
      orderBy: { slaDeadline: "asc" },
    });

    const data = incidents.map((i) => ({
      ...i,
      hoursRemaining: Math.round(((i.slaDeadline.getTime() - Date.now()) / 3_600_000) * 10) / 10,
    }));

    return Response.json({ data });
  }
);

export const POST = withTenantRole(["ORG_ADMIN", "COMPLIANCE_OFFICER", "IT_MANAGER"], async (req, session) => {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid payload.", fields: parsed.error.flatten().fieldErrors } },
      { status: 422 }
    );
  }

  const detectedAt = new Date(parsed.data.detectedAt);
  // Server computes the deadline — never trust a client-supplied value here,
  // since this timer is what regulatory compliance is measured against.
  const slaDeadline = new Date(detectedAt.getTime() + 48 * 60 * 60 * 1000);

  if (parsed.data.linkedControlAssessmentId) {
    const target = await db.controlAssessment.findUnique({ where: { id: parsed.data.linkedControlAssessmentId } });
    if (!target || target.organizationId !== session.orgId) {
      return Response.json({ error: { code: "VALIDATION_ERROR", message: "Linked control not found." } }, { status: 422 });
    }
  }

  const incident = await db.incident.create({
    data: {
      organizationId: session.orgId,
      title: parsed.data.title,
      description: parsed.data.description,
      severity: parsed.data.severity,
      detectedAt,
      slaDeadline,
      affectedSystems: parsed.data.affectedSystems,
      linkedControlAssessmentId: parsed.data.linkedControlAssessmentId,
    },
  });

  await writeAuditLog({
    organizationId: session.orgId,
    actorId: session.sub,
    action: "CREATE",
    entityType: "Incident",
    entityId: incident.id,
    incidentId: incident.id,
    afterState: incident,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return Response.json({ data: incident }, { status: 201 });
});
