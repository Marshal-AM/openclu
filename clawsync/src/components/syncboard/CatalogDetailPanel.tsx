import './CatalogDetailPanel.css';
import { CatalogQueryDebugPanel } from './CatalogQueryDebugPanel';
import type { CatalogQueryTrace } from '../../lib/catalogTrace';

type CatalogDetail = Record<string, unknown>;

type CatalogDetailPanelProps = {
  detail: CatalogDetail;
  catalogTrace?: CatalogQueryTrace | null;
  onClose?: () => void;
  purchaseFee?: string;
  walletConfigured?: boolean;
  onPurchase?: () => void;
  purchaseLoading?: boolean;
  purchaseError?: string;
  purchaseLogs?: string[];
  purchaseElapsedSec?: number;
};

function collectTags(detail: CatalogDetail, payload?: Record<string, unknown>): string[] {
  const fromPayload = Array.isArray(payload?.triggers) ? (payload.triggers as string[]) : [];
  const fromListing = Array.isArray(detail.tags) ? (detail.tags as string[]) : [];
  return [...new Set([...fromPayload, ...fromListing].filter(Boolean))];
}

export function CatalogDetailPanel({
  detail,
  catalogTrace,
  onClose,
  purchaseFee,
  walletConfigured,
  onPurchase,
  purchaseLoading,
  purchaseError,
  purchaseLogs,
}: CatalogDetailPanelProps) {
  const payload = detail.payload as Record<string, unknown> | undefined;
  const purchaseView = detail.purchaseView as Record<string, unknown> | undefined;
  const description = payload?.description ? String(payload.description) : '';
  const tags = collectTags(detail, payload);

  return (
    <div className="catalog-detail-panel">
      {onClose ? (
        <div className="catalog-detail-header">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      ) : null}

      {description ? (
        <section className="catalog-detail-description-block">
          <h3 className="catalog-detail-section-heading">Description</h3>
          <p className="catalog-detail-description">{description}</p>
        </section>
      ) : null}

      {tags.length > 0 ? (
        <section className="catalog-detail-tags">
          <h3 className="catalog-detail-section-heading">Tags</h3>
          <ul className="catalog-detail-tag-list">
            {tags.map((tag) => (
              <li key={tag}>
                <span className="badge catalog-detail-tag-badge">{tag}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!walletConfigured ? (
        <p className="catalog-detail-warn">
          Add AGENT_PRIVATE_KEY to clawsync/.env (local dev) or run npx convex env set
          AGENT_PRIVATE_KEY.
        </p>
      ) : null}

      {onPurchase ? (
        <div className="catalog-detail-actions">
          <button
            type="button"
            className={`btn btn-primary catalog-detail-purchase-btn${purchaseLoading ? ' is-loading' : ''}`}
            disabled={!walletConfigured || purchaseLoading || !purchaseFee}
            onClick={onPurchase}
            aria-label={purchaseFee ? `Buy skill for ${purchaseFee} IP` : 'Buy skill'}
            aria-busy={purchaseLoading}
          >
            {purchaseLoading ? (
              <span className="catalog-detail-purchase-spinner" aria-hidden />
            ) : (
              <span className="catalog-detail-purchase-label">{purchaseFee ? `${purchaseFee} IP` : '—'}</span>
            )}
          </button>
          {purchaseError ? <p className="catalog-detail-error">{purchaseError}</p> : null}
        </div>
      ) : null}

      {!purchaseLoading && purchaseLogs && purchaseLogs.length > 0 ? (
        <section className="catalog-detail-log">
          <h4 className="catalog-detail-section-heading">Purchase log</h4>
          <pre className="catalog-detail-log-pre">{purchaseLogs.join('\n')}</pre>
        </section>
      ) : null}

      <CatalogQueryDebugPanel trace={catalogTrace} />
    </div>
  );
}
