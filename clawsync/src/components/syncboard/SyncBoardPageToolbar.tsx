import type { ReactNode } from 'react';

type SyncBoardPageToolbarProps = {
  actions?: ReactNode;
};

export function SyncBoardPageToolbar({ actions }: SyncBoardPageToolbarProps) {
  if (!actions) return null;

  return <div className="syncboard-page-actions-row">{actions}</div>;
};
