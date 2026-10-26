import { z } from "zod";
import { SignJWT } from "jose";
import { db } from "@/lib/db";
import { verifyPassword, createSession, LOGIN_LOCKOUT } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const secretKey = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: { code: "VALIDATION_ERROR", message: "Email and password are required." } }, { status: 422 });
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    include: { organization: true },
  });

  // Constant-shape response whether or not the user exists, to avoid
  // leaking account existence via timing/response differences.
  const genericError = Response.json(
    { error: { code: "UNAUTHENTICATED", message: "Invalid email or password." } },
    { status: 401 }
  );

  if (!user) return genericError;

  if (user.organization && user.organization.status === "SUSPENDED") {
    return Response.json(
      { error: { code: "FORBIDDEN", message: "This organization's access has been suspended. Contact your Kelela Solutions account manager." } },
      { status: 403 }
    );
  }

  if (user.organization && user.organization.status === "DELETED") {
    return Response.json(
      { error: { code: "FORBIDDEN", message: "This organization's account has been closed." } },
      { status: 403 }
    );
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return Response.json(
      { error: { code: "RATE_LIMITED", message: "Account temporarily locked due to failed attempts. Try again later." } },
      { status: 429 }
    );
  }

  const valid = await verifyPassword(user.passwordHash, parsed.data.password);
  if (!valid) {
    const failedLoginCount = user.failedLoginCount + 1;
    const lockedUntil =
      failedLoginCount >= LOGIN_LOCKOUT.maxAttempts
        ? new Date(Date.now() + LOGIN_LOCKOUT.lockoutMinutes * 60 * 1000)
        : null;

    await db.user.update({ where: { id: user.id }, data: { failedLoginCount, lockedUntil } });
    await writeAuditLog({
      organizationId: user.organizationId,
      actorId: user.id,
      action: "LOGIN_FAILED",
      entityType: "User",
      entityId: user.id,
      ipAddress: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    });

    return genericError;
  }

  await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });

  if (user.mfaEnabled) {
    // Short-lived challenge token — not a session — proves password was
    // correct without granting access until TOTP is verified.
    const challengeToken = await new SignJWT({ sub: user.id, stage: "mfa_pending" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(secretKey);

    return Response.json({ mfaRequired: true, challengeToken });
  }

  await createSession({ sub: user.id, orgId: user.organizationId, role: user.role });
  await writeAuditLog({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "LOGIN",
    entityType: "User",
    entityId: user.id,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return Response.json({ data: { id: user.id, email: user.email, role: user.role } });
}
