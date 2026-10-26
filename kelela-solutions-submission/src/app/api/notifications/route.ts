import { db } from "@/lib/db";
import { withTenantRole } from "@/lib/auth";
import { syncNotifications } from "@/lib/notifications";

export const GET = withTenantRole(
  ["ORG_ADMIN", "COMPLIANCE_OFFICER", "AUDITOR", "IT_MANAGER"],
  async (_req, session) => {
    await syncNotifications(session.orgId);

    const notifications = await db.notification.findMany({
      // Org-wide notifications (userId null, e.g. SLA breaches) go to
      // everyone; targeted ones (e.g. "this control was assigned to you")
      // only show to the person they're actually for.
      where: { organizationId: session.orgId, OR: [{ userId: null }, { userId: session.sub }] },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    return Response.json({ data: notifications, unreadCount: notifications.filter((n) => !n.read).length });
  }
);
