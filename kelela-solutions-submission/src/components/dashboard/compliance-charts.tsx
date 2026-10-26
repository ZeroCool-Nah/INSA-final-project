"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

interface FrameworkBreakdown {
  framework: string;
  compliant: number;
  inReview: number;
  nonCompliant: number;
  notStarted: number;
}

interface RiskDistributionItem {
  name: string;
  value: number;
  color: string;
}

const STATUS_COLORS = {
  compliant: "#34d399",
  inReview: "#60a5fa",
  nonCompliant: "#f87171",
  notStarted: "#6b7280",
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[6px] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-[11.5px] shadow-lg">
      {label && <div className="mb-1 font-medium text-[hsl(var(--text-primary))]">{label}</div>}
      {payload.map((p: any) => (
        <div key={p.dataKey ?? p.name} className="flex items-center gap-1.5 text-[hsl(var(--text-secondary))]">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color ?? p.payload.color }} />
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

export function ReadinessTrendChart({ data }: { data: { date: string; overallPct: number; insaPct: number; nbePct: number }[] }) {
  if (data.length < 2) {
    return (
      <div className="rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-4">
        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
          Readiness trend
        </h3>
        <p className="text-[11.5px] text-[hsl(var(--text-tertiary))]">
          Not enough history yet — this fills in as assessment statuses change over time.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-4">
      <h3 className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
        Readiness trend
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "hsl(var(--text-tertiary))", fontSize: 10.5 }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "hsl(var(--text-tertiary))", fontSize: 10.5 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip content={<ChartTooltip />} />
          <Line type="monotone" dataKey="overallPct" name="Overall" stroke="#60a5fa" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="insaPct" name="INSA" stroke="#34d399" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
          <Line type="monotone" dataKey="nbePct" name="NBE" stroke="#fbbf24" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-wrap gap-3">
        {[
          { label: "Overall", color: "#60a5fa" },
          { label: "INSA", color: "#34d399" },
          { label: "NBE", color: "#fbbf24" },
        ].map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-[10.5px] text-[hsl(var(--text-tertiary))]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function FrameworkStatusChart({ data }: { data: FrameworkBreakdown[] }) {
  return (
    <div className="rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-4">
      <h3 className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
        Control status by framework
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barSize={28}>
          <XAxis
            dataKey="framework"
            tick={{ fill: "hsl(var(--text-tertiary))", fontSize: 11 }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "hsl(var(--text-tertiary))", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--surface-3))" }} />
          <Bar dataKey="compliant" name="Compliant" stackId="s" fill={STATUS_COLORS.compliant} radius={[0, 0, 0, 0]} />
          <Bar dataKey="inReview" name="In review" stackId="s" fill={STATUS_COLORS.inReview} />
          <Bar dataKey="nonCompliant" name="Non-compliant" stackId="s" fill={STATUS_COLORS.nonCompliant} />
          <Bar dataKey="notStarted" name="Not started" stackId="s" fill={STATUS_COLORS.notStarted} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-wrap gap-3">
        {Object.entries(STATUS_COLORS).map(([key, color]) => (
          <span key={key} className="flex items-center gap-1.5 text-[10.5px] text-[hsl(var(--text-tertiary))]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
            {key === "inReview" ? "In review" : key === "nonCompliant" ? "Non-compliant" : key === "notStarted" ? "Not started" : "Compliant"}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RiskDistributionChart({ data }: { data: RiskDistributionItem[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-4">
      <h3 className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
        Open gaps by risk level
      </h3>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width="55%" height={180}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-2">
          {data.map((d) => (
            <div key={d.name} className="flex items-center justify-between text-[11.5px]">
              <span className="flex items-center gap-1.5 text-[hsl(var(--text-secondary))]">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name}
              </span>
              <span className="font-mono-tabular text-[hsl(var(--text-primary))]">
                {d.value} {total > 0 && <span className="text-[hsl(var(--text-tertiary))]">({Math.round((d.value / total) * 100)}%)</span>}
              </span>
            </div>
          ))}
          {total === 0 && <p className="text-[11.5px] text-[hsl(var(--text-tertiary))]">No open gaps.</p>}
        </div>
      </div>
    </div>
  );
}
