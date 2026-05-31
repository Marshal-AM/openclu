'use node';

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import path from 'node:path';
import { loadClawsyncDotEnv } from './clawsyncDotenv';

const exec = promisify(execFile);

/** Convex bundles Node actions — import.meta.url is not the repo root. */
export function findClawsyncRoot(): string {
  const envRoot = process.env.CLAWSYNC_ROOT?.trim();
  if (envRoot && existsSync(path.join(envRoot, 'skill-marketplace', 'package.json'))) {
    return path.resolve(envRoot);
  }

  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (existsSync(path.join(dir, 'skill-marketplace', 'package.json'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    'Could not find clawsync project root (skill-marketplace/package.json). ' +
      'Run npm install from the clawsync folder, or set CLAWSYNC_ROOT.',
  );
}

function resolveTsxCli(searchPaths: string[]): string {
  for (const base of searchPaths) {
    const direct = path.join(base, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    if (existsSync(direct)) return direct;
  }

  const req = createRequire(import.meta.url);
  for (const base of searchPaths) {
    try {
      const pkgDir = path.dirname(req.resolve('tsx/package.json', { paths: [base] }));
      const cli = path.join(pkgDir, 'dist', 'cli.mjs');
      if (existsSync(cli)) return cli;
    } catch {
      /* try next */
    }
  }

  throw new Error('tsx is missing. From the clawsync directory run: npm install');
}

function assertMarketplaceReady(searchPaths: string[]): void {
  for (const base of searchPaths) {
    const supabaseDir = path.join(base, 'node_modules', '@supabase', 'supabase-js');
    if (existsSync(supabaseDir)) return;
  }

  const req = createRequire(import.meta.url);
  for (const base of searchPaths) {
    try {
      req.resolve('@supabase/supabase-js', { paths: [base] });
      return;
    } catch {
      /* try next */
    }
  }

  throw new Error(
    'skill-marketplace dependencies are not installed (need @supabase/supabase-js). From clawsync: npm install',
  );
}

function parseCliStdout<T>(stdout: string): T & { error?: string } {
  const lines = stdout.trim().split(/\r?\n/).filter((l) => l.trim());
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith('{') || line.startsWith('[')) {
      return JSON.parse(line) as T & { error?: string };
    }
  }
  throw new Error(
    `Marketplace CLI returned no JSON. stdout tail: ${stdout.slice(-800)}`,
  );
}

export function stderrToLogLines(stderr: string): string[] {
  return stderr
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export type MarketplaceCliRun<T> = {
  result: T;
  logs: string[];
  durationMs: number;
};

async function execMarketplaceCli<T>(
  command: string,
  payload?: Record<string, unknown> | string,
): Promise<MarketplaceCliRun<T>> {
  loadClawsyncDotEnv();
  const clawsyncRoot = findClawsyncRoot();
  const marketplaceRoot = path.join(clawsyncRoot, 'skill-marketplace');
  const cli = path.join(marketplaceRoot, 'src', 'cli', 'marketplace-cli.ts');

  if (!existsSync(cli)) {
    throw new Error(`Marketplace CLI missing at ${cli}`);
  }

  const searchPaths = [marketplaceRoot, clawsyncRoot];
  assertMarketplaceReady(searchPaths);

  const tsxCli = resolveTsxCli(searchPaths);
  const args = [tsxCli, cli, command];
  const heliaDataDir =
    process.env.HELIA_DATA_DIR?.trim() ||
    path.join(clawsyncRoot, 'data', '.helia-data');

  const cdrStorageDefault = process.env.CDR_STORAGE_URL?.trim() || 'http://127.0.0.1:8787';

  const env = {
    ...process.env,
    CLAWSYNC_ROOT: clawsyncRoot,
    HELIA_DATA_DIR: heliaDataDir,
    CDR_STORAGE_URL_DEFAULT: cdrStorageDefault,
  } as NodeJS.ProcessEnv;

  if (command === 'purchase' || command === 'purchase-training') {
    try {
      const health = await fetch(`${cdrStorageDefault}/health`, {
        signal: AbortSignal.timeout(2500),
      });
      if (health.ok) {
        const body = (await health.json()) as { heliaReady?: boolean };
        if (body.heliaReady) {
          env.CDR_STORAGE_URL = cdrStorageDefault;
          console.log(`[skill-marketplace] Using CDR storage at ${cdrStorageDefault}`);
        }
      }
    } catch {
      console.log(
        `[skill-marketplace] No local CDR storage at ${cdrStorageDefault} — using public IPFS gateway for ciphertext (Pinata).`,
      );
    }
  }

  if (typeof payload === 'string') {
    args.push(payload);
  } else if (payload !== undefined) {
    env.SKILL_MARKETPLACE_JSON = JSON.stringify(payload);
  }

  const started = Date.now();
  const argHint =
    command === 'get-detail' && typeof payload === 'string'
      ? ` slug=${payload}`
      : command === 'query' && typeof payload === 'object' && payload
        ? ` query=${JSON.stringify((payload as Record<string, unknown>).query ?? '')} skillSlug=${JSON.stringify((payload as Record<string, unknown>).skillSlug ?? '')}`
        : '';
  console.log(
    `[skill-marketplace] CLI start: ${command}${argHint} (HELIA_DATA_DIR=${env.HELIA_DATA_DIR})`,
  );

  let stdout: string;
  let stderr: string;
  try {
    ({ stdout, stderr } = await exec(process.execPath, args, {
      cwd: marketplaceRoot,
      env,
      maxBuffer: 20 * 1024 * 1024,
      shell: false,
      windowsHide: true,
    }));
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const logs = stderrToLogLines(err.stderr ?? '');
    for (const line of logs) {
      console.log(`[skill-marketplace] ${line}`);
    }
    const msg = err.message ?? 'Marketplace CLI failed';
    const thrown = new Error(logs.length ? `${msg}\n${logs.join('\n')}` : msg);
    (thrown as Error & { purchaseLogs?: string[] }).purchaseLogs = logs;
    throw thrown;
  }

  const durationMs = Date.now() - started;
  const logs = stderrToLogLines(stderr ?? '');
  for (const line of logs) {
    console.log(`[skill-marketplace] ${line}`);
  }
  console.log(`[skill-marketplace] CLI done: ${command} (${durationMs}ms)`);

  const parsed = parseCliStdout<T>(stdout);
  if (command === 'query' && parsed && typeof parsed === 'object') {
    const q = parsed as {
      matchCount?: number;
      matches?: Array<{ skillName?: string; score?: number; title?: string }>;
    };
    const matches = q.matches ?? [];
    const top = matches
      .slice(0, 6)
      .map(
        (m) =>
          `${m.skillName ?? '?'}:${typeof m.score === 'number' ? m.score.toFixed(2) : m.score ?? '?'}`,
      )
      .join(', ');
    console.log(
      `[skill-marketplace] query summary: matchCount=${q.matchCount ?? matches.length} top=[${top || 'none'}]`,
    );
    if (typeof payload === 'object' && payload !== null) {
      const p = payload as Record<string, unknown>;
      console.log(
        `[skill-marketplace] query args: query=${JSON.stringify(p.query ?? '')} skillSlug=${JSON.stringify(p.skillSlug ?? '')}`,
      );
    }
  }
  if (command === 'get-detail' && parsed && typeof parsed === 'object') {
    const d = parsed as { entityKey?: string; payload?: { skillName?: string; title?: string } };
    console.log(
      `[skill-marketplace] get-detail ok: slug=${d.payload?.skillName ?? '?'} entityKey=${d.entityKey?.slice(0, 18) ?? '?'}…`,
    );
  }
  if (parsed && typeof parsed === 'object' && 'error' in parsed && parsed.error) {
    const err = new Error(String(parsed.error));
    (err as Error & { purchaseLogs?: string[] }).purchaseLogs = logs;
    throw err;
  }
  return { result: parsed, logs, durationMs };
}

export async function runMarketplaceCli<T>(
  command: string,
  payload?: Record<string, unknown> | string,
): Promise<T> {
  const { result } = await execMarketplaceCli<T>(command, payload);
  return result;
}

/** Same as runMarketplaceCli but returns stderr progress lines for the UI. */
export async function runMarketplaceCliWithLogs<T>(
  command: string,
  payload?: Record<string, unknown> | string,
): Promise<MarketplaceCliRun<T>> {
  return execMarketplaceCli<T>(command, payload);
}

export function getPurchasedSkillsBaseDir(): string {
  const clawsyncRoot = findClawsyncRoot();
  return (
    process.env.PURCHASED_SKILLS_DIR?.trim() ||
    path.resolve(clawsyncRoot, 'data', 'purchased-skills')
  );
}

export function getPurchasedTrainingDataBaseDir(): string {
  const clawsyncRoot = findClawsyncRoot();
  return (
    process.env.PURCHASED_TRAINING_DATA_DIR?.trim() ||
    path.resolve(clawsyncRoot, 'data', 'purchased-training-data')
  );
}
