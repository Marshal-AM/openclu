import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { CaretDown, Robot } from '@phosphor-icons/react';
import { Skeleton } from '../ui/Skeleton';
import { Link } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import './AgentSelector.css';

interface AgentSelectorProps {
  selectedAgentId: Id<'agents'> | null;
  onSelect: (agentId: Id<'agents'>) => void;
}

type AgentListItem = {
  _id: Id<'agents'>;
  name: string;
  status: string;
  isDefault: boolean;
  modelProvider: string;
};

const STATUS_COLORS: Record<string, string> = {
  running: 'var(--success)',
  paused: 'var(--warning)',
  idle: 'var(--accent)',
  error: 'var(--error)',
};

export function AgentSelector({ selectedAgentId, onSelect }: AgentSelectorProps) {
  const agents = useQuery(api.agents.list);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (agents === undefined) {
    return <Skeleton style={{ height: '2.25rem', width: '10rem', borderRadius: 'var(--radius-md)' }} />;
  }

  if (agents.length === 0) {
    return (
      <div className="agent-selector-empty">
        <span>No agents configured.</span>
        <Link to="/syncboard/agents" className="agent-selector-empty-link">
          Create one
        </Link>
      </div>
    );
  }

  const selected =
    agents.find((a: AgentListItem) => a._id === selectedAgentId) ??
    agents.find((a: AgentListItem) => a.isDefault) ??
    agents[0];

  return (
    <div ref={dropdownRef} className="agent-selector">
      <button
        type="button"
        className="agent-selector-trigger"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div
          className="agent-selector-status-dot"
          style={{ background: STATUS_COLORS[selected?.status || 'idle'] || 'var(--accent)' }}
        />
        <Robot size={16} weight="duotone" />
        <span className="agent-selector-label">{selected?.name || 'Select agent'}</span>
        {agents.length > 1 ? <CaretDown size={12} className={isOpen ? 'is-open' : undefined} /> : null}
      </button>

      {isOpen && agents.length > 0 ? (
        <div className="agent-selector-menu" role="listbox">
          {agents.map((agent: AgentListItem) => {
            const isSelected = agent._id === selected?._id;
            return (
              <button
                key={agent._id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`agent-selector-option${isSelected ? ' is-selected' : ''}`}
                onClick={() => {
                  onSelect(agent._id);
                  setIsOpen(false);
                }}
              >
                <div
                  className="agent-selector-status-dot"
                  style={{ background: STATUS_COLORS[agent.status] || 'var(--accent)' }}
                />
                <span className="agent-selector-option-name">{agent.name}</span>
                {agent.isDefault ? <span className="agent-selector-default">default</span> : null}
                <span className="agent-selector-option-model">{agent.modelProvider}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
