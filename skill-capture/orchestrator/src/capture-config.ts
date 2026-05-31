import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { SKILL_CAPTURE_ROOT } from "../../db/src/lib/device-wallet.js";

function npmRemainArgv(): string[] {
  const raw = process.env.npm_config_argv;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { remain?: string[] };
    return parsed.remain ?? [];
  } catch {
    return [];
  }
}

export const captureDevMode =
  process.argv.includes("-d") ||
  process.env.SKILL_CAPTURE_DEV === "1" ||
  npmRemainArgv().includes("-d");

export function resolveFixedMediaInput(): string | undefined {
  if (!captureDevMode) return undefined;
  const path = resolve(SKILL_CAPTURE_ROOT, "test.mp4");
  return existsSync(path) ? path : undefined;
}
