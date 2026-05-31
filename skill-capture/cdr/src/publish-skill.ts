import "dotenv/config";



/**

 * Publish a processed skill bundle to CDR:

 * 1. Register IP on Story (Aeneid) with commercial license terms

 * 2. Zip the bundle, encrypt with CDR, store ciphertext on IPFS (Helia)

 * 3. Write vault metadata + local cdr-manifest.json for purchasers

 * 4. Index catalog in catalog (peer hints + ops — required for purchase)

 *

 * Usage: npm run publish -- <skill-name> <bundle-dir>

 */

import { createHash } from "node:crypto";

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { resolve } from "node:path";

import { PILFlavor, StoryClient, WIP_TOKEN_ADDRESS } from "@story-protocol/core-sdk";

import { encodeAbiParameters, http, parseEther } from "viem";

import { createClients, ensureWasm, RPC_URL } from "./client.js";

import {

  LICENSE_READ_CONDITION,

  LICENSE_TOKEN,

  OWNER_WRITE_CONDITION,

  SPG_NFT_COLLECTION,

} from "./constants.js";

import { getHeliaStorage, uploadJsonToIpfs } from "./helia-storage.js";
import { createPinataBackedStorage } from "./storage/pinata-aligned-storage.js";
import { upsertCatalogListing } from "./catalog-listing.js";
import { pinCiphertextToPublicIpfs } from "./services/publish-service.js";
import { zipSkillBundle } from "./zip-bundle.js";



const MANIFEST_NAME = "cdr-manifest.json";



async function registerSkillIp(

  skillName: string,

  bundleDir: string,

  ownerAddress: `0x${string}`,

) {

  const storyClient = StoryClient.newClient({

    transport: http(RPC_URL),

    account: createClients().account,

    chainId: "aeneid",

  });



  const recordedAt = new Date().toISOString();

  const ipMetadata = {

    title: `Skill: ${skillName}`,

    description: `Human-recorded agent skill captured via skill-capture (${recordedAt})`,

    creators: [

      {

        name: "skill-capture",

        address: ownerAddress,

        contributionPercent: 100,

      },

    ],

  };

  const nftMetadata = {

    name: `Skill NFT — ${skillName}`,

    description: `Ownership of recorded skill ${skillName}`,

  };



  const ipIpfsHash = await uploadJsonToIpfs(ipMetadata);

  const nftIpfsHash = await uploadJsonToIpfs(nftMetadata);

  const ipHash = createHash("sha256").update(JSON.stringify(ipMetadata)).digest("hex");

  const nftHash = createHash("sha256").update(JSON.stringify(nftMetadata)).digest("hex");



  const mintingFee = parseEther(process.env.LICENSE_MINT_FEE_IP ?? "1");



  console.log("  [cdr] Registering IP asset with commercial license terms...");

  const response = await storyClient.ipAsset.registerIpAsset({

    nft: {

      type: "mint",

      spgNftContract: SPG_NFT_COLLECTION,

    },

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



  console.log(`  [cdr] IP registered: ${response.ipId}`);

  console.log(`  [cdr] License terms id: ${licenseTermsId}`);

  console.log(`  [cdr] Explorer: https://aeneid.explorer.story.foundation/ipa/${response.ipId}`);



  return {

    ipId: response.ipId as `0x${string}`,

    licenseTermsId: licenseTermsId.toString(),

    txHash: response.txHash,

  };

}



async function main() {

  const skillName = process.argv[2];

  const bundleDirArg = process.argv[3];

  if (!skillName || !bundleDirArg) {

    console.error("Usage: npm run publish -- <skill-name> <bundle-dir>");

    process.exit(1);

  }



  const bundleDir = resolve(bundleDirArg);

  const skillMd = resolve(bundleDir, "SKILL.md");

  try {

    readFileSync(skillMd, "utf-8");

  } catch {

    console.error(`Bundle missing SKILL.md at ${skillMd}`);

    process.exit(1);

  }



  console.log(`\n=== CDR publish: ${skillName} ===`);

  console.log(`Bundle: ${bundleDir}\n`);



  await ensureWasm();

  const { account, client } = createClients();

  const owner = account.address;



  const { ipId, licenseTermsId } = await registerSkillIp(skillName, bundleDir, owner);



  const zipBytes = zipSkillBundle(bundleDir);

  console.log(`  [cdr] Bundle zip: ${zipBytes.length} bytes`);



  const { helia } = await getHeliaStorage();
  const storage = createPinataBackedStorage(helia, skillName);

  const globalPubKey = await client.observer.getGlobalPubKey();



  const writeConditionData = encodeAbiParameters([{ type: "address" }], [owner]);

  const readConditionData = encodeAbiParameters(

    [{ type: "address" }, { type: "address" }],

    [LICENSE_TOKEN, ipId],

  );



  console.log("  [cdr] Encrypting bundle and uploading to IPFS + on-chain vault...");

  const { uuid, cid } = await client.uploader.uploadFile({

    content: new Uint8Array(zipBytes),

    storageProvider: storage,

    globalPubKey,

    updatable: false,

    writeConditionAddr: OWNER_WRITE_CONDITION,

    readConditionAddr: LICENSE_READ_CONDITION,

    writeConditionData,

    readConditionData,

    accessAuxData: "0x",

  });

  console.log("  [cdr] Pinning ciphertext on public IPFS (Pinata)…");
  const { ipfsGatewayUrl } = await pinCiphertextToPublicIpfs(cid, storage, skillName);

  const manifest = {

    skillName,

    vaultUuid: uuid,

    ipId,

    licenseTermsId,

    cid,

    licenseToken: LICENSE_TOKEN,

    readCondition: LICENSE_READ_CONDITION,

    writeCondition: OWNER_WRITE_CONDITION,

    mintingFeeIp: process.env.LICENSE_MINT_FEE_IP ?? "1",

    publishedAt: new Date().toISOString(),

    bundlePath: bundleDir,

    network: "aeneid",

    ipfsGatewayUrl,

  };



  const manifestPath = resolve(bundleDir, MANIFEST_NAME);
  const manifestRecord = { ...manifest, skillName };
  const registryDir = resolve(process.cwd(), "..", "skills", "registry");
  mkdirSync(registryDir, { recursive: true });

  writeFileSync(manifestPath, JSON.stringify(manifestRecord, null, 2), "utf-8");
  writeFileSync(
    resolve(registryDir, `${skillName}.json`),
    JSON.stringify(manifestRecord, null, 2),
    "utf-8",
  );

  console.log("  [arkiv] Upserting full catalog listing on Braga (required)…");
  const { result: arkivResult, peerHints } = await upsertCatalogListing({
    skillName,
    bundleDir,
    publisherAddress: owner,
    refreshPeerHints: true,
    encryptedSizeBytes: zipBytes.length,
    ipfsGatewayUrl,
  });

  console.log(`  [cdr] Helia peer id: ${peerHints.helia_peer_id}`);
  console.log(`  [cdr] Helia multiaddrs: ${peerHints.helia_multiaddrs.length}`);
  console.log(`  [arkiv] Listing key: ${arkivResult.listingKey}`);
  console.log(`  [arkiv] Version: ${arkivResult.version} (${arkivResult.tagCount} tags)`);



  console.log("\n=== CDR publish complete ===");

  console.log(`Vault UUID: ${uuid}`);

  console.log(`IPFS CID:   ${cid}`);

  console.log(`Arkiv key:  ${arkivResult.listingKey}`);

  console.log(`Manifest:   ${manifestPath}`);

  console.log(`Registry:   ${resolve(registryDir, `${skillName}.json`)}`);

  console.log("\nBuyers run: npm run purchase --", skillName);

}



main().catch((err) => {

  console.error(err);

  process.exit(1);

});

