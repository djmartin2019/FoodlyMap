import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "./contexts/AuthContext";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import "./index.css";
import "mapbox-gl/dist/mapbox-gl.css";

// CRITICAL: RouterProvider must ALWAYS mount - never conditionally render
// AuthProvider is data-only and never blocks rendering
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>
);
