/**
 * Full re-publish (Story + CDR encrypt + Pinata pin + Arkiv).
 * For existing listings, prefer: npm run repin-pinata -- <skill>
 *
 * Usage (from clawsync):
 *   npm run republish-registry -- cursor-usage
 *   npm run republish-registry -- cursor-usage ../skill-capture/skills/cursor-usage
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { loadClawsyncDotEnv } from '../convex/lib/clawsyncDotenv.ts';
import { findClawsyncRoot } from '../convex/lib/marketplaceCli.ts';

loadClawsyncDotEnv();

const skillName = process.argv[2];
const bundleArg = process.argv[3];

if (!skillName) {
  console.error('Usage: npm run republish-registry -- <skill-name> [bundle-dir]');
  process.exit(1);
}

const root = findClawsyncRoot();
const marketplace = resolve(root, 'skill-marketplace');
const bundleDir =
  bundleArg ??
  resolve(root, '..', 'skill-capture', 'skills', skillName);

if (!existsSync(resolve(bundleDir, 'SKILL.md'))) {
  console.error(`Bundle missing SKILL.md at ${bundleDir}`);
  process.exit(1);
}

if (!process.env.PINATA_API_KEY?.trim() || !process.env.PINATA_SECRET_KEY?.trim()) {
  console.warn(
    'PINATA_API_KEY / PINATA_SECRET_KEY not set — publish will fail at Pinata pin. Add to clawsync/.env',
  );
}

console.log(`Republishing ${skillName} from ${bundleDir}`);

execSync(`npm run publish -- ${skillName} ${bundleDir}`, {
  cwd: marketplace,
  stdio: 'inherit',
  env: { ...process.env, CLAWSYNC_ROOT: root },
});

console.log('\nDone. Buyers fetch ciphertext via public IPFS (ops.ipfsGatewayUrl).');
