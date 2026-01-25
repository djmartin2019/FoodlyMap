import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
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
  const hasRedirected = useRef(false); // Prevent multiple redirects

  useEffect(() => {
    // Don't redirect while loading or if no user
    if (loading || !user) {
      hasRedirected.current = false;
      return;
    }

    // Prevent multiple redirects for the same auth event
    if (hasRedirected.current) {
      return;
    }

    // Get current pathname to avoid redirect loops
    const currentPath = window.location.pathname;

    // Only redirect if we're on a public route and user is authenticated
    // This handles invite/magic link flows where users land on / or /login
    const publicRoutes = ["/", "/login", "/contact", "/request-access"];

    if (publicRoutes.includes(currentPath)) {
      // Redirect based on onboarding status
      // Use replace: true to avoid back-button issues
      if (onboardingComplete === true) {
        hasRedirected.current = true;
        navigate({ to: "/app", replace: true });
      } else if (onboardingComplete === false) {
        hasRedirected.current = true;
        navigate({ to: "/set-password", replace: true });
      }
      // If onboardingComplete is null, wait for it to be determined
    }
  }, [user, onboardingComplete, loading, navigate]);

  // This component doesn't render anything
  return null;
}
