"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/utils";

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actor: { fullName: string; email: string };
  createdAt: string;
  ipAddress: string | null;
}

const ACTION_COLOR: Record<string, string> = {
  CREATE: "var(--status-compliant)",
  UPDATE: "var(--status-in-review)",
  STATUS_CHANGE: "var(--status-in-review)",
  EVIDENCE_UPLOAD: "var(--status-compliant)",
  EVIDENCE_DOWNLOAD: "var(--text-tertiary)",
  EXPORT: "var(--risk-medium)",
  LOGIN: "var(--text-tertiary)",
  LOGIN_FAILED: "var(--risk-critical)",
  MFA_ENABLED: "var(--status-compliant)",
  MFA_DISABLED: "var(--risk-high)",
};

const ENTITY_TYPES = ["ALL", "ControlAssessment", "Incident", "User", "Report"];

export function AuditLogClient() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [entityType, setEntityType] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (entityType !== "ALL") params.set("entityType", entityType);
    fetch(`/api/audit-log?${params}`)
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(json?.error?.message ?? "Could not load the audit log.");
        }
        setEntries(json.data ?? []);
        setTotal(json.meta?.total ?? 0);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [entityType]);

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-0.5">
          {ENTITY_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setEntityType(t)}
              className={
                "rounded-[4px] px-2.5 py-1 text-[11.5px] font-medium transition-colors " +
                (entityType === t
                  ? "bg-[hsl(var(--surface-3))] text-[hsl(var(--text-primary))]"
                  : "text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))]")
              }
            >
              {t === "ALL" ? "All entities" : t}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-[hsl(var(--text-tertiary))]">{total} entries</span>
      </div>

      <div className="overflow-hidden rounded-[var(--radius)] border border-[hsl(var(--border-subtle))]">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] text-left text-[10.5px] uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Actor</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Entity</th>
              <th className="px-3 py-2 font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[11.5px] text-[hsl(var(--risk-critical))]">
                  {error}
                </td>
              </tr>
            ) : loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[11.5px] text-[hsl(var(--text-tertiary))]">
                  Loading…
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[11.5px] text-[hsl(var(--text-tertiary))]">
                  No audit entries for this filter.
                </td>
              </tr>
            ) : (
              entries.map((e) => {
                const color = ACTION_COLOR[e.action] ?? "var(--text-tertiary)";
                return (
                  <tr
                    key={e.id}
                    className="border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))] last:border-b-0 hover:bg-[hsl(var(--surface-2))]"
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-mono-tabular text-[11px] text-[hsl(var(--text-secondary))]">
                      {formatDateTime(e.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-[hsl(var(--text-primary))]">{e.actor.fullName}</td>
                    <td className="px-3 py-2">
                      <span
                        className="rounded-[4px] px-1.5 py-0.5 text-[10.5px] font-medium"
                        style={{ backgroundColor: `hsl(${color} / 0.14)`, color: `hsl(${color})` }}
                      >
                        {e.action.replace(/_/g, " ").toLowerCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[hsl(var(--text-secondary))]">
                      {e.entityType}
                      <span className="ml-1.5 font-mono-tabular text-[10.5px] text-[hsl(var(--text-tertiary))]">
                        {e.entityId.slice(0, 10)}…
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono-tabular text-[11px] text-[hsl(var(--text-tertiary))]">
                      {e.ipAddress ?? "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
