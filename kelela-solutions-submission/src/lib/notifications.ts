import { db } from "@/lib/db";

/**
 * Scans an org's live state for conditions worth surfacing (SLA breaches,
 * SLA at-risk, controls overdue or due soon) and upserts a Notification
 * per condition. Keyed by a stable dedupeKey so re-running this doesn't
 * spam duplicates — it just leaves the existing (possibly already-read)
 * notification alone.
 *
 * There's no cron/queue in this build, so this is called opportunistically
 * from page loads (see (dashboard)/layout.tsx). For production, move this
 * to a scheduled job instead of running it on every request.
 */
/**
 * Fires immediately when an ORG_ADMIN (or anyone with permission) assigns a
 * control to a teammate — unlike syncNotifications, this isn't a scan for a
 * standing condition, it's a direct event, so it's called inline from the
 * assessment PATCH handler rather than the opportunistic sync pass.
 * Targeted via userId — only the assignee sees it, not the whole org.
 */
export async function notifyAssignment(params: {
  organizationId: string;
  assessmentId: string;
  assigneeId: string;
  controlRef: string;
  category: string;
}) {
  await db.notification.upsert({
    // Re-assigning the same control to the same person twice (e.g. an
    // accidental double-save) shouldn't spam a second notification — but a
    // *different* assessment or a *different* assignee gets its own key.
    where: { organizationId_dedupeKey: { organizationId: params.organizationId, dedupeKey: `control-assigned-${params.assessmentId}-${params.assigneeId}` } },
    update: {},
    create: {
      organizationId: params.organizationId,
      userId: params.assigneeId,
      type: "CONTROL_ASSIGNED",
      title: "New control assigned to you",
      message: `${params.controlRef} (${params.category}) has been assigned to you.`,
      link: `/controls?highlight=${params.assessmentId}`,
      dedupeKey: `control-assigned-${params.assessmentId}-${params.assigneeId}`,
    },
  });
}

export async function syncNotifications(organizationId: string) {
  const now = new Date();
  const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [breachedIncidents, atRiskIncidents, overdueControls, dueSoonControls] = await Promise.all([
    db.incident.findMany({
      where: { organizationId, status: { notIn: ["REPORTED_TO_INSA", "CLOSED"] }, slaDeadline: { lt: now } },
    }),
    db.incident.findMany({
      where: {
        organizationId,
        status: { notIn: ["REPORTED_TO_INSA", "CLOSED"] },
        slaDeadline: { gte: now, lte: sixHoursFromNow },
      },
    }),
    db.controlAssessment.findMany({
      where: { organizationId, status: { not: "COMPLIANT" }, dueDate: { lt: now } },
      include: { control: true },
    }),
    db.controlAssessment.findMany({
      where: { organizationId, status: { not: "COMPLIANT" }, dueDate: { gte: now, lte: sevenDaysFromNow } },
      include: { control: true },
    }),
  ]);

  const upserts = [
    ...breachedIncidents.map((i) => ({
      dedupeKey: `sla-breach-${i.id}`,
      type: "SLA_BREACH" as const,
      title: "INSA disclosure SLA breached",
      message: `"${i.title}" passed its 48-hour disclosure window and has not been reported.`,
      link: "/incidents",
    })),
    ...atRiskIncidents.map((i) => ({
      dedupeKey: `sla-at-risk-${i.id}`,
      type: "SLA_AT_RISK" as const,
      title: "Disclosure deadline approaching",
      message: `"${i.title}" must be reported to INSA within 6 hours.`,
      link: "/incidents",
    })),
    ...overdueControls.map((a) => ({
      dedupeKey: `control-overdue-${a.id}`,
      type: "CONTROL_OVERDUE" as const,
      title: "Control assessment overdue",
      message: `${a.control.controlRef} (${a.control.category}) passed its due date and is still ${a.status.toLowerCase().replace("_", " ")}.`,
      link: `/controls?highlight=${a.controlId}`,
    })),
    ...dueSoonControls.map((a) => ({
      dedupeKey: `control-due-soon-${a.id}`,
      type: "CONTROL_DUE_SOON" as const,
      title: "Control assessment due soon",
      message: `${a.control.controlRef} (${a.control.category}) is due within 7 days.`,
      link: `/controls?highlight=${a.controlId}`,
    })),
  ];

  for (const n of upserts) {
    await db.notification.upsert({
      where: { organizationId_dedupeKey: { organizationId, dedupeKey: n.dedupeKey } },
      update: {}, // leave read-state and timestamp alone if it already exists
      create: {
        organizationId,
        type: n.type,
        title: n.title,
        message: n.message,
        link: n.link,
        dedupeKey: n.dedupeKey,
      },
    });
  }
}
