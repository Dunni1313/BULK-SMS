// Phase 3, Sprint 44 — live route integration test for the Risk
// Management surface, the fifth bounded slice of the Route+UI backlog
// reduction. Uses the real app + a real Postgres connection (no auth
// session needed — unauthenticated requests resolve to the legacy-owner
// stand-in per tenantScope.ts). This route is a thin pass-through to
// Sprint 38's already-unit-tested buildTradingRiskAnalysis() — these tests
// prove the HTTP wiring (positions + settings.tradingAccountValue +
// provider all correctly flow into the analysis), not the risk-scoring
// math itself (already covered by lib/tradingRisk.test.ts's 27 tests).
//
// Deliberately per-position assertions rather than aggregate/overall
// assertions: GET /trading/risk reads over the legacy-owner's entire
// trading_positions table, a resource genuinely shared across this file's
// sibling route test files (routes/tradingPositions.route.test.ts also
// exercises the same account) — asserting only on the specific rows this
// file itself creates (found by id in the response arrays) keeps these
// tests correct regardless of what else exists in the table when the
// suite runs under normal file parallelism.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface PositionResponse {
  id: number;
}

interface PerPositionBudget {
  id: number;
  symbol: string;
  riskDollars: number | null;
  riskPct: number | null;
  withinLimit: boolean | null;
}

interface PositionProbabilityContext {
  positionId: number;
  symbol: string;
  daysAhead: number;
  regimeLabel: string | null;
  stopTouchProbability: number | null;
  targetTouchProbability: number | null;
}

interface RiskResponse {
  accountValue: number | null;
  openPositionsCount: number;
  portfolioBudget: { perPosition: PerPositionBudget[] };
  positionContexts: PositionProbabilityContext[];
}

describe("Risk Management routes (live, real Postgres, SIMULATED path)", () => {
  let server: Server;
  let baseUrl: string;
  const createdIds: number[] = [];

  beforeAll(async () => {
    const { default: app } = await import("../app.js");
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    for (const id of createdIds) {
      await fetch(`${baseUrl}/api/trading/positions/${id}`, { method: "DELETE" });
    }
    server.close();
  });

  it("wires an open, stop/target-defined position's own per-position risk math and probability context into GET /trading/risk", async () => {
    const settingsRes = await fetch(`${baseUrl}/api/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tradingAccountValue: 100000 }),
    });
    expect(settingsRes.status).toBe(200);

    const createRes = await fetch(`${baseUrl}/api/trading/positions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL", side: "long", quantity: 10, entryPrice: 190, stopPrice: 180, targetPrice: 210 }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as PositionResponse;
    createdIds.push(created.id);

    const riskRes = await fetch(`${baseUrl}/api/trading/risk`);
    expect(riskRes.status).toBe(200);
    const risk = (await riskRes.json()) as RiskResponse;

    expect(risk.accountValue).toBe(100000);

    const perPosition = risk.portfolioBudget.perPosition.find((p) => p.id === created.id);
    expect(perPosition).toBeDefined();
    expect(perPosition?.symbol).toBe("AAPL");
    expect(perPosition?.riskDollars).toBe(100); // |190-180| * 10
    expect(perPosition?.riskPct).toBe(0.1); // 100 / 100000 * 100
    expect(perPosition?.withinLimit).toBe(true); // 0.1% is well within the 2% cap

    const context = risk.positionContexts.find((c) => c.positionId === created.id);
    expect(context).toBeDefined();
    expect(context?.symbol).toBe("AAPL");
    expect(context?.daysAhead).toBe(20); // DEFAULT_RISK_PROBABILITY_HORIZON_DAYS
    expect(["trending-bullish", "trending-bearish", "range-bound", "volatile-choppy", "quiet-consolidation"]).toContain(
      context?.regimeLabel,
    );
    expect(context?.stopTouchProbability).not.toBeNull();
    expect(context?.targetTouchProbability).not.toBeNull();
    expect(context!.stopTouchProbability!).toBeGreaterThanOrEqual(0);
    expect(context!.stopTouchProbability!).toBeLessThanOrEqual(1);
  });

  it("honestly reports a null probability context for a position with an invalid-shaped symbol, never fabricating one", async () => {
    const createRes = await fetch(`${baseUrl}/api/trading/positions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "NOT A TICKER!!", side: "long", quantity: 5, entryPrice: 50, stopPrice: 45 }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as PositionResponse;
    createdIds.push(created.id);

    const riskRes = await fetch(`${baseUrl}/api/trading/risk`);
    expect(riskRes.status).toBe(200);
    const risk = (await riskRes.json()) as RiskResponse;

    const context = risk.positionContexts.find((c) => c.positionId === created.id);
    expect(context).toBeDefined();
    expect(context?.regimeLabel).toBeNull();
    expect(context?.stopTouchProbability).toBeNull();
    expect(context?.targetTouchProbability).toBeNull();
  });

  it("counts a created open position in openPositionsCount", async () => {
    const createRes = await fetch(`${baseUrl}/api/trading/positions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "MSFT", side: "long", quantity: 3, entryPrice: 400 }),
    });
    const created = (await createRes.json()) as PositionResponse;
    createdIds.push(created.id);

    const riskRes = await fetch(`${baseUrl}/api/trading/risk`);
    const risk = (await riskRes.json()) as RiskResponse;
    expect(risk.openPositionsCount).toBeGreaterThanOrEqual(1);
  });
});
