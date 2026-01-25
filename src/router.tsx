import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import DashboardPage from "./pages/DashboardPage";
import ContactPage from "./pages/ContactPage";
import LoginPage from "./pages/LoginPage";
import AppPage from "./pages/AppPage";
import RequestAccessPage from "./pages/RequestAccessPage";
import SetPasswordPage from "./pages/SetPasswordPage";
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
  beforeLoad: async () => {
    try {
      // Check if user is already authenticated
      const { supabase } = await import("./lib/supabase");
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      // If there's an error or no session, allow page to load
      if (sessionError || !session?.user) {
        return;
      }

      // Check onboarding status with error handling
      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("onboarding_complete")
          .eq("id", session.user.id)
          .single();

        // If profile doesn't exist or error, assume onboarding incomplete
        const isComplete = profileError ? false : (profile?.onboarding_complete ?? false);

        // Redirect based on onboarding status
        throw redirect({
          to: isComplete ? "/app" : "/set-password",
        });
      } catch (profileErr) {
        // If this is a redirect, re-throw it
        if (profileErr && typeof profileErr === "object" && "to" in profileErr) {
          throw profileErr;
        }
        // Otherwise, allow page to load (user can still log in)
      }
    } catch (error) {
      // If redirect was thrown, re-throw it
      if (error && typeof error === "object" && "to" in error) {
        throw error;
      }
      // Ignore AbortError and other errors - allow page to load normally
      // AbortError happens when navigation is cancelled, which is expected behavior
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("Error in login route guard:", error);
      }
    }
  },
});

// Set password route (requires authentication, for onboarding)
const setPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/set-password",
  component: SetPasswordPage,
  beforeLoad: async () => {
    try {
      // Check authentication before allowing access
      const { supabase } = await import("./lib/supabase");
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      // If no session or error, redirect to login
      if (sessionError || !session) {
        throw redirect({
          to: "/login",
        });
      }

      // If onboarding is already complete, redirect to app
      // This prevents users from revisiting the onboarding page
      if (session.user) {
        try {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("onboarding_complete")
            .eq("id", session.user.id)
            .single();

          // If profile exists and onboarding is complete, redirect
          if (!profileError && profile) {
            const isComplete = profile.onboarding_complete ?? false;
            if (isComplete) {
              throw redirect({
                to: "/app",
              });
            }
          }
          // If profile doesn't exist or error, allow access (user needs to complete onboarding)
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

// Protected route (requires authentication)
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app",
  component: AppPage,
  beforeLoad: async () => {
    // Check authentication before allowing access
    const { supabase } = await import("./lib/supabase");
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // If no session, redirect to login
    if (!session) {
      throw redirect({
        to: "/login",
      });
    }
  },
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  contactRoute,
  loginRoute,
  requestAccessRoute,
  setPasswordRoute,
  appRoute,
]);

export const router = createRouter({ routeTree });

function RootLayout() {
  const currentYear = new Date().getFullYear();
  // Use auth context to show/hide navigation items
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      // Navigate after sign out completes
      navigate({ to: "/login", replace: true });
    } catch (error) {
      // Even if signOut fails, try to navigate
      console.error("Error during sign out:", error);
      navigate({ to: "/login", replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      {/* Global auth redirect handler for invite/magic links */}
      <AuthRedirectHandler />
      <nav className="sticky top-0 z-10 border-b border-surface bg-bg/90 backdrop-blur" aria-label="Main navigation">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link
            to="/"
            className="text-lg font-semibold tracking-wide text-text transition-colors hover:text-accent"
            aria-label="Foodly Map home"
          >
            Foodly Map
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link
                  to="/app"
                  className="text-sm text-text/70 transition-colors hover:text-accent"
                >
                  App
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
