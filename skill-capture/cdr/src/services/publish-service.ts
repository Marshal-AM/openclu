import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PILFlavor, StoryClient, WIP_TOKEN_ADDRESS } from "@story-protocol/core-sdk";
import { encodeAbiParameters, http, parseEther } from "viem";
import type { Account } from "viem";
import { createClients, createClientsFromPrivateKey, ensureWasm, API_URL, RPC_URL } from "../client.js";
import {
  LICENSE_READ_CONDITION,
  LICENSE_TOKEN,
  OWNER_WRITE_CONDITION,
  SPG_NFT_COLLECTION,
} from "../constants.js";
import {
  ipfsUrl,
  storyAddressUrl,
  storyIpaUrl,
  storyTxUrl,
} from "../lib/explorer-links.js";
import { log } from "../logger.js";
import {
  getHeliaPeerHints,
  getHeliaStorage,
  hasLocalPin,
  uploadJsonToIpfs,
} from "../helia-storage.js";
import {
  fetchPublicGateway,
  gatewayUrlForCid,
  pinVaultCidOnPinata,
  resolvePublicIpfsGateway,
  uploadCiphertextToPinata,
} from "../pinata-ipfs.js";
import { isPinataBackedCidCached } from "../storage/pinata-aligned-storage.js";
import { zipBundleDir, zipSkillBundle } from "../zip-bundle.js";

export interface PublishStartResult {
  ipId: `0x${string}`;
  licenseTermsId: string;
  publisherAddress: `0x${string}`;
  txHash?: string;
  ipMetadataCid: string;
  nftMetadataCid: string;
  ipMetadataURI: string;
  nftMetadataURI: string;
  ipMetadataHash: `0x${string}`;
  nftMetadataHash: `0x${string}`;
  mintingFeeIp: string;
  spgNftContract: string;
  licenseType: string;
  commercialRevShare: number;
  network: string;
  rpcUrl: string;
  storyApiUrl: string;
  urls: {
    ipa: string;
    tx?: string;
    publisher: string;
    spgCollection: string;
    ipMetadataIpfs: string;
    nftMetadataIpfs: string;
  };
}

export interface PublishManifest {
  skillName: string;
  vaultUuid: number;
  ipId: string;
  licenseTermsId: string;
  cid: string;
  licenseToken: string;
  readCondition: string;
  writeCondition: string;
  mintingFeeIp: string;
  publishedAt: string;
  bundlePath: string;
  network: string;
  encryptedSizeBytes?: number;
  heliaPeerId?: string;
  heliaMultiaddrs?: string[];
  /** Public IPFS gateway base for buyers (catalog ops.ipfsGatewayUrl), e.g. Pinata. */
  ipfsGatewayUrl?: string;
}

/** Story Protocol IP + license registration — runs locally with contributor account. */
export async function registerSkillIp(
  skillName: string,
  ownerAddress: `0x${string}`,
  signerAccount?: Account,
): Promise<PublishStartResult> {
  const account =
    signerAccount ??
    (process.env.DEVICE_WALLET_PRIVATE_KEY
      ? createClientsFromPrivateKey(process.env.DEVICE_WALLET_PRIVATE_KEY).account
      : createClients().account);
  const storyClient = StoryClient.newClient({
    transport: http(RPC_URL),
    account,
    chainId: "aeneid",
  });

  const recordedAt = new Date().toISOString();
  const ipMetadata = {
    title: `Skill: ${skillName}`,
    description: `Human-recorded agent skill captured via skill-capture (${recordedAt})`,
    creators: [
      { name: "skill-capture", address: ownerAddress, contributionPercent: 100 },
    ],
  };
  const nftMetadata = {
    name: `Skill NFT — ${skillName}`,
    description: `Ownership of recorded skill ${skillName}`,
  };

  log.info("Uploading IP + NFT metadata to Helia/IPFS…");
  const ipIpfsHash = await uploadJsonToIpfs(ipMetadata);
  const nftIpfsHash = await uploadJsonToIpfs(nftMetadata);
  log.ok(`IP metadata CID: ${ipIpfsHash}`);
  log.ok(`NFT metadata CID: ${nftIpfsHash}`);
  const ipHash = createHash("sha256").update(JSON.stringify(ipMetadata)).digest("hex");
  const nftHash = createHash("sha256").update(JSON.stringify(nftMetadata)).digest("hex");
  const mintingFee = parseEther(process.env.LICENSE_MINT_FEE_IP ?? "1");
  const mintingFeeIp = process.env.LICENSE_MINT_FEE_IP ?? "1";

  log.info("Registering IP asset on Story Aeneid (mint + commercial remix license)…");
  const response = await storyClient.ipAsset.registerIpAsset({
    nft: { type: "mint", spgNftContract: SPG_NFT_COLLECTION },
    licenseTermsData: [
      {
        terms: PILFlavor.commercialRemix({
          commercialRevShare: 5,
          defaultMintingFee: mintingFee,
          currency: WIP_TOKEN_ADDRESS,
        }),
      },
    ],
    ipMetadata: {
      ipMetadataURI: `https://ipfs.io/ipfs/${ipIpfsHash}`,
      ipMetadataHash: `0x${ipHash}`,
      nftMetadataURI: `https://ipfs.io/ipfs/${nftIpfsHash}`,
      nftMetadataHash: `0x${nftHash}`,
    },
  });

  const licenseTermsId = response.licenseTermsIds?.[0];
  if (!response.ipId || licenseTermsId === undefined) {
    throw new Error("IP registration did not return ipId / licenseTermsId");
  }

  const ipId = response.ipId as `0x${string}`;
  const ipMetadataURI = `https://ipfs.io/ipfs/${ipIpfsHash}`;
  const nftMetadataURI = `https://ipfs.io/ipfs/${nftIpfsHash}`;
  const result: PublishStartResult = {
    ipId,
    licenseTermsId: licenseTermsId.toString(),
    publisherAddress: ownerAddress,
    txHash: response.txHash,
    ipMetadataCid: ipIpfsHash,
    nftMetadataCid: nftIpfsHash,
    ipMetadataURI,
    nftMetadataURI,
    ipMetadataHash: `0x${ipHash}`,
    nftMetadataHash: `0x${nftHash}`,
    mintingFeeIp,
    spgNftContract: SPG_NFT_COLLECTION,
    licenseType: "commercialRemix",
    commercialRevShare: 5,
    network: "aeneid",
    rpcUrl: RPC_URL,
    storyApiUrl: API_URL,
    urls: {
      ipa: storyIpaUrl(ipId),
      tx: response.txHash ? storyTxUrl(response.txHash) : undefined,
      publisher: storyAddressUrl(ownerAddress),
      spgCollection: storyAddressUrl(SPG_NFT_COLLECTION),
      ipMetadataIpfs: ipfsUrl(ipIpfsHash),
      nftMetadataIpfs: ipfsUrl(nftIpfsHash),
    },
  };

  log.ok(`IP registered: ${ipId}`);
  log.ok(`License terms id: ${licenseTermsId}`);
  if (response.txHash) log.ok(`Story tx: ${response.txHash}`);
  log.info(`Story IPA explorer: ${result.urls.ipa}`);
  if (result.urls.tx) log.info(`Story tx explorer: ${result.urls.tx}`);

  return result;
}

export async function encryptBundleToVault(opts: {
  zipBytes: Buffer;
  ipId: `0x${string}`;
  owner: `0x${string}`;
  storageProvider: import("@piplabs/cdr-sdk").StorageProvider;
  signerPrivateKey?: string;
}): Promise<{ vaultUuid: number; cid: string }> {
  await ensureWasm();
  const { client } = opts.signerPrivateKey
    ? createClientsFromPrivateKey(opts.signerPrivateKey)
    : createClients();
  const globalPubKey = await client.observer.getGlobalPubKey();
  const writeConditionData = encodeAbiParameters([{ type: "address" }], [opts.owner]);
  const readConditionData = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }],
    [LICENSE_TOKEN, opts.ipId],
  );

  const { uuid, cid } = await client.uploader.uploadFile({
    content: new Uint8Array(opts.zipBytes),
    storageProvider: opts.storageProvider,
    globalPubKey,
    updatable: false,
    writeConditionAddr: OWNER_WRITE_CONDITION,
    readConditionAddr: LICENSE_READ_CONDITION,
    writeConditionData,
    readConditionData,
    accessAuxData: "0x",
  });

  return { vaultUuid: uuid, cid };
}

/**
 * Pin ciphertext on public IPFS (Pinata) so any buyer can fetch by catalog CID.
 */
export async function pinCiphertextToPublicIpfs(
  cid: string,
  storageProvider: import("@piplabs/cdr-sdk").StorageProvider,
  skillName: string,
  hostNodes?: string[],
): Promise<{ cid: string; ipfsGatewayUrl: string }> {
  const gatewayBase = resolvePublicIpfsGateway();

  if (isPinataBackedCidCached(cid)) {
    log.ok(
      `Pinata pin confirmed for ${cid} — ${gatewayUrlForCid(gatewayBase, cid)}`,
    );
    return { cid, ipfsGatewayUrl: gatewayBase };
  }

  log.info("Downloading ciphertext for public Pinata pin…");
  const ciphertext = await storageProvider.download(cid);

  if (process.env.PINATA_USE_PIN_BY_CID === "1" && hostNodes?.length) {
    log.info("Pinning vault CID on Pinata (pin-by-CID, paid plan)…");
    await pinVaultCidOnPinata({ cid, skillName, hostNodes });
  } else {
    log.info("Uploading to Pinata (pinFileToIPFS)…");
    const pin = await uploadCiphertextToPinata(ciphertext, skillName);
    if (pin.cid !== cid) {
      throw new Error(
        `Pinata CID ${pin.cid} != vault CID ${cid}. Use createPinataBackedStorage during encrypt.`,
      );
    }
  }

  await assertCidReachableOnGateway({ cid, gatewayBase });

  return { cid, ipfsGatewayUrl: gatewayBase };
}

async function assertCidReachableOnGateway(opts: {
  cid: string;
  gatewayBase: string;
}): Promise<void> {
  const gatewayUrl = gatewayUrlForCid(opts.gatewayBase, opts.cid);
  log.info(`Gateway check: ${gatewayUrl}`);
  const res = await fetchPublicGateway(gatewayUrl);
  if (!res.ok) {
    throw new Error(
      `Public gateway HTTP ${res.status} for ${opts.cid}. Open ${gatewayUrl} in a browser to confirm.`,
    );
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!bytes.length) {
    throw new Error(`Public gateway returned empty body for ${opts.cid}`);
  }
  log.ok(`Public gateway serves ${opts.cid} (${bytes.length} bytes)`);
}

export async function pinBytesToHelia(data: Uint8Array): Promise<{ cid: string }> {
  const { storage } = await getHeliaStorage();
  const cid = await storage.upload(data, { pin: true });
  return { cid };
}

const LOCAL_PIN_TIMEOUT_MS = Number(process.env.LOCAL_BLOCKSTORE_TRY_MS ?? "8000");

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Fast local read — null if CID not pinned (avoids long Helia cat hang on GET /download). */
export async function tryDownloadBytesFromHeliaLocal(cid: string): Promise<Uint8Array | null> {
  const { helia, storage } = await getHeliaStorage();
  if (!(await hasLocalPin(helia, cid))) return null;
  try {
    return await Promise.race([
      storage.download(cid),
      sleep(LOCAL_PIN_TIMEOUT_MS).then(() => {
        throw new Error("local blockstore timeout");
      }),
    ]);
  } catch {
    return null;
  }
}

export async function downloadBytesFromHelia(cid: string): Promise<Uint8Array> {
  const local = await tryDownloadBytesFromHeliaLocal(cid);
  if (local?.length) return local;
  throw new Error("CID not in local blockstore");
}

export function getServerPeerHints() {
  return getHeliaStorage().then(({ helia }) => getHeliaPeerHints(helia));
}

export function writeLocalManifest(
  bundleDir: string,
  skillName: string,
  manifest: PublishManifest,
): string {
  const manifestPath = resolve(bundleDir, "cdr-manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  const registryDir = resolve(bundleDir, "..", "registry");
  mkdirSync(registryDir, { recursive: true });
  writeFileSync(resolve(registryDir, `${skillName}.json`), JSON.stringify(manifest, null, 2), "utf-8");
  return manifestPath;
}

export function readBundleZip(bundleDir: string): Buffer {
  const skillMd = resolve(bundleDir, "SKILL.md");
  readFileSync(skillMd, "utf-8");
  return zipSkillBundle(bundleDir);
}

export function readTrainingBundleZip(bundleDir: string): Buffer {
  const trainingMd = resolve(bundleDir, "TRAINING.md");
  const videoB64 = resolve(bundleDir, "video.b64");
  readFileSync(trainingMd, "utf-8");
  readFileSync(videoB64, "utf-8");
  return zipBundleDir(bundleDir);
}
