import { ActionCtx } from '../_generated/server';
import { internal } from '../_generated/api';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';

/**
 * Model Router
 *
 * Resolves which AI SDK provider and model to use based on agentConfig.
 *
 * Provider mapping:
 * - anthropic: @ai-sdk/anthropic (direct API)
 * - openai: @ai-sdk/openai (direct API)
 * - openrouter: @ai-sdk/openai-compatible (https://openrouter.ai/api/v1)
 * - opencode-zen: @ai-sdk/openai-compatible (https://opencode.ai/zen/v1)
 * - custom: @ai-sdk/openai-compatible (user-provided base URL)
 */

export interface ModelConfig {
  provider: string;
  model: string;
  fallbackProvider?: string;
  fallbackModel?: string;
}

export interface ResolvedModel {
  model: LanguageModel;
  provider: string;
  modelId: string;
  isFallback: boolean;
}

/**
 * Resolve the model to use for the agent
 */
type AgentModelConfig = {
  modelProvider: string;
  model: string;
  fallbackProvider?: string;
  fallbackModel?: string;
};

export async function resolveModel(ctx: ActionCtx): Promise<ResolvedModel> {
  // Get config from Convex
  // @ts-expect-error TS2589 — generated internal API exceeds TypeScript instantiation depth
  const config = (await ctx.runQuery(internal.agentConfig.getConfig)) as AgentModelConfig | null;

  if (!config) {
    // Default to Claude Sonnet if no config
    return {
      model: anthropic('claude-sonnet-4-20250514'),
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-20250514',
      isFallback: false,
    };
  }

  try {
    // Try primary model
    const model = createModel(config.modelProvider, config.model);
    return {
      model,
      provider: config.modelProvider,
      modelId: config.model,
      isFallback: false,
    };
  } catch {
    // Try fallback if available
    if (config.fallbackProvider && config.fallbackModel) {
      const fallbackModel = createModel(config.fallbackProvider, config.fallbackModel);
      return {
        model: fallbackModel,
        provider: config.fallbackProvider,
        modelId: config.fallbackModel,
        isFallback: true,
      };
    }

    // Default fallback
    return {
      model: anthropic('claude-sonnet-4-20250514'),
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-20250514',
      isFallback: true,
    };
  }
}

/**
 * Create an AI SDK model instance from provider and model ID
 */
function createModel(provider: string, modelId: string): LanguageModel {
  switch (provider) {
    case 'anthropic':
      return anthropic(modelId);

    case 'openai':
      return openai(modelId);

    case 'openrouter': {
      const apiKey = process.env.OPENROUTER_API_KEY?.trim();
      if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY is not set in Convex environment.');
      }
      const openrouter = createOpenAICompatible({
        name: 'openrouter',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey,
        headers: {
          'HTTP-Referer': 'https://clawsync.dev',
          'X-Title': 'ClawSync',
        },
      });
      return openrouter(modelId);
    }

    case 'xai': {
      const apiKey = process.env.XAI_API_KEY?.trim();
      if (!apiKey) {
        throw new Error('XAI_API_KEY is not set in Convex environment.');
      }
      const xai = createOpenAICompatible({
        name: 'xai',
        baseURL: 'https://api.x.ai/v1',
        apiKey,
      });
      return xai(modelId);
    }

    case 'groq': {
      const apiKey = process.env.GROQ_API_KEY?.trim();
      if (!apiKey) {
        throw new Error(
          'GROQ_API_KEY is not set. Add it to clawsync/.env and run: npx convex env set GROQ_API_KEY <key>',
        );
      }
      const groq = createOpenAICompatible({
        name: 'groq',
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey,
      });
      return groq(modelId);
    }

    case 'opencode-zen': {
      const opencodeZen = createOpenAICompatible({
        name: 'opencode-zen',
        baseURL: 'https://opencode.ai/zen/v1',
      });
      return opencodeZen(modelId);
    }

    case 'custom': {
      // For custom providers, the modelId should include the base URL
      // Format: "baseUrl::modelId"
      const [baseUrl, actualModelId] = modelId.split('::');
      const customProvider = createOpenAICompatible({
        name: 'custom',
        baseURL: baseUrl,
      });
      return customProvider(actualModelId);
    }

    default:
      // Default to Anthropic
      return anthropic(modelId);
  }
}

/**
 * Resolve model from an explicit config object (multi-agent support).
 * Accepts a plain config rather than querying agentConfig.
 */
export async function resolveModelFromConfig(
  _ctx: ActionCtx,
  config: ModelConfig
): Promise<ResolvedModel> {
  try {
    const model = createModel(config.provider, config.model);
    return {
      model,
      provider: config.provider,
      modelId: config.model,
      isFallback: false,
    };
  } catch {
    // Try fallback if available
    if (config.fallbackProvider && config.fallbackModel) {
      const fallbackModel = createModel(config.fallbackProvider, config.fallbackModel);
      return {
        model: fallbackModel,
        provider: config.fallbackProvider,
        modelId: config.fallbackModel,
        isFallback: true,
      };
    }

    // Default fallback
    return {
      model: anthropic('claude-sonnet-4-20250514'),
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-20250514',
      isFallback: true,
    };
  }
}

/**
 * Get available model providers
 */
export function getAvailableProviders(): Array<{
  id: string;
  name: string;
  description: string;
}> {
  return [
    {
      id: 'anthropic',
      name: 'Anthropic',
      description: 'Claude models via direct API',
    },
    {
      id: 'openai',
      name: 'OpenAI',
      description: 'GPT models via direct API',
    },
    {
      id: 'openrouter',
      name: 'OpenRouter',
      description: 'Access 300+ models via unified API',
    },
    {
      id: 'xai',
      name: 'xAI',
      description: 'Grok models via xAI API',
    },
    {
      id: 'groq',
      name: 'Groq',
      description: 'Fast inference via Groq API',
    },
    {
      id: 'opencode-zen',
      name: 'OpenCode Zen',
      description: 'Curated, tested models',
    },
    {
      id: 'custom',
      name: 'Custom Provider',
      description: 'Any OpenAI-compatible API',
    },
  ];
}
