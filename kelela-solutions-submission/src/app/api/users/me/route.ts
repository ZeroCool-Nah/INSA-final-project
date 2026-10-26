import { z } from "zod";
import { db } from "@/lib/db";
import { withTenantRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";

const updateSchema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  mfaEnabled: z.boolean().optional(),
});

export const PATCH = withTenantRole(
  ["ORG_ADMIN", "COMPLIANCE_OFFICER", "AUDITOR", "IT_MANAGER"],
  async (req, session) => {
    const body = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: { code: "VALIDATION_ERROR", message: "Invalid payload." } }, { status: 422 });
    }

    // Disabling MFA here for simplicity; enabling it for real requires the
    // TOTP-enrollment flow (generate secret, show QR, verify one code)
    // before mfaSecret/mfaEnabled are set — not just a boolean flip.
    if (parsed.data.mfaEnabled === true) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Enabling MFA requires the enrollment flow (not yet wired up)." } },
        { status: 422 }
      );
    }

    const before = await db.user.findUniqueOrThrow({ where: { id: session.sub } });
    const updated = await db.user.update({
      where: { id: session.sub },
      data: {
        fullName: parsed.data.fullName,
        ...(parsed.data.mfaEnabled === false ? { mfaEnabled: false, mfaSecret: null } : {}),
      },
    });

    await writeAuditLog({
      organizationId: session.orgId,
      actorId: session.sub,
      action: parsed.data.mfaEnabled === false ? "MFA_DISABLED" : "UPDATE",
      entityType: "User",
      entityId: session.sub,
      beforeState: before,
      afterState: updated,
    });

    return Response.json({ data: { id: updated.id, fullName: updated.fullName, mfaEnabled: updated.mfaEnabled } });
  }
);
