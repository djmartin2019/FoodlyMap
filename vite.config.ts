import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Optimize build output for production
    minify: "esbuild",
    // Enable sourcemaps for Sentry error tracking (Sentry will upload them separately)
    sourcemap: true,
    rollupOptions: {
      output: {
        // Optimize chunk splitting for better caching
        manualChunks: {
          vendor: ["react", "react-dom"],
          router: ["@tanstack/react-router"],
          mapbox: ["mapbox-gl"],
        },
      },
    },
    // Increase chunk size warning limit (mapbox-gl is large)
    chunkSizeWarningLimit: 1000,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-router"],
  },
});
