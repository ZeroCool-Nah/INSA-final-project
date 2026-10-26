import Link from "next/link";
import { ArrowRight, Building2, AlertTriangle, ShieldAlert, Users } from "lucide-react";
import { requirePlatformSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export default async function PlatformOverviewPage() {
  await requirePlatformSession();

  const [orgCount, activeOrgCount, tenantUserCount, activeIncidentCount, criticalGapCount, recentOrgs] = await Promise.all([
    db.organization.count({ where: { status: { not: "DELETED" } } }),
    db.organization.count({ where: { status: "ACTIVE" } }),
    db.user.count({ where: { organizationId: { not: null } } }),
    db.incident.count({ where: { status: { notIn: ["REPORTED_TO_INSA", "CLOSED"] } } }),
    db.controlAssessment.count({ where: { status: { not: "COMPLIANT" }, control: { riskLevel: "CRITICAL" } } }),
    db.organization.findMany({ where: { status: { not: "DELETED" } }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <section className="grid grid-cols-4 gap-3">
        <StatCard icon={Building2} label="Tenant organizations" value={String(orgCount)} sub={`${activeOrgCount} active`} />
        <StatCard icon={Users} label="Tenant users" value={String(tenantUserCount)} />
        <StatCard
          icon={AlertTriangle}
          label="Active incidents (all orgs)"
          value={String(activeIncidentCount)}
          warn={activeIncidentCount > 0}
        />
        <StatCard
          icon={ShieldAlert}
          label="Open critical gaps (all orgs)"
          value={String(criticalGapCount)}
          warn={criticalGapCount > 0}
        />
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[12px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
            Recently onboarded
          </h2>
          <Link href="/platform/organizations" className="flex items-center gap-1 text-[11.5px] text-[hsl(var(--accent))] hover:underline">
            View all organizations <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-hidden rounded-[var(--radius)] border border-[hsl(var(--border-subtle))]">
          {recentOrgs.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12px] text-[hsl(var(--text-tertiary))]">
              No tenant organizations yet.
            </div>
          ) : (
            recentOrgs.map((org) => (
              <Link
                key={org.id}
                href={`/platform/organizations/${org.id}`}
                className="flex items-center justify-between border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] px-4 py-3 text-[12.5px] transition-colors last:border-b-0 hover:bg-[hsl(var(--surface-2))]"
              >
                <div>
                  <div className="font-medium text-[hsl(var(--text-primary))]">{org.name}</div>
                  <div className="text-[11.5px] text-[hsl(var(--text-tertiary))]">
                    {org.sector} · onboarded {formatDate(org.createdAt)}
                  </div>
                </div>
                <StatusPill status={org.status} />
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  warn,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-4">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div
        className="font-mono-tabular text-[24px] font-semibold leading-none"
        style={{ color: warn ? "hsl(var(--risk-critical))" : "hsl(var(--text-primary))" }}
      >
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[11px] text-[hsl(var(--text-tertiary))]">{sub}</div>}
    </div>
  );
}

function StatusPill({ status }: { status: "ACTIVE" | "TRIAL" | "SUSPENDED" | "DELETED" }) {
  const config = {
    ACTIVE: { label: "Active", color: "var(--status-compliant)" },
    TRIAL: { label: "Trial", color: "var(--risk-medium)" },
    SUSPENDED: { label: "Suspended", color: "var(--risk-critical)" },
    DELETED: { label: "Removed", color: "var(--text-tertiary)" },
  }[status];

  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: `hsl(${config.color} / 0.14)`, color: `hsl(${config.color})` }}
    >
      {config.label}
    </span>
  );
}
