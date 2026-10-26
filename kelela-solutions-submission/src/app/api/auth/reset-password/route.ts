import { z } from "zod";
import { jwtVerify } from "jose";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";

const schema = z.object({
  token: z.string(),
  newPassword: z.string().min(8).max(200),
});

const secretKey = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: { code: "VALIDATION_ERROR", message: "Invalid payload." } }, { status: 422 });
  }

  let userId: string;
  try {
    const { payload } = await jwtVerify(parsed.data.token, secretKey);
    if (payload.stage !== "password_reset" || typeof payload.sub !== "string") throw new Error("bad token");
    userId = payload.sub;
  } catch {
    return Response.json(
      { error: { code: "UNAUTHENTICATED", message: "This reset link is invalid or has expired. Request a new one." } },
      { status: 401 }
    );
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Account not found." } }, { status: 404 });
  }

  // `lockedUntil` does double duty: a short-lived brute-force cooldown
  // (fine to clear here — the person just proved account ownership via
  // email) versus the far-future sentinel used for administrative
  // disablement (must NOT be silently cleared by self-service reset, or
  // a disabled teammate/staff account could reactivate itself).
  const isAdministrativelyDisabled = user.lockedUntil && user.lockedUntil.getTime() - Date.now() > 90 * 24 * 60 * 60 * 1000;
  if (isAdministrativelyDisabled) {
    return Response.json(
      { error: { code: "FORBIDDEN", message: "This account has been disabled. Contact your administrator." } },
      { status: 403 }
    );
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
  });

  await writeAuditLog({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "UPDATE",
    entityType: "User",
    entityId: user.id,
    afterState: { passwordReset: true },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return Response.json({ data: { message: "Password updated. You can now sign in." } });
}
