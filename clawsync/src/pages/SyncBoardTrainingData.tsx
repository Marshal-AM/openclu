import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { SyncBoardLayout } from '../components/syncboard/SyncBoardLayout';
import { TrainingDataVideoPlayer } from '../components/syncboard/TrainingDataVideoPlayer';

export function SyncBoardTrainingData() {
  const rows = useQuery(api.trainingDataPurchases.listPurchased);
  const [selectedId, setSelectedId] = useState<Id<'purchasedTrainingData'> | null>(null);

  const selected = rows?.find((r) => r._id === selectedId);

  return (
    <SyncBoardLayout>
      <div className="syncboard-page">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="syncboard-page-title">My Training Data</h1>
            <p className="text-sm text-muted-foreground">
              Purchased training data videos decrypted on this machine.
            </p>
          </div>
          <Link className="syncboard-btn syncboard-btn-secondary" to="/syncboard/training-data/purchase">
            Purchase Training Data
          </Link>
        </div>

        {!rows?.length ? (
          <p className="purchase-hint">No purchased training data yet.</p>
        ) : (
          <ul className="mb-6 space-y-2">
            {rows.map((row) => (
              <li key={row._id}>
                <button
                  type="button"
                  className="w-full rounded-lg border px-4 py-3 text-left hover:bg-muted/50"
                  onClick={() => setSelectedId(row._id)}
                >
                  <span className="font-medium">{row.title}</span>
                  <span className="ml-2 text-sm text-muted-foreground">{row.skillName}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected ? (
          <section className="rounded-lg border p-4">
            <h2 className="mb-2 text-lg font-medium">{selected.title}</h2>
            <p className="mb-4 text-sm text-muted-foreground">{selected.description}</p>
            <TrainingDataVideoPlayer
              purchasedId={selected._id}
              skillName={selected.skillName}
              videoMime={selected.videoMime}
            />
          </section>
        ) : null}
      </div>
    </SyncBoardLayout>
  );
}
