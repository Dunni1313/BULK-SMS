// Portfolio Stress Test & Scenario Simulator sprint — live route
// integration test for POST /execution/stress-test. Uses the real app +
// a real Postgres connection (no auth session needed — unauthenticated
// requests resolve to the legacy-owner stand-in per tenantScope.ts). This
// route is a thin pass-through to lib/portfolioStressTest.ts's already-
// unit-tested buildPortfolioStressTest() (23 tests) — these tests prove
// the HTTP wiring and the honest-degradation contract, not the
// composition math itself.
//
// Deliberately does not assert on exact portfolio-total figures here
// (unlike lib/portfolioStressTest.test.ts's own isolated-user coverage)
// — the legacy-owner's trades table is genuinely shared across many
// sibling route test files, matching the same disclosed discipline
// routes/positionSizing.route.test.ts and routes/tradeAdjustmentPreview.
// route.test.ts already established for exactly this situation.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface ScenarioEvaluationResponse {
  portfolioValue: number;
  totalUnrealizedPnl: number;
  greeks: { delta: number; gamma: number; theta: number; vega: number };
  exposureBySymbol: { symbol: string; markValue: number; pctOfAccount: number }[];
  exposureByStrategy: { strategy: string; markValue: number; pctOfAccount: number }[];
  buyingPower: number;
  positions: unknown[];
}

interface PortfolioStressTestResultResponse {
  available: boolean;
  inputIssues: { index: number | null; field: string; code: string; message: string }[];
  accountValue: number;
  credentialsConfigured: boolean;
  brokerConnected: boolean | null;
  sectorExposure: { available: boolean; reason: string };
  base: ScenarioEvaluationResponse;
  riskScoreBefore: number;
  scenarios: {
    label: string;
    shock: { priceShockPct: number; ivShockPct: number; timeDecayDays: number };
    after: ScenarioEvaluationResponse;
    portfolioValueImpact: number;
    unrealizedPnlImpact: number;
    buyingPowerImpactDollars: number;
    riskScoreAfter: number;
    positionsBreachingThreshold: unknown[];
    concentrationChanges: unknown[];
    drawdownPct: number;
  }[];
  generatedAt: string;
}

describe("Portfolio Stress Test routes (live, real Postgres, SIMULATED path)", () => {
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

  async function run(body: Record<string, unknown>): Promise<PortfolioStressTestResultResponse> {
    const res = await fetch(`${baseUrl}/api/execution/stress-test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(200);
    return (await res.json()) as PortfolioStressTestResultResponse;
  }

  it("generates a well-shaped result for a default (empty-body) request, using the default scenario presets", async () => {
    const body = await run({});
    expect(body.available).toBe(true);
    expect(body.scenarios.length).toBe(4);
    expect(body.scenarios.map((s) => s.label)).toEqual([
      "Bullish (+5%)",
      "Bearish (-5%)",
      "High Volatility (+20% IV)",
      "Low Volatility (-20% IV)",
    ]);
    expect(body.base).toBeDefined();
    expect(typeof body.riskScoreBefore).toBe("number");
    expect(body.sectorExposure).toEqual({
      available: false,
      reason: expect.stringMatching(/sector/i),
    });
    expect(typeof body.generatedAt).toBe("string");
  });

  it("generates a well-shaped result for custom, combined-shock scenarios", async () => {
    const body = await run({
      scenarios: [
        { label: "Custom Combo", priceShockPct: 5, ivShockPct: 15, timeDecayDays: 7 },
        { label: "Custom Crash", priceShockPct: -10, ivShockPct: 20, timeDecayDays: 0 },
      ],
    });
    expect(body.scenarios.length).toBe(2);
    expect(body.scenarios[0].label).toBe("Custom Combo");
    expect(body.scenarios[0].shock).toEqual({ priceShockPct: 5, ivShockPct: 15, timeDecayDays: 7 });
    for (const s of body.scenarios) {
      expect(typeof s.riskScoreAfter).toBe("number");
      expect(Array.isArray(s.positionsBreachingThreshold)).toBe(true);
      expect(Array.isArray(s.concentrationChanges)).toBe(true);
      expect(typeof s.drawdownPct).toBe("number");
    }
  });

  it("reports the same honest fields regardless of whether the portfolio has open positions", async () => {
    const body = await run({ scenarios: [{ priceShockPct: 2 }] });
    expect(typeof body.accountValue).toBe("number");
    expect(body.base.portfolioValue).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(body.base.exposureBySymbol)).toBe(true);
    expect(Array.isArray(body.base.exposureByStrategy)).toBe(true);
  });

  it("never carries a broker-write/order-creation surface — no such fields exist on this response shape", async () => {
    const body = await run({});
    expect(body).not.toHaveProperty("orderId");
    expect(body).not.toHaveProperty("tradeId");
    expect(body).not.toHaveProperty("journalId");
  });

  it("honestly reports credentialsConfigured/brokerConnected without ever fabricating a live connection", async () => {
    const body = await run({});
    expect(typeof body.credentialsConfigured).toBe("boolean");
    expect(body.brokerConnected === null || typeof body.brokerConnected === "boolean").toBe(true);
  });

  it("400s on a genuinely malformed request body (wrong type for a shock field)", async () => {
    const res = await fetch(`${baseUrl}/api/execution/stress-test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarios: [{ priceShockPct: "not-a-number" }] }),
    });
    expect(res.status).toBe(400);
  });

  it("is deterministic for the same input (never mutates state that would change the answer)", async () => {
    const a = await run({ scenarios: [{ priceShockPct: 5, ivShockPct: 10, timeDecayDays: 7 }] });
    const b = await run({ scenarios: [{ priceShockPct: 5, ivShockPct: 10, timeDecayDays: 7 }] });
    expect(a.scenarios[0].after.totalUnrealizedPnl).toBe(b.scenarios[0].after.totalUnrealizedPnl);
    expect(a.riskScoreBefore).toBe(b.riskScoreBefore);
  });
});
