import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { SyncBoardLayout } from '../components/syncboard/SyncBoardLayout';
import { SyncBoardPageToolbar } from '../components/syncboard/SyncBoardPageToolbar';
import { SkillMarkdownPreview } from '../components/syncboard/SkillMarkdownPreview';
import { Id } from '../../convex/_generated/dataModel';
import '../components/syncboard/PremiumSkillCard.css';
import { SkillDetailPageSkeleton, MarkdownBlockSkeleton } from '../components/ui/skeletons';

type PurchasedSkill = {
  _id: Id<'purchasedSkills'>;
  title: string;
  skillName: string;
  purchasedAt: number;
  mintingFeeIp: string;
  skillRegistryId?: Id<'skillRegistry'>;
};

export function SyncBoardSkillDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const skillId = id as Id<'skillRegistry'>;

  const skill = useQuery(api.skillRegistry.get, { id: skillId });
  const purchased = useQuery(api.skillPurchases.listPurchased) as PurchasedSkill[] | undefined;
  const invocations = useQuery(api.skillInvocations.listBySkill, {
    skillName: skill?.name ?? '',
    limit: 20,
  });
  const summary = useQuery(api.skillSummary.getBySkill, {
    skillName: skill?.name ?? '',
  });

  const approveSkill = useMutation(api.skillRegistry.approve);
  const updateSkill = useMutation(api.skillRegistry.update);
  const deleteSkill = useMutation(api.skillRegistry.remove);
  const getSkillPreview = useAction(api.skillPurchaseActions.getSkillPreview);

  const [markdown, setMarkdown] = useState('');
  const [markdownLoading, setMarkdownLoading] = useState(false);

  const purchase = purchased?.find((row) => row.skillRegistryId === skillId);

  useEffect(() => {
    if (!skill) return;

    if (!purchase) {
      setMarkdown(skill.description);
      return;
    }

    let cancelled = false;
    setMarkdownLoading(true);

    void getSkillPreview({ registryId: skillId, full: true })
      .then((result) => {
        if (cancelled) return;
        setMarkdown(result.found ? result.excerpt : skill.description);
      })
      .catch(() => {
        if (!cancelled) setMarkdown(skill.description);
      })
      .finally(() => {
        if (!cancelled) setMarkdownLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [getSkillPreview, purchase, skill, skillId]);

  if (!skill) {
    return (
      <SyncBoardLayout dynamicLabel="Skill">
        <div className="syncboard-page">
          <SkillDetailPageSkeleton />
        </div>
      </SyncBoardLayout>
    );
  }

  const handleToggleStatus = async () => {
    await updateSkill({
      id: skill._id,
      status: skill.status === 'active' ? 'inactive' : 'active',
    });
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this skill?')) {
      await deleteSkill({ id: skill._id });
      navigate('/syncboard/skills');
    }
  };

  if (purchase) {
    return (
      <SyncBoardLayout dynamicLabel={skill.name}>
        <div className="syncboard-page premium-skill-detail-page">
          <div className="premium-skill-detail">
            <aside className="premium-skill-detail-card">
              <header className="premium-skill-detail-header">
                <div className="premium-skill-detail-heading">
                  <h1 className="premium-skill-detail-title">{skill.name}</h1>
                  {purchase.title !== skill.name ? (
                    <p className="premium-skill-detail-subtitle">{purchase.title}</p>
                  ) : null}
                </div>
                <span className="premium-skill-detail-price">{purchase.mintingFeeIp} IP</span>
              </header>

              <dl className="premium-skill-detail-meta">
                <div>
                  <dt>Acquired</dt>
                  <dd>{new Date(purchase.purchasedAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{skill.status === 'active' ? 'Active on agents' : 'Inactive'}</dd>
                </div>
              </dl>

              <div className="premium-skill-detail-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => void handleToggleStatus()}>
                  {skill.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </aside>

            <section className="premium-skill-detail-content">
              <h2 className="premium-skill-detail-content-label">Skill content</h2>
              {markdownLoading ? (
                <MarkdownBlockSkeleton />
              ) : (
                <SkillMarkdownPreview content={markdown} variant="detail" />
              )}
            </section>
          </div>
        </div>
      </SyncBoardLayout>
    );
  }

  return (
    <SyncBoardLayout dynamicLabel={skill.name}>
      <div className="skill-detail syncboard-page">
        <SyncBoardPageToolbar
          description={<p>{skill.description}</p>}
          actions={
            <>
              {!skill.approved && (
                <button type="button" className="btn btn-primary" onClick={() => void approveSkill({ id: skill._id })}>
                  Approve
                </button>
              )}
              <button type="button" className="btn btn-secondary" onClick={() => void handleToggleStatus()}>
                {skill.status === 'active' ? 'Deactivate' : 'Activate'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => void handleDelete()}>
                Delete
              </button>
            </>
          }
        />

        <div className="skill-header-section">
          <div className="skill-info">
            <span className={`badge ${skill.approved ? 'badge-success' : 'badge-warning'}`}>
              {skill.approved ? 'Approved' : 'Pending Approval'}
            </span>
            <span className={`badge ${skill.status === 'active' ? 'badge-success' : ''}`}>{skill.status}</span>
            <span className="badge">{skill.skillType}</span>
          </div>
        </div>

        {summary && (
          <div className="stats-section">
            <h3>Statistics</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-value">{summary.totalInvocations}</span>
                <span className="stat-label">Total Invocations</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{summary.successCount}</span>
                <span className="stat-label">Successful</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{summary.failureCount}</span>
                <span className="stat-label">Failed</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{Math.round(summary.avgDurationMs)}ms</span>
                <span className="stat-label">Avg Duration</span>
              </div>
            </div>
          </div>
        )}

        <div className="config-section">
          <h3>Configuration</h3>
          <pre className="config-display">
            {skill.config ? JSON.stringify(JSON.parse(skill.config), null, 2) : 'No configuration'}
          </pre>
        </div>

        <div className="invocations-section">
          <h3>Recent Invocations</h3>
          {invocations && invocations.length > 0 ? (
            <table className="invocations-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Security</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {invocations.map((inv: { _id: string; timestamp: number; success: boolean; securityCheckResult: string; durationMs: number }) => (
                  <tr key={inv._id}>
                    <td>{new Date(inv.timestamp).toLocaleString()}</td>
                    <td>
                      <span className={`badge ${inv.success ? 'badge-success' : 'badge-error'}`}>
                        {inv.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${inv.securityCheckResult === 'passed' ? 'badge-success' : 'badge-warning'}`}>
                        {inv.securityCheckResult}
                      </span>
                    </td>
                    <td>{inv.durationMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-secondary">No invocations yet</p>
          )}
        </div>
      </div>

      <style>{`
        .skill-detail {
          width: 100%;
        }

        .skill-header-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-4);
        }

        .skill-info {
          display: flex;
          gap: var(--space-2);
        }

        .stats-section,
        .config-section,
        .invocations-section {
          margin-bottom: var(--space-6);
        }

        .stats-section h3,
        .config-section h3,
        .invocations-section h3 {
          margin-bottom: var(--space-4);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--space-4);
        }

        .stat-card {
          background-color: var(--bg-secondary);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          text-align: center;
        }

        .stat-value {
          display: block;
          font-size: var(--text-2xl);
          font-weight: 600;
        }

        .stat-label {
          font-size: var(--text-sm);
          color: var(--text-secondary);
        }

        .config-display {
          background-color: var(--bg-secondary);
          padding: var(--space-4);
          border-radius: var(--radius-lg);
          font-size: var(--text-sm);
          overflow-x: auto;
        }

        .invocations-table {
          width: 100%;
          border-collapse: collapse;
        }

        .invocations-table th,
        .invocations-table td {
          padding: var(--space-3);
          text-align: left;
          border-bottom: 1px solid var(--border);
        }

        .invocations-table th {
          font-weight: 500;
          color: var(--text-secondary);
          font-size: var(--text-sm);
        }
      `}</style>
    </SyncBoardLayout>
  );
}
