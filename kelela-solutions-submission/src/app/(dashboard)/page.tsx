import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireTenantSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { SlaCountdown } from "@/components/dashboard/sla-countdown";
import { FrameworkStatusChart, RiskDistributionChart, ReadinessTrendChart } from "@/components/dashboard/compliance-charts";
import { RiskBadge } from "@/components/compliance/risk-badge";
import { formatDate } from "@/lib/utils";
import { recordReadinessSnapshot } from "@/lib/snapshot";
import { syncSlaAutoFlags } from "@/lib/sla-sync";

export default async function OverviewPage() {
  const session = await requireTenantSession();

  const orgId = session.orgId;

  // Cheap on-page-load sync since this project has no cron/queue infra:
  // flip any control whose linked incident breached its SLA, and make sure
  // today has a readiness snapshot for the trend chart.
  await syncSlaAutoFlags(orgId);
  await recordReadinessSnapshot(orgId);

  // --- Readiness rating, broken down by framework -----------------------
  const [insaTotal, insaCompliant, nbeTotal, nbeCompliant] = await Promise.all([
    db.controlAssessment.count({ where: { organizationId: orgId, control: { framework: { code: "INSA" } } } }),
    db.controlAssessment.count({
      where: { organizationId: orgId, status: "COMPLIANT", control: { framework: { code: "INSA" } } },
    }),
    db.controlAssessment.count({ where: { organizationId: orgId, control: { framework: { code: "NBE" } } } }),
    db.controlAssessment.count({
      where: { organizationId: orgId, status: "COMPLIANT", control: { framework: { code: "NBE" } } },
    }),
  ]);

  const insaPct = insaTotal ? Math.round((insaCompliant / insaTotal) * 100) : 0;
  const nbePct = nbeTotal ? Math.round((nbeCompliant / nbeTotal) * 100) : 0;
  const overallPct = insaTotal + nbeTotal ? Math.round(((insaCompliant + nbeCompliant) / (insaTotal + nbeTotal)) * 100) : 0;

  // --- Chart data: status breakdown per framework, risk distribution of open gaps ---
  const allAssessments = await db.controlAssessment.findMany({
    where: { organizationId: orgId },
    select: { status: true, control: { select: { riskLevel: true, framework: { select: { code: true } } } } },
  });

  const frameworkBreakdownMap = new Map<string, { compliant: number; inReview: number; nonCompliant: number; notStarted: number }>();
  const riskCounts: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

  for (const a of allAssessments) {
    const fw = a.control.framework.code;
    const bucket = frameworkBreakdownMap.get(fw) ?? { compliant: 0, inReview: 0, nonCompliant: 0, notStarted: 0 };
    if (a.status === "COMPLIANT") bucket.compliant++;
    else if (a.status === "IN_REVIEW") bucket.inReview++;
    else if (a.status === "NON_COMPLIANT") bucket.nonCompliant++;
    else if (a.status === "NOT_STARTED") bucket.notStarted++;
    frameworkBreakdownMap.set(fw, bucket);

    if (a.status !== "COMPLIANT" && a.status !== "NOT_APPLICABLE") {
      riskCounts[a.control.riskLevel] = (riskCounts[a.control.riskLevel] ?? 0) + 1;
    }
  }

  const frameworkBreakdown = Array.from(frameworkBreakdownMap.entries()).map(([framework, counts]) => ({
    framework,
    ...counts,
  }));

  const riskDistribution = [
    { name: "Critical", value: riskCounts.CRITICAL, color: "#f87171" },
    { name: "High", value: riskCounts.HIGH, color: "#fb923c" },
    { name: "Medium", value: riskCounts.MEDIUM, color: "#facc15" },
    { name: "Low", value: riskCounts.LOW, color: "#94a3b8" },
  ].filter((d) => d.value > 0);

  // --- Readiness trend (last 30 days of daily snapshots) ------------------
  const snapshots = await db.readinessSnapshot.findMany({
    where: { organizationId: orgId, date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    orderBy: { date: "asc" },
  });

  const trendData = snapshots.map((s) => ({
    date: formatDate(s.date),
    overallPct: s.overallPct,
    insaPct: s.insaPct,
    nbePct: s.nbePct,
  }));

  // --- Active incidents needing INSA disclosure --------------------------
  const activeIncidents = await db.incident.findMany({
    where: { organizationId: orgId, status: { notIn: ["REPORTED_TO_INSA", "CLOSED"] } },
    orderBy: { slaDeadline: "asc" },
    take: 3,
  });

  // --- Next 5 high-priority gap items ------------------------------------
  const gapItems = await db.controlAssessment.findMany({
    where: {
      organizationId: orgId,
      status: { in: ["NON_COMPLIANT", "NOT_STARTED", "IN_REVIEW"] },
      control: { riskLevel: { in: ["CRITICAL", "HIGH"] } },
    },
    include: { control: { include: { framework: true } } },
    orderBy: [{ dueDate: "asc" }],
    take: 5,
  });

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      {/* Readiness summary */}
      <section className="grid grid-cols-3 gap-3">
        <ReadinessCard label="Overall readiness" pct={overallPct} />
        <ReadinessCard label="INSA readiness" pct={insaPct} sub={`${insaCompliant}/${insaTotal} controls`} />
        <ReadinessCard label="NBE readiness" pct={nbePct} sub={`${nbeCompliant}/${nbeTotal} controls`} />
      </section>

      {/* Trend + status/risk charts */}
      <ReadinessTrendChart data={trendData} />
      <section className="grid grid-cols-2 gap-3">
        <FrameworkStatusChart data={frameworkBreakdown} />
        <RiskDistributionChart data={riskDistribution} />
      </section>

      {/* Active incident SLA countdowns */}
      {activeIncidents.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[12px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
              Active incident disclosure clocks
            </h2>
            <Link
              href="/incidents"
              className="flex items-center gap-1 text-[11.5px] text-[hsl(var(--accent))] hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {activeIncidents.map((incident) => (
              <SlaCountdown key={incident.id} incidentTitle={incident.title} deadline={incident.slaDeadline.toISOString()} />
            ))}
          </div>
        </section>
      )}

      {/* Next 5 high-priority gap items */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[12px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
            Next 5 high-priority gap items
          </h2>
          <Link
            href="/controls"
            className="flex items-center gap-1 text-[11.5px] text-[hsl(var(--accent))] hover:underline"
          >
            Open controls matrix <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="overflow-hidden rounded-[var(--radius)] border border-[hsl(var(--border-subtle))]">
          {gapItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12px] text-[hsl(var(--text-tertiary))]">
              No open high-risk gaps — every critical and high-risk control has evidence on file.
            </div>
          ) : (
            gapItems.map((item, i) => (
              <Link
                key={item.id}
                href={`/controls?highlight=${item.controlId}`}
                className="flex items-center justify-between border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] px-4 py-3 text-[12.5px] transition-colors last:border-b-0 hover:bg-[hsl(var(--surface-2))]"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono-tabular text-[11px] text-[hsl(var(--text-tertiary))]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <div className="font-medium text-[hsl(var(--text-primary))]">
                      {item.control.controlRef} · {item.control.category}
                    </div>
                    <div className="text-[11.5px] text-[hsl(var(--text-tertiary))]">
                      {item.control.framework.code} — {item.status.replace("_", " ").toLowerCase()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <RiskBadge level={item.control.riskLevel} />
                  <span className="font-mono-tabular text-[11.5px] text-[hsl(var(--text-secondary))]">
                    {item.dueDate ? formatDate(item.dueDate) : "No due date"}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function ReadinessCard({ label, pct, sub }: { label: string; pct: number; sub?: string }) {
  const color =
    pct >= 80 ? "var(--status-compliant)" : pct >= 50 ? "var(--risk-medium)" : "var(--risk-critical)";

  return (
    <div className="rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-4">
      <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
        {label}
      </div>
      <div className="flex items-end justify-between">
        <span className="font-mono-tabular text-[28px] font-semibold leading-none" style={{ color: `hsl(${color})` }}>
          {pct}%
        </span>
        {sub && <span className="text-[11px] text-[hsl(var(--text-tertiary))]">{sub}</span>}
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-[hsl(var(--surface-3))]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: `hsl(${color})` }} />
      </div>
    </div>
  );
}
