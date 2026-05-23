import type { ArkivQueryTrace } from '../../lib/arkivTrace';
import './ArkivQueryDebugPanel.css';

export function ArkivQueryDebugPanel({
  trace,
  className,
}: {
  trace: ArkivQueryTrace | null | undefined;
  className?: string;
}) {
  if (!trace) return null;

  return (
    <details className={['arkiv-query-debug', className].filter(Boolean).join(' ')}>
      <summary>
        <span className="arkiv-query-debug-dot" aria-hidden />
        Arkiv · {trace.operation}
        <span className="arkiv-query-debug-source">({trace.source})</span>
      </summary>
      <div className="arkiv-query-debug-body">
        <dl className="arkiv-query-debug-meta">
          <dt>Queried</dt>
          <dd>{trace.queriedAt}</dd>
          <dt>Operation</dt>
          <dd>{trace.operation}</dd>
          <dt>Source</dt>
          <dd>{trace.source}</dd>
        </dl>
        {trace.meta && Object.keys(trace.meta).length > 0 ? (
          <div className="arkiv-query-debug-block">
            <p className="arkiv-query-debug-label">Meta</p>
            <pre>{JSON.stringify(trace.meta, null, 2)}</pre>
          </div>
        ) : null}
        <div className="arkiv-query-debug-block">
          <p className="arkiv-query-debug-label">Request</p>
          <pre>{JSON.stringify(trace.request, null, 2)}</pre>
        </div>
        <div className="arkiv-query-debug-block">
          <p className="arkiv-query-debug-label">Response</p>
          <pre>{JSON.stringify(trace.response, null, 2)}</pre>
        </div>
      </div>
    </details>
  );
}
