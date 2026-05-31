'use node';

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const LOCAL_ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'AGENT_PRIVATE_KEY',
  'GROQ_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENROUTER_API_KEY',
  'XAI_API_KEY',
  'PURCHASED_SKILLS_DIR',
  'CLAWSYNC_ROOT',
  'HELIA_DATA_DIR',
  'RPC_URL',
  'API_URL',
  'SKIP_LICENSE_MINT',
  'LICENSE_TOKEN_ID',
  'CDR_STORAGE_URL',
  'IPFS_GATEWAY',
  'PINATA_API_KEY',
  'PINATA_SECRET_KEY',
  'PINATA_JWT',
  'PINATA_BUYER_GATEWAY',
  'PINATA_GATEWAY',
  'IPFS_GATEWAY',
  'IPFS_GATEWAY_TIMEOUT_MS',
  'MARKETPLACE_BLOBS_DIR',
] as const;

function parseDotEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const eq = trimmed.indexOf('=');
  if (eq <= 0) return null;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function mergeEnvFile(filePath: string, keys: readonly string[]): void {
  if (!existsSync(filePath)) return;
  const allowed = new Set(keys);
  for (const line of readFileSync(filePath, 'utf-8').split(/\r?\n/)) {
    const parsed = parseDotEnvLine(line);
    if (!parsed || !allowed.has(parsed.key)) continue;
    if (!process.env[parsed.key]?.trim()) {
      process.env[parsed.key] = parsed.value;
    }
  }
}

/**
 * Local dev: Convex actions do not read clawsync/.env automatically.
 * Load buyer wallet and related vars from the repo .env when Convex env is empty.
 */
function clawsyncEnvCandidates(): string[] {
  const candidates: string[] = [];
  const envRoot = process.env.CLAWSYNC_ROOT?.trim();
  if (envRoot) {
    candidates.push(path.join(path.resolve(envRoot), '.env'));
  }

  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (existsSync(path.join(dir, 'skill-marketplace', 'package.json'))) {
      candidates.push(path.join(dir, '.env'));
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return candidates;
}

export function loadClawsyncDotEnv(): void {
  for (const file of clawsyncEnvCandidates()) {
    mergeEnvFile(file, LOCAL_ENV_KEYS);
  }
}
