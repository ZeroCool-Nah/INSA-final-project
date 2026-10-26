import type { RiskLevel } from "@/types/compliance";

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string }> = {
  CRITICAL: { label: "Critical", color: "var(--risk-critical)" },
  HIGH: { label: "High", color: "var(--risk-high)" },
  MEDIUM: { label: "Medium", color: "var(--risk-medium)" },
  LOW: { label: "Low", color: "var(--risk-low)" },
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  const config = RISK_CONFIG[level];
  return (
    <span
      className="inline-flex items-center rounded-[4px] border px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wide"
      style={{
        borderColor: `hsl(${config.color} / 0.35)`,
        color: `hsl(${config.color})`,
        backgroundColor: `hsl(${config.color} / 0.08)`,
      }}
    >
      {config.label}
    </span>
  );
}
