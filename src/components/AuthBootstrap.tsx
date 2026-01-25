import { ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "../router";

/**
 * AuthBootstrap Component
 * 
 * CRITICAL: This component gates router rendering until auth state is fully resolved.
 * 
 * Why this is required:
 * - Supabase needs time to restore the session from localStorage on page load
 * - If routes render before auth is resolved, route guards may redirect incorrectly
 * - React can commit an invalid render tree (black screen) that never recovers
 * - Mapbox and other components should not mount until auth is stable
 * 
 * Architecture:
 * - While authLoading === true: Show loading screen, do NOT render router
 * - After authLoading === false: Render router (auth state is now stable)
 * 
 * This ensures:
 * - Route guards see correct auth state on first render
 * - No race conditions between auth restoration and route evaluation
 * - Mapbox only mounts when auth is resolved
 * - Navigation works correctly after refresh
 */
export function AuthBootstrap({ children }: { children?: ReactNode }) {
  const { loading: authLoading } = useAuth();

  // CRITICAL: Do NOT render router until auth is fully resolved
  // This prevents black screens and broken navigation on refresh
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

  // Auth is resolved - safe to render router
  // Route guards can now reliably check auth state
  return <RouterProvider router={router} />;
}
