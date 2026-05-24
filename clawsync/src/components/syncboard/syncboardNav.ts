import type { Icon } from '@phosphor-icons/react';
import {
  Brain,
  Robot,
  Lightning,
  Plug,
  DeviceMobile,
  XLogo,
  Key,
  ChatCircle,
  Chats,
  ClipboardText,
  Gear,
  EnvelopeSimple,
  Image,
  VideoCamera,
  Browser,
  Globe,
  MagnifyingGlass,
  ChartLine,
  CloudArrowUp,
  UsersThree,
  BookOpen,
  ListBullets,
  ShoppingCart,
  GraduationCap,
} from '@phosphor-icons/react';
import { marketplaceProductNavPaths } from '../../config/productSurface';

export type SyncBoardNavItem = {
  path: string;
  label: string;
  Icon: Icon;
};

export const syncBoardNavItems: SyncBoardNavItem[] = [
  { path: '/syncboard/agents', label: 'Agents', Icon: UsersThree },
  { path: '/chat', label: 'Chat', Icon: Chats },
  { path: '/syncboard/souls', label: 'Souls', Icon: BookOpen },
  { path: '/syncboard/agent-feed', label: 'Agent Feed', Icon: ListBullets },
  { path: '/syncboard/soul', label: 'Soul Document', Icon: Brain },
  { path: '/syncboard/models', label: 'Models', Icon: Robot },
  { path: '/syncboard/skills', label: 'My Skills', Icon: Lightning },
  { path: '/syncboard/skills/purchase', label: 'Skills Marketplace', Icon: ShoppingCart },
  { path: '/syncboard/training-data', label: 'My Training Data', Icon: VideoCamera },
  { path: '/syncboard/training-data/purchase', label: 'Purchase Training Data', Icon: ShoppingCart },
  { path: '/syncboard/train-ai', label: 'Train your AI', Icon: GraduationCap },
  { path: '/syncboard/mcp', label: 'MCP Servers', Icon: Plug },
  { path: '/syncboard/channels', label: 'Channels', Icon: DeviceMobile },
  { path: '/syncboard/x', label: 'X (Twitter)', Icon: XLogo },
  { path: '/syncboard/agentmail', label: 'AgentMail', Icon: EnvelopeSimple },
  { path: '/syncboard/media', label: 'Media', Icon: Image },
  { path: '/syncboard/stagehand', label: 'Stagehand', Icon: Browser },
  { path: '/syncboard/firecrawl', label: 'Firecrawl', Icon: Globe },
  { path: '/syncboard/research', label: 'Research', Icon: MagnifyingGlass },
  { path: '/syncboard/analytics', label: 'Analytics', Icon: ChartLine },
  { path: '/syncboard/memory', label: 'Memory', Icon: CloudArrowUp },
  { path: '/syncboard/api', label: 'API Keys', Icon: Key },
  { path: '/syncboard/threads', label: 'Threads', Icon: ChatCircle },
  { path: '/syncboard/activity', label: 'Activity Log', Icon: ClipboardText },
  { path: '/syncboard/config', label: 'Configuration', Icon: Gear },
];

export const visibleSyncBoardNavItems = syncBoardNavItems.filter((item) =>
  marketplaceProductNavPaths.has(item.path),
);
