import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

// Phase 6, Sprint 69 — E2E testing only. The generated API client
// (lib/api-client-react/src/custom-fetch.ts) makes relative `/api/...`
// requests resolved against whatever origin the page was loaded from; no
// dev/preview proxy exists anywhere in this repo today because the real
// deployment target (Replit Autoscale, `router: "application"`) serves
// frontend and backend under one origin at the infrastructure level, which
// this repo's own config has no visibility into. Playwright's own webServer
// starts the frontend (`vite preview`) and backend (`api-server`) as two
// separate local processes on two separate ports, so `/api/...` requests
// from the frontend's own origin would otherwise 404 with nothing to route
// them to the backend. This proxy is opt-in only (undefined unless
// E2E_API_PROXY_TARGET is explicitly set by artifacts/e2e's own Playwright
// config) — every existing `pnpm dev`/`pnpm build`/`pnpm preview` invocation
// that doesn't set this var is completely unaffected.
const apiProxyTarget = process.env.E2E_API_PROXY_TARGET;
const apiProxy = apiProxyTarget
  ? { "/api": { target: apiProxyTarget, changeOrigin: true } }
  : undefined;

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: apiProxy,
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: apiProxy,
  },
});
