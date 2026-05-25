/**
 * Smoke test: Supabase devices → Arkiv skill + training queries → contribution mapping.
 * Run from repo root: node test/verify-contributions-arkiv.mjs [ownerWallet]
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const FRONTEND_ENV = resolve(ROOT, "frontend", ".env");
const ARKIV_DIR = resolve(ROOT, "skill-capture", "arkiv");
const CLI = resolve(ARKIV_DIR, "src", "cli", "catalog-query-cli.ts");
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

async function runCatalog(cmd, body) {
  const tsx = resolve(ARKIV_DIR, "node_modules", "tsx", "dist", "cli.mjs");
  if (!existsSync(tsx)) throw new Error("Missing skill-capture/arkiv node_modules — run npm install there");
  const env = { ...process.env, SKILL_CAPTURE_CATALOG_JSON: JSON.stringify(body) };
  const { stdout } = await exec(process.execPath, [tsx, CLI, cmd], {
    cwd: ARKIV_DIR,
    env,
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(stdout.trim());
}

async function listDevices(ownerWallet) {
  const env = loadEnvFile(FRONTEND_ENV);
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in frontend/.env");

  const res = await fetch(
    `${url}/rest/v1/devices?select=id,device_name,wallet_address,owner_wallet_address&owner_wallet_address=eq.${ownerWallet.toLowerCase()}`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    },
  );
  if (!res.ok) throw new Error(`Supabase devices: ${res.status} ${await res.text()}`);
  return res.json();
}

async function aggregateForOwner(ownerWallet) {
  const devices = await listDevices(ownerWallet);
  const contributions = [];
  const warnings = [];

  for (const device of devices) {
    try {
      const [skills, training] = await Promise.all([
        runCatalog("query", { scope: "mine", ownerAddress: device.wallet_address, full: true }),
        runCatalog("query-training", {
          scope: "mine",
          ownerAddress: device.wallet_address,
          full: true,
        }),
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

  console.log("--- Direct Arkiv (device wallet) ---");
  const skills = await runCatalog("query", {
    scope: "mine",
    ownerAddress: DEVICE_WALLET,
    full: true,
  });
  const training = await runCatalog("query-training", {
    scope: "mine",
    ownerAddress: DEVICE_WALLET,
    full: true,
  });
  console.log(`Skills: ${skills.matchCount}, Training: ${training.matchCount}`);

  console.log("\n--- Supabase devices ---");
  const allDevices = await fetch(
    `${loadEnvFile(FRONTEND_ENV).SUPABASE_URL}/rest/v1/devices?select=owner_wallet_address,wallet_address,device_name&limit=5`,
    {
      headers: {
        apikey: loadEnvFile(FRONTEND_ENV).SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${loadEnvFile(FRONTEND_ENV).SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  ).then((r) => r.json());

  const owner =
    ownerArg ??
    allDevices[0]?.owner_wallet_address ??
    (() => {
      throw new Error("Pass owner wallet as argv[2] or register a device first");
    })();
  console.log(`Owner wallet: ${owner}`);
  console.log(`Sample devices in DB: ${allDevices.length}`);

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
