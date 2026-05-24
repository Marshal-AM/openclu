import { internalMutation, internalQuery } from './_generated/server';
import { v } from 'convex/values';

export const getPurchasedInternal = internalQuery({
  args: { id: v.id('purchasedTrainingData') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const findBySkillName = internalQuery({
  args: { skillName: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('purchasedTrainingData')
      .withIndex('by_skillName', (q) => q.eq('skillName', args.skillName))
      .first();
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
    videoMime: v.string(),
    readTxHash: v.string(),
    cid: v.string(),
  },
  handler: async (ctx, args) => {
    const dup = await ctx.db
      .query('purchasedTrainingData')
      .withIndex('by_skillName', (q) => q.eq('skillName', args.skillName))
      .first();
    if (dup) {
      throw new Error(`Already recorded purchase for ${args.skillName}`);
    }
    return await ctx.db.insert('purchasedTrainingData', {
      ...args,
      status: 'purchased',
      purchasedAt: Date.now(),
    });
  },
});
