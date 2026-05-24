/**
 * Skill Capture CLI — local capture/process/encrypt; Story + Arkiv in-process (device wallet).
 */
import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { SKILL_CAPTURE_ROOT } from "../../arkiv/src/lib/device-wallet.js";
import { resolveVenvPython } from "../../lib/spawn-util.js";
import { distributeSkill } from "./distribute.js";
import { distributeTraining } from "./distribute-training.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, "../..");

config({ path: resolve(ROOT, ".env") });
config({ path: resolve(ROOT, "cdr/.env"), override: false });

function ensureDeviceEnv() {
  if (!process.env.DEVICE_WALLET_PRIVATE_KEY?.trim()) {
    console.error("DEVICE_WALLET_PRIVATE_KEY missing — run skill-capture/register.sh first");
    process.exit(1);
  }
}

function runPythonCapture(skillName: string): number {
  const capturePath = resolve(ROOT, "capture.py");
  console.log(`\n=== CLI: capture + process (local) ===\n`);
  const r = spawnSync(resolveVenvPython(), [capturePath, skillName, "--no-distribute"], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, CDR_PUBLISH: "0", PYTHONIOENCODING: "utf-8" },
    shell: false,
  });
  return r.status ?? 1;
}

async function main() {
  const [cmd, skillName, bundleDirArg] = process.argv.slice(2);
  ensureDeviceEnv();

  if (cmd === "capture") {
    if (!skillName) {
      console.error("Usage: npm run capture -- <skill-name>");
      process.exit(1);
    }
    const bundleDir = resolve(ROOT, "skills", skillName);
    const skillMd = resolve(bundleDir, "SKILL.md");
    if (!existsSync(skillMd)) {
      console.error(`Draft SKILL.md required at ${skillMd} — save metadata in the UI first`);
      process.exit(1);
    }
    process.exit(runPythonCapture(skillName));
  }

  if (cmd === "distribute") {
    if (!skillName) {
      console.error("Usage: npm run distribute -- <skill-name> [bundle-dir]");
      process.exit(1);
    }
    const bundleDir = bundleDirArg
      ? resolve(bundleDirArg)
      : resolve(ROOT, "skills", skillName);
    await distributeSkill({ skillName, bundleDir });
    return;
  }

  if (cmd === "distribute-training") {
    if (!skillName) {
      console.error("Usage: distribute-training <skill-name> [bundle-dir]");
      process.exit(1);
    }
    const bundleDir = bundleDirArg
      ? resolve(bundleDirArg)
      : resolve(ROOT, "training-data", skillName);
    await distributeTraining({ skillName, bundleDir });
    return;
  }

  if (cmd === "skill") {
    if (!skillName) {
      console.error("Usage: npm run skill -- <skill-name>");
      process.exit(1);
    }
    const bundleDir = resolve(ROOT, "skills", skillName);
    if (!existsSync(resolve(bundleDir, "SKILL.md"))) {
      console.error("Draft SKILL.md required before full skill run");
      process.exit(1);
    }
    const code = runPythonCapture(skillName);
    if (code !== 0) process.exit(code);
    await distributeSkill({ skillName, bundleDir });
    return;
  }

  console.error("Usage: npm run skill|capture|distribute -- ...");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
