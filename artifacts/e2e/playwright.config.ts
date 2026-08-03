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
        // Branch fix/e2e-signup-login-timeout — root cause, directly proven
        // (see docs/E2E-Rate-Limit-Fix.md): middlewares/rateLimit.ts's two
        // limiters (Phase 4, Sprint 52) key strictly by IP, with no override
        // here or anywhere else — that production algorithm is untouched by
        // this file and is correct for a real deployment. But every
        // Playwright worker/spec in this suite runs from ONE machine against
        // ONE long-lived api-server process, so they all share a single IP
        // and therefore a single rate-limit bucket — many independent
        // simulated users colliding in one bucket, not real abuse. A direct
        // repro measured a genuine peak of 303 general API requests and 21
        // /api/auth/* requests inside one 60s window from this suite's own
        // legitimate traffic; both defaults (300 and 20) sit right at or
        // under that. RATE_LIMIT_MAX_REQUESTS/AUTH_RATE_LIMIT_MAX_REQUESTS
        // are the exact, already-existing, already-documented
        // environment-var overrides middlewares/rateLimit.ts's own doc
        // comment names for "a real production deployment [to] retune them"
        // — used here for the mirror-image, equally-intended case: a
        // same-machine, multi-simulated-user test topology retuning them for
        // ITS OWN legitimate traffic. Set only in this webServer's own env
        // block, so only the process Playwright itself starts and manages
        // ever receives them — no real deployment sources this file, and
        // unset (every real deployment, always) falls straight back to the
        // unmodified production defaults (300/20, still fully enforced,
        // still IP-keyed). ~10x headroom over the measured peaks, matching
        // Sprint 52's own "measured baseline, not a guess" convention for
        // these exact two variables.
        RATE_LIMIT_MAX_REQUESTS: "3000",
        AUTH_RATE_LIMIT_MAX_REQUESTS: "300",
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
