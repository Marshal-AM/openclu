import { query } from './_generated/server';
import { v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import {
  listMessages,
  syncStreams,
  vStreamArgs,
  vStreamMessagesReturnValue,
} from '@convex-dev/agent';
import { components } from './_generated/api';

/**
 * List thread messages with streaming support.
 * Used by the frontend to reactively subscribe to messages
 * as the agent processes tool calls step by step.
 */
export const list = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, args) => {
    const paginated = await listMessages(ctx, components.agent, {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
      statuses: ['success', 'failed', 'pending'],
    });
    const streams = await syncStreams(ctx, components.agent, args);
    return { ...paginated, streams };
  },
  returns: vStreamMessagesReturnValue,
});
