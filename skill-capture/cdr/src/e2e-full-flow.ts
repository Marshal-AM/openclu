/**
 * E2E: cursor-usage — full Arkiv upsert → query → fetch → purchase
 *
 * Usage: npm run e2e
 *
 * Step 1 always upserts the full Arkiv row (like Supabase). Uses manifest peer hints
 * when present (fast); starts Helia only if hints are missing.
 *
 * Env:
 *   E2E_SKIP_PUBLISH=1 — skip Story/CDR re-encrypt; still runs full Arkiv upsert
 */
import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { upsertCatalogListing } from "./catalog-listing.js";

const SKILL = "cursor-usage";
const BUNDLE = resolve(process.cwd(), "..", "skills", SKILL);
const MANIFEST_PATH = resolve(BUNDLE, "cdr-manifest.json");
const PURCHASED_SKILL = resolve(process.cwd(), "..", "skills", "purchased", SKILL, "SKILL.md");
const RECEIPT_PATH = resolve(process.cwd(), "..", "skills", "purchased", SKILL, "purchase-receipt.json");

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../arkiv/.env"), override: false });

type StepResult = { name: string; ok: boolean; detail?: string };
const results: StepResult[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail: string) {
  results.push({ name, ok: false, detail });
  console.error(`FAIL  ${name} — ${detail}`);
}

function loadManifest(): Record<string, unknown> {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) as Record<string, unknown>;
}

async function stepCatalogRefresh(): Promise<void> {
  const skipPublish = ["1", "true", "yes"].includes(
    (process.env.E2E_SKIP_PUBLISH ?? "").toLowerCase(),
  );
  try {
    if (!skipPublish) {
      console.log("  [e2e] Full CDR publish (encrypt + Arkiv upsert)…");
      execSync(`npm run publish -- ${SKILL} ${BUNDLE}`, {
        cwd: process.cwd(),
        stdio: "inherit",
        env: process.env,
      });
      pass("1 catalog", "publish");
    } else {
      console.log("  [e2e] Arkiv full upsert from manifest (no re-encrypt)…");
      await upsertCatalogListing({
        skillName: SKILL,
        refreshPeerHints: false,
      });
      pass("1 catalog", "Arkiv upsert (manifest peer hints)");
    }

    const m = loadManifest();
    if (!m.catalogListingId || !m.ipId || !m.cid) {
      fail("1 catalog", "manifest missing catalogListingId, ipId, or cid");
      return;
    }
    if (!m.heliaPeerId || !(m.heliaMultiaddrs as string[] | undefined)?.length) {
      fail("1 catalog", "manifest missing heliaPeerId/heliaMultiaddrs after upsert");
      return;
    }

    const { fetchSkillListingFromCatalog } = await import(
      "../../db/src/lib/cdr-listing.js"
    );
    const listing = await fetchSkillListingFromCatalog(SKILL);
    if (!listing.helia_peer_id || !listing.helia_multiaddrs.length) {
      fail("1b ops verify", "Catalog listing missing ops after upsert");
      return;
    }
    pass(
      "1b ops verify",
      `peer=${listing.helia_peer_id.slice(0, 12)}… addrs=${listing.helia_multiaddrs.length}`,
    );
  } catch (e) {
    fail("1 catalog", e instanceof Error ? e.message : String(e));
  }
}

async function stepArkivQuery(manifestCid: string): Promise<void> {
  try {
    const { searchNaturalLanguage } = await import(
      "../../db/src/services/query-catalog.js"
    );
    const matches = await searchNaturalLanguage("cursor", { tag: "cursor" });
    const hit = matches.find((m) => m.skillName === SKILL);
    if (!hit) {
      fail("2 Arkiv query", `no match for ${SKILL} (${matches.length} hits)`);
      return;
    }
    if (hit.purchase.cid !== manifestCid) {
      fail("2 Arkiv query", `cid mismatch: arkiv=${hit.purchase.cid} manifest=${manifestCid}`);
      return;
    }
    pass("2 Arkiv query", `hits=${matches.length}`);
  } catch (e) {
    fail("2 Arkiv query", e instanceof Error ? e.message : String(e));
  }
}

async function stepFetchListing(): Promise<void> {
  try {
    const { fetchSkillListingFromCatalog } = await import(
      "../../db/src/lib/cdr-listing.js"
    );
    const listing = await fetchSkillListingFromCatalog(SKILL);
    pass("3 Arkiv fetch", `addrs=${listing.helia_multiaddrs.length}`);
  } catch (e) {
    fail("3 Arkiv fetch", e instanceof Error ? e.message : String(e));
  }
}

async function stepPurchase(): Promise<void> {
  try {
    execSync(`npm run purchase -- ${SKILL}`, {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
    });
    if (!existsSync(PURCHASED_SKILL)) {
      fail("4 purchase", `missing ${PURCHASED_SKILL}`);
      return;
    }
    if (!existsSync(RECEIPT_PATH)) {
      fail("5 receipt", `missing ${RECEIPT_PATH}`);
      return;
    }
    pass("4 purchase", "ok");
    pass("5 receipt", "ok");
  } catch (e) {
    fail("4 purchase", e instanceof Error ? e.message : String(e));
  }
}

async function main() {
  console.log(`\n=== E2E: ${SKILL} ===\n`);

  if (!existsSync(resolve(BUNDLE, "SKILL.md"))) {
    console.error(`Bundle missing: ${BUNDLE}`);
    process.exit(1);
  }

  await stepCatalogRefresh();

  let cid = "";
  try {
    cid = String(loadManifest().cid ?? "");
  } catch {
    fail("manifest", `cannot read ${MANIFEST_PATH}`);
  }

  if (cid) await stepArkivQuery(cid);
  await stepFetchListing();

  const ok = results.filter((r) => r.name.startsWith("1") || r.name.startsWith("2") || r.name.startsWith("3")).every((r) => r.ok);
  if (ok) await stepPurchase();
  else fail("4 purchase", "skipped — earlier steps failed");

  console.log("\n--- Summary ---");
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `: ${r.detail}` : ""}`);
  }
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
