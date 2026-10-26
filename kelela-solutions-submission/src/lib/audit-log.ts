import { db } from "@/lib/db";
import type { AuditAction } from "@prisma/client";

interface AuditLogInput {
  organizationId: string | null; // null = platform-level action (SUPER_ADMIN, not tenant-scoped)
  actorId: string;
  action: AuditAction;
  entityType: "ControlAssessment" | "Incident" | "User" | "Report" | "Organization";
  entityId: string;
  controlAssessmentId?: string;
  incidentId?: string;
  beforeState?: unknown;
  afterState?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Append-only audit trail. The DB role used by the app should have no
 * UPDATE/DELETE grant on audit_log_entries — this function only ever
 * calls create().
 */
export async function writeAuditLog(input: AuditLogInput) {
  return db.auditLogEntry.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      controlAssessmentId: input.controlAssessmentId,
      incidentId: input.incidentId,
      beforeState: input.beforeState as any,
      afterState: input.afterState as any,
      ipAddress: input.ipAddress ?? undefined,
      userAgent: input.userAgent ?? undefined,
    },
  });
}
