import { Link } from 'react-router-dom';
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
    <Link to={`/syncboard/skills/${skillId}`} className="premium-skill-card">
      <header className="premium-skill-card-header">
        <div className="premium-skill-card-heading">
          <h3 className="premium-skill-card-title">{title}</h3>
          {marketplaceTitle && marketplaceTitle !== title ? (
            <p className="premium-skill-card-subtitle">{marketplaceTitle}</p>
          ) : null}
        </div>
        <span className="premium-skill-card-price">{mintingFeeIp} IP</span>
      </header>

      <div className="premium-skill-card-body">
        <SkillMarkdownPreview content={markdown} variant="card" />
      </div>

      <footer className="premium-skill-card-footer">
        <time className="premium-skill-card-date" dateTime={new Date(purchasedAt).toISOString()}>
          Acquired {new Date(purchasedAt).toLocaleDateString()}
        </time>
      </footer>
    </Link>
  );
}
