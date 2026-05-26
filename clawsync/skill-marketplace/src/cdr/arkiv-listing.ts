/**
 * Upsert full Arkiv skillListing (purchase + ops) — same responsibility as legacy Supabase upsert.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
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
} from "../arkiv/lib/peer-hints.js";
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
  ipfsGatewayUrl?: string;
}

type RequiredCdrManifest = CdrManifestFile & {
  skillName: string;
  publishedAt: string;
};

function requireManifestFields(manifest: CdrManifestFile, skillName: string): RequiredCdrManifest {
  if (!manifest.publishedAt?.trim()) {
    throw new Error(
      `cdr-manifest.json missing publishedAt for "${skillName}". Re-run publish/distribute to regenerate manifest.`,
    );
  }
  return {
    ...manifest,
    skillName,
    publishedAt: manifest.publishedAt,
  };
}

async function loadPublishCatalogToArkiv() {
  const modulePath = resolve(
    process.cwd(),
    "..",
    "..",
    "skill-capture",
    "arkiv",
    "src",
    "services",
    "publish-catalog.js",
  );
  const mod = (await import(pathToFileURL(modulePath).href)) as {
    publishCatalogToArkiv: (input: unknown) => Promise<{ listingKey: string }>;
  };
  return mod.publishCatalogToArkiv;
}

async function loadPublishTrainingCatalogToArkiv() {
  const modulePath = resolve(
    process.cwd(),
    "..",
    "..",
    "skill-capture",
    "arkiv",
    "src",
    "services",
    "publish-training-catalog.js",
  );
  const mod = (await import(pathToFileURL(modulePath).href)) as {
    publishTrainingCatalogToArkiv: (input: unknown) => Promise<{ listingKey: string }>;
  };
  return mod.publishTrainingCatalogToArkiv;
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
  ipfsGatewayUrl?: string,
): {
  peerHints: HeliaPeerHints;
  encryptedSizeBytes: number;
  readConditionAddress: string;
  writeConditionAddress: string;
  licenseTokenAddress: string;
  storyApiUrl: string;
  rpcUrl: string;
  ipfsGatewayUrl?: string;
} {
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

export interface UpsertArkivInput {
  skillName: string;
  bundleDir?: string;
  publisherAddress?: Hex;
  /** Start Helia to refresh peer hints (slow on Windows). Default false if manifest has hints. */
  refreshPeerHints?: boolean;
  encryptedSizeBytes?: number;
  ipfsGatewayUrl?: string;
}

/**
 * Write full listing to Arkiv + persist peer hints on manifest (Supabase-parity upsert).
 */
export async function upsertArkivCatalogListing(input: UpsertArkivInput) {
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
    if (gatewayUrl) {
      peerHints = EMPTY_PEER_HINTS;
      log.info("Public IPFS gateway set — skipping Helia peer hints");
    } else {
      throw new Error(
        `No peer hints for "${input.skillName}". Publish with Pinata API keys or: npm run index-arkiv -- ${input.skillName} --refresh-peers`,
      );
    }
  }

  const encryptedSizeBytes =
    input.encryptedSizeBytes ?? manifest.encryptedSizeBytes ?? 0;

  const publishCatalogToArkiv = await loadPublishCatalogToArkiv();
  const publishManifest = requireManifestFields(manifest, input.skillName);

  log.info("Upserting full Arkiv listing (purchase + ops)…");
  const result = await publishCatalogToArkiv({
    skillName: input.skillName,
    manifest: publishManifest,
    bundleDir,
    publisherAddress: input.publisherAddress,
    ops: buildFullListingOps(
      peerHints,
      encryptedSizeBytes,
      gatewayUrl,
    ),
  });

  log.ok(`Arkiv listing key: ${result.listingKey}`);
  return { result, manifest, manifestPath, peerHints };
}

/** Write full Arkiv trainingDataListing (purchase + ops). */
export async function upsertArkivTrainingCatalogListing(input: UpsertArkivInput) {
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
    if (gatewayUrl) {
      peerHints = EMPTY_PEER_HINTS;
      log.info("Public IPFS gateway set — skipping Helia peer hints");
    } else {
      throw new Error(
        `No peer hints for "${input.skillName}". Publish with Pinata API keys or re-run distribute-training with Pinata configured.`,
      );
    }
  }

  const encryptedSizeBytes =
    input.encryptedSizeBytes ?? manifest.encryptedSizeBytes ?? 0;

  const publishTrainingCatalogToArkiv = await loadPublishTrainingCatalogToArkiv();
  const publishManifest = requireManifestFields(manifest, input.skillName);

  log.info("Upserting full Arkiv training listing (purchase + ops)…");
  const result = await publishTrainingCatalogToArkiv({
    skillName: input.skillName,
    manifest: publishManifest,
    bundleDir,
    publisherAddress: input.publisherAddress,
    ops: buildFullListingOps(peerHints, encryptedSizeBytes, gatewayUrl),
  });

  log.ok(`Arkiv training listing key: ${result.listingKey}`);
  return { result, manifest, manifestPath, peerHints };
}
