/**
 * Re-index Supabase catalog with full listing row (purchase + ops). Fast when manifest has peer hints.
 *
 * Usage:
 *   npm run index-catalog -- <skill-name>
 *   npm run index-catalog -- <skill-name> --refresh-peers
 */
import "dotenv/config";
import { createClients } from "./client.js";
import { upsertCatalogListing } from "./catalog-listing.js";
import { log } from "./logger.js";

async function main() {
  const args = process.argv.slice(2);
  const skillName = args.find((a) => !a.startsWith("-"));
  const refreshPeers = args.includes("--refresh-peers");

  if (!skillName) {
    console.error("Usage: npm run index-catalog -- <skill-name> [--refresh-peers]");
    process.exit(1);
  }

  log.section(`Catalog upsert (full listing): ${skillName}`);
  const { account } = createClients();

  const { result, peerHints } = await upsertCatalogListing({
    skillName,
    publisherAddress: account.address,
    refreshPeerHints: refreshPeers,
  });

  log.info(`version: ${result.version}`);
  log.info(`peer id: ${peerHints.helia_peer_id}`);
  log.info(`multiaddrs: ${peerHints.helia_multiaddrs.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
