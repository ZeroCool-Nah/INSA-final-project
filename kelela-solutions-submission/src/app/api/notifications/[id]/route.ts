import { db } from "@/lib/db";
import { withTenantRole } from "@/lib/auth";

export const PATCH = withTenantRole(
  ["ORG_ADMIN", "COMPLIANCE_OFFICER", "AUDITOR", "IT_MANAGER"],
  async (_req, session, ctx: { params: { id: string } }) => {
    const existing = await db.notification.findUnique({ where: { id: ctx.params.id } });
    if (!existing || existing.organizationId !== session.orgId) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Notification not found." } }, { status: 404 });
    }
    if (existing.userId && existing.userId !== session.sub) {
      return Response.json({ error: { code: "FORBIDDEN", message: "This notification isn't yours." } }, { status: 403 });
    }
    const updated = await db.notification.update({ where: { id: ctx.params.id }, data: { read: true } });
    return Response.json({ data: updated });
  }
);
