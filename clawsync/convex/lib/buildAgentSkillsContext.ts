/**
 * Build system-prompt blocks from attached marketplace skills (SKILL.md in registry).
 */

const MAX_KNOWLEDGE_PER_SKILL = Number(process.env.AGENT_SKILL_KNOWLEDGE_MAX_CHARS ?? '24000');
const MAX_TOTAL_KNOWLEDGE = Number(process.env.AGENT_SKILLS_CONTEXT_MAX_CHARS ?? '48000');

export type SkillContextEntry = {
  name: string;
  description: string;
  enabled: boolean;
  knowledge: string | null;
};

export function knowledgeFromSkillConfig(
  skillType: string,
  templateId: string | undefined,
  configJson: string | undefined,
): string | null {
  if (skillType !== 'template' || templateId !== 'knowledge-lookup') {
    return null;
  }
  if (!configJson?.trim()) return null;
  try {
    const config = JSON.parse(configJson) as { knowledge?: string };
    const k = config.knowledge?.trim();
    return k || null;
  } catch {
    return null;
  }
}

function truncateKnowledge(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n...[skill content truncated for context limit]`;
}

/**
 * Full SKILL.md bodies for enabled attached skills, under a `## Skill` heading per skill.
 */
export function buildSkillsKnowledgeBlock(entries: SkillContextEntry[]): string {
  const enabled = entries.filter((e) => e.enabled && e.knowledge);
  if (!enabled.length) return '';

  const parts: string[] = [
    '## Skill',
    '',
    'The following is the full reference content from skills attached to you. When the user asks about these topics, answer from this content in your own words (lists, examples, and specifics). Do not call a skill tool for questions this section already covers.',
    '',
  ];

  let budget = MAX_TOTAL_KNOWLEDGE;
  for (const skill of enabled) {
    const perSkill = Math.min(MAX_KNOWLEDGE_PER_SKILL, budget);
    if (perSkill < 500) break;
    const body = truncateKnowledge(skill.knowledge!, perSkill);
    budget -= body.length;
    parts.push(`### ${skill.name}`);
    if (skill.description.trim()) {
      parts.push(`_${skill.description.trim()}_`, '');
    }
    parts.push(body, '');
  }

  return parts.join('\n').trim();
}

export function buildSkillsSummaryList(entries: SkillContextEntry[]): string {
  if (!entries.length) {
    return '(none — you have no marketplace skills attached yet)';
  }
  return entries
    .map(
      (s) =>
        `- ${s.name} (${s.enabled ? 'enabled' : 'disabled'}): ${s.description.slice(0, 160)}`,
    )
    .join('\n');
}
