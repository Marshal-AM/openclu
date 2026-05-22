'use node';

import { internalAction } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { api, internal } from './_generated/api';
import { loadClawsyncDotEnv } from './lib/clawsyncDotenv';
import { normalizeSkillSlug } from './lib/skillSlugUtils';
import { logChatSkill } from './lib/chatSkillLog';
import { resolvePurchaseCatalogSnapshot } from './lib/resolvePurchaseCatalog';
import type { CatalogMatch } from './lib/chatSkillPurchase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const skillInternal = (internal as any).skillPurchasesInternal;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chatSkillInternal = (internal as any).chatSkillInternal;

/**
 * Background purchase job — runs outside chat:send so long CDR/Helia work
 * does not hit the chat action timeout.
 */
export const executePurchaseJob = internalAction({
  args: {
    eventId: v.id('skillPurchaseEvents'),
    agentId: v.id('agents'),
    threadId: v.string(),
    skillName: v.string(),
    title: v.string(),
    description: v.string(),
    listingKey: v.string(),
    catalogSnapshot: v.optional(
      v.object({
        entityKey: v.string(),
        payload: v.any(),
      }),
    ),
    searchId: v.optional(v.id('skillSearchSnapshots')),
  },
  handler: async (ctx, args) => {
    loadClawsyncDotEnv();
    const skillName = normalizeSkillSlug(args.skillName);
    const logs: string[] = [];

    const assignToAgent = async (skillRegistryId: Id<'skillRegistry'>) => {
      await ctx.runMutation(api.agentAssignments.assignSkill, {
        agentId: args.agentId,
        skillId: skillRegistryId,
      });
    };

    try {
      const attachedIds: Id<'skillRegistry'>[] = await ctx.runQuery(
        internal.agentAssignments.getAgentSkillIds,
        { agentId: args.agentId },
      );
      const registrySkills = await ctx.runQuery(internal.skillRegistry.getActiveApproved);
      const sanitized = skillName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
      const existing = registrySkills.find(
        (s: { name: string; _id: Id<'skillRegistry'> }) =>
          s.name === sanitized || s.name === skillName,
      );
      if (existing && attachedIds.includes(existing._id)) {
        logChatSkill('purchase_job_skip', { reason: 'already_attached_registry', skillName });
        await ctx.runMutation(chatSkillInternal.patchPurchaseEvent, {
          eventId: args.eventId,
          status: 'already_attached',
          skillRegistryId: existing._id,
          completedAt: Date.now(),
        });
        return;
      }

      if (!process.env.AGENT_PRIVATE_KEY?.trim()) {
        throw new Error(
          'AGENT_PRIVATE_KEY is not configured. Set it in clawsync/.env or: npx convex env set AGENT_PRIVATE_KEY <hex>',
        );
      }

      let inlineSnapshot = args.catalogSnapshot;
      if (!inlineSnapshot?.payload && args.searchId) {
        const snap = await ctx.runQuery(chatSkillInternal.getSearchSnapshot, {
          searchId: args.searchId,
        });
        if (snap?.matchesJson) {
          const matches = JSON.parse(snap.matchesJson) as CatalogMatch[];
          const m = matches.find(
            (x) =>
              x.skillName === skillName ||
              x.listingKey === args.listingKey ||
              normalizeSkillSlug(x.skillName) === skillName,
          );
          if (m?.payload && (m.entityKey ?? m.listingKey)) {
            inlineSnapshot = {
              entityKey: m.entityKey ?? m.listingKey!,
              payload: m.payload,
            };
          }
        }
      }

      const { snapshot: catalogSnapshot, source: catalogSource } =
        await resolvePurchaseCatalogSnapshot(skillName, inlineSnapshot);

      await ctx.runMutation(chatSkillInternal.patchPurchaseEvent, {
        eventId: args.eventId,
        catalogSource,
        catalogCid: (catalogSnapshot.payload as { purchase?: { cid?: string } })?.purchase
          ?.cid,
        heliaAddrCount: (
          catalogSnapshot.payload as { ops?: { heliaMultiaddrs?: string[] } }
        )?.ops?.heliaMultiaddrs?.length,
      });

      const imported = await ctx.runQuery(skillInternal.findBySkillName, {
        skillName,
        status: 'imported',
      });
      if (imported?.skillRegistryId) {
        await assignToAgent(imported.skillRegistryId);
        await ctx.runMutation(chatSkillInternal.patchPurchaseEvent, {
          eventId: args.eventId,
          status: 'already_attached',
          skillRegistryId: imported.skillRegistryId,
          purchasedSkillId: imported._id,
          completedAt: Date.now(),
        });
        return;
      }

      const pendingPurchase = await ctx.runQuery(skillInternal.findBySkillName, {
        skillName,
        status: 'purchased',
      });
      if (pendingPurchase) {
        logChatSkill('purchase_job_import_existing', {
          skillName,
          purchasedSkillId: pendingPurchase._id,
        });
        const importResult = await ctx.runAction(api.skillPurchaseImport.importPurchasedSkill, {
          purchasedSkillId: pendingPurchase._id,
          targetAgentId: args.agentId,
        });
        await ctx.runMutation(chatSkillInternal.patchPurchaseEvent, {
          eventId: args.eventId,
          status: 'success',
          purchasedSkillId: pendingPurchase._id,
          skillRegistryId: importResult.skillRegistryId,
          completedAt: Date.now(),
        });
        return;
      }

      logChatSkill('purchase_job_cli_start', { skillName });
      const purchaseResult = await ctx.runAction(api.skillPurchaseActions.purchaseSkill, {
        skillName,
        catalogSnapshot,
      });
      logs.push(...(purchaseResult.logs ?? []));
      logChatSkill('purchase_job_cli_done', {
        skillName,
        purchasedSkillId: purchaseResult.purchasedSkillId,
        durationMs: purchaseResult.durationMs,
      });

      const importResult = await ctx.runAction(api.skillPurchaseImport.importPurchasedSkill, {
        purchasedSkillId: purchaseResult.purchasedSkillId,
        targetAgentId: args.agentId,
      });

      await ctx.runMutation(chatSkillInternal.patchPurchaseEvent, {
        eventId: args.eventId,
        status: 'success',
        purchasedSkillId: purchaseResult.purchasedSkillId,
        skillRegistryId: importResult.skillRegistryId,
        logsJson: JSON.stringify(logs),
        completedAt: Date.now(),
      });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      logChatSkill('purchase_job_error', { skillName, error: err });
      logs.push(err);
      await ctx.runMutation(chatSkillInternal.patchPurchaseEvent, {
        eventId: args.eventId,
        status: 'failed',
        error: err,
        logsJson: JSON.stringify(logs),
        completedAt: Date.now(),
      });
    }
  },
});
