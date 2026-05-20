import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SKILL_CAPTURE_ROOT } from "../../arkiv/src/lib/device-wallet.js";

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
