import { v } from 'convex/values';
import { query } from './_generated/server';

export const listPurchased = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('purchasedTrainingData')
      .order('desc')
      .take(200);
  },
});

export const get = query({
  args: { id: v.id('purchasedTrainingData') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
