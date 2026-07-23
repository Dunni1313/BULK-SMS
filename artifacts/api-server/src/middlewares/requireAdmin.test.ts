// Phase 11 — Live Market Operations & Production Validation. Unit tests for
// requireAdmin(), against a fully isolated, minimal Express app (never the
// shared app.js singleton), matching middlewares/rateLimit.test.ts's and
// securityHeaders.test.ts's own established isolated-app pattern.

import { describe, it, expect } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import type { Server } from "node:http";
import { requireAdmin } from "./requireAdmin.js";

function fakeUser(role: string | undefined) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (role !== undefined) {
      req.user = { id: "u1", email: "u@example.test", displayName: null, role };
    }
    next();
  };
}

async function buildTestApp(role: string | undefined): Promise<{ app: Express; server: Server; baseUrl: string }> {
  const app = express();
  app.use(fakeUser(role));
  app.get("/ops/protected", requireAdmin, (_req, res) => res.json({ ok: true }));

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to bind test server");
  return { app, server, baseUrl: `http://127.0.0.1:${address.port}` };
}

describe("requireAdmin (isolated app)", () => {
  it("returns 401 when there is no authenticated session at all", async () => {
    const { server, baseUrl } = await buildTestApp(undefined);
    try {
      const res = await fetch(`${baseUrl}/ops/protected`);
      expect(res.status).toBe(401);
    } finally {
      server.close();
    }
  });

  it("returns 403 for a real, authenticated non-admin user", async () => {
    const { server, baseUrl } = await buildTestApp("user");
    try {
      const res = await fetch(`${baseUrl}/ops/protected`);
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: string };
      expect(body.error).toMatch(/[Aa]dministrator/);
    } finally {
      server.close();
    }
  });

  it("allows a real admin user through to the protected route", async () => {
    const { server, baseUrl } = await buildTestApp("admin");
    try {
      const res = await fetch(`${baseUrl}/ops/protected`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean };
      expect(body.ok).toBe(true);
    } finally {
      server.close();
    }
  });
});
