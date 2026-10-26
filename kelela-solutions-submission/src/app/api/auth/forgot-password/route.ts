import { z } from "zod";
import { SignJWT } from "jose";
import { db } from "@/lib/db";
import { sendEmail, passwordResetEmail } from "@/lib/email";
import { writeAuditLog } from "@/lib/audit-log";

const schema = z.object({ email: z.string().email() });
const secretKey = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: { code: "VALIDATION_ERROR", message: "A valid email is required." } }, { status: 422 });
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });

  // Always return the same generic response whether or not the account
  // exists — a different response for "not found" is a user-enumeration
  // oracle, letting an attacker map out who has an account here.
  const genericResponse = Response.json({
    data: { message: "If an account exists for that email, a reset link has been sent." },
  });

  if (!user) return genericResponse;

  const resetToken = await new SignJWT({ sub: user.id, stage: "password_reset" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(secretKey);

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;
  const { subject, html, text } = passwordResetEmail(resetUrl);
  await sendEmail({ to: user.email, subject, html, text });

  await writeAuditLog({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "UPDATE",
    entityType: "User",
    entityId: user.id,
    afterState: { passwordResetRequested: true },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return genericResponse;
}
