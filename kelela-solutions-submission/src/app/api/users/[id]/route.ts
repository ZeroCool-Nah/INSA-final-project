import { z } from "zod";
import { withTenantRole, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";

const updateSchema = z.object({
  role: z.enum(["COMPLIANCE_OFFICER", "AUDITOR", "IT_MANAGER"]).optional(),
  disabled: z.boolean().optional(),
  // Set by "reset password" — org admin generates a new temp password and
  // shares it out-of-band, same pattern as inviting a new teammate. There's
  // no email delivery in this build, so this is the mechanism until there is.
  resetPassword: z.string().min(8).max(200).optional(),
});

export const PATCH = withTenantRole(["ORG_ADMIN"], async (req, session, ctx: { params: { id: string } }) => {
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: { code: "VALIDATION_ERROR", message: "Invalid payload." } }, { status: 422 });
  }

  const target = await db.user.findUnique({ where: { id: ctx.params.id } });
  if (!target || target.organizationId !== session.orgId) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Teammate not found." } }, { status: 404 });
  }
  if (target.id === session.sub) {
    return Response.json({ error: { code: "FORBIDDEN", message: "Manage your own account from Settings, not this endpoint." } }, { status: 403 });
  }
  if (target.role === "ORG_ADMIN") {
    return Response.json({ error: { code: "FORBIDDEN", message: "Other admins can't be managed through this endpoint." } }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.role) data.role = parsed.data.role;
  if (parsed.data.disabled !== undefined) data.lockedUntil = parsed.data.disabled ? new Date("2099-01-01") : null;
  if (parsed.data.resetPassword) data.passwordHash = await hashPassword(parsed.data.resetPassword);

  const updated = await db.user.update({ where: { id: target.id }, data });

  await writeAuditLog({
    organizationId: session.orgId,
    actorId: session.sub,
    action: "UPDATE",
    entityType: "User",
    entityId: updated.id,
    beforeState: { role: target.role, lockedUntil: target.lockedUntil },
    afterState: { role: updated.role, lockedUntil: updated.lockedUntil, passwordReset: !!parsed.data.resetPassword },
  });

  return Response.json({ data: { id: updated.id, role: updated.role, disabled: !!updated.lockedUntil } });
});
