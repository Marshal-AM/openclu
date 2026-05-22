'use node';

import { createTool } from '@convex-dev/agent';
import { jsonSchema } from 'ai';
import type { ActionCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';
import { runMarketplaceCli } from '../lib/marketplaceCli';
import { runPurchaseAndAttach, type CatalogMatch } from '../lib/chatSkillPurchase';
import {
  extractSkillSlugFromQuery,
  normalizeSkillSlug,
  userWantsSkillAcquisition,
} from '../lib/skillSlugUtils';
import { logChatSkill } from '../lib/chatSkillLog';
import type { ToolSet } from './toolLoader';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chatSkillInternal = (internal as any).chatSkillInternal;

export type MarketplaceToolContext = {
  agentId: Id<'agents'>;
  threadId: string;
  /** Original user message (for acquire-intent when the model passes a bare slug as query). */
  userMessage?: string;
};

export function loadMarketplaceTools(
  ctx: ActionCtx,
  context: MarketplaceToolContext,
): ToolSet {
  const { agentId, threadId, userMessage } = context;

  const searchSchema = jsonSchema<{ query: string; skillSlug?: string; limit?: number }>({
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description:
          'Keywords to search. When the user names a skill (e.g. "abc"), include that slug here or use skillSlug.',
      },
      skillSlug: {
        type: 'string',
        description:
          'Exact Arkiv catalog slug (e.g. "abc" not "abc skill"). Use when the user names a specific skill.',
      },
      limit: { type: 'number', description: 'Max results (default 8)' },
    },
    required: ['query'],
  });

  const purchaseSchema = jsonSchema<{
    skillName: string;
    listingKey?: string;
    searchId?: string;
    title?: string;
    description?: string;
  }>({
    type: 'object' as const,
    properties: {
      skillName: {
        type: 'string',
        description: 'Catalog slug from search results (e.g. "abc"), never "abc skill"',
      },
      listingKey: { type: 'string', description: 'Arkiv listing key from search results' },
      searchId: { type: 'string', description: 'Search snapshot id from search_arkiv_skills' },
      title: { type: 'string', description: 'Display title' },
      description: { type: 'string', description: 'Short description' },
    },
    required: ['skillName'],
  });

  return {
    search_arkiv_skills: createTool({
      description:
        'Search the Arkiv marketplace. Use skillSlug for a named skill (catalog slug only, e.g. "abc" not "abc skill"). Returns matches for purchase_and_attach_skill.',
      args: searchSchema,
      handler: async (
        _toolCtx,
        { query, skillSlug, limit }: { query: string; skillSlug?: string; limit?: number },
      ) => {
        const cap = Math.min(limit ?? 8, 12);
        const slug =
          (skillSlug ? normalizeSkillSlug(skillSlug) : undefined) ??
          extractSkillSlugFromQuery(query);

        logChatSkill('search_start', {
          threadId,
          agentId,
          query: query.trim(),
          skillSlugArg: skillSlug ?? null,
          resolvedSlug: slug ?? null,
        });

        let raw: CatalogMatch[] = [];
        let searchMode: 'exact_slug' | 'natural_language' | 'exact_then_nl' = 'natural_language';

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
              (m) =>
                m.skillName === slug ||
                normalizeSkillSlug(m.skillName) === slug,
            );
            if (hit) {
              raw = [hit, ...raw.filter((m) => m.skillName !== hit.skillName)];
              logChatSkill('search_slug_promoted', { slug, title: hit.title });
            } else {
              try {
                await runMarketplaceCli('get-detail', slug);
                logChatSkill('search_slug_exists_via_detail', {
                  slug,
                  note: 'Listing exists on Arkiv but did not rank in NL search; purchase may still work.',
                });
              } catch (detailErr) {
                logChatSkill('search_slug_not_on_arkiv', {
                  slug,
                  error:
                    detailErr instanceof Error ? detailErr.message : String(detailErr),
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

        const acquireIntent =
          userWantsSkillAcquisition(query) ||
          (userMessage ? userWantsSkillAcquisition(userMessage) : false) ||
          Boolean(skillSlug?.trim()) ||
          (Boolean(slug) && searchMode === 'exact_slug' && matches.length > 0);

        // In-chat marketplace search always acquires when we have a match
        const shouldAutoPurchase = matches.length > 0 && acquireIntent;

        logChatSkill('auto_purchase_decision', {
          shouldAutoPurchase,
          acquireIntent,
          query: query.trim(),
          userMessageSnippet: userMessage?.slice(0, 120) ?? null,
          skillSlugArg: skillSlug ?? null,
          resolvedSlug: slug ?? null,
          matchCount: matches.length,
        });

        let autoPurchase:
          | {
              purchaseEventId: string;
              success: boolean;
              title: string;
              error?: string;
              alreadyAttached?: boolean;
              purchasing?: boolean;
            }
          | undefined;
        let pickedSkillName: string | undefined;

        if (shouldAutoPurchase) {
          // Prefer exact slug; otherwise best NL match (e.g. "cursor" → cursor-usage)
          const exactPick = slug
            ? matches.find(
                (m) =>
                  m.skillName === slug || normalizeSkillSlug(m.skillName) === slug,
              )
            : undefined;
          const pick = exactPick ?? matches[0];
          pickedSkillName = pick.skillName;
          if (slug && !exactPick && pick) {
            logChatSkill('search_slug_fuzzy_pick', {
              requestedSlug: slug,
              pickedSkillName: pick.skillName,
            });
          }

          logChatSkill('auto_purchase_triggered', {
            reason: skillSlug?.trim()
              ? 'named_skill_slug'
              : slug && searchMode === 'exact_slug'
                ? 'exact_slug_match'
                : 'user_acquire_intent',
            query: query.trim(),
            userMessage: userMessage?.slice(0, 120) ?? null,
            skillName: pick.skillName,
            searchId,
          });

          const purchaseResult = await runPurchaseAndAttach(ctx, {
            agentId,
            threadId,
            skillName: pick.skillName,
            title: pick.title,
            description: pick.description ?? '',
            listingKey: pick.listingKey ?? pick.entityKey ?? pick.skillName,
            catalogSnapshot:
              pick.payload && (pick.entityKey ?? pick.listingKey)
                ? {
                    entityKey: pick.entityKey ?? pick.listingKey!,
                    payload: pick.payload,
                  }
                : undefined,
            searchId: searchId as Id<'skillSearchSnapshots'>,
          });

          autoPurchase = {
            purchaseEventId: purchaseResult.purchaseEventId,
            success: purchaseResult.success,
            title: purchaseResult.title,
            error: purchaseResult.error,
            alreadyAttached: purchaseResult.alreadyAttached,
            purchasing: purchaseResult.purchasing,
          };

          logChatSkill('auto_purchase_done', autoPurchase);
        } else if (matches.length === 0) {
          logChatSkill('auto_purchase_skipped', {
            reason: 'no_matches',
            query: query.trim(),
            userMessage: userMessage?.slice(0, 120) ?? null,
          });
        } else {
          logChatSkill('auto_purchase_skipped', {
            reason: 'no_acquire_intent',
            query: query.trim(),
            userMessage: userMessage?.slice(0, 120) ?? null,
          });
        }

        return JSON.stringify({
          searchId,
          resolvedSlug: slug ?? null,
          searchMode,
          matchCount: matches.length,
          matches: matches.map(({ payload: _p, ...rest }) => rest),
          autoPurchased: Boolean(autoPurchase?.success && !autoPurchase?.purchasing),
          purchaseInProgress: Boolean(autoPurchase?.purchasing),
          purchaseEventId: autoPurchase?.purchaseEventId,
          purchaseSuccess: autoPurchase?.success,
          purchaseError: autoPurchase?.error,
          alreadyAttached: autoPurchase?.alreadyAttached,
          pickedSkillName,
          hint:
            matches.length === 0
              ? 'No Arkiv listings matched. Try skillSlug or a clearer query.'
              : autoPurchase?.alreadyAttached
                ? `Skill "${autoPurchase.title}" is already attached to this agent.`
                : autoPurchase?.purchasing
                  ? `Purchasing "${autoPurchase.title ?? pickedSkillName ?? 'skill'}" in the background — watch the card below.`
                  : autoPurchase?.success
                    ? `Acquired "${autoPurchase.title}" and attached to this agent.`
                    : autoPurchase?.error
                      ? `Purchase failed: ${autoPurchase.error}`
                      : acquireIntent
                        ? undefined
                        : 'Call purchase_and_attach_skill after search when the user wants to acquire a skill.',
        });
      },
    }),

    purchase_and_attach_skill: createTool({
      description:
        'Purchase the chosen Arkiv skill, import it, and attach it to this agent. Call after search_arkiv_skills with the best matching skillName and listingKey.',
      args: purchaseSchema,
      handler: async (
        _toolCtx,
        {
          skillName,
          listingKey,
          searchId,
          title,
          description,
        }: {
          skillName: string;
          listingKey?: string;
          searchId?: string;
          title?: string;
          description?: string;
        },
      ) => {
        const normalizedSlug = normalizeSkillSlug(skillName);
        let resolvedTitle = title ?? normalizedSlug;
        let resolvedDesc = description ?? '';
        let resolvedListingKey = listingKey ?? normalizedSlug;
        let catalogSnapshot: { entityKey: string; payload: unknown } | undefined;
        let snapshotMatch = false;

        logChatSkill('purchase_start', {
          threadId,
          agentId,
          skillNameArg: skillName,
          normalizedSlug,
          searchId: searchId ?? null,
          listingKey: listingKey ?? null,
        });

        if (searchId) {
          const snap = await ctx.runQuery(chatSkillInternal.getSearchSnapshot, {
            searchId: searchId as Id<'skillSearchSnapshots'>,
          });
          if (snap?.matchesJson) {
            const matches = JSON.parse(snap.matchesJson) as CatalogMatch[];
            const m = matches.find(
              (x) =>
                x.skillName === normalizedSlug ||
                x.skillName === skillName ||
                normalizeSkillSlug(x.skillName) === normalizedSlug,
            );
            if (m) {
              snapshotMatch = true;
              resolvedTitle = m.title ?? resolvedTitle;
              resolvedDesc = m.description ?? resolvedDesc;
              resolvedListingKey = m.listingKey ?? m.entityKey ?? resolvedListingKey;
              if (m.payload && (m.entityKey ?? m.listingKey)) {
                catalogSnapshot = {
                  entityKey: m.entityKey ?? m.listingKey!,
                  payload: m.payload,
                };
              }
              logChatSkill('purchase_snapshot_hit', {
                normalizedSlug,
                title: m.title,
                entityKey: m.entityKey ?? m.listingKey,
              });
            } else {
              logChatSkill('purchase_snapshot_miss', {
                normalizedSlug,
                snapshotQuery: snap.query,
                availableSlugs: matches.map((x) => x.skillName),
              });
            }
          }
        } else {
          logChatSkill('purchase_no_searchId', {
            normalizedSlug,
            hint: 'Agent should call search_arkiv_skills before purchase_and_attach_skill',
          });
        }

        const result = await runPurchaseAndAttach(ctx, {
          agentId,
          threadId,
          skillName: normalizedSlug,
          title: resolvedTitle,
          description: resolvedDesc,
          listingKey: resolvedListingKey,
          catalogSnapshot,
          searchId: searchId as Id<'skillSearchSnapshots'> | undefined,
        });

        logChatSkill('purchase_done', {
          purchaseEventId: result.purchaseEventId,
          success: result.success,
          normalizedSlug,
          snapshotMatch,
          alreadyAttached: result.alreadyAttached ?? false,
          skillRegistryId: result.skillRegistryId ?? null,
          error: result.error ?? null,
        });

        return JSON.stringify({
          purchaseEventId: result.purchaseEventId,
          success: result.success,
          title: result.title,
          skillRegistryId: result.skillRegistryId,
          alreadyAttached: result.alreadyAttached ?? false,
          normalizedSlug,
          snapshotMatch,
          error: result.error,
        });
      },
    }),
  };
}
