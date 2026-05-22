'use node';

import type { ActionCtx } from '../_generated/server';
import { components } from '../_generated/api';

export type PersistedToolCall = {
  name: string;
  args: string;
  result: string;
};

/**
 * Save user + assistant messages to the agent thread when chat.send bypasses generateText
 * (e.g. Groq direct marketplace). Without this, the UI subscription has nothing to render.
 */
export async function persistChatExchange(
  ctx: ActionCtx,
  args: {
    threadId: string;
    userMessage: string;
    assistantText: string;
    toolCalls?: PersistedToolCall[];
  },
): Promise<void> {
  const messages: Array<{
    message:
      | { role: 'user'; content: string }
      | { role: 'assistant'; content: string | Array<Record<string, unknown>> }
      | { role: 'tool'; content: Array<Record<string, unknown>> };
    text?: string;
    status?: 'success';
  }> = [
    {
      message: { role: 'user', content: args.userMessage },
    },
  ];

  const toolCalls = args.toolCalls?.filter((tc) => tc.name && tc.result) ?? [];
  if (toolCalls.length > 0) {
    const assistantParts: Array<Record<string, unknown>> = [
      { type: 'text', text: args.assistantText },
    ];
    const toolParts: Array<Record<string, unknown>> = [];

    for (const tc of toolCalls) {
      const toolCallId = crypto.randomUUID();
      let parsedArgs: unknown = {};
      try {
        parsedArgs = JSON.parse(tc.args || '{}');
      } catch {
        parsedArgs = { raw: tc.args };
      }
      assistantParts.push({
        type: 'tool-call',
        toolCallId,
        toolName: tc.name,
        args: parsedArgs,
      });
      toolParts.push({
        type: 'tool-result',
        toolCallId,
        toolName: tc.name,
        result: tc.result,
        output: { type: 'text', value: tc.result },
      });
    }

    messages.push({
      message: { role: 'assistant', content: assistantParts },
      text: args.assistantText,
      status: 'success',
    });
    messages.push({
      message: { role: 'tool', content: toolParts },
      status: 'success',
    });
  } else {
    messages.push({
      message: { role: 'assistant', content: args.assistantText },
      text: args.assistantText,
      status: 'success',
    });
  }

  await ctx.runMutation(components.agent.messages.addMessages, {
    threadId: args.threadId,
    messages: messages as never,
  });
}
