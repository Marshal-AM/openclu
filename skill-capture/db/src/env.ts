import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

let loaded = false;

const DB_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

/** Load env from skill-capture, frontend, and db package. */
export function loadDbEnv(): void {
  if (loaded) return;
  const skillCaptureRoot = resolve(DB_ROOT, "..");
  const paths = [
    resolve(skillCaptureRoot, ".env"),
    resolve(skillCaptureRoot, "..", "frontend", ".env"),
    resolve(skillCaptureRoot, "..", "frontend", ".env.local"),
    resolve(skillCaptureRoot, "cdr", ".env"),
    resolve(DB_ROOT, ".env"),
    resolve(skillCaptureRoot, "..", "clawsync", ".env"),
    resolve(skillCaptureRoot, "..", "clawsync", ".env.local"),
  ];
  for (const p of paths) {
    if (existsSync(p)) config({ path: p, override: false });
  }
  config({ override: false });
  loaded = true;
}
