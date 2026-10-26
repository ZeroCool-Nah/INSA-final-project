import { db } from "@/lib/db";

/**
 * Records today's readiness percentages for an org so the Overview trend
 * chart has history to plot. Idempotent per (org, day) — safe to call on
 * every assessment status change; upsert just overwrites today's row with
 * the latest numbers rather than creating duplicates.
 */
export async function recordReadinessSnapshot(organizationId: string) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [insaTotal, insaCompliant, nbeTotal, nbeCompliant, total, compliant] = await Promise.all([
    db.controlAssessment.count({ where: { organizationId, control: { framework: { code: "INSA" } } } }),
    db.controlAssessment.count({ where: { organizationId, status: "COMPLIANT", control: { framework: { code: "INSA" } } } }),
    db.controlAssessment.count({ where: { organizationId, control: { framework: { code: "NBE" } } } }),
    db.controlAssessment.count({ where: { organizationId, status: "COMPLIANT", control: { framework: { code: "NBE" } } } }),
    db.controlAssessment.count({ where: { organizationId } }),
    db.controlAssessment.count({ where: { organizationId, status: "COMPLIANT" } }),
  ]);

  const insaPct = insaTotal ? Math.round((insaCompliant / insaTotal) * 100) : 0;
  const nbePct = nbeTotal ? Math.round((nbeCompliant / nbeTotal) * 100) : 0;
  const overallPct = total ? Math.round((compliant / total) * 100) : 0;

  await db.readinessSnapshot.upsert({
    where: { organizationId_date: { organizationId, date: today } },
    update: { insaPct, nbePct, overallPct },
    create: { organizationId, date: today, insaPct, nbePct, overallPct },
  });
}
