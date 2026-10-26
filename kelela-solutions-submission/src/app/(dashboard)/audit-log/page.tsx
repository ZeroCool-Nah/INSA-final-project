import { requireTenantSession } from "@/lib/auth";
import { AuditLogClient } from "@/components/audit-log/audit-log-client";

export default async function AuditLogPage() {
  const session = await requireTenantSession();

  return <AuditLogClient />;
}
