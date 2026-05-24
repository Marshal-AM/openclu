'use node';

import { action } from './_generated/server';
import { v } from 'convex/values';
import { runMarketplaceCli } from './lib/marketplaceCli';

export const query = action({
  args: {
    query: v.optional(v.string()),
    tag: v.optional(v.string()),
    status: v.optional(v.string()),
    since: v.optional(v.number()),
    until: v.optional(v.number()),
    minScore: v.optional(v.number()),
    skillSlug: v.optional(v.string()),
    scope: v.optional(v.union(v.literal('marketplace'), v.literal('mine'))),
    full: v.optional(v.boolean()),
  },
  handler: async (_ctx, args) => {
    const body: Record<string, unknown> = { ...args };
    if (body.scope === 'mine') {
      const wallet = await runMarketplaceCli<{ configured: boolean; address: string | null }>(
        'wallet-address',
      );
      if (!wallet.address) {
        throw new Error(
          'AGENT_PRIVATE_KEY is required for "mine" scope. Set it in Convex environment variables.',
        );
      }
      body.ownerAddress = wallet.address;
    }
    return await runMarketplaceCli('query-training', body);
  },
});

export const getDetail = action({
  args: { skillName: v.string() },
  handler: async (_ctx, args) => {
    return await runMarketplaceCli('get-training-detail', args.skillName);
  },
});
