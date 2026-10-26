import { z } from "zod";
import { db } from "@/lib/db";
import { withTenantRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";
import { recordReadinessSnapshot } from "@/lib/snapshot";
import { notifyAssignment } from "@/lib/notifications";

const updateSchema = z.object({
  status: z.enum(["NOT_STARTED", "IN_REVIEW", "NON_COMPLIANT", "COMPLIANT", "NOT_APPLICABLE"]).optional(),
  assignedToId: z.string().cuid().nullable().optional(),
  notes: z.string().max(5000).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  linkedAssetName: z.string().max(200).optional(),
  // Manual toggle for the drawer's "auto-flag from linked incident" switch.
  // Left undefined on ordinary edits; the handler infers false automatically
  // whenever a human changes status directly (see below).
  slaAutoFlag: z.boolean().optional(),
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

    const existing = await db.controlAssessment.findUnique({
      where: { id: ctx.params.id },
      include: { control: { select: { controlRef: true, category: true } } },
    });
    if (!existing || existing.organizationId !== session.orgId) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Assessment not found." } }, { status: 404 });
    }

    // A human picking a status by hand always wins over automation — unless
    // this same request is explicitly the "re-enable auto-flag" toggle.
    const slaAutoFlag =
      parsed.data.slaAutoFlag !== undefined ? parsed.data.slaAutoFlag : parsed.data.status !== undefined ? false : undefined;

    const updated = await db.controlAssessment.update({
      where: { id: ctx.params.id },
      data: {
        ...parsed.data,
        slaAutoFlag,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : parsed.data.dueDate,
      },
    });

    await writeAuditLog({
      organizationId: session.orgId,
      actorId: session.sub,
      action: parsed.data.status ? "STATUS_CHANGE" : "UPDATE",
      entityType: "ControlAssessment",
      entityId: updated.id,
      controlAssessmentId: updated.id,
      beforeState: existing,
      afterState: updated,
      ipAddress: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    });

    if (parsed.data.status) {
      await recordReadinessSnapshot(session.orgId);
    }

    // Notify only on a genuine reassignment to someone new — not on every
    // save, and not when a control is unassigned (assignedToId set to null).
    if (parsed.data.assignedToId && parsed.data.assignedToId !== existing.assignedToId) {
      await notifyAssignment({
        organizationId: session.orgId,
        assessmentId: updated.id,
        assigneeId: parsed.data.assignedToId,
        controlRef: existing.control.controlRef,
        category: existing.control.category,
      });
    }

    return Response.json({ data: updated });
  }
);

export const GET = withTenantRole(
  ["ORG_ADMIN", "COMPLIANCE_OFFICER", "IT_MANAGER", "AUDITOR"],
  async (_req, session, ctx: { params: { id: string } }) => {
    const assessment = await db.controlAssessment.findUnique({
      where: { id: ctx.params.id },
      include: { control: { include: { framework: true } }, assignedTo: true },
    });
    if (!assessment || assessment.organizationId !== session.orgId) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Assessment not found." } }, { status: 404 });
    }
    return Response.json({ data: assessment });
  }
);
