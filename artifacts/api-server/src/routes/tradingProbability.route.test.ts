// Phase 3, Sprint 43 — live route integration test for the Probability
// surface, the fourth bounded slice of the Route+UI backlog reduction. Uses
// the real app + a real Postgres connection (no auth session needed —
// unauthenticated requests resolve to the legacy-owner stand-in per
// tenantScope.ts). This route is a thin pass-through to Sprint 37's
// already-unit-tested buildProbabilityAnalysis() — these tests prove the
// HTTP wiring and the disclosed response projection, not the probability
// math itself.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface ProbabilityConeLevelResponse {
  daysAhead: number;
  low1Sigma: number;
  high1Sigma: number;
  low2Sigma: number;
  high2Sigma: number;
}

interface ProbabilityResponse {
  symbol: string;
  dataSource: string;
  currentPrice: number;
  volatilityAnnualizedPct: number | null;
  available: boolean;
  unavailableReason: string | null;
  cone: ProbabilityConeLevelResponse[];
  confidenceLevel: string;
  confidenceExplanation: string;
  summary: string;
  regime?: unknown;
}

describe("Probability routes (live, real Postgres, SIMULATED path)", () => {
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

  it("resolves a well-shaped probability analysis for a known symbol", async () => {
    const res = await fetch(`${baseUrl}/api/trading/probability/AAPL`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ProbabilityResponse;
    expect(body.symbol).toBe("AAPL");
    expect(body.dataSource).toBe("SIMULATED");
    expect(body.currentPrice).toBeGreaterThan(0);
    expect(body.available).toBe(true);
    expect(body.unavailableReason).toBeNull();
    expect(["High", "Moderate", "Low"]).toContain(body.confidenceLevel);
    expect(Array.isArray(body.cone)).toBe(true);
    expect(body.cone.length).toBeGreaterThan(0);
    for (const level of body.cone) {
      expect(level.low1Sigma).toBeLessThanOrEqual(level.high1Sigma);
      expect(level.low2Sigma).toBeLessThanOrEqual(level.low1Sigma);
      expect(level.high1Sigma).toBeLessThanOrEqual(level.high2Sigma);
    }
  });

  it("projects only the disclosed probability-summary fields, never leaking the full nested regime sub-analysis", async () => {
    const res = await fetch(`${baseUrl}/api/trading/probability/AAPL`);
    const body = (await res.json()) as ProbabilityResponse;
    expect(body.regime).toBeUndefined();
  });

  it("returns 404 for an invalid ticker shape, never fabricating an analysis", async () => {
    const res = await fetch(`${baseUrl}/api/trading/probability/${encodeURIComponent("NOT A TICKER!!")}`);
    expect(res.status).toBe(404);
  });

  it("is deterministic across repeated calls for the same symbol", async () => {
    const a = await (await fetch(`${baseUrl}/api/trading/probability/NVDA`)).json();
    const b = await (await fetch(`${baseUrl}/api/trading/probability/NVDA`)).json();
    expect(a).toEqual(b);
  });
});
