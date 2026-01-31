import React from "react";
import ReactDOM from "react-dom/client";
import { PostHogProvider } from "posthog-js/react";
import { AuthProvider } from "./contexts/AuthContext";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { PostHogPageview } from "./components/PostHogPageview";
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
      <PostHogProvider
        apiKey={posthogKey}
        options={{
          api_host: posthogHost,
          autocapture: false,
          capture_pageview: false, // We handle SPA pageviews manually
        }}
      >
        <AuthProvider>
          <RouterProvider router={router} />
          <PostHogPageview />
        </AuthProvider>
      </PostHogProvider>
    );
  }

  // Fallback: render app without PostHog if not configured
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
