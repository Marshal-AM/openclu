import { Link } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { SyncBoardLayout } from '../components/syncboard/SyncBoardLayout';
import type { Id } from '../../convex/_generated/dataModel';

type RegistrySkill = {
  _id: Id<'skillRegistry'>;
  name: string;
  description: string;
  skillType: string;
  status: string;
  approved: boolean;
  rateLimitPerMinute?: number;
  timeoutMs?: number;
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
  const approveSkill = useMutation(api.skillRegistry.approve);
  const rejectSkill = useMutation(api.skillRegistry.reject);

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

  const getStatusBadge = (skill: RegistrySkill) => {
    if (!skill.approved) return <span className="badge badge-warning">Pending Approval</span>;
    if (skill.status === 'active') return <span className="badge badge-success">Active</span>;
    return <span className="badge">Inactive</span>;
  };

  const getTypeBadge = (type: string) => {
    if (type === 'template') return <span className="badge">Template</span>;
    if (type === 'webhook') return <span className="badge">Webhook</span>;
    if (type === 'code') return <span className="badge">Code</span>;
    return <span className="badge">{type}</span>;
  };

  return (
    <SyncBoardLayout title="Skills">
      <div className="skills-page">
        <div className="page-header">
          <p className="description">
            One registry for every skill your agents can use. Marketplace purchases appear here after
            purchase, and manual skills are added to the same list.
          </p>
          <div className="header-actions">
            <Link to="/syncboard/skills/purchase" className="btn btn-primary">
              Purchase Skills
            </Link>
            <Link to="/syncboard/skills/purchased" className="btn btn-secondary">
              Purchased
            </Link>
            <Link to="/syncboard/skills/new" className="btn btn-secondary">
              Add Manual Skill
            </Link>
          </div>
        </div>

        {syncingPurchases.length > 0 && (
          <div className="syncing-panel">
            <strong>Registering purchased skills</strong>
            <p>
              {syncingPurchases.length} purchased skill{syncingPurchases.length === 1 ? '' : 's'} still
              need registry sync. Open Purchased to retry automatic registration.
            </p>
          </div>
        )}

        {!skills && <p className="description">Loading skills...</p>}

        {skills && skills.length > 0 ? (
          <div className="skills-list">
            {skills.map((skill) => {
              const purchase = purchaseByRegistryId.get(skill._id) ?? purchaseBySkillName.get(skill.name);
              return (
                <div key={skill._id} className="skill-card">
                  <div className="skill-header">
                    <div>
                      <h3 className="skill-name">{skill.name}</h3>
                      {purchase && <p className="skill-source">Purchased from Arkiv as {purchase.title}</p>}
                    </div>
                    <div className="skill-badges">
                      {purchase && <span className="badge badge-success">Purchased</span>}
                      {getTypeBadge(skill.skillType)}
                      {getStatusBadge(skill)}
                    </div>
                  </div>

                  <p className="skill-description">{skill.description}</p>

                  <div className="skill-meta">
                    {skill.rateLimitPerMinute != null && <span>Rate limit: {skill.rateLimitPerMinute}/min</span>}
                    {skill.timeoutMs != null && <span>Timeout: {skill.timeoutMs / 1000}s</span>}
                    {purchase && (
                      <span>
                        Purchased {new Date(purchase.purchasedAt).toLocaleDateString()} · fee {purchase.mintingFeeIp} IP
                      </span>
                    )}
                  </div>

                  <div className="skill-actions">
                    <Link to={`/syncboard/skills/${skill._id}`} className="btn btn-secondary btn-sm">
                      View Details
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
              );
            })}
          </div>
        ) : (
          skills && (
            <div className="empty-state">
              <p>No skills registered yet.</p>
              <Link to="/syncboard/skills/purchase" className="btn btn-primary">
                Browse marketplace
              </Link>
            </div>
          )
        )}
      </div>

      <style>{`
        .skills-page {
          max-width: 980px;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--space-4);
          margin-bottom: var(--space-6);
        }

        .header-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: var(--space-2);
        }

        .description {
          color: var(--text-secondary);
          max-width: 540px;
          margin: 0;
        }

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

        .skills-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .skill-card {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
        }

        .skill-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--space-3);
          margin-bottom: var(--space-2);
        }

        .skill-name {
          font-size: var(--text-lg);
          font-weight: 600;
          margin: 0;
        }

        .skill-source {
          color: var(--text-secondary);
          font-size: var(--text-xs);
          margin: var(--space-1) 0 0;
        }

        .skill-badges {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: var(--space-2);
        }

        .skill-description {
          color: var(--text-secondary);
          font-size: var(--text-sm);
          margin-bottom: var(--space-3);
        }

        .skill-meta {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-4);
          font-size: var(--text-xs);
          color: var(--text-secondary);
          margin-bottom: var(--space-4);
        }

        .skill-actions {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
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
