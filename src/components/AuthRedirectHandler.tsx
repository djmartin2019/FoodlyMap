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

  useEffect(() => {
    // Don't redirect while loading, if no user, or if navigation is already in progress
    if (loading || !user || isNavigating.current) {
      if (!user) {
        hasRedirected.current = false; // Reset when user logs out
      }
      return;
    }

    // Prevent multiple redirects for the same auth event
    if (hasRedirected.current) {
      return;
    }

    // Don't redirect if we're already on a protected route
    const currentPath = routerState.location.pathname;
    const protectedRoutes = ["/dashboard", "/app", "/set-password"];
    
    if (protectedRoutes.includes(currentPath)) {
      return; // Already on the right page
    }

    // Only redirect if we're on a public route and user is authenticated
    // This handles invite/magic link flows where users land on / or /login
    const publicRoutes = ["/", "/login", "/contact", "/request-access"];

    if (publicRoutes.includes(currentPath)) {
      // Only redirect if onboarding status is determined (not null)
      // Use a small timeout to avoid conflicts with manual navigation
      const timeoutId = setTimeout(() => {
        if (onboardingComplete === true && !isNavigating.current) {
          hasRedirected.current = true;
          isNavigating.current = true;
          navigate({ to: "/dashboard", replace: true }).catch(() => {
            // Ignore navigation errors (e.g., if user navigates away)
          }).finally(() => {
            isNavigating.current = false;
          });
        } else if (onboardingComplete === false && !isNavigating.current) {
          hasRedirected.current = true;
          isNavigating.current = true;
          navigate({ to: "/set-password", replace: true }).catch(() => {
            // Ignore navigation errors (e.g., if user navigates away)
          }).finally(() => {
            isNavigating.current = false;
          });
        }
      }, 100); // Small delay to avoid conflicts

      return () => clearTimeout(timeoutId);
    }
  }, [user, onboardingComplete, loading, navigate, routerState.location.pathname]);

  // This component doesn't render anything
  return null;
}
