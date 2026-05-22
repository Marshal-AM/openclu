/**
 * WorkOS AuthKit Configuration
 *
 * This file configures JWT validation for WorkOS AuthKit.
 * Currently PLACEHOLDER - WorkOS integration not yet set up.
 *
 * When ready to enable:
 * 1. Set WORKOS_CLIENT_ID in Convex environment variables
 * 2. Set WORKOS_API_KEY in Convex environment variables
 * 3. Set WORKOS_REDIRECT_URI to your callback URL
 * 4. Uncomment the authConfig export below
 * 5. Run `npx convex dev` to sync configuration
 *
 * See: https://docs.convex.dev/auth/authkit/
 */

const authConfig = {
  providers: [],
};

export default authConfig;

/**
 * Environment Variables Required for WorkOS:
 *
 * In Convex Dashboard (Settings > Environment Variables):
 * - WORKOS_CLIENT_ID: Your WorkOS Client ID (client_...)
 * - WORKOS_API_KEY: Your WorkOS API Key (sk_test_... or sk_live_...)
 *
 * In your frontend .env:
 * - VITE_WORKOS_CLIENT_ID: Same as WORKOS_CLIENT_ID
 * - VITE_WORKOS_REDIRECT_URI: http://localhost:5173/callback (dev)
 * - VITE_CONVEX_URL: Your Convex deployment URL
 *
 * Frontend Setup (when ready):
 * 1. npm install @workos-inc/authkit-react
 * 2. Create ConvexClientProvider wrapping AuthKitProvider + ConvexProviderWithAuth
 * 3. Add /callback route to handle OAuth redirects
 * 4. Update SyncBoardAuthGuard to use useAuth() from AuthKit
 */
