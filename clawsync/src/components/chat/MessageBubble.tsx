import ReactMarkdown from 'react-markdown';
import { SkillAcquiredCard } from './SkillAcquiredCard';
import './MessageBubble.css';

interface ToolCall {
  name: string;
  args: string;
  result: string;
}

const HIDDEN_TOOL_NAMES = new Set(['search_arkiv_skills', 'purchase_and_attach_skill']);

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  skillPurchase?: { purchaseEventId: string };
}

function parsePurchaseEventId(toolCalls?: ToolCall[]): string | undefined {
  if (!toolCalls) return undefined;
  for (const tc of toolCalls) {
    if (
      tc.name !== 'purchase_and_attach_skill' &&
      tc.name !== 'search_arkiv_skills'
    ) {
      continue;
    }
    if (!tc.result) continue;
    try {
      const parsed = JSON.parse(tc.result) as { purchaseEventId?: string };
      if (parsed.purchaseEventId) return parsed.purchaseEventId;
    } catch {
      const m = tc.result.match(/"purchaseEventId"\s*:\s*"([^"]+)"/);
      if (m?.[1]) return m[1];
    }
  }
  return undefined;
}

export function MessageBubble({
  role,
  content,
  timestamp,
  toolCalls,
  skillPurchase,
}: MessageBubbleProps) {
  const formattedTime = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const visibleToolCalls = toolCalls?.filter((tc) => !HIDDEN_TOOL_NAMES.has(tc.name));
  const purchaseEventId =
    skillPurchase?.purchaseEventId ?? parsePurchaseEventId(toolCalls);

  return (
    <div className={`message-bubble ${role}`}>
      {visibleToolCalls && visibleToolCalls.length > 0 && (
        <div className="tool-calls">
          {visibleToolCalls.map((tc, i) => (
            <details key={i} className="tool-call">
              <summary className="tool-call-summary">
                <span className="tool-call-icon">&#9881;</span>
                <span className="tool-call-name">{tc.name}</span>
                <span className="tool-call-badge">tool call</span>
              </summary>
              <div className="tool-call-details">
                <div className="tool-call-section">
                  <strong>Input:</strong>
                  <pre className="tool-call-json">{tc.args}</pre>
                </div>
                {tc.result && (
                  <div className="tool-call-section">
                    <strong>Output:</strong>
                    <pre className="tool-call-json">{tc.result}</pre>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
      {content.trim() && (
        <div className="message-content">
          {role === 'assistant' ? (
            <ReactMarkdown
              components={{
                code: ({ children, className }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code className="inline-code">{children}</code>
                  ) : (
                    <pre className="code-block">
                      <code>{children}</code>
                    </pre>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          ) : (
            <p>{content}</p>
          )}
        </div>
      )}
      {role === 'assistant' && purchaseEventId && (
        <SkillAcquiredCard purchaseEventId={purchaseEventId} />
      )}
      <span className="message-time">{formattedTime}</span>
    </div>
  );
}
