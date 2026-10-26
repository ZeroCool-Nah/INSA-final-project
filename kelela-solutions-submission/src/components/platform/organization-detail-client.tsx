"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

interface OrgDetail {
  id: string;
  name: string;
  sector: string;
  status: "ACTIVE" | "TRIAL" | "SUSPENDED" | "DELETED";
  planTier: string | null;
  primaryContactEmail: string | null;
  readinessPct: number;
  totalControls: number;
  activeIncidentCount: number;
  users: { id: string; fullName: string; email: string; role: string; lastLoginAt: string | null }[];
}

export function OrganizationDetailClient({ org, canManage }: { org: OrgDetail; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  async function setStatus(status: "ACTIVE" | "SUSPENDED" | "DELETED", confirmName?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/platform/organizations/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(confirmName ? { confirmName } : {}) }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error?.message ?? "Could not update status.");
        return;
      }
      setShowRemoveConfirm(false);
      setConfirmText("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const isRemoved = org.status === "DELETED";

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      {isRemoved && (
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-[hsl(var(--risk-critical)/0.4)] bg-[hsl(var(--risk-critical)/0.08)] px-4 py-3">
          <AlertTriangle className="h-4 w-4 flex-none text-[hsl(var(--risk-critical))]" />
          <p className="text-[12.5px] text-[hsl(var(--text-primary))]">
            This organization has been removed. All of its users are locked out, but no compliance data has been
            deleted — assessments, incidents, evidence, and the audit log are all intact and can be restored.
          </p>
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-[hsl(var(--text-primary))]">{org.name}</h1>
          <p className="mt-0.5 text-[12.5px] text-[hsl(var(--text-tertiary))]">
            {org.sector} · {org.planTier ?? "No plan set"} {org.primaryContactEmail && `· ${org.primaryContactEmail}`}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {isRemoved ? (
              <button
                onClick={() => setStatus("ACTIVE")}
                disabled={busy}
                className="rounded-[var(--radius)] bg-[hsl(var(--status-compliant))] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Restore organization
              </button>
            ) : (
              <>
                {org.status === "SUSPENDED" ? (
                  <button
                    onClick={() => setStatus("ACTIVE")}
                    disabled={busy}
                    className="rounded-[var(--radius)] bg-[hsl(var(--status-compliant))] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Reactivate
                  </button>
                ) : (
                  <button
                    onClick={() => setStatus("SUSPENDED")}
                    disabled={busy}
                    className="rounded-[var(--radius)] border border-[hsl(var(--risk-critical)/0.4)] px-3 py-1.5 text-[12px] font-medium text-[hsl(var(--risk-critical))] hover:bg-[hsl(var(--risk-critical)/0.08)] disabled:opacity-50"
                  >
                    Suspend organization
                  </button>
                )}
                <button
                  onClick={() => setShowRemoveConfirm(true)}
                  disabled={busy}
                  className="rounded-[var(--radius)] bg-[hsl(var(--risk-critical))] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  Remove organization
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {showRemoveConfirm && (
        <div className="space-y-3 rounded-[var(--radius)] border border-[hsl(var(--risk-critical)/0.4)] bg-[hsl(var(--risk-critical)/0.06)] p-4">
          <p className="text-[13px] font-medium text-[hsl(var(--text-primary))]">
            Remove {org.name}? This immediately locks out every user in this organization.
          </p>
          <p className="text-[12px] text-[hsl(var(--text-secondary))]">
            No data is deleted — this is reversible. Type the organization's name to confirm.
          </p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={org.name}
            className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2 text-[13px] outline-none focus-visible:border-[hsl(var(--risk-critical))]"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setStatus("DELETED", confirmText)}
              disabled={busy || confirmText !== org.name}
              className="rounded-[var(--radius)] bg-[hsl(var(--risk-critical))] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Removing…" : "Confirm removal"}
            </button>
            <button
              onClick={() => {
                setShowRemoveConfirm(false);
                setConfirmText("");
              }}
              className="rounded-[var(--radius)] border border-[hsl(var(--border))] px-3 py-1.5 text-[12px] font-medium text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-[12px] text-[hsl(var(--risk-critical))]">{error}</p>}

      {!canManage && (
        <p className="text-[11.5px] text-[hsl(var(--text-tertiary))]">
          Suspending, removing, or restoring a tenant is reserved to the Super Admin.
        </p>
      )}

      <section className="grid grid-cols-3 gap-3">
        <StatBlock label="Readiness" value={`${org.readinessPct}%`} />
        <StatBlock label="Controls tracked" value={String(org.totalControls)} />
        <StatBlock label="Active incidents" value={String(org.activeIncidentCount)} warn={org.activeIncidentCount > 0} />
      </section>

      <section>
        <h2 className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
          Users ({org.users.length})
        </h2>
        <div className="overflow-hidden rounded-[var(--radius)] border border-[hsl(var(--border-subtle))]">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] text-left text-[11px] uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="w-[140px] px-3 py-2 font-medium">Role</th>
                <th className="w-[120px] px-3 py-2 font-medium">Last login</th>
              </tr>
            </thead>
            <tbody>
              {org.users.map((u) => (
                <tr key={u.id} className="border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))] last:border-b-0">
                  <td className="px-3 py-2.5 text-[hsl(var(--text-primary))]">{u.fullName}</td>
                  <td className="px-3 py-2.5 text-[hsl(var(--text-secondary))]">{u.email}</td>
                  <td className="px-3 py-2.5 text-[hsl(var(--text-secondary))]">{u.role.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2.5 text-[hsl(var(--text-tertiary))]">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatBlock({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-4">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">{label}</div>
      <div
        className="font-mono-tabular text-[22px] font-semibold"
        style={{ color: warn ? "hsl(var(--risk-critical))" : "hsl(var(--text-primary))" }}
      >
        {value}
      </div>
    </div>
  );
}
