type CatalogDetail = Record<string, unknown>;

export function CatalogDetailPanel({
  detail,
  onClose,
  purchaseFee,
  walletConfigured,
  walletAddress,
  onPurchase,
  purchaseLoading,
  purchaseError,
  purchaseLogs,
  purchaseElapsedSec,
}: {
  detail: CatalogDetail;
  onClose?: () => void;
  purchaseFee?: string;
  walletConfigured?: boolean;
  walletAddress?: string | null;
  onPurchase?: () => void;
  purchaseLoading?: boolean;
  purchaseError?: string;
  purchaseLogs?: string[];
  purchaseElapsedSec?: number;
}) {
  const payload = detail.payload as Record<string, unknown> | undefined;
  const purchaseView = detail.purchaseView as Record<string, unknown> | undefined;
  return (
    <div className="catalog-detail-panel">
      {onClose ? (
        <div className="catalog-detail-header">
          <h3 className="catalog-detail-title">Full Arkiv catalog entry</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      ) : null}

      {payload && (
        <section className="catalog-detail-section">
          <h4 className="catalog-detail-label">Metadata</h4>
          <dl className="catalog-detail-grid">
            <div>
              <dt>Title</dt>
              <dd>{String(payload.title ?? '')}</dd>
            </div>
            <div>
              <dt>Skill slug</dt>
              <dd className="mono">{String(payload.skillName ?? '')}</dd>
            </div>
            <div className="span-2">
              <dt>Description</dt>
              <dd>{String(payload.description ?? '')}</dd>
            </div>
            <div className="span-2">
              <dt>Triggers</dt>
              <dd className="mono">
                {Array.isArray(payload.triggers)
                  ? (payload.triggers as string[]).join(', ')
                  : '—'}
              </dd>
            </div>
          </dl>
        </section>
      )}

      <section className="catalog-detail-meta">
        {detail.entityKey != null && (
          <p>
            <span className="muted">Entity key:</span>{' '}
            <span className="mono break-all">{String(detail.entityKey)}</span>
          </p>
        )}
        {detail.status != null && (
          <p>
            <span className="muted">Status:</span> {String(detail.status)}
          </p>
        )}
        {detail.arkivVersion != null && (
          <p>
            <span className="muted">Arkiv version:</span> {String(detail.arkivVersion)}
          </p>
        )}
        {purchaseFee && (
          <p>
            <span className="muted">Minting fee:</span> {purchaseFee} IP
          </p>
        )}
        {walletConfigured && walletAddress && (
          <p>
            <span className="muted">Buyer wallet:</span>{' '}
            <span className="mono break-all">{walletAddress}</span>
          </p>
        )}
        {!walletConfigured && (
          <p className="catalog-detail-warn">
            Add AGENT_PRIVATE_KEY to clawsync/.env (local dev) or run npx convex env set
            AGENT_PRIVATE_KEY.
          </p>
        )}
      </section>

      {onPurchase && (
        <div className="catalog-detail-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!walletConfigured || purchaseLoading}
            onClick={onPurchase}
          >
            {purchaseLoading ? 'Purchasing…' : 'Purchase skill'}
          </button>
          {purchaseLoading && purchaseElapsedSec != null && purchaseElapsedSec > 0 && (
            <p className="catalog-detail-hint muted">
              Elapsed: {purchaseElapsedSec}s — still running…
            </p>
          )}
          {purchaseError && <p className="catalog-detail-error">{purchaseError}</p>}
        </div>
      )}

      {purchaseLogs && purchaseLogs.length > 0 && (
        <section className="catalog-detail-log">
          <h4 className="catalog-detail-label">Purchase log</h4>
          <pre className="catalog-detail-log-pre">
            {purchaseLogs.join('\n')}
            {purchaseLoading ? '\n…' : ''}
          </pre>
        </section>
      )}

      <details className="catalog-detail-raw">
        <summary>Raw JSON (full listing + purchase view)</summary>
        <pre>
          {JSON.stringify(
            {
              entityKey: detail.entityKey,
              status: detail.status,
              owner: detail.owner,
              creator: detail.creator,
              arkivVersion: detail.arkivVersion,
              tags: detail.tags,
              payload: detail.payload,
              purchaseView: detail.purchaseView ?? purchaseView,
            },
            null,
            2,
          )}
        </pre>
      </details>
    </div>
  );
}
