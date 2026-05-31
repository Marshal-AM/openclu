/**
 * One-shot install for skill-marketplace deps. Runs from clawsync postinstall only.
 */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = dirname(fileURLToPath(new URL('../', import.meta.url)));
const marketplace = join(root, 'skill-marketplace');
const markerNested = join(marketplace, 'node_modules', '@supabase', 'supabase-js');
const markerHoisted = join(root, 'node_modules', '@supabase', 'supabase-js');

if (!existsSync(markerNested) && !existsSync(markerHoisted)) {
  console.log('[clawsync] Installing skill-marketplace dependencies…');
  execSync('npm install --ignore-scripts', {
    cwd: marketplace,
    stdio: 'inherit',
  });
}
