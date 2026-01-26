import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import DashboardPage from "./pages/DashboardPage";
import ContactPage from "./pages/ContactPage";
import LoginPage from "./pages/LoginPage";
import UserDashboardPage from "./pages/UserDashboardPage";
import ProfilePage from "./pages/ProfilePage";
import RequestAccessPage from "./pages/RequestAccessPage";
import SetPasswordPage from "./pages/SetPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import { useAuth } from "./contexts/AuthContext";
import { AuthRedirectHandler } from "./components/AuthRedirectHandler";

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
  beforeLoad: async () => {
    try {
      // Lightweight check: if onboarding is already complete, redirect to dashboard
      // RequireAuth component handles auth gating
      const { supabase } = await import("./lib/supabase");
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // If onboarding is already complete, redirect to dashboard
      // This prevents users from revisiting the onboarding page
      if (session?.user) {
        try {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("onboarding_complete")
            .eq("id", session.user.id)
            .single();

          // If profile exists and onboarding is explicitly true, redirect to dashboard
          if (!profileError && profile) {
            const isComplete = profile.onboarding_complete ?? false;
            if (isComplete === true) {
              throw redirect({
                to: "/dashboard",
                search: {},
              });
            }
          }
          // If profile doesn't exist or error, allow access (user needs to complete onboarding)
          // This is the correct behavior for new users from invite links
        } catch (profileErr) {
          // If this is a redirect, re-throw it
          if (profileErr && typeof profileErr === "object" && "to" in profileErr) {
            throw profileErr;
          }
          // Otherwise, allow access (user can complete onboarding)
          // Profile query errors are OK - user needs to create profile
        }
      }
    } catch (error) {
      // If redirect was thrown, re-throw it
      if (error && typeof error === "object" && "to" in error) {
        throw error;
      }
      // Ignore AbortError - it happens when navigation is cancelled
      if (error instanceof Error && error.name === "AbortError") {
        return; // Allow page to load
      }
      // Log other errors but don't crash - allow page to load
      // This prevents black screen on refresh
      console.error("Error in set-password route guard:", error);
      return; // Allow page to load - component will handle auth check
    }
  },
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
// NOTE: Auth is already resolved when this guard runs (router is gated behind auth loading)
// This guard can safely check session - it will be fast since auth is in memory
const userDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: UserDashboardPage,
  validateSearch: (search: Record<string, unknown>): {
    locationId?: string;
    lat?: number;
    lng?: number;
  } => {
    return {
      locationId: (search.locationId as string) || undefined,
      lat: search.lat ? Number(search.lat) : undefined,
      lng: search.lng ? Number(search.lng) : undefined,
    };
  },
  // No beforeLoad guard - ProtectedRoute component handles auth gating
  // This allows the router to render immediately, improving UX
});

// Protected profile route (requires authentication) - shows profile info
// RequireAuth component handles auth gating - no beforeLoad needed
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  component: ProfilePage,
  // No beforeLoad - RequireAuth component handles auth
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  contactRoute,
  loginRoute,
  requestAccessRoute,
  setPasswordRoute,
  resetPasswordRoute,
  userDashboardRoute,
  profileRoute,
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
  // Use router state to ensure re-renders on route changes
  const routerState = useRouterState();

  const handleSignOut = async () => {
    try {
      // Sign out and wait for it to complete
      // The signOut function properly clears state and awaits Supabase signOut
      await signOut();
      
      // Navigate to login after sign out
      // Auth state will update via SIGNED_OUT event
      navigate({ 
        to: "/login", 
        search: {},
        replace: true 
      });
    } catch (error: any) {
      // Even if signOut fails, navigate to login
      // AbortError is common when navigation happens - ignore it
      if (error?.name !== "AbortError") {
        console.error("Error during sign out:", error);
      }
      // Still navigate even on error
      navigate({ 
        to: "/login", 
        search: {},
        replace: true 
      });
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col" style={{ minHeight: '100dvh' }}>
      {/* Global auth redirect handler for invite/magic links */}
      <AuthRedirectHandler />
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
        <Outlet key={`${routerState.location.pathname}-${routerState.location.searchStr}-${routerState.location.hash}`} />
      </main>
      <footer className="border-t border-surface/60 bg-surface/20 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-center gap-4 px-6 text-sm text-text/60 md:flex-row">
          <div>© {currentYear} Foodly Map</div>
          <div className="hidden md:block">•</div>
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
          <div className="hidden md:block">•</div>
          <Link
            to="/contact"
            className="text-accent/70 transition-colors hover:text-accent"
            aria-label="Contact page"
          >
            Contact
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
