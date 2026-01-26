import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "../contexts/AuthContext";

/**
 * RequireAuth Component
 * 
 * Route-level auth guard used ONLY by protected routes.
 * Public routes render immediately without this guard.
 * 
 * Behavior:
 * - While loading: Show page-level loader inside route area
 * - If unauthenticated (after loading completes): Redirect to /login with replace: true
 * - If authenticated: Render children
 * 
 * Note: AuthContext has a 10-second safety timeout that ensures loading always resolves.
 * We don't need a separate timeout here - we only redirect when auth is definitively resolved.
 */
interface RequireAuthProps {
  children: React.ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect to login ONLY when auth is definitively resolved and user is not authenticated
  // Do NOT redirect while auth is still loading - give it time to resolve
  useEffect(() => {
    // Only redirect if auth has finished loading AND there's no user
    // This ensures we don't redirect prematurely on refresh
    if (!authLoading && !user) {
      navigate({ to: "/login", replace: true, search: {} });
    }
  }, [authLoading, user, navigate]);

  // Show loader while auth is resolving
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent"></div>
          <p className="text-sm text-text/60">Loading...</p>
        </div>
      </div>
    );
  }

  // If no user after loading completes, don't render (redirect will happen)
  if (!user) {
    return null;
  }

  // User is authenticated - render children
  return <>{children}</>;
}
