/**
 * One-shot install for skill-marketplace deps. Runs from clawsync postinstall only.
 * skill-marketplace has no postinstall — no recursive npm loop.
 */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = dirname(fileURLToPath(new URL('../', import.meta.url)));
const marketplace = join(root, 'skill-marketplace');
const markerNested = join(marketplace, 'node_modules', '@arkiv-network', 'sdk');
const markerHoisted = join(root, 'node_modules', '@arkiv-network', 'sdk');

if (!existsSync(markerNested) && !existsSync(markerHoisted)) {
  console.log('[clawsync] Installing skill-marketplace dependencies…');
  execSync('npm install', {
    cwd: marketplace,
    stdio: 'inherit',
    env: { ...process.env, npm_config_ignore_scripts: 'true' },
  });
}
