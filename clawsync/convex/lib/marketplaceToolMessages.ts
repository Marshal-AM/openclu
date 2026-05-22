/**
 * Human-readable summaries from marketplace tool JSON (when the model returns empty text).
 */

export function summarizeSearchToolResult(result: string): string | undefined {
  if (!result?.trim()) return undefined;
  try {
    const p = JSON.parse(result) as {
      assistantMessage?: string;
      hint?: string;
      matchCount?: number;
      matches?: Array<{ skillName: string; title?: string }>;
      resolvedSlug?: string | null;
      exactSlugMatch?: boolean;
      slugNotOnArkiv?: boolean;
      purchaseError?: string;
      alreadyAttached?: boolean;
      pickedSkillName?: string;
    };
    if (p.assistantMessage) return p.assistantMessage;
    if (p.hint) return p.hint;
    if (p.alreadyAttached && p.matches?.[0]) {
      return `Skill "${p.matches[0].title ?? p.matches[0].skillName}" is already attached to this agent.`;
    }
    if (p.purchaseError) return `Could not complete marketplace action: ${p.purchaseError}`;
    if (p.matchCount === 0) {
      return p.resolvedSlug
        ? `No Arkiv listing found for "${p.resolvedSlug}".`
        : 'No marketplace skills matched that query.';
    }
    if (p.matches?.length) {
      const top = p.matches[0];
      return `Found "${top.title ?? top.skillName}" on Arkiv (${p.matchCount} match${p.matchCount === 1 ? '' : 'es'}).`;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

export function summarizePurchaseToolResult(result: string): string | undefined {
  if (!result?.trim()) return undefined;
  try {
    const p = JSON.parse(result) as {
      success?: boolean;
      title?: string;
      alreadyAttached?: boolean;
      purchasing?: boolean;
      error?: string;
      normalizedSlug?: string;
    };
    if (p.error) return `Purchase failed: ${p.error}`;
    if (p.alreadyAttached) {
      return `Skill "${p.title ?? p.normalizedSlug ?? 'skill'}" is already attached to this agent.`;
    }
    if (p.purchasing) {
      return `Purchasing "${p.title ?? p.normalizedSlug ?? 'skill'}" in the background — see the card below.`;
    }
    if (p.success) {
      return `Acquired and attached "${p.title ?? p.normalizedSlug ?? 'skill'}".`;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

export function summarizeAttachDetachToolResult(result: string): string | undefined {
  if (!result?.trim()) return undefined;
  try {
    const p = JSON.parse(result) as {
      assistantMessage?: string;
      success?: boolean;
      error?: string;
      skillName?: string;
    };
    if (p.assistantMessage) return p.assistantMessage;
    if (p.error) return String(p.error);
    if (p.success && p.skillName) {
      return `Updated skill assignment for "${p.skillName}".`;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

export function synthesizeReplyFromToolSteps(
  steps: unknown,
): string | undefined {
  if (!Array.isArray(steps)) return undefined;
  const parts: string[] = [];
  for (const step of steps) {
    if (!step || typeof step !== 'object') continue;
    const s = step as {
      toolCalls?: Array<{ toolName?: string; name?: string }>;
      toolResults?: Array<{ toolCallId?: string; result?: unknown }>;
    };
    if (!Array.isArray(s.toolCalls)) continue;
    for (const tc of s.toolCalls) {
      const name = tc.toolName ?? tc.name ?? '';
      const tr = s.toolResults?.find(
        (r) => r.toolCallId === (tc as { toolCallId?: string }).toolCallId,
      );
      const raw =
        tr?.result == null
          ? ''
          : typeof tr.result === 'string'
            ? tr.result
            : JSON.stringify(tr.result);
      if (name === 'search_arkiv_skills') {
        const line = summarizeSearchToolResult(raw);
        if (line) parts.push(line);
      } else if (name === 'purchase_and_attach_skill') {
        const line = summarizePurchaseToolResult(raw);
        if (line) parts.push(line);
      } else if (name === 'list_attached_skills') {
        try {
          const p = JSON.parse(raw) as { summary?: string };
          if (p.summary) parts.push(p.summary);
        } catch {
          /* ignore */
        }
      } else if (name === 'attach_existing_skill' || name === 'detach_attached_skill') {
        const line = summarizeAttachDetachToolResult(raw);
        if (line) parts.push(line);
      }
    }
  }
  return parts.length ? parts.join(' ') : undefined;
}
