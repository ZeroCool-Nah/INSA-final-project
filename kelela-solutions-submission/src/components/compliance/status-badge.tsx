import { cn } from "@/lib/utils";
import type { AssessmentStatus } from "@/types/compliance";

const STATUS_CONFIG: Record<AssessmentStatus, { label: string; color: string }> = {
  COMPLIANT: { label: "Compliant", color: "var(--status-compliant)" },
  IN_REVIEW: { label: "In review", color: "var(--status-in-review)" },
  NON_COMPLIANT: { label: "Non-compliant", color: "var(--status-non-compliant)" },
  NOT_STARTED: { label: "Not started", color: "var(--status-not-started)" },
  NOT_APPLICABLE: { label: "N/A", color: "var(--status-not-started)" },
};

export function StatusBadge({ status }: { status: AssessmentStatus }) {
  const config = STATUS_CONFIG[status];
  // Inline styles here (not Tailwind arbitrary-value classes) because the
  // color token is picked at runtime — Tailwind's JIT can't statically
  // discover a class name built from a template literal, so it would be
  // purged from the production build.
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium")}
      style={{ backgroundColor: `hsl(${config.color} / 0.14)`, color: `hsl(${config.color})` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: `hsl(${config.color})` }} />
      {config.label}
    </span>
  );
}
