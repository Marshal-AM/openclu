import { useState, useEffect, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { AgentChat } from '../components/chat/AgentChat';
import { ActivityFeed } from '../components/chat/ActivityFeed';
import { AgentSelector } from '../components/agents/AgentSelector';
import './ChatPage.css';

export function ChatPage() {
  const [sessionId] = useState(() => {
    const stored = localStorage.getItem('clawsync_session_id');
    if (stored) return stored;
    const newId = crypto.randomUUID();
    localStorage.setItem('clawsync_session_id', newId);
    return newId;
  });

  const [threadId, setThreadId] = useState<string | null>(() => {
    return localStorage.getItem('clawsync_thread_id');
  });

  const [selectedAgentId, setSelectedAgentId] = useState<Id<'agents'> | null>(() => {
    const stored = localStorage.getItem('clawsync_selected_agent');
    return stored ? (stored as Id<'agents'>) : null;
  });

  const agents = useQuery(api.agents.list);
  const agentConfig = useQuery(api.agentConfig.get);
  const uiConfig = agentConfig?.uiConfig ? JSON.parse(agentConfig.uiConfig) : null;

  const activeAgent = useMemo(() => {
    if (!agents?.length) return null;
    if (selectedAgentId) {
      return agents.find((a) => a._id === selectedAgentId) ?? null;
    }
    return agents.find((a) => a.isDefault) ?? agents[0];
  }, [agents, selectedAgentId]);

  useEffect(() => {
    if (!selectedAgentId && activeAgent) {
      setSelectedAgentId(activeAgent._id);
      localStorage.setItem('clawsync_selected_agent', activeAgent._id);
    }
  }, [selectedAgentId, activeAgent]);

  useEffect(() => {
    if (threadId) {
      localStorage.setItem('clawsync_thread_id', threadId);
    }
  }, [threadId]);

  const handleAgentSelect = (agentId: Id<'agents'>) => {
    setSelectedAgentId(agentId);
    localStorage.setItem('clawsync_selected_agent', agentId);
    setThreadId(null);
    localStorage.removeItem('clawsync_thread_id');
  };

  const chatAgentId = selectedAgentId ?? activeAgent?._id;

  return (
    <div className="chat-page">
      <header className="chat-header">
        <div className="chat-header-content">
          <h1 className="chat-title">{activeAgent?.name || agentConfig?.name || 'ClawSync Agent'}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <AgentSelector
              selectedAgentId={chatAgentId ?? null}
              onSelect={handleAgentSelect}
            />
            {uiConfig?.showModelBadge !== false && activeAgent && (
              <span className="badge" title={`Provider: ${activeAgent.modelProvider}`}>
                {activeAgent.modelProvider}/{activeAgent.model}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="chat-main">
        <div className="chat-container">
          <AgentChat
            sessionId={sessionId}
            threadId={threadId}
            onThreadChange={setThreadId}
            placeholder={uiConfig?.chatPlaceholder || 'Ask me anything...'}
            maxLength={uiConfig?.maxMessageLength || 4000}
            agentId={chatAgentId}
          />
        </div>

        {uiConfig?.showActivityFeed !== false && (
          <aside className="activity-sidebar">
            <ActivityFeed />
          </aside>
        )}
      </main>
    </div>
  );
}
