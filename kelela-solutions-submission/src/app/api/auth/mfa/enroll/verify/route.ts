import { z } from "zod";
import { authenticator } from "otplib";
import { db } from "@/lib/db";
import { withAnySession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";

const verifySchema = z.object({ totpCode: z.string().length(6) });

export const POST = withAnySession(async (req, session) => {
  const body = await req.json().catch(() => null);
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: { code: "VALIDATION_ERROR", message: "Enter the 6-digit code." } }, { status: 422 });
  }

  const user = await db.user.findUniqueOrThrow({ where: { id: session.sub } });
  if (!user.mfaPendingSecret) {
    return Response.json(
      { error: { code: "CONFLICT", message: "No enrollment in progress — start over." } },
      { status: 409 }
    );
  }

  const valid = authenticator.verify({ token: parsed.data.totpCode, secret: user.mfaPendingSecret });
  if (!valid) {
    return Response.json({ error: { code: "UNAUTHENTICATED", message: "Incorrect code. Try again." } }, { status: 401 });
  }

  await db.user.update({
    where: { id: user.id },
    data: { mfaSecret: user.mfaPendingSecret, mfaPendingSecret: null, mfaEnabled: true },
  });

  await writeAuditLog({
    organizationId: session.orgId,
    actorId: session.sub,
    action: "MFA_ENABLED",
    entityType: "User",
    entityId: session.sub,
  });

  return Response.json({ data: { mfaEnabled: true } });
});
