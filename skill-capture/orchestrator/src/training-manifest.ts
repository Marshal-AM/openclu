import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SKILL_CAPTURE_ROOT } from "../../lib/spawn-util.js";
import type { PublishResult } from "./skill-manifest.js";

export function readTrainingPublishResult(skillSlug: string): PublishResult | null {
  const manifestPath = resolve(
    SKILL_CAPTURE_ROOT,
    "training-data",
    skillSlug,
    "cdr-manifest.json",
  );
  if (!existsSync(manifestPath)) return null;
  try {
    const m = JSON.parse(readFileSync(manifestPath, "utf-8")) as Record<string, unknown>;
    return {
      skillSlug,
      skillName: (m.skillName as string) ?? skillSlug,
      arkivListingKey: m.arkivListingKey as string | undefined,
      arkivVersion: m.arkivVersion as number | undefined,
      arkivStatus: m.arkivStatus as string | undefined,
      cid: m.cid as string | undefined,
      ipId: m.ipId as string | undefined,
      vaultUuid: m.vaultUuid as number | undefined,
      publishedAt: m.publishedAt as string | undefined,
    };
  } catch {
    return null;
  }
}
