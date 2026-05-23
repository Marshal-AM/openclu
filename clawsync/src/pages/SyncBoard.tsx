import { Link, useLocation } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { SyncBoardSidebar } from '../components/syncboard/SyncBoardSidebar';
import { DetailPanelGridSkeleton, FeedListSkeleton } from '../components/ui/skeletons';
import './SyncBoard.css';

type SkillSummary = {
  status: string;
  approved: boolean;
};

type ActivitySummary = {
  _id: string;
  actionType: string;
  summary: string;
  timestamp: number;
};

export function SyncBoard() {
  const location = useLocation();
  const agentConfig = useQuery(api.agentConfig.get);
  const skills = useQuery(api.skillRegistry.list);
  const activities = useQuery(api.activityLog.list, { limit: 10 });
  const agents = useQuery(api.agents.list);

  const activeSkills =
    skills?.filter((s: SkillSummary) => s.status === 'active' && s.approved).length ?? 0;
  const pendingSkills =
    skills?.filter((s: SkillSummary) => s.status === 'pending' || !s.approved).length ?? 0;
  const runningAgents = agents?.filter((a: { status: string }) => a.status === 'running').length ?? 0;
  const totalAgents = agents?.length ?? 0;

  const isLoading = !agentConfig || !skills || !activities || !agents;

  return (
    <div className="syncboard">
      <SyncBoardSidebar />

      <main className="syncboard-main">
        <div className="page-content">
          {location.pathname === '/syncboard' ? (
            <div className="dashboard">
              <h2>Dashboard Overview</h2>

              {isLoading ? (
                <>
                  <DetailPanelGridSkeleton count={5} />
                  <section className="dashboard-section">
                    <h3>Recent Activity</h3>
                    <FeedListSkeleton count={5} />
                  </section>
                </>
              ) : (
                <>
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-value">{totalAgents}</span>
                  <span className="stat-label">Total Agents</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{runningAgents}</span>
                  <span className="stat-label">Running</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{agentConfig?.model || 'Not set'}</span>
                  <span className="stat-label">Default Model</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{activeSkills}</span>
                  <span className="stat-label">Active Skills</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{pendingSkills}</span>
                  <span className="stat-label">Pending Approval</span>
                </div>
              </div>

              <section className="dashboard-section">
                <h3>Recent Activity</h3>
                {activities && activities.length > 0 ? (
                  <ul className="activity-list-compact">
                    {activities.map((activity: ActivitySummary) => (
                      <li key={activity._id}>
                        <span className="activity-type">{activity.actionType}</span>
                        <span className="activity-summary">{activity.summary}</span>
                        <span className="activity-time">
                          {new Date(activity.timestamp).toLocaleTimeString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-secondary">No recent activity</p>
                )}
              </section>

              <section className="dashboard-section">
                <h3>Quick Actions</h3>
                <div className="quick-actions">
                  <Link to="/syncboard/agents" className="btn btn-primary">
                    Manage Agents
                  </Link>
                  <Link to="/syncboard/skills" className="btn btn-secondary">
                    Manage Skills
                  </Link>
                  <Link to="/syncboard/skills/purchase" className="btn btn-secondary">
                    Browse Marketplace
                  </Link>
                </div>
              </section>
                </>
              )}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
