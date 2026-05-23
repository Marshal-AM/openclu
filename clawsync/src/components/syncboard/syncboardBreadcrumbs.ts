export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export type SyncBoardBreadcrumbState = {
  items: BreadcrumbItem[];
  parentHref: string | null;
};

type RouteMatch = {
  test: (pathname: string) => RegExpMatchArray | null;
  resolve: (match: RegExpMatchArray, dynamicLabel?: string) => SyncBoardBreadcrumbState;
};

const routes: RouteMatch[] = [
  {
    test: (p) => p.match(/^\/syncboard\/agents$/),
    resolve: () => ({
      items: [{ label: 'Agents' }],
      parentHref: null,
    }),
  },
  {
    test: (p) => p.match(/^\/syncboard\/agents\/([^/]+)$/),
    resolve: (_m, dynamicLabel) => ({
      items: [
        { label: 'Agents', href: '/syncboard/agents' },
        { label: dynamicLabel ?? 'Agent' },
      ],
      parentHref: '/syncboard/agents',
    }),
  },
  {
    test: (p) => p.match(/^\/syncboard\/agent-feed$/),
    resolve: () => ({
      items: [{ label: 'Agent Feed' }],
      parentHref: null,
    }),
  },
  {
    test: (p) => p.match(/^\/syncboard\/models$/),
    resolve: () => ({
      items: [{ label: 'Models' }],
      parentHref: null,
    }),
  },
  {
    test: (p) => p.match(/^\/syncboard\/skills$/),
    resolve: () => ({
      items: [{ label: 'Skills' }],
      parentHref: null,
    }),
  },
  {
    test: (p) => p.match(/^\/syncboard\/skills\/purchase$/),
    resolve: () => ({
      items: [
        { label: 'Skills', href: '/syncboard/skills' },
        { label: 'Purchase Agent Skills' },
      ],
      parentHref: '/syncboard/skills',
    }),
  },
  {
    test: (p) => p.match(/^\/syncboard\/skills\/purchased$/),
    resolve: () => ({
      items: [
        { label: 'Skills', href: '/syncboard/skills' },
        { label: 'My Purchased Skills' },
      ],
      parentHref: '/syncboard/skills',
    }),
  },
  {
    test: (p) => p.match(/^\/syncboard\/skills\/([^/]+)$/),
    resolve: (_m, dynamicLabel) => ({
      items: [
        { label: 'Skills', href: '/syncboard/skills' },
        { label: dynamicLabel ?? 'Skill' },
      ],
      parentHref: '/syncboard/skills',
    }),
  },
];

export function resolveSyncBoardBreadcrumbs(
  pathname: string,
  dynamicLabel?: string,
): SyncBoardBreadcrumbState {
  for (const route of routes) {
    const match = route.test(pathname);
    if (match) return route.resolve(match, dynamicLabel);
  }

  return {
    items: [{ label: 'SyncBoard' }],
    parentHref: null,
  };
}
