import type { CatalogQueryTrace } from '../../lib/catalogTrace';
import './CatalogQueryDebugPanel.css';

export function CatalogQueryDebugPanel({
  trace,
  className,
}: {
  trace: CatalogQueryTrace | null | undefined;
  className?: string;
}) {
  if (!trace) return null;

  return (
    <details className={['catalog-query-debug', className].filter(Boolean).join(' ')}>
      <summary>
        <span className="catalog-query-debug-dot" aria-hidden />
        Catalog · {trace.operation}
        <span className="catalog-query-debug-source">({trace.source})</span>
      </summary>
      <div className="catalog-query-debug-body">
        <dl className="catalog-query-debug-meta">
          <dt>Queried</dt>
          <dd>{trace.queriedAt}</dd>
          <dt>Operation</dt>
          <dd>{trace.operation}</dd>
          <dt>Source</dt>
          <dd>{trace.source}</dd>
        </dl>
        {trace.meta && Object.keys(trace.meta).length > 0 ? (
          <div className="catalog-query-debug-block">
            <p className="catalog-query-debug-label">Meta</p>
            <pre>{JSON.stringify(trace.meta, null, 2)}</pre>
          </div>
        ) : null}
        <div className="catalog-query-debug-block">
          <p className="catalog-query-debug-label">Request</p>
          <pre>{JSON.stringify(trace.request, null, 2)}</pre>
        </div>
        <div className="catalog-query-debug-block">
          <p className="catalog-query-debug-label">Response</p>
          <pre>{JSON.stringify(trace.response, null, 2)}</pre>
        </div>
      </div>
    </details>
  );
}
