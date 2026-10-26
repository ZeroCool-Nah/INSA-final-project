import { z } from "zod";
import { db } from "@/lib/db";
import { withTenantRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";

const updateSchema = z.object({
  requireMfa: z.boolean(),
});

export const PATCH = withTenantRole(["ORG_ADMIN"], async (req, session) => {
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: { code: "VALIDATION_ERROR", message: "Invalid payload." } }, { status: 422 });
  }

  const before = await db.organization.findUniqueOrThrow({ where: { id: session.orgId } });
  const updated = await db.organization.update({
    where: { id: session.orgId },
    data: { requireMfa: parsed.data.requireMfa },
  });

  await writeAuditLog({
    organizationId: session.orgId,
    actorId: session.sub,
    action: "UPDATE",
    entityType: "Organization",
    entityId: session.orgId,
    beforeState: { requireMfa: before.requireMfa },
    afterState: { requireMfa: updated.requireMfa },
  });

  return Response.json({ data: { requireMfa: updated.requireMfa } });
});
