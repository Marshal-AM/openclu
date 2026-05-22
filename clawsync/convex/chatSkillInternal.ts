import { internalMutation, internalQuery } from './_generated/server';
import { v } from 'convex/values';

export const insertSearchSnapshot = internalMutation({
  args: {
    threadId: v.string(),
    agentId: v.optional(v.id('agents')),
    query: v.string(),
    matchesJson: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('skillSearchSnapshots', {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const getSearchSnapshot = internalQuery({
  args: { searchId: v.id('skillSearchSnapshots') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.searchId);
  },
});

export const insertPurchaseEvent = internalMutation({
  args: {
    threadId: v.string(),
    agentId: v.id('agents'),
    skillName: v.string(),
    title: v.string(),
    description: v.string(),
    listingKey: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('purchasing'),
      v.literal('success'),
      v.literal('failed'),
      v.literal('already_attached'),
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('skillPurchaseEvents', {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const patchPurchaseEvent = internalMutation({
  args: {
    eventId: v.id('skillPurchaseEvents'),
    status: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('purchasing'),
        v.literal('success'),
        v.literal('failed'),
        v.literal('already_attached'),
      ),
    ),
    purchasedSkillId: v.optional(v.id('purchasedSkills')),
    skillRegistryId: v.optional(v.id('skillRegistry')),
    error: v.optional(v.string()),
    logsJson: v.optional(v.string()),
    catalogSource: v.optional(v.string()),
    catalogCid: v.optional(v.string()),
    heliaAddrCount: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { eventId, ...patch } = args;
    const row = await ctx.db.get(eventId);
    if (!row) return;
    const updates: Record<string, unknown> = {};
    if (patch.status !== undefined) updates.status = patch.status;
    if (patch.purchasedSkillId !== undefined) updates.purchasedSkillId = patch.purchasedSkillId;
    if (patch.skillRegistryId !== undefined) updates.skillRegistryId = patch.skillRegistryId;
    if (patch.error !== undefined) updates.error = patch.error;
    if (patch.logsJson !== undefined) updates.logsJson = patch.logsJson;
    if (patch.catalogSource !== undefined) updates.catalogSource = patch.catalogSource;
    if (patch.catalogCid !== undefined) updates.catalogCid = patch.catalogCid;
    if (patch.heliaAddrCount !== undefined) updates.heliaAddrCount = patch.heliaAddrCount;
    if (patch.completedAt !== undefined) updates.completedAt = patch.completedAt;
    if (Object.keys(updates).length) {
      await ctx.db.patch(eventId, updates);
    }
  },
});

export const getPurchaseEventInternal = internalQuery({
  args: { eventId: v.id('skillPurchaseEvents') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.eventId);
  },
});
