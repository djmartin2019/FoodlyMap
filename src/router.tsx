import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate
} from "@tanstack/react-router";
import DashboardPage from "./pages/DashboardPage";
import ContactPage from "./pages/ContactPage";
import LoginPage from "./pages/LoginPage";
import UserDashboardPage from "./pages/UserDashboardPage";
import ProfilePage from "./pages/ProfilePage";
import RequestAccessPage from "./pages/RequestAccessPage";
import SetPasswordPage from "./pages/SetPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import ListsPage from "./pages/ListsPage";
import ListDetailPage from "./pages/ListDetailPage";
import PublicListPage from "./pages/PublicListPage";
import { RequireAuth } from "./components/RequireAuth";
import { useAuth } from "./contexts/AuthContext";

// Root route with layout
const rootRoute = createRootRoute({
  component: RootLayout,
});

// Public routes (accessible without authentication)
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});

const contactRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/contact",
  component: ContactPage,
});

const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/terms",
  component: TermsPage,
});

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/privacy",
  component: PrivacyPolicyPage,
});

// Public list route (no auth required)
const publicListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/l/$slug",
  component: PublicListPage,
  validateSearch: (search: Record<string, unknown>) => {
    return search;
  },
});

// Request access route (public, no authentication required)
const requestAccessRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/request-access",
  component: RequestAccessPage,
});

// Login route (public, but redirects based on onboarding status if already authenticated)
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
  // Removed beforeLoad - it was blocking navigation
  // LoginPage component will handle redirects if user is already authenticated
});

// Set password route (requires authentication, for onboarding)
const setPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/set-password",
  component: SetPasswordPage,
  // No beforeLoad - RequireAuth component handles auth gating
});

// Reset password route (requires active recovery session)
// This route is accessed when user clicks password reset link from email
// The PASSWORD_RECOVERY event creates a temporary session that allows password update
// IMPORTANT: Don't check session in route guard - Supabase might still be processing the hash
// Let the component handle session checking after Supabase finishes processing
const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reset-password",
  component: ResetPasswordPage,
  // No beforeLoad guard - component will handle session check
  // This allows Supabase time to process the hash from the recovery link
});

// Protected dashboard route (requires authentication) - shows map
// This guard can safely check session - it will be fast since auth is in memory
const userDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: () => (
    <RequireAuth>
      <UserDashboardPage />
    </RequireAuth>
  ),
});

// Protected profile route (requires authentication) - shows profile info
// RequireAuth component handles auth gating - no beforeLoad needed
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  component: () => (
    <RequireAuth>
      <ProfilePage />
    </RequireAuth>
  ),
});

// Protected lists route (requires authentication)
const listsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/lists",
  component: () => (
    <RequireAuth>
      <ListsPage />
    </RequireAuth>
  ),
});

// Protected list detail route (requires authentication, owner-only management)
const listDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/lists/$listId",
  component: () => (
    <RequireAuth>
      <ListDetailPage />
    </RequireAuth>
  ),
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  contactRoute,
  termsRoute,
  privacyRoute,
  loginRoute,
  requestAccessRoute,
  setPasswordRoute,
  resetPasswordRoute,
  userDashboardRoute,
  profileRoute,
  listsRoute,
  listDetailRoute,
  publicListRoute,
]);

export const router = createRouter({ 
  routeTree,
  // Ensure router works properly with browser history
  defaultPreload: false,
});

function RootLayout() {
  const currentYear = new Date().getFullYear();
  // Use auth context to show/hide navigation items
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    // signOut now handles all errors internally and never throws
    // It will clear local state and attempt remote logout if session exists
    await signOut();
    
    // Always navigate to login after sign out
    // Auth state is already cleared by signOut
    navigate({ 
      to: "/login", 
      search: {},
      replace: true 
    });
  };

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col" style={{ minHeight: '100dvh' }}>
      <nav className="sticky top-0 z-10 border-b border-surface bg-bg/90 backdrop-blur" aria-label="Main navigation" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <Link
            to={user ? "/dashboard" : "/"}
            className="text-lg font-semibold tracking-wide text-text transition-colors hover:text-accent"
            aria-label={user ? "Foodly Map dashboard" : "Foodly Map home"}
          >
            Foodly Map
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  search={{}}
                  className="text-sm text-text/70 transition-colors hover:text-accent"
                >
                  Dashboard
                </Link>
                <Link
                  to="/profile"
                  className="text-sm text-text/70 transition-colors hover:text-accent"
                >
                  Profile
                </Link>
                <Link
                  to="/lists"
                  className="text-sm text-text/70 transition-colors hover:text-accent"
                >
                  Lists
                </Link>
                <button
                  onClick={handleSignOut}
                  className="text-sm text-text/70 transition-colors hover:text-accent"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                to="/login"
                search={{}}
                className="text-sm text-text/70 transition-colors hover:text-accent"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </nav>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-surface/60 bg-surface/20 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-center gap-3 px-6 text-sm text-text/60 sm:flex-row sm:justify-center sm:gap-4">
          <div>© {currentYear} Foodly Map</div>
          <div className="hidden sm:block text-text/40">•</div>
          <div>
            Built by{" "}
            <a
              href="https://djm-tech.dev"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="DJM-Tech website (opens in new tab)"
              className="text-accent/70 transition-colors hover:text-accent"
            >
              DJM-Tech
            </a>
          </div>
          <div className="hidden sm:block text-text/40">•</div>
          <Link
            to="/contact"
            className="text-accent/70 transition-colors hover:text-accent"
            aria-label="Contact page"
          >
            Contact
          </Link>
          <div className="hidden sm:block text-text/40">•</div>
          <Link
            to="/terms"
            className="text-accent/70 transition-colors hover:text-accent"
            aria-label="Terms of Service"
          >
            Terms
          </Link>
          <div className="hidden sm:block text-text/40">•</div>
          <Link
            to="/privacy"
            className="text-accent/70 transition-colors hover:text-accent"
            aria-label="Privacy Policy"
          >
            Privacy
          </Link>
        </div>
      </footer>
    </div>
  );
}

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
