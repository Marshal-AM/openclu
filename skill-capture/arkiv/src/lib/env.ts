import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

let loaded = false;

/** Load device wallet from skill-capture/.env first, then arkiv/cdr for RPC fallbacks. */
export function loadArkivEnv(): void {
  if (loaded) return;
  const arkivRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const rootEnv = resolve(arkivRoot, "..", ".env");
  const frontendEnv = resolve(arkivRoot, "..", "..", "frontend", ".env");
  const frontendLocalEnv = resolve(arkivRoot, "..", "..", "frontend", ".env.local");
  const cdrEnv = resolve(arkivRoot, "..", "cdr", ".env");
  const arkivEnv = resolve(arkivRoot, ".env");
  if (existsSync(rootEnv)) config({ path: rootEnv });
  if (existsSync(frontendEnv)) config({ path: frontendEnv, override: false });
  if (existsSync(frontendLocalEnv)) config({ path: frontendLocalEnv, override: false });
  if (existsSync(arkivEnv)) config({ path: arkivEnv, override: false });
  if (existsSync(cdrEnv)) config({ path: cdrEnv, override: false });
  config({ override: false });
  loaded = true;
}
