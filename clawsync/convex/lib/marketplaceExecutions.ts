'use node';

import type { ActionCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { api, internal } from '../_generated/api';
import { runMarketplaceCli } from './marketplaceCli';
import type { CatalogMatch } from './chatSkillPurchase';
import { extractSkillSlugFromQuery, normalizeSkillSlug } from './skillSlugUtils';
import { logChatSkill } from './chatSkillLog';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chatSkillInternal = (internal as any).chatSkillInternal;

export type MarketplaceExecutionContext = {
  agentId: Id<'agents'>;
  threadId: string;
  userMessage?: string;
};

export async function executeSearchArkivSkills(
  ctx: ActionCtx,
  context: MarketplaceExecutionContext,
  params: { query: string; skillSlug?: string; limit?: number },
): Promise<string> {
  const { agentId, threadId } = context;
  const { query, skillSlug, limit } = params;
  const cap = Math.min(limit ?? 8, 12);
  const slug =
    (skillSlug ? normalizeSkillSlug(skillSlug) : undefined) ??
    extractSkillSlugFromQuery(query) ??
    (context.userMessage ? extractSkillSlugFromQuery(context.userMessage) : undefined);

  logChatSkill('search_start', {
    threadId,
    agentId,
    query: query.trim(),
    skillSlugArg: skillSlug ?? null,
    resolvedSlug: slug ?? null,
  });

  let raw: CatalogMatch[] = [];
  let searchMode: 'exact_slug' | 'natural_language' | 'exact_then_nl' = 'natural_language';
  let slugListingExists = false;
  let slugNotOnArkiv = false;

  if (slug) {
    searchMode = 'exact_slug';
    const exact = (await runMarketplaceCli('query', {
      skillSlug: slug,
      scope: 'marketplace',
      full: true,
      minScore: 0,
    })) as { matches?: CatalogMatch[] };
    raw = exact.matches ?? [];
    logChatSkill('search_exact_slug', {
      slug,
      matchCount: raw.length,
      found: raw.map((m) => m.skillName),
    });
  }

  if (raw.length === 0) {
    searchMode = slug ? 'exact_then_nl' : 'natural_language';
    const searchQuery = slug ? slug : query.trim();
    const data = (await runMarketplaceCli('query', {
      query: searchQuery,
      scope: 'marketplace',
      full: true,
      minScore: 0,
    })) as { matches?: CatalogMatch[]; matchCount?: number };
    raw = data.matches ?? [];
    logChatSkill('search_natural_language', {
      searchQuery,
      matchCount: data.matchCount ?? raw.length,
      topSlugs: raw.slice(0, 8).map((m) => ({
        skillName: m.skillName,
        score: m.score,
      })),
    });
    if (slug) {
      const hit = raw.find(
        (m) => m.skillName === slug || normalizeSkillSlug(m.skillName) === slug,
      );
      if (hit) {
        raw = [hit, ...raw.filter((m) => m.skillName !== hit.skillName)];
        logChatSkill('search_slug_promoted', { slug, title: hit.title });
      } else {
        try {
          await runMarketplaceCli('get-detail', slug);
          slugListingExists = true;
          logChatSkill('search_slug_exists_via_detail', {
            slug,
            note: 'Listing exists on Arkiv but did not rank in NL search; purchase may still work.',
          });
        } catch (detailErr) {
          slugNotOnArkiv = true;
          logChatSkill('search_slug_not_on_arkiv', {
            slug,
            error: detailErr instanceof Error ? detailErr.message : String(detailErr),
          });
        }
      }
    }
  }

  const matches = raw.slice(0, cap).map((m) => ({
    skillName: m.skillName,
    title: m.title,
    description: m.description?.slice(0, 200),
    score: m.score,
    listingKey: m.listingKey ?? m.entityKey,
    entityKey: m.entityKey ?? m.listingKey,
    payload: m.payload,
  }));

  const searchId = await ctx.runMutation(chatSkillInternal.insertSearchSnapshot, {
    threadId,
    agentId,
    query: slug ? `${query.trim()} [slug:${slug}]` : query.trim(),
    matchesJson: JSON.stringify(matches),
  });

  logChatSkill('search_done', {
    searchId,
    searchMode,
    resolvedSlug: slug ?? null,
    matchCount: matches.length,
    topMatches: matches.map((m) => ({
      skillName: m.skillName,
      score: m.score,
      title: m.title,
    })),
  });

  const exactMatch = slug
    ? matches.find(
        (m) => m.skillName === slug || normalizeSkillSlug(m.skillName) === slug,
      )
    : undefined;

  let hint: string;
  if (slug && slugNotOnArkiv && !exactMatch) {
    const names = matches
      .slice(0, 5)
      .map((m) => m.skillName)
      .join(', ');
    hint = names.length
      ? `There is no Arkiv listing named "${slug}". Similar names on the catalog: ${names}.`
      : `There is no Arkiv listing named "${slug}" on the marketplace.`;
  } else if (slug && slugListingExists && !exactMatch) {
    hint = `Listing "${slug}" exists on Arkiv but was not in search results — you can still call purchase_and_attach_skill with skillName "${slug}" and searchId.`;
  } else if (matches.length === 0) {
    hint = 'No Arkiv listings matched. Try a different skillSlug or query.';
  } else if (exactMatch) {
    hint = `Found "${exactMatch.title ?? exactMatch.skillName}". To acquire it, call purchase_and_attach_skill with skillName, listingKey, and searchId.`;
  } else {
    const top = matches[0];
    hint = `No exact match for "${slug ?? query.trim()}". Closest: "${top.title ?? top.skillName}" (${matches.length} results). Call purchase_and_attach_skill only if the user wants that skill.`;
  }

  return JSON.stringify({
    searchId,
    resolvedSlug: slug ?? null,
    searchMode,
    matchCount: matches.length,
    exactSlugMatch: Boolean(exactMatch),
    slugNotOnArkiv: slug ? slugNotOnArkiv : undefined,
    matches: matches.map(({ payload: _p, ...rest }) => rest),
    hint,
    assistantMessage: hint,
  });
}

export async function executeListAttachedSkills(
  ctx: ActionCtx,
  context: MarketplaceExecutionContext,
): Promise<string> {
  const { agentId } = context;
  const skills: Array<{
    name: string;
    description: string;
    enabled: boolean;
  }> = await ctx.runQuery(internal.agentAssignments.getAgentSkillsSummary, {
    agentId,
  });
  const lines =
    skills.length === 0
      ? ['You have no marketplace skills attached yet.']
      : skills.map(
          (s) =>
            `• ${s.name} (${s.enabled ? 'enabled' : 'disabled'}): ${s.description.slice(0, 200)}`,
        );
  const summary =
    skills.length === 0
      ? 'I do not have any marketplace skills attached yet. I can search Arkiv and purchase skills when you ask.'
      : `I have ${skills.length} marketplace skill(s) attached:\n${lines.join('\n')}`;
  return JSON.stringify({
    count: skills.length,
    skills,
    summary,
    assistantMessage: summary,
  });
}

async function resolveRegistrySkill(
  ctx: ActionCtx,
  skillName: string,
  skillRegistryId?: string,
): Promise<
  | { ok: true; skill: { _id: Id<'skillRegistry'>; name: string; description: string } }
  | { ok: false; error: string; availableNames?: string[] }
> {
  if (skillRegistryId) {
    const skill = await ctx.runQuery(api.skillRegistry.get, {
      id: skillRegistryId as Id<'skillRegistry'>,
    });
    if (!skill) {
      return { ok: false, error: `No skill found with id "${skillRegistryId}".` };
    }
    if (skill.status !== 'active' || !skill.approved) {
      return {
        ok: false,
        error: `Skill "${skill.name}" exists but is not active/approved in the registry.`,
      };
    }
    return {
      ok: true,
      skill: { _id: skill._id, name: skill.name, description: skill.description },
    };
  }

  const slug = normalizeSkillSlug(skillName);
  const byName = await ctx.runQuery(api.skillRegistry.getByName, { name: slug });
  if (byName && byName.status === 'active' && byName.approved) {
    return {
      ok: true,
      skill: { _id: byName._id, name: byName.name, description: byName.description },
    };
  }

  const all = await ctx.runQuery(internal.skillRegistry.getActiveApproved, {});
  const match = all.find(
    (s: { name: string }) =>
      s.name === slug ||
      s.name === skillName ||
      normalizeSkillSlug(s.name) === slug,
  );
  if (match) {
    return {
      ok: true,
      skill: { _id: match._id, name: match.name, description: match.description },
    };
  }

  const available = all.map((s: { name: string }) => s.name).slice(0, 12);
  return {
    ok: false,
    error: `No active skill named "${slug}" in your registry. Use purchase_and_attach_skill for Arkiv skills not yet imported.`,
    availableNames: available,
  };
}

/** Attach an already-imported registry skill to this agent (no Arkiv purchase). */
export async function executeAttachExistingSkill(
  ctx: ActionCtx,
  context: MarketplaceExecutionContext,
  params: { skillName: string; skillRegistryId?: string },
): Promise<string> {
  const { agentId } = context;
  const resolved = await resolveRegistrySkill(
    ctx,
    params.skillName,
    params.skillRegistryId,
  );
  if (!resolved.ok) {
    const hint =
      resolved.availableNames?.length ?
        `Available registry skills: ${resolved.availableNames.join(', ')}.`
      : '';
    const assistantMessage = `${resolved.error}${hint ? ` ${hint}` : ''}`;
    return JSON.stringify({
      success: false,
      error: resolved.error,
      assistantMessage,
    });
  }

  const { skill } = resolved;
  const attachedIds: Id<'skillRegistry'>[] = await ctx.runQuery(
    internal.agentAssignments.getAgentSkillIds,
    { agentId },
  );
  if (attachedIds.includes(skill._id)) {
    const msg = `Skill "${skill.name}" is already attached to this agent.`;
    return JSON.stringify({
      success: true,
      alreadyAttached: true,
      skillName: skill.name,
      skillRegistryId: skill._id,
      assistantMessage: msg,
    });
  }

  await ctx.runMutation(api.agentAssignments.assignSkill, {
    agentId,
    skillId: skill._id,
  });

  logChatSkill('attach_existing', {
    agentId,
    skillName: skill.name,
    skillRegistryId: skill._id,
  });

  const msg = `Attached existing skill "${skill.name}" to this agent.`;
  return JSON.stringify({
    success: true,
    skillName: skill.name,
    skillRegistryId: skill._id,
    description: skill.description.slice(0, 200),
    assistantMessage: msg,
  });
}

/** Remove a skill assignment from this agent (does not delete registry or Arkiv listing). */
export async function executeDetachAttachedSkill(
  ctx: ActionCtx,
  context: MarketplaceExecutionContext,
  params: { skillName: string; skillRegistryId?: string },
): Promise<string> {
  const { agentId } = context;
  const slug = params.skillRegistryId ?
    undefined
  : normalizeSkillSlug(params.skillName);

  const attached: Array<{
    name: string;
    description: string;
    enabled: boolean;
    skillRegistryId: Id<'skillRegistry'>;
  }> = await ctx.runQuery(internal.agentAssignments.getAgentSkillsSummary, {
    agentId,
  });

  const match = attached.find(
    (s: { name: string; skillRegistryId: Id<'skillRegistry'> }) =>
      (params.skillRegistryId &&
        s.skillRegistryId === (params.skillRegistryId as Id<'skillRegistry'>)) ||
      (slug &&
        (s.name === slug ||
          s.name === params.skillName ||
          normalizeSkillSlug(s.name) === slug)),
  );

  if (!match) {
    const names = attached.map((s) => s.name);
    const assistantMessage =
      names.length > 0 ?
        `Skill "${params.skillName}" is not attached. Currently attached: ${names.join(', ')}.`
      : `Skill "${params.skillName}" is not attached — this agent has no skills assigned.`;
    return JSON.stringify({
      success: false,
      error: 'not_attached',
      attachedNames: names,
      assistantMessage,
    });
  }

  await ctx.runMutation(api.agentAssignments.removeSkill, {
    agentId,
    skillId: match.skillRegistryId,
  });

  logChatSkill('detach_skill', {
    agentId,
    skillName: match.name,
    skillRegistryId: match.skillRegistryId,
  });

  const msg = `Removed "${match.name}" from this agent. The skill remains in your registry.`;
  return JSON.stringify({
    success: true,
    skillName: match.name,
    skillRegistryId: match.skillRegistryId,
    assistantMessage: msg,
  });
}
