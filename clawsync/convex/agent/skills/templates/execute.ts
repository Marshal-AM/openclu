'use node';

import { internalAction } from '../../../_generated/server';
import { v } from 'convex/values';
import { internal } from '../../../_generated/api';

/**
 * Template Skill Executor
 *
 * Executes template skills based on templateId.
 * Each template has its own execution logic.
 */
export const execute = internalAction({
  args: {
    templateId: v.string(),
    config: v.string(),
    input: v.string(),
  },
  returns: v.string(),
  handler: async (_ctx, args) => {
    const { templateId, config, input } = args;
    const parsedConfig = JSON.parse(config);

    switch (templateId) {
      case 'api-caller':
        return executeApiCaller(parsedConfig, input);
      case 'calculator':
        return executeCalculator(input);
      case 'rss-fetcher':
        return executeRssFetcher(parsedConfig);
      case 'web-scraper':
        return executeWebScraper(parsedConfig, input);
      case 'knowledge-lookup':
        return executeKnowledgeLookup(parsedConfig, input);
      default:
        throw new Error(`Unknown template: ${templateId}`);
    }
  },
});

/**
 * Webhook Caller - calls external webhooks
 */
export const webhookCaller = internalAction({
  args: {
    config: v.string(),
    input: v.string(),
    skillId: v.id('skillRegistry'),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const { config, input, skillId } = args;
    const parsedConfig = JSON.parse(config);

    const url = parsedConfig.url;
    if (!url) {
      throw new Error('Webhook URL not configured');
    }

    // Get secrets for this skill via proper function reference
    const secrets = await ctx.runQuery(
      internal.skillSecrets.getBySkill,
      { skillId }
    );

    // Build headers with secrets
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...parsedConfig.headers,
    };

    // Replace secret placeholders in headers
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === 'string' && value.startsWith('secret:')) {
        const secretKey = value.replace('secret:', '');
        const secret = secrets?.find((s: { key: string }) => s.key === secretKey);
        if (secret) {
          // In production, decrypt the secret here
          headers[key] = secret.encryptedValue;
        }
      }
    }

    // Make the request (no redirects for SSRF prevention)
    const response = await fetch(url, {
      method: parsedConfig.method || 'POST',
      headers,
      body: JSON.stringify({ input }),
      redirect: 'error', // Prevent SSRF via redirects
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }

    // Enforce response size limit (50KB default)
    const maxSize = parsedConfig.maxResponseSize || 50000;
    const text = await response.text();
    if (text.length > maxSize) {
      return text.slice(0, maxSize) + '...[truncated]';
    }

    return text;
  },
});

// Template implementations

async function executeApiCaller(
  config: { url: string; method?: string; headers?: Record<string, string> },
  input: string
): Promise<string> {
  const response = await fetch(config.url, {
    method: config.method || 'GET',
    headers: config.headers,
    body: config.method === 'POST' ? input : undefined,
    redirect: 'error',
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status}`);
  }

  const text = await response.text();
  // Limit response size
  return text.length > 10000 ? text.slice(0, 10000) + '...[truncated]' : text;
}

function executeCalculator(input: string): string {
  // Simple safe math evaluation
  // In production, use a proper math parser like mathjs
  const sanitized = input.replace(/[^0-9+\-*/().%\s]/g, '');
  try {
    // eslint-disable-next-line no-eval
    const result = Function(`"use strict"; return (${sanitized})`)();
    return String(result);
  } catch {
    throw new Error('Invalid mathematical expression');
  }
}

async function executeRssFetcher(config: { url: string }): Promise<string> {
  const response = await fetch(config.url, { redirect: 'error' });
  if (!response.ok) {
    throw new Error(`RSS fetch failed: ${response.status}`);
  }

  const xml = await response.text();
  // In production, parse XML and return structured data
  return xml.length > 10000 ? xml.slice(0, 10000) + '...[truncated]' : xml;
}

async function executeWebScraper(
  config: { url: string; selector?: string },
  _input: string
): Promise<string> {
  const response = await fetch(config.url, { redirect: 'error' });
  if (!response.ok) {
    throw new Error(`Web scrape failed: ${response.status}`);
  }

  const html = await response.text();
  // In production, use a proper HTML parser and selector
  return html.length > 10000 ? html.slice(0, 10000) + '...[truncated]' : html;
}

function executeKnowledgeLookup(
  config: { knowledge?: string },
  input: string
): string {
  const knowledge = config.knowledge || '';
  if (!knowledge) {
    return 'No knowledge content configured for this skill.';
  }

  // Simple keyword search: if the input query matches lines in the knowledge, return those.
  // Otherwise return the full knowledge text.
  const query = input.toLowerCase();
  const lines = knowledge.split('\n');
  const matches = lines.filter(
    (line) => line.toLowerCase().includes(query)
  );

  if (matches.length > 0 && matches.length < lines.length) {
    return matches.join('\n');
  }

  // Return full knowledge (truncated if very long)
  return knowledge.length > 10000
    ? knowledge.slice(0, 10000) + '...[truncated]'
    : knowledge;
}
