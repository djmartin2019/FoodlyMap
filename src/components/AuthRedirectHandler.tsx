import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "../contexts/AuthContext";

/**
 * AuthRedirectHandler component
 * 
 * Handles automatic redirection after SIGNED_IN events from invite links and magic links.
 * CRITICAL: Only handles auth state changes, NOT route navigation.
 * 
 * This component should NOT interfere with normal route navigation.
 */
export function AuthRedirectHandler() {
  const { user, onboardingComplete, loading } = useAuth();
  const navigate = useNavigate();
  const hasRedirected = useRef(false);
  const isNavigating = useRef(false);
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // CRITICAL: Only handle auth state changes, NOT route navigation
    // This effect should only run when user/auth state changes
    
    if (loading || isNavigating.current) {
      return;
    }

    const currentUserId = user?.id || null;
    const previousUserId = previousUserIdRef.current;
    
    // CRITICAL: Only proceed if user state actually changed
    // If user hasn't changed, this is route navigation - don't interfere
    if (previousUserId === currentUserId) {
      return;
    }
    
    // User state changed - update tracking
    previousUserIdRef.current = currentUserId;
    
    // Handle sign out - just reset state
    if (!user) {
      hasRedirected.current = false;
      return;
    }
    
    // Handle sign in - this is a new auth event
    // Only redirect if onboarding is incomplete (invite link scenario)
    if (currentUserId !== null && previousUserId !== currentUserId && onboardingComplete === false) {
      if (hasRedirected.current) {
        return;
      }
      
      // Get current path from window (don't use routerState to avoid re-renders)
      const currentPath = window.location.pathname;
      
      // Only redirect from home or login pages for invite links
      if (currentPath === "/" || currentPath === "/login") {
        hasRedirected.current = true;
        isNavigating.current = true;
        navigate({ to: "/set-password", replace: true, search: {} })
          .catch(() => {})
          .finally(() => {
            isNavigating.current = false;
          });
      }
    }
  }, [user, onboardingComplete, loading, navigate]);
  // NOTE: Only depends on auth state, NOT route state

  return null;
}
