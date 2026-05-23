import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { OpenCluLogo } from './OpenCluLogo';
import { getActiveNavItemPath } from './navActive';
import { visibleSyncBoardNavItems } from './syncboardNav';

export function SyncBoardSidebar() {
  const location = useLocation();
  const authEnabled = useQuery(api.syncboardAuth.isEnabled);
  const logout = useMutation(api.syncboardAuth.logout);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const activeNavPath = getActiveNavItemPath(location.pathname, visibleSyncBoardNavItems);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    const token = localStorage.getItem('syncboard_token');
    if (token) {
      await logout({ token });
      localStorage.removeItem('syncboard_token');
      localStorage.removeItem('syncboard_token_expires');
    }
    window.location.href = '/syncboard/agents';
  };

  return (
    <aside className="syncboard-sidebar">
      <div className="sidebar-header">
        <Link to="/syncboard/agents" className="sidebar-logo-link">
          <OpenCluLogo className="sidebar-logo" />
        </Link>
        <p className="sidebar-title">SyncBoard</p>
        {authEnabled ? (
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
            className="btn btn-ghost text-sm logout-btn sidebar-signout"
          >
            {isLoggingOut ? 'Signing out...' : 'Sign Out'}
          </button>
        ) : null}
      </div>

      <nav className="sidebar-nav">
        {visibleSyncBoardNavItems.map((item) => {
          const isActive = item.path === activeNavPath;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">
                <item.Icon size={18} weight="regular" />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
