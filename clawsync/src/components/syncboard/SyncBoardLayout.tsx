import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { SyncBoardSidebar } from './SyncBoardSidebar';
import { SyncBoardBreadcrumb } from './SyncBoardBreadcrumb';
import { resolveSyncBoardBreadcrumbs } from './syncboardBreadcrumbs';
import './SyncBoardLayout.css';

interface SyncBoardLayoutProps {
  dynamicLabel?: string;
  children: ReactNode;
}

export function SyncBoardLayout({ dynamicLabel, children }: SyncBoardLayoutProps) {
  const { pathname } = useLocation();
  const breadcrumb = resolveSyncBoardBreadcrumbs(pathname, dynamicLabel);

  return (
    <div className="syncboard">
      <SyncBoardSidebar />

      <main className="syncboard-main">
        <header className="page-header">
          <SyncBoardBreadcrumb {...breadcrumb} />
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
