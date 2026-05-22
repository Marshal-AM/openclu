import { query } from './_generated/server';
import { v } from 'convex/values';

export const listPurchased = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('purchasedSkills')
      .order('desc')
      .take(200);
  },
});

export const getPurchased = query({
  args: { id: v.id('purchasedSkills') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
