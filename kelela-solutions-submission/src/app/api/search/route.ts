import { db } from "@/lib/db";
import { withTenantRole } from "@/lib/auth";

export const GET = withTenantRole(
  ["ORG_ADMIN", "COMPLIANCE_OFFICER", "AUDITOR", "IT_MANAGER"],
  async (req, session) => {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();

    if (q.length < 2) {
      return Response.json({ data: { controls: [], incidents: [] } });
    }

    const [assessments, incidents] = await Promise.all([
      db.controlAssessment.findMany({
        where: {
          organizationId: session.orgId,
          control: {
            OR: [
              { controlRef: { contains: q, mode: "insensitive" } },
              { category: { contains: q, mode: "insensitive" } },
              { requirementText: { contains: q, mode: "insensitive" } },
            ],
          },
        },
        include: { control: { select: { controlRef: true, category: true, framework: { select: { code: true } } } } },
        take: 6,
      }),
      db.incident.findMany({
        where: {
          organizationId: session.orgId,
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, title: true, severity: true, status: true },
        take: 6,
      }),
    ]);

    return Response.json({
      data: {
        controls: assessments.map((a) => ({
          controlId: a.controlId,
          controlRef: a.control.controlRef,
          category: a.control.category,
          framework: a.control.framework.code,
        })),
        incidents,
      },
    });
  }
);
