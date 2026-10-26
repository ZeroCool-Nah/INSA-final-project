"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Copy, Check, LogOut } from "lucide-react";

export default function MfaRequiredPage() {
  const router = useRouter();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/mfa/enroll", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setQrCodeDataUrl(json.data.qrCodeDataUrl);
        setSecret(json.data.secret);
      } else {
        setError(json.error?.message ?? "Could not start MFA enrollment.");
      }
      setLoading(false);
    })();
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/auth/mfa/enroll/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totpCode }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error?.message ?? "Invalid code.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  function copySecret() {
    if (!secret) return;
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--surface-0))] px-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center justify-center gap-2">
          <Image src="/brand/icon-192.png" alt="Kelela Solutions" width={56} height={56} className="rounded-[10px]" priority />
          <span className="text-[15px] font-semibold tracking-tight">Kelela Solutions</span>
        </div>

        <div className="rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-6">
          <h1 className="mb-1 text-[14px] font-medium text-[hsl(var(--text-primary))]">
            Set up multi-factor authentication
          </h1>
          <p className="mb-4 text-[12px] text-[hsl(var(--text-tertiary))]">
            Your organization requires MFA on every account. Finish setup to continue.
          </p>

          {loading ? (
            <p className="text-[12.5px] text-[hsl(var(--text-tertiary))]">Loading…</p>
          ) : (
            <div className="space-y-4">
              {qrCodeDataUrl && (
                <div className="flex gap-4">
                  <img
                    src={qrCodeDataUrl}
                    alt="TOTP enrollment QR code"
                    className="h-[130px] w-[130px] flex-none rounded-[var(--radius)] border border-[hsl(var(--border))] bg-white p-2"
                  />
                  <div className="flex-1 space-y-2 text-[12px] text-[hsl(var(--text-secondary))]">
                    <p>Scan with Google Authenticator, 1Password, or any TOTP app.</p>
                    <p>Can't scan? Enter this key manually:</p>
                    <button
                      onClick={copySecret}
                      className="flex w-full items-center justify-between rounded-[4px] bg-[hsl(var(--surface-2))] px-2 py-1.5 text-left"
                    >
                      <span className="truncate font-mono-tabular text-[10.5px] text-[hsl(var(--text-primary))]">{secret}</span>
                      {copied ? (
                        <Check className="h-3 w-3 flex-none text-[hsl(var(--status-compliant))]" />
                      ) : (
                        <Copy className="h-3 w-3 flex-none text-[hsl(var(--text-tertiary))]" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleVerify} className="space-y-2">
                <label className="block text-[11px] text-[hsl(var(--text-tertiary))]">Enter the 6-digit code to confirm</label>
                <input
                  required
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="w-full rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-center font-mono-tabular text-[16px] tracking-[0.3em] outline-none focus-visible:border-[hsl(var(--accent))]"
                  placeholder="000000"
                />
                {error && <p className="text-[12px] text-[hsl(var(--risk-critical))]">{error}</p>}
                <button
                  type="submit"
                  className="w-full rounded-[var(--radius)] bg-[hsl(var(--accent))] py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                >
                  Confirm and continue
                </button>
              </form>
            </div>
          )}

          <button
            onClick={handleSignOut}
            className="mt-4 flex w-full items-center justify-center gap-1.5 text-[11.5px] text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))]"
          >
            <LogOut className="h-3 w-3" /> Sign out instead
          </button>
        </div>
      </div>
    </div>
  );
}
