/**
 * Smoke test: Supabase portal devices + catalog queries.
 * Run: node test/verify-contributions-catalog.mjs <ownerWallet>
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const FRONTEND_ENV = resolve(ROOT, "frontend", ".env.local");

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
  Object.assign(process.env, loadEnvFile(FRONTEND_ENV));
  Object.assign(process.env, loadEnvFile(resolve(ROOT, "skill-capture", ".env")));
}

async function loadCatalog() {
  return import(pathToFileURL(resolve(ROOT, "frontend/src/lib/supabase/catalog.ts")).href);
}

async function loadPortal() {
  return import(pathToFileURL(resolve(ROOT, "frontend/src/lib/supabase/portal.ts")).href);
}

applyEnv();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in frontend/.env.local");
  process.exit(1);
}

const owner = process.argv[2]?.trim() || process.env.TEST_OWNER_WALLET;
if (!owner) {
  console.error("Usage: node test/verify-contributions-catalog.mjs <ownerWallet>");
  process.exit(1);
}

const { listDevicesForOwner } = await loadPortal();
const { queryCatalog, queryCatalogTraining } = await loadCatalog();

const { devices } = await listDevicesForOwner(owner);
console.log("devices:", devices.length);

for (const device of devices) {
  const ownerAddress = device.wallet_address;
  const [skills, training] = await Promise.all([
    queryCatalog({ scope: "mine", ownerAddress, full: true }),
    queryCatalogTraining({ scope: "mine", ownerAddress, full: true }),
  ]);
  console.log(device.device_name, "skills", skills.matchCount, "training", training.matchCount);
}

console.log("OK");
