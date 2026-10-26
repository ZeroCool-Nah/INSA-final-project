import { z } from "zod";
import { db } from "@/lib/db";
import { withSuperAdminRole, hashPassword } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";
import { sendEmail, teammateInviteEmail } from "@/lib/email";

// Platform staff are Users with no organizationId and role SUPER_ADMIN or
// PLATFORM_ADMIN. Reserved to the Super Admin — a Platform Admin managing
// their own peers (or promoting themselves) is exactly the privilege
// escalation path this boundary exists to prevent.

export const GET = withSuperAdminRole(async () => {
  const staff = await db.user.findMany({
    where: { organizationId: null },
    select: { id: true, fullName: true, email: true, role: true, lastLoginAt: true, createdAt: true, mfaEnabled: true },
    orderBy: { createdAt: "asc" },
  });
  return Response.json({ data: staff });
});

const inviteSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  // Deliberately excludes SUPER_ADMIN — creating another top-level Super
  // Admin is high-stakes enough that it isn't exposed through this form at
  // all; do it directly against the database if that's ever genuinely needed.
  role: z.literal("PLATFORM_ADMIN"),
});

export const POST = withSuperAdminRole(async (req, session) => {
  const body = await req.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid payload.", fields: parsed.error.flatten().fieldErrors } },
      { status: 422 }
    );
  }

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return Response.json({ error: { code: "CONFLICT", message: "That email is already in use." } }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const staffMember = await db.user.create({
    data: {
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      passwordHash,
      role: "PLATFORM_ADMIN",
      organizationId: null,
    },
  });

  await writeAuditLog({
    organizationId: null,
    actorId: session.sub,
    action: "CREATE",
    entityType: "User",
    entityId: staffMember.id,
    afterState: { email: staffMember.email, role: staffMember.role },
  });

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const { subject, html, text } = teammateInviteEmail({
    orgName: "Kelela Solutions (platform staff)",
    loginUrl: `${appUrl}/login`,
    email: staffMember.email,
    tempPassword: parsed.data.password,
  });
  await sendEmail({ to: staffMember.email, subject, html, text });

  return Response.json({ data: { id: staffMember.id, fullName: staffMember.fullName, email: staffMember.email, role: staffMember.role } }, { status: 201 });
});
