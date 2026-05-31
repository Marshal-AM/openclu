import "dotenv/config";
import { resolve } from "node:path";
import { config } from "dotenv";
import { SKILL_CAPTURE_ROOT } from "../device-wallet.js";
import { extendSkillListing } from "../catalog/extend-catalog.js";

config({ path: resolve(SKILL_CAPTURE_ROOT, ".env") });

const skillName = process.argv[2];
if (!skillName) {
  console.error("Usage: tsx src/jobs/extend-skill.ts <skill-slug>");
  process.exit(1);
}

extendSkillListing(skillName)
  .then((r) => {
    console.log(JSON.stringify({ ok: true, ...r }, null, 2));
  })
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
