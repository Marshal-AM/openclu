import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "./logger.js";

/** skill-capture repo root (cdr/src → ../..) — avoid cross-package rootDir imports */
const SKILL_CAPTURE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const REGISTRY_HTTP_TIMEOUT_MS = Number(process.env.REGISTRY_HTTP_TIMEOUT_MS ?? "20000");

/** Filesystem cache: skill-capture/data/marketplace-blobs/{cid} */
export function resolveMarketplaceBlobsDir(): string {
  const explicit = process.env.MARKETPLACE_BLOBS_DIR?.trim();
  if (explicit) return resolve(explicit);
  return resolve(SKILL_CAPTURE_ROOT, "data", "marketplace-blobs");
}

function blobPath(cid: string): string {
  const safe = cid.replace(/[^a-zA-Z0-9]/g, "_");
  return resolve(resolveMarketplaceBlobsDir(), safe);
}

export function readLocalRegistryBlob(cid: string): Uint8Array | null {
  const path = blobPath(cid);
  if (!existsSync(path)) return null;
  return new Uint8Array(readFileSync(path));
}

export function writeLocalRegistryBlob(cid: string, bytes: Uint8Array): void {
  const dir = resolveMarketplaceBlobsDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(blobPath(cid), bytes);
  log.info(`Cached ciphertext in marketplace registry (${bytes.length} bytes)`);
}

/** Public base URL written to catalog ops — buyers fetch ciphertext here. */
export function defaultContentRegistryBaseUrl(): string {
  const url = process.env.SKILL_CONTENT_REGISTRY_URL?.trim();
  if (url) return url.replace(/\/$/, "");
  const port = process.env.CDR_SERVER_PORT ?? "8787";
  return `http://127.0.0.1:${port}/api/v1/registry`;
}

export function registryDownloadUrl(baseUrl: string, cid: string): string {
  return `${baseUrl.replace(/\/$/, "")}/${encodeURIComponent(cid)}`;
}

export async function fetchFromRegistry(
  baseUrl: string,
  cid: string,
): Promise<Uint8Array> {
  const url = registryDownloadUrl(baseUrl, cid);
  const res = await fetch(url, {
    signal: AbortSignal.timeout(REGISTRY_HTTP_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Registry ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export async function tryFetchRegistry(
  baseUrl: string | null | undefined,
  cid: string,
): Promise<Uint8Array | null> {
  if (!baseUrl?.trim()) return null;
  try {
    return await fetchFromRegistry(baseUrl.trim(), cid);
  } catch {
    return null;
  }
}

export async function downloadFromContentRegistry(
  cid: string,
  registryBases: Array<string | null | undefined>,
): Promise<Uint8Array | null> {
  const local = readLocalRegistryBlob(cid);
  if (local?.length) {
    log.ok(`Marketplace registry cache hit (${local.length} bytes)`);
    return local;
  }

  const seen = new Set<string>();
  for (const base of registryBases) {
    if (!base?.trim() || seen.has(base)) continue;
    seen.add(base);
    const bytes = await tryFetchRegistry(base, cid);
    if (bytes?.length) {
      writeLocalRegistryBlob(cid, bytes);
      log.ok(`Registry HTTP hit (${bytes.length} bytes) from ${base}`);
      return bytes;
    }
  }
  return null;
}

export async function uploadToRegistry(
  baseUrl: string,
  cid: string,
  bytes: Uint8Array,
): Promise<void> {
  const url = registryDownloadUrl(baseUrl, cid);
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: Buffer.from(bytes),
    signal: AbortSignal.timeout(REGISTRY_HTTP_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Registry upload ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

/**
 * Legacy local/HTTP registry cache (dev server routes). Prefer Pinata via pinata-ipfs.ts for buyers.
 * Returns registry base URL (deprecated; Supabase catalog uses ops.ipfsGatewayUrl).
 */
export async function registerMarketplaceBlob(
  cid: string,
  bytes: Uint8Array,
  opts?: { remoteBaseUrl?: string | null },
): Promise<string> {
  writeLocalRegistryBlob(cid, bytes);
  const remote =
    opts?.remoteBaseUrl?.trim() ||
    process.env.SKILL_CONTENT_REGISTRY_URL?.trim() ||
    null;
  if (remote) {
    try {
      await uploadToRegistry(remote, cid, bytes);
      log.ok(`Uploaded ciphertext to registry ${remote}`);
    } catch (e) {
      log.warn(
        `Registry upload failed (${e instanceof Error ? e.message : String(e)}) — local cache only; start cdr server or fix SKILL_CONTENT_REGISTRY_URL`,
      );
    }
  }
  return defaultContentRegistryBaseUrl();
}
