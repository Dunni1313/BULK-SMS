// Phase 25 — Institutional Trade Workspace. Live route integration test for
// the thin Session route wrapper. Mirrors routes/tradingStructure.route.test.ts's
// own established pattern — no ownership/tenant scoping needed since this is
// read-only market/session data, not a user-scoped resource.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface SessionResponse {
  symbol: string;
  asOf: string;
  activeSessions: string[];
  sessionHigh: number | null;
  sessionLow: number | null;
}

describe("Trading Session routes (live, real Postgres, SIMULATED path)", () => {
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

  it("resolves session data for a known symbol", async () => {
    const res = await fetch(`${baseUrl}/api/trading/session/AAPL`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as SessionResponse;
    expect(body.symbol).toBe("AAPL");
    expect(Array.isArray(body.activeSessions)).toBe(true);
    expect(body.asOf).toBeTruthy();
  });

  it("respects an explicit ?asOf= override, reporting only sessions active at that instant", async () => {
    // 2026-01-05T03:00:00Z -> hour 3 UTC: Sydney (21-06 wrap) and Tokyo (0-9) are open; London/New York are not.
    const res = await fetch(`${baseUrl}/api/trading/session/AAPL?asOf=2026-01-05T03:00:00.000Z`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as SessionResponse;
    expect(body.activeSessions.sort()).toEqual(["sydney", "tokyo"].sort());
    expect(body.activeSessions).not.toContain("london");
    expect(body.activeSessions).not.toContain("new_york");
  });

  it("returns 404 for an invalid ticker shape", async () => {
    const res = await fetch(`${baseUrl}/api/trading/session/${encodeURIComponent("NOT A TICKER!!")}`);
    expect(res.status).toBe(404);
  });

  it("is deterministic across repeated calls for the same asOf", async () => {
    const asOf = "2026-01-05T15:00:00.000Z";
    const first = await (await fetch(`${baseUrl}/api/trading/session/AAPL?asOf=${asOf}`)).json();
    const second = await (await fetch(`${baseUrl}/api/trading/session/AAPL?asOf=${asOf}`)).json();
    expect(first).toEqual(second);
  });
});
