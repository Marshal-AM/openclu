import "dotenv/config";
import { indexSkillByName } from "../services/publish-catalog.js";
import { failCli } from "./cli-utils.js";

async function main() {
  const skillName = process.argv[2];
  if (!skillName) {
    console.error("Usage: npm run index -- <skill-name>");
    process.exit(1);
  }

  console.log(`\n=== Arkiv index: ${skillName} ===\n`);
  try {
    const result = await indexSkillByName(skillName);
    console.log("Listing key:", result.listingKey);
    console.log("Version:", result.version);
    console.log("Tags:", result.tagCount);
    console.log("Tx:", result.txHash);
    console.log("\n=== Arkiv index complete ===\n");
  } catch (e) {
    failCli(e);
  }
}

main();
