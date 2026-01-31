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
