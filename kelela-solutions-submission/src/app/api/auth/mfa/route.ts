import { z } from "zod";
import { jwtVerify } from "jose";
import { authenticator } from "otplib";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";

const mfaSchema = z.object({
  challengeToken: z.string(),
  totpCode: z.string().length(6),
});

const secretKey = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = mfaSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: { code: "VALIDATION_ERROR", message: "Invalid payload." } }, { status: 422 });
  }

  let userId: string;
  try {
    const { payload } = await jwtVerify(parsed.data.challengeToken, secretKey);
    if (payload.stage !== "mfa_pending" || typeof payload.sub !== "string") throw new Error("bad token");
    userId = payload.sub;
  } catch {
    return Response.json({ error: { code: "UNAUTHENTICATED", message: "Challenge expired. Sign in again." } }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.mfaSecret) {
    return Response.json({ error: { code: "UNAUTHENTICATED", message: "MFA is not configured for this account." } }, { status: 401 });
  }

  // TODO: decrypt user.mfaSecret with your KMS/envelope-encryption key
  // before passing to otplib — it must never be stored in plaintext.
  const isValid = authenticator.verify({ token: parsed.data.totpCode, secret: user.mfaSecret });
  if (!isValid) {
    await writeAuditLog({
      organizationId: user.organizationId,
      actorId: user.id,
      action: "LOGIN_FAILED",
      entityType: "User",
      entityId: user.id,
    });
    return Response.json({ error: { code: "UNAUTHENTICATED", message: "Invalid code." } }, { status: 401 });
  }

  await createSession({ sub: user.id, orgId: user.organizationId, role: user.role });
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAuditLog({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "LOGIN",
    entityType: "User",
    entityId: user.id,
  });

  return Response.json({ data: { id: user.id, email: user.email, role: user.role } });
}
