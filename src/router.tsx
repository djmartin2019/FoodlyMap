import { Link, Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import DashboardPage from "./pages/DashboardPage";
import ContactPage from "./pages/ContactPage";

const rootRoute = createRootRoute({
  component: RootLayout,
});

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

const routeTree = rootRoute.addChildren([dashboardRoute, contactRoute]);

export const router = createRouter({ routeTree });

function RootLayout() {
  const currentYear = new Date().getFullYear();

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
