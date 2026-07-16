// Position Sizing & Portfolio Impact Calculator sprint — live route
// integration test for POST /execution/position-sizing. Uses the real app
// + a real Postgres connection (no auth session needed — unauthenticated
// requests resolve to the legacy-owner stand-in per tenantScope.ts). This
// route is a thin pass-through to lib/positionSizing.ts's already-unit-
// tested buildPositionSizingAnalysis() (22 tests) — these tests prove the
// HTTP wiring and the honest-degradation contract, not the composition
// math itself.
//
// Deliberately does not assert on position-conflict/exact-portfolio-total
// figures here (unlike lib/positionSizing.test.ts's own isolated-user
// coverage) — the legacy-owner's trades table is genuinely shared across
// many sibling route test files, matching the same disclosed discipline
// routes/tradingRisk.route.test.ts and routes/orderPreview.route.test.ts
// already established for exactly this situation.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface PortfolioSnapshotResponse {
  openPositionsCount: number;
  totalRiskDollars: number;
  exposureBySymbol: { symbol: string; riskDollars: number; pctOfAccount: number }[];
  longExposureDollars: number;
  shortExposureDollars: number;
  greeks: { delta: number; gamma: number; theta: number; vega: number };
}

interface PositionSizingResultResponse {
  preview: { available: boolean; ticket: { symbol: string; quantity: number } | null };
  positionSizing: {
    capitalAtRisk: number | null;
    breakEvens: { label: string; price: number }[];
    recommendedQuantity: number | null;
  } | null;
  portfolioImpact: {
    current: PortfolioSnapshotResponse;
    hypothetical: PortfolioSnapshotResponse | null;
    sectorExposure: { available: boolean; reason: string };
    deltaImpact: number | null;
  };
  riskWarnings: { code: string; label: string; status: "ok" | "warning" | "blocked"; detail: string }[];
  scenarios: { label: string; quantity: number; available: boolean }[];
  generatedAt: string;
}

describe("Position Sizing & Portfolio Impact routes (live, real Postgres, SIMULATED path)", () => {
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

  async function analyze(body: Record<string, unknown>): Promise<PositionSizingResultResponse> {
    const res = await fetch(`${baseUrl}/api/execution/position-sizing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(200);
    return (await res.json()) as PositionSizingResultResponse;
  }

  it("generates a well-shaped, successful analysis for a valid, known symbol", async () => {
    const body = await analyze({ symbol: "SPY", strategy: "iron_condor", quantity: 1 });
    expect(body.preview.available).toBe(true);
    expect(body.positionSizing).not.toBeNull();
    expect(typeof body.positionSizing!.capitalAtRisk).toBe("number");
    expect(Array.isArray(body.positionSizing!.breakEvens)).toBe(true);
    expect(body.portfolioImpact.current).toBeDefined();
    expect(body.portfolioImpact.hypothetical).not.toBeNull();
    expect(body.portfolioImpact.sectorExposure).toEqual({
      available: false,
      reason: expect.stringMatching(/sector/i),
    });
    expect(Array.isArray(body.riskWarnings)).toBe(true);
    expect(body.riskWarnings.length).toBeGreaterThan(0);
    expect(Array.isArray(body.scenarios)).toBe(true);
    expect(body.scenarios.length).toBe(3);
    expect(typeof body.generatedAt).toBe("string");
  });

  it("honestly reports an unavailable preview and an empty scenario list for an invalid symbol, without crashing on the portfolio-impact section", async () => {
    const body = await analyze({ symbol: "NOTASYMBOL!!", strategy: "iron_condor", quantity: 1 });
    expect(body.preview.available).toBe(false);
    expect(body.positionSizing).toBeNull();
    expect(body.portfolioImpact.hypothetical).toBeNull();
    expect(body.scenarios).toEqual([]);
    // Current portfolio state is still honestly computed even when the
    // previewed order itself is invalid.
    expect(body.portfolioImpact.current).toBeDefined();
    expect(typeof body.portfolioImpact.current.openPositionsCount).toBe("number");
  });

  it("includes every requested risk-warning category", async () => {
    const body = await analyze({ symbol: "QQQ", strategy: "iron_condor", quantity: 1 });
    const codes = body.riskWarnings.map((w) => w.code).sort();
    expect(codes).toEqual(
      [
        "buying_power_exhaustion",
        "excess_concentration",
        "excess_leverage",
        "existing_order",
        "missing_broker_data",
        "missing_credentials",
        "oversized_position",
        "position_conflict",
      ].sort(),
    );
  });

  it("respects a supplied customQuantity by adding a 4th 'Custom' scenario", async () => {
    const body = await analyze({ symbol: "MSFT", strategy: "iron_condor", quantity: 2, customQuantity: 5 });
    expect(body.scenarios.length).toBe(4);
    const custom = body.scenarios.find((s) => s.label === "Custom")!;
    expect(custom).toBeDefined();
    expect(custom.quantity).toBe(5);
  });

  it("is deterministic for the same input (never mutates state that would change the answer)", async () => {
    const a = await analyze({ symbol: "IWM", strategy: "iron_condor", quantity: 1 });
    const b = await analyze({ symbol: "IWM", strategy: "iron_condor", quantity: 1 });
    expect(a.positionSizing!.capitalAtRisk).toBe(b.positionSizing!.capitalAtRisk);
    expect(a.positionSizing!.breakEvens).toEqual(b.positionSizing!.breakEvens);
  });

  it("400s on a genuinely malformed request body (wrong type for quantity)", async () => {
    const res = await fetch(`${baseUrl}/api/execution/position-sizing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL", strategy: "iron_condor", quantity: "not-a-number" }),
    });
    expect(res.status).toBe(400);
  });

  it("never carries a broker-write/order-creation surface — no such fields exist on this response shape", async () => {
    const body = await analyze({ symbol: "AAPL", strategy: "iron_condor", quantity: 1 });
    expect(body).not.toHaveProperty("orderId");
    expect(body).not.toHaveProperty("tradeId");
    expect(body).not.toHaveProperty("journalId");
  });
});
