/**
 * Verbose distribute output — Story, CDR encrypt, Supabase catalog.
 */
import type { PublishStartResult } from "../../cdr/src/services/publish-service.js";
import type { PublishCatalogResult } from "../../db/src/types.js";
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
  ipfsGatewayUrl?: string;
}) {
  section("CDR encrypt + public IPFS (Pinata)");
  line("Vault UUID", opts.vaultUuid);
  line("Ciphertext CID", opts.cid);
  if (opts.ipfsGatewayUrl) line("Buyer gateway base", opts.ipfsGatewayUrl);
  line("Plain zip size", `${opts.zipBytes} bytes`);
  line("Bound IP", opts.ipId);
  line("Owner", opts.publisherAddress);
  url("Ciphertext (IPFS gateway)", ipfsUrl(opts.cid));
  console.log("\n  On-chain conditions (Aeneid)");
  line("Read condition", LICENSE_READ_CONDITION);
  line("Write condition", OWNER_WRITE_CONDITION);
  line("License token", LICENSE_TOKEN);
  line("Royalty module", ROYALTY_MODULE);
  console.log("\n  Buyer content delivery");
  line(
    "Fetch",
    opts.ipfsGatewayUrl
      ? `${opts.ipfsGatewayUrl}/{cid} (stored in catalog ops.ipfsGatewayUrl)`
      : "(re-run distribute with PINATA_API_KEY + PINATA_SECRET_KEY)",
  );
  console.log("\n  Helia peer hints (publish-time only; buyers use public IPFS)");
  line("Peer ID", opts.peerHints.helia_peer_id);
  const addrs = opts.peerHints.helia_multiaddrs;
  if (addrs.length) {
    for (let i = 0; i < Math.min(addrs.length, 6); i++) {
      line(i === 0 ? "Multiaddrs" : "", addrs[i]);
    }
    if (addrs.length > 6) line("", `… +${addrs.length - 6} more`);
  }
}

export function printCatalogPublish(catalog: PublishCatalogResult) {
  section("Catalog (Supabase)");
  line("Listing id", catalog.listingId);
  line("Status", catalog.status);
  line("Version", catalog.version);
  line("Tag count", catalog.tagCount);
  line("Publisher", catalog.publisherAddress);
  if (catalog.tags.length) {
    console.log("\n  Tags");
    for (const t of catalog.tags) console.log(`    • ${t}`);
  }
  if (catalog.catalogPayload) {
    section("Catalog indexed payload (full)");
    console.log(JSON.stringify(catalog.catalogPayload, null, 2));
  }
}

export function printDistributeSummary(opts: {
  skillName: string;
  manifestPath: string;
  story: PublishStartResult;
  vaultUuid: number;
  cid: string;
  catalog: PublishCatalogResult;
  ipfsGatewayUrl?: string;
}) {
  section("Distribute complete");
  line("Skill", opts.skillName);
  line("Manifest", opts.manifestPath);
  line("Vault UUID", opts.vaultUuid);
  line("CID", opts.cid);
  line("IP Asset", opts.story.ipId);
  line("Catalog listing", opts.catalog.listingId);
  line("Catalog version", opts.catalog.version);
  if (opts.ipfsGatewayUrl) {
    line("IPFS gateway", opts.ipfsGatewayUrl);
  }
  console.log("\n  Quick links");
  url("Story IPA", storyIpaUrl(opts.story.ipId));
  if (opts.story.txHash) url("Story tx", storyTxUrl(opts.story.txHash));
  url("Ciphertext", ipfsUrl(opts.cid));
  url("Publisher", storyAddressUrl(opts.story.publisherAddress));
}
