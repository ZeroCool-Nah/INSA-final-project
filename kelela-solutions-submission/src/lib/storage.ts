import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";

/**
 * Local-filesystem evidence storage for development/self-hosted use.
 *
 * Swap this module for an S3/GCS client in production — the interface
 * (put/get by key) is deliberately the same shape either way, so nothing
 * in the API routes needs to change beyond the import. Do NOT use local
 * disk storage in a multi-instance deployment; it won't be shared across
 * app servers.
 */

const STORAGE_ROOT = process.env.EVIDENCE_STORAGE_DIR || path.join(process.cwd(), ".evidence-storage");

export async function putEvidence(key: string, bytes: Buffer): Promise<void> {
  const filePath = path.join(STORAGE_ROOT, key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
}

export async function getEvidence(key: string): Promise<Buffer> {
  const filePath = path.join(STORAGE_ROOT, key);
  return readFile(filePath);
}
