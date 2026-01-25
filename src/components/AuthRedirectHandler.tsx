import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "../contexts/AuthContext";

/**
 * AuthRedirectHandler component
 * 
 * This component handles automatic redirection after authentication events
 * (invite links, magic links, normal login). It listens to auth state changes
 * and redirects users to the correct page based on their onboarding status.
 * 
 * Why this is needed:
 * - Supabase invite/magic links authenticate users but don't know where to redirect
 * - We need to check onboarding_complete status from the profiles table
 * - Route guards handle initial checks, but this handles dynamic auth state changes
 * - Prevents users from landing on the wrong page after clicking invite links
 */
export function AuthRedirectHandler() {
  const { user, onboardingComplete, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Don't redirect while loading or if no user
    if (loading || !user) {
      return;
    }

    // Get current pathname to avoid redirect loops
    const currentPath = window.location.pathname;

    // Only redirect if we're on a public route and user is authenticated
    // This handles invite/magic link flows where users land on / or /login
    const publicRoutes = ["/", "/login", "/contact", "/request-access"];

    if (publicRoutes.includes(currentPath)) {
      // Redirect based on onboarding status
      if (onboardingComplete === true) {
        navigate({ to: "/app", replace: true });
      } else if (onboardingComplete === false) {
        navigate({ to: "/set-password", replace: true });
      }
      // If onboardingComplete is null, wait for it to be determined
    }
  }, [user, onboardingComplete, loading, navigate]);

  // This component doesn't render anything
  return null;
}
