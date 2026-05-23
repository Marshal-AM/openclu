import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { SyncBoardSidebar } from './SyncBoardSidebar';
import { SyncBoardBreadcrumb } from './SyncBoardBreadcrumb';
import { SyncBoardPageHeader } from './SyncBoardPageHeader';
import { ThemeToggleButton } from '../theme/ThemeToggleButton';
import { resolveSyncBoardPageMeta } from './syncboardPageMeta';
import { resolveSyncBoardBreadcrumbs } from './syncboardBreadcrumbs';
import './SyncBoardLayout.css';

interface SyncBoardLayoutProps {
  dynamicLabel?: string;
  hidePageHeader?: boolean;
  pageSubtitle?: string;
  pageActions?: ReactNode;
  children: ReactNode;
}

export function SyncBoardLayout({
  dynamicLabel,
  hidePageHeader = false,
  pageSubtitle,
  pageActions,
  children,
}: SyncBoardLayoutProps) {
  const { pathname } = useLocation();
  const breadcrumb = resolveSyncBoardBreadcrumbs(pathname, dynamicLabel);
  const pageMeta = resolveSyncBoardPageMeta(pathname, dynamicLabel);

  return (
    <div className="syncboard">
      <SyncBoardSidebar />

      <main className="syncboard-main">
        <header className="page-header">
          <div className="page-header-inner page-header-bar">
            <SyncBoardBreadcrumb {...breadcrumb} />
            <ThemeToggleButton />
          </div>
        </header>
        <div className="page-content">
          <div className="page-content-inner">
            {!hidePageHeader ? (
              <SyncBoardPageHeader
                title={pageMeta.title}
                subtitle={pageSubtitle ?? pageMeta.subtitle}
                actions={pageActions}
              />
            ) : null}
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
