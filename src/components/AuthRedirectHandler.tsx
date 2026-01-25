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
  const previousUserRef = useRef<string | null>(null); // Track previous user ID
  const isInitialAuthEvent = useRef(false); // Track if this is a new sign-in event

  useEffect(() => {

    const currentPath = routerState.location.pathname;
    const currentUserId = user?.id || null;
    
    // Detect new sign-in events (like invite links or login)
    // This happens when user ID changes from null to a value, or changes to a different user
    const isNewSignIn = previousUserRef.current !== currentUserId && currentUserId !== null;
    
    if (isNewSignIn) {
      // New sign-in event detected - this is likely from invite link or login
      hasRedirected.current = false; // Reset redirect flag for new auth event
      isInitialAuthEvent.current = true; // Mark as initial auth event
      previousUserRef.current = currentUserId;
    } else if (previousUserRef.current === currentUserId && currentUserId !== null) {
      // Same user, not a new sign-in - this is manual navigation
      isInitialAuthEvent.current = false; // Not an initial auth event
    }
    
    if (!user) {
      // User logged out - reset everything
      hasRedirected.current = false;
      previousUserRef.current = null;
      isInitialAuthEvent.current = false;
      return;
    }

    // Don't redirect while loading or if navigation is already in progress
    if (loading || isNavigating.current) {
      return;
    }

    // Don't interfere with form submission pages or protected routes
    // These pages handle their own redirects after form submission
    const formPages = ["/set-password", "/reset-password"];
    if (formPages.includes(currentPath)) {
      return;
    }

    // Only redirect on initial auth events (invite links, login), not on manual navigation
    // This prevents redirecting users away from pages they manually navigated to
    if (!isInitialAuthEvent.current || hasRedirected.current) {
      return;
    }

    // Only redirect from /login on initial auth events
    // Allow authenticated users to freely navigate to home page and other public routes
    // This prevents the "flash and redirect" issue when clicking the logo
    if (currentPath === "/login") {
      // Double-check conditions haven't changed
      if (isNavigating.current || hasRedirected.current || !user || !isInitialAuthEvent.current) {
        return;
      }

      // If onboarding status is null or false, redirect to set-password
      if (onboardingComplete === null || onboardingComplete === false) {
        hasRedirected.current = true;
        isNavigating.current = true;
        navigate({ to: "/set-password", replace: true })
          .catch(() => {
            // Ignore navigation errors
          })
          .finally(() => {
            isNavigating.current = false;
            isInitialAuthEvent.current = false; // Reset after redirect
          });
      } else if (onboardingComplete === true) {
        hasRedirected.current = true;
        isNavigating.current = true;
        navigate({ to: "/app", replace: true })
          .catch(() => {
            // Ignore navigation errors
          })
          .finally(() => {
            isNavigating.current = false;
            isInitialAuthEvent.current = false; // Reset after redirect
          });
      }
      return;
    }
    
    // For invite links that land on home page (/), also redirect once
    // But only on initial auth events, not manual navigation
    if (currentPath === "/" && isInitialAuthEvent.current && !hasRedirected.current) {
      if (isNavigating.current || hasRedirected.current || !user || !isInitialAuthEvent.current) {
        return;
      }

      // If onboarding status is null or false, redirect to set-password (invite link flow)
      if (onboardingComplete === null || onboardingComplete === false) {
        hasRedirected.current = true;
        isNavigating.current = true;
        navigate({ to: "/set-password", replace: true })
          .catch(() => {
            // Ignore navigation errors
          })
          .finally(() => {
            isNavigating.current = false;
            isInitialAuthEvent.current = false; // Reset after redirect
          });
      } else if (onboardingComplete === true) {
        // If onboarding is complete, don't redirect from home page
        // Allow users to view the home page even when authenticated
        hasRedirected.current = true; // Mark as handled
        isInitialAuthEvent.current = false; // Reset
      }
      return;
    }
  }, [user, onboardingComplete, loading, navigate, routerState.location.pathname]);

  // This component doesn't render anything
  return null;
}
