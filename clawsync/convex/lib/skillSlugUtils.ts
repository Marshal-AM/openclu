/**
 * Helpers for marketplace tools — slug extraction only (not purchase routing).
 * Marketplace tools also include attach_existing_skill and detach_attached_skill.
 */

const SLUG_STOP_WORDS = new Set(['a', 'an', 'the', 'for', 'skill', 'called', 'named']);

function slugFromMatch(m: RegExpMatchArray | null): string | undefined {
  const token = m?.[1]?.trim().toLowerCase();
  if (!token || SLUG_STOP_WORDS.has(token)) return undefined;
  return token;
}

/** Extract a likely catalog slug from a natural-language query. */
export function extractSkillSlugFromQuery(query: string): string | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;

  // "purchase the abc skill" / "buy abc skill"
  const skillSuffix = q.match(/\b([a-z0-9][a-z0-9_-]{0,62})\s+skill\b/);
  const fromSuffix = slugFromMatch(skillSuffix);
  if (fromSuffix) return fromSuffix;

  // "skill called joker" / "named joker" (before generic "search for …")
  const called = q.match(/\b(?:skill\s+)?(?:called|named)\s+([a-z0-9][a-z0-9_-]{0,62})\b/);
  const fromCalled = slugFromMatch(called);
  if (fromCalled) return fromCalled;

  // "search for a skill called joker" (typo serach supported)
  const searchSkill = q.match(
    /\b(?:search|serach)(?:\s+for)?\s+(?:a\s+)?skill\s+(?:called|named)\s+([a-z0-9][a-z0-9_-]{0,62})\b/,
  );
  const fromSearchSkill = slugFromMatch(searchSkill);
  if (fromSearchSkill) return fromSearchSkill;

  // "purchase abc" / "find rocking" / "search for rocking"
  const afterVerb = q.match(
    /\b(?:purchase|buy|get|add|install|acquire|find|search(?:\s+for)?|serach(?:\s+for)?)\s+(?:the\s+)?([a-z0-9][a-z0-9_-]{0,62})\b/,
  );
  const fromVerb = slugFromMatch(afterVerb);
  if (fromVerb) return fromVerb;

  // Whole string is a slug
  if (/^[a-z0-9][a-z0-9_-]{0,62}$/.test(q)) return q;

  return undefined;
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
