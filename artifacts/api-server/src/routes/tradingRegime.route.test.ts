// Phase 3, Sprint 42 — live route integration test for the Market Regime
// surface, the third bounded slice of the Route+UI backlog reduction. Uses
// the real app + a real Postgres connection (no auth session needed —
// unauthenticated requests resolve to the legacy-owner stand-in per
// tenantScope.ts). This route is a thin pass-through to Sprint 36's
// already-unit-tested buildMarketRegimeAnalysis() — these tests prove the
// HTTP wiring and the disclosed response projection, not the regime math
// itself.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface RegimeResponse {
  symbol: string;
  dataSource: string;
  regimeLabel: string;
  trendRegime: string | null;
  trendAgreement: string;
  volatilityRegime: string;
  volatilityAnnualizedPct: number | null;
  liquidityRegime: string;
  confidenceLevel: string;
  summary: string;
  multiTimeframe?: unknown;
  liquidity?: unknown;
}

const REGIME_LABELS = ["trending-bullish", "trending-bearish", "range-bound", "volatile-choppy", "quiet-consolidation"];

describe("Market Regime routes (live, real Postgres, SIMULATED path)", () => {
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

  it("resolves a well-shaped regime analysis for a known symbol", async () => {
    const res = await fetch(`${baseUrl}/api/trading/regime/AAPL`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as RegimeResponse;
    expect(body.symbol).toBe("AAPL");
    expect(body.dataSource).toBe("SIMULATED");
    expect(REGIME_LABELS).toContain(body.regimeLabel);
    expect(["high", "normal", "low"]).toContain(body.volatilityRegime);
    expect(["High", "Moderate", "Low"]).toContain(body.liquidityRegime);
    expect(["High", "Moderate", "Low"]).toContain(body.confidenceLevel);
  });

  it("projects only the disclosed regime-summary fields, never leaking the full nested sub-analyses", async () => {
    const res = await fetch(`${baseUrl}/api/trading/regime/AAPL`);
    const body = (await res.json()) as RegimeResponse;
    expect(body.multiTimeframe).toBeUndefined();
    expect(body.liquidity).toBeUndefined();
  });

  it("returns 404 for an invalid ticker shape, never fabricating an analysis", async () => {
    const res = await fetch(`${baseUrl}/api/trading/regime/${encodeURIComponent("NOT A TICKER!!")}`);
    expect(res.status).toBe(404);
  });

  it("is deterministic across repeated calls for the same symbol", async () => {
    const a = await (await fetch(`${baseUrl}/api/trading/regime/NVDA`)).json();
    const b = await (await fetch(`${baseUrl}/api/trading/regime/NVDA`)).json();
    expect(a).toEqual(b);
  });
});
