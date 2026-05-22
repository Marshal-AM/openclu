import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { SyncBoardLayout } from '../components/syncboard/SyncBoardLayout';
import './SyncBoardPurchasedSkills.css';

type PurchasedSkillRow = {
  _id: Id<'purchasedSkills'>;
  title: string;
  skillName: string;
  description: string;
  status: 'purchased' | 'imported';
  purchasedAt: number;
  mintingFeeIp: string;
  skillRegistryId?: Id<'skillRegistry'>;
};

export function SyncBoardPurchasedSkills() {
  const purchased = useQuery(api.skillPurchases.listPurchased) as PurchasedSkillRow[] | undefined;
  const importSkill = useAction(api.skillPurchaseImport.importPurchasedSkill);
  const getPreview = useAction(api.skillPurchaseActions.getSkillPreview);

  const [autoImportingIds, setAutoImportingIds] = useState<Set<Id<'purchasedSkills'>>>(new Set());
  const [previewId, setPreviewId] = useState<Id<'purchasedSkills'> | null>(null);
  const [previewText, setPreviewText] = useState('');
  const [error, setError] = useState('');
  const autoImportStarted = useRef(new Set<Id<'purchasedSkills'>>());

  useEffect(() => {
    const pending = purchased?.filter((row) => row.status === 'purchased') ?? [];
    for (const row of pending) {
      if (autoImportStarted.current.has(row._id)) continue;
      autoImportStarted.current.add(row._id);
      setAutoImportingIds((prev) => new Set(prev).add(row._id));
      void importSkill({ purchasedSkillId: row._id })
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => {
          setAutoImportingIds((prev) => {
            const next = new Set(prev);
            next.delete(row._id);
            return next;
          });
        });
    }
  }, [importSkill, purchased]);

  async function handlePreview(id: Id<'purchasedSkills'>) {
    setPreviewId(id);
    try {
      const result = await getPreview({ id });
      setPreviewText(result.found ? result.excerpt : '(SKILL.md not found)');
    } catch (e) {
      setPreviewText(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <SyncBoardLayout title="My Purchased Skills">
      <div className="purchased-skills-page">
        <p className="description">
          Skills you bought from the Arkiv marketplace. Purchases are automatically registered in
          Skills and enabled on the default agent.
        </p>
        <p className="description">
          <Link to="/syncboard/skills/purchase" className="link">
            Browse marketplace →
          </Link>
        </p>

        {error && <p className="purchased-error">{error}</p>}

        {!purchased && <p className="purchased-hint">Loading…</p>}

        {purchased && purchased.length === 0 && (
          <p className="purchased-hint">No purchases yet. Use Purchase Agent Skills to buy from the catalog.</p>
        )}

        <ul className="purchased-list">
          {purchased?.map((row) => (
            <li key={row._id} className="purchased-card">
              <div className="purchased-card-main">
                <h3>{row.title}</h3>
                <p className="purchased-slug">{row.skillName}</p>
                <p className="purchased-meta">
                  {row.status} · {new Date(row.purchasedAt).toLocaleString()} · fee {row.mintingFeeIp} IP
                </p>
                <p className="purchased-desc">{row.description}</p>
              </div>
              <div className="purchased-card-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => void handlePreview(row._id)}
                >
                  Preview SKILL.md
                </button>
                {row.status === 'purchased' && (
                  <span className="purchased-status-pill">
                    {autoImportingIds.has(row._id) ? 'Registering with agent…' : 'Waiting to register'}
                  </span>
                )}
                {row.status === 'imported' && row.skillRegistryId && (
                  <Link
                    to={`/syncboard/skills/${row.skillRegistryId}`}
                    className="btn btn-secondary btn-sm"
                  >
                    View in Skills
                  </Link>
                )}
              </div>
              {previewId === row._id && (
                <pre className="purchased-preview">{previewText}</pre>
              )}
            </li>
          ))}
        </ul>
      </div>
    </SyncBoardLayout>
  );
}
