import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

let loaded = false;

/** Load env from clawsync root (.env.local / .env) when running locally. */
export function loadArkivEnv(): void {
  if (loaded) return;
  const pkgRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const clawsyncRoot = resolve(pkgRoot, "..");
  for (const name of [".env.local", ".env"]) {
    const p = resolve(clawsyncRoot, name);
    if (existsSync(p)) config({ path: p, override: false });
  }
  config({ override: false });
  loaded = true;
}
