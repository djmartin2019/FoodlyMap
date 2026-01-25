import { useEffect, useRef } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "../contexts/AuthContext";

/**
 * AuthRedirectHandler component
 * 
 * This component handles automatic redirection after SIGNED_IN events from
 * invite links, magic links, and normal login. It listens to auth state changes
 * and redirects users to the correct page based on their onboarding status.
 * 
 * Why this is needed:
 * - Supabase invite/magic links authenticate users via URL hash (#access_token=...)
 * - Supabase fires SIGNED_IN event when processing these tokens
 * - We need to check onboarding_complete status from the profiles table
 * - Route guards handle initial checks, but this handles dynamic auth state changes
 * - Prevents users from landing on the wrong page after clicking invite links
 * - Uses replace: true to avoid back-button issues
 */
export function AuthRedirectHandler() {
  const { user, onboardingComplete, loading } = useAuth();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const hasRedirected = useRef(false); // Prevent multiple redirects
  const isNavigating = useRef(false); // Track if navigation is in progress
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousPathRef = useRef<string | null>(null); // Track previous path

  useEffect(() => {
    // Cleanup any pending redirects
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }

    const currentPath = routerState.location.pathname;
    
    // Reset redirect flag when path changes (user navigated manually)
    // This allows manual navigation to work properly
    if (previousPathRef.current !== null && previousPathRef.current !== currentPath) {
      hasRedirected.current = false; // User navigated manually, allow navigation
    }
    previousPathRef.current = currentPath;

    // Don't redirect while loading, if no user, or if navigation is already in progress
    if (loading || !user || isNavigating.current) {
      if (!user) {
        hasRedirected.current = false; // Reset when user logs out
      }
      return;
    }

    // Prevent multiple redirects for the same auth event
    // But allow manual navigation by resetting on path change
    if (hasRedirected.current) {
      return;
    }

    // Only redirect from /login if user is authenticated
    // Allow authenticated users to freely navigate to home, contact, app, etc.
    // This handles invite/magic link flows where users land on /login after authentication
    // Once redirected, users can navigate freely - we don't block manual navigation
    if (currentPath === "/login") {
      // Only redirect if onboarding status is determined (not null)
      // Use a small timeout to let auth state settle and avoid conflicts
      redirectTimeoutRef.current = setTimeout(() => {
        // Double-check conditions haven't changed
        if (isNavigating.current || hasRedirected.current) {
          return;
        }

        if (onboardingComplete === true) {
          hasRedirected.current = true;
          isNavigating.current = true;
          navigate({ to: "/app", replace: true })
            .catch(() => {
              // Ignore navigation errors (e.g., if user navigates away)
            })
            .finally(() => {
              isNavigating.current = false;
            });
        } else if (onboardingComplete === false) {
          hasRedirected.current = true;
          isNavigating.current = true;
          navigate({ to: "/set-password", replace: true })
            .catch(() => {
              // Ignore navigation errors (e.g., if user navigates away)
            })
            .finally(() => {
              isNavigating.current = false;
            });
        }
      }, 150); // Small delay to let auth state settle

      return () => {
        if (redirectTimeoutRef.current) {
          clearTimeout(redirectTimeoutRef.current);
          redirectTimeoutRef.current = null;
        }
      };
    }
  }, [user, onboardingComplete, loading, navigate, routerState.location.pathname]);

  // This component doesn't render anything
  return null;
}
