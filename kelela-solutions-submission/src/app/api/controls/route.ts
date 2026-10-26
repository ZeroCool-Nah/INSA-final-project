import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } }, { status: 401 });
  }
  if (!session.orgId) {
    return Response.json(
      { error: { code: "FORBIDDEN", message: "This endpoint requires a tenant-scoped account." } },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const framework = searchParams.get("framework");
  const riskParam = searchParams.get("risk");
  const q = searchParams.get("q");
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Math.min(Number(searchParams.get("pageSize") ?? "25"), 100);

  const where = {
    ...(framework ? { framework: { code: framework as any } } : {}),
    ...(riskParam ? { riskLevel: riskParam as any } : {}),
    ...(q
      ? {
          OR: [
            { controlRef: { contains: q, mode: "insensitive" as const } },
            { requirementText: { contains: q, mode: "insensitive" as const } },
            { category: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, controls] = await Promise.all([
    db.complianceControl.count({ where }),
    db.complianceControl.findMany({
      where,
      include: {
        framework: true,
        assessments: {
          where: { organizationId: session.orgId },
          include: { assignedTo: true },
          take: 1,
        },
      },
      orderBy: [{ riskLevel: "asc" }, { controlRef: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const data = controls.map((c) => ({
    id: c.id,
    controlRef: c.controlRef,
    framework: c.framework.code,
    category: c.category,
    requirementText: c.requirementText,
    riskLevel: c.riskLevel,
    assessment: c.assessments[0]
      ? {
          id: c.assessments[0].id,
          status: c.assessments[0].status,
          assignedTo: c.assessments[0].assignedTo
            ? { id: c.assessments[0].assignedTo.id, fullName: c.assessments[0].assignedTo.fullName }
            : null,
          dueDate: c.assessments[0].dueDate,
          evidenceFileName: c.assessments[0].evidenceFileName,
        }
      : null,
  }));

  return Response.json({ data, meta: { total, page, pageSize } });
}
