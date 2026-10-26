"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlaCountdownProps {
  incidentTitle: string;
  deadline: string; // ISO date
}

function getRemaining(deadline: string) {
  const ms = new Date(deadline).getTime() - Date.now();
  const breached = ms <= 0;
  const abs = Math.abs(ms);
  const hours = Math.floor(abs / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  return { breached, hours, minutes };
}

export function SlaCountdown({ incidentTitle, deadline }: SlaCountdownProps) {
  const [remaining, setRemaining] = useState(() => getRemaining(deadline));

  useEffect(() => {
    const id = setInterval(() => setRemaining(getRemaining(deadline)), 30_000);
    return () => clearInterval(id);
  }, [deadline]);

  const urgent = !remaining.breached && remaining.hours < 6;

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-[var(--radius)] border px-4 py-3",
        remaining.breached
          ? "border-[hsl(var(--risk-critical)/0.4)] bg-[hsl(var(--risk-critical)/0.08)]"
          : urgent
          ? "border-[hsl(var(--risk-high)/0.4)] bg-[hsl(var(--risk-high)/0.08)]"
          : "border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]"
      )}
    >
      <div className="flex items-center gap-2.5">
        <AlertTriangle
          className={cn(
            "h-4 w-4 flex-none",
            remaining.breached
              ? "text-[hsl(var(--risk-critical))]"
              : urgent
              ? "text-[hsl(var(--risk-high))]"
              : "text-[hsl(var(--text-tertiary))]"
          )}
          strokeWidth={2}
        />
        <div>
          <div className="text-[12.5px] font-medium leading-tight">{incidentTitle}</div>
          <div className="text-[11px] text-[hsl(var(--text-tertiary))]">
            INSA mandatory disclosure window
          </div>
        </div>
      </div>

      <div
        className={cn(
          "font-mono-tabular text-[13px] font-semibold",
          remaining.breached
            ? "text-[hsl(var(--risk-critical))]"
            : urgent
            ? "text-[hsl(var(--risk-high))]"
            : "text-[hsl(var(--text-primary))]"
        )}
      >
        {remaining.breached
          ? `SLA breached · ${remaining.hours}h ${remaining.minutes}m overdue`
          : `${remaining.hours}h ${remaining.minutes}m remaining`}
      </div>
    </div>
  );
}
