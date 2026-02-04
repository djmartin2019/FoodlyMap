import "mapbox-gl/dist/mapbox-gl.css";
import "./index.css";

import * as Sentry from "@sentry/react";
import { RouterProvider } from "@tanstack/react-router";
import { PostHogProvider } from "posthog-js/react";
import React from "react";
import ReactDOM from "react-dom/client";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthProvider } from "./contexts/AuthContext";
import { router } from "./router";

// Sentry configuration
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: false,
    // Environment (development, staging, production)
    environment: import.meta.env.MODE,
    // Release tracking (useful for tracking which version has errors)
    release: import.meta.env.VITE_APP_VERSION || undefined,
    // Integrate with React Router for better error context
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Session Replay for debugging (can be expensive, use selectively)
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Performance monitoring
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0, // 10% in prod, 100% in dev
    // Session Replay sample rate (lower in prod to reduce costs)
    replaysSessionSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0, // Always capture replays on errors
  });
}

// PostHog configuration
const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

// Warn in dev if PostHog is not configured
if (import.meta.env.DEV && !posthogKey) {
  // PostHog not configured - this is expected in some environments
  // No need to log in production
}

/**
 * MaybePostHogProvider - Conditionally wraps children with PostHogProvider
 * when env vars are present, otherwise returns children unchanged.
 * This ensures the component tree structure is stable.
 */
function MaybePostHogProvider({ children }: { children: React.ReactNode }) {
  if (posthogKey && posthogHost) {
    return (
      <PostHogProvider
        apiKey={posthogKey}
        options={{
          api_host: posthogHost,
          autocapture: false,
          capture_pageview: false, // We handle SPA pageviews manually
          capture_pageleave: true,
        }}
      >
        {children}
      </PostHogProvider>
    );
  }
  return <>{children}</>;
}

/**
 * AppShell - Always renders the same component structure.
 * This ensures RouterProvider and AuthProvider are always mounted consistently.
 */
function AppShell() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ErrorBoundary>
  );
}

// Suppress harmless browser extension errors (dev only)
// These errors come from React DevTools, Redux DevTools, ad blockers, etc.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason?.message || event.reason?.toString() || '';
    // Suppress "message channel closed" errors from browser extensions
    if (
      message.includes('message channel closed') ||
      message.includes('asynchronous response')
    ) {
      event.preventDefault();
    }
  }, { capture: true });
}

// Get root element and validate it exists
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element '#root' not found. Cannot mount React app.");
}

// Create root and render
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <MaybePostHogProvider>
      <AppShell />
    </MaybePostHogProvider>
  </React.StrictMode>
);
