import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { AgentChat } from '../components/chat/AgentChat';
import { ActivityFeed } from '../components/chat/ActivityFeed';
import { AgentSelector } from '../components/agents/AgentSelector';
import { SHOW_CHAT_ACTIVITY_FEED } from '../config/productSurface';
import { ChatPageSkeleton } from '../components/ui/skeletons';
import {
  getStoredSelectedAgentId,
  getStoredThreadId,
  setStoredSelectedAgentId,
  setStoredThreadId,
} from '../lib/chatAgentStorage';
import './ChatPage.css';

type AgentListItem = {
  _id: Id<'agents'>;
  isDefault?: boolean;
  name?: string;
  modelProvider?: string;
  model?: string;
};

export function ChatPage() {
  const location = useLocation();
  const [sessionId] = useState(() => {
    const stored = localStorage.getItem('clawsync_session_id');
    if (stored) return stored;
    const newId = crypto.randomUUID();
    localStorage.setItem('clawsync_session_id', newId);
    return newId;
  });

  const [selectedAgentId, setSelectedAgentId] = useState<Id<'agents'> | null>(() => getStoredSelectedAgentId());

  const [threadId, setThreadId] = useState<string | null>(() => {
    return getStoredThreadId(getStoredSelectedAgentId());
  });

  const agents = useQuery(api.agents.list);
  const agentConfig = useQuery(api.agentConfig.get);
  const uiConfig = agentConfig?.uiConfig ? JSON.parse(agentConfig.uiConfig) : null;

  const activeAgent = useMemo(() => {
    if (!agents?.length) return null;
    if (selectedAgentId) {
      return agents.find((a: AgentListItem) => a._id === selectedAgentId) ?? null;
    }
    return agents.find((a: AgentListItem) => a.isDefault) ?? agents[0];
  }, [agents, selectedAgentId]);

  useEffect(() => {
    const stored = getStoredSelectedAgentId();
    if (stored && stored !== selectedAgentId) {
      setSelectedAgentId(stored);
      setThreadId(getStoredThreadId(stored));
    }
  }, [location.key, selectedAgentId]);

  useEffect(() => {
    if (!selectedAgentId && activeAgent) {
      setSelectedAgentId(activeAgent._id);
      setStoredSelectedAgentId(activeAgent._id);
      setThreadId(getStoredThreadId(activeAgent._id));
    }
  }, [selectedAgentId, activeAgent]);

  useEffect(() => {
    if (threadId && selectedAgentId) {
      setStoredThreadId(selectedAgentId, threadId);
    }
  }, [threadId, selectedAgentId]);

  const handleAgentSelect = (agentId: Id<'agents'>) => {
    setSelectedAgentId(agentId);
    setStoredSelectedAgentId(agentId);
    setThreadId(getStoredThreadId(agentId));
  };

  const chatAgentId = selectedAgentId ?? activeAgent?._id;

  if (agents === undefined) {
    return <ChatPageSkeleton />;
  }

  return (
    <div className="chat-page">
      <header className="chat-header">
        <div className="chat-header-content">
          <div className="chat-header-agent">
            <span className="chat-header-kicker">Chatting with</span>
            <AgentSelector selectedAgentId={chatAgentId ?? null} onSelect={handleAgentSelect} />
            {uiConfig?.showModelBadge !== false && activeAgent ? (
              <span className="badge" title={`Provider: ${activeAgent.modelProvider}`}>
                {activeAgent.modelProvider}/{activeAgent.model}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <main className="chat-main">
        <div className="chat-container">
          {chatAgentId ? (
            <AgentChat
              key={chatAgentId}
              sessionId={sessionId}
              threadId={threadId}
              onThreadChange={setThreadId}
              placeholder={uiConfig?.chatPlaceholder || 'Ask me anything...'}
              maxLength={uiConfig?.maxMessageLength || 4000}
              agentId={chatAgentId}
            />
          ) : (
            <div className="chat-empty-agents">
              <p>Create an agent in SyncBoard to start chatting.</p>
            </div>
          )}
        </div>

        {SHOW_CHAT_ACTIVITY_FEED && uiConfig?.showActivityFeed !== false ? (
          <aside className="activity-sidebar">
            <ActivityFeed />
          </aside>
        ) : null}
      </main>
    </div>
  );
}
