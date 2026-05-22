import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Helia block cache — always under the clawsync deployment (portable folder).
 * Optional HELIA_DATA_DIR in .env overrides.
 */
export function resolveHeliaDataDir(): string {
  if (process.env.HELIA_DATA_DIR?.trim()) {
    return path.resolve(process.env.HELIA_DATA_DIR.trim());
  }

  const clawsync = process.env.CLAWSYNC_ROOT?.trim();
  if (clawsync) {
    return path.join(path.resolve(clawsync), "data", ".helia-data");
  }

  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    if (existsSync(path.join(dir, "skill-marketplace", "package.json"))) {
      return path.join(dir, "data", ".helia-data");
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return path.resolve(process.cwd(), "data", ".helia-data");
}
