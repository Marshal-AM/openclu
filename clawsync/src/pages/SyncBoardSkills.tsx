import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { SyncBoardLayout } from '../components/syncboard/SyncBoardLayout';
import { PremiumSkillCard } from '../components/syncboard/PremiumSkillCard';
import { SkillCardGridSkeleton } from '../components/ui/skeletons';
import type { Id } from '../../convex/_generated/dataModel';
import '../components/syncboard/PremiumSkillCard.css';

type RegistrySkill = {
  _id: Id<'skillRegistry'>;
  name: string;
  description: string;
  skillType: string;
  status: string;
  approved: boolean;
};

type PurchasedSkill = {
  _id: Id<'purchasedSkills'>;
  title: string;
  skillName: string;
  status: 'purchased' | 'imported';
  purchasedAt: number;
  mintingFeeIp: string;
  skillRegistryId?: Id<'skillRegistry'>;
};

export function SyncBoardSkills() {
  const skills = useQuery(api.skillRegistry.list) as RegistrySkill[] | undefined;
  const purchased = useQuery(api.skillPurchases.listPurchased) as PurchasedSkill[] | undefined;
  const importSkill = useAction(api.skillPurchaseImport.importPurchasedSkill);
  const approveSkill = useMutation(api.skillRegistry.approve);
  const rejectSkill = useMutation(api.skillRegistry.reject);
  const [importError, setImportError] = useState('');
  const autoImportStarted = useRef(new Set<Id<'purchasedSkills'>>());

  useEffect(() => {
    const pending = purchased?.filter((row) => row.status === 'purchased') ?? [];
    for (const row of pending) {
      if (autoImportStarted.current.has(row._id)) continue;
      autoImportStarted.current.add(row._id);
      void importSkill({ purchasedSkillId: row._id }).catch((e) =>
        setImportError(e instanceof Error ? e.message : String(e)),
      );
    }
  }, [importSkill, purchased]);

  const purchaseByRegistryId = new Map(
    purchased
      ?.filter((row) => row.skillRegistryId)
      .map((row) => [row.skillRegistryId as Id<'skillRegistry'>, row]) ?? [],
  );

  const purchaseBySkillName = new Map(
    purchased?.map((row) => [row.skillName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64), row]) ?? [],
  );

  const syncingPurchases =
    purchased?.filter((row) => row.status === 'purchased' && !row.skillRegistryId) ?? [];

  const purchasedSkills =
    skills?.flatMap((skill) => {
      const purchase = purchaseByRegistryId.get(skill._id) ?? purchaseBySkillName.get(skill.name);
      return purchase ? [{ skill, purchase }] : [];
    }) ?? [];

  const otherSkills =
    skills?.filter((skill) => {
      const purchase = purchaseByRegistryId.get(skill._id) ?? purchaseBySkillName.get(skill.name);
      return !purchase;
    }) ?? [];

  return (
    <SyncBoardLayout
      pageActions={
        <Link to="/syncboard/skills/purchase" className="btn btn-primary">
          Purchase Skills
        </Link>
      }
    >
      <div className="syncboard-page">
        {importError ? <p className="syncboard-page-description" style={{ color: 'var(--error)' }}>{importError}</p> : null}

        {syncingPurchases.length > 0 && (
          <div className="syncing-panel">
            <strong>Registering purchased skills</strong>
            <p>
              {syncingPurchases.length} purchased skill{syncingPurchases.length === 1 ? '' : 's'} still
              need registry sync. They will appear here automatically once registered.
            </p>
          </div>
        )}

        {!skills ? <SkillCardGridSkeleton count={6} /> : null}

        {skills && purchasedSkills.length > 0 ? (
          <div className="premium-skill-grid">
            {purchasedSkills.map(({ skill, purchase }) => (
              <PremiumSkillCard
                key={skill._id}
                skillId={skill._id}
                title={skill.name}
                markdown={skill.description}
                mintingFeeIp={purchase.mintingFeeIp}
                purchasedAt={purchase.purchasedAt}
                marketplaceTitle={purchase.title}
              />
            ))}
          </div>
        ) : null}

        {skills && skills.length === 0 && (
          <div className="empty-state">
            <p>No skills registered yet.</p>
            <Link to="/syncboard/skills/purchase" className="btn btn-primary">
              Browse marketplace
            </Link>
          </div>
        )}

        {skills && skills.length > 0 && purchasedSkills.length === 0 && otherSkills.length === 0 && (
          <div className="empty-state">
            <p>No purchased skills yet.</p>
            <Link to="/syncboard/skills/purchase" className="btn btn-primary">
              Browse marketplace
            </Link>
          </div>
        )}

        {otherSkills.length > 0 ? (
          <section className="other-skills-section">
            <h3 className="other-skills-heading">Other registered skills</h3>
            <div className="other-skills-list">
              {otherSkills.map((skill) => (
                <div key={skill._id} className="other-skill-card">
                  <div className="other-skill-card-main">
                    <h4>{skill.name}</h4>
                    <p>{skill.description.slice(0, 160)}{skill.description.length > 160 ? '…' : ''}</p>
                  </div>
                  <div className="other-skill-card-actions">
                    <Link to={`/syncboard/skills/${skill._id}`} className="btn btn-secondary btn-sm">
                      View
                    </Link>
                    {!skill.approved && (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => void approveSkill({ id: skill._id })}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => void rejectSkill({ id: skill._id })}
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <style>{`
        .syncing-panel {
          padding: var(--space-4);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          background: var(--bg-secondary);
          margin-bottom: var(--space-4);
        }

        .syncing-panel p {
          color: var(--text-secondary);
          font-size: var(--text-sm);
          margin: var(--space-1) 0 0;
        }

        .other-skills-section {
          margin-top: var(--space-8);
        }

        .other-skills-heading {
          margin: 0 0 var(--space-4);
          font-size: var(--text-base);
          font-weight: 600;
          color: var(--text-secondary);
        }

        .other-skills-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .other-skill-card {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--space-4);
          padding: var(--space-4);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          background: var(--bg-secondary);
        }

        .other-skill-card-main h4 {
          margin: 0 0 var(--space-1);
          font-size: var(--text-base);
        }

        .other-skill-card-main p {
          margin: 0;
          font-size: var(--text-sm);
          color: var(--text-secondary);
        }

        .other-skill-card-actions {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
          flex-shrink: 0;
        }

        .btn-sm {
          padding: var(--space-1) var(--space-3);
          font-size: var(--text-xs);
        }

        .empty-state {
          text-align: center;
          padding: var(--space-12);
          background-color: var(--bg-secondary);
          border-radius: var(--radius-lg);
        }

        .empty-state p {
          color: var(--text-secondary);
          margin-bottom: var(--space-4);
        }
      `}</style>
    </SyncBoardLayout>
  );
}
