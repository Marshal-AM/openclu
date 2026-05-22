'use node';

import { createTool } from '@convex-dev/agent';
import { jsonSchema } from 'ai';
import type { ActionCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';
import { runPurchaseAndAttach, type CatalogMatch } from '../lib/chatSkillPurchase';
import { normalizeSkillSlug } from '../lib/skillSlugUtils';
import { logChatSkill } from '../lib/chatSkillLog';
import {
  executeAttachExistingSkill,
  executeDetachAttachedSkill,
  executeListAttachedSkills,
  executeSearchArkivSkills,
} from '../lib/marketplaceExecutions';
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

  const skillRefSchema = jsonSchema<{ skillName: string; skillRegistryId?: string }>({
    type: 'object' as const,
    properties: {
      skillName: {
        type: 'string',
        description: 'Registry skill slug/name (e.g. "rocking"), not "rocking skill"',
      },
      skillRegistryId: {
        type: 'string',
        description: 'Optional skillRegistry document id from list_attached_skills',
      },
    },
    required: ['skillName'],
  });

  return {
    search_arkiv_skills: createTool({
      description:
        'Search the Arkiv marketplace catalog. Use skillSlug for a named skill (slug only, e.g. "rocking" not "rocking skill"). Does not purchase — call purchase_and_attach_skill after search when the user wants to acquire a skill.',
      args: searchSchema,
      handler: async (
        _toolCtx,
        { query, skillSlug, limit }: { query: string; skillSlug?: string; limit?: number },
      ) =>
        executeSearchArkivSkills(
          ctx,
          { agentId, threadId, userMessage },
          { query, skillSlug, limit },
        ),
    }),

    list_attached_skills: createTool({
      description:
        'List marketplace skills currently attached to this agent. Call when the user asks what skills you have, what you can do, or your capabilities from the marketplace.',
      args: jsonSchema<Record<string, never>>({
        type: 'object' as const,
        properties: {},
      }),
      handler: async (_toolCtx) =>
        executeListAttachedSkills(ctx, { agentId, threadId, userMessage }),
    }),

    attach_existing_skill: createTool({
      description:
        'Attach a skill that already exists in the local skill registry (imported/purchased previously) to this agent. Does not buy from Arkiv — use purchase_and_attach_skill for new marketplace acquisitions.',
      args: skillRefSchema,
      handler: async (
        _toolCtx,
        { skillName, skillRegistryId }: { skillName: string; skillRegistryId?: string },
      ) =>
        executeAttachExistingSkill(ctx, { agentId, threadId, userMessage }, {
          skillName,
          skillRegistryId,
        }),
    }),

    detach_attached_skill: createTool({
      description:
        'Remove a skill from this agent’s assignments. The skill stays in the registry; use attach_existing_skill to add it again.',
      args: skillRefSchema,
      handler: async (
        _toolCtx,
        { skillName, skillRegistryId }: { skillName: string; skillRegistryId?: string },
      ) =>
        executeDetachAttachedSkill(ctx, { agentId, threadId, userMessage }, {
          skillName,
          skillRegistryId,
        }),
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

        const assistantMessage = result.alreadyAttached
          ? `Skill "${result.title}" is already attached to this agent.`
          : result.purchasing
            ? `Purchasing "${result.title}" in the background — see the card below.`
            : result.success
              ? `Acquired and attached "${result.title}".`
              : result.error
                ? `Purchase failed: ${result.error}`
                : `Started acquisition of "${result.title}".`;

        return JSON.stringify({
          purchaseEventId: result.purchaseEventId,
          success: result.success,
          title: result.title,
          skillRegistryId: result.skillRegistryId,
          alreadyAttached: result.alreadyAttached ?? false,
          purchasing: result.purchasing ?? false,
          normalizedSlug,
          snapshotMatch,
          error: result.error,
          assistantMessage,
        });
      },
    }),
  };
}
