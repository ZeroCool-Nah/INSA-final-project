"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, UploadCloud, FileCheck2, Copy, Check, ShieldAlert, ShieldOff, AlertTriangle } from "lucide-react";
import { StatusBadge } from "./status-badge";
import { RiskBadge } from "./risk-badge";
import { cn, formatDateTime } from "@/lib/utils";
import type { ComplianceControlRow, AssessmentStatus } from "@/types/compliance";

interface ControlDetailDrawerProps {
  control: ComplianceControlRow | null;
  open: boolean;
  onClose: () => void;
  orgUsers: { id: string; fullName: string }[];
}

const STATUS_OPTIONS: AssessmentStatus[] = [
  "NOT_STARTED",
  "IN_REVIEW",
  "NON_COMPLIANT",
  "COMPLIANT",
  "NOT_APPLICABLE",
];

export function ControlDetailDrawer({ control, open, onClose, orgUsers }: ControlDetailDrawerProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notes, setNotes] = useState(control?.assessment?.notes ?? "");

  if (!control) return null;

  async function updateStatus(nextStatus: AssessmentStatus) {
    if (!control?.assessment) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/assessments/${control.assessment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("Update failed");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function updateOwner(nextOwnerId: string) {
    if (!control?.assessment) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/assessments/${control.assessment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: nextOwnerId || null }),
      });
      if (!res.ok) throw new Error("Update failed");
      // Reassignment notifies the new owner server-side (see notifyAssignment
      // in the PATCH handler) — nothing further to trigger from here.
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function uploadEvidence(file: File) {
    if (!control?.assessment) return;
    const form = new FormData();
    form.append("file", file);
    setSaving(true);
    try {
      const res = await fetch(`/api/assessments/${control.assessment.id}/evidence`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("Upload failed");
    } finally {
      setSaving(false);
    }
  }

  function copyHash() {
    if (!control?.assessment?.evidenceHash) return;
    navigator.clipboard.writeText(control.assessment.evidenceHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function toggleAutoFlag() {
    if (!control?.assessment) return;
    setSaving(true);
    try {
      await fetch(`/api/assessments/${control.assessment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slaAutoFlag: !control.assessment.slaAutoFlag }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Scrim */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Control ${control.controlRef} detail`}
        className={cn(
          "fixed right-0 top-0 z-50 flex h-screen w-[440px] flex-col border-l border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] shadow-2xl transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[hsl(var(--border-subtle))] px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono-tabular text-[12px] text-[hsl(var(--text-tertiary))]">
                {control.controlRef}
              </span>
              <span className="text-[11px] text-[hsl(var(--text-tertiary))]">·</span>
              <span className="text-[11px] text-[hsl(var(--text-tertiary))]">{control.framework}</span>
            </div>
            <h2 className="mt-1 text-[14px] font-medium leading-snug">{control.category}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="rounded-[4px] p-1 text-[hsl(var(--text-tertiary))] hover:bg-[hsl(var(--surface-3))] hover:text-[hsl(var(--text-primary))]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Risk + status row */}
          <div className="mb-4 flex items-center gap-2">
            <RiskBadge level={control.riskLevel} />
            <StatusBadge status={control.assessment?.status ?? "NOT_STARTED"} />
          </div>

          {/* Requirement text */}
          <section className="mb-5">
            <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
              Requirement
            </h3>
            <p className="text-[13px] leading-relaxed text-[hsl(var(--text-primary))]">
              {control.requirementText}
            </p>
          </section>

          {/* Cross-mapped controls */}
          {control.mappedIsoRefs && control.mappedIsoRefs.length > 0 && (
            <section className="mb-5">
              <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
                Cross-mapped controls
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {control.mappedIsoRefs.map((ref) => (
                  <span
                    key={ref}
                    className="rounded-[4px] border border-[hsl(var(--border))] px-1.5 py-0.5 font-mono-tabular text-[11px] text-[hsl(var(--text-secondary))]"
                  >
                    {ref}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Status control */}
          <section className="mb-5">
            <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
              Update status
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  disabled={saving}
                  onClick={() => updateStatus(s)}
                  className={cn(
                    "rounded-[var(--radius)] border px-2.5 py-1 text-[11.5px] font-medium transition-colors disabled:opacity-50",
                    control.assessment?.status === s
                      ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent-muted))] text-[hsl(var(--accent))]"
                      : "border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:border-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))]"
                  )}
                >
                  {s.replace("_", " ").toLowerCase()}
                </button>
              ))}
            </div>
          </section>

          {/* Owner + asset */}
          <section className="mb-5 grid grid-cols-2 gap-3">
            <div>
              <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
                Owner
              </h3>
              <select
                value={control.assessment?.assignedTo?.id ?? ""}
                onChange={(e) => updateOwner(e.target.value)}
                disabled={saving || !control.assessment}
                className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-2 py-1.5 text-[13px] text-[hsl(var(--text-primary))] outline-none focus-visible:border-[hsl(var(--accent))] disabled:opacity-50"
              >
                <option value="">Unassigned</option>
                {orgUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
                Linked asset
              </h3>
              <p className="text-[13px] text-[hsl(var(--text-primary))]">
                {control.assessment?.linkedAssetName ?? "Not linked"}
              </p>
            </div>
          </section>

          {/* Related incidents + auto-flag control */}
          {control.assessment?.linkedIncidents && control.assessment.linkedIncidents.length > 0 && (
            <section className="mb-5">
              <div className="mb-1.5 flex items-center justify-between">
                <h3 className="text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
                  Related incidents
                </h3>
                <button
                  onClick={toggleAutoFlag}
                  disabled={saving}
                  className={cn(
                    "flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[10.5px] font-medium",
                    control.assessment.slaAutoFlag
                      ? "text-[hsl(var(--accent))]"
                      : "text-[hsl(var(--text-tertiary))]"
                  )}
                  title="Whether an SLA-breached linked incident is allowed to auto-flag this control non-compliant"
                >
                  {control.assessment.slaAutoFlag ? (
                    <ShieldAlert className="h-3 w-3" />
                  ) : (
                    <ShieldOff className="h-3 w-3" />
                  )}
                  Auto-flag {control.assessment.slaAutoFlag ? "on" : "off"}
                </button>
              </div>
              <div className="space-y-1.5">
                {control.assessment.linkedIncidents.map((incident) => {
                  const breached =
                    new Date(incident.slaDeadline) < new Date() &&
                    incident.status !== "REPORTED_TO_INSA" &&
                    incident.status !== "CLOSED";
                  return (
                    <div
                      key={incident.id}
                      className="flex items-center justify-between rounded-[4px] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-2.5 py-1.5"
                    >
                      <div className="flex items-center gap-1.5">
                        {breached && <AlertTriangle className="h-3 w-3 flex-none text-[hsl(var(--risk-critical))]" />}
                        <span className="text-[12px] text-[hsl(var(--text-primary))]">{incident.title}</span>
                      </div>
                      <span className="text-[10.5px] text-[hsl(var(--text-tertiary))]">
                        {incident.status.replace(/_/g, " ").toLowerCase()}
                      </span>
                    </div>
                  );
                })}
              </div>
              {!control.assessment.slaAutoFlag && (
                <p className="mt-1.5 text-[10.5px] text-[hsl(var(--text-tertiary))]">
                  Auto-flagging is off for this control — an SLA breach on the incidents above won't
                  change this status until you turn it back on.
                </p>
              )}
            </section>
          )}

          {/* Evidence vault */}
          <section className="mb-5">
            <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
              Evidence
            </h3>

            {control.assessment?.evidenceFileName ? (
              <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-3">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4 flex-none text-[hsl(var(--status-compliant))]" />
                  <span className="truncate text-[12.5px] text-[hsl(var(--text-primary))]">
                    {control.assessment.evidenceFileName}
                  </span>
                </div>
                {control.assessment.evidenceHash && (
                  <button
                    onClick={copyHash}
                    className="mt-2 flex w-full items-center justify-between rounded-[4px] bg-[hsl(var(--surface-3))] px-2 py-1.5 text-left"
                  >
                    <span className="truncate font-mono-tabular text-[10.5px] text-[hsl(var(--text-tertiary))]">
                      SHA-256 {control.assessment.evidenceHash}
                    </span>
                    {copied ? (
                      <Check className="h-3 w-3 flex-none text-[hsl(var(--status-compliant))]" />
                    ) : (
                      <Copy className="h-3 w-3 flex-none text-[hsl(var(--text-tertiary))]" />
                    )}
                  </button>
                )}
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[var(--radius)] border border-dashed border-[hsl(var(--border))] px-3 py-6 text-center hover:border-[hsl(var(--accent))]">
                <UploadCloud className="h-5 w-5 text-[hsl(var(--text-tertiary))]" />
                <span className="text-[12px] text-[hsl(var(--text-secondary))]">
                  Upload PDF or scan — hashed on receipt
                </span>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadEvidence(e.target.files[0])}
                />
              </label>
            )}
          </section>

          {/* Notes */}
          <section>
            <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
              Notes
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add assessment context for the auditor…"
              className="w-full resize-none rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-2.5 py-2 text-[12.5px] outline-none placeholder:text-[hsl(var(--text-tertiary))] focus-visible:border-[hsl(var(--accent))]"
            />
          </section>
        </div>

        {/* Footer: last updated */}
        {control.assessment && (
          <div className="border-t border-[hsl(var(--border-subtle))] px-5 py-3 text-[11px] text-[hsl(var(--text-tertiary))]">
            Last updated {formatDateTime(new Date())} · every change is written to the immutable audit log
          </div>
        )}
      </aside>
    </>
  );
}
