// Phase 11 — Live Market Operations & Production Validation. Live
// end-to-end tests for GET /ops/market-data-validation against the real
// app + real Postgres + the real Better-Auth instance (no auth mocking —
// this route's whole point is the real requireAdmin gate). There is
// deliberately no self-service admin-promotion endpoint anywhere in this
// codebase, so "becoming an admin" here is a direct database update,
// exactly matching how a real operator would do it (documented in
// docs/Operations-Runbook.md).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const { default: app } = await import("../app.js");
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to bind test server");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(() => {
  server.close();
});

function getCookie(res: Response): string {
  const raw = res.headers.get("set-cookie");
  if (!raw) throw new Error("expected a Set-Cookie header");
  return raw.split(";")[0];
}

async function signUp(email: string, name: string): Promise<{ cookie: string }> {
  const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "correct-horse-battery-staple", name }),
  });
  if (!res.ok) throw new Error(`sign-up failed: ${res.status}`);
  return { cookie: getCookie(res) };
}

describe("GET /ops/market-data-validation (live, real Postgres + real auth)", () => {
  it("returns 401 with no session at all", async () => {
    const res = await fetch(`${baseUrl}/api/ops/market-data-validation`);
    expect(res.status).toBe(401);
  });

  it("returns 403 for a real, authenticated non-admin user", async () => {
    const email = `ops-nonadmin-${randomUUID()}@example.test`;
    const { cookie } = await signUp(email, "Non Admin");

    const res = await fetch(`${baseUrl}/api/ops/market-data-validation`, { headers: { cookie } });
    expect(res.status).toBe(403);
  });

  it("returns a well-shaped report for a real user manually promoted to admin", async () => {
    const email = `ops-admin-${randomUUID()}@example.test`;
    const { cookie } = await signUp(email, "Admin User");

    // The manual, operator-level promotion — there is no self-service route.
    await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.email, email));

    const res = await fetch(`${baseUrl}/api/ops/market-data-validation`, { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      marketClock: { source: string; isOpen: boolean };
      optionsEngine: { engine: string };
      investingEngine: unknown[];
      tradingEngine: { engine: string };
      conflictingProviderDetection: { applicable: boolean; reason: string };
    };
    expect(["alpaca", "static_approximation"]).toContain(body.marketClock.source);
    expect(body.optionsEngine.engine).toBe("options");
    expect(Array.isArray(body.investingEngine)).toBe(true);
    expect(body.tradingEngine.engine).toBe("trading");
    expect(body.conflictingProviderDetection.applicable).toBe(false);
  });
});
