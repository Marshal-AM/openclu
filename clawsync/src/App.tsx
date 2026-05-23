import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { UpdateBanner } from '@convex-dev/self-static-hosting/react';
import { api } from '../convex/_generated/api';
import { ChatPage } from './pages/ChatPage';
import { SetupWizard } from './pages/SetupWizard';
import { SyncBoardLogin } from './pages/SyncBoardLogin';
import { SyncBoardModels } from './pages/SyncBoardModels';
import { SyncBoardSkills } from './pages/SyncBoardSkills';
import { SyncBoardSkillDetail } from './pages/SyncBoardSkillDetail';
import { SyncBoardAgents } from './pages/SyncBoardAgents';
import { SyncBoardAgentDetail } from './pages/SyncBoardAgentDetail';
import { SyncBoardAgentFeed } from './pages/SyncBoardAgentFeed';
import { SyncBoardPurchaseSkills } from './pages/SyncBoardPurchaseSkills';
import { PRODUCT_HOME_PATH } from './config/productSurface';
import { PageBootSkeleton } from './components/ui/skeletons';
import { Toaster } from 'sonner';

// Wrapper component to check if setup is required
function SetupGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const setupRequired = useQuery(api.setup.isRequired);

  // Show nothing while loading
  if (setupRequired === undefined) {
    return <PageBootSkeleton />;
  }

  // Redirect to setup if required (unless already on setup page)
  if (setupRequired && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }

  // Redirect away from setup if not required
  if (!setupRequired && location.pathname === '/setup') {
    return <Navigate to="/chat" replace />;
  }

  return <>{children}</>;
}

/**
 * SyncBoard Authentication Guard
 *
 * Currently uses simple password-based auth (SYNCBOARD_PASSWORD_HASH).
 *
 * FUTURE: Will be replaced with WorkOS AuthKit for enterprise SSO.
 * When WorkOS is enabled:
 * 1. Import useAuth from @workos-inc/authkit-react
 * 2. Replace password check with: const { isAuthenticated, user } = useAuth()
 * 3. Show login UI from AuthKit instead of SyncBoardLogin
 * 4. Session management handled by AuthKit cookies
 *
 * See: https://docs.convex.dev/auth/authkit/
 * See: convex/auth.config.ts for backend configuration
 */
function SyncBoardAuthGuard({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  // Check if auth is enabled
  const authEnabled = useQuery(api.syncboardAuth.isEnabled);

  // Verify existing token
  const sessionValid = useQuery(
    api.syncboardAuth.verifySession,
    token ? { token } : 'skip'
  );

  // Load token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('syncboard_token');
    const expiresAt = localStorage.getItem('syncboard_token_expires');

    // Check if token is expired locally
    if (storedToken && expiresAt) {
      if (Date.now() > parseInt(expiresAt, 10)) {
        localStorage.removeItem('syncboard_token');
        localStorage.removeItem('syncboard_token_expires');
        setIsChecking(false);
        return;
      }
    }

    setToken(storedToken);
    setIsChecking(false);
  }, []);

  // Handle login
  const handleLogin = (newToken: string) => {
    setToken(newToken);
  };

  // Still loading auth state
  if (authEnabled === undefined || isChecking) {
    return <PageBootSkeleton />;
  }

  // Auth is disabled - allow access
  if (!authEnabled) {
    return <>{children}</>;
  }

  // No token or invalid token - show login
  if (!token || (sessionValid && !sessionValid.valid)) {
    // Clear invalid token
    if (token && sessionValid && !sessionValid.valid) {
      localStorage.removeItem('syncboard_token');
      localStorage.removeItem('syncboard_token_expires');
    }
    return <SyncBoardLogin onLogin={handleLogin} />;
  }

  // Still verifying token
  if (sessionValid === undefined) {
    return <PageBootSkeleton />;
  }

  // Token is valid
  return <>{children}</>;
}

export function App() {
  const hiddenRoute = <Navigate to={PRODUCT_HOME_PATH} replace />;

  return (
    <BrowserRouter>
      {/* Live reload banner when new deployment is available */}
      <UpdateBanner
        getCurrentDeployment={api.staticHosting.getCurrentDeployment}
        message="A new version is available!"
        buttonText="Refresh"
      />
      <Toaster position="top-center" richColors closeButton />
      <SetupGuard>
        <Routes>
          {/* Setup wizard (first-run) */}
          <Route path="/setup" element={<SetupWizard />} />

          {/* Public routes */}
          <Route path="/" element={<Navigate to={PRODUCT_HOME_PATH} replace />} />
          <Route path="/chat" element={<ChatPage />} />

          {/* SyncBoard routes (admin) - protected by password auth */}
          <Route path="/syncboard" element={<Navigate to="/syncboard/agents" replace />} />
          <Route path="/syncboard/soul" element={hiddenRoute} />
          <Route path="/syncboard/models" element={<SyncBoardAuthGuard><SyncBoardModels /></SyncBoardAuthGuard>} />
          <Route path="/syncboard/skills" element={<SyncBoardAuthGuard><SyncBoardSkills /></SyncBoardAuthGuard>} />
          <Route path="/syncboard/skills/purchase" element={<SyncBoardAuthGuard><SyncBoardPurchaseSkills /></SyncBoardAuthGuard>} />
          <Route path="/syncboard/skills/purchased" element={<Navigate to="/syncboard/skills" replace />} />
          <Route path="/syncboard/skills/new" element={hiddenRoute} />
          <Route path="/syncboard/skills/:id" element={<SyncBoardAuthGuard><SyncBoardSkillDetail /></SyncBoardAuthGuard>} />
          <Route path="/syncboard/mcp" element={hiddenRoute} />
          <Route path="/syncboard/channels" element={hiddenRoute} />
          <Route path="/syncboard/threads" element={hiddenRoute} />
          <Route path="/syncboard/activity" element={hiddenRoute} />
          <Route path="/syncboard/config" element={hiddenRoute} />
          <Route path="/syncboard/api" element={hiddenRoute} />
          <Route path="/syncboard/x" element={hiddenRoute} />
          <Route path="/syncboard/agentmail" element={hiddenRoute} />
          <Route path="/syncboard/media" element={hiddenRoute} />
          <Route path="/syncboard/stagehand" element={hiddenRoute} />
          <Route path="/syncboard/firecrawl" element={hiddenRoute} />
          <Route path="/syncboard/research" element={hiddenRoute} />
          <Route path="/syncboard/analytics" element={hiddenRoute} />
          <Route path="/syncboard/memory" element={hiddenRoute} />

          {/* Multi-Agent routes */}
          <Route path="/syncboard/agents" element={<SyncBoardAuthGuard><SyncBoardAgents /></SyncBoardAuthGuard>} />
          <Route path="/syncboard/agents/:id" element={<SyncBoardAuthGuard><SyncBoardAgentDetail /></SyncBoardAuthGuard>} />
          <Route path="/syncboard/souls" element={hiddenRoute} />
          <Route path="/syncboard/agent-feed" element={<SyncBoardAuthGuard><SyncBoardAgentFeed /></SyncBoardAuthGuard>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Routes>
      </SetupGuard>
    </BrowserRouter>
  );
}
