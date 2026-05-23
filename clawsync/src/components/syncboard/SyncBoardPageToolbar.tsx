import type { ReactNode } from 'react';

type SyncBoardPageToolbarProps = {
  description?: ReactNode;
  actions?: ReactNode;
};

export function SyncBoardPageToolbar({ description, actions }: SyncBoardPageToolbarProps) {
  if (!description && !actions) return null;

  return (
    <div className="syncboard-page-toolbar">
      {description ? <div className="syncboard-page-description">{description}</div> : <div />}
      {actions ? <div className="syncboard-page-actions">{actions}</div> : null}
    </div>
  );
}
