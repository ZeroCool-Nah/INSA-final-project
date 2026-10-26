"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldOff, Copy, Check, Plus, X, KeyRound } from "lucide-react";

interface Teammate {
  id: string;
  fullName: string;
  email: string;
  role: string;
  lastLoginAt: string | null;
  disabled: boolean;
}

interface SettingsClientProps {
  user: { id: string; fullName: string; email: string; role: string; mfaEnabled: boolean };
  organization: { id: string; name: string; sector: string; requireMfa: boolean };
  teammates: Teammate[];
}

const INVITABLE_ROLES = ["COMPLIANCE_OFFICER", "AUDITOR", "IT_MANAGER"] as const;

export function SettingsClient({ user, organization, teammates: initialTeammates }: SettingsClientProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(user.fullName);
  const [mfaEnabled, setMfaEnabled] = useState(user.mfaEnabled);
  const [requireMfa, setRequireMfa] = useState(organization.requireMfa);
  const [requireMfaSaving, setRequireMfaSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [teammates, setTeammates] = useState(initialTeammates);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);
  const [inviteForm, setInviteForm] = useState({ fullName: "", email: "", password: "", role: "COMPLIANCE_OFFICER" as (typeof INVITABLE_ROLES)[number] });
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const [enrolling, setEnrolling] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function saveProfile() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleRequireMfa(next: boolean) {
    setRequireMfaSaving(true);
    try {
      const res = await fetch("/api/organizations/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requireMfa: next }),
      });
      if (res.ok) {
        setRequireMfa(next);
        router.refresh();
      }
    } finally {
      setRequireMfaSaving(false);
    }
  }

  async function startEnrollment() {
    setMfaError(null);
    const res = await fetch("/api/auth/mfa/enroll", { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setMfaError(json.error?.message ?? "Could not start enrollment.");
      return;
    }
    setQrCodeDataUrl(json.data.qrCodeDataUrl);
    setSecret(json.data.secret);
    setEnrolling(true);
  }

  async function confirmEnrollment(e: React.FormEvent) {
    e.preventDefault();
    setMfaError(null);
    const res = await fetch("/api/auth/mfa/enroll/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totpCode }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMfaError(json.error?.message ?? "Invalid code.");
      return;
    }
    setMfaEnabled(true);
    setEnrolling(false);
    setQrCodeDataUrl(null);
    setSecret(null);
    setTotpCode("");
    router.refresh();
  }

  function cancelEnrollment() {
    setEnrolling(false);
    setQrCodeDataUrl(null);
    setSecret(null);
    setTotpCode("");
    setMfaError(null);
  }

  async function disableMfa() {
    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mfaEnabled: false }),
    });
    if (res.ok) {
      setMfaEnabled(false);
      router.refresh();
    }
  }

  function copySecret() {
    if (!secret) return;
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function inviteTeammate(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    setInviting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      const json = await res.json();
      if (!res.ok) {
        setInviteError(json.error?.message ?? "Could not add teammate.");
        return;
      }
      setTeammates((prev) => [
        ...prev,
        { id: json.data.id, fullName: json.data.fullName, email: json.data.email, role: json.data.role, lastLoginAt: null, disabled: false },
      ]);
      setCreatedCreds({ email: inviteForm.email, password: inviteForm.password });
      setShowInvite(false);
      setInviteForm({ fullName: "", email: "", password: "", role: "COMPLIANCE_OFFICER" });
    } finally {
      setInviting(false);
    }
  }

  async function toggleTeammateDisabled(id: string, disabled: boolean) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabled }),
    });
    if (res.ok) {
      setTeammates((prev) => prev.map((t) => (t.id === id ? { ...t, disabled } : t)));
    }
  }

  async function submitPasswordReset(id: string) {
    if (resetPassword.length < 8) return;
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetPassword }),
    });
    if (res.ok) {
      const teammate = teammates.find((t) => t.id === id);
      if (teammate) setCreatedCreds({ email: teammate.email, password: resetPassword });
      setResetTarget(null);
      setResetPassword("");
    }
  }

  return (
    <div className="mx-auto max-w-[640px] space-y-6">
      <section className="rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-5">
        <h2 className="mb-4 text-[12px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
          Organization
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="mb-1 text-[11px] text-[hsl(var(--text-tertiary))]">Name</div>
            <div className="text-[13px] text-[hsl(var(--text-primary))]">{organization.name}</div>
          </div>
          <div>
            <div className="mb-1 text-[11px] text-[hsl(var(--text-tertiary))]">Sector</div>
            <div className="text-[13px] text-[hsl(var(--text-primary))]">{organization.sector}</div>
          </div>
        </div>

        {user.role === "ORG_ADMIN" && (
          <div className="mt-4 flex items-center justify-between border-t border-[hsl(var(--border-subtle))] pt-4">
            <div>
              <div className="text-[12.5px] font-medium text-[hsl(var(--text-primary))]">Require MFA for everyone</div>
              <div className="text-[11px] text-[hsl(var(--text-tertiary))]">
                When on, every teammate is gated to MFA setup on their next sign-in before they can access anything.
              </div>
            </div>
            <button
              onClick={() => toggleRequireMfa(!requireMfa)}
              disabled={requireMfaSaving}
              className={`relative h-5 w-9 flex-none rounded-full transition-colors disabled:opacity-50 ${
                requireMfa ? "bg-[hsl(var(--accent))]" : "bg-[hsl(var(--surface-3))]"
              }`}
              aria-pressed={requireMfa}
              aria-label="Require MFA for everyone"
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  requireMfa ? "translate-x-[18px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        )}
      </section>

      <section className="rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-5">
        <h2 className="mb-4 text-[12px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
          Profile
        </h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] text-[hsl(var(--text-tertiary))]">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-[13px] outline-none focus-visible:border-[hsl(var(--accent))]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-[hsl(var(--text-tertiary))]">Email</label>
            <input
              value={user.email}
              disabled
              className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-[13px] text-[hsl(var(--text-tertiary))] outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-[hsl(var(--text-tertiary))]">Role</label>
            <div className="text-[13px] text-[hsl(var(--text-primary))]">{user.role.replace("_", " ")}</div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={saveProfile}
              disabled={saving}
              className="rounded-[var(--radius)] bg-[hsl(var(--accent))] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            {saved && <span className="text-[11.5px] text-[hsl(var(--status-compliant))]">Saved</span>}
          </div>
        </div>
      </section>

      {createdCreds && (
        <div className="rounded-[var(--radius)] border border-[hsl(var(--status-compliant)/0.4)] bg-[hsl(var(--status-compliant)/0.08)] px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12.5px] text-[hsl(var(--text-primary))]">
              Share these credentials with your teammate — they should change the password on first login:
            </p>
            <button onClick={() => setCreatedCreds(null)} className="text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))]">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1.5 font-mono-tabular text-[12px] text-[hsl(var(--text-secondary))]">
            {createdCreds.email} / {createdCreds.password}
          </p>
        </div>
      )}

      {user.role === "ORG_ADMIN" && (
        <section className="rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[12px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
              Team ({teammates.length + 1})
            </h2>
            <button
              onClick={() => setShowInvite((v) => !v)}
              className="flex items-center gap-1.5 rounded-[var(--radius)] bg-[hsl(var(--accent))] px-2.5 py-1 text-[11.5px] font-medium text-white hover:opacity-90"
            >
              {showInvite ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              {showInvite ? "Cancel" : "Add teammate"}
            </button>
          </div>

          {showInvite && (
            <form onSubmit={inviteTeammate} className="mb-4 space-y-3 rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] text-[hsl(var(--text-tertiary))]">Full name</label>
                  <input
                    required
                    value={inviteForm.fullName}
                    onChange={(e) => setInviteForm((f) => ({ ...f, fullName: e.target.value }))}
                    className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-2.5 py-1.5 text-[12.5px] outline-none focus-visible:border-[hsl(var(--accent))]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[hsl(var(--text-tertiary))]">Email</label>
                  <input
                    required
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-2.5 py-1.5 text-[12.5px] outline-none focus-visible:border-[hsl(var(--accent))]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[hsl(var(--text-tertiary))]">Role</label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value as (typeof INVITABLE_ROLES)[number] }))}
                    className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-2.5 py-1.5 text-[12.5px] outline-none focus-visible:border-[hsl(var(--accent))]"
                  >
                    {INVITABLE_ROLES.map((r) => (
                      <option key={r} value={r}>{r.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[hsl(var(--text-tertiary))]">Temporary password</label>
                  <input
                    required
                    minLength={8}
                    value={inviteForm.password}
                    onChange={(e) => setInviteForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="8+ characters"
                    className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-2.5 py-1.5 text-[12.5px] outline-none focus-visible:border-[hsl(var(--accent))]"
                  />
                </div>
              </div>
              {inviteError && <p className="text-[12px] text-[hsl(var(--risk-critical))]">{inviteError}</p>}
              <button
                type="submit"
                disabled={inviting}
                className="rounded-[var(--radius)] bg-[hsl(var(--accent))] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {inviting ? "Adding…" : "Add teammate"}
              </button>
            </form>
          )}

          <div className="overflow-hidden rounded-[var(--radius)] border border-[hsl(var(--border-subtle))]">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-2))] text-left text-[10.5px] uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="w-[100px] px-3 py-2 font-medium">Last login</th>
                  <th className="w-[140px] px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))]">
                  <td className="px-3 py-2 text-[hsl(var(--text-primary))]">{user.fullName} <span className="text-[10.5px] text-[hsl(var(--text-tertiary))]">(you)</span></td>
                  <td className="px-3 py-2 text-[hsl(var(--text-secondary))]">{user.role.replace("_", " ")}</td>
                  <td className="px-3 py-2 text-[hsl(var(--text-tertiary))]">—</td>
                  <td className="px-3 py-2" />
                </tr>
                {teammates.map((t) => (
                  <tr key={t.id} className="border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))] last:border-b-0">
                    <td className="px-3 py-2 text-[hsl(var(--text-primary))]">
                      {t.fullName}
                      {t.disabled && (
                        <span className="ml-2 rounded-full bg-[hsl(var(--risk-critical)/0.14)] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--risk-critical))]">Disabled</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[hsl(var(--text-secondary))]">{t.role.replace("_", " ")}</td>
                    <td className="px-3 py-2 text-[hsl(var(--text-tertiary))]">
                      {t.lastLoginAt ? new Date(t.lastLoginAt).toLocaleDateString() : "Never"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setResetTarget(resetTarget === t.id ? null : t.id)}
                          className="flex items-center gap-1 text-[11px] font-medium text-[hsl(var(--accent))] hover:underline"
                        >
                          <KeyRound className="h-3 w-3" /> Reset
                        </button>
                        <button
                          onClick={() => toggleTeammateDisabled(t.id, !t.disabled)}
                          className="text-[11px] font-medium text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]"
                        >
                          {t.disabled ? "Enable" : "Disable"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {resetTarget && (
            <div className="mt-3 flex items-end gap-2 rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-3">
              <div className="flex-1">
                <label className="mb-1 block text-[11px] text-[hsl(var(--text-tertiary))]">
                  New temporary password for {teammates.find((t) => t.id === resetTarget)?.fullName}
                </label>
                <input
                  minLength={8}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="8+ characters"
                  className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-2.5 py-1.5 text-[12.5px] outline-none focus-visible:border-[hsl(var(--accent))]"
                />
              </div>
              <button
                onClick={() => submitPasswordReset(resetTarget)}
                disabled={resetPassword.length < 8}
                className="rounded-[var(--radius)] bg-[hsl(var(--accent))] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Set password
              </button>
            </div>
          )}
        </section>
      )}

      <section className="rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-5">
        <h2 className="mb-4 text-[12px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
          Multi-factor authentication
        </h2>

        {!enrolling ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {mfaEnabled ? (
                <ShieldCheck className="h-4 w-4 text-[hsl(var(--status-compliant))]" />
              ) : (
                <ShieldOff className="h-4 w-4 text-[hsl(var(--text-tertiary))]" />
              )}
              <span className="text-[13px] text-[hsl(var(--text-primary))]">
                {mfaEnabled ? "MFA is enabled on this account" : "MFA is not enabled"}
              </span>
            </div>
            <button
              onClick={mfaEnabled ? disableMfa : startEnrollment}
              className="rounded-[var(--radius)] border border-[hsl(var(--border))] px-3 py-1.5 text-[12px] font-medium text-[hsl(var(--text-secondary))] hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--text-primary))]"
            >
              {mfaEnabled ? "Disable MFA" : "Enable MFA"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-4">
              {qrCodeDataUrl && (
                <img
                  src={qrCodeDataUrl}
                  alt="TOTP enrollment QR code"
                  className="h-[140px] w-[140px] flex-none rounded-[var(--radius)] border border-[hsl(var(--border))] bg-white p-2"
                />
              )}
              <div className="flex-1 space-y-2 text-[12px] text-[hsl(var(--text-secondary))]">
                <p>Scan this with Google Authenticator, 1Password, or any TOTP app.</p>
                <p>Can't scan? Enter this key manually:</p>
                <button
                  onClick={copySecret}
                  className="flex w-full items-center justify-between rounded-[4px] bg-[hsl(var(--surface-2))] px-2 py-1.5 text-left"
                >
                  <span className="truncate font-mono-tabular text-[10.5px] text-[hsl(var(--text-primary))]">
                    {secret}
                  </span>
                  {copied ? (
                    <Check className="h-3 w-3 flex-none text-[hsl(var(--status-compliant))]" />
                  ) : (
                    <Copy className="h-3 w-3 flex-none text-[hsl(var(--text-tertiary))]" />
                  )}
                </button>
              </div>
            </div>

            <form onSubmit={confirmEnrollment} className="flex items-end gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-[11px] text-[hsl(var(--text-tertiary))]">
                  Enter the 6-digit code to confirm
                </label>
                <input
                  required
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-center font-mono-tabular text-[15px] tracking-[0.3em] outline-none focus-visible:border-[hsl(var(--accent))]"
                  placeholder="000000"
                />
              </div>
              <button
                type="submit"
                className="rounded-[var(--radius)] bg-[hsl(var(--accent))] px-3 py-2 text-[12px] font-medium text-white hover:opacity-90"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={cancelEnrollment}
                className="rounded-[var(--radius)] border border-[hsl(var(--border))] px-3 py-2 text-[12px] font-medium text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]"
              >
                Cancel
              </button>
            </form>

            {mfaError && <p className="text-[12px] text-[hsl(var(--risk-critical))]">{mfaError}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
