/**
 * Windows-safe child processes: never spawn npm.cmd/npx.cmd with shell:false (EINVAL).
 * Use node + tsx/dist/cli.mjs or venv python.exe instead.
 */
import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const LIB_DIR = dirname(fileURLToPath(import.meta.url));
export const SKILL_CAPTURE_ROOT = resolve(LIB_DIR, "..");

export function resolveVenvPython(): string {
  const winVenv = resolve(SKILL_CAPTURE_ROOT, "venv/Scripts/python.exe");
  const unixVenv = resolve(SKILL_CAPTURE_ROOT, "venv/bin/python");
  if (process.platform === "win32" && existsSync(winVenv)) return winVenv;
  if (existsSync(unixVenv)) return unixVenv;
  return process.platform === "win32" ? "python" : "python3";
}

export function resolveTsxCli(...searchDirs: string[]): string {
  const dirs =
    searchDirs.length > 0
      ? searchDirs
      : [
          resolve(SKILL_CAPTURE_ROOT, "cli"),
          resolve(SKILL_CAPTURE_ROOT, "db"),
          resolve(SKILL_CAPTURE_ROOT, "orchestrator"),
        ];
  for (const dir of dirs) {
    const p = resolve(dir, "node_modules", "tsx", "dist", "cli.mjs");
    if (existsSync(p)) return p;
  }
  throw new Error(
    "tsx not found — run npm install in skill-capture/cli and skill-capture/db",
  );
}

export function spawnVenvPython(
  scriptAbs: string,
  args: string[],
  opts: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    stdio?: SpawnOptions["stdio"];
  } = {},
): ChildProcess {
  return spawn(resolveVenvPython(), [scriptAbs, ...args], {
    cwd: opts.cwd ?? SKILL_CAPTURE_ROOT,
    env: {
      ...process.env,
      ...opts.env,
      PYTHONUNBUFFERED: "1",
      PYTHONIOENCODING: "utf-8",
    },
    shell: false,
    windowsHide: true,
    ...(opts.stdio !== undefined ? { stdio: opts.stdio } : {}),
  } as SpawnOptions);
}

export function spawnNodeTsx(
  entryAbs: string,
  args: string[],
  opts: { cwd: string; env?: NodeJS.ProcessEnv; tsxDirs?: string[] },
): ChildProcess {
  const tsxCli = resolveTsxCli(
    ...(opts.tsxDirs ?? [opts.cwd, resolve(SKILL_CAPTURE_ROOT, "cli"), resolve(SKILL_CAPTURE_ROOT, "db")]),
  );
  return spawn(process.execPath, [tsxCli, entryAbs, ...args], {
    cwd: opts.cwd,
    env: { ...process.env, ...opts.env },
    shell: false,
    windowsHide: true,
  } as SpawnOptions);
}

export function getSpawnPreflight(): {
  ok: boolean;
  python: string;
  hasVenvPython: boolean;
  hasTsx: boolean;
  hasGroqKey: boolean;
  hasDeviceKey: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const python = resolveVenvPython();
  const hasVenvPython = existsSync(
    process.platform === "win32"
      ? resolve(SKILL_CAPTURE_ROOT, "venv/Scripts/python.exe")
      : resolve(SKILL_CAPTURE_ROOT, "venv/bin/python"),
  );
  if (!hasVenvPython) {
    issues.push("Python venv missing — run: python -m venv venv && pip install -r requirements.txt");
  }
  let hasTsx = false;
  try {
    resolveTsxCli();
    hasTsx = true;
  } catch {
    issues.push("tsx missing — run: cd skill-capture/cli && npm install && cd ../db && npm install");
  }
  const hasGroqKey = Boolean(process.env.GROQ_API_KEY?.trim());
  if (!hasGroqKey) issues.push("GROQ_API_KEY missing in skill-capture/.env");
  const hasDeviceKey = Boolean(process.env.DEVICE_WALLET_PRIVATE_KEY?.trim());
  if (!hasDeviceKey) issues.push("DEVICE_WALLET_PRIVATE_KEY missing — run register.ps1");
  return {
    ok: issues.length === 0,
    python,
    hasVenvPython,
    hasTsx,
    hasGroqKey,
    hasDeviceKey,
    issues,
  };
}
