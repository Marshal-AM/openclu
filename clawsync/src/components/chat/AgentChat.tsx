import { useState, useRef, useEffect, useMemo } from 'react';
import { useAction } from 'convex/react';
import { useThreadMessages } from '@convex-dev/agent/react';
import { api } from '../../../convex/_generated/api';
import { MessageBubble } from './MessageBubble';
import './AgentChat.css';

interface ToolCall {
  name: string;
  args: string;
  result: string;
}

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  skillPurchase?: { purchaseEventId: string };
  streaming?: boolean;
}

const MARKETPLACE_TOOLS = new Set(['search_arkiv_skills', 'purchase_and_attach_skill']);

function parsePurchaseEventIdFromResult(result: string): string | undefined {
  if (!result) return undefined;
  try {
    const parsed = JSON.parse(result) as { purchaseEventId?: string };
    return parsed.purchaseEventId;
  } catch {
    const m = result.match(/"purchaseEventId"\s*:\s*"([^"]+)"/);
    return m?.[1];
  }
}

function toolResultSummary(toolCalls: ToolCall[] | undefined): string | undefined {
  if (!toolCalls?.length) return undefined;
  for (const tc of toolCalls) {
    if (tc.name !== 'search_arkiv_skills' || !tc.result) continue;
    try {
      const p = JSON.parse(tc.result) as {
        autoPurchased?: boolean;
        purchaseSuccess?: boolean;
        purchaseError?: string;
        hint?: string;
        topMatches?: Array<{ skillName: string; title?: string }>;
      };
      if (p.hint) return p.hint;
      if (p.purchaseInProgress) {
        const name =
          (p as { pickedSkillName?: string }).pickedSkillName ??
          p.topMatches?.[0]?.skillName;
        return `Purchasing "${name ?? 'skill'}"… (see card below).`;
      }
      if (p.autoPurchased && p.topMatches?.[0]) {
        return `Acquired skill "${p.topMatches[0].title ?? p.topMatches[0].skillName}".`;
      }
      if (p.purchaseError) return `Could not acquire skill: ${p.purchaseError}`;
      if (p.topMatches?.length) {
        return `Found ${p.topMatches.length} marketplace skill(s); acquiring…`;
      }
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

interface AgentChatProps {
  sessionId: string;
  threadId: string | null;
  onThreadChange: (threadId: string) => void;
  placeholder?: string;
  maxLength?: number;
  agentId?: string; // Multi-agent support: optional agent ID
}

export function AgentChat({
  sessionId,
  threadId,
  onThreadChange,
  placeholder = 'Ask me anything...',
  maxLength = 4000,
  agentId,
}: AgentChatProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const sendMessage = useAction(api.chat.send);

  // Reactively subscribe to thread messages (streams as agent saves per step)
  const { results: threadMessages } = useThreadMessages(
    api.messages.list,
    threadId ? { threadId } : 'skip',
    { initialNumItems: 100, stream: true },
  );

  // Build a map of toolCallId -> result from tool-role messages
  const toolResultMap = useMemo(() => {
    const map = new Map<string, string>();
    const toolNameByCallId = new Map<string, string>();
    if (!threadMessages) return map;

    for (const msg of threadMessages) {
      if (msg.message?.role === 'assistant' && Array.isArray(msg.message.content)) {
        for (const part of msg.message.content as Array<{ type?: string; toolCallId?: string; toolName?: string }>) {
          if (part.type === 'tool-call' && part.toolCallId && part.toolName) {
            toolNameByCallId.set(part.toolCallId, part.toolName);
          }
        }
      }
    }

    for (const msg of threadMessages) {
      if (msg.message?.role === 'tool' && Array.isArray(msg.message.content)) {
        for (const part of msg.message.content) {
          if (part.type === 'tool-result' && part.toolCallId) {
            const toolName = toolNameByCallId.get(part.toolCallId);
            const raw =
              part.result == null
                ? ''
                : typeof part.result === 'string'
                  ? part.result
                  : JSON.stringify(part.result, null, 2);
            const maxLen = toolName && MARKETPLACE_TOOLS.has(toolName) ? 8000 : 1000;
            map.set(part.toolCallId, raw.slice(0, maxLen));
          }
        }
      }
    }
    return map;
  }, [threadMessages]);

  // Convert thread messages to display format
  const messages: DisplayMessage[] = useMemo(() => {
    const result: DisplayMessage[] = [];
    if (!threadMessages) {
      // Show optimistic user message when subscription hasn't activated yet
      if (pendingUserMessage) {
        result.push({
          id: 'pending-user',
          role: 'user',
          content: pendingUserMessage,
          timestamp: Date.now(),
        });
      }
      return result;
    }

    for (const msg of threadMessages) {
      const role = msg.message?.role;
      if (role !== 'user' && role !== 'assistant') continue;

      const text = msg.text ?? '';

      // Extract tool calls from assistant message content
      let toolCalls: ToolCall[] | undefined;
      if (role === 'assistant' && Array.isArray(msg.message?.content)) {
        const calls = (msg.message!.content as any[])
          .filter((part) => part.type === 'tool-call')
          .map((part) => ({
            name: part.toolName ?? 'unknown',
            args: JSON.stringify(part.args ?? {}, null, 2),
            result: toolResultMap.get(part.toolCallId) ?? '',
          }));
        if (calls.length > 0) toolCalls = calls;
      }

      let skillPurchase: { purchaseEventId: string } | undefined;
      if (toolCalls) {
        for (const tc of toolCalls) {
          const id = parsePurchaseEventIdFromResult(tc.result);
          if (
            id &&
            (tc.name === 'purchase_and_attach_skill' || tc.name === 'search_arkiv_skills')
          ) {
            skillPurchase = { purchaseEventId: id };
            break;
          }
        }
      }

      const toolSummary = toolResultSummary(toolCalls);
      const displayContent =
        text.trim() ||
        toolSummary ||
        (skillPurchase ? 'Acquiring skill from Arkiv marketplace…' : '');

      if (role === 'assistant' && !displayContent.trim() && !toolCalls && !skillPurchase) {
        continue;
      }

      result.push({
        id: (msg as any).key ?? (msg as any)._id ?? `${msg.order}-${msg.stepOrder}`,
        role,
        content: displayContent.trim() || text,
        timestamp: (msg as any)._creationTime ?? Date.now(),
        toolCalls,
        skillPurchase,
        streaming: (msg as any).streaming,
      });
    }

    // Clear pending message once subscription has the user's message
    if (pendingUserMessage && result.some((m) => m.role === 'user' && m.content === pendingUserMessage)) {
      // Will clear on next render cycle
    } else if (pendingUserMessage) {
      // Subscription active but user message not yet saved — show optimistic
      result.push({
        id: 'pending-user',
        role: 'user',
        content: pendingUserMessage,
        timestamp: Date.now(),
      });
    }

    return result;
  }, [threadMessages, toolResultMap, pendingUserMessage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    if (trimmedInput.length > maxLength) {
      setError(`Message too long. Maximum ${maxLength} characters.`);
      return;
    }

    setError(null);
    setInput('');
    setIsLoading(true);
    setPendingUserMessage(trimmedInput);

    try {
      const result = await sendMessage({
        threadId: threadId ?? undefined,
        message: trimmedInput,
        sessionId,
        ...(agentId && { agentId: agentId as any }),
      });

      if (result.error) {
        setError(result.error);
      }

      // Set threadId so subscription activates (important for first message)
      if (result.threadId && result.threadId !== threadId) {
        onThreadChange(result.threadId);
      }
    } catch (err) {
      setError('Failed to send message. Please try again.');
      console.error('Send error:', err);
    } finally {
      setIsLoading(false);
      setPendingUserMessage(null);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleClearChat = () => {
    localStorage.removeItem('clawsync_thread_id');
    onThreadChange('');
  };

  // Show typing indicator if loading or any message is still streaming
  const hasStreamingMessage = messages.some((m) => m.streaming);
  const showTyping = isLoading || hasStreamingMessage;

  return (
    <div className="agent-chat">
      <div className="messages-container">
        {messages.length === 0 && !isLoading ? (
          <div className="empty-state">
            <p>Start a conversation with the agent.</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              role={message.role}
              content={message.content}
              timestamp={message.timestamp}
              toolCalls={message.toolCalls}
              skillPurchase={message.skillPurchase}
            />
          ))
        )}

        {showTyping && (
          <div className="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      <form className="input-form" onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="chat-input"
          disabled={isLoading}
          maxLength={maxLength}
        />
        <button
          type="submit"
          className="send-button btn btn-primary"
          disabled={!input.trim() || isLoading}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>

      {messages.length > 0 && (
        <button className="clear-button btn btn-ghost" onClick={handleClearChat}>
          Clear conversation
        </button>
      )}
    </div>
  );
}
