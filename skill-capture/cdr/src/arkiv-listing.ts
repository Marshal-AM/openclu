/**
 * Upsert full Arkiv skillListing (purchase + ops) — same responsibility as legacy Supabase upsert.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Hex } from "viem";
import { API_URL, RPC_URL } from "./client.js";
import {
  LICENSE_READ_CONDITION,
  LICENSE_TOKEN,
  OWNER_WRITE_CONDITION,
} from "./constants.js";
import type { HeliaPeerHints } from "./helia-storage.js";
import { getHeliaPeerHints, getHeliaStorage } from "./helia-storage.js";
import { log } from "./logger.js";

export interface CdrManifestFile {
  skillName?: string;
  vaultUuid: number;
  ipId: string;
  licenseTermsId: string;
  cid: string;
  licenseToken?: string;
  readCondition?: string;
  writeCondition?: string;
  mintingFeeIp?: string;
  publishedAt?: string;
  bundlePath?: string;
  network?: string;
  encryptedSizeBytes?: number;
  heliaPeerId?: string;
  heliaMultiaddrs?: string[];
  arkivListingKey?: string;
  arkivStatus?: string;
  arkivVersion?: number;
}

export function loadSkillManifest(skillName: string, bundleDir?: string): {
  manifest: CdrManifestFile;
  bundleDir: string;
  manifestPath: string;
} {
  const dir = bundleDir ?? resolve(process.cwd(), "..", "skills", skillName);
  const manifestPath = resolve(dir, "cdr-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as CdrManifestFile;
  manifest.skillName = skillName;
  return { manifest, bundleDir: dir, manifestPath };
}

export function peerHintsFromManifest(manifest: CdrManifestFile): HeliaPeerHints | null {
  if (!manifest.heliaPeerId?.trim()) return null;
  const addrs = manifest.heliaMultiaddrs ?? [];
  if (!addrs.length) return null;
  return {
    helia_peer_id: manifest.heliaPeerId,
    helia_multiaddrs: addrs,
  };
}

export function saveManifestPeerHints(
  manifestPath: string,
  manifest: CdrManifestFile,
  peerHints: HeliaPeerHints,
  encryptedSizeBytes?: number,
): void {
  manifest.heliaPeerId = peerHints.helia_peer_id;
  manifest.heliaMultiaddrs = peerHints.helia_multiaddrs;
  if (encryptedSizeBytes !== undefined) {
    manifest.encryptedSizeBytes = encryptedSizeBytes;
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
}

/** Build complete ops block (always all fields, like Supabase row). */
export function buildFullListingOps(
  peerHints: HeliaPeerHints,
  encryptedSizeBytes: number,
): {
  peerHints: HeliaPeerHints;
  encryptedSizeBytes: number;
  readConditionAddress: string;
  writeConditionAddress: string;
  licenseTokenAddress: string;
  storyApiUrl: string;
  rpcUrl: string;
} {
  return {
    peerHints,
    encryptedSizeBytes,
    readConditionAddress: LICENSE_READ_CONDITION,
    writeConditionAddress: OWNER_WRITE_CONDITION,
    licenseTokenAddress: LICENSE_TOKEN,
    storyApiUrl: API_URL,
    rpcUrl: RPC_URL,
  };
}

export interface UpsertArkivInput {
  skillName: string;
  bundleDir?: string;
  publisherAddress?: Hex;
  /** Start Helia to refresh peer hints (slow on Windows). Default false if manifest has hints. */
  refreshPeerHints?: boolean;
  encryptedSizeBytes?: number;
}

/**
 * Write full listing to Arkiv + persist peer hints on manifest (Supabase-parity upsert).
 */
export async function upsertArkivCatalogListing(input: UpsertArkivInput) {
  const { manifest, bundleDir, manifestPath } = loadSkillManifest(
    input.skillName,
    input.bundleDir,
  );

  let peerHints = peerHintsFromManifest(manifest);
  const needHelia = input.refreshPeerHints || !peerHints;

  if (needHelia) {
    log.info("Starting Helia to capture peer hints (first run or --refresh-peers)…");
    log.info("(Windows: often 30–90s — wait for 'Helia ready')");
    const { helia } = await getHeliaStorage();
    peerHints = getHeliaPeerHints(helia);
    saveManifestPeerHints(
      manifestPath,
      manifest,
      peerHints,
      input.encryptedSizeBytes ?? manifest.encryptedSizeBytes,
    );
    log.ok("Manifest updated with heliaPeerId + heliaMultiaddrs");
  } else {
    log.info("Using peer hints from manifest (fast Arkiv upsert, no Helia start)");
  }

  if (!peerHints) {
    throw new Error(
      `No peer hints for "${input.skillName}". Run publish or: npm run index-arkiv -- ${input.skillName} --refresh-peers`,
    );
  }

  const encryptedSizeBytes =
    input.encryptedSizeBytes ?? manifest.encryptedSizeBytes ?? 0;

  const { publishCatalogToArkiv } = await import(
    "../../arkiv/src/services/publish-catalog.js"
  );

  log.info("Upserting full Arkiv listing (purchase + ops)…");
  const result = await publishCatalogToArkiv({
    skillName: input.skillName,
    manifest,
    bundleDir,
    publisherAddress: input.publisherAddress,
    ops: buildFullListingOps(peerHints, encryptedSizeBytes),
  });

  log.ok(`Arkiv listing key: ${result.listingKey}`);
  return { result, manifest, manifestPath, peerHints };
}
