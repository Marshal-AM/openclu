export function stripSkillFrontmatter(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return trimmed;

  const fenced = trimmed.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (fenced) {
    return trimmed.slice(fenced[0].length).trim();
  }

  return trimmed;
}

export function stripSkillPreviewContent(content: string): string {
  let body = stripSkillFrontmatter(content);
  const overview = body.match(/(^|\n)(#+\s+Overview\b[^\n]*)/i);
  if (overview && overview.index != null) {
    const start = overview.index + (overview[1] === '\n' ? 1 : 0);
    body = body.slice(start);
  }
  return body.trim();
}

export function parseSkillMd(raw: string): { name: string; description: string; body: string } {
  const body = stripSkillFrontmatter(raw);
  let name = 'purchased-skill';
  let description = '';

  const trimmed = raw.trim();
  if (trimmed.startsWith('---')) {
    const end = trimmed.indexOf('---', 3);
    if (end >= 0) {
      const frontmatter = trimmed.slice(3, end).trim();
      for (const line of frontmatter.split('\n')) {
        const m = line.match(/^([a-zA-Z_-]+):\s*(.+)$/);
        if (!m) continue;
        const key = m[1].toLowerCase();
        const val = m[2].trim().replace(/^["']|["']$/g, '');
        if (key === 'name') name = val;
        if (key === 'description') description = val;
      }
    }
  }

  return { name, description: description || body.slice(0, 500), body: body || trimmed };
}
