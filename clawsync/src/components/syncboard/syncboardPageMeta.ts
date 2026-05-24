export type SyncBoardPageMeta = {
  title: string;
  subtitle: string;
};

const PAGE_META: Record<string, SyncBoardPageMeta> = {
  '/syncboard/agents': {
    title: 'Agents',
    subtitle: 'Create and manage autonomous agents with skills, models, and memory.',
  },
  '/syncboard/agent-feed': {
    title: 'Agent Feed',
    subtitle: 'Combined activity from all agents in one timeline.',
  },
  '/syncboard/models': {
    title: 'Models',
    subtitle: 'Configure which AI model powers your agents.',
  },
  '/syncboard/skills': {
    title: 'My Skills',
    subtitle: 'One registry for every skill your agents can use.',
  },
  '/syncboard/skills/purchase': {
    title: 'Skills Marketplace',
    subtitle: 'Browse and purchase skills from the Arkiv catalog.',
  },
  '/syncboard/skills/new': {
    title: 'New Skill',
    subtitle: 'Register a custom skill for agent use.',
  },
  '/syncboard/souls': {
    title: 'Souls',
    subtitle: 'Shared soul documents that shape agent personality.',
  },
  '/syncboard/soul': {
    title: 'Soul Document',
    subtitle: 'View and edit the active soul document.',
  },
  '/syncboard/mcp': {
    title: 'MCP Servers',
    subtitle: 'Connect external MCP servers for additional agent tools.',
  },
  '/syncboard/channels': {
    title: 'Channels',
    subtitle: 'Manage messaging channels connected to your agents.',
  },
  '/syncboard/x': {
    title: 'X (Twitter)',
    subtitle: 'Configure X integration for agent posting and monitoring.',
  },
  '/syncboard/agentmail': {
    title: 'AgentMail',
    subtitle: 'Email inboxes and routing for agent communication.',
  },
  '/syncboard/media': {
    title: 'Media',
    subtitle: 'Generate and manage media assets for agents.',
  },
  '/syncboard/stagehand': {
    title: 'Stagehand',
    subtitle: 'Browser automation tools powered by Stagehand.',
  },
  '/syncboard/firecrawl': {
    title: 'Firecrawl',
    subtitle: 'Web crawling and scraping for agent research.',
  },
  '/syncboard/research': {
    title: 'Research',
    subtitle: 'Run structured research tasks across the web.',
  },
  '/syncboard/analytics': {
    title: 'Analytics',
    subtitle: 'Usage metrics and performance across agents and skills.',
  },
  '/syncboard/memory': {
    title: 'Memory',
    subtitle: 'Long-term memory stores shared across agents.',
  },
  '/syncboard/api': {
    title: 'API Keys',
    subtitle: 'Create and manage keys for programmatic access.',
  },
  '/syncboard/threads': {
    title: 'Threads',
    subtitle: 'Conversation threads across agents and channels.',
  },
  '/syncboard/activity': {
    title: 'Activity Log',
    subtitle: 'Audit trail of agent actions and system events.',
  },
  '/syncboard/config': {
    title: 'Configuration',
    subtitle: 'Global SyncBoard settings and defaults.',
  },
  '/syncboard/train-ai': {
    title: 'Train your AI',
    subtitle: 'Fine-tune vision models locally on video frames.',
  },
};

export function resolveSyncBoardPageMeta(
  pathname: string,
  dynamicLabel?: string,
): SyncBoardPageMeta {
  if (PAGE_META[pathname]) {
    return PAGE_META[pathname];
  }

  if (pathname.startsWith('/syncboard/agents/') && dynamicLabel) {
    return {
      title: dynamicLabel,
      subtitle: 'Agent configuration, skills, and activity.',
    };
  }

  if (
    pathname.startsWith('/syncboard/skills/') &&
    pathname !== '/syncboard/skills/purchase' &&
    pathname !== '/syncboard/skills/new' &&
    dynamicLabel
  ) {
    return {
      title: dynamicLabel,
      subtitle: 'Skill details, content, and invocation history.',
    };
  }

  return {
    title: dynamicLabel ?? 'SyncBoard',
    subtitle: 'Manage agents, skills, and integrations.',
  };
}
