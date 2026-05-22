import { query } from './_generated/server';
import { v } from 'convex/values';

const purchaseEventValidator = v.object({
  _id: v.id('skillPurchaseEvents'),
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
  purchasedSkillId: v.optional(v.id('purchasedSkills')),
  skillRegistryId: v.optional(v.id('skillRegistry')),
  error: v.optional(v.string()),
  logs: v.optional(v.array(v.string())),
  catalogSource: v.optional(v.string()),
  catalogCid: v.optional(v.string()),
  heliaAddrCount: v.optional(v.number()),
  createdAt: v.number(),
  completedAt: v.optional(v.number()),
});

export const getPurchaseEvent = query({
  args: { purchaseEventId: v.id('skillPurchaseEvents') },
  returns: v.union(purchaseEventValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.purchaseEventId);
    if (!row) return null;
    let logs: string[] | undefined;
    if (row.logsJson) {
      try {
        logs = JSON.parse(row.logsJson) as string[];
      } catch {
        logs = [row.logsJson];
      }
    }
    return {
      _id: row._id,
      threadId: row.threadId,
      agentId: row.agentId,
      skillName: row.skillName,
      title: row.title,
      description: row.description,
      listingKey: row.listingKey,
      status: row.status,
      purchasedSkillId: row.purchasedSkillId,
      skillRegistryId: row.skillRegistryId,
      error: row.error,
      logs,
      catalogSource: row.catalogSource,
      catalogCid: row.catalogCid,
      heliaAddrCount: row.heliaAddrCount,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
    };
  },
});

export const listPurchaseEventsForThread = query({
  args: { threadId: v.string() },
  returns: v.array(purchaseEventValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('skillPurchaseEvents')
      .withIndex('by_threadId', (q) => q.eq('threadId', args.threadId))
      .collect();
    return rows.map((row) => {
      let logs: string[] | undefined;
      if (row.logsJson) {
        try {
          logs = JSON.parse(row.logsJson) as string[];
        } catch {
          logs = [row.logsJson];
        }
      }
      return {
        _id: row._id,
        threadId: row.threadId,
        agentId: row.agentId,
        skillName: row.skillName,
        title: row.title,
        description: row.description,
        listingKey: row.listingKey,
        status: row.status,
        purchasedSkillId: row.purchasedSkillId,
        skillRegistryId: row.skillRegistryId,
        error: row.error,
        logs,
        catalogSource: row.catalogSource,
        catalogCid: row.catalogCid,
        heliaAddrCount: row.heliaAddrCount,
        createdAt: row.createdAt,
        completedAt: row.completedAt,
      };
    });
  },
});
