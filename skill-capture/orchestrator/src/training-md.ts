import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SKILL_CAPTURE_ROOT } from "../../db/src/lib/device-wallet.js";
import { parseSkillFrontmatter } from "../../db/src/lib/skill-md.js";
import { readTrainingPublishResult } from "./training-manifest.js";

export interface TrainingMetadataInput {
  skillSlug: string;
  title: string;
  description: string;
  triggers: string[];
  extraTags?: string[];
  expertiseSource?: string;
  recordedAt?: string;
}

export function buildTrainingMd(input: TrainingMetadataInput): string {
  const name = input.title.toLowerCase().replace(/\s+/g, "-") || input.skillSlug;
  const triggersYaml = input.triggers.map((t) => `  - "${t.replace(/"/g, '\\"')}"`).join("\n");
  const lines = [
    "---",
    `name: ${name}`,
    `description: "${input.description.replace(/"/g, '\\"')}"`,
    "content_kind: trainingData",
    "triggers:",
    triggersYaml || '  - "general"',
  ];
  if (input.expertiseSource) lines.push(`expertise_source: "${input.expertiseSource}"`);
  if (input.recordedAt) lines.push(`recorded_at: "${input.recordedAt}"`);
  lines.push("---", "", `# ${input.title}`, "", input.description, "");
  return lines.join("\n");
}

export function writeDraftTrainingMd(input: TrainingMetadataInput): string {
  const bundleDir = resolve(SKILL_CAPTURE_ROOT, "training-data", input.skillSlug);
  mkdirSync(bundleDir, { recursive: true });
  const path = resolve(bundleDir, "TRAINING.md");
  writeFileSync(path, buildTrainingMd(input), "utf-8");
  return path;
}

export function readDraftTraining(slug: string): {
  skillSlug: string;
  title: string;
  description: string;
  triggers: string[];
  expertiseSource?: string;
  recordedAt?: string;
  catalogListingId?: string;
  catalogVersion?: number;
  catalogStatus?: string;
} | null {
  const trainingMdPath = resolve(SKILL_CAPTURE_ROOT, "training-data", slug, "TRAINING.md");
  if (!existsSync(trainingMdPath)) return null;

  const content = readFileSync(trainingMdPath, "utf-8");
  const fm = parseSkillFrontmatter(content);
  const title =
    fm.name?.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? slug;
  const manifest = readTrainingPublishResult(slug);

  return {
    skillSlug: slug,
    title,
    description: fm.description ?? "",
    triggers: fm.triggers.length ? fm.triggers : ["general"],
    expertiseSource: fm.expertiseSource,
    recordedAt: fm.recordedAt,
    catalogListingId: manifest?.catalogListingId,
    catalogVersion: manifest?.catalogVersion,
    catalogStatus: manifest?.catalogStatus,
  };
}
