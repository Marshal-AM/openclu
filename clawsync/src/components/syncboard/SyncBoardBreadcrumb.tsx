import { Link } from 'react-router-dom';
import { CaretRight, ArrowLeft } from '@phosphor-icons/react';
import type { SyncBoardBreadcrumbState } from './syncboardBreadcrumbs';

type SyncBoardBreadcrumbProps = SyncBoardBreadcrumbState;

export function SyncBoardBreadcrumb({ items, parentHref }: SyncBoardBreadcrumbProps) {
  return (
    <div className="syncboard-breadcrumb-bar">
      {parentHref ? (
        <Link to={parentHref} className="syncboard-breadcrumb-back" aria-label="Go back">
          <ArrowLeft size={16} weight="bold" />
          <span>Back</span>
        </Link>
      ) : null}

      <nav className="syncboard-breadcrumb" aria-label="Breadcrumb">
        <ol className="syncboard-breadcrumb-list">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={`${item.label}-${index}`} className="syncboard-breadcrumb-item">
                {index > 0 ? (
                  <CaretRight
                    size={12}
                    weight="bold"
                    className="syncboard-breadcrumb-separator"
                    aria-hidden
                  />
                ) : null}
                {item.href && !isLast ? (
                  <Link to={item.href} className="syncboard-breadcrumb-link">
                    {item.label}
                  </Link>
                ) : (
                  <span
                    className={
                      isLast ? 'syncboard-breadcrumb-current' : 'syncboard-breadcrumb-link-static'
                    }
                    aria-current={isLast ? 'page' : undefined}
                  >
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
