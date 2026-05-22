export const PRODUCT_HOME_PATH = '/syncboard/skills/purchase';
export const SHOW_CHAT_ACTIVITY_FEED = false;

const MARKETPLACE_PRODUCT_ROUTES = [
  '/',
  '/chat',
  '/setup',
  '/syncboard',
  '/syncboard/agents',
  '/syncboard/agent-feed',
  '/syncboard/models',
  '/syncboard/skills',
  '/syncboard/skills/new',
  '/syncboard/skills/purchase',
  '/syncboard/skills/purchased',
  '/syncboard/api',
] as const;

export const marketplaceProductNavPaths = new Set<string>([
  '/syncboard',
  '/syncboard/agents',
  '/syncboard/agent-feed',
  '/syncboard/models',
  '/syncboard/skills',
  '/syncboard/skills/purchase',
  '/syncboard/skills/purchased',
  '/syncboard/api',
]);

export function isMarketplaceProductRoute(pathname: string): boolean {
  if ((MARKETPLACE_PRODUCT_ROUTES as readonly string[]).includes(pathname)) {
    return true;
  }

  return pathname.startsWith('/syncboard/agents/') || pathname.startsWith('/syncboard/skills/');
}
