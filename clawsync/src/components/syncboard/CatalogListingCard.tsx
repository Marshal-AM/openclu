import { SkillMarkdownPreview } from './SkillMarkdownPreview';
import './PremiumSkillCard.css';
import './CatalogListingCard.css';

type CatalogListingCardProps = {
  title: string;
  description: string;
  skillName: string;
  status: string;
  mintingFeeIp?: string;
  score?: number;
  onClick: () => void;
};

export function CatalogListingCard({
  title,
  description,
  status,
  mintingFeeIp,
  score,
  onClick,
}: CatalogListingCardProps) {
  return (
    <button
      type="button"
      className="catalog-listing-card"
      onClick={onClick}
      aria-label={mintingFeeIp ? `${title}, ${mintingFeeIp} IP` : title}
    >
      <header className="catalog-listing-card-header">
        <h3 className="catalog-listing-card-title">{title}</h3>
        {mintingFeeIp ? (
          <span className="catalog-listing-card-price">{mintingFeeIp} IP</span>
        ) : null}
      </header>

      <div className="catalog-listing-card-body">
        <SkillMarkdownPreview content={description} variant="card" emptyLabel="No description available" />
      </div>

      <footer className="catalog-listing-card-footer">
        <span className="catalog-listing-card-meta">{status}</span>
        {score != null ? (
          <span className="catalog-listing-card-meta">Match {Math.round(score * 100)}%</span>
        ) : null}
      </footer>
    </button>
  );
}

function getMintingFeeFromPayload(payload?: Record<string, unknown>): string | undefined {
  const purchase = payload?.purchase as Record<string, unknown> | undefined;
  return purchase?.mintingFeeIp != null ? String(purchase.mintingFeeIp) : undefined;
}

export { getMintingFeeFromPayload };
