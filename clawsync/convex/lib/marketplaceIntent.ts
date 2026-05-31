import { extractSkillSlugFromQuery } from './skillSlugUtils';

export type MarketplaceIntent = 'search' | 'list' | 'purchase' | 'attach' | 'detach';

/** Detect marketplace actions from the user message (server-side routing). */
export function detectMarketplaceIntent(message: string): MarketplaceIntent | null {
  const q = message.trim().toLowerCase();
  if (!q) return null;

  if (
    /\b(what skills|which skills|skills do you have|skills you have|attached skills|your capabilities|what can you do|list (?:my |your )?skills)\b/.test(
      q,
    )
  ) {
    return 'list';
  }

  if (
    /\b(remove|detach|unassign|delete)\b/.test(q) &&
    (/\bskill\b/.test(q) || extractSkillSlugFromQuery(message))
  ) {
    return 'detach';
  }

  if (
    /\b(add|attach|enable|use)\b/.test(q) &&
    (/\bskill\b/.test(q) || extractSkillSlugFromQuery(message)) &&
    !/\b(buy|purchase|catalog|marketplace)\b/.test(q)
  ) {
    return 'attach';
  }

  if (
    /\b(buy|purchase|acquire)\b/.test(q) &&
    (/\bskill\b/.test(q) || extractSkillSlugFromQuery(message))
  ) {
    return 'purchase';
  }

  if (
    /\b(get|install)\b/.test(q) &&
    /\b(from\s+)?(catalog|marketplace)\b/.test(q) &&
    (/\bskill\b/.test(q) || extractSkillSlugFromQuery(message))
  ) {
    return 'purchase';
  }

  if (
    /\b(search|serach|find|look for)\b/.test(q) &&
    /\b(skill|catalog|marketplace)\b/.test(q)
  ) {
    return 'search';
  }

  if (/\b(?:skill\s+)?(?:called|named)\s+[a-z0-9]/.test(q)) {
    return 'search';
  }

  if (extractSkillSlugFromQuery(message)) {
    return 'search';
  }

  return null;
}
