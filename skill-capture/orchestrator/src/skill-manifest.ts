import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SKILL_CAPTURE_ROOT } from "../../lib/spawn-util.js";

export type PublishResult = {
  skillSlug: string;
  skillName: string;
  catalogListingId?: string;
  catalogVersion?: number;
  catalogStatus?: string;
  cid?: string;
  ipId?: string;
  vaultUuid?: number;
  publishedAt?: string;
};

export function readPublishResult(skillSlug: string): PublishResult | null {
  const manifestPath = resolve(SKILL_CAPTURE_ROOT, "skills", skillSlug, "cdr-manifest.json");
  if (!existsSync(manifestPath)) return null;
  try {
    const m = JSON.parse(readFileSync(manifestPath, "utf-8")) as Record<string, unknown>;
    return {
      skillSlug,
      skillName: (m.skillName as string) ?? skillSlug,
      catalogListingId: m.catalogListingId as string | undefined,
      catalogVersion: m.catalogVersion as number | undefined,
      catalogStatus: m.catalogStatus as string | undefined,
      cid: m.cid as string | undefined,
      ipId: m.ipId as string | undefined,
      vaultUuid: m.vaultUuid as number | undefined,
      publishedAt: m.publishedAt as string | undefined,
    };
  } catch {
    return null;
  }
}

export function listDeviceSkills(): PublishResult[] {
  const skillsDir = resolve(SKILL_CAPTURE_ROOT, "skills");
  if (!existsSync(skillsDir)) return [];
  const out: PublishResult[] = [];
  for (const ent of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!ent.isDirectory() || ent.name === "purchased") continue;
    const slug = ent.name;
    const manifest = readPublishResult(slug);
    if (manifest) {
      out.push(manifest);
      continue;
    }
    const hasDraft = existsSync(resolve(skillsDir, slug, "SKILL.md"));
    if (hasDraft) {
      out.push({ skillSlug: slug, skillName: slug });
    }
  }
  return out;
}
