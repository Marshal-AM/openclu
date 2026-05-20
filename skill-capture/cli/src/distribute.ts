/**
 * Local distribute — Story + Helia + Arkiv in-process with device wallet from skill-capture/.env.
 */
import "../../cdr/src/polyfill.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { SKILL_CAPTURE_ROOT } from "../../arkiv/src/lib/device-wallet.js";
import {
  encryptBundleToVault,
  getServerPeerHints,
  readBundleZip,
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
import { loadDeviceAccount } from "../../arkiv/src/lib/device-wallet.js";
import { buildOpsFromManifest } from "../../arkiv/src/lib/listing-ops.js";
import { publishCatalogToArkiv } from "../../arkiv/src/services/publish-catalog.js";
import type { PublishCatalogResult } from "../../arkiv/src/lib/types.js";
import {
  printArkivPublish,
  printCdrEncrypt,
  printDistributeSummary,
  printStoryPublish,
} from "./distribute-log.js";

config({ path: resolve(SKILL_CAPTURE_ROOT, ".env") });
config({ path: resolve(SKILL_CAPTURE_ROOT, "cdr/.env"), override: false });

export async function distributeSkill(opts: { skillName: string; bundleDir: string }) {
  const { skillName, bundleDir } = opts;
  const account = loadDeviceAccount();
  const deviceKey = process.env.DEVICE_WALLET_PRIVATE_KEY!.trim();
  const skillMd = readFileSync(resolve(bundleDir, "SKILL.md"), "utf-8");

  console.log(`\n=== CLI: local publish (${skillName}) ===`);
  console.log(`  [cli] Device wallet: ${account.address}\n`);

  console.log("  [cli] Story IP registration (local)…");
  const story = await registerSkillIp(skillName, account.address, account);
  printStoryPublish(skillName, story);

  console.log("\n  [cli] Zipping bundle (local)…");
  const zipBytes = readBundleZip(bundleDir);
  console.log(`  [cli] Bundle zip: ${zipBytes.length} bytes`);

  console.log("\n  [cli] Booting local Helia (first run may take ~30–90s)…");
  const { storage } = await getHeliaStorage();
  const peerHints = await getServerPeerHints();

  console.log("\n  [cli] CDR encrypt (local WASM) → local Helia…");
  const { vaultUuid, cid } = await encryptBundleToVault({
    zipBytes,
    ipId: story.ipId,
    owner: account.address,
    storageProvider: storage,
    signerPrivateKey: deviceKey,
  });

  printCdrEncrypt({
    vaultUuid,
    cid,
    zipBytes: zipBytes.length,
    ipId: story.ipId,
    publisherAddress: account.address,
    peerHints,
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
  };

  const manifestPath = writeLocalManifest(bundleDir, skillName, manifest);

  console.log("\n  [cli] Arkiv catalog (in-process, device owner)…");
  const ops = buildOpsFromManifest({
    ...manifest,
    storyApiUrl: API_URL,
    rpcUrl: RPC_URL,
  });

  const arkiv: PublishCatalogResult = await publishCatalogToArkiv({
    skillName,
    manifest,
    bundleDir,
    publisherAddress: account.address,
    ops,
  });
  printArkivPublish(arkiv);

  printDistributeSummary({
    skillName,
    manifestPath,
    story,
    vaultUuid,
    cid,
    arkiv,
  });
}
