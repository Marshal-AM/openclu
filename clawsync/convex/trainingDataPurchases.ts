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
