import "dotenv/config";
import { extendSkillListing } from "../services/extend-catalog.js";
import { failCli } from "./cli-utils.js";

async function main() {
  const skillName = process.argv[2];
  if (!skillName) {
    console.error("Usage: npm run extend -- <skill-name>");
    process.exit(1);
  }
  try {
    const result = await extendSkillListing(skillName);
    console.log(JSON.stringify({ skillName, ...result }, null, 2));
  } catch (e) {
    failCli(e);
  }
}

main();
