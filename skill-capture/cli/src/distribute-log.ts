/**
 * Verbose distribute output — Story, CDR encrypt, Arkiv, explorer URLs.
 */
import type { PublishStartResult } from "../../cdr/src/services/publish-service.js";
import type { PublishCatalogResult } from "../../arkiv/src/lib/types.js";
import {
  ipfsUrl,
  storyAddressUrl,
  storyIpaUrl,
  storyTxUrl,
} from "../../cdr/src/lib/explorer-links.js";
import {
  LICENSE_READ_CONDITION,
  LICENSE_TOKEN,
  OWNER_WRITE_CONDITION,
  ROYALTY_MODULE,
} from "../../cdr/src/constants.js";

function section(title: string) {
  const pad = Math.max(0, 54 - title.length);
  console.log(`\n── ${title} ${"─".repeat(pad)}`);
}

function line(label: string, value: string | number | undefined) {
  if (value === undefined || value === "") return;
  console.log(`  ${label.padEnd(24)} ${value}`);
}

function url(label: string, href: string | undefined) {
  if (!href) return;
  console.log(`  ${label.padEnd(24)} ${href}`);
}

export function printStoryPublish(skillName: string, story: PublishStartResult) {
  section("Story Protocol (Aeneid)");
  line("Skill name", skillName);
  line("IP Asset ID", story.ipId);
  line("License terms ID", story.licenseTermsId);
  line("Publisher", story.publisherAddress);
  line("Registration tx", story.txHash ?? "(not returned by SDK)");
  line("License type", `${story.licenseType} (rev share ${story.commercialRevShare}%)`);
  line("Minting fee (IP)", `${story.mintingFeeIp} WIP`);
  line("SPG NFT collection", story.spgNftContract);
  line("Network", story.network);
  line("RPC", story.rpcUrl);
  line("Story API", story.storyApiUrl);
  console.log("\n  Metadata (Helia → IPFS)");
  line("IP metadata CID", story.ipMetadataCid);
  line("NFT metadata CID", story.nftMetadataCid);
  line("IP metadata hash", story.ipMetadataHash);
  line("NFT metadata hash", story.nftMetadataHash);
  url("IP metadata", story.urls.ipMetadataIpfs);
  url("NFT metadata", story.urls.nftMetadataIpfs);
  console.log("\n  Explorers");
  url("IPA", story.urls.ipa);
  url("Registration tx", story.urls.tx);
  url("Publisher wallet", story.urls.publisher);
  url("SPG collection", story.urls.spgCollection);
}

export function printCdrEncrypt(opts: {
  vaultUuid: number;
  cid: string;
  zipBytes: number;
  ipId: string;
  publisherAddress: string;
  peerHints: { helia_peer_id: string; helia_multiaddrs: string[] };
}) {
  section("CDR encrypt + Helia storage");
  line("Vault UUID", opts.vaultUuid);
  line("Ciphertext CID", opts.cid);
  line("Plain zip size", `${opts.zipBytes} bytes`);
  line("Bound IP", opts.ipId);
  line("Owner", opts.publisherAddress);
  url("Ciphertext (IPFS gateway)", ipfsUrl(opts.cid));
  console.log("\n  On-chain conditions (Aeneid)");
  line("Read condition", LICENSE_READ_CONDITION);
  line("Write condition", OWNER_WRITE_CONDITION);
  line("License token", LICENSE_TOKEN);
  line("Royalty module", ROYALTY_MODULE);
  console.log("\n  Helia peer hints (for purchasers)");
  line("Peer ID", opts.peerHints.helia_peer_id);
  const addrs = opts.peerHints.helia_multiaddrs;
  if (addrs.length) {
    for (let i = 0; i < Math.min(addrs.length, 6); i++) {
      line(i === 0 ? "Multiaddrs" : "", addrs[i]);
    }
    if (addrs.length > 6) line("", `… +${addrs.length - 6} more`);
  }
}

export function printArkivPublish(arkiv: PublishCatalogResult) {
  section("Arkiv catalog (Braga)");
  line("Listing entity key", arkiv.listingKey);
  line("Status", arkiv.status);
  line("Version", arkiv.version);
  line("Tag count", arkiv.tagCount);
  line("Publisher", arkiv.publisherAddress);
  line("Chain", `${arkiv.chainName} (${arkiv.chainId})`);
  line("Entities mutation tx", arkiv.txHash);
  line("Listing mutation tx", arkiv.listingTxHash ?? "(update-only path)");
  if (arkiv.tags.length) {
    console.log("\n  Tags");
    for (const t of arkiv.tags) console.log(`    • ${t}`);
  }
  console.log("\n  Explorers");
  url("Entities tx", arkiv.urls.entitiesTx);
  url("Listing tx", arkiv.urls.listingTx);
  url("Explorer home", arkiv.explorerBaseUrl);

  if (arkiv.catalogPayload) {
    section("Arkiv indexed payload (full)");
    console.log(JSON.stringify(arkiv.catalogPayload, null, 2));
  }
}

export function printDistributeSummary(opts: {
  skillName: string;
  manifestPath: string;
  story: PublishStartResult;
  vaultUuid: number;
  cid: string;
  arkiv: PublishCatalogResult;
}) {
  section("Distribute complete");
  line("Skill", opts.skillName);
  line("Manifest", opts.manifestPath);
  line("Vault UUID", opts.vaultUuid);
  line("CID", opts.cid);
  line("IP Asset", opts.story.ipId);
  line("Arkiv listing", opts.arkiv.listingKey);
  line("Arkiv version", opts.arkiv.version);
  console.log("\n  Quick links");
  url("Story IPA", storyIpaUrl(opts.story.ipId));
  if (opts.story.txHash) url("Story tx", storyTxUrl(opts.story.txHash));
  url("Ciphertext", ipfsUrl(opts.cid));
  url("Arkiv entities tx", opts.arkiv.urls.entitiesTx);
  url("Publisher", storyAddressUrl(opts.story.publisherAddress));
}
