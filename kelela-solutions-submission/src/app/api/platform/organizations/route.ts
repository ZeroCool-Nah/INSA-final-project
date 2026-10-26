import { z } from "zod";
import { db } from "@/lib/db";
import { withPlatformRole, hashPassword } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";
import { sendEmail, teammateInviteEmail } from "@/lib/email";

export const GET = withPlatformRole(async (req, session) => {
  const { searchParams } = new URL(req.url);
  const includeRemoved = searchParams.get("includeRemoved") === "true";

  const organizations = await db.organization.findMany({
    where: includeRemoved ? {} : { status: { not: "DELETED" } },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true } },
    },
  });

  // Readiness + active-incident count per org — cheap enough at demo scale
  // to compute inline; move to a materialized rollup table if the tenant
  // count grows large.
  const data = await Promise.all(
    organizations.map(async (org) => {
      const [total, compliant, activeIncidentCount] = await Promise.all([
        db.controlAssessment.count({ where: { organizationId: org.id } }),
        db.controlAssessment.count({ where: { organizationId: org.id, status: "COMPLIANT" } }),
        db.incident.count({ where: { organizationId: org.id, status: { notIn: ["REPORTED_TO_INSA", "CLOSED"] } } }),
      ]);
      return {
        id: org.id,
        name: org.name,
        sector: org.sector,
        status: org.status,
        planTier: org.planTier,
        primaryContactEmail: org.primaryContactEmail,
        createdAt: org.createdAt,
        userCount: org._count.users,
        activeIncidentCount,
        readinessPct: total ? Math.round((compliant / total) * 100) : 0,
      };
    })
  );

  return Response.json({ data });
});

const createOrgSchema = z.object({
  name: z.string().min(2).max(200),
  sector: z.enum(["FINANCIAL", "TELECOM", "ENERGY", "GOVERNMENT", "HEALTHCARE", "OTHER"]),
  planTier: z.string().max(50).optional(),
  primaryContactEmail: z.string().email().optional(),
  adminFullName: z.string().min(1).max(200),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8).max(200),
});

export const POST = withPlatformRole(async (req, session) => {
  const body = await req.json().catch(() => null);
  const parsed = createOrgSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid payload.", fields: parsed.error.flatten().fieldErrors } },
      { status: 422 }
    );
  }

  const existingEmail = await db.user.findUnique({ where: { email: parsed.data.adminEmail } });
  if (existingEmail) {
    return Response.json({ error: { code: "CONFLICT", message: "That admin email is already in use." } }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.data.adminPassword);

  // Org + its first ORG_ADMIN user are created together — an org onboarded
  // with no one able to log into it isn't useful to anyone.
  const organization = await db.organization.create({
    data: {
      name: parsed.data.name,
      sector: parsed.data.sector,
      planTier: parsed.data.planTier,
      primaryContactEmail: parsed.data.primaryContactEmail,
      users: {
        create: {
          fullName: parsed.data.adminFullName,
          email: parsed.data.adminEmail,
          passwordHash,
          role: "ORG_ADMIN",
        },
      },
    },
  });

  // Every tenant needs a ControlAssessment row per control in the shared
  // catalog from day one — the matrix/detail-drawer/status-change flow all
  // operate on an assessment id, not the control id directly. Without this,
  // a freshly onboarded org shows an empty matrix with nothing to update.
  const allControls = await db.complianceControl.findMany({ select: { id: true } });
  if (allControls.length > 0) {
    await db.controlAssessment.createMany({
      data: allControls.map((c) => ({ controlId: c.id, organizationId: organization.id, status: "NOT_STARTED" as const })),
      skipDuplicates: true,
    });
  }

  await writeAuditLog({
    organizationId: null,
    actorId: session.sub,
    action: "CREATE",
    entityType: "Organization",
    entityId: organization.id,
    afterState: organization,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const { subject, html, text } = teammateInviteEmail({
    orgName: organization.name,
    loginUrl: `${appUrl}/login`,
    email: parsed.data.adminEmail,
    tempPassword: parsed.data.adminPassword,
  });
  await sendEmail({ to: parsed.data.adminEmail, subject, html, text });

  return Response.json({ data: organization }, { status: 201 });
});
