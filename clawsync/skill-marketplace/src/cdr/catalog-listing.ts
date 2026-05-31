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
} from "../../../../skill-capture/db/src/peer-hints.js";
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

function requireManifestFields(manifest: CdrManifestFile, skillName: string) {
  if (!manifest.publishedAt?.trim()) {
    throw new Error(
      `cdr-manifest.json missing publishedAt for "${skillName}". Re-run publish/distribute.`,
    );
  }
  return { ...manifest, skillName, publishedAt: manifest.publishedAt };
}

export function loadSkillManifest(skillName: string, bundleDir?: string) {
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

async function resolvePeerHints(input: UpsertCatalogInput, manifest: CdrManifestFile, manifestPath: string) {
  const gatewayUrl = input.ipfsGatewayUrl ?? manifest.ipfsGatewayUrl;
  let peerHints = peerHintsFromManifest(manifest);
  const needHelia =
    !hasPublicIpfsDelivery({ ipfsGatewayUrl: gatewayUrl }) &&
    (input.refreshPeerHints || !peerHints);

  if (needHelia) {
    log.info("Starting Helia to capture peer hints…");
    const { helia } = await getHeliaStorage();
    peerHints = getHeliaPeerHints(helia);
    saveManifestPeerHints(
      manifestPath,
      manifest,
      peerHints,
      input.encryptedSizeBytes ?? manifest.encryptedSizeBytes,
    );
  }

  if (!peerHints) {
    if (gatewayUrl) peerHints = EMPTY_PEER_HINTS;
    else {
      throw new Error(
        `No peer hints for "${input.skillName}". Configure Pinata or npm run index-catalog.`,
      );
    }
  }
  return { peerHints, gatewayUrl };
}

export async function upsertCatalogListing(input: UpsertCatalogInput) {
  const { manifest, bundleDir, manifestPath } = loadSkillManifest(
    input.skillName,
    input.bundleDir,
  );
  const { peerHints, gatewayUrl } = await resolvePeerHints(input, manifest, manifestPath);
  const encryptedSizeBytes =
    input.encryptedSizeBytes ?? manifest.encryptedSizeBytes ?? 0;
  const { publishCatalogToDb } = await import(
    "../../../../skill-capture/db/src/catalog/publish-catalog.js"
  );
  const publishManifest = requireManifestFields(manifest, input.skillName);
  log.info("Upserting full catalog listing (purchase + ops)…");
  const result = await publishCatalogToDb({
    skillName: input.skillName,
    manifest: publishManifest,
    bundleDir,
    publisherAddress: input.publisherAddress,
    ops: buildFullListingOps(peerHints, encryptedSizeBytes, gatewayUrl),
  });
  log.ok(`Catalog listing id: ${result.listingId}`);
  return { result, manifest, manifestPath, peerHints };
}

export async function upsertTrainingCatalogListing(input: UpsertCatalogInput) {
  const { manifest, bundleDir, manifestPath } = loadSkillManifest(
    input.skillName,
    input.bundleDir,
  );
  const { peerHints, gatewayUrl } = await resolvePeerHints(input, manifest, manifestPath);
  const encryptedSizeBytes =
    input.encryptedSizeBytes ?? manifest.encryptedSizeBytes ?? 0;
  const { publishTrainingCatalog } = await import(
    "../../../../skill-capture/db/src/catalog/publish-training-catalog.js"
  );
  const publishManifest = requireManifestFields(manifest, input.skillName);
  log.info("Upserting full training catalog listing…");
  const result = await publishTrainingCatalog({
    skillName: input.skillName,
    manifest: publishManifest,
    bundleDir,
    publisherAddress: input.publisherAddress,
    ops: buildFullListingOps(peerHints, encryptedSizeBytes, gatewayUrl),
  });
  log.ok(`Catalog training listing id: ${result.listingId}`);
  return { result, manifest, manifestPath, peerHints };
}
