import { z } from "zod";
import { db } from "@/lib/db";
import { withPlatformRole, withSuperAdminRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";

export const GET = withPlatformRole(async (_req, _session, ctx: { params: { id: string } }) => {
  const org = await db.organization.findUnique({
    where: { id: ctx.params.id },
    include: {
      users: { select: { id: true, fullName: true, email: true, role: true, lastLoginAt: true } },
    },
  });
  if (!org) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Organization not found." } }, { status: 404 });
  }

  const [total, compliant, activeIncidents] = await Promise.all([
    db.controlAssessment.count({ where: { organizationId: org.id } }),
    db.controlAssessment.count({ where: { organizationId: org.id, status: "COMPLIANT" } }),
    db.incident.count({ where: { organizationId: org.id, status: { notIn: ["REPORTED_TO_INSA", "CLOSED"] } } }),
  ]);

  return Response.json({
    data: {
      ...org,
      readinessPct: total ? Math.round((compliant / total) * 100) : 0,
      totalControls: total,
      activeIncidentCount: activeIncidents,
    },
  });
});

const updateSchema = z.object({
  status: z.enum(["ACTIVE", "TRIAL", "SUSPENDED", "DELETED"]).optional(),
  planTier: z.string().max(50).optional(),
  name: z.string().min(2).max(200).optional(),
  // Required to actually confirm a DELETED transition — a raw status flip
  // from the org list is too easy to fat-finger for something this
  // consequential; the client must echo the org's exact name back.
  confirmName: z.string().optional(),
});

export const PATCH = withSuperAdminRole(async (req, session, ctx: { params: { id: string } }) => {
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: { code: "VALIDATION_ERROR", message: "Invalid payload." } }, { status: 422 });
  }

  const existing = await db.organization.findUnique({ where: { id: ctx.params.id } });
  if (!existing) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Organization not found." } }, { status: 404 });
  }

  const isRemoving = parsed.data.status === "DELETED" && existing.status !== "DELETED";
  const isRestoring = existing.status === "DELETED" && parsed.data.status && parsed.data.status !== "DELETED";

  if (isRemoving) {
    if (parsed.data.confirmName !== existing.name) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Type the organization's exact name to confirm removal." } },
        { status: 422 }
      );
    }
    // Soft delete: data is untouched (control assessments, incidents,
    // evidence, audit log all stay put), but every user in this org is
    // locked out immediately, same mechanism as disabling one teammate.
    await db.user.updateMany({
      where: { organizationId: existing.id },
      data: { lockedUntil: new Date("2099-01-01") },
    });
  }

  if (isRestoring) {
    // Un-lock everyone. This also reactivates any teammate an ORG_ADMIN had
    // individually disabled before removal — an acceptable tradeoff since
    // there's no separate flag distinguishing "disabled by their own admin"
    // from "disabled by org removal"; the org admin can re-disable them.
    await db.user.updateMany({
      where: { organizationId: existing.id },
      data: { lockedUntil: null },
    });
  }

  const { confirmName, ...updateData } = parsed.data;
  const updated = await db.organization.update({
    where: { id: ctx.params.id },
    data: { ...updateData, deletedAt: isRemoving ? new Date() : isRestoring ? null : undefined },
  });

  await writeAuditLog({
    organizationId: null,
    actorId: session.sub,
    action: "UPDATE",
    entityType: "Organization",
    entityId: updated.id,
    beforeState: existing,
    afterState: updated,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return Response.json({ data: updated });
});
