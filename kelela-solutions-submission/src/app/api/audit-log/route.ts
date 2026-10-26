import { db } from "@/lib/db";
import { withTenantRole } from "@/lib/auth";

// Read-only visibility into the audit trail is opened to every tenant
// role — the sidebar links to this page for everyone, and a teammate
// hitting a 403 the moment they click it (as IT_MANAGER previously did,
// since this list didn't match the sidebar) reads as "the audit log is
// broken," not as an intentional restriction.
export const GET = withTenantRole(["ORG_ADMIN", "AUDITOR", "COMPLIANCE_OFFICER", "IT_MANAGER"], async (req, session) => {
  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entityType");
  const action = searchParams.get("action");
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Math.min(Number(searchParams.get("pageSize") ?? "50"), 200);

  const where = {
    organizationId: session.orgId,
    ...(entityType ? { entityType } : {}),
    ...(action ? { action: action as any } : {}),
  };

  const [total, entries] = await Promise.all([
    db.auditLogEntry.count({ where }),
    db.auditLogEntry.findMany({
      where,
      include: { actor: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return Response.json({ data: entries, meta: { total, page, pageSize } });
});
