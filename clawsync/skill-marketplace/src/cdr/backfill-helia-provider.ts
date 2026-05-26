import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  getHeliaStorage,
  hasLocalPin,
  stopHeliaInstance,
} from "./helia-storage.js";
import { log } from "./logger.js";

const LOCAL_DOWNLOAD_MS = Number(process.env.LOCAL_BLOCKSTORE_TRY_MS ?? "8000");

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Helia data dirs that may hold publisher ciphertext (CLI publish uses skill-capture/cli). */
export function localHeliaDataDirCandidates(): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (p: string) => {
    const dir = resolve(p);
    const blocks = resolve(dir, "blocks");
    if (!existsSync(blocks)) return;
    if (seen.has(dir)) return;
    seen.add(dir);
    out.push(dir);
  };

  if (process.env.HELIA_DATA_DIR?.trim()) {
    add(process.env.HELIA_DATA_DIR.trim());
  }
  if (process.env.CLAWSYNC_ROOT?.trim()) {
    add(resolve(process.env.CLAWSYNC_ROOT.trim(), "data", ".helia-data"));
  }

  const relative = [
    resolve(process.cwd(), "data", ".helia-data"),
    resolve(process.cwd(), "..", "skill-capture", "cli", ".helia-data"),
    resolve(process.cwd(), "..", "..", "skill-capture", "cli", ".helia-data"),
    resolve(process.cwd(), "..", "skill-capture", "cdr", ".helia-data"),
    resolve(process.cwd(), "..", "..", "skill-capture", "cdr", ".helia-data"),
  ];
  for (const p of relative) add(p);

  return out;
}

/**
 * Download via HeliaProvider (CDR vault CIDs are not always raw FS blocks).
 * Tries each local .helia-data store; boots libp2p once per store (~30–90s on Windows).
 */
export async function tryDownloadFromLocalHeliaProviders(
  cid: string,
): Promise<Uint8Array | null> {
  const dirs = localHeliaDataDirCandidates();
  if (!dirs.length) return null;

  const prevHeliaDir = process.env.HELIA_DATA_DIR;
  for (const dataDir of dirs) {
    process.env.HELIA_DATA_DIR = dataDir;
    try {
      await stopHeliaInstance();
      log.info(`Trying local Helia at ${dataDir}…`);
      const { helia, storage } = await getHeliaStorage();
      const pinned = await hasLocalPin(helia, cid);
      if (!pinned) {
        log.info(`  CID not in pin set — trying blockstore download anyway…`);
      }
      const bytes = await Promise.race([
        storage.download(cid),
        sleep(LOCAL_DOWNLOAD_MS).then(() => {
          throw new Error("local Helia download timeout");
        }),
      ]);
      if (bytes?.length) {
        log.ok(`Helia download: ${bytes.length} bytes from ${dataDir}`);
        return bytes;
      }
    } catch (e) {
      log.warn(
        `  ${dataDir}: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      await stopHeliaInstance();
    }
  }

  if (prevHeliaDir === undefined) delete process.env.HELIA_DATA_DIR;
  else process.env.HELIA_DATA_DIR = prevHeliaDir;

  return null;
}
