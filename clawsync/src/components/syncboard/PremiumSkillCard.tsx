import { Link } from 'react-router-dom';
import { Crown } from '@phosphor-icons/react';
import { SkillMarkdownPreview } from './SkillMarkdownPreview';
import './PremiumSkillCard.css';

type PremiumSkillCardProps = {
  skillId: string;
  title: string;
  markdown: string;
  mintingFeeIp: string;
  purchasedAt: number;
  marketplaceTitle?: string;
};

export function PremiumSkillCard({
  skillId,
  title,
  markdown,
  mintingFeeIp,
  purchasedAt,
  marketplaceTitle,
}: PremiumSkillCardProps) {
  return (
    <article className="premium-skill-card">
      <div className="premium-skill-card-glow" aria-hidden />

      <header className="premium-skill-card-header">
        <div className="premium-skill-card-badge">
          <Crown size={14} weight="fill" />
          <span>Purchased skill</span>
        </div>
        <div className="premium-skill-card-price">
          <span className="premium-skill-card-price-label">Paid</span>
          <span className="premium-skill-card-price-value">{mintingFeeIp} IP</span>
        </div>
      </header>

      <div className="premium-skill-card-body">
        <h3 className="premium-skill-card-title">{title}</h3>
        {marketplaceTitle && marketplaceTitle !== title ? (
          <p className="premium-skill-card-subtitle">{marketplaceTitle}</p>
        ) : null}

        <SkillMarkdownPreview content={markdown} variant="card" />
      </div>

      <footer className="premium-skill-card-footer">
        <time className="premium-skill-card-date" dateTime={new Date(purchasedAt).toISOString()}>
          Acquired {new Date(purchasedAt).toLocaleDateString()}
        </time>
        <Link to={`/syncboard/skills/${skillId}`} className="btn btn-primary btn-sm premium-skill-card-cta">
          View skill
        </Link>
      </footer>
    </article>
  );
}
