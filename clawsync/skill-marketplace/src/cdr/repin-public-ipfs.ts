/**
 * Pin existing skill ciphertext to public IPFS and refresh Arkiv ops.ipfsGatewayUrl.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchSkillPurchaseContext } from "../arkiv/lib/cdr-listing.js";
import {
  gatewayUrlForCid,
  pinataConfigured,
  uploadCiphertextToPinata,
} from "./pinata-ipfs.js";
import { downloadViaGatewayForBackfill } from "./backfill-download.js";
import { tryDownloadFromLocalHeliaStores } from "./backfill-helia-local.js";
import { upsertArkivCatalogListing, loadSkillManifest } from "./arkiv-listing.js";
import { log } from "./logger.js";

export async function repinSkillToPublicIpfs(opts: {
  skillName: string;
  bundleDir?: string;
}): Promise<{ cid: string; ipfsGatewayUrl: string; bytes: number }> {
  const { skillName, bundleDir } = opts;
  if (!pinataConfigured()) {
    throw new Error(
      "Pinata not configured — set PINATA_API_KEY + PINATA_SECRET_KEY in clawsync/.env",
    );
  }

  const ctx = await fetchSkillPurchaseContext(skillName);
  const cid = ctx.listing.cid;

  let bytes: Uint8Array | null = await tryDownloadFromLocalHeliaStores(cid);
  if (bytes?.length) {
    log.ok(`Local Helia blockstore: ${bytes.length} bytes`);
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
      `Cannot load ciphertext for ${cid}. Run publish on a machine with the bundle, or ensure gateways can reach the CID.`,
    );
  }

  const pin = await uploadCiphertextToPinata(bytes, skillName);
  if (pin.cid !== cid) {
    log.warn(`Pinata CID ${pin.cid} != vault CID ${cid} — buyers use vault CID from Arkiv`);
  }

  const ipfsGatewayUrl = pin.gatewayBase;
  log.info(`Verify: ${gatewayUrlForCid(ipfsGatewayUrl, cid)}`);

  try {
    const { manifestPath, manifest } = loadSkillManifest(skillName, bundleDir);
    manifest.ipfsGatewayUrl = ipfsGatewayUrl;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
    log.ok(`Updated manifest: ${manifestPath}`);
  } catch {
    log.warn("No local cdr-manifest.json — Arkiv upsert only");
  }

  const dirs = [
    bundleDir,
    resolve(process.cwd(), "..", "skill-capture", "skills", skillName),
    resolve(process.cwd(), "skills", skillName),
  ].filter(Boolean) as string[];

  let upsertBundle = bundleDir;
  for (const d of dirs) {
    try {
      loadSkillManifest(skillName, d);
      upsertBundle = d;
      break;
    } catch {
      /* try next */
    }
  }

  await upsertArkivCatalogListing({
    skillName,
    bundleDir: upsertBundle,
    ipfsGatewayUrl,
  });

  return { cid, ipfsGatewayUrl, bytes: bytes.length };
}
