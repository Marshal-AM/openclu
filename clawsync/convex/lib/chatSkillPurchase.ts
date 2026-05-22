'use node';

import type { ActionCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';
import { normalizeSkillSlug } from './skillSlugUtils';
import { logChatSkill } from './chatSkillLog';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const skillInternal = (internal as any).skillPurchasesInternal;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chatSkillInternal = (internal as any).chatSkillInternal;

export type CatalogMatch = {
  score: number;
  skillName: string;
  title: string;
  description: string;
  listingKey: string;
  entityKey?: string;
  payload?: Record<string, unknown>;
};

/** Start purchase in background; returns immediately so chat:send does not time out. */
export async function runPurchaseAndAttach(
  ctx: ActionCtx,
  args: {
    agentId: Id<'agents'>;
    threadId: string;
    skillName: string;
    title: string;
    description: string;
    listingKey: string;
    catalogSnapshot?: { entityKey: string; payload: unknown };
    searchId?: Id<'skillSearchSnapshots'>;
  },
): Promise<{
  purchaseEventId: Id<'skillPurchaseEvents'>;
  success: boolean;
  title: string;
  skillRegistryId?: Id<'skillRegistry'>;
  alreadyAttached?: boolean;
  purchasing?: boolean;
  error?: string;
  logs: string[];
}> {
  const skillName = normalizeSkillSlug(args.skillName);

  logChatSkill('purchase_attach_start', {
    skillNameRaw: args.skillName,
    skillName,
    agentId: args.agentId,
    threadId: args.threadId,
    hasCatalogSnapshot: Boolean(args.catalogSnapshot?.payload),
    mode: 'background_job',
  });

  const eventId: Id<'skillPurchaseEvents'> = await ctx.runMutation(
    chatSkillInternal.insertPurchaseEvent,
    {
      threadId: args.threadId,
      agentId: args.agentId,
      skillName,
      title: args.title,
      description: args.description,
      listingKey: args.listingKey,
      status: 'purchasing',
    },
  );

  // Quick sync check: already attached → finish immediately
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
    logChatSkill('purchase_attach_skip', { reason: 'already_attached_registry', skillName });
    await ctx.runMutation(chatSkillInternal.patchPurchaseEvent, {
      eventId,
      status: 'already_attached',
      skillRegistryId: existing._id,
      completedAt: Date.now(),
    });
    return {
      purchaseEventId: eventId,
      success: true,
      title: args.title,
      skillRegistryId: existing._id,
      alreadyAttached: true,
      logs: [],
    };
  }

  await ctx.scheduler.runAfter(0, internal.chatSkillPurchaseJob.executePurchaseJob, {
    eventId,
    agentId: args.agentId,
    threadId: args.threadId,
    skillName: args.skillName,
    title: args.title,
    description: args.description,
    listingKey: args.listingKey,
    catalogSnapshot: args.catalogSnapshot,
    searchId: args.searchId,
  });

  logChatSkill('purchase_job_scheduled', { eventId, skillName });

  return {
    purchaseEventId: eventId,
    success: true,
    title: args.title,
    purchasing: true,
    logs: [],
  };
}
