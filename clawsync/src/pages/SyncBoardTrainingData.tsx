import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { SyncBoardLayout } from '../components/syncboard/SyncBoardLayout';
import { TrainingDataCard } from '../components/syncboard/TrainingDataCard';
import { TrainingDataVideoPlayer } from '../components/syncboard/TrainingDataVideoPlayer';
import { SkillCardGridSkeleton } from '../components/ui/skeletons';
import '../components/syncboard/PremiumSkillCard.css';
import '../components/syncboard/TrainingDataCard.css';
import './SyncBoardPurchaseSkills.css';

export function SyncBoardTrainingData() {
  const rows = useQuery(api.trainingDataPurchases.listPurchased);
  const [selectedId, setSelectedId] = useState<Id<'purchasedTrainingData'> | null>(null);

  const selected = rows?.find((r) => r._id === selectedId);

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
          <div className="empty-state">
            <p>No purchased training data yet.</p>
            <Link to="/syncboard/training-data/purchase" className="btn btn-primary">
              Browse marketplace
            </Link>
          </div>
        ) : null}

        {rows && rows.length > 0 ? (
          <div className="premium-skill-grid">
            {rows.map((row) => (
              <TrainingDataCard
                key={row._id}
                title={row.title}
                skillName={row.skillName}
                purchasedAt={row.purchasedAt}
                selected={selectedId === row._id}
                onSelect={() => setSelectedId(row._id)}
              />
            ))}
          </div>
        ) : null}

        {selected ? (
          <section className="training-data-detail">
            <h2>{selected.title}</h2>
            <p>{selected.description}</p>
            <TrainingDataVideoPlayer
              purchasedId={selected._id}
              skillName={selected.skillName}
              videoMime={selected.videoMime}
            />
          </section>
        ) : null}
      </div>

      <style>{`
        .empty-state {
          text-align: center;
          padding: var(--space-12);
          background-color: var(--bg-secondary);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border);
        }

        .empty-state p {
          color: var(--text-secondary);
          margin-bottom: var(--space-4);
        }
      `}</style>
    </SyncBoardLayout>
  );
}
