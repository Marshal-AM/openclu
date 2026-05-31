/**
 * Smoke test: Supabase portal devices + catalog queries.
 * Run: node test/verify-contributions-catalog.mjs <ownerWallet>
 */
import { readFileSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

function applyEnv() {
  Object.assign(process.env, loadEnvFile(resolve(ROOT, "frontend", ".env")));
  Object.assign(process.env, loadEnvFile(resolve(ROOT, "frontend", ".env.local")));
  Object.assign(process.env, loadEnvFile(resolve(ROOT, "skill-capture", ".env")));
  Object.assign(process.env, loadEnvFile(resolve(ROOT, "skill-capture", "db", ".env")));
}

function resolveTsxCli() {
  for (const dir of [
    resolve(ROOT, "skill-capture/db"),
    resolve(ROOT, "skill-capture/cli"),
    resolve(ROOT, "clawsync"),
  ]) {
    const p = resolve(dir, "node_modules/tsx/dist/cli.mjs");
    if (existsSync(p)) return p;
  }
  throw new Error("tsx not found — run npm install in skill-capture/db");
}

applyEnv();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (frontend/.env or skill-capture/.env)");
  process.exit(1);
}

const owner = process.argv[2]?.trim() || process.env.TEST_OWNER_WALLET;
if (!owner) {
  console.error("Usage: node test/verify-contributions-catalog.mjs <ownerWallet>");
  process.exit(1);
}

const runner = resolve(ROOT, "test/.verify-contributions-catalog-run.ts");
writeFileSync(
  runner,
  `import { portalListDevices } from "../skill-capture/db/src/portal-db-bridge.ts";
import { catalogQuery, catalogQueryTraining } from "../skill-capture/db/src/catalog-read-bridge.ts";

async function main() {
  const owner = ${JSON.stringify(owner)};
  const { devices } = await portalListDevices(owner);
  const rows: Array<{ device_name: string; skills: number; training: number }> = [];
  for (const device of devices) {
    const ownerAddress = device.wallet_address;
    const [skills, training] = await Promise.all([
      catalogQuery({ scope: "mine", ownerAddress, full: true }),
      catalogQueryTraining({ scope: "mine", ownerAddress, full: true }),
    ]);
    rows.push({ device_name: device.device_name, skills: skills.matchCount, training: training.matchCount });
  }
  console.log(JSON.stringify({ deviceCount: devices.length, rows }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
`,
);

const tsxCli = resolveTsxCli();
const result = spawnSync(process.execPath, [tsxCli, runner], {
  cwd: ROOT,
  env: process.env,
  encoding: "utf-8",
});

try {
  unlinkSync(runner);
} catch {
  /* ignore */
}

if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}

const out = JSON.parse(result.stdout.trim());
console.log("devices:", out.deviceCount);
for (const row of out.rows) {
  console.log(row.device_name, "skills", row.skills, "training", row.training);
}
console.log("OK");
