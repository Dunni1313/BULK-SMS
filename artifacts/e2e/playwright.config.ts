// Phase 6, Sprint 69 — E2E Testing Framework Selection + First Smoke Slice.
// See docs/Phase-6-Master-Planning-Document.md §5 and the Sprint 69 as-built
// note in that same document for the full framework-selection rationale.
//
// Playwright's own `webServer` array starts BOTH halves of this repo's
// two-process architecture (the Express api-server and the Vite-built
// ravish-trading frontend, served via `vite preview`) as real child
// processes, waits for each to report healthy, runs the test suite against
// them, then tears both down — no separate orchestration script needed.
//
// Requires DATABASE_URL and BETTER_AUTH_SECRET in the environment, exactly
// like every other live-HTTP test file in this repo (see api-server's own
// vitest suite) — this is not a new requirement, just the same one applied
// to a new test runner.
import { defineConfig, devices } from "@playwright/test";

const API_PORT = 4300;
const FRONTEND_PORT = 4173;
const FRONTEND_BASE_PATH = "/";

const requiredEnv = ["DATABASE_URL", "BETTER_AUTH_SECRET"] as const;
for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(
      `${key} environment variable is required to run the E2E suite (same requirement as every other live-HTTP test in this repo).`,
    );
  }
}

const apiUrl = `http://127.0.0.1:${API_PORT}`;
const frontendUrl = `http://127.0.0.1:${FRONTEND_PORT}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // each test signs up its own fresh user — no shared-state risk, but keep this first slice simple and deterministic
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: frontendUrl,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @workspace/api-server run build && pnpm --filter @workspace/api-server run start",
      url: `${apiUrl}/api/healthz`,
      cwd: "../..",
      env: {
        ...process.env,
        PORT: String(API_PORT),
        NODE_ENV: "development", // never "test" — the E2E suite should exercise the same code paths (rate limiting, etc.) a real deployment does, not the test-mode skip branches
        // The frontend (vite preview) and backend run as two separate
        // origins locally (see the vite.config.ts proxy note above) —
        // CORS_ALLOWED_ORIGINS/Better-Auth's matching trustedOrigins
        // (both read this same env var, Phase 1 Sprint 6) must include the
        // frontend's own origin or Better-Auth rejects every sign-in with
        // "Invalid origin", and plain CORS blocks every other /api call.
        CORS_ALLOWED_ORIGINS: frontendUrl,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @workspace/ravish-trading run build && pnpm --filter @workspace/ravish-trading run serve",
      url: frontendUrl,
      cwd: "../..",
      env: {
        ...process.env,
        PORT: String(FRONTEND_PORT),
        BASE_PATH: FRONTEND_BASE_PATH,
        NODE_ENV: "production",
        E2E_API_PROXY_TARGET: apiUrl,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
