import type { ReactNode } from 'react';

type SyncBoardPageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function SyncBoardPageHeader({ title, subtitle, actions }: SyncBoardPageHeaderProps) {
  return (
    <header className="syncboard-page-header">
      <div className="syncboard-page-header-text">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="syncboard-page-header-actions">{actions}</div> : null}
    </header>
  );
}
