// Phase 27 — Institutional Liquidity & Session Workbench. Live route
// integration test for the thin Session Windows route wrapper. Mirrors
// routes/tradingSession.route.test.ts's own established pattern — no
// ownership/tenant scoping needed since this is read-only market/session
// data, not a user-scoped resource.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface SessionWindowSummary {
  name: string;
  role: string;
  isActive: boolean;
  candleCount: number;
  high: number | null;
  low: number | null;
}

interface SessionWindowsResponse {
  symbol: string;
  asOf: string;
  activeSessionNames: string[];
  overlap: boolean;
  sessions: SessionWindowSummary[];
  activeSession: SessionWindowSummary | null;
  previousSession: SessionWindowSummary | null;
  upcomingSession: SessionWindowSummary | null;
  summary: string;
}

describe("Trading Session Windows routes (live, real Postgres, SIMULATED path)", () => {
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

  it("resolves a well-shaped session windows overview for a known symbol, with all 4 named sessions present", async () => {
    const res = await fetch(`${baseUrl}/api/trading/session-windows/AAPL`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as SessionWindowsResponse;
    expect(body.symbol).toBe("AAPL");
    expect(body.sessions.map((s) => s.name).sort()).toEqual(["london", "new_york", "sydney", "tokyo"].sort());
    expect(Array.isArray(body.activeSessionNames)).toBe(true);
  });

  it("never fabricates high/low for a session whose window has no overlapping candle data, honestly reporting null/0", async () => {
    const res = await fetch(`${baseUrl}/api/trading/session-windows/AAPL`);
    const body = (await res.json()) as SessionWindowsResponse;
    for (const s of body.sessions) {
      if (s.candleCount === 0) {
        expect(s.high).toBeNull();
        expect(s.low).toBeNull();
      }
    }
  });

  it("always identifies a previous and an upcoming session among the ones not currently active", async () => {
    const res = await fetch(`${baseUrl}/api/trading/session-windows/AAPL`);
    const body = (await res.json()) as SessionWindowsResponse;
    expect(body.previousSession).not.toBeNull();
    expect(body.upcomingSession).not.toBeNull();
  });

  it("returns 404 for an invalid ticker shape, never fabricating an overview", async () => {
    const res = await fetch(`${baseUrl}/api/trading/session-windows/${encodeURIComponent("NOT A TICKER!!")}`);
    expect(res.status).toBe(404);
  });

  it("is deterministic across repeated calls for the same symbol", async () => {
    const first = await (await fetch(`${baseUrl}/api/trading/session-windows/MSFT`)).json();
    const second = await (await fetch(`${baseUrl}/api/trading/session-windows/MSFT`)).json();
    // asOf legitimately differs between two real, separately-timestamped
    // calls — excluded from the equality check, matching this codebase's
    // own established fetchedAt/asOf-exclusion precedent.
    const { asOf: asOfA, ...restA } = first as Record<string, unknown>;
    const { asOf: asOfB, ...restB } = second as Record<string, unknown>;
    expect(restA).toEqual(restB);
  });
});
