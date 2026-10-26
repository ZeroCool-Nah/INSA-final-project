"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (!token) {
      setError("This reset link is missing its token. Request a new one from the forgot-password page.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Could not reset password.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--surface-0))] px-4">
      <div className="w-full max-w-[360px]">
        <div className="mb-8 flex flex-col items-center justify-center gap-2">
          <Image src="/brand/icon-192.png" alt="Kelela Solutions" width={56} height={56} className="rounded-[10px]" priority />
          <span className="text-[15px] font-semibold tracking-tight">Kelela Solutions</span>
        </div>

        <div className="rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-6">
          {done ? (
            <p className="text-center text-[13px] text-[hsl(var(--status-compliant))]">
              Password updated. Redirecting to sign in…
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <p className="text-[12.5px] text-[hsl(var(--text-secondary))]">Choose a new password.</p>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
                  New password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-[13px] outline-none focus-visible:border-[hsl(var(--accent))]"
                  placeholder="8+ characters"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
                  Confirm new password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-[13px] outline-none focus-visible:border-[hsl(var(--accent))]"
                />
              </div>
              {error && <p className="text-[12px] text-[hsl(var(--risk-critical))]">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-[var(--radius)] bg-[hsl(var(--accent))] py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
