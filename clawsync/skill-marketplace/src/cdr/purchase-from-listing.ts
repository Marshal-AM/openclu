import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { StoryClient } from "@story-protocol/core-sdk";
import { encodeAbiParameters, http, parseEther } from "viem";
import {
  fetchSkillPurchaseContext,
  purchaseContextFromCatalogSnapshot,
  type SkillCdrListing,
} from "../../../../skill-capture/db/src/catalog/cdr-listing.js";
import { createClientsFromPrivateKey, ensureWasm, getApiUrl, getRpcUrl } from "./client.js";
import { downloadFileWithLogs } from "./decrypt-with-logs.js";
import { ROYALTY_MODULE } from "./constants.js";
import { resolveHeliaDataDir } from "./repo-paths.js";
import { log, timed } from "./logger.js";
import { unzipToDir } from "./zip-bundle.js";

export interface PurchaseSkillResult {
  skillName: string;
  title: string;
  description: string;
  buyerAddress: string;
  licenseTokenId: string;
  mintingFeeIp: string;
  localPath: string;
  readTxHash: string;
  cid: string;
}

export interface PurchaseSkillOptions {
  skillName: string;
  privateKey: string;
  outputDir: string;
  /** Full Catalog catalog row from UI (payload + entityKey) — portable, no sibling repos. */
  catalogSnapshot?: {
    entityKey: string;
    payload: unknown;
  };
}

function manifestFromContext(
  skillName: string,
  listing: SkillCdrListing,
  mintingFeeIp: string,
) {
  return {
    skillName,
    vaultUuid: listing.vault_uuid,
    ipId: listing.ip_id as `0x${string}`,
    licenseTermsId: listing.license_terms_id,
    mintingFeeIp,
  };
}

/**
 * Purchase using Catalog catalog data only (purchase + ops blocks in JSON).
 * Works on any machine with network — no skill-capture folder required.
 */
export async function purchaseSkillFromListing(
  opts: PurchaseSkillOptions,
): Promise<PurchaseSkillResult> {
  const { skillName, privateKey, outputDir, catalogSnapshot } = opts;

  log.section(`Purchase pipeline: ${skillName}`);
  log.info(`Helia cache: ${resolveHeliaDataDir()}`);

  const ctx = catalogSnapshot
    ? purchaseContextFromCatalogSnapshot(
        catalogSnapshot.entityKey,
        catalogSnapshot.payload,
      )
    : await timed("load Catalog catalog (purchase + peer hints)", () =>
        fetchSkillPurchaseContext(skillName),
      );

  const { listing, title, description, mintingFeeIp } = ctx;
  log.info(
    `Catalog source: ${catalogSnapshot ? "UI snapshot" : "catalog"} · peer ${listing.helia_peer_id} · ${listing.helia_multiaddrs.length} addrs`,
  );

  const manifest = manifestFromContext(skillName, listing, mintingFeeIp);
  log.info(`Vault UUID: ${manifest.vaultUuid}`);
  log.info(`IP ID: ${manifest.ipId}`);
  log.info(`License terms id: ${manifest.licenseTermsId}`);
  log.info(`Listing CID: ${listing.cid}`);

  if (listing.story_api_url) process.env.API_URL = listing.story_api_url;
  if (listing.rpc_url) process.env.RPC_URL = listing.rpc_url;
  log.info(`Story API: ${listing.story_api_url ?? getApiUrl()}`);
  log.info(`RPC: ${listing.rpc_url ?? getRpcUrl()}`);

  await timed("init CDR WASM crypto", () => ensureWasm());

  const { account, client, publicClient } = createClientsFromPrivateKey(privateKey);
  log.info(`Buyer wallet: ${account.address}`);

  const storyClient = StoryClient.newClient({
    transport: http(getRpcUrl()),
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

    await timed(`wrap ${mintingFeeIp} IP → WIP`, () =>
      storyClient.wipClient.deposit({ amount: parseEther(mintingFeeIp) }),
    );

    await timed("approve RoyaltyModule to spend WIP", () =>
      storyClient.wipClient.approve({
        spender: ROYALTY_MODULE,
        amount: parseEther(mintingFeeIp),
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

  const accessAuxData = encodeAbiParameters([{ type: "uint256[]" }], [[licenseTokenId]]);

  const { content, cid, txHash } = await downloadFileWithLogs({
    client,
    publicClient,
    uuid: manifest.vaultUuid,
    accessAuxData,
    listing,
  });

  const outDir = resolve(outputDir, skillName);
  mkdirSync(outDir, { recursive: true });

  await timed("unzip skill bundle to disk", async () => {
    unzipToDir(Buffer.from(content), outDir);
  });

  writeFileSync(
    resolve(outDir, "purchase-receipt.json"),
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

  return {
    skillName,
    title,
    description,
    buyerAddress: account.address,
    licenseTokenId: licenseTokenId.toString(),
    mintingFeeIp,
    localPath: outDir,
    readTxHash: txHash,
    cid,
  };
}
