import "dotenv/config";
import { archiveSkillCatalog } from "../services/archive-catalog.js";
import { failCli } from "./cli-utils.js";

async function main() {
  const skillName = process.argv[2];
  if (!skillName) {
    console.error("Usage: npm run archive -- <skill-name>");
    process.exit(1);
  }
  try {
    const result = await archiveSkillCatalog(skillName);
    console.log(JSON.stringify({ skillName, ...result }, null, 2));
  } catch (e) {
    failCli(e);
  }
}

main();
