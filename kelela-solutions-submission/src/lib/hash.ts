import { createHash } from "crypto";

/**
 * Computes a SHA-256 hash of file bytes. Called server-side before any
 * evidence upload is persisted to object storage, and again on every
 * download to detect tampering (see docs/API_SPEC.md → evidence endpoints).
 */
export function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function sha256FromArrayBuffer(data: ArrayBuffer): Promise<string> {
  return sha256(Buffer.from(data));
}
