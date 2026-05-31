import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SKILL_CAPTURE_ROOT } from "../../db/src/lib/device-wallet.js";
import { parseSkillFrontmatter } from "../../db/src/lib/skill-md.js";
import { readPublishResult } from "./skill-manifest.js";

export interface SkillMetadataInput {
  skillSlug: string;
  title: string;
  description: string;
  triggers: string[];
  extraTags?: string[];
  expertiseSource?: string;
  recordedAt?: string;
}

export function buildSkillMd(input: SkillMetadataInput): string {
  const name = input.title.toLowerCase().replace(/\s+/g, "-") || input.skillSlug;
  const triggersYaml = input.triggers.map((t) => `  - "${t.replace(/"/g, '\\"')}"`).join("\n");
  const extraYaml = (input.extraTags ?? [])
    .map((t) => `  - "${t.replace(/"/g, '\\"')}"`)
    .join("\n");
  const lines = [
    "---",
    `name: ${name}`,
    `description: "${input.description.replace(/"/g, '\\"')}"`,
    "triggers:",
    triggersYaml || '  - "general"',
  ];
  if (input.extraTags?.length) {
    lines.push("extra_tags:", extraYaml);
  }
  if (input.expertiseSource) lines.push(`expertise_source: "${input.expertiseSource}"`);
  if (input.recordedAt) lines.push(`recorded_at: "${input.recordedAt}"`);
  lines.push("---", "", `# ${input.title}`, "", input.description, "");
  return lines.join("\n");
}

export function writeDraftSkillMd(input: SkillMetadataInput): string {
  const bundleDir = resolve(SKILL_CAPTURE_ROOT, "skills", input.skillSlug);
  mkdirSync(bundleDir, { recursive: true });
  const path = resolve(bundleDir, "SKILL.md");
  writeFileSync(path, buildSkillMd(input), "utf-8");
  return path;
}

export function readDraftSkill(slug: string): {
  skillSlug: string;
  title: string;
  description: string;
  triggers: string[];
  extraTags: string[];
  expertiseSource?: string;
  recordedAt?: string;
  catalogListingId?: string;
  catalogVersion?: number;
  catalogStatus?: string;
} | null {
  const skillMdPath = resolve(SKILL_CAPTURE_ROOT, "skills", slug, "SKILL.md");
  if (!existsSync(skillMdPath)) return null;

  const content = readFileSync(skillMdPath, "utf-8");
  const fm = parseSkillFrontmatter(content);
  const title =
    fm.name?.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? slug;
  const manifest = readPublishResult(slug);

  return {
    skillSlug: slug,
    title,
    description: fm.description ?? "",
    triggers: fm.triggers.length ? fm.triggers : ["general"],
    extraTags: fm.extraTags ?? [],
    expertiseSource: fm.expertiseSource,
    recordedAt: fm.recordedAt,
    catalogListingId: manifest?.catalogListingId,
    catalogVersion: manifest?.catalogVersion,
    catalogStatus: manifest?.catalogStatus,
  };
}
