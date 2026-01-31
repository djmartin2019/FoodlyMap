import React from "react";
import ReactDOM from "react-dom/client";
import { PostHogProvider } from "posthog-js/react";
import { AuthProvider } from "./contexts/AuthContext";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import "mapbox-gl/dist/mapbox-gl.css";

// PostHog configuration
const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

// Warn in dev if PostHog is not configured
if (import.meta.env.DEV && !posthogKey) {
  console.warn("PostHog analytics not configured: VITE_PUBLIC_POSTHOG_KEY is missing");
}

// CRITICAL: RouterProvider must ALWAYS mount - never conditionally render
// AuthProvider is data-only and never blocks rendering
const App = () => {
  // Only initialize PostHog if key is provided
  if (posthogKey && posthogHost) {
    return (
      <ErrorBoundary>
        <PostHogProvider
          apiKey={posthogKey}
          options={{
            api_host: posthogHost,
            autocapture: false,
            capture_pageview: false, // We handle SPA pageviews manually
            loaded: () => {
              // Suppress PostHog initialization warnings
            },
          }}
        >
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </PostHogProvider>
      </ErrorBoundary>
    );
  }

  // Fallback: render app without PostHog if not configured
  return (
    <ErrorBoundary>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ErrorBoundary>
  );
};

// Suppress harmless browser extension errors
// These errors come from React DevTools, Redux DevTools, ad blockers, etc.
// and don't affect app functionality
if (typeof window !== 'undefined') {
  // Catch unhandled promise rejections from browser extensions
  window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason?.message || event.reason?.toString() || '';
    // Suppress "message channel closed" errors from browser extensions
    if (
      message.includes('message channel closed') ||
      message.includes('asynchronous response')
    ) {
      event.preventDefault();
      // Don't log these errors as they're harmless
      return false;
    }
  }, { capture: true });
}

// Store root instance to prevent re-creation (React StrictMode causes double mount in dev)
let root: ReactDOM.Root | null = null;
const rootElement = document.getElementById("root");

if (!root) {
  root = ReactDOM.createRoot(rootElement!);
}

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
