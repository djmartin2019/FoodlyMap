import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  useNavigate
} from "@tanstack/react-router";
import React from "react";

import AuthCallbackPage from "./auth/callbacks/AuthCallbackPage";
import { PostHogPageview } from "./components/PostHogPageview";
import { RequireAuth } from "./components/RequireAuth";
import { useAuth } from "./contexts/AuthContext";
import ContactPage from "./pages/ContactPage";
import DashboardPage from "./pages/DashboardPage";
import FeedPage from "./pages/FeedPage";
import ListDetailPage from "./pages/ListDetailPage";
import ListsPage from "./pages/ListsPage";
import LoginPage from "./pages/LoginPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import ProfilePage from "./pages/ProfilePage";
import PublicListPage from "./pages/PublicListPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import SignUpPage from "./pages/SignUpPage";
import SetPasswordPage from "./pages/SetPasswordPage";
import TermsPage from "./pages/TermsPage";
import UserDashboardPage from "./pages/UserDashboardPage";

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

// Sign up route (public)
const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signup",
  component: SignUpPage,
});

// Auth callback route (handles invite links, password reset, etc.)
const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth/callback",
  component: AuthCallbackPage,
  validateSearch: (search: Record<string, unknown>) => {
    return search;
  },
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

// Protected feed route (requires authentication)
const feedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/feed",
  component: () => (
    <RequireAuth>
      <FeedPage />
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
  signupRoute,
  authCallbackRoute,
  setPasswordRoute,
  resetPasswordRoute,
  userDashboardRoute,
  profileRoute,
  listsRoute,
  feedRoute,
  listDetailRoute,
  publicListRoute,
]);

// Create router instance once and export it
// This ensures the router is stable and not recreated on every import
// RouterProvider in main.tsx uses this same instance, preventing __store crashes
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
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const handleSignOut = async () => {
    // signOut now handles all errors internally and never throws
    // It will clear local state, storage, and caches via logoutAndCleanup
    await signOut();
    
    // Always navigate to login after sign out
    // Auth state is already cleared by signOut
    navigate({ 
      to: "/login", 
      search: {},
      replace: true 
    });
    setMobileMenuOpen(false);
  };

  // Close mobile menu when clicking outside or on a link
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (mobileMenuOpen && !target.closest('nav')) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      // Prevent body scroll when menu is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col" style={{ minHeight: '100dvh' }}>
      <PostHogPageview />
      <nav className="sticky top-0 z-50 border-b border-surface bg-bg/90 backdrop-blur" aria-label="Main navigation" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <Link
            to={user ? "/dashboard" : "/"}
            className="text-lg font-semibold tracking-wide text-text transition-colors hover:text-accent"
            aria-label={user ? "Foodly Map dashboard" : "Foodly Map home"}
            onClick={() => setMobileMenuOpen(false)}
          >
            Foodly Map
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
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
                <Link
                  to="/feed"
                  className="text-sm text-text/70 transition-colors hover:text-accent"
                >
                  Feed
                </Link>
                <button
                  onClick={handleSignOut}
                  className="text-sm text-text/70 transition-colors hover:text-accent"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  search={{}}
                  className="text-sm text-text/70 transition-colors hover:text-accent"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  search={{}}
                  className="text-sm text-text/70 transition-colors hover:text-accent"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          {user && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex flex-col gap-1.5 p-2 text-text/70 hover:text-accent transition-colors"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              <span
                className={`block h-0.5 w-6 bg-current transition-all duration-300 ${
                  mobileMenuOpen ? 'rotate-45 translate-y-2' : ''
                }`}
              />
              <span
                className={`block h-0.5 w-6 bg-current transition-all duration-300 ${
                  mobileMenuOpen ? 'opacity-0' : ''
                }`}
              />
              <span
                className={`block h-0.5 w-6 bg-current transition-all duration-300 ${
                  mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''
                }`}
              />
            </button>
          )}

          {/* Mobile Sign In Link (when not authenticated) */}
          {!user && (
            <div className="md:hidden flex items-center gap-3">
              <Link
                to="/login"
                search={{}}
                className="text-sm text-text/70 transition-colors hover:text-accent"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                search={{}}
                className="text-sm text-text/70 transition-colors hover:text-accent"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile Menu Dropdown - Outside nav for proper positioning */}
      {mobileMenuOpen && user && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-bg/80 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
            style={{ 
              top: 'max(calc(1rem + 4rem), calc(env(safe-area-inset-top) + 4rem))'
            }}
          />
          
          {/* Mobile Menu Dropdown */}
          <div 
            className="fixed left-0 right-0 z-50 md:hidden bg-surface border-b border-surface/60 shadow-neon-lg animate-slide-down"
            style={{ 
              top: 'max(calc(1rem + 4rem), calc(env(safe-area-inset-top) + 4rem))',
              paddingTop: '0.5rem',
              paddingBottom: '0.5rem'
            }}
          >
            <div className="flex flex-col">
              <Link
                to="/dashboard"
                search={{}}
                onClick={() => setMobileMenuOpen(false)}
                className="px-6 py-3 text-base font-medium text-text transition-colors hover:text-accent hover:bg-surface/50 border-b border-surface/60"
              >
                Dashboard
              </Link>
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="px-6 py-3 text-base font-medium text-text transition-colors hover:text-accent hover:bg-surface/50 border-b border-surface/60"
              >
                Profile
              </Link>
              <Link
                to="/lists"
                onClick={() => setMobileMenuOpen(false)}
                className="px-6 py-3 text-base font-medium text-text transition-colors hover:text-accent hover:bg-surface/50 border-b border-surface/60"
              >
                Lists
              </Link>
              <Link
                to="/feed"
                onClick={() => setMobileMenuOpen(false)}
                className="px-6 py-3 text-base font-medium text-text transition-colors hover:text-accent hover:bg-surface/50 border-b border-surface/60"
              >
                Feed
              </Link>
              <button
                onClick={handleSignOut}
                className="px-6 py-3 text-base font-medium text-text transition-colors hover:text-accent hover:bg-surface/50 text-left"
              >
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
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
