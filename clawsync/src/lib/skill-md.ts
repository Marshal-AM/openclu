/** Remove YAML frontmatter from SKILL.md before markdown preview. */
export function stripSkillFrontmatter(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return trimmed;

  const fenced = trimmed.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (fenced) {
    return trimmed.slice(fenced[0].length).trim();
  }

  return trimmed;
}

/** Frontmatter plus any boilerplate before the first Overview heading. */
export function stripSkillPreviewContent(content: string): string {
  let body = stripSkillFrontmatter(content);
  const overview = body.match(/(^|\n)(#+\s+Overview\b[^\n]*)/i);
  if (overview && overview.index != null) {
    const start = overview.index + (overview[1] === '\n' ? 1 : 0);
    body = body.slice(start);
  }
  return body.trim();
}
