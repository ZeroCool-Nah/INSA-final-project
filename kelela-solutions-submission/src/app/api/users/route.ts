import { z } from "zod";
import { withTenantRole, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { sendEmail, teammateInviteEmail } from "@/lib/email";

export const GET = withTenantRole(
  ["ORG_ADMIN", "COMPLIANCE_OFFICER", "AUDITOR", "IT_MANAGER"],
  async (_req, session) => {
    const users = await db.user.findMany({
      where: { organizationId: session.orgId },
      select: { id: true, fullName: true, email: true, role: true, lastLoginAt: true, lockedUntil: true, mfaEnabled: true },
      orderBy: { fullName: "asc" },
    });
    const data = users.map((u) => ({ ...u, disabled: !!(u.lockedUntil && u.lockedUntil > new Date()) }));
    return Response.json({ data });
  }
);

const inviteSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  // Deliberately excludes ORG_ADMIN — a teammate who can invite other
  // full admins is a privilege-escalation path best kept to the existing
  // org admin doing it manually/deliberately, not via this quick-invite form.
  role: z.enum(["COMPLIANCE_OFFICER", "AUDITOR", "IT_MANAGER"]),
});

// Only ORG_ADMIN can grow their own team — the other tenant roles can view
// the roster (for assigning control owners) but not add to it.
export const POST = withTenantRole(["ORG_ADMIN"], async (req, session) => {
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
  const teammate = await db.user.create({
    data: {
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
      organizationId: session.orgId,
    },
  });

  await writeAuditLog({
    organizationId: session.orgId,
    actorId: session.sub,
    action: "CREATE",
    entityType: "User",
    entityId: teammate.id,
    afterState: { email: teammate.email, role: teammate.role },
  });

  const org = await db.organization.findUnique({ where: { id: session.orgId }, select: { name: true } });
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const { subject, html, text } = teammateInviteEmail({
    orgName: org?.name ?? "your organization",
    loginUrl: `${appUrl}/login`,
    email: teammate.email,
    tempPassword: parsed.data.password,
  });
  await sendEmail({ to: teammate.email, subject, html, text });

  return Response.json(
    { data: { id: teammate.id, fullName: teammate.fullName, email: teammate.email, role: teammate.role } },
    { status: 201 }
  );
});
