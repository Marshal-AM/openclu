/**
 * Client-side summaries of marketplace tool JSON (keep in sync with convex/lib/marketplaceToolMessages.ts).
 */

export function summarizeMarketplaceToolCall(
  toolName: string,
  result: string,
): string | undefined {
  if (!result?.trim()) return undefined;
  try {
    const p = JSON.parse(result) as Record<string, unknown>;
    if (typeof p.assistantMessage === 'string' && p.assistantMessage.trim()) {
      return p.assistantMessage.trim();
    }
    if (typeof p.hint === 'string' && p.hint.trim()) {
      return p.hint.trim();
    }
    if (typeof p.summary === 'string' && toolName === 'list_attached_skills') {
      return p.summary.trim();
    }
    if (toolName === 'search_catalog_skills') {
      return summarizeSearchJson(p);
    }
    if (toolName === 'purchase_and_attach_skill') {
      return summarizePurchaseJson(p);
    }
    if (toolName === 'attach_existing_skill' || toolName === 'detach_attached_skill') {
      if (p.error && !p.assistantMessage) return String(p.error);
      if (typeof p.assistantMessage === 'string') return p.assistantMessage.trim();
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function summarizeSearchJson(p: Record<string, unknown>): string | undefined {
  const matchCount = p.matchCount as number | undefined;
  const matches = p.matches as Array<{ skillName: string; title?: string }> | undefined;
  const resolvedSlug = p.resolvedSlug as string | null | undefined;
  if (p.slugNotInCatalog && resolvedSlug) {
    if (typeof p.hint === 'string' && p.hint.trim()) return p.hint.trim();
    const names = matches
      ?.slice(0, 5)
      .map((m) => m.skillName)
      .join(', ');
    return names
      ? `There is no Catalog listing named "${resolvedSlug}". Similar names: ${names}.`
      : `There is no Catalog listing named "${resolvedSlug}" on the marketplace.`;
  }
  if (matchCount === 0) {
    return resolvedSlug
      ? `No Catalog listing found for "${resolvedSlug}".`
      : 'No marketplace skills matched that query.';
  }
  if (matches?.length) {
    const top = matches[0];
    return `Found ${matchCount ?? matches.length} skill(s); top match: "${top.title ?? top.skillName}".`;
  }
  return undefined;
}

function summarizePurchaseJson(p: Record<string, unknown>): string | undefined {
  if (p.error) return `Purchase failed: ${String(p.error)}`;
  if (p.alreadyAttached) {
    return `Skill "${p.title ?? p.normalizedSlug ?? 'skill'}" is already attached.`;
  }
  if (p.purchasing) {
    return `Purchasing "${p.title ?? p.normalizedSlug ?? 'skill'}" — see the card below.`;
  }
  if (p.success) {
    return `Acquired and attached "${p.title ?? p.normalizedSlug ?? 'skill'}".`;
  }
  return undefined;
}

export function summarizeFromToolCalls(
  toolCalls: Array<{ name: string; result: string }>,
): string | undefined {
  const parts: string[] = [];
  for (const tc of toolCalls) {
    const line = summarizeMarketplaceToolCall(tc.name, tc.result);
    if (line) parts.push(line);
  }
  return parts.length ? parts.join('\n\n') : undefined;
}
