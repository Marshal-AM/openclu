export interface SkillFrontmatter {
  name?: string;
  description?: string;
  triggers: string[];
  expertiseSource?: string;
  recordedAt?: string;
  tagCursor?: boolean;
  extraTags?: string[];
}

export function parseSkillFrontmatter(content: string): SkillFrontmatter {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return { triggers: [] };
  }
  const block = match[1];
  const triggers: string[] = [];
  let name: string | undefined;
  let description: string | undefined;
  let expertiseSource: string | undefined;
  let recordedAt: string | undefined;
  let tagCursor: boolean | undefined;
  const extraTags: string[] = [];
  let inTriggers = false;
  let inExtraTags = false;

  for (const line of block.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("triggers:")) {
      inTriggers = true;
      inExtraTags = false;
      continue;
    }
    if (trimmed.startsWith("extra_tags:")) {
      inExtraTags = true;
      inTriggers = false;
      continue;
    }
    if (inExtraTags) {
      const item = trimmed.match(/^-\s*["']?(.+?)["']?\s*$/);
      if (item) {
        extraTags.push(item[1]);
        continue;
      }
      if (trimmed && !trimmed.startsWith("-")) inExtraTags = false;
    }
    if (inTriggers) {
      const item = trimmed.match(/^-\s*["']?(.+?)["']?\s*$/);
      if (item) {
        triggers.push(item[1]);
        continue;
      }
      if (trimmed && !trimmed.startsWith("-")) inTriggers = false;
    }
    const kv = trimmed.match(/^(\w[\w_]*):\s*(.+)$/);
    if (!kv) continue;
    const key = kv[1];
    const val = kv[2].replace(/^["']|["']$/g, "");
    if (key === "name") name = val;
    else if (key === "description") description = val;
    else if (key === "expertise_source") expertiseSource = val;
    else if (key === "recorded_at") recordedAt = val;
    else if (key === "tag_cursor") tagCursor = val === "true" || val === "1";
  }

  return { name, description, triggers, expertiseSource, recordedAt, tagCursor, extraTags };
}

/** Normalize trigger phrases into searchable tag tokens. */
export function deriveTags(skillName: string, triggers: string[], description: string): string[] {
  const raw = new Set<string>();
  raw.add(skillName.toLowerCase());
  for (const part of skillName.split(/[-_]/)) {
    if (part.length > 2) raw.add(part.toLowerCase());
  }
  for (const t of triggers) {
    for (const word of t.toLowerCase().split(/[^a-z0-9]+/)) {
      if (word.length > 2) raw.add(word);
    }
  }
  if (description.toLowerCase().includes("cursor")) raw.add("cursor");
  if (skillName.toLowerCase().includes("cursor")) raw.add("cursor");
  return [...raw].slice(0, 24);
}

export function buildSearchText(
  skillName: string,
  title: string,
  description: string,
  triggers: string[],
  tags: string[],
): string {
  return [skillName, title, description, ...triggers, ...tags]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
