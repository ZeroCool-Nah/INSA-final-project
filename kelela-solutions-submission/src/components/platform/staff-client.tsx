"use client";

import { useState } from "react";
import { Plus, X, ShieldOff, ShieldCheck } from "lucide-react";

interface StaffRow {
  id: string;
  fullName: string;
  email: string;
  role: "SUPER_ADMIN" | "PLATFORM_ADMIN";
  lastLoginAt: string | null;
  mfaEnabled: boolean;
  disabled: boolean;
}

export function StaffClient({ initialStaff, currentUserId }: { initialStaff: StaffRow[]; currentUserId: string }) {
  const [staff, setStaff] = useState(initialStaff);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);

  const [form, setForm] = useState({ fullName: "", email: "", password: "" });

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/platform/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, role: "PLATFORM_ADMIN" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Could not add platform admin.");
        return;
      }
      setStaff((prev) => [
        ...prev,
        { id: json.data.id, fullName: json.data.fullName, email: json.data.email, role: "PLATFORM_ADMIN", lastLoginAt: null, mfaEnabled: false, disabled: false },
      ]);
      setCreatedCreds({ email: form.email, password: form.password });
      setShowForm(false);
      setForm({ fullName: "", email: "", password: "" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleDisabled(id: string, disabled: boolean) {
    const res = await fetch(`/api/platform/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabled }),
    });
    if (res.ok) {
      setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, disabled } : s)));
    }
  }

  return (
    <div className="mx-auto max-w-[800px]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[12px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
          {staff.length} platform staff member{staff.length === 1 ? "" : "s"}
        </h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-[var(--radius)] bg-[hsl(var(--accent))] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? "Cancel" : "Add Platform Admin"}
        </button>
      </div>

      {createdCreds && !showForm && (
        <div className="mb-4 rounded-[var(--radius)] border border-[hsl(var(--status-compliant)/0.4)] bg-[hsl(var(--status-compliant)/0.08)] px-4 py-3">
          <p className="text-[12.5px] text-[hsl(var(--text-primary))]">
            Platform Admin added. Share these credentials — they should change the password on first login:
          </p>
          <p className="mt-1.5 font-mono-tabular text-[12px] text-[hsl(var(--text-secondary))]">
            {createdCreds.email} / {createdCreds.password}
          </p>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleInvite}
          className="mb-4 space-y-3 rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-4"
        >
          <p className="text-[11.5px] text-[hsl(var(--text-tertiary))]">
            New staff are always added as Platform Admin — they can onboard and manage tenant organizations, but can't
            suspend a tenant or manage other platform staff. Only a Super Admin holds those two permissions.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-[11px] text-[hsl(var(--text-tertiary))]">Full name</label>
              <input
                required
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-[13px] outline-none focus-visible:border-[hsl(var(--accent))]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-[hsl(var(--text-tertiary))]">Email</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-[13px] outline-none focus-visible:border-[hsl(var(--accent))]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-[hsl(var(--text-tertiary))]">Temporary password</label>
              <input
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-[13px] outline-none focus-visible:border-[hsl(var(--accent))]"
                placeholder="8+ characters"
              />
            </div>
          </div>
          {error && <p className="text-[12px] text-[hsl(var(--risk-critical))]">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-[var(--radius)] bg-[hsl(var(--accent))] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add Platform Admin"}
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-[var(--radius)] border border-[hsl(var(--border-subtle))]">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] text-left text-[11px] uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="w-[120px] px-3 py-2 font-medium">Role</th>
              <th className="w-[90px] px-3 py-2 font-medium">MFA</th>
              <th className="w-[110px] px-3 py-2 font-medium">Last login</th>
              <th className="w-[90px] px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))] last:border-b-0">
                <td className="px-3 py-2.5 text-[hsl(var(--text-primary))]">
                  {s.fullName}
                  {s.disabled && (
                    <span className="ml-2 rounded-full bg-[hsl(var(--risk-critical)/0.14)] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--risk-critical))]">
                      Disabled
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-[hsl(var(--text-secondary))]">{s.email}</td>
                <td className="px-3 py-2.5 text-[hsl(var(--text-secondary))]">
                  {s.role === "SUPER_ADMIN" ? "Super Admin" : "Platform Admin"}
                </td>
                <td className="px-3 py-2.5">
                  {s.mfaEnabled ? (
                    <ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--status-compliant))]" />
                  ) : (
                    <ShieldOff className="h-3.5 w-3.5 text-[hsl(var(--text-tertiary))]" />
                  )}
                </td>
                <td className="px-3 py-2.5 text-[hsl(var(--text-tertiary))]">
                  {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleDateString() : "Never"}
                </td>
                <td className="px-3 py-2.5">
                  {s.role !== "SUPER_ADMIN" && s.id !== currentUserId && (
                    <button
                      onClick={() => toggleDisabled(s.id, !s.disabled)}
                      className="text-[11.5px] font-medium text-[hsl(var(--accent))] hover:underline"
                    >
                      {s.disabled ? "Re-enable" : "Disable"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
