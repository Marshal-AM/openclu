/**
 * Smoke test: Arkiv portal devices + catalog SDK queries → contribution mapping.
 * Run from repo root: node test/verify-contributions-arkiv.mjs [ownerWallet]
 *
 * Requires frontend/.env with PORTAL_WALLET_PRIVATE_KEY for device list writes are not needed —
 * device list is a public Arkiv read.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const FRONTEND_ENV = resolve(ROOT, "frontend", ".env");
const DEVICE_WALLET = "0x2514844F312c02Ae3C9d4fEb40db4eC8830b6844";

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
  for (const [k, v] of Object.entries(loadEnvFile(FRONTEND_ENV))) {
    if (!process.env[k]) process.env[k] = v;
  }
}

async function loadCatalog() {
  applyEnv();
  const mod = await import(
    pathToFileURL(resolve(ROOT, "frontend/src/lib/arkiv/catalog/index.ts")).href
  );
  return mod;
}

async function loadPortal() {
  applyEnv();
  const mod = await import(
    pathToFileURL(resolve(ROOT, "frontend/src/lib/arkiv/portal/index.ts")).href
  );
  return mod;
}

async function listDevices(ownerWallet) {
  const { listPortalDevices } = await loadPortal();
  const { devices } = await listPortalDevices(ownerWallet.toLowerCase());
  return devices;
}

async function aggregateForOwner(ownerWallet) {
  const { queryCatalog, queryCatalogTraining } = await loadCatalog();
  const devices = await listDevices(ownerWallet);
  const contributions = [];
  const warnings = [];

  for (const device of devices) {
    try {
      const [skills, training] = await Promise.all([
        queryCatalog({ scope: "mine", ownerAddress: device.wallet_address, full: true }),
        queryCatalogTraining({ scope: "mine", ownerAddress: device.wallet_address, full: true }),
      ]);
      for (const m of skills.matches ?? []) {
        contributions.push({
          kind: "skill",
          skill_slug: m.skillName,
          status: m.status,
          title: m.title,
          device_name: device.device_name,
        });
      }
      for (const m of training.matches ?? []) {
        contributions.push({
          kind: "training",
          skill_slug: m.skillName,
          status: m.status,
          title: m.title,
          device_name: device.device_name,
        });
      }
    } catch (e) {
      warnings.push(`${device.device_name}: ${e.message}`);
    }
  }

  return { devices: devices.length, contributions, warnings };
}

async function main() {
  const ownerArg = process.argv[2];
  const { queryCatalog, queryCatalogTraining } = await loadCatalog();

  console.log("--- Direct Arkiv SDK (device wallet) ---");
  const skills = await queryCatalog({
    scope: "mine",
    ownerAddress: DEVICE_WALLET,
    full: true,
  });
  const training = await queryCatalogTraining({
    scope: "mine",
    ownerAddress: DEVICE_WALLET,
    full: true,
  });
  console.log(`Skills: ${skills.matchCount}, Training: ${training.matchCount}`);

  console.log("\n--- Arkiv portal devices ---");
  const allDevices = ownerArg ? await listDevices(ownerArg) : [];
  const owner =
    ownerArg ??
    allDevices[0]?.owner_wallet_address ??
    (() => {
      throw new Error("Pass owner wallet as argv[2] or register a device first");
    })();
  console.log(`Owner wallet: ${owner}`);
  console.log(`Devices for owner: ${allDevices.length || "(pass owner to list)"}`);

  console.log("\n--- Full aggregation (same as GET /api/contributions) ---");
  const agg = await aggregateForOwner(owner);
  console.log(`Devices for owner: ${agg.devices}`);
  console.log(`Contributions mapped: ${agg.contributions.length}`);
  if (agg.warnings.length) console.log("Warnings:", agg.warnings);
  console.log("\nSample rows:");
  for (const c of agg.contributions.slice(0, 8)) {
    console.log(`  [${c.kind}] ${c.skill_slug} (${c.status}) — ${c.title} @ ${c.device_name}`);
  }

  const published = agg.contributions.filter((c) => c.status === "published");
  console.log(`\nPublished (visible on /contributions): ${published.length}`);
  process.exit(agg.contributions.length > 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
