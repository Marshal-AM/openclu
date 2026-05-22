/**
 * Normalize user/LLM skill references to Arkiv catalog slugs (e.g. "abc skill" → "abc").
 */

/** Extract a likely catalog slug from a natural-language query. */
export function extractSkillSlugFromQuery(query: string): string | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;

  // "purchase the abc skill" / "buy abc skill"
  const skillSuffix = q.match(/\b([a-z0-9][a-z0-9_-]{0,62})\s+skill\b/);
  if (skillSuffix) return skillSuffix[1];

  // "purchase abc" / "get the abc"
  const afterVerb = q.match(
    /\b(?:purchase|buy|get|add|install|acquire|find)\s+(?:the\s+)?([a-z0-9][a-z0-9_-]{0,62})\b/,
  );
  if (afterVerb) return afterVerb[1];

  // Whole string is a slug
  if (/^[a-z0-9][a-z0-9_-]{0,62}$/.test(q)) return q;

  return undefined;
}

/** True when the user wants to find/get/buy a skill (not just browse). */
export function userWantsSkillAcquisition(text: string): boolean {
  const q = text.trim().toLowerCase();
  if (!q) return false;
  if (
    /\b(purchase|buy|get|add|install|acquire|attach|obtain|import|download)\b/.test(q)
  ) {
    return true;
  }
  if (/\b(look\s+for|find|search\s+for|fetch|locate)\b/.test(q)) {
    return true;
  }
  if (/\b(use|need|want)\s+(the\s+)?[a-z0-9]/.test(q)) {
    return true;
  }
  return false;
}

/** Map display phrases to catalog slug (never use "foo skill" as slug). */
export function normalizeSkillSlug(skillName: string): string {
  let s = skillName.trim();
  const lower = s.toLowerCase();
  if (lower.endsWith(' skill')) {
    s = s.slice(0, -' skill'.length).trim();
  }
  return s;
}
