/**
 * Local distribute for training data bundles — Story + Helia + Supabase catalog.
 */
import "../../cdr/src/polyfill.js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadDbEnv } from "../../db/src/env.js";
import { SKILL_CAPTURE_ROOT } from "../../db/src/device-wallet.js";
import {
  encryptBundleToVault,
  getServerPeerHints,
  readTrainingBundleZip,
  pinCiphertextToPublicIpfs,
  registerSkillIp,
  writeLocalManifest,
  type PublishManifest,
} from "../../cdr/src/services/publish-service.js";
import {
  LICENSE_READ_CONDITION,
  LICENSE_TOKEN,
  OWNER_WRITE_CONDITION,
} from "../../cdr/src/constants.js";
import { API_URL, RPC_URL } from "../../cdr/src/client.js";
import { getHeliaStorage } from "../../cdr/src/helia-storage.js";
import { createPinataBackedStorage } from "../../cdr/src/storage/pinata-aligned-storage.js";
import { loadDeviceAccount } from "../../db/src/device-wallet.js";
import { buildOpsFromManifest } from "../../db/src/listing-ops.js";
import { publishTrainingCatalog } from "../../db/src/catalog/publish-training-catalog.js";
import type { PublishCatalogResult } from "../../db/src/types.js";
import {
  printCatalogPublish,
  printCdrEncrypt,
  printDistributeSummary,
  printStoryPublish,
} from "./distribute-log.js";

loadDbEnv();

function assertTrainingVideoBundle(bundleDir: string): void {
  const metaPath = resolve(bundleDir, "video.meta.json");
  if (!existsSync(metaPath)) return;
  const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as {
    durationSec?: number;
    wallClockSec?: number;
    frameCount?: number;
    captureSource?: string;
  };
  const wall = meta.wallClockSec ?? 0;
  const dur = meta.durationSec ?? 0;
  if (wall <= 5 || dur <= 0) return;
  const ratio = dur / wall;
  const minDur = Number(process.env.TRAINING_MIN_PUBLISH_DURATION_SEC ?? "50");
  if (
    (meta.captureSource === "media" || meta.captureSource === "dev_media") &&
    dur < minDur
  ) {
    throw new Error(
      `Training video is only ${dur}s (need >= ${minDur}s). ` +
        "Wait for dev transcode to finish or re-run capture before distribute.",
    );
  }
  if (ratio >= 0.5) return;
  throw new Error(
    `Training video in ${bundleDir} is only ${dur}s for ${wall}s recorded (${(ratio * 100).toFixed(0)}%). ` +
      "Re-run capture with a working camera (see TRAINING_CAMERA_INDEX). " +
      "Set TRAINING_ALLOW_SHORT_VIDEO=1 only to force-publish a short clip.",
  );
}

export async function distributeTraining(opts: { skillName: string; bundleDir: string }) {
  const { skillName, bundleDir } = opts;
  const account = loadDeviceAccount();
  const deviceKey = process.env.DEVICE_WALLET_PRIVATE_KEY!.trim();
  readFileSync(resolve(bundleDir, "TRAINING.md"), "utf-8");
  assertTrainingVideoBundle(bundleDir);

  console.log(`\n=== CLI: training data publish (${skillName}) ===`);
  console.log(`  [cli] Device wallet: ${account.address}\n`);

  console.log("  [cli] Story IP registration (local)…");
  const story = await registerSkillIp(skillName, account.address, account);
  printStoryPublish(skillName, story);

  console.log("\n  [cli] Zipping training bundle (local)…");
  const zipBytes = readTrainingBundleZip(bundleDir);
  console.log(`  [cli] Bundle zip: ${zipBytes.length} bytes`);

  console.log("\n  [cli] Booting local Helia (first run may take ~30–90s)…");
  const { helia } = await getHeliaStorage();
  const storage = createPinataBackedStorage(helia, skillName);
  const peerHints = await getServerPeerHints();

  console.log("\n  [cli] CDR encrypt (local WASM) → Pinata-backed public CID…");
  const { vaultUuid, cid } = await encryptBundleToVault({
    zipBytes,
    ipId: story.ipId,
    owner: account.address,
    storageProvider: storage,
    signerPrivateKey: deviceKey,
  });

  console.log("\n  [cli] Pinning ciphertext on public IPFS (Pinata)…");
  const { ipfsGatewayUrl } = await pinCiphertextToPublicIpfs(cid, storage, skillName);

  printCdrEncrypt({
    vaultUuid,
    cid,
    zipBytes: zipBytes.length,
    ipId: story.ipId,
    publisherAddress: account.address,
    peerHints,
    ipfsGatewayUrl,
  });

  const manifest: PublishManifest = {
    skillName,
    vaultUuid,
    ipId: story.ipId,
    licenseTermsId: story.licenseTermsId,
    cid,
    licenseToken: LICENSE_TOKEN,
    readCondition: LICENSE_READ_CONDITION,
    writeCondition: OWNER_WRITE_CONDITION,
    mintingFeeIp: story.mintingFeeIp,
    publishedAt: new Date().toISOString(),
    bundlePath: bundleDir,
    network: "aeneid",
    encryptedSizeBytes: zipBytes.length,
    heliaPeerId: peerHints.helia_peer_id,
    heliaMultiaddrs: peerHints.helia_multiaddrs,
    ipfsGatewayUrl,
  };

  const manifestPath = writeLocalManifest(bundleDir, skillName, manifest);

  console.log("\n  [cli] Training catalog (in-process, device owner)…");
  const ops = buildOpsFromManifest({
    ...manifest,
    storyApiUrl: API_URL,
    rpcUrl: RPC_URL,
    ipfsGatewayUrl,
  });

  const catalog: PublishCatalogResult = await publishTrainingCatalog({
    skillName,
    manifest,
    bundleDir,
    publisherAddress: account.address,
    ops,
  });
  printCatalogPublish(catalog);

  printDistributeSummary({
    skillName,
    manifestPath,
    story,
    vaultUuid,
    cid,
    catalog,
    ipfsGatewayUrl,
  });
}
