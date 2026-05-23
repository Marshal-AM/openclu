import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { SyncBoardLayout } from '../components/syncboard/SyncBoardLayout';
import { SyncBoardPageToolbar } from '../components/syncboard/SyncBoardPageToolbar';
import { AgentControls } from '../components/agents/AgentControls';
import { AgentFeedItem } from '../components/agents/AgentFeedItem';
import {
  Trash,
  FloppyDisk,
} from '@phosphor-icons/react';
import { AgentDetailPageSkeleton } from '../components/ui/skeletons';

/**
 * SyncBoardAgentDetail
 *
 * Tabbed config page for a single agent:
 * Overview, Soul, Model, Skills, MCP, Activity
 */

type Tab = 'overview' | 'soul' | 'model' | 'skills' | 'mcp' | 'activity';
type SkillOption = { _id: Id<'skillRegistry'>; name: string; skillType: string; status: string };

export function SyncBoardAgentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const agentId = id as Id<'agents'>;

  const agent = useQuery(api.agents.get, { agentId });
  const skillAssignments = useQuery(api.agentAssignments.listSkills, { agentId });
  const mcpAssignments = useQuery(api.agentAssignments.listMcpServers, { agentId });
  const allSkills = useQuery(api.skillRegistry.list);
  const mcpServers = useQuery(api.mcpServers.list);
  const activityFeed = useQuery(api.activityLog.listByAgent, { agentId, limit: 50 });

  const updateAgent = useMutation(api.agents.update);
  const removeAgent = useMutation(api.agents.remove);
  const assignSkill = useMutation(api.agentAssignments.assignSkill);
  const removeSkill = useMutation(api.agentAssignments.removeSkill);
  const assignMcp = useMutation(api.agentAssignments.assignMcpServer);
  const removeMcp = useMutation(api.agentAssignments.removeMcpServer);

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editProvider, setEditProvider] = useState('');
  const [editSoulDoc, setEditSoulDoc] = useState('');
  const [editSystemPrompt, setEditSystemPrompt] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Initialize edit state from agent data
  if (agent && !initialized) {
    setEditName(agent.name);
    setEditDescription(agent.description || '');
    setEditModel(agent.model);
    setEditProvider(agent.modelProvider);
    setEditSoulDoc(agent.soulDocument || '');
    setEditSystemPrompt(agent.systemPrompt || '');
    setInitialized(true);
  }

  if (!agent) {
    return (
      <SyncBoardLayout dynamicLabel="Agent">
        <div className="syncboard-page">
          <AgentDetailPageSkeleton />
        </div>
      </SyncBoardLayout>
    );
  }

  const handleSave = async () => {
    await updateAgent({
      agentId,
      name: editName,
      description: editDescription || undefined,
      model: editModel,
      modelProvider: editProvider,
      soulDocument: editSoulDoc || undefined,
      systemPrompt: editSystemPrompt || undefined,
    });
  };

  const handleDelete = async () => {
    await removeAgent({ agentId });
    navigate('/syncboard/agents');
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'soul', label: 'Soul' },
    { id: 'model', label: 'Model' },
    { id: 'skills', label: 'Skills' },
    { id: 'mcp', label: 'MCP' },
    { id: 'activity', label: 'Activity' },
  ];

  const assignedSkillIds = new Set(
    skillAssignments?.map((a: { skillId: Id<'skillRegistry'> }) => a.skillId) || [],
  );
  const assignedMcpIds = new Set(
    mcpAssignments?.map((a: { mcpServerId: Id<'mcpServers'> }) => a.mcpServerId) || [],
  );

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 'var(--space-1)',
    display: 'block',
  };

  return (
    <SyncBoardLayout dynamicLabel={agent.name}>
      <div className="syncboard-page">
        <SyncBoardPageToolbar
          description={
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
              {agent.modelProvider}/{agent.model}
            </span>
          }
          actions={<AgentControls agentId={agentId} status={agent.status} mode={agent.mode} />}
        />

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-1)',
            borderBottom: '1px solid var(--border)',
            marginBottom: 'var(--space-4)',
            overflowX: 'auto',
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderBottom:
                  activeTab === tab.id
                    ? '2px solid var(--text-primary)'
                    : '2px solid transparent',
                background: 'transparent',
                color:
                  activeTab === tab.id
                    ? 'var(--text-primary)'
                    : 'var(--text-secondary)',
                fontSize: 'var(--text-sm)',
                fontWeight: activeTab === tab.id ? 600 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ maxWidth: 640 }}>
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={labelStyle}>Name</label>
                <input style={inputStyle} value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <input
                  style={inputStyle}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  onClick={handleSave}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--text-primary)',
                    color: 'var(--bg-primary)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <FloppyDisk size={14} />
                  Save
                </button>
                <button
                  onClick={handleDelete}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: '8px 16px',
                    border: '1px solid var(--error)',
                    borderRadius: 'var(--radius-md)',
                    background: 'transparent',
                    color: 'var(--error)',
                    fontSize: 'var(--text-sm)',
                    cursor: 'pointer',
                  }}
                >
                  <Trash size={14} />
                  Delete Agent
                </button>
              </div>
            </div>
          )}

          {activeTab === 'soul' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={labelStyle}>soul.md</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 200, fontFamily: 'var(--font-mono)', resize: 'vertical' }}
                  value={editSoulDoc}
                  onChange={(e) => setEditSoulDoc(e.target.value)}
                  placeholder="# Soul&#10;&#10;Write the markdown soul document for this agent."
                />
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
                  This is the single soul.md source used by this agent's config.
                </p>
              </div>
              <div>
                <label style={labelStyle}>System Prompt</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                  value={editSystemPrompt}
                  onChange={(e) => setEditSystemPrompt(e.target.value)}
                  placeholder="Additional system prompt (appended after soul)"
                />
              </div>
              <button
                onClick={handleSave}
                style={{
                  alignSelf: 'flex-start',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--text-primary)',
                  color: 'var(--bg-primary)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <FloppyDisk size={14} />
                Save
              </button>
            </div>
          )}

          {activeTab === 'model' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={labelStyle}>Provider</label>
                <select
                  style={inputStyle}
                  value={editProvider}
                  onChange={(e) => setEditProvider(e.target.value)}
                >
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="xai">xAI</option>
                  <option value="groq">Groq</option>
                  <option value="opencode-zen">OpenCode Zen</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Model ID</label>
                <input
                  style={inputStyle}
                  value={editModel}
                  onChange={(e) => setEditModel(e.target.value)}
                />
              </div>
              <button
                onClick={handleSave}
                style={{
                  alignSelf: 'flex-start',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--text-primary)',
                  color: 'var(--bg-primary)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <FloppyDisk size={14} />
                Save
              </button>
            </div>
          )}

          {activeTab === 'skills' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
                Toggle which skills this agent can use.
              </p>
              {allSkills?.map((skill: SkillOption) => {
                const isAssigned = assignedSkillIds.has(skill._id);
                return (
                  <div
                    key={skill._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      background: isAssigned ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{skill.name}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                        {skill.skillType} - {skill.status}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        isAssigned
                          ? removeSkill({ agentId, skillId: skill._id })
                          : assignSkill({ agentId, skillId: skill._id })
                      }
                      style={{
                        padding: '4px 12px',
                        border: isAssigned ? '1px solid var(--error)' : '1px solid var(--text-primary)',
                        borderRadius: 'var(--radius-md)',
                        background: isAssigned ? 'transparent' : 'var(--text-primary)',
                        color: isAssigned ? 'var(--error)' : 'var(--bg-primary)',
                        fontSize: 'var(--text-xs)',
                        cursor: 'pointer',
                      }}
                    >
                      {isAssigned ? 'Remove' : 'Assign'}
                    </button>
                  </div>
                );
              })}
              {(!allSkills || allSkills.length === 0) && (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', padding: 'var(--space-4)' }}>
                  No skills available. Add skills in the Skills section first.
                </div>
              )}
            </div>
          )}

          {activeTab === 'mcp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
                Toggle which MCP servers this agent can connect to.
              </p>
              {mcpServers?.map((server: any) => {
                const isAssigned = assignedMcpIds.has(server._id);
                return (
                  <div
                    key={server._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      background: isAssigned ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{server.name}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {server.url || server.command || 'No URL'}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        isAssigned
                          ? removeMcp({ agentId, mcpServerId: server._id })
                          : assignMcp({ agentId, mcpServerId: server._id })
                      }
                      style={{
                        padding: '4px 12px',
                        border: isAssigned ? '1px solid var(--error)' : '1px solid var(--text-primary)',
                        borderRadius: 'var(--radius-md)',
                        background: isAssigned ? 'transparent' : 'var(--text-primary)',
                        color: isAssigned ? 'var(--error)' : 'var(--bg-primary)',
                        fontSize: 'var(--text-xs)',
                        cursor: 'pointer',
                      }}
                    >
                      {isAssigned ? 'Remove' : 'Assign'}
                    </button>
                  </div>
                );
              })}
              {(!mcpServers || mcpServers.length === 0) && (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', padding: 'var(--space-4)' }}>
                  No MCP servers configured. Add servers in the MCP section first.
                </div>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div>
              {activityFeed && activityFeed.length > 0 ? (
                activityFeed.map((entry: any) => (
                  <AgentFeedItem
                    key={entry._id}
                    entry={entry}
                    agentName={agent.name}
                    agentAvatar={agent.avatar}
                  />
                ))
              ) : (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', padding: 'var(--space-4)' }}>
                  No activity recorded for this agent yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </SyncBoardLayout>
  );
}
