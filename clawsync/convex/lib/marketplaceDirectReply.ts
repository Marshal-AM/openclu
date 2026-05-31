'use node';

import type { ActionCtx } from '../_generated/server';
import { isGroqWeakToolModel } from './groqToolSupport';
import {
  executeAttachExistingSkill,
  executeDetachAttachedSkill,
  executeListAttachedSkills,
  executeSearchCatalogSkills,
  type MarketplaceExecutionContext,
} from './marketplaceExecutions';
import { summarizeSearchToolResult } from './marketplaceToolMessages';
import { extractSkillSlugFromQuery } from './skillSlugUtils';
import type { MarketplaceIntent } from './marketplaceIntent';

export type MarketplaceDirectToolCall = {
  name: string;
  args: string;
  result: string;
};

export async function runMarketplaceDirectAction(
  ctx: ActionCtx,
  context: MarketplaceExecutionContext,
  intent: MarketplaceIntent,
  userMessage: string,
  parsedTool?: { name: string; args: Record<string, unknown> },
): Promise<{ response: string; toolCalls: MarketplaceDirectToolCall[] } | null> {
  const toolCalls: MarketplaceDirectToolCall[] = [];

  if (intent === 'search' || parsedTool?.name === 'search_catalog_skills') {
    const args = parsedTool?.args ?? {};
    const query =
      typeof args.query === 'string' && args.query.trim()
        ? args.query
        : userMessage;
    const skillSlug =
      typeof args.skillSlug === 'string'
        ? args.skillSlug
        : extractSkillSlugFromQuery(userMessage);
    const limit = typeof args.limit === 'number' ? args.limit : undefined;
    const callArgs = { query, skillSlug, limit };
    const result = await executeSearchCatalogSkills(ctx, context, callArgs);
    toolCalls.push({
      name: 'search_catalog_skills',
      args: JSON.stringify(callArgs, null, 2),
      result,
    });
    const response = summarizeSearchToolResult(result) ?? '';
    return { response, toolCalls };
  }

  if (intent === 'attach' || parsedTool?.name === 'attach_existing_skill') {
    const args = parsedTool?.args ?? {};
    const skillName =
      typeof args.skillName === 'string' && args.skillName.trim() ?
        args.skillName
      : extractSkillSlugFromQuery(userMessage) ?? userMessage;
    const skillRegistryId =
      typeof args.skillRegistryId === 'string' ? args.skillRegistryId : undefined;
    const callArgs = { skillName, skillRegistryId };
    const result = await executeAttachExistingSkill(ctx, context, callArgs);
    toolCalls.push({
      name: 'attach_existing_skill',
      args: JSON.stringify(callArgs, null, 2),
      result,
    });
    try {
      const p = JSON.parse(result) as { assistantMessage?: string };
      return { response: p.assistantMessage ?? '', toolCalls };
    } catch {
      return { response: result, toolCalls };
    }
  }

  if (intent === 'detach' || parsedTool?.name === 'detach_attached_skill') {
    const args = parsedTool?.args ?? {};
    const skillName =
      typeof args.skillName === 'string' && args.skillName.trim() ?
        args.skillName
      : extractSkillSlugFromQuery(userMessage) ?? userMessage;
    const skillRegistryId =
      typeof args.skillRegistryId === 'string' ? args.skillRegistryId : undefined;
    const callArgs = { skillName, skillRegistryId };
    const result = await executeDetachAttachedSkill(ctx, context, callArgs);
    toolCalls.push({
      name: 'detach_attached_skill',
      args: JSON.stringify(callArgs, null, 2),
      result,
    });
    try {
      const p = JSON.parse(result) as { assistantMessage?: string };
      return { response: p.assistantMessage ?? '', toolCalls };
    } catch {
      return { response: result, toolCalls };
    }
  }

  if (intent === 'list' || parsedTool?.name === 'list_attached_skills') {
    const result = await executeListAttachedSkills(ctx, context);
    toolCalls.push({
      name: 'list_attached_skills',
      args: '{}',
      result,
    });
    try {
      const p = JSON.parse(result) as { assistantMessage?: string; summary?: string };
      const response = p.assistantMessage ?? p.summary ?? '';
      return { response, toolCalls };
    } catch {
      return { response: result, toolCalls };
    }
  }

  return null;
}

export function resolveAgentModel(
  agentRecord: {
    model?: string;
    modelProvider?: string;
  } | null,
  legacyConfig: { modelProvider?: string; model?: string } | null,
): { provider: string; modelId: string } {
  return {
    provider: agentRecord?.modelProvider ?? legacyConfig?.modelProvider ?? 'anthropic',
    modelId: agentRecord?.model ?? legacyConfig?.model ?? 'claude-sonnet-4-20250514',
  };
}

export function shouldRunMarketplaceDirect(
  provider: string,
  modelId: string,
  intent: MarketplaceIntent | null,
): boolean {
  if (!intent) return false;
  if (intent === 'purchase') return false;
  if (provider === 'groq' && isGroqWeakToolModel(modelId)) return true;
  return false;
}
