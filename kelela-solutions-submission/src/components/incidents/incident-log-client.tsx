"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { IncidentRow, type IncidentRowData } from "@/components/incidents/incident-row";

const STATUS_FLOW: IncidentRowData["status"][] = [
  "DETECTED",
  "CONTAINED",
  "ERADICATED",
  "RECOVERED",
  "REPORTED_TO_INSA",
  "CLOSED",
];

function nextStatus(current: IncidentRowData["status"]): IncidentRowData["status"] {
  const idx = STATUS_FLOW.indexOf(current);
  return STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)];
}

interface ControlOption {
  assessmentId: string;
  controlRef: string;
  category: string;
}

export function IncidentLogClient({
  initialIncidents,
  controlOptions,
}: {
  initialIncidents: IncidentRowData[];
  controlOptions: ControlOption[];
}) {
  const router = useRouter();
  const [incidents, setIncidents] = useState(initialIncidents);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    severity: "HIGH" as IncidentRowData["severity"],
    affectedSystems: "",
    linkedControlAssessmentId: "",
  });

  async function handleAdvance(id: string) {
    const incident = incidents.find((i) => i.id === id);
    if (!incident) return;
    const target = nextStatus(incident.status);

    const body: Record<string, string> = { status: target };
    if (target === "REPORTED_TO_INSA") body.insaReportedAt = new Date().toISOString();

    const res = await fetch(`/api/incidents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, status: target } : i)));
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          severity: form.severity,
          detectedAt: new Date().toISOString(),
          affectedSystems: form.affectedSystems
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          linkedControlAssessmentId: form.linkedControlAssessmentId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Could not log incident.");
        return;
      }
      const linkedOption = controlOptions.find((c) => c.assessmentId === form.linkedControlAssessmentId);
      setIncidents((prev) => [
        {
          ...json.data,
          detectedAt: json.data.detectedAt,
          slaDeadline: json.data.slaDeadline,
          linkedControlRef: linkedOption?.controlRef ?? null,
        },
        ...prev,
      ]);
      setShowForm(false);
      setForm({ title: "", description: "", severity: "HIGH", affectedSystems: "", linkedControlAssessmentId: "" });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[900px]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[12px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
          {incidents.length} incident{incidents.length === 1 ? "" : "s"}
        </h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-[var(--radius)] bg-[hsl(var(--accent))] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? "Cancel" : "Log incident"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-4 space-y-3 rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-4"
        >
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
              Title
            </label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-[13px] outline-none focus-visible:border-[hsl(var(--accent))]"
              placeholder="Brief incident title"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
              Description
            </label>
            <textarea
              required
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full resize-none rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-[13px] outline-none focus-visible:border-[hsl(var(--accent))]"
              placeholder="What happened, what's affected, current containment state…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
                Severity
              </label>
              <select
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as IncidentRowData["severity"] }))}
                className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-[13px] outline-none focus-visible:border-[hsl(var(--accent))]"
              >
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
                Affected systems
              </label>
              <input
                value={form.affectedSystems}
                onChange={(e) => setForm((f) => ({ ...f, affectedSystems: e.target.value }))}
                className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-[13px] outline-none focus-visible:border-[hsl(var(--accent))]"
                placeholder="Comma-separated, e.g. Core Banking VLAN, AD-DC-02"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
              Linked control (optional)
            </label>
            <select
              value={form.linkedControlAssessmentId}
              onChange={(e) => setForm((f) => ({ ...f, linkedControlAssessmentId: e.target.value }))}
              className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-[13px] outline-none focus-visible:border-[hsl(var(--accent))]"
            >
              <option value="">None</option>
              {controlOptions.map((c) => (
                <option key={c.assessmentId} value={c.assessmentId}>
                  {c.controlRef} — {c.category}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10.5px] text-[hsl(var(--text-tertiary))]">
              If this incident breaches its 48h SLA before being reported, the linked control is
              automatically marked non-compliant (unless you've turned that off on the control itself).
            </p>
          </div>
          {error && <p className="text-[12px] text-[hsl(var(--risk-critical))]">{error}</p>}
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-[hsl(var(--text-tertiary))]">
              The 48h INSA disclosure deadline is calculated automatically from detection time.
            </p>
            <button
              type="submit"
              disabled={saving}
              className="rounded-[var(--radius)] bg-[hsl(var(--accent))] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Logging…" : "Log incident"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-[var(--radius)] border border-[hsl(var(--border-subtle))]">
        {incidents.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-[hsl(var(--text-tertiary))]">
            No incidents logged yet.
          </div>
        ) : (
          incidents.map((incident) => (
            <IncidentRow key={incident.id} incident={incident} onAdvance={handleAdvance} />
          ))
        )}
      </div>
    </div>
  );
}
