import "dotenv/config";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { SKILL_CAPTURE_ROOT } from "../device-wallet.js";
import { indexSkillByName } from "../catalog/publish-catalog.js";

config({ path: resolve(SKILL_CAPTURE_ROOT, ".env") });

const skillName = process.argv[2];
if (!skillName) {
  console.error("Usage: tsx src/jobs/update-catalog.ts <skill-slug>");
  process.exit(1);
}

const bundleDir = resolve(SKILL_CAPTURE_ROOT, "skills", skillName);
const skillMd = resolve(bundleDir, "SKILL.md");
const manifestPath = resolve(bundleDir, "cdr-manifest.json");

if (!existsSync(skillMd)) {
  console.error(`SKILL.md missing at skills/${skillName}/SKILL.md — save metadata first`);
  process.exit(1);
}
if (!existsSync(manifestPath)) {
  console.error(
    `cdr-manifest.json missing — publish the skill first (distribute), then edit metadata.`,
  );
  process.exit(1);
}

indexSkillByName(skillName, bundleDir)
  .then((r) => {
    console.log(
      JSON.stringify(
        {
          ok: true,
          listingId: r.listingId,
          listingKey: r.listingKey,
          version: r.version,
          tagCount: r.tagCount,
        },
        null,
        2,
      ),
    );
  })
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
