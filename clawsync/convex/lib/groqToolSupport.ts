/**
 * Groq chat models (e.g. llama-3.3-70b-versatile) often emit text like
 * `<function=name({...})</function>` instead of OpenAI-style tool_calls,
 * which Groq rejects with code tool_use_failed.
 */

const GROQ_TOOL_CAPABLE_HINTS = ['tool-use', 'llama-4', 'scout'];

export function isGroqWeakToolModel(modelId: string): boolean {
  const id = modelId.toLowerCase();
  if (GROQ_TOOL_CAPABLE_HINTS.some((h) => id.includes(h))) return false;
  if (
    id.includes('llama-3.3') ||
    id.includes('llama-3.1-8b') ||
    id.includes('mixtral')
  ) {
    return true;
  }
  return false;
}

export function groqToolUseHint(modelId: string): string {
  return (
    `Groq model "${modelId}" does not support reliable tool calling. ` +
    'In Sync Board → Models, switch to a tool-capable Groq model such as ' +
    '`meta-llama/llama-4-scout-17b-16e-instruct` or `llama3-groq-70b-8192-tool-use-preview`, ' +
    'or use Anthropic/OpenAI for marketplace chat.'
  );
}

export function parseGroqFailedToolCall(
  failedGeneration: string,
): { name: string; args: Record<string, unknown> } | null {
  const raw = failedGeneration.trim();
  if (!raw) return null;

  const tagged = raw.match(/<function=([a-zA-Z0-9_]+)\s*\(([\s\S]*)\)\s*<\/function>?/i);
  if (tagged) {
    return parseToolNameAndArgs(tagged[1], tagged[2]);
  }

  const bare = raw.match(/^([a-zA-Z0-9_]+)\s*\(([\s\S]*)\)\s*$/);
  if (bare) {
    return parseToolNameAndArgs(bare[1], bare[2]);
  }

  return null;
}

function parseToolNameAndArgs(
  name: string,
  argsSource: string,
): { name: string; args: Record<string, unknown> } | null {
  const trimmed = argsSource.trim();
  if (!trimmed) return { name, args: {} };
  try {
    const args = JSON.parse(trimmed) as Record<string, unknown>;
    return { name, args };
  } catch {
    return null;
  }
}

export function extractGroqFailedGeneration(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const e = error as {
    data?: { error?: { failed_generation?: string } };
    responseBody?: string;
  };
  if (e.data?.error?.failed_generation) {
    return e.data.error.failed_generation;
  }
  if (typeof e.responseBody === 'string') {
    try {
      const body = JSON.parse(e.responseBody) as {
        error?: { failed_generation?: string };
      };
      return body.error?.failed_generation ?? null;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function isGroqToolUseFailed(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { data?: { error?: { code?: string } }; responseBody?: string };
  if (e.data?.error?.code === 'tool_use_failed') return true;
  if (typeof e.responseBody === 'string' && e.responseBody.includes('tool_use_failed')) {
    return true;
  }
  return false;
}
