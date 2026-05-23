import { useState, useRef, useEffect, useMemo } from 'react';
import { useAction } from 'convex/react';
import { useThreadMessages } from '@convex-dev/agent/react';
import { api } from '../../../convex/_generated/api';
import { MessageBubble } from './MessageBubble';
import { summarizeFromToolCalls } from '../../lib/marketplaceToolMessages';
import { Skeleton } from '../ui/Skeleton';
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

const MARKETPLACE_TOOLS = new Set([
  'search_arkiv_skills',
  'purchase_and_attach_skill',
  'list_attached_skills',
  'attach_existing_skill',
  'detach_attached_skill',
]);

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

/** Text for display — agent messages may only have content parts, not top-level text. */
function getMessageText(msg: {
  text?: string;
  message?: { content?: unknown };
}): string {
  if (typeof msg.text === 'string' && msg.text.trim()) return msg.text.trim();
  const content = msg.message?.content;
  if (typeof content === 'string' && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter((p: { type?: string }) => p.type === 'text')
      .map((p: { text?: string }) => p.text ?? '')
      .join('')
      .trim();
  }
  return '';
}

function toolResultSummary(toolCalls: ToolCall[] | undefined): string | undefined {
  if (!toolCalls?.length) return undefined;
  const withResults = toolCalls.filter((tc) => tc.result?.trim());
  if (!withResults.length) return undefined;
  return summarizeFromToolCalls(withResults);
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
  /** Last completed send — kept until the thread subscription shows the same exchange */
  const [localExchange, setLocalExchange] = useState<{
    userText: string;
    assistantText: string;
    toolCalls?: ToolCall[];
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastThreadMessagesRef = useRef<unknown[] | undefined>(undefined);

  const sendMessage = useAction(api.chat.send);

  // Reactively subscribe to thread messages (streams as agent saves per step)
  const { results: threadMessages } = useThreadMessages(
    api.messages.list,
    threadId ? { threadId } : 'skip',
    { initialNumItems: 100, stream: true },
  );

  if (threadMessages) {
    lastThreadMessagesRef.current = threadMessages;
  }
  const effectiveThreadMessages = threadMessages ?? lastThreadMessagesRef.current;

  // Build a map of toolCallId -> result from tool-role messages
  const toolResultMap = useMemo(() => {
    const map = new Map<string, string>();
    const toolNameByCallId = new Map<string, string>();
    if (!effectiveThreadMessages) return map;

    for (const msg of effectiveThreadMessages) {
      if (msg.message?.role === 'assistant' && Array.isArray(msg.message.content)) {
        for (const part of msg.message.content as Array<{ type?: string; toolCallId?: string; toolName?: string }>) {
          if (part.type === 'tool-call' && part.toolCallId && part.toolName) {
            toolNameByCallId.set(part.toolCallId, part.toolName);
          }
        }
      }
    }

    for (const msg of effectiveThreadMessages) {
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
  }, [effectiveThreadMessages, threadMessages]);

  // Convert thread messages to display format
  const messages: DisplayMessage[] = useMemo(() => {
    const result: DisplayMessage[] = [];
    const threadList = effectiveThreadMessages;

    if (!threadList?.length) {
      const userText = pendingUserMessage ?? localExchange?.userText;
      if (userText) {
        result.push({
          id: 'local-user',
          role: 'user',
          content: userText,
          timestamp: Date.now(),
        });
      }
      if (localExchange?.assistantText.trim()) {
        result.push({
          id: 'local-assistant',
          role: 'assistant',
          content: localExchange.assistantText.trim(),
          timestamp: Date.now(),
          toolCalls: localExchange.toolCalls,
        });
      }
      return result;
    }

    for (const msg of threadList) {
      const role = msg.message?.role;
      if (role !== 'user' && role !== 'assistant') continue;

      const text = getMessageText(msg);

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

      let toolSummary = toolResultSummary(toolCalls);
      if (!toolSummary && toolCalls?.length) {
        const pendingNames = toolCalls.map((tc) => tc.name).join(', ');
        toolSummary = `Running marketplace tools (${pendingNames})…`;
      }

      let displayContent =
        text.trim() ||
        toolSummary ||
        (skillPurchase ? 'Acquiring skill from Arkiv marketplace…' : '');

      if (role === 'assistant' && !displayContent.trim() && !toolCalls?.length && !skillPurchase) {
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

    const hasUserInThread = result.some(
      (m) =>
        m.role === 'user' &&
        (m.content === localExchange?.userText || m.content === pendingUserMessage),
    );
    const hasAssistantInThread = result.some(
      (m) =>
        m.role === 'assistant' &&
        m.content.trim() &&
        !m.content.startsWith('Running marketplace tools'),
    );

    if (localExchange && !hasUserInThread && localExchange.userText.trim()) {
      result.push({
        id: 'local-user',
        role: 'user',
        content: localExchange.userText.trim(),
        timestamp: Date.now(),
      });
    }

    if (
      localExchange?.assistantText.trim() &&
      !hasAssistantInThread
    ) {
      result.push({
        id: 'local-assistant',
        role: 'assistant',
        content: localExchange.assistantText.trim(),
        timestamp: Date.now(),
        toolCalls: localExchange.toolCalls,
      });
    } else if (pendingUserMessage && !hasUserInThread) {
      result.push({
        id: 'pending-user',
        role: 'user',
        content: pendingUserMessage,
        timestamp: Date.now(),
      });
    }

    return result;
  }, [effectiveThreadMessages, toolResultMap, pendingUserMessage, localExchange]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  // Drop local exchange overlay once the thread subscription shows the same messages
  useEffect(() => {
    if (!localExchange || !effectiveThreadMessages?.length) return;
    let hasUser = false;
    let hasAssistant = false;
    for (const msg of effectiveThreadMessages) {
      const role = msg.message?.role;
      const text = getMessageText(msg);
      if (role === 'user' && text === localExchange.userText.trim()) hasUser = true;
      if (role === 'assistant') {
        if (text === localExchange.assistantText.trim()) hasAssistant = true;
        if (Array.isArray(msg.message?.content)) {
          const calls = (msg.message.content as { type?: string; toolName?: string; toolCallId?: string }[])
            .filter((p) => p.type === 'tool-call')
            .map((p) => ({
              name: p.toolName ?? 'unknown',
              result: toolResultMap.get(p.toolCallId ?? '') ?? '',
            }));
          const summary = summarizeFromToolCalls(calls);
          if (summary?.trim() === localExchange.assistantText.trim()) hasAssistant = true;
        }
      }
    }
    if (hasUser && hasAssistant) {
      setLocalExchange(null);
      setPendingUserMessage(null);
    }
  }, [effectiveThreadMessages, toolResultMap, localExchange]);

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
    setLocalExchange(null);

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

      const replyText =
        result.response?.trim() ||
        summarizeFromToolCalls(result.toolCalls ?? []) ||
        '';
      if (replyText || result.toolCalls?.length) {
        setLocalExchange({
          userText: trimmedInput,
          assistantText:
            replyText ||
            'Marketplace search finished — expand the thread if details are still loading.',
          toolCalls: result.toolCalls,
        });
      } else {
        setLocalExchange({
          userText: trimmedInput,
          assistantText: '',
        });
      }

      // Set threadId so subscription activates (important for first message)
      if (result.threadId && result.threadId !== threadId) {
        onThreadChange(result.threadId);
      }
    } catch (err) {
      setError('Failed to send message. Please try again.');
      console.error('Send error:', err);
      setPendingUserMessage(null);
      setLocalExchange(null);
    } finally {
      setIsLoading(false);
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
    setLocalExchange(null);
    setPendingUserMessage(null);
    lastThreadMessagesRef.current = undefined;
    onThreadChange('');
  };

  // Show typing indicator if loading or any message is still streaming
  const hasStreamingMessage = messages.some((m) => m.streaming);
  const showTyping = isLoading || hasStreamingMessage;
  const isThreadLoading = Boolean(threadId) && threadMessages === undefined && !localExchange;

  return (
    <div className="agent-chat">
      <div className="messages-container">
        {isThreadLoading ? (
          <div className="skeleton-chat-main">
            <div className="skeleton-chat-bubble">
              <Skeleton style={{ height: '3rem', width: '14rem', borderRadius: 'var(--radius-lg)' }} />
            </div>
            <div className="skeleton-chat-bubble is-user">
              <Skeleton style={{ height: '2.5rem', width: '10rem', borderRadius: 'var(--radius-lg)' }} />
            </div>
          </div>
        ) : messages.length === 0 && !isLoading ? (
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
