// Phase 4, Sprint 52 — Platform Hardening (approved Phase 4 plan, Sprint 52;
// see docs/Phase-4-Master-Execution-Plan.md's Sprint 52 as-built note).
//
// Rate-limiting middleware across the business router, per the approved
// Sprint 52 scope. Two tiers, matching standard practice for an API that
// mixes general reads/writes with a credential-sensitive auth surface:
//
//   - generalRateLimiter: applied to every business route.
//   - authRateLimiter: a stricter, additional limit applied only to
//     Better-Auth's own sign-in/sign-up endpoints, to slow credential-
//     stuffing/brute-force attempts specifically.
//
// Threshold values are a measured baseline, not a guess: before writing
// this file, every existing routes/*.route.test.ts and lib/*.test.ts file
// in this codebase was grep-counted for how many HTTP requests it makes
// against its own single server instance in one run — the busiest file
// (routes/portfolioConstruction.route.test.ts) makes 23. The default
// general limit (300 requests / 60s per IP) is more than 10x that,
// generous headroom for a legitimate client polling several dashboard
// widgets, while still providing real abuse protection. Both defaults are
// environment-overridable (RATE_LIMIT_WINDOW_MS / RATE_LIMIT_MAX_REQUESTS /
// AUTH_RATE_LIMIT_MAX_REQUESTS) so a real production deployment can retune
// them once lib/requestMetrics.ts's own ongoing volume baseline shows real
// traffic patterns, per the plan's own "used to set threshold values, not
// guessed" acceptance criterion.
//
// Scheduler-internal calls (index.ts's 60s auto-execution/auto-adjustment
// tick) were confirmed, by direct inspection before this sprint began, to
// never make an HTTP request to this server at all — they call
// runAutoExecutionCycleForAllUsers()/runAutoAdjustmentCycleForAllUsers()
// as plain in-process TypeScript function calls, never touching Express's
// request pipeline. There is therefore nothing to explicitly exclude: this
// middleware, being HTTP-request-scoped, structurally cannot throttle the
// scheduler, and no bypass logic was added for a case that cannot occur.
//
// Test-mode safety: this middleware skips entirely whenever
// NODE_ENV === "test", UNLESS FORCE_RATE_LIMIT_IN_TEST=true is explicitly
// set (read fresh per-request, not cached at import time, so a single
// dedicated test file can opt itself in without affecting any other test
// file's own app instance) — every other existing test file in this
// codebase makes real HTTP requests against a freshly-imported app
// instance and must never risk tripping a shared, accumulating rate limit
// by construction. Health checks (routes/health.ts) are mounted before
// this middleware in app.ts and therefore never pass through it at all —
// no separate skip logic was needed for them either.

import rateLimit, { type RateLimitRequestHandler } from "express-rate-limit";

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_GENERAL_LIMIT = 300;
const DEFAULT_AUTH_LIMIT = 20;

function isTestBypassed(): boolean {
  return process.env.NODE_ENV === "test" && process.env.FORCE_RATE_LIMIT_IN_TEST !== "true";
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export interface RateLimiterOptions {
  windowMs: number;
  limit: number;
}

// Exported factory — lets a test construct a fully isolated limiter
// instance (its own in-memory store, its own thresholds) without touching
// the shared app.js singleton or any environment variable, the safest way
// to prove the throttling logic itself works.
export function createRateLimiter(options: RateLimiterOptions): RateLimitRequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTestBypassed(),
    message: { error: "Too many requests — please slow down and try again shortly." },
  });
}

export const generalRateLimiter: RateLimitRequestHandler = createRateLimiter({
  windowMs: envInt("RATE_LIMIT_WINDOW_MS", DEFAULT_WINDOW_MS),
  limit: envInt("RATE_LIMIT_MAX_REQUESTS", DEFAULT_GENERAL_LIMIT),
});

export const authRateLimiter: RateLimitRequestHandler = createRateLimiter({
  windowMs: envInt("RATE_LIMIT_WINDOW_MS", DEFAULT_WINDOW_MS),
  limit: envInt("AUTH_RATE_LIMIT_MAX_REQUESTS", DEFAULT_AUTH_LIMIT),
});
