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

// Request access route (public, no authentication required)
const requestAccessRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/request-access",
  component: RequestAccessPage,
});

// Login route (public, but redirects to /app if already authenticated)
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
  beforeLoad: async () => {
    // Check if user is already authenticated
    // If so, redirect to protected app route
    const { supabase } = await import("./lib/supabase");
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      throw redirect({
        to: "/app",
      });
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
  appRoute,
]);

export const router = createRouter({ routeTree });

function RootLayout() {
  const currentYear = new Date().getFullYear();
  // Use auth context to show/hide navigation items
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
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
