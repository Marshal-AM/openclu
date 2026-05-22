/**
 * E2E: catalog snapshot → purchase → decrypt (same path as in-chat / SyncBoard).
 *
 * Usage (from clawsync):
 *   npm run test:purchase-snapshot
 *   TEST_SKILL=cursor-usage npm run test:purchase-snapshot
 *
 * Fast path (default TEST_SKILL=abc): reuses license from data/purchased-skills/abc/purchase-receipt.json
 *   (SKIP_LICENSE_MINT — only tests catalog snapshot + CDR decrypt/download).
 *
 * Prerequisites:
 *   - clawsync/.env with AGENT_PRIVATE_KEY
 *   - Skill ciphertext pinned on public IPFS (Pinata API keys at publish/repin)
 *   - Optional PINATA_BUYER_GATEWAY in .env (defaults to catalog ops.ipfsGatewayUrl)
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadClawsyncDotEnv } from '../convex/lib/clawsyncDotenv.ts';
import {
  findClawsyncRoot,
  getPurchasedSkillsBaseDir,
  runMarketplaceCliWithLogs,
} from '../convex/lib/marketplaceCli.ts';
import { resolvePurchaseCatalogSnapshot } from '../convex/lib/resolvePurchaseCatalog.ts';

const SKILL = (process.env.TEST_SKILL ?? 'abc').trim();
const MAX_RESOLVE_MS = Number(process.env.TEST_MAX_RESOLVE_MS ?? '500');
const MAX_PURCHASE_MS = Number(process.env.TEST_MAX_PURCHASE_MS ?? '180_000'.replace('_', ''));

type Step = { name: string; ok: boolean; detail?: string; ms?: number };

const steps: Step[] = [];

function pass(name: string, detail?: string, ms?: number) {
  steps.push({ name, ok: true, detail, ms });
  console.log(`PASS  ${name}${ms != null ? ` (${ms}ms)` : ''}${detail ? ` — ${detail}` : ''}`);
}

function fail(name: string, detail: string) {
  steps.push({ name, ok: false, detail });
  console.error(`FAIL  ${name} — ${detail}`);
}

function payloadHasOps(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const ops = (payload as { ops?: { heliaPeerId?: string; heliaMultiaddrs?: string[] } }).ops;
  return Boolean(
    ops?.heliaPeerId && Array.isArray(ops.heliaMultiaddrs) && ops.heliaMultiaddrs.length > 0,
  );
}

async function checkCdrStorage(): Promise<boolean> {
  const url = process.env.CDR_STORAGE_URL?.trim() || 'http://127.0.0.1:8787';
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const body = (await res.json()) as { heliaReady?: boolean };
    if (body.heliaReady) {
      pass('cdr-storage', url);
      return true;
    }
    fail('cdr-storage', `${url} health ok but heliaReady=false`);
    return false;
  } catch (e) {
    fail(
      'cdr-storage',
      `${url} unreachable — run: npm run cdr-storage (${e instanceof Error ? e.message : String(e)})`,
    );
    return false;
  }
}

function tryReuseLicense(skillName: string): void {
  const receiptPath = join(getPurchasedSkillsBaseDir(), skillName, 'purchase-receipt.json');
  if (!existsSync(receiptPath)) return;
  try {
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf-8')) as {
      licenseTokenId?: string;
    };
    if (receipt.licenseTokenId) {
      process.env.SKIP_LICENSE_MINT = '1';
      process.env.LICENSE_TOKEN_ID = receipt.licenseTokenId;
      pass('skip-mint', `reuse licenseTokenId=${receipt.licenseTokenId} from ${receiptPath}`);
    }
  } catch {
    /* full mint */
  }
}

async function main() {
  console.log(`\n=== Catalog snapshot purchase test: ${SKILL} ===\n`);
  loadClawsyncDotEnv();

  if (!process.env.AGENT_PRIVATE_KEY?.trim()) {
    fail('env', 'AGENT_PRIVATE_KEY missing in clawsync/.env');
    printSummary();
    process.exit(1);
  }

  const cdrOk = await checkCdrStorage();
  if (!cdrOk) {
    console.warn('  Continuing without CDR storage (purchase will be slower)…\n');
  }

  tryReuseLicense(SKILL);

  // 1) Preview / get-detail (SyncBoard + search source)
  let detail: { entityKey: string; payload: unknown };
  try {
    const t0 = Date.now();
    detail = await runMarketplaceCliWithLogs<{ entityKey: string; payload: unknown }>(
      'get-detail',
      SKILL,
    ).then((r) => r.result);
    const ms = Date.now() - t0;
    if (!payloadHasOps(detail.payload)) {
      fail('get-detail', 'payload missing ops.heliaMultiaddrs');
    } else {
      const p = detail.payload as {
        purchase?: { cid?: string };
        ops?: { heliaMultiaddrs?: string[] };
      };
      pass(
        'get-detail',
        `entityKey=${detail.entityKey.slice(0, 18)}… cid=${p.purchase?.cid?.slice(0, 16)}… addrs=${p.ops?.heliaMultiaddrs?.length ?? 0}`,
        ms,
      );
    }
  } catch (e) {
    fail('get-detail', e instanceof Error ? e.message : String(e));
    printSummary();
    process.exit(1);
  }

  // 2) Resolver must prefer inline snapshot (no second get-detail)
  const inline = { entityKey: detail.entityKey, payload: detail.payload };
  try {
    const t0 = Date.now();
    const { snapshot, source } = await resolvePurchaseCatalogSnapshot(SKILL, inline);
    const ms = Date.now() - t0;
    if (source !== 'inline') {
      fail('resolve-catalog', `expected source=inline, got ${source}`);
    } else if (ms > MAX_RESOLVE_MS) {
      fail('resolve-catalog', `took ${ms}ms (max ${MAX_RESOLVE_MS}) — may have hit network`);
    } else if (!payloadHasOps(snapshot.payload)) {
      fail('resolve-catalog', 'resolved snapshot missing ops');
    } else {
      pass('resolve-catalog', `source=${source}`, ms);
    }
  } catch (e) {
    fail('resolve-catalog', e instanceof Error ? e.message : String(e));
    printSummary();
    process.exit(1);
  }

  // 3) Purchase with catalogSnapshot → decrypt
  const outRoot = mkdtempSync(join(tmpdir(), 'clawsync-purchase-test-'));
  try {
    const t0 = Date.now();
    const { result, logs, durationMs } = await runMarketplaceCliWithLogs<{
      skillName: string;
      localPath: string;
      cid: string;
      licenseTokenId: string;
    }>('purchase', {
      skillName: SKILL,
      outputDir: outRoot,
      catalogSnapshot: inline,
    });

    const usedSnapshot = logs.some((l) => /Catalog source:\s*UI snapshot/i.test(l));
    const usedRegistry = logs.some((l) =>
      /marketplace content registry|Registry HTTP hit|registry cache hit/i.test(l),
    );
    if (!usedSnapshot) {
      fail(
        'purchase-cli',
        'stderr missing "Catalog source: UI snapshot" — catalogSnapshot not applied',
      );
    } else if (!usedRegistry && SKILL !== 'abc') {
      fail(
        'purchase-cli',
        'ciphertext not loaded from content registry — run: npm run backfill-registry -- ' +
          SKILL,
      );
    } else if (durationMs > MAX_PURCHASE_MS) {
      fail('purchase-cli', `took ${durationMs}ms (max ${MAX_PURCHASE_MS})`);
    } else {
      pass(
        'purchase-cli',
        `license=${result.licenseTokenId} cid=${result.cid.slice(0, 20)}…`,
        durationMs,
      );
    }

    const skillMd = join(result.localPath, 'SKILL.md');
    if (!existsSync(skillMd)) {
      fail('decrypt-output', `missing ${skillMd}`);
    } else {
      const size = readFileSync(skillMd, 'utf-8').length;
      pass('decrypt-output', `SKILL.md ${size} bytes at ${result.localPath}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    fail('purchase-cli', msg.slice(0, 2000));
  } finally {
    try {
      rmSync(outRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  printSummary();
  process.exit(steps.some((s) => !s.ok) ? 1 : 0);
}

function printSummary() {
  console.log('\n--- Summary ---');
  for (const s of steps) {
    console.log(`${s.ok ? 'PASS' : 'FAIL'}  ${s.name}${s.detail ? `: ${s.detail}` : ''}`);
  }
  const root = findClawsyncRoot();
  console.log(`\nClawSync root: ${root}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
