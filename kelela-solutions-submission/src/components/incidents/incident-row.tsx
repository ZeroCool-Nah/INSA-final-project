"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";

export interface IncidentRowData {
  id: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: "DETECTED" | "CONTAINED" | "ERADICATED" | "RECOVERED" | "REPORTED_TO_INSA" | "CLOSED";
  detectedAt: string;
  slaDeadline: string;
  affectedSystems: string[];
  linkedControlRef?: string | null;
}

const SEVERITY_COLOR: Record<IncidentRowData["severity"], string> = {
  CRITICAL: "var(--risk-critical)",
  HIGH: "var(--risk-high)",
  MEDIUM: "var(--risk-medium)",
  LOW: "var(--risk-low)",
};

const STATUS_LABEL: Record<IncidentRowData["status"], string> = {
  DETECTED: "Detected",
  CONTAINED: "Contained",
  ERADICATED: "Eradicated",
  RECOVERED: "Recovered",
  REPORTED_TO_INSA: "Reported to INSA",
  CLOSED: "Closed",
};

export function IncidentRow({ incident, onAdvance }: { incident: IncidentRowData; onAdvance: (id: string) => void }) {
  const deadline = new Date(incident.slaDeadline);
  const breached = deadline.getTime() < Date.now();
  const resolved = incident.status === "REPORTED_TO_INSA" || incident.status === "CLOSED";
  const severityColor = SEVERITY_COLOR[incident.severity];

  return (
    <div className="flex items-center justify-between border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] px-4 py-3 last:border-b-0">
      <div className="flex items-start gap-3">
        {resolved ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-[hsl(var(--status-compliant))]" />
        ) : (
          <AlertTriangle
            className="mt-0.5 h-4 w-4 flex-none"
            style={{ color: `hsl(${severityColor})` }}
          />
        )}
        <div>
          <div className="text-[13px] font-medium text-[hsl(var(--text-primary))]">{incident.title}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[hsl(var(--text-tertiary))]">
            <span
              className="rounded-[4px] border px-1.5 py-0.5 font-medium uppercase tracking-wide"
              style={{
                borderColor: `hsl(${severityColor} / 0.35)`,
                color: `hsl(${severityColor})`,
                backgroundColor: `hsl(${severityColor} / 0.08)`,
              }}
            >
              {incident.severity}
            </span>
            <span>{STATUS_LABEL[incident.status]}</span>
            <span>·</span>
            <span>Detected {formatDateTime(incident.detectedAt)}</span>
            {incident.linkedControlRef && (
              <>
                <span>·</span>
                <span className="font-mono-tabular">Linked: {incident.linkedControlRef}</span>
              </>
            )}
            {incident.affectedSystems.length > 0 && (
              <>
                <span>·</span>
                <span>{incident.affectedSystems.join(", ")}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={cn(
            "font-mono-tabular text-[11.5px]",
            resolved
              ? "text-[hsl(var(--text-tertiary))]"
              : breached
              ? "text-[hsl(var(--risk-critical))] font-medium"
              : "text-[hsl(var(--text-secondary))]"
          )}
        >
          {resolved
            ? `Closed out ${formatDateTime(incident.slaDeadline)}`
            : breached
            ? "SLA breached"
            : `Due ${formatDateTime(incident.slaDeadline)}`}
        </span>
        {!resolved && (
          <button
            onClick={() => onAdvance(incident.id)}
            className="rounded-[var(--radius)] border border-[hsl(var(--border))] px-2.5 py-1 text-[11px] font-medium text-[hsl(var(--text-secondary))] hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--text-primary))]"
          >
            Advance status
          </button>
        )}
      </div>
    </div>
  );
}
