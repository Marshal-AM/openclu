/**
 * End-to-end: build training bundle → publish (Pinata + Arkiv) → purchase → verify video.
 *
 * Run from skill-capture (after setup + .env keys):
 *   npm run test:e2e-training
 *
 * Or:
 *   npx tsx scripts/e2e-training-publish-purchase.ts
 *
 * Env (skill-capture/.env):
 *   DEVICE_WALLET_PRIVATE_KEY, PINATA_API_KEY, PINATA_SECRET_KEY
 *
 * Env (clawsync/.env — loaded automatically if ../clawsync/.env exists):
 *   AGENT_PRIVATE_KEY
 *
 * Optional:
 *   E2E_SKILL_SLUG        — fixed slug (default: e2e-roundtrip-<timestamp>)
 *   E2E_MEDIA_PATH        — source video (default: skill-capture/test.mp4)
 *   E2E_MIN_DURATION_SEC  — fail if ffprobe duration below this (default: 30)
 *   E2E_SKIP_BUNDLE       — 1 = skip python bundle step (bundle must exist)
 *   E2E_SKIP_PUBLISH      — 1 = skip publish (use existing cdr-manifest.json)
 *   E2E_ONLY_PURCHASE     — 1 = skip bundle + publish; requires E2E_SKILL_SLUG
 *   ARKIV_SETTLE_MS       — wait after publish before purchase (default: 10000)
 *   CLAWSYNC_ROOT         — path to clawsync (auto-detected)
 */
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { config } from "dotenv";
import { distributeTraining } from "../cli/src/distribute-training.js";

const exec = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_CAPTURE_ROOT = resolve(__dirname, "..");
const OPENCLU_ROOT = resolve(SKILL_CAPTURE_ROOT, "..");

type Step = { name: string; ok: boolean; detail?: string };

const steps: Step[] = [];

function pass(name: string, detail?: string) {
  steps.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail: string): never {
  steps.push({ name, ok: false, detail });
  console.error(`FAIL  ${name} — ${detail}`);
  printSummary();
  process.exit(1);
}

function printSummary() {
  console.log("\n--- Summary ---");
  for (const s of steps) {
    console.log(`${s.ok ? "PASS" : "FAIL"}  ${s.name}${s.detail ? `: ${s.detail}` : ""}`);
  }
}

function findClawsyncRoot(): string {
  const envRoot = process.env.CLAWSYNC_ROOT?.trim();
  if (envRoot && existsSync(resolve(envRoot, "skill-marketplace", "package.json"))) {
    return resolve(envRoot);
  }
  const candidate = resolve(OPENCLU_ROOT, "clawsync");
  if (existsSync(resolve(candidate, "skill-marketplace", "package.json"))) {
    return candidate;
  }
  fail("clawsync-root", "Could not find clawsync/ — set CLAWSYNC_ROOT");
}

function resolveVenvPython(): string {
  const win = resolve(SKILL_CAPTURE_ROOT, "venv/Scripts/python.exe");
  const unix = resolve(SKILL_CAPTURE_ROOT, "venv/bin/python");
  if (process.platform === "win32" && existsSync(win)) return win;
  if (existsSync(unix)) return unix;
  return process.platform === "win32" ? "python" : "python3";
}

function resolveTsxCli(clawsyncRoot: string): string {
  const bases = [
    resolve(clawsyncRoot, "skill-marketplace"),
    resolve(clawsyncRoot),
    resolve(SKILL_CAPTURE_ROOT, "cli"),
  ];
  for (const base of bases) {
    const p = resolve(base, "node_modules", "tsx", "dist", "cli.mjs");
    if (existsSync(p)) return p;
  }
  fail("tsx", "tsx not found — run npm install in clawsync and skill-capture/cli");
}

async function runMarketplaceCli<T>(
  clawsyncRoot: string,
  command: string,
  payload?: Record<string, unknown> | string,
): Promise<T> {
  const tsxCli = resolveTsxCli(clawsyncRoot);
  const cli = resolve(clawsyncRoot, "skill-marketplace/src/cli/marketplace-cli.ts");
  const args = [tsxCli, cli, command];
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CLAWSYNC_ROOT: clawsyncRoot,
    HELIA_DATA_DIR:
      process.env.HELIA_DATA_DIR?.trim() ||
      resolve(clawsyncRoot, "data", ".helia-data"),
  };
  if (typeof payload === "string") {
    args.push(payload);
  } else if (payload !== undefined) {
    env.SKILL_MARKETPLACE_JSON = JSON.stringify(payload);
  }

  const { stdout, stderr } = await exec(process.execPath, args, {
    cwd: resolve(clawsyncRoot, "skill-marketplace"),
    env,
    maxBuffer: 25 * 1024 * 1024,
    windowsHide: true,
  });
  if (stderr?.trim()) {
    for (const line of stderr.split(/\r?\n/).filter(Boolean).slice(-40)) {
      console.log(`  [marketplace] ${line}`);
    }
  }
  const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith("{")) {
      return JSON.parse(line) as T;
    }
  }
  fail(command, `No JSON in marketplace CLI stdout (tail: ${stdout.slice(-400)})`);
}

async function buildBundleFromMedia(
  slug: string,
  bundleDir: string,
  mediaPath: string,
): Promise<void> {
  mkdirSync(bundleDir, { recursive: true });
  const trainingMd = resolve(bundleDir, "TRAINING.md");
  if (!existsSync(trainingMd)) {
    writeFileSync(
      trainingMd,
      `# E2E training roundtrip\n\nAutomated test bundle for \`${slug}\`.\n`,
      "utf-8",
    );
  }

  const python = resolveVenvPython();
  const script = resolve(SKILL_CAPTURE_ROOT, "video_capture.py");
  console.log(`\n=== Build bundle from media ===`);
  console.log(`  python: ${python}`);
  console.log(`  media:  ${mediaPath}`);
  console.log(`  slug:   ${slug}\n`);

  const { stdout, stderr } = await exec(python, [script, slug, "--no-distribute"], {
    cwd: SKILL_CAPTURE_ROOT,
    env: {
      ...process.env,
      SKILL_CAPTURE_MEDIA_INPUT: mediaPath,
      PYTHONUNBUFFERED: "1",
    },
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });
  const out = `${stdout}\n${stderr}`;
  for (const line of out.split(/\r?\n/).filter(Boolean)) {
    console.log(`  [capture] ${line}`);
  }

  for (const f of ["video.b64", "video.meta.json"]) {
    if (!existsSync(resolve(bundleDir, f))) {
      fail("build-bundle", `Missing ${f} in ${bundleDir}`);
    }
  }
  pass("build-bundle", bundleDir);
}

type VideoMeta = {
  durationSec?: number;
  wallClockSec?: number;
  frameCount?: number;
  byteLength?: number;
  mimeType?: string;
};

function readMeta(dir: string): VideoMeta | null {
  const p = resolve(dir, "video.meta.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf-8")) as VideoMeta;
}

async function probeVideoDurationSeconds(filePath: string): Promise<number | null> {
  const python = resolveVenvPython();
  const lower = filePath.toLowerCase();
  const decoder = resolve(OPENCLU_ROOT, "test/decode_training_webm.py");
  if (
    existsSync(decoder) &&
    !lower.endsWith(".webm") &&
    !lower.endsWith(".mp4") &&
    !lower.endsWith(".mov")
  ) {
    try {
      const { stdout } = await exec(
        python,
        [decoder, filePath],
        { cwd: OPENCLU_ROOT, maxBuffer: 4 * 1024 * 1024, windowsHide: true },
      );
      const m = stdout.match(/ffprobe duration:\s*([\d.]+)s/);
      if (m) return Number(m[1]);
    } catch {
      /* fall through */
    }
  }
  try {
    const code = [
      "import cv2, sys",
      "p = sys.argv[1]",
      "cap = cv2.VideoCapture(p)",
      "fps = cap.get(cv2.CAP_PROP_FPS) or 0",
      "n = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0",
      "print(n / fps if fps > 0 else 0)",
      "cap.release()",
    ].join("\n");
    const { stdout } = await exec(python, ["-c", code, filePath], {
      cwd: SKILL_CAPTURE_ROOT,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });
    const v = Number(stdout.trim());
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

async function decodeB64ToWebm(bundleDir: string, outName = "verified.webm"): Promise<string> {
  const python = resolveVenvPython();
  const decoder = resolve(OPENCLU_ROOT, "test/decode_training_webm.py");
  const outPath = resolve(bundleDir, outName);
  await exec(python, [decoder, bundleDir, outPath], {
    cwd: OPENCLU_ROOT,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
  return outPath;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("\n=== E2E training: publish + purchase + verify ===\n");

  config({ path: resolve(SKILL_CAPTURE_ROOT, ".env") });
  const clawsyncRoot = findClawsyncRoot();
  config({ path: resolve(clawsyncRoot, ".env"), override: false });

  if (!process.env.DEVICE_WALLET_PRIVATE_KEY?.trim()) {
    fail("env", "DEVICE_WALLET_PRIVATE_KEY missing in skill-capture/.env");
  }
  if (!process.env.PINATA_API_KEY?.trim() || !process.env.PINATA_SECRET_KEY?.trim()) {
    fail("env", "PINATA_API_KEY and PINATA_SECRET_KEY required in skill-capture/.env");
  }
  if (!process.env.AGENT_PRIVATE_KEY?.trim()) {
    fail("env", "AGENT_PRIVATE_KEY missing in clawsync/.env");
  }

  const slug =
    process.env.E2E_SKILL_SLUG?.trim() ||
    `e2e-roundtrip-${Date.now().toString(36)}`;
  const mediaPath = resolve(
    process.env.E2E_MEDIA_PATH?.trim() ||
      resolve(SKILL_CAPTURE_ROOT, "test.mp4"),
  );
  const bundleDir = resolve(SKILL_CAPTURE_ROOT, "training-data", slug);
  const minDuration = Number(process.env.E2E_MIN_DURATION_SEC ?? "55");
  const expectedSourceDur = process.env.E2E_EXPECTED_SOURCE_SEC
    ? Number(process.env.E2E_EXPECTED_SOURCE_SEC)
    : null;
  const settleMs = Number(process.env.ARKIV_SETTLE_MS ?? "10000");
  const skipBundle = process.env.E2E_SKIP_BUNDLE === "1";
  const skipPublish = process.env.E2E_SKIP_PUBLISH === "1";
  const onlyPurchase = process.env.E2E_ONLY_PURCHASE === "1";

  if (!existsSync(mediaPath) && !skipBundle && !onlyPurchase) {
    fail("media", `E2E_MEDIA_PATH not found: ${mediaPath}`);
  }

  pass("config", `slug=${slug} media=${mediaPath}`);

  if (!onlyPurchase && !skipBundle && existsSync(mediaPath)) {
    const srcDur = await probeVideoDurationSeconds(mediaPath);
    if (srcDur != null) {
      pass("source-duration", `${srcDur.toFixed(2)}s (${mediaPath})`);
      if (expectedSourceDur != null && Math.abs(srcDur - expectedSourceDur) > 2) {
        fail(
          "source-duration",
          `Expected ~${expectedSourceDur}s, got ${srcDur.toFixed(2)}s`,
        );
      }
    }
  }

  if (!onlyPurchase) {
    if (!skipBundle) {
      await buildBundleFromMedia(slug, bundleDir, mediaPath);
    } else if (!existsSync(resolve(bundleDir, "video.b64"))) {
      fail("bundle", `E2E_SKIP_BUNDLE=1 but no bundle at ${bundleDir}`);
    } else {
      pass("build-bundle", "skipped (existing)");
    }

    const publishMeta = readMeta(bundleDir);
    if (publishMeta) {
      pass(
        "publish-meta",
        `durationSec=${publishMeta.durationSec} wallClockSec=${publishMeta.wallClockSec} frames=${publishMeta.frameCount} bytes=${publishMeta.byteLength}`,
      );
    }

    const publishWebm = await decodeB64ToWebm(bundleDir, "publish-verified.webm");
    const publishProbe = await probeVideoDurationSeconds(publishWebm);
    if (publishProbe != null) {
      pass("publish-duration", `${publishProbe.toFixed(2)}s (decoded webm)`);
      if (publishProbe < minDuration) {
        fail(
          "publish-duration",
          `Published video is only ${publishProbe.toFixed(1)}s (min ${minDuration}s) — fix capture before testing purchase`,
        );
      }
    } else {
      fail("publish-duration", "Could not measure decoded webm duration (install ffmpeg or opencv)");
    }

    if (!skipPublish) {
      console.log(`\n=== Publish (distribute-training) ===\n`);
      await distributeTraining({ skillName: slug, bundleDir });
      pass("publish", slug);
    } else {
      pass("publish", "skipped (E2E_SKIP_PUBLISH=1)");
    }
  }

  const manifestPath = resolve(bundleDir, "cdr-manifest.json");
  if (!existsSync(manifestPath)) {
    fail("manifest", `Missing ${manifestPath} — publish first`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
    cid?: string;
    encryptedSizeBytes?: number;
    vaultUuid?: number;
  };
  if (!manifest.cid) fail("manifest", "cdr-manifest.json missing cid");
  pass("manifest", `cid=${manifest.cid.slice(0, 20)}… zip=${manifest.encryptedSizeBytes ?? "?"} bytes`);

  console.log(`\n  Waiting ${settleMs}ms for catalog indexing…`);
  await sleep(settleMs);

  console.log(`\n=== Catalog lookup ===\n`);
  const detail = await runMarketplaceCli<{ entityKey: string; payload: unknown }>(
    clawsyncRoot,
    "get-training-detail",
    slug,
  );
  const payload = detail.payload as {
    purchase?: { cid?: string };
    ops?: { encryptedSizeBytes?: number; ipfsGatewayUrl?: string };
  };
  if (payload.purchase?.cid !== manifest.cid) {
    fail(
      "catalog-cid",
      `Arkiv cid ${payload.purchase?.cid} != manifest ${manifest.cid}`,
    );
  }
  pass("catalog", `entityKey=${detail.entityKey.slice(0, 18)}…`);

  const purchaseRoot = resolve(
    process.env.E2E_PURCHASE_OUT_DIR?.trim() ||
      resolve(clawsyncRoot, "data", "e2e-training-purchases"),
  );
  mkdirSync(purchaseRoot, { recursive: true });

  console.log(`\n=== Purchase ===\n`);
  const purchaseResult = await runMarketplaceCli<{
    skillName: string;
    localPath: string;
    cid: string;
    licenseTokenId: string;
  }>(clawsyncRoot, "purchase-training", {
    skillName: slug,
    outputDir: purchaseRoot,
    catalogSnapshot: { entityKey: detail.entityKey, payload: detail.payload },
  });

  if (purchaseResult.cid !== manifest.cid) {
    fail("purchase-cid", `${purchaseResult.cid} != ${manifest.cid}`);
  }
  pass("purchase", `license=${purchaseResult.licenseTokenId} path=${purchaseResult.localPath}`);

  const purchasedDir = purchaseResult.localPath;
  if (!existsSync(resolve(purchasedDir, "video.b64"))) {
    fail("purchase-files", "video.b64 missing after purchase");
  }

  const pubMeta = readMeta(bundleDir);
  const buyMeta = readMeta(purchasedDir);
  if (pubMeta && buyMeta) {
    if (pubMeta.byteLength && buyMeta.byteLength && pubMeta.byteLength !== buyMeta.byteLength) {
      fail(
        "meta-bytes",
        `publish byteLength=${pubMeta.byteLength} vs purchased ${buyMeta.byteLength}`,
      );
    }
    pass(
      "meta-bytes",
      `byteLength=${buyMeta.byteLength} (durationSec in meta may be wrong if ffprobe was missing at capture)`,
    );
  }

  const buyWebm = await decodeB64ToWebm(purchasedDir, "purchase-verified.webm");
  const buyProbe = await probeVideoDurationSeconds(buyWebm);
  const pubProbe = existsSync(resolve(bundleDir, "publish-verified.webm"))
    ? await probeVideoDurationSeconds(resolve(bundleDir, "publish-verified.webm"))
    : null;

  if (buyProbe != null) {
    pass("purchase-duration", `${buyProbe.toFixed(2)}s (decoded webm)`);
    if (buyProbe < minDuration) {
      fail(
        "purchase-duration",
        `Purchased video is only ${buyProbe.toFixed(1)}s (min ${minDuration}s)`,
      );
    }
    if (pubProbe != null) {
      const ratio = buyProbe / pubProbe;
      if (ratio < 0.95 || ratio > 1.05) {
        fail(
          "duration-roundtrip",
          `publish ${pubProbe.toFixed(2)}s vs purchase ${buyProbe.toFixed(2)}s (ratio ${ratio.toFixed(2)})`,
        );
      }
      pass("duration-roundtrip", `${pubProbe.toFixed(2)}s → ${buyProbe.toFixed(2)}s`);
    }
  }

  console.log("\n--- Artifacts (kept on disk) ---");
  console.log(`  Publish bundle:  ${bundleDir}`);
  console.log(`  Purchased copy:  ${purchasedDir}`);
  console.log(`  Play purchased:  ${resolve(purchasedDir, "purchase-verified.webm")}`);

  printSummary();
  if (steps.some((s) => !s.ok)) process.exit(1);
  console.log("\nAll checks passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
