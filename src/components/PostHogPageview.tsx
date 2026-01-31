import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { usePostHog } from "posthog-js/react";

/**
 * Tracks SPA pageviews for TanStack Router
 * Captures $pageview event when route changes
 */
export function PostHogPageview() {
  const posthog = usePostHog();
  const location = useRouterState({ select: (s) => s.location });
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    // Only track if PostHog is initialized
    if (!posthog) return;

    const currentPath = location.pathname + location.search;
    
    // Avoid double-firing on initial mount or when path hasn't changed
    if (lastPathRef.current === currentPath) return;
    
    lastPathRef.current = currentPath;

    // Capture pageview with current URL
    posthog.capture("$pageview", {
      $current_url: window.location.href,
      path: location.pathname,
    });
  }, [posthog, location.pathname, location.search]);

  return null;
}
