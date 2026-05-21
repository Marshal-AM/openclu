import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import path from "node:path";

const exec = promisify(execFile);

const SKILL_CAPTURE_ROOT = path.resolve(process.cwd(), "..", "skill-capture");
const ARKIV_DIR = path.join(SKILL_CAPTURE_ROOT, "arkiv");
const CLI_DIR = path.join(SKILL_CAPTURE_ROOT, "cli");
const CLI = path.join(ARKIV_DIR, "src", "cli", "catalog-query-cli.ts");

function resolveTsxCli(): string {
  for (const dir of [ARKIV_DIR, CLI_DIR]) {
    const p = path.join(dir, "node_modules", "tsx", "dist", "cli.mjs");
    if (existsSync(p)) return p;
  }
  throw new Error(
    "Arkiv tsx missing — run: cd skill-capture/arkiv && npm install && cd ../cli && npm install",
  );
}

async function runCli<T>(
  cmd: string,
  payload?: CatalogQueryBody | Record<string, unknown> | string,
): Promise<T> {
  const tsxCli = resolveTsxCli();
  const args = [tsxCli, CLI, cmd];
  const env = { ...process.env } as NodeJS.ProcessEnv;
  if (payload !== undefined && typeof payload === "string") {
    args.push(payload);
  } else if (payload !== undefined) {
    env.SKILL_CAPTURE_CATALOG_JSON = JSON.stringify(payload);
  }

  const { stdout } = await exec(process.execPath, args, {
    cwd: ARKIV_DIR,
    env,
    maxBuffer: 10 * 1024 * 1024,
    shell: false,
    windowsHide: true,
  });

  const parsed = JSON.parse(stdout.trim()) as T & { error?: string };
  if (parsed && typeof parsed === "object" && "error" in parsed && parsed.error) {
    throw new Error(parsed.error);
  }
  return parsed;
}

export type CatalogQueryBody = {
  query?: string;
  tag?: string;
  status?: string;
  since?: number;
  until?: number;
  listingKey?: string;
  minScore?: number;
  skillSlug?: string;
  ownerAddress?: string;
  scope?: "marketplace" | "mine";
};

export function queryCatalog(body: CatalogQueryBody) {
  return runCli<{ matchCount: number; matches: unknown[] }>("query", body);
}

export function getCatalogSkill(skillName: string) {
  return runCli<Record<string, unknown>>("get", skillName);
}

export function getCatalogStats(scope = "marketplace", ownerAddress?: string) {
  return runCli<Record<string, number>>("stats", { scope, ownerAddress });
}
