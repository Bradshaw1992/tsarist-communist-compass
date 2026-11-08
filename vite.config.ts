import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "pwa-icon-192.png", "pwa-icon-512.png"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json,woff2}"],
        navigateFallbackDenylist: [/^\/~oauth/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Revision CONTENT only — the same rows for every student, so a shared
            // school machine caching them is harmless. Serves instantly from cache
            // and revalidates in the background, which also means content still
            // renders for a returning student when Supabase is unreachable.
            //
            // The table list is an ALLOW-LIST and must stay one. Workbox matches on
            // URL and ignores the Authorization header, so a cached response from
            // one session can be served to another: anything per-user cached here
            // would leak between students sharing an IT-room browser. Deliberately
            // excluded: every user_* table, question_review_queue, classes,
            // class_members, schools (a search endpoint, not content), and
            // exam_guides (paywalled — entitlement is checked per request).
            urlPattern:
              /^https:\/\/[a-z0-9]+\.supabase\.co\/rest\/v1\/(spec_points|recall_content|fact_questions|concept_questions|chronology_questions|exam_questions|extracts|extract_sets)\?/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "supabase-content-cache",
              expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 7 },
              // NOT [0, 200]: status 0 is an opaque response, and caching one would
              // persist a failed cross-origin fetch as if it were content.
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      manifest: {
        name: "Russia Revision — A-Level History Revision",
        short_name: "Russia Revision",
        description: "AI-powered A-Level History revision: Tsarist and Communist Russia 1855–1964.",
        theme_color: "#0a1e3d",
        background_color: "#f3f4f7",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "pwa-icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
