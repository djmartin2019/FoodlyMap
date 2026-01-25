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
  const hasRedirected = useRef(false); // Prevent multiple redirects for same auth event
  const isNavigating = useRef(false); // Track if navigation is in progress
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousPathRef = useRef<string | null>(null); // Track previous path
  const previousUserRef = useRef<string | null>(null); // Track previous user ID

  useEffect(() => {
    // Cleanup any pending redirects
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }

    const currentPath = routerState.location.pathname;
    const currentUserId = user?.id || null;
    
    // Reset redirect flag when:
    // 1. User changes (new sign-in event, like from invite link)
    // 2. Path changes (user navigated manually)
    if (previousUserRef.current !== currentUserId) {
      hasRedirected.current = false; // New user or new sign-in event
      previousUserRef.current = currentUserId;
    }
    
    if (previousPathRef.current !== null && previousPathRef.current !== currentPath) {
      // Only reset if user manually navigated (not from our redirect)
      // We can detect this by checking if we're not in the middle of navigating
      if (!isNavigating.current) {
        hasRedirected.current = false; // User navigated manually, allow navigation
      }
    }
    previousPathRef.current = currentPath;

    // Don't redirect while loading, if no user, or if navigation is already in progress
    if (loading || !user || isNavigating.current) {
      if (!user) {
        hasRedirected.current = false; // Reset when user logs out
        previousUserRef.current = null;
      }
      return;
    }

    // Prevent multiple redirects for the same auth event
    // But allow new sign-in events (like invite links) to trigger redirects
    if (hasRedirected.current) {
      return;
    }

    // Handle redirects for authenticated users based on onboarding status
    // This handles:
    // 1. Invite/magic links that land on any page (especially / or /login)
    // 2. Normal login flows
    // 
    // We only redirect if:
    // - User is on a public route (/, /login, /contact, /request-access)
    // - Onboarding status is determined (not null)
    // - We haven't already redirected for this auth event
    const publicRoutes = ["/", "/login", "/contact", "/request-access"];
    
    if (publicRoutes.includes(currentPath)) {
      // Only redirect if onboarding status is determined (not null)
      // Use a timeout to let auth state settle and Supabase process hash from invite links
      // For invite links, Supabase needs time to:
      // 1. Process the hash (#access_token=...)
      // 2. Fire SIGNED_IN event
      // 3. Check onboarding status from profiles table
      redirectTimeoutRef.current = setTimeout(() => {
        // Double-check conditions haven't changed
        if (isNavigating.current || hasRedirected.current || !user) {
          return;
        }

        // If onboarding status is still null, assume incomplete (new user from invite link)
        // This is safe because new users from invite links won't have a profile yet
        if (onboardingComplete === null || onboardingComplete === false) {
          // User needs to complete onboarding (invite link flow)
          hasRedirected.current = true;
          isNavigating.current = true;
          navigate({ to: "/set-password", replace: true })
            .catch(() => {
              // Ignore navigation errors (e.g., if user navigates away)
            })
            .finally(() => {
              isNavigating.current = false;
            });
        } else if (onboardingComplete === true) {
          hasRedirected.current = true;
          isNavigating.current = true;
          navigate({ to: "/app", replace: true })
            .catch(() => {
              // Ignore navigation errors (e.g., if user navigates away)
            })
            .finally(() => {
              isNavigating.current = false;
            });
        }
      }, 500); // Delay to let auth state settle and Supabase process hash

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
