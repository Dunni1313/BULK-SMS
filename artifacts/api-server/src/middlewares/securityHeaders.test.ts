// Phase 9 — Production Readiness. Unit tests for securityHeaders() against
// a fully isolated, minimal Express app (never the shared app.js singleton),
// matching middlewares/rateLimit.test.ts's own established isolated-app
// pattern.

import { describe, it, expect } from "vitest";
import express, { type Express } from "express";
import type { Server } from "node:http";
import { securityHeaders } from "./securityHeaders.js";
import app from "../app.js";

async function buildTestApp(): Promise<{ app: Express; server: Server; baseUrl: string }> {
  const app = express();
  app.use(securityHeaders);
  app.get("/ping", (_req, res) => res.json({ ok: true }));

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to bind test server");
  return { app, server, baseUrl: `http://127.0.0.1:${address.port}` };
}

describe("securityHeaders (isolated app, never the shared app.js)", () => {
  it("sets X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and X-DNS-Prefetch-Control on every response", async () => {
    const { server, baseUrl } = await buildTestApp();
    try {
      const res = await fetch(`${baseUrl}/ping`);
      expect(res.status).toBe(200);
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("x-frame-options")).toBe("DENY");
      expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
      expect(res.headers.get("x-dns-prefetch-control")).toBe("off");
    } finally {
      server.close();
    }
  });

  it("never sets Strict-Transport-Security over a plain (non-secure, non-forced) request", async () => {
    const original = process.env.FORCE_HSTS;
    delete process.env.FORCE_HSTS;
    const { server, baseUrl } = await buildTestApp();
    try {
      const res = await fetch(`${baseUrl}/ping`);
      expect(res.headers.has("strict-transport-security")).toBe(false);
    } finally {
      server.close();
      if (original === undefined) delete process.env.FORCE_HSTS;
      else process.env.FORCE_HSTS = original;
    }
  });

  it("sets Strict-Transport-Security when FORCE_HSTS=true (simulating a TLS-terminating-elsewhere deployment)", async () => {
    const original = process.env.FORCE_HSTS;
    process.env.FORCE_HSTS = "true";
    const { server, baseUrl } = await buildTestApp();
    try {
      const res = await fetch(`${baseUrl}/ping`);
      expect(res.headers.get("strict-transport-security")).toBe("max-age=15552000; includeSubDomains");
    } finally {
      server.close();
      if (original === undefined) delete process.env.FORCE_HSTS;
      else process.env.FORCE_HSTS = original;
    }
  });

  it("never blocks or alters the actual response body/status — headers only", async () => {
    const { server, baseUrl } = await buildTestApp();
    try {
      const res = await fetch(`${baseUrl}/ping`);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body).toEqual({ ok: true });
    } finally {
      server.close();
    }
  });

  it("is genuinely wired into the real app — /api/healthz on the actual app.js carries the same headers", async () => {
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("failed to bind test server");
    try {
      const res = await fetch(`http://127.0.0.1:${address.port}/api/healthz`);
      expect(res.status).toBe(200);
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("x-frame-options")).toBe("DENY");
    } finally {
      server.close();
    }
  });
});
