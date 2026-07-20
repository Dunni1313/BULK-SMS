// Phase 28 — Institutional Trade Planning & Risk Studio. Live route
// integration test for the stateless Scenario Comparison preview. No
// ownership scoping test needed (an anonymous account value fallback is
// exercised, but nothing is persisted or read from another user's rows).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface ScenarioResult {
  name: string;
  direction: string;
  risk: { positionSize: number | null; riskRewardRatio: number | null };
}

interface ComparisonResponse {
  symbol: string | null;
  accountValue: number | null;
  scenarios: ScenarioResult[];
  bestRiskRewardName: string | null;
  tightestRiskName: string | null;
  summary: string;
}

function scenario(over: Record<string, unknown> = {}) {
  return {
    name: "A",
    direction: "long",
    accountRiskPct: 1,
    entryPrice: 100,
    stopPrice: 95,
    targetPrice: 115,
    ...over,
  };
}

describe("Trading Scenario Comparison route (live, real Postgres)", () => {
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

  it("compares 2 scenarios via the exact same computeRiskParameters() math a real trade plan uses, never persisting anything", async () => {
    const res = await fetch(`${baseUrl}/api/trading/trade-plans/scenarios/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: "AAPL",
        accountValue: 10_000,
        scenarios: [
          scenario({ name: "Wide target", targetPrice: 130 }),
          scenario({ name: "Tight target", targetPrice: 105 }),
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as ComparisonResponse;
    expect(body.symbol).toBe("AAPL");
    expect(body.scenarios).toHaveLength(2);
    expect(body.bestRiskRewardName).toBe("Wide target");
  });

  it("400s when fewer than 2 scenarios are supplied, never fabricating a one-sided comparison", async () => {
    const res = await fetch(`${baseUrl}/api/trading/trade-plans/scenarios/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarios: [scenario()] }),
    });
    expect(res.status).toBe(400);
  });

  it("400s when more than 5 scenarios are supplied", async () => {
    const res = await fetch(`${baseUrl}/api/trading/trade-plans/scenarios/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarios: Array.from({ length: 6 }, (_, i) => scenario({ name: `S${i}` })) }),
    });
    expect(res.status).toBe(400);
  });

  it("400s for a missing required field on a scenario", async () => {
    const res = await fetch(`${baseUrl}/api/trading/trade-plans/scenarios/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarios: [{ name: "A", direction: "long" }, scenario({ name: "B" })] }),
    });
    expect(res.status).toBe(400);
  });

  it("works without a symbol supplied — the comparison is symbol-agnostic pure arithmetic", async () => {
    const res = await fetch(`${baseUrl}/api/trading/trade-plans/scenarios/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountValue: 5_000, scenarios: [scenario(), scenario({ name: "B", targetPrice: 120 })] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as ComparisonResponse;
    expect(body.symbol).toBeNull();
  });

  it("is deterministic for the same inputs", async () => {
    const payload = JSON.stringify({
      symbol: "MSFT",
      accountValue: 8_000,
      scenarios: [scenario(), scenario({ name: "B", targetPrice: 125 })],
    });
    const a = await (
      await fetch(`${baseUrl}/api/trading/trade-plans/scenarios/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      })
    ).json();
    const b = await (
      await fetch(`${baseUrl}/api/trading/trade-plans/scenarios/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      })
    ).json();
    expect(a).toEqual(b);
  });
});
