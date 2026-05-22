import { internalMutation, internalQuery } from './_generated/server';
import { v } from 'convex/values';

export const getPurchasedInternal = internalQuery({
  args: { id: v.id('purchasedSkills') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const findBySkillName = internalQuery({
  args: {
    skillName: v.string(),
    status: v.union(v.literal('purchased'), v.literal('imported')),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('purchasedSkills')
      .withIndex('by_skillName', (q) => q.eq('skillName', args.skillName))
      .collect();
    return rows.find((r) => r.status === args.status) ?? null;
  },
});

export const insertPurchased = internalMutation({
  args: {
    skillName: v.string(),
    title: v.string(),
    description: v.string(),
    buyerAddress: v.string(),
    licenseTokenId: v.string(),
    mintingFeeIp: v.string(),
    localPath: v.string(),
    readTxHash: v.string(),
    cid: v.string(),
  },
  handler: async (ctx, args) => {
    const dup = await ctx.db
      .query('purchasedSkills')
      .withIndex('by_skillName', (q) => q.eq('skillName', args.skillName))
      .first();
    if (dup) {
      throw new Error(`Already recorded purchase for ${args.skillName}`);
    }
    return await ctx.db.insert('purchasedSkills', {
      ...args,
      status: 'purchased',
      purchasedAt: Date.now(),
    });
  },
});

export const importToRegistry = internalMutation({
  args: {
    name: v.string(),
    description: v.string(),
    knowledge: v.string(),
    purchasedSkillId: v.id('purchasedSkills'),
    targetAgentId: v.optional(v.id('agents')),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('skillRegistry')
      .withIndex('by_name', (q) => q.eq('name', args.name))
      .first();

    let skillRegistryId = existing?._id;
    const now = Date.now();

    if (!skillRegistryId) {
      skillRegistryId = await ctx.db.insert('skillRegistry', {
        name: args.name,
        description: args.description,
        skillType: 'template',
        templateId: 'knowledge-lookup',
        config: JSON.stringify({ knowledge: args.knowledge }),
        status: 'active',
        permissions: [],
        rateLimitPerMinute: 30,
        timeoutMs: 30000,
        supportsImages: false,
        supportsStreaming: false,
        approved: true,
        approvedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(skillRegistryId, {
        description: args.description,
        config: JSON.stringify({ knowledge: args.knowledge }),
        status: 'active',
        approved: true,
        approvedAt: now,
        updatedAt: now,
      });
    }

    const assignAgentId =
      args.targetAgentId ??
      (
        await ctx.db
          .query('agents')
          .withIndex('by_default', (q) => q.eq('isDefault', true))
          .first()
      )?._id;

    if (assignAgentId) {
      const assignments = await ctx.db
        .query('agentSkillAssignments')
        .withIndex('by_agentId', (q) => q.eq('agentId', assignAgentId))
        .collect();
      const found = assignments.find((a) => a.skillId === skillRegistryId);
      if (!found) {
        await ctx.db.insert('agentSkillAssignments', {
          agentId: assignAgentId,
          skillId: skillRegistryId,
          enabled: true,
        });
      } else if (!found.enabled) {
        await ctx.db.patch(found._id, { enabled: true });
      }
    }

    await ctx.db.patch(args.purchasedSkillId, {
      status: 'imported',
      skillRegistryId,
      importedAt: now,
    });

    return skillRegistryId;
  },
});
