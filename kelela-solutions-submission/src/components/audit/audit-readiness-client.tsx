"use client";

import { useState } from "react";
import { Download, FileText, LayoutList } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditClientProps {
  userRole: string;
  readinessPct: number;
  totalControls: number;
  compliantControls: number;
  criticalGapCount: number;
}

export function AuditReadinessClient({
  userRole,
  readinessPct,
  totalControls,
  compliantControls,
  criticalGapCount,
}: AuditClientProps) {
  const [view, setView] = useState<"executive" | "auditor">(userRole === "AUDITOR" ? "auditor" : "executive");
  const [downloading, setDownloading] = useState<"executive" | "auditor" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport(target: "executive" | "auditor") {
    setError(null);
    setDownloading(target);
    try {
      const res = await fetch("/api/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ view: target }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error?.message ?? "Export failed.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compliance-summary-${target}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="mx-auto max-w-[900px]">
      {/* View toggle */}
      <div className="mb-4 flex items-center gap-1 rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-0.5 w-fit">
        <button
          onClick={() => setView("executive")}
          className={cn(
            "flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 text-[12px] font-medium transition-colors",
            view === "executive"
              ? "bg-[hsl(var(--surface-3))] text-[hsl(var(--text-primary))]"
              : "text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))]"
          )}
        >
          <LayoutList className="h-3.5 w-3.5" /> Executive view
        </button>
        <button
          onClick={() => setView("auditor")}
          className={cn(
            "flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 text-[12px] font-medium transition-colors",
            view === "auditor"
              ? "bg-[hsl(var(--surface-3))] text-[hsl(var(--text-primary))]"
              : "text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))]"
          )}
        >
          <FileText className="h-3.5 w-3.5" /> Auditor view
        </button>
      </div>

      {view === "executive" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <StatBlock label="Readiness" value={`${readinessPct}%`} />
            <StatBlock label="Compliant controls" value={`${compliantControls}/${totalControls}`} />
            <StatBlock label="Open critical gaps" value={String(criticalGapCount)} warn={criticalGapCount > 0} />
          </div>
          <p className="text-[12.5px] leading-relaxed text-[hsl(var(--text-secondary))]">
            This board-level summary rolls up readiness across INSA and NBE frameworks with the top
            open critical-risk gaps. Export produces a signed PDF suitable for board presentation.
          </p>
          <ExportButton
            label="Export executive summary (PDF)"
            loading={downloading === "executive"}
            onClick={() => handleExport("executive")}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[12.5px] leading-relaxed text-[hsl(var(--text-secondary))]">
            The auditor export is a control-by-control ledger — every assessment's status, owner, and
            evidence SHA-256 hash — suitable for direct submission to an INSA audit or ISO 27001
            surveillance review.
          </p>
          <ExportButton
            label="Export full audit ledger (PDF)"
            loading={downloading === "auditor"}
            onClick={() => handleExport("auditor")}
          />
        </div>
      )}

      {error && <p className="mt-3 text-[12px] text-[hsl(var(--risk-critical))]">{error}</p>}
    </div>
  );
}

function StatBlock({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-4">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
        {label}
      </div>
      <div
        className="font-mono-tabular text-[22px] font-semibold"
        style={{ color: warn ? "hsl(var(--risk-critical))" : "hsl(var(--text-primary))" }}
      >
        {value}
      </div>
    </div>
  );
}

function ExportButton({ label, loading, onClick }: { label: string; loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2 rounded-[var(--radius)] bg-[hsl(var(--accent))] px-4 py-2 text-[12.5px] font-medium text-white hover:opacity-90 disabled:opacity-50"
    >
      <Download className="h-3.5 w-3.5" />
      {loading ? "Generating…" : label}
    </button>
  );
}
