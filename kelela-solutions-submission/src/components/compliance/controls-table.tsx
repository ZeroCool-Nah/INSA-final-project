"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, SlidersHorizontal, Users } from "lucide-react";
import { StatusBadge } from "./status-badge";
import { RiskBadge } from "./risk-badge";
import { ControlDetailDrawer } from "./control-detail-drawer";
import { cn, formatDate } from "@/lib/utils";
import type {
  ComplianceControlRow,
  AssessmentStatus,
  FrameworkCode,
  RiskLevel,
} from "@/types/compliance";

interface ControlsTableProps {
  controls: ComplianceControlRow[];
  highlightId?: string;
}

const FRAMEWORK_FILTERS: Array<FrameworkCode | "ALL"> = ["ALL", "INSA", "NBE", "ISO27001", "NIST_CSF", "PCI_DSS", "SOC2"];
const STATUS_FILTERS: Array<AssessmentStatus | "ALL"> = [
  "ALL",
  "NON_COMPLIANT",
  "IN_REVIEW",
  "NOT_STARTED",
  "COMPLIANT",
];
const RISK_FILTERS: Array<RiskLevel | "ALL"> = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"];

const STATUS_LABEL: Record<AssessmentStatus | "ALL", string> = {
  ALL: "All statuses",
  NON_COMPLIANT: "Non-compliant",
  IN_REVIEW: "In review",
  NOT_STARTED: "Not started",
  COMPLIANT: "Compliant",
  NOT_APPLICABLE: "N/A",
};

export function ControlsTable({ controls, highlightId }: ControlsTableProps) {
  const router = useRouter();
  const [framework, setFramework] = useState<FrameworkCode | "ALL">("ALL");
  const [status, setStatus] = useState<AssessmentStatus | "ALL">("ALL");
  const [risk, setRisk] = useState<RiskLevel | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [selectedControlId, setSelectedControlId] = useState<string | null>(highlightId ?? null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [orgUsers, setOrgUsers] = useState<{ id: string; fullName: string }[]>([]);
  const [bulkAssignee, setBulkAssignee] = useState("");
  const [applying, setApplying] = useState(false);

  // A search result or an Overview gap-item link carries ?highlight=<controlId>.
  // Open that control's detail drawer immediately, flash its row, then drop
  // the query param so a refresh doesn't reopen it.
  useEffect(() => {
    if (!highlightId) return;
    setSelectedControlId(highlightId);
    setFlashId(highlightId);
    const timeout = setTimeout(() => setFlashId(null), 2200);
    router.replace("/controls", { scroll: false });
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId]);

  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((json) => setOrgUsers(json.data ?? []))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return controls.filter((c) => {
      if (framework !== "ALL" && c.framework !== framework) return false;
      if (status !== "ALL" && c.assessment?.status !== status) return false;
      if (risk !== "ALL" && c.riskLevel !== risk) return false;
      if (query) {
        const q = query.toLowerCase();
        if (
          !c.controlRef.toLowerCase().includes(q) &&
          !c.requirementText.toLowerCase().includes(q) &&
          !c.category.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [controls, framework, status, risk, query]);

  const selectedControl = controls.find((c) => c.id === selectedControlId) ?? null;
  const selectableIds = filtered.filter((c) => c.assessment).map((c) => c.assessment!.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  function toggleRow(assessmentId: string | undefined, e: React.MouseEvent) {
    e.stopPropagation();
    if (!assessmentId) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(assessmentId)) next.delete(assessmentId);
      else next.add(assessmentId);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) => {
      if (allSelected) return new Set();
      return new Set(selectableIds);
    });
  }

  async function applyBulkAssign() {
    if (selectedIds.size === 0 || !bulkAssignee) return;
    setApplying(true);
    try {
      const res = await fetch("/api/assessments/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentIds: Array.from(selectedIds),
          assignedToId: bulkAssignee === "unassign" ? null : bulkAssignee,
        }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        setBulkAssignee("");
        router.refresh();
      }
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="flex flex-col">
      {/* Filter bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-0.5">
          <SlidersHorizontal className="ml-1.5 h-3 w-3 text-[hsl(var(--text-tertiary))]" />
          {FRAMEWORK_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFramework(f)}
              className={cn(
                "rounded-[4px] px-2 py-1 text-[11.5px] font-medium transition-colors",
                framework === f
                  ? "bg-[hsl(var(--surface-3))] text-[hsl(var(--text-primary))]"
                  : "text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))]"
              )}
            >
              {f === "ALL" ? "All frameworks" : f}
            </button>
          ))}
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as AssessmentStatus | "ALL")}
          className="rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] px-2.5 py-[7px] text-[11.5px] text-[hsl(var(--text-secondary))] outline-none focus-visible:border-[hsl(var(--accent))]"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>

        <select
          value={risk}
          onChange={(e) => setRisk(e.target.value as RiskLevel | "ALL")}
          className="rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] px-2.5 py-[7px] text-[11.5px] text-[hsl(var(--text-secondary))] outline-none focus-visible:border-[hsl(var(--accent))]"
        >
          {RISK_FILTERS.map((r) => (
            <option key={r} value={r}>
              {r === "ALL" ? "All risk levels" : r.charAt(0) + r.slice(1).toLowerCase()}
            </option>
          ))}
        </select>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by ref, requirement, category…"
          className="ml-auto w-64 rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] px-2.5 py-[7px] text-[11.5px] outline-none placeholder:text-[hsl(var(--text-tertiary))] focus-visible:border-[hsl(var(--accent))]"
        />

        <span className="text-[11px] text-[hsl(var(--text-tertiary))]">
          {filtered.length} of {controls.length}
        </span>
      </div>

      {/* Bulk action bar — appears once at least one row is selected */}
      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-[var(--radius)] border border-[hsl(var(--accent))] bg-[hsl(var(--accent-muted))] px-3 py-2">
          <Users className="h-3.5 w-3.5 flex-none text-[hsl(var(--accent))]" />
          <span className="text-[12px] font-medium text-[hsl(var(--text-primary))]">
            {selectedIds.size} selected
          </span>
          <select
            value={bulkAssignee}
            onChange={(e) => setBulkAssignee(e.target.value)}
            className="ml-2 rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-2 py-1 text-[11.5px] outline-none focus-visible:border-[hsl(var(--accent))]"
          >
            <option value="">Assign to…</option>
            <option value="unassign">Unassign</option>
            {orgUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
          <button
            onClick={applyBulkAssign}
            disabled={!bulkAssignee || applying}
            className="rounded-[var(--radius)] bg-[hsl(var(--accent))] px-2.5 py-1 text-[11.5px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {applying ? "Applying…" : "Apply"}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-[11.5px] text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))]"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-[var(--radius)] border border-[hsl(var(--border-subtle))]">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] text-left text-[11px] uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
              <th className="w-[32px] px-3 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-3.5 w-3.5 accent-[hsl(var(--accent))]"
                  aria-label="Select all"
                />
              </th>
              <th className="w-[110px] px-3 py-2 font-medium">Control</th>
              <th className="px-3 py-2 font-medium">Requirement</th>
              <th className="w-[130px] px-3 py-2 font-medium">Category</th>
              <th className="w-[90px] px-3 py-2 font-medium">Risk</th>
              <th className="w-[130px] px-3 py-2 font-medium">Status</th>
              <th className="w-[120px] px-3 py-2 font-medium">Owner</th>
              <th className="w-[90px] px-3 py-2 font-medium">Due</th>
              <th className="w-[32px] px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((control) => (
              <tr
                key={control.id}
                onClick={() => setSelectedControlId(control.id)}
                className={cn(
                  "cursor-pointer border-b border-[hsl(var(--border-subtle))] transition-colors last:border-b-0 hover:bg-[hsl(var(--surface-2))]",
                  flashId === control.id ? "bg-[hsl(var(--accent-muted))]" : "bg-[hsl(var(--surface-0))]"
                )}
              >
                <td className="px-3 py-2.5">
                  {control.assessment && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(control.assessment.id)}
                      onChange={() => {}}
                      onClick={(e) => toggleRow(control.assessment?.id, e)}
                      className="h-3.5 w-3.5 accent-[hsl(var(--accent))]"
                      aria-label={`Select ${control.controlRef}`}
                    />
                  )}
                </td>
                <td className="px-3 py-2.5 font-mono-tabular text-[11.5px] text-[hsl(var(--text-secondary))]">
                  {control.controlRef}
                </td>
                <td className="max-w-[420px] truncate px-3 py-2.5 text-[hsl(var(--text-primary))]">
                  {control.requirementText}
                </td>
                <td className="px-3 py-2.5 text-[hsl(var(--text-secondary))]">{control.category}</td>
                <td className="px-3 py-2.5">
                  <RiskBadge level={control.riskLevel} />
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={control.assessment?.status ?? "NOT_STARTED"} />
                </td>
                <td className="px-3 py-2.5 text-[hsl(var(--text-secondary))]">
                  {control.assessment?.assignedTo?.fullName ?? "—"}
                </td>
                <td className="px-3 py-2.5 font-mono-tabular text-[11.5px] text-[hsl(var(--text-secondary))]">
                  {control.assessment?.dueDate ? formatDate(control.assessment.dueDate) : "—"}
                </td>
                <td className="px-2 py-2.5 text-[hsl(var(--text-tertiary))]">
                  <ChevronRight className="h-3.5 w-3.5" />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-[12px] text-[hsl(var(--text-tertiary))]">
                  No controls match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ControlDetailDrawer
        control={selectedControl}
        open={!!selectedControl}
        onClose={() => setSelectedControlId(null)}
        orgUsers={orgUsers}
      />
    </div>
  );
}
