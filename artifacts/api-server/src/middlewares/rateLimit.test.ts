// Phase 4, Sprint 52 — Platform Hardening. Unit tests for createRateLimiter()
// against a fully isolated, minimal Express app (never the shared app.js
// singleton) — proves the throttling logic itself works without any risk of
// interfering with the ~90+ other test files that import the real app.

import { describe, it, expect, afterAll } from "vitest";
import express, { type Express } from "express";
import type { Server } from "node:http";
import { createRateLimiter } from "./rateLimit.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalForceFlag = process.env.FORCE_RATE_LIMIT_IN_TEST;

afterAll(() => {
  process.env.NODE_ENV = originalNodeEnv;
  if (originalForceFlag === undefined) delete process.env.FORCE_RATE_LIMIT_IN_TEST;
  else process.env.FORCE_RATE_LIMIT_IN_TEST = originalForceFlag;
});

async function buildTestApp(limit: number, windowMs: number): Promise<{ app: Express; server: Server; baseUrl: string }> {
  // createRateLimiter's own skip() reads NODE_ENV/FORCE_RATE_LIMIT_IN_TEST
  // fresh per-request — force it active for this isolated app only.
  process.env.NODE_ENV = "test";
  process.env.FORCE_RATE_LIMIT_IN_TEST = "true";

  const app = express();
  app.use(createRateLimiter({ limit, windowMs }));
  app.get("/ping", (_req, res) => res.json({ ok: true }));

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to bind test server");
  return { app, server, baseUrl: `http://127.0.0.1:${address.port}` };
}

describe("createRateLimiter (isolated app, never the shared app.js)", () => {
  it("allows requests under the limit", async () => {
    const { server, baseUrl } = await buildTestApp(3, 60_000);
    try {
      for (let i = 0; i < 3; i++) {
        const res = await fetch(`${baseUrl}/ping`);
        expect(res.status).toBe(200);
      }
    } finally {
      server.close();
    }
  });

  it("returns 429 with a clear error message once the limit is exceeded", async () => {
    const { server, baseUrl } = await buildTestApp(2, 60_000);
    try {
      await fetch(`${baseUrl}/ping`);
      await fetch(`${baseUrl}/ping`);
      const res = await fetch(`${baseUrl}/ping`);
      expect(res.status).toBe(429);
      const body = (await res.json()) as { error: string };
      expect(body.error).toMatch(/too many requests/i);
    } finally {
      server.close();
    }
  });

  it("sets standard RateLimit-* response headers, never legacy X-RateLimit-* ones", async () => {
    const { server, baseUrl } = await buildTestApp(5, 60_000);
    try {
      const res = await fetch(`${baseUrl}/ping`);
      expect(res.headers.get("ratelimit-limit")).toBe("5");
      expect(res.headers.has("x-ratelimit-limit")).toBe(false);
    } finally {
      server.close();
    }
  });

  it("is skipped entirely outside of the explicit test-mode opt-in (the default for every other test file in this codebase)", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.FORCE_RATE_LIMIT_IN_TEST;

    const app = express();
    app.use(createRateLimiter({ limit: 1, windowMs: 60_000 }));
    app.get("/ping", (_req, res) => res.json({ ok: true }));
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("failed to bind test server");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      // Limit is 1, but skip() bypasses it entirely without the FORCE flag —
      // every one of these must succeed, never a 429.
      for (let i = 0; i < 5; i++) {
        const res = await fetch(`${baseUrl}/ping`);
        expect(res.status).toBe(200);
      }
    } finally {
      server.close();
    }
  });
});
