import type { Id } from '../../convex/_generated/dataModel';

const SELECTED_AGENT_KEY = 'clawsync_selected_agent';
const LEGACY_THREAD_KEY = 'clawsync_thread_id';

export function threadStorageKey(agentId: Id<'agents'>): string {
  return `clawsync_thread_${agentId}`;
}

export function getStoredSelectedAgentId(): Id<'agents'> | null {
  const stored = localStorage.getItem(SELECTED_AGENT_KEY);
  return stored ? (stored as Id<'agents'>) : null;
}

export function setStoredSelectedAgentId(agentId: Id<'agents'>): void {
  localStorage.setItem(SELECTED_AGENT_KEY, agentId);
}

export function getStoredThreadId(agentId: Id<'agents'> | null): string | null {
  if (agentId) {
    return localStorage.getItem(threadStorageKey(agentId));
  }
  return localStorage.getItem(LEGACY_THREAD_KEY);
}

export function setStoredThreadId(agentId: Id<'agents'> | null, threadId: string): void {
  if (agentId) {
    localStorage.setItem(threadStorageKey(agentId), threadId);
    return;
  }
  localStorage.setItem(LEGACY_THREAD_KEY, threadId);
}

export function clearStoredThreadId(agentId: Id<'agents'> | null): void {
  if (agentId) {
    localStorage.removeItem(threadStorageKey(agentId));
  }
  localStorage.removeItem(LEGACY_THREAD_KEY);
}

export function openChatWithAgent(agentId: Id<'agents'>, freshThread = false): string {
  setStoredSelectedAgentId(agentId);
  if (freshThread) {
    clearStoredThreadId(agentId);
  }
  return '/chat';
}
