/**
 * Upsert full catalog listing (purchase + ops) in Supabase.
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
import {
  EMPTY_PEER_HINTS,
  hasPublicIpfsDelivery,
} from "../../db/src/peer-hints.js";
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
  catalogListingId?: string;
  catalogStatus?: string;
  catalogVersion?: number;
  ipfsGatewayUrl?: string;
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

export function buildFullListingOps(
  peerHints: HeliaPeerHints,
  encryptedSizeBytes: number,
  ipfsGatewayUrl?: string,
) {
  return {
    peerHints,
    encryptedSizeBytes,
    readConditionAddress: LICENSE_READ_CONDITION,
    writeConditionAddress: OWNER_WRITE_CONDITION,
    licenseTokenAddress: LICENSE_TOKEN,
    storyApiUrl: API_URL,
    rpcUrl: RPC_URL,
    ...(ipfsGatewayUrl ? { ipfsGatewayUrl } : {}),
  };
}

export interface UpsertCatalogInput {
  skillName: string;
  bundleDir?: string;
  publisherAddress?: Hex;
  refreshPeerHints?: boolean;
  encryptedSizeBytes?: number;
  ipfsGatewayUrl?: string;
}

export async function upsertCatalogListing(input: UpsertCatalogInput) {
  const { manifest, bundleDir, manifestPath } = loadSkillManifest(
    input.skillName,
    input.bundleDir,
  );

  const gatewayUrl = input.ipfsGatewayUrl ?? manifest.ipfsGatewayUrl;
  let peerHints = peerHintsFromManifest(manifest);
  const needHelia =
    !hasPublicIpfsDelivery({ ipfsGatewayUrl: gatewayUrl }) &&
    (input.refreshPeerHints || !peerHints);

  if (needHelia) {
    log.info("Starting Helia to capture peer hints (first run or --refresh-peers)…");
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
    log.info("Using peer hints from manifest (fast catalog upsert, no Helia start)");
  }

  if (!peerHints) {
    if (gatewayUrl) {
      peerHints = EMPTY_PEER_HINTS;
      log.info("Public IPFS gateway set — skipping Helia peer hints");
    } else {
      throw new Error(
        `No peer hints for "${input.skillName}". Run distribute with Pinata keys or: npm run index-catalog -- ${input.skillName} --refresh-peers`,
      );
    }
  }

  const encryptedSizeBytes =
    input.encryptedSizeBytes ?? manifest.encryptedSizeBytes ?? 0;

  const { publishCatalogToDb } = await import(
    "../../db/src/catalog/publish-catalog.js"
  );

  log.info("Upserting full catalog listing (purchase + ops)…");
  const result = await publishCatalogToDb({
    skillName: input.skillName,
    manifest,
    bundleDir,
    publisherAddress: input.publisherAddress,
    ops: buildFullListingOps(peerHints, encryptedSizeBytes, gatewayUrl),
  });

  log.ok(`Catalog listing id: ${result.listingId}`);
  return { result, manifest, manifestPath, peerHints };
}
