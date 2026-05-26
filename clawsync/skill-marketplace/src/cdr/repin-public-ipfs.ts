/**
 * Pin existing skill or training-data ciphertext to public IPFS and refresh Arkiv ops.ipfsGatewayUrl.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  fetchSkillPurchaseContext,
  fetchTrainingPurchaseContext,
} from "../arkiv/lib/cdr-listing.js";
import { ArkivError } from "../arkiv/lib/errors.js";
import {
  gatewayUrlForCid,
  pinataConfigured,
  uploadCiphertextToPinata,
} from "./pinata-ipfs.js";
import { downloadViaGatewayForBackfill } from "./backfill-download.js";
import { tryDownloadFromLocalHeliaStores } from "./backfill-helia-local.js";
import { tryDownloadFromLocalHeliaProviders } from "./backfill-helia-provider.js";
import {
  upsertArkivCatalogListing,
  upsertArkivTrainingCatalogListing,
  loadSkillManifest,
} from "./arkiv-listing.js";
import { log } from "./logger.js";

type ListingKind = "skill" | "training";

async function fetchPurchaseContext(skillName: string): Promise<{
  cid: string;
  kind: ListingKind;
}> {
  try {
    const ctx = await fetchSkillPurchaseContext(skillName);
    return { cid: ctx.listing.cid, kind: "skill" };
  } catch (e) {
    if (e instanceof ArkivError && e.code === "NOT_FOUND") {
      const ctx = await fetchTrainingPurchaseContext(skillName);
      return { cid: ctx.listing.cid, kind: "training" };
    }
    throw e;
  }
}

function bundleDirCandidates(
  skillName: string,
  kind: ListingKind,
  bundleDir?: string,
): string[] {
  const trainingRoots = [
    resolve(process.cwd(), "..", "skill-capture", "training-data", skillName),
    resolve(process.cwd(), "training-data", skillName),
  ];
  const skillRoots = [
    resolve(process.cwd(), "..", "skill-capture", "skills", skillName),
    resolve(process.cwd(), "skills", skillName),
  ];
  const roots = kind === "training" ? trainingRoots : skillRoots;
  return [bundleDir, ...roots].filter(Boolean) as string[];
}

function findBundleDir(
  skillName: string,
  kind: ListingKind,
  bundleDir?: string,
): string | undefined {
  for (const d of bundleDirCandidates(skillName, kind, bundleDir)) {
    try {
      loadSkillManifest(skillName, d);
      return d;
    } catch {
      /* try next */
    }
  }
  return bundleDir;
}

export async function repinSkillToPublicIpfs(opts: {
  skillName: string;
  bundleDir?: string;
}): Promise<{ cid: string; ipfsGatewayUrl: string; bytes: number; listingKind: ListingKind }> {
  const { skillName, bundleDir } = opts;
  if (!pinataConfigured()) {
    throw new Error(
      "Pinata not configured — set PINATA_API_KEY + PINATA_SECRET_KEY in clawsync/.env",
    );
  }

  const { cid, kind } = await fetchPurchaseContext(skillName);
  log.info(`Arkiv listing type: ${kind === "training" ? "trainingDataListing" : "skillListing"}`);

  let bytes: Uint8Array | null = await tryDownloadFromLocalHeliaStores(cid);
  if (bytes?.length) {
    log.ok(`Local Helia blockstore: ${bytes.length} bytes`);
  }

  if (!bytes?.length) {
    bytes = await tryDownloadFromLocalHeliaProviders(cid);
  }

  if (!bytes?.length) {
    try {
      bytes = await downloadViaGatewayForBackfill(cid);
      log.ok(`Gateway fetch: ${bytes.length} bytes`);
    } catch (e) {
      log.warn(`Gateway: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (!bytes?.length) {
    throw new Error(
      `Cannot load ciphertext for ${cid}. Run publish on a machine with the bundle (skill-capture/cli/.helia-data), or ensure gateways can reach the CID.`,
    );
  }

  const pin = await uploadCiphertextToPinata(bytes, skillName);
  if (pin.cid !== cid) {
    throw new Error(
      `Pinata returned CID ${pin.cid}, but Arkiv vault CID is ${cid}. Refusing repin to avoid broken listing.`,
    );
  }

  const ipfsGatewayUrl = pin.gatewayBase;
  log.info(`Verify: ${gatewayUrlForCid(ipfsGatewayUrl, cid)}`);

  const upsertBundle = findBundleDir(skillName, kind, bundleDir);
  if (upsertBundle) {
    try {
      const { manifestPath, manifest } = loadSkillManifest(skillName, upsertBundle);
      manifest.ipfsGatewayUrl = ipfsGatewayUrl;
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
      log.ok(`Updated manifest: ${manifestPath}`);
    } catch {
      log.warn("No local cdr-manifest.json — Arkiv upsert only");
    }
  }

  if (kind === "training") {
    await upsertArkivTrainingCatalogListing({
      skillName,
      bundleDir: upsertBundle,
      ipfsGatewayUrl,
    });
  } else {
    await upsertArkivCatalogListing({
      skillName,
      bundleDir: upsertBundle,
      ipfsGatewayUrl,
    });
  }

  return { cid, ipfsGatewayUrl, bytes: bytes.length, listingKind: kind };
}
