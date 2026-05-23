import type { SyncBoardNavItem } from './syncboardNav';

/** Longest matching nav path wins so sibling routes (e.g. skills vs skills/purchase) don't double-highlight. */
export function getActiveNavItemPath(
  pathname: string,
  items: SyncBoardNavItem[],
): string | null {
  let best: SyncBoardNavItem | null = null;

  for (const item of items) {
    if (!isNavItemActive(pathname, item.path, items)) continue;
    if (!best || item.path.length > best.path.length) {
      best = item;
    }
  }

  return best?.path ?? null;
}

function isNavItemActive(
  pathname: string,
  path: string,
  allItems: SyncBoardNavItem[],
): boolean {
  if (pathname === path) return true;
  if (!pathname.startsWith(`${path}/`)) return false;

  const hasMoreSpecificNav = allItems.some(
    (other) =>
      other.path !== path &&
      other.path.startsWith(`${path}/`) &&
      (pathname === other.path || pathname.startsWith(`${other.path}/`)),
  );

  return !hasMoreSpecificNav;
}
