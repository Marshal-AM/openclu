import { Link } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { SyncBoardLayout } from '../components/syncboard/SyncBoardLayout';
import { TrainingDataCard } from '../components/syncboard/TrainingDataCard';
import { SkillCardGridSkeleton } from '../components/ui/skeletons';
import '../components/syncboard/PremiumSkillCard.css';
import '../components/syncboard/TrainingDataCard.css';

export function SyncBoardTrainingData() {
  const rows = useQuery(api.trainingDataPurchases.listPurchased);

  return (
    <SyncBoardLayout
      pageActions={
        <Link to="/syncboard/training-data/purchase" className="btn btn-primary">
          Purchase Training Data
        </Link>
      }
    >
      <div className="syncboard-page">
        {!rows ? <SkillCardGridSkeleton count={6} /> : null}

        {rows && rows.length === 0 ? (
          <div className="training-data-empty">
            <p className="training-data-empty-title">No purchased training data yet.</p>
            <p className="training-data-empty-hint">
              Videos you purchase from the marketplace will appear here, ready for local fine-tuning.
            </p>
          </div>
        ) : null}

        {rows && rows.length > 0 ? (
          <div className="premium-skill-grid">
            {rows.map((row) => (
              <TrainingDataCard
                key={row._id}
                id={row._id}
                title={row.title}
                skillName={row.skillName}
                purchasedAt={row.purchasedAt}
              />
            ))}
          </div>
        ) : null}
      </div>

      <style>{`
        .training-data-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          min-height: 12rem;
          padding: var(--space-12) var(--space-6);
          text-align: center;
          background-color: var(--bg-secondary);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border);
        }

        .training-data-empty-title {
          margin: 0;
          font-size: var(--text-base);
          font-weight: 500;
          color: var(--text-primary);
        }

        .training-data-empty-hint {
          margin: 0;
          max-width: 22rem;
          font-size: var(--text-sm);
          line-height: var(--leading-relaxed);
          color: var(--text-secondary);
        }
      `}</style>
    </SyncBoardLayout>
  );
}
