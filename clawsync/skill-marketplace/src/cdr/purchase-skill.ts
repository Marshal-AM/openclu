import "dotenv/config";

/**
 * Purchase (mint license + decrypt) a CDR skill asset with verbose logging.
 *
 * Usage: npm run purchase -- <skill-name>
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { StoryClient } from "@story-protocol/core-sdk";
import { encodeAbiParameters, http, parseEther } from "viem";
import { createClients, ensureWasm, RPC_URL } from "./client.js";
import { downloadFileWithLogs } from "./decrypt-with-logs.js";
import { ROYALTY_MODULE } from "./constants.js";
import { getHeliaStorage } from "./helia-storage.js";
import { log, timed } from "./logger.js";
import { fetchSkillListingFromCatalog } from "../../../skill-capture/db/src/src/lib/cdr-listing.js";
import { unzipToDir } from "./zip-bundle.js";

interface CdrManifest {
  skillName: string;
  vaultUuid: number;
  ipId: `0x${string}`;
  licenseTermsId: string;
  cid?: string;
  mintingFeeIp?: string;
}

function loadManifest(skillName: string): { manifest: CdrManifest; path: string } {
  const candidates = [
    resolve(process.cwd(), "..", "skills", skillName, "cdr-manifest.json"),
    resolve(process.cwd(), "..", "skills", "registry", `${skillName}.json`),
  ];
  for (const p of candidates) {
    try {
      const manifest = JSON.parse(readFileSync(p, "utf-8")) as CdrManifest;
      return { manifest, path: p };
    } catch {
      /* try next */
    }
  }
  throw new Error(
    `No manifest for "${skillName}". Publish first: npm run publish -- ${skillName} ../skills/${skillName}`,
  );
}

async function main() {
  const skillName = process.argv[2];
  if (!skillName) {
    console.error("Usage: npm run purchase -- <skill-name>");
    process.exit(1);
  }

  const { manifest, path: manifestPath } = loadManifest(skillName);

  log.section(`CDR purchase: ${skillName}`);
  const listing = await timed("load Catalog catalog listing (peer hints + CID)", () =>
    fetchSkillListingFromCatalog(skillName),
  );
  log.info(`Manifest: ${manifestPath}`);
  log.info(`Vault UUID: ${manifest.vaultUuid} (listing: ${listing.vault_uuid})`);
  if (manifest.vaultUuid !== listing.vault_uuid) {
    throw new Error(
      `Manifest vault ${manifest.vaultUuid} != Catalog vault ${listing.vault_uuid}. Re-publish.`,
    );
  }
  log.info(`IP ID: ${manifest.ipId}`);
  log.info(`License terms id: ${manifest.licenseTermsId}`);
  log.info(`Listing CID: ${listing.cid}`);
  log.info(`Publisher peer: ${listing.helia_peer_id ?? "?"}`);
  log.info(`Publisher multiaddrs: ${listing.helia_multiaddrs.length}`);
  log.info(`RPC: ${RPC_URL}`);

  await timed("init CDR WASM crypto", () => ensureWasm());

  const buyerKey = process.env.BUYER_PRIVATE_KEY ? "BUYER_PRIVATE_KEY" : "WALLET_PRIVATE_KEY";
  const { account, client, publicClient } = createClients(buyerKey);
  log.info(`Buyer wallet: ${account.address}`);

  const feeIp = manifest.mintingFeeIp ?? process.env.LICENSE_MINT_FEE_IP ?? "1";
  const storyClient = StoryClient.newClient({
    transport: http(RPC_URL),
    account,
    chainId: "aeneid",
  });

  const skipMint = ["1", "true", "yes"].includes(
    (process.env.SKIP_LICENSE_MINT ?? "").toLowerCase(),
  );
  let licenseTokenId: bigint;

  if (skipMint && process.env.LICENSE_TOKEN_ID) {
    licenseTokenId = BigInt(process.env.LICENSE_TOKEN_ID);
    log.warn(`SKIP_LICENSE_MINT=1 — reusing license token id ${licenseTokenId}`);
  } else {
    log.section("Story license payment (3 on-chain txs)");

    await timed(`wrap ${feeIp} IP → WIP`, () =>
      storyClient.wipClient.deposit({ amount: parseEther(feeIp) }),
    );

    await timed("approve RoyaltyModule to spend WIP", () =>
      storyClient.wipClient.approve({
        spender: ROYALTY_MODULE,
        amount: parseEther(feeIp),
      }),
    );

    const mintResult = await timed("mint license token", () =>
      storyClient.license.mintLicenseTokens({
        licensorIpId: manifest.ipId,
        licenseTermsId: BigInt(manifest.licenseTermsId),
        amount: 1,
      }),
    );
    licenseTokenId = mintResult.licenseTokenIds![0];
    log.ok(`License token id: ${licenseTokenId}`);
  }

  const accessAuxData = encodeAbiParameters(
    [{ type: "uint256[]" }],
    [[licenseTokenId]],
  );

  const { helia, storage } = await timed("start persistent Helia IPFS node", () =>
    getHeliaStorage(),
  );

  const { content, cid, txHash } = await downloadFileWithLogs({
    client,
    publicClient,
    uuid: manifest.vaultUuid,
    accessAuxData,
    storageProvider: storage,
    helia,
    listing,
  });

  log.info(`Final read tx: ${txHash}`);
  log.info(`Decrypted from CID: ${cid}`);

  const outDir = resolve(process.cwd(), "..", "skills", "purchased", skillName);
  mkdirSync(outDir, { recursive: true });

  await timed("unzip skill bundle to disk", async () => {
    unzipToDir(Buffer.from(content), outDir);
  });

  const receiptPath = resolve(outDir, "purchase-receipt.json");
  writeFileSync(
    receiptPath,
    JSON.stringify(
      {
        skillName,
        licenseTokenId: licenseTokenId.toString(),
        vaultUuid: manifest.vaultUuid,
        ipId: manifest.ipId,
        readTxHash: txHash,
        cid,
        purchasedAt: new Date().toISOString(),
        buyer: account.address,
      },
      null,
      2,
    ),
    "utf-8",
  );

  log.section("Purchase complete");
  log.ok(`Decrypted skill → ${outDir}`);
  log.ok(`Receipt → ${receiptPath}`);

  try {
    const skillPreview = readFileSync(resolve(outDir, "SKILL.md"), "utf-8");
    const lines = skillPreview.split("\n").slice(0, 8);
    console.log("\nSKILL.md preview:\n");
    for (const line of lines) console.log(`  ${line}`);
  } catch {
    log.warn("SKILL.md not found in extracted bundle");
  }
}

main().catch((err) => {
  log.err(err instanceof Error ? err.message : String(err));
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
