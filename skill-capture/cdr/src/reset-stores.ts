/**
 * Reset local Helia blockstore only (Catalog listings are on-chain).
 *
 * Usage: npm run reset-stores
 */
import "dotenv/config";
import { resetHeliaStore } from "./helia-storage.js";
import { log } from "./logger.js";

async function main() {
  log.section("Reset local Helia blockstore");
  await resetHeliaStore();
  log.section("Reset complete — run publish then purchase");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
