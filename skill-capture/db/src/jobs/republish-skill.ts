import "dotenv/config";
import { resolve } from "node:path";
import { config } from "dotenv";
import { SKILL_CAPTURE_ROOT } from "../../db/src/device-wallet.js";
import { spawnSync } from "node:child_process";

config({ path: resolve(SKILL_CAPTURE_ROOT, ".env") });

const skillName = process.argv[2];
if (!skillName) {
  console.error("Usage: tsx src/jobs/republish-skill.ts <skill-slug>");
  process.exit(1);
}

const cliDir = resolve(SKILL_CAPTURE_ROOT, "cli");
const r = spawnSync("npm", ["run", "distribute", "--", skillName], {
  cwd: cliDir,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});
process.exit(r.status ?? 1);
