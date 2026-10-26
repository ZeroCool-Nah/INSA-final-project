import { z } from "zod";
import { db } from "@/lib/db";
import { withSuperAdminRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";

const updateSchema = z.object({
  // Deliberately just an on/off lock rather than a hard delete, so the
  // audit trail (actorId foreign keys) never dangles.
  disabled: z.boolean().optional(),
});

export const PATCH = withSuperAdminRole(async (req, session, ctx: { params: { id: string } }) => {
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: { code: "VALIDATION_ERROR", message: "Invalid payload." } }, { status: 422 });
  }

  const target = await db.user.findUnique({ where: { id: ctx.params.id } });
  if (!target || target.organizationId !== null) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Platform staff member not found." } }, { status: 404 });
  }
  if (target.role === "SUPER_ADMIN") {
    return Response.json(
      { error: { code: "FORBIDDEN", message: "Super Admin accounts can't be modified through this endpoint." } },
      { status: 403 }
    );
  }
  if (target.id === session.sub) {
    return Response.json({ error: { code: "FORBIDDEN", message: "You can't modify your own access." } }, { status: 403 });
  }

  // "Disabled" is modeled as an indefinite lockout rather than a new schema
  // field, reusing the same brute-force-lockout mechanism login already checks.
  const updated = await db.user.update({
    where: { id: target.id },
    data: { lockedUntil: parsed.data.disabled ? new Date("2099-01-01") : null },
  });

  await writeAuditLog({
    organizationId: null,
    actorId: session.sub,
    action: "UPDATE",
    entityType: "User",
    entityId: updated.id,
    beforeState: { lockedUntil: target.lockedUntil },
    afterState: { lockedUntil: updated.lockedUntil },
  });

  return Response.json({ data: { id: updated.id, disabled: !!updated.lockedUntil } });
});
