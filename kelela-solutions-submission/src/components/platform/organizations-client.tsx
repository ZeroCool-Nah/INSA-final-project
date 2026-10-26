"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, X, ChevronRight } from "lucide-react";

interface OrgRow {
  id: string;
  name: string;
  sector: string;
  status: "ACTIVE" | "TRIAL" | "SUSPENDED" | "DELETED";
  planTier: string | null;
  userCount: number;
  activeIncidentCount: number;
  readinessPct: number;
  createdAt: string;
}

const SECTORS = ["FINANCIAL", "TELECOM", "ENERGY", "GOVERNMENT", "HEALTHCARE", "OTHER"];

export function OrganizationsClient({ initialOrgs }: { initialOrgs: OrgRow[] }) {
  const [orgs, setOrgs] = useState(initialOrgs);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);
  const [showingRemoved, setShowingRemoved] = useState(false);
  const [loadingRemoved, setLoadingRemoved] = useState(false);

  const [form, setForm] = useState({
    name: "",
    sector: "FINANCIAL",
    planTier: "Standard",
    primaryContactEmail: "",
    adminFullName: "",
    adminEmail: "",
    adminPassword: "",
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/platform/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Could not create organization.");
        return;
      }
      setOrgs((prev) => [
        {
          id: json.data.id,
          name: json.data.name,
          sector: json.data.sector,
          status: json.data.status,
          planTier: json.data.planTier,
          userCount: 1,
          activeIncidentCount: 0,
          readinessPct: 0,
          createdAt: json.data.createdAt,
        },
        ...prev,
      ]);
      setCreatedCreds({ email: form.adminEmail, password: form.adminPassword });
      setShowForm(false);
      setForm({ name: "", sector: "FINANCIAL", planTier: "Standard", primaryContactEmail: "", adminFullName: "", adminEmail: "", adminPassword: "" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleShowRemoved() {
    const next = !showingRemoved;
    setLoadingRemoved(true);
    try {
      const res = await fetch(`/api/platform/organizations?includeRemoved=${next}`);
      const json = await res.json();
      if (res.ok) {
        setOrgs(json.data);
        setShowingRemoved(next);
      }
    } finally {
      setLoadingRemoved(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[12px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
          {orgs.length} organization{orgs.length === 1 ? "" : "s"}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleShowRemoved}
            disabled={loadingRemoved}
            className="rounded-[var(--radius)] border border-[hsl(var(--border))] px-2.5 py-1.5 text-[11.5px] font-medium text-[hsl(var(--text-secondary))] hover:border-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))] disabled:opacity-50"
          >
            {showingRemoved ? "Hide removed" : "Show removed"}
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-[var(--radius)] bg-[hsl(var(--accent))] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
          >
            {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showForm ? "Cancel" : "Onboard organization"}
          </button>
        </div>
      </div>

      {createdCreds && !showForm && (
        <div className="mb-4 rounded-[var(--radius)] border border-[hsl(var(--status-compliant)/0.4)] bg-[hsl(var(--status-compliant)/0.08)] px-4 py-3">
          <p className="text-[12.5px] text-[hsl(var(--text-primary))]">
            Organization created. Share these credentials with the new tenant admin — they should change the password on first login:
          </p>
          <p className="mt-1.5 font-mono-tabular text-[12px] text-[hsl(var(--text-secondary))]">
            {createdCreds.email} / {createdCreds.password}
          </p>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-4 space-y-3 rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Organization name">
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-[13px] outline-none focus-visible:border-[hsl(var(--accent))]"
                placeholder="e.g. Abyssinia Digital Bank"
              />
            </Field>
            <Field label="Sector">
              <select
                value={form.sector}
                onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))}
                className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-[13px] outline-none focus-visible:border-[hsl(var(--accent))]"
              >
                {SECTORS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Plan tier">
              <input
                value={form.planTier}
                onChange={(e) => setForm((f) => ({ ...f, planTier: e.target.value }))}
                className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-[13px] outline-none focus-visible:border-[hsl(var(--accent))]"
              />
            </Field>
            <Field label="Primary contact email">
              <input
                type="email"
                value={form.primaryContactEmail}
                onChange={(e) => setForm((f) => ({ ...f, primaryContactEmail: e.target.value }))}
                className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-[13px] outline-none focus-visible:border-[hsl(var(--accent))]"
              />
            </Field>
          </div>

          <div className="border-t border-[hsl(var(--border-subtle))] pt-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
              First admin account for this tenant
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Full name">
                <input
                  required
                  value={form.adminFullName}
                  onChange={(e) => setForm((f) => ({ ...f, adminFullName: e.target.value }))}
                  className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-[13px] outline-none focus-visible:border-[hsl(var(--accent))]"
                />
              </Field>
              <Field label="Email">
                <input
                  required
                  type="email"
                  value={form.adminEmail}
                  onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
                  className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-[13px] outline-none focus-visible:border-[hsl(var(--accent))]"
                />
              </Field>
              <Field label="Temporary password">
                <input
                  required
                  minLength={8}
                  value={form.adminPassword}
                  onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))}
                  className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-[13px] outline-none focus-visible:border-[hsl(var(--accent))]"
                  placeholder="8+ characters"
                />
              </Field>
            </div>
          </div>

          {error && <p className="text-[12px] text-[hsl(var(--risk-critical))]">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-[var(--radius)] bg-[hsl(var(--accent))] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create organization"}
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-[var(--radius)] border border-[hsl(var(--border-subtle))]">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] text-left text-[11px] uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
              <th className="px-3 py-2 font-medium">Organization</th>
              <th className="w-[100px] px-3 py-2 font-medium">Sector</th>
              <th className="w-[90px] px-3 py-2 font-medium">Status</th>
              <th className="w-[70px] px-3 py-2 font-medium">Users</th>
              <th className="w-[90px] px-3 py-2 font-medium">Incidents</th>
              <th className="w-[100px] px-3 py-2 font-medium">Readiness</th>
              <th className="w-[32px] px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <tr
                key={org.id}
                className="border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))] last:border-b-0 hover:bg-[hsl(var(--surface-2))]"
              >
                <td className="px-3 py-2.5">
                  <Link href={`/platform/organizations/${org.id}`} className="font-medium text-[hsl(var(--text-primary))] hover:underline">
                    {org.name}
                  </Link>
                  {org.planTier && <span className="ml-2 text-[11px] text-[hsl(var(--text-tertiary))]">{org.planTier}</span>}
                </td>
                <td className="px-3 py-2.5 text-[hsl(var(--text-secondary))]">{org.sector}</td>
                <td className="px-3 py-2.5">
                  <StatusPill status={org.status} />
                </td>
                <td className="px-3 py-2.5 font-mono-tabular text-[hsl(var(--text-secondary))]">{org.userCount}</td>
                <td className="px-3 py-2.5 font-mono-tabular" style={{ color: org.activeIncidentCount > 0 ? "hsl(var(--risk-critical))" : undefined }}>
                  {org.activeIncidentCount}
                </td>
                <td className="px-3 py-2.5 font-mono-tabular text-[hsl(var(--text-secondary))]">{org.readinessPct}%</td>
                <td className="px-2 py-2.5">
                  <Link href={`/platform/organizations/${org.id}`}>
                    <ChevronRight className="h-3.5 w-3.5 text-[hsl(var(--text-tertiary))]" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] text-[hsl(var(--text-tertiary))]">{label}</label>
      {children}
    </div>
  );
}

function StatusPill({ status }: { status: "ACTIVE" | "TRIAL" | "SUSPENDED" | "DELETED" }) {
  const config = {
    ACTIVE: { label: "Active", color: "var(--status-compliant)" },
    TRIAL: { label: "Trial", color: "var(--risk-medium)" },
    SUSPENDED: { label: "Suspended", color: "var(--risk-critical)" },
    DELETED: { label: "Removed", color: "var(--text-tertiary)" },
  }[status];

  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: `hsl(${config.color} / 0.14)`, color: `hsl(${config.color})` }}
    >
      {config.label}
    </span>
  );
}
