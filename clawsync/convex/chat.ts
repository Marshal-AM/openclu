'use node';

import { action, internalAction } from './_generated/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';
import { clawsyncAgent, createDynamicAgent } from './agent/clawsync';
import { rateLimiter } from './rateLimits';
import { loadTools } from './agent/toolLoader';
import { loadClawsyncDotEnv } from './lib/clawsyncDotenv';
import type { Id } from './_generated/dataModel';

/**
 * Chat Functions
 *
 * Handles sending messages to the agent and receiving responses.
 * Uses @convex-dev/agent for thread management and streaming.
 * Model and tools are resolved dynamically from SyncBoard config.
 */

// Send a message and get a response
export const send = action({
  args: {
    threadId: v.optional(v.string()),
    message: v.string(),
    sessionId: v.string(),
    agentId: v.optional(v.id('agents')),
  },
  returns: v.object({
    response: v.optional(v.string()),
    error: v.optional(v.string()),
    threadId: v.optional(v.string()),
    toolCalls: v.optional(
      v.array(v.object({ name: v.string(), args: v.string(), result: v.string() }))
    ),
  }),
  handler: async (ctx, args) => {
    loadClawsyncDotEnv();

    // Rate limit check
    const { ok } = await rateLimiter.limit(ctx, 'publicChat', {
      key: args.sessionId,
    });

    if (!ok) {
      return {
        error: 'Rate limit exceeded. Please wait before sending another message.',
        threadId: args.threadId,
      };
    }

    // Global rate limit
    const { ok: globalOk } = await rateLimiter.limit(ctx, 'globalMessages', {
      key: 'global',
    });

    if (!globalOk) {
      return {
        error: 'The agent is currently busy. Please try again in a moment.',
        threadId: args.threadId,
      };
    }

    // Validate message length
    const maxLength = 4000;
    if (args.message.length > maxLength) {
      return {
        error: `Message too long. Maximum ${maxLength} characters.`,
        threadId: args.threadId,
      };
    }

    try {
      // Check agent status/mode if agentId provided
      if (args.agentId) {
        const agentRecord: any = await ctx.runQuery(
          internal.agents.getInternal,
          { agentId: args.agentId }
        );
        if (agentRecord) {
          if (agentRecord.status === 'paused' || agentRecord.mode === 'paused') {
            return {
              error: `Agent "${agentRecord.name}" is currently paused.`,
              threadId: args.threadId,
            };
          }
          if (agentRecord.status === 'error') {
            return {
              error: `Agent "${agentRecord.name}" is in an error state.`,
              threadId: args.threadId,
            };
          }
        }
      }

      // Use dynamic agent for SyncBoard-configured model + tools
      const agent = await createDynamicAgent(ctx, args.agentId);

      // Create or continue thread (destructure per @convex-dev/agent API)
      let threadId = args.threadId;
      let thread;
      if (threadId) {
        ({ thread } = await agent.continueThread(ctx, { threadId }));
      } else {
        const created = await agent.createThread(ctx, {});
        threadId = created.threadId;
        thread = created.thread;
      }

      // System prompt from selected/default agent (not legacy agentConfig only)
      let system: string | undefined;
      const agentRecord: {
        _id?: Id<'agents'>;
        soulDocument?: string;
        systemPrompt?: string;
        soulId?: string;
      } | null = args.agentId
        ? await ctx.runQuery(internal.agents.getInternal, { agentId: args.agentId })
        : await ctx.runQuery(internal.agents.getDefault);

      const effectiveAgentId: Id<'agents'> | undefined =
        args.agentId ?? (agentRecord as { _id?: Id<'agents'> } | null)?._id;

      if (agentRecord) {
        const parts: string[] = [];
        if (agentRecord.soulDocument?.trim()) parts.push(agentRecord.soulDocument.trim());
        if (agentRecord.systemPrompt?.trim()) parts.push(agentRecord.systemPrompt.trim());
        if (parts.length) system = parts.join('\n\n');
      }

      if (!system) {
        const legacy: {
          soulDocument?: string;
          systemPrompt?: string;
        } | null = await ctx.runQuery(internal.agentConfig.getConfig as any);
        if (legacy) {
          system = [legacy.soulDocument, legacy.systemPrompt].filter(Boolean).join('\n\n');
        }
      }

      // Inject Supermemory context if configured (optional)
      try {
        const memoryContext: string = await ctx.runAction(
          internal.supermemoryActions.getMemoryContext,
          { query: args.message }
        );
        if (memoryContext) {
          system = system
            ? `${system}\n\n--- Memory Context ---\n${memoryContext}`
            : memoryContext;
        }
      } catch {
        // Supermemory not configured; continue without it
      }

      if (effectiveAgentId) {
        const skillsSummary: Array<{
          name: string;
          description: string;
          enabled: boolean;
        }> = await ctx.runQuery(internal.agentAssignments.getAgentSkillsSummary, {
          agentId: effectiveAgentId,
        });
        const skillsBlock =
          skillsSummary.length > 0
            ? skillsSummary
                .map(
                  (s) =>
                    `- ${s.name} (${s.enabled ? 'enabled' : 'disabled'}): ${s.description.slice(0, 120)}`,
                )
                .join('\n')
            : '(none — you have no marketplace skills attached yet)';
        const marketplaceGuide = `## Skills attached to you
${skillsBlock}

## Marketplace behavior
When the user asks to find, look for, get, buy, add, or use a marketplace skill: call search_arkiv_skills once (it auto-purchases when appropriate).
Use skillSlug for named skills (e.g. "abc" not "abc skill"). After the tool returns, summarize success or failure in plain language — never leave your reply empty.
Never ask the user to pick from a list. Never dump the full catalog in your reply.
If already attached, say so instead of buying again.`;
        system = system ? `${system}\n\n${marketplaceGuide}` : marketplaceGuide;
      }

      // Load tools from skill registry + MCP servers
      const tools = await loadTools(ctx, effectiveAgentId);

      // Arkiv marketplace tools (Node-only; wired here to keep toolLoader out of node bundle graph)
      if (effectiveAgentId && threadId) {
        try {
          const { loadMarketplaceTools } = await import('./agent/marketplaceTools');
          Object.assign(
            tools,
            loadMarketplaceTools(ctx, {
              agentId: effectiveAgentId,
              threadId,
              userMessage: args.message,
            }),
          );
        } catch (e) {
          console.error('Failed to load marketplace tools:', e);
        }
      }

      // Generate response with tools and multi-step support
      const hasTools = Object.keys(tools).length > 0;
      const result: { text: string; steps?: Array<unknown> } = await thread.generateText(
        {
          prompt: args.message,
          ...(system && { system }),
          ...(hasTools && { tools }),
          ...(hasTools && { maxSteps: 8 }),
        },
        {
          // Save all messages (including tool call steps) so the
          // frontend subscription picks them up incrementally.
          storageOptions: { saveMessages: 'all' },
        },
      );

      // Log activity (include agentId if multi-agent)
      await ctx.runMutation(internal.activityLog.log, {
        actionType: 'chat_message',
        summary: `Responded to: "${args.message.slice(0, 50)}${args.message.length > 50 ? '...' : ''}"`,
        visibility: 'private',
        ...(args.agentId && { agentId: args.agentId }),
      });

      // Extract tool call info from steps
      const toolCalls: Array<{ name: string; args: string; result: string }> = [];
      const steps = (result as any).steps;
      if (Array.isArray(steps)) {
        for (const step of steps) {
          if (Array.isArray(step.toolCalls)) {
            for (const tc of step.toolCalls) {
              const toolResult = step.toolResults?.find(
                (tr: any) => tr.toolCallId === tc.toolCallId
              )?.result;
              toolCalls.push({
                name: tc.toolName ?? tc.name ?? 'unknown',
                args: JSON.stringify(tc.args ?? {}, null, 2),
                result: toolResult
                  ? typeof toolResult === 'string'
                    ? toolResult.slice(0, 1000)
                    : JSON.stringify(toolResult, null, 2).slice(0, 1000)
                  : '',
              });
            }
          }
        }
      }

      // Store conversation in Supermemory (fire and forget)
      try {
        await ctx.runAction(internal.supermemoryActions.storeConversation, {
          conversation: `User: ${args.message}\nAssistant: ${result.text}`,
        });
      } catch {
        // Supermemory not configured; skip
      }

      return {
        response: result.text,
        threadId,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (error) {
      console.error('Chat error:', error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('API Key') || message.includes('API_KEY')) {
        return { error: message, threadId: args.threadId };
      }
      return {
        error: 'Failed to generate response. Please try again.',
        threadId: args.threadId,
      };
    }
  },
});

// Stream a response (for real-time output)
export const stream = internalAction({
  args: {
    threadId: v.optional(v.string()),
    message: v.string(),
    sessionId: v.string(),
    agentId: v.optional(v.id('agents')),
  },
  returns: v.object({
    response: v.string(),
    threadId: v.string(),
  }),
  handler: async (ctx, args) => {
    // Rate limit check
    const { ok } = await rateLimiter.limit(ctx, 'publicChat', {
      key: args.sessionId,
    });

    if (!ok) {
      throw new Error('Rate limit exceeded');
    }

    // Use dynamic agent for SyncBoard-configured model + tools
    const agent = await createDynamicAgent(ctx, args.agentId);

    let threadId = args.threadId;
    let thread;
    if (threadId) {
      ({ thread } = await agent.continueThread(ctx, { threadId }));
    } else {
      const created = await agent.createThread(ctx, {});
      threadId = created.threadId;
      thread = created.thread;
    }

    // Use streaming generation
    const result = await thread.generateText({
      prompt: args.message,
    });

    return {
      response: result.text,
      threadId,
    };
  },
});

// Get thread history
export const getHistory = action({
  args: {
    threadId: v.string(),
  },
  returns: v.object({
    messages: v.any(),
  }),
  handler: async (ctx, args) => {
    try {
      // Use static agent for read-only history lookup
      const result = await clawsyncAgent.listMessages(ctx, {
        threadId: args.threadId,
        paginationOpts: { numItems: 100, cursor: null },
      });

      return { messages: result.page };
    } catch {
      return { messages: [] };
    }
  },
});

// API Send - Internal action for HTTP API
export const apiSend = internalAction({
  args: {
    message: v.string(),
    threadId: v.optional(v.string()),
    sessionId: v.string(),
    apiKeyId: v.optional(v.id('apiKeys')),
    agentId: v.optional(v.id('agents')),
  },
  returns: v.object({
    response: v.optional(v.string()),
    error: v.optional(v.string()),
    threadId: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    // Validate message length
    const maxLength = 4000;
    if (args.message.length > maxLength) {
      return {
        error: `Message too long. Maximum ${maxLength} characters.`,
        threadId: args.threadId,
      };
    }

    try {
      // Use dynamic agent for SyncBoard-configured model + tools
      const agent = await createDynamicAgent(ctx, args.agentId);

      // Create or continue thread
      let threadId = args.threadId;
      let thread;
      if (threadId) {
        ({ thread } = await agent.continueThread(ctx, { threadId }));
      } else {
        const created = await agent.createThread(ctx, {});
        threadId = created.threadId;
        thread = created.thread;
      }

      // Generate response
      const result = await thread.generateText({
        prompt: args.message,
      });

      // Log activity (include agentId if multi-agent)
      await ctx.runMutation(internal.activityLog.log, {
        actionType: 'api_chat',
        summary: `API: "${args.message.slice(0, 50)}${args.message.length > 50 ? '...' : ''}"`,
        visibility: 'private',
        channel: 'api',
        ...(args.agentId && { agentId: args.agentId }),
      });

      // Get token usage from result if available
      const usage = (result as unknown as Record<string, unknown>).usage as
        | { promptTokens?: number; completionTokens?: number }
        | undefined;

      return {
        response: result.text,
        threadId,
        tokensUsed: (usage?.promptTokens ?? 0) + (usage?.completionTokens ?? 0),
        inputTokens: usage?.promptTokens ?? 0,
        outputTokens: usage?.completionTokens ?? 0,
      };
    } catch (error) {
      console.error('API Chat error:', error);
      return {
        error: 'Failed to generate response. Please try again.',
        threadId: args.threadId,
      };
    }
  },
});
