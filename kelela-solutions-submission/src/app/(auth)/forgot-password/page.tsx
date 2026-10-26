"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Always show the same success state regardless of what the API
      // returned — the API itself never reveals whether the email exists.
      setSubmitted(true);
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
          {submitted ? (
            <div className="space-y-3 text-center">
              <p className="text-[13px] text-[hsl(var(--text-primary))]">
                If an account exists for that email, a reset link has been sent.
              </p>
              <p className="text-[11.5px] text-[hsl(var(--text-tertiary))]">
                In local development with no SMTP configured, check the terminal running <code>pnpm dev</code> — the link is logged there instead.
              </p>
              <Link href="/login" className="inline-block text-[12.5px] text-[hsl(var(--accent))] hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <p className="text-[12.5px] text-[hsl(var(--text-secondary))]">
                Enter your account email and we'll send a link to reset your password.
              </p>
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
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-[var(--radius)] bg-[hsl(var(--accent))] py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
              <Link href="/login" className="block text-center text-[12px] text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))]">
                Back to sign in
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
