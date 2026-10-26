"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Login failed.");
        return;
      }
      if (json.mfaRequired) {
        setChallengeToken(json.challengeToken);
      } else {
        router.push(["SUPER_ADMIN", "PLATFORM_ADMIN"].includes(json.data?.role) ? "/platform" : "/");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeToken, totpCode }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Invalid code.");
        return;
      }
      router.push(["SUPER_ADMIN", "PLATFORM_ADMIN"].includes(json.data?.role) ? "/platform" : "/");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--surface-0))] px-4">
      <div className="w-full max-w-[360px]">
        <div className="mb-8 flex flex-col items-center justify-center gap-2">
          <Image src="/brand/icon-192.png" alt="Kelela Solutions" width={56} height={56} className="rounded-[10px]" priority />
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[15px] font-semibold tracking-tight">Kelela Solutions</span>
            <span className="text-[11px] text-[hsl(var(--text-tertiary))]">Cybersecurity Compliance Platform</span>
          </div>
        </div>

        <div className="rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-6">
          {!challengeToken ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-[13px] outline-none focus-visible:border-[hsl(var(--accent))]"
                  placeholder="you@organization.et"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-[13px] outline-none focus-visible:border-[hsl(var(--accent))]"
                  placeholder="••••••••"
                />
              </div>
              {error && <p className="text-[12px] text-[hsl(var(--risk-critical))]">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-[var(--radius)] bg-[hsl(var(--accent))] py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Signing in…" : "Continue"}
              </button>
              <Link href="/forgot-password" className="block text-center text-[11.5px] text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))]">
                Forgot password?
              </Link>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">
                  6-digit authenticator code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-center font-mono-tabular text-[16px] tracking-[0.3em] outline-none focus-visible:border-[hsl(var(--accent))]"
                  placeholder="000000"
                />
              </div>
              {error && <p className="text-[12px] text-[hsl(var(--risk-critical))]">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-[var(--radius)] bg-[hsl(var(--accent))] py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Verifying…" : "Verify"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
