// Phase 4, Sprint 52 — Platform Hardening. Live end-to-end tests against the
// real app.js (the throttling logic itself is already covered in isolation
// by middlewares/rateLimit.test.ts). Matches this codebase's own established
// single-shared-server-per-file pattern (every other routes/*.route.test.ts
// file does the same) rather than trying to reset modules between test
// cases — one app instance, one in-memory rate-limit store, for the whole
// file. Low-but-generous test-only thresholds are set via env vars before
// the one import, and a running counter tracks exactly how many general-
// limiter-counted requests each test has made, so the final "trip the
// limit" test computes precisely how many more requests are needed rather
// than hardcoding a brittle tally.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

const GENERAL_LIMIT = 12;
const AUTH_LIMIT = 3;

describe("Rate limiting (live, real app.js, one shared instance, low test-only thresholds)", () => {
  let server: Server;
  let baseUrl: string;
  // Every request that passes through generalRateLimiter (i.e. everything
  // except /api/healthz, which is mounted before it) increments this,
  // regardless of which test made it — the store is shared for the whole
  // file, matching the real middleware's own per-IP, per-window behavior.
  let generalRequestsMade = 0;

  beforeAll(async () => {
    process.env.FORCE_RATE_LIMIT_IN_TEST = "true";
    process.env.RATE_LIMIT_MAX_REQUESTS = String(GENERAL_LIMIT);
    process.env.AUTH_RATE_LIMIT_MAX_REQUESTS = String(AUTH_LIMIT);
    process.env.RATE_LIMIT_WINDOW_MS = "60000";

    const { default: app } = await import("../app.js");
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(() => {
    server.close();
    delete process.env.FORCE_RATE_LIMIT_IN_TEST;
    delete process.env.RATE_LIMIT_MAX_REQUESTS;
    delete process.env.AUTH_RATE_LIMIT_MAX_REQUESTS;
    delete process.env.RATE_LIMIT_WINDOW_MS;
  });

  it("health checks are exempt from rate limiting, even far beyond the low general threshold", async () => {
    for (let i = 0; i < GENERAL_LIMIT * 2; i++) {
      const res = await fetch(`${baseUrl}/api/healthz`);
      expect(res.status).toBe(200);
    }
    // Health checks never touch generalRateLimiter (mounted after
    // healthRouter in app.ts) — the running counter is untouched.
    expect(generalRequestsMade).toBe(0);
  });

  it("an SSE stream request passes through the rate limiter and completes normally, never cut off mid-stream", async () => {
    const res = await fetch(`${baseUrl}/api/trading/coach/ask/stream`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL", question: "What does the data say?" }),
    });
    generalRequestsMade += 1;
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);

    const text = await res.text();
    // A fully-received, uninterrupted stream carries the whole event
    // protocol (lib/sse.ts) through to its authoritative final frame — if
    // the rate limiter had cut the connection mid-stream, "event: done"
    // would never arrive.
    expect(text).toContain("event: meta");
    expect(text).toContain("event: done");
  });

  it("sets standard RateLimit-* headers on a real route response, never legacy X-RateLimit-* ones", async () => {
    const res = await fetch(`${baseUrl}/api/trading/structure/AAPL`);
    generalRequestsMade += 1;
    expect(res.status).toBe(200);
    expect(res.headers.get("ratelimit-limit")).toBe(String(GENERAL_LIMIT));
    expect(res.headers.has("x-ratelimit-limit")).toBe(false);
  });

  it("the auth-specific limiter is stricter than the general one and trips first on an auth route", async () => {
    // /api/auth/me requires a session and 401s without one — that's fine,
    // the rate limiter runs before the route handler regardless of what
    // status the handler itself would eventually return. Each of these 4
    // requests also counts against the general limiter (mounted before the
    // auth-specific one), including the one the auth limiter itself blocks.
    for (let i = 0; i < AUTH_LIMIT; i++) {
      const res = await fetch(`${baseUrl}/api/auth/me`);
      generalRequestsMade += 1;
      expect(res.status).toBe(401);
    }
    const fourth = await fetch(`${baseUrl}/api/auth/me`);
    generalRequestsMade += 1;
    expect(fourth.status).toBe(429);

    // The general limit is nowhere near exhausted yet — a non-auth route
    // still resolves normally, proving the stricter limit is scoped to the
    // auth router only, not applied globally.
    expect(generalRequestsMade).toBeLessThan(GENERAL_LIMIT);
    const structureRes = await fetch(`${baseUrl}/api/trading/structure/AAPL`);
    generalRequestsMade += 1;
    expect(structureRes.status).toBe(200);
  });

  it("allows requests under the general limit, then returns 429 once it's exceeded", async () => {
    // Consume exactly whatever's left of the shared budget, then one more.
    const remaining = GENERAL_LIMIT - generalRequestsMade;
    expect(remaining).toBeGreaterThan(0);
    for (let i = 0; i < remaining; i++) {
      const res = await fetch(`${baseUrl}/api/trading/structure/AAPL`);
      generalRequestsMade += 1;
      expect(res.status).toBe(200);
    }
    expect(generalRequestsMade).toBe(GENERAL_LIMIT);

    const res = await fetch(`${baseUrl}/api/trading/structure/AAPL`);
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/too many requests/i);
  });
});
