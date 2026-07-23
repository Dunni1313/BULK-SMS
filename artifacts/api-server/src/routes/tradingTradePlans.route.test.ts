// Phase 25 — Institutional Trade Workspace. Live route integration test for
// the Trade Plans CRUD surface. Uses the real app + a real Postgres
// connection (no auth session needed — unauthenticated requests resolve to
// the legacy-owner stand-in per tenantScope.ts). Mirrors
// routes/tradingPositions.route.test.ts's own Sprint 44 pattern.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface TradePlanResponse {
  id: number;
  symbol: string;
  direction: string;
  status: string;
  thesis: string;
  risk: {
    accountRiskPct: number;
    entryPrice: number;
    stopPrice: number;
    targetPrice: number;
    positionSize: number | null;
    riskRewardRatio: number | null;
  };
  createdAt: string;
  updatedAt: string;
}

describe("Trading Trade Plans routes (live, real Postgres, SIMULATED path)", () => {
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

  it("supports the full create/list/list-by-symbol/update/delete flow, deriving positionSize and riskRewardRatio", async () => {
    const createRes = await fetch(`${baseUrl}/api/trading/trade-plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: "aapl",
        direction: "long",
        thesis: "Breakout above prior resistance with rising volume.",
        accountRiskPct: 1,
        entryPrice: 100,
        stopPrice: 95,
        targetPrice: 115,
        accountValue: 50000,
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as TradePlanResponse;
    expect(created.symbol).toBe("AAPL");
    expect(created.direction).toBe("long");
    expect(created.status).toBe("draft");
    // stopDistance=5, riskDollars=500 (1% of 50000) -> positionSize=100
    expect(created.risk.positionSize).toBe(100);
    // rewardDistance=15, stopDistance=5 -> 3.00
    expect(created.risk.riskRewardRatio).toBe(3);

    const listRes = await fetch(`${baseUrl}/api/trading/trade-plans`);
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as TradePlanResponse[];
    expect(list.some((p) => p.id === created.id)).toBe(true);

    const bySymbolRes = await fetch(`${baseUrl}/api/trading/trade-plans/AAPL`);
    expect(bySymbolRes.status).toBe(200);
    const bySymbol = (await bySymbolRes.json()) as TradePlanResponse[];
    expect(bySymbol.some((p) => p.id === created.id)).toBe(true);

    const updateRes = await fetch(`${baseUrl}/api/trading/trade-plans/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as TradePlanResponse;
    expect(updated.status).toBe("active");

    const deleteRes = await fetch(`${baseUrl}/api/trading/trade-plans/${created.id}`, { method: "DELETE" });
    expect(deleteRes.status).toBe(204);

    const afterDelete = await fetch(`${baseUrl}/api/trading/trade-plans/AAPL`);
    const afterDeleteList = (await afterDelete.json()) as TradePlanResponse[];
    expect(afterDeleteList.some((p) => p.id === created.id)).toBe(false);
  });

  it("honestly reports null positionSize/riskRewardRatio when accountValue is omitted or stop distance is zero", async () => {
    const noAccountValueRes = await fetch(`${baseUrl}/api/trading/trade-plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: "MSFT",
        direction: "short",
        thesis: "Failed retest of breakdown level.",
        accountRiskPct: 1,
        entryPrice: 300,
        stopPrice: 310,
        targetPrice: 270,
      }),
    });
    expect(noAccountValueRes.status).toBe(201);
    const noAccountValue = (await noAccountValueRes.json()) as TradePlanResponse;
    expect(noAccountValue.risk.positionSize).toBeNull();
    expect(noAccountValue.risk.riskRewardRatio).toBe(3);

    const zeroStopDistanceRes = await fetch(`${baseUrl}/api/trading/trade-plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: "MSFT",
        direction: "long",
        thesis: "Same entry and stop, an honestly-degenerate plan.",
        accountRiskPct: 1,
        entryPrice: 300,
        stopPrice: 300,
        targetPrice: 310,
        accountValue: 50000,
      }),
    });
    expect(zeroStopDistanceRes.status).toBe(201);
    const zeroStopDistance = (await zeroStopDistanceRes.json()) as TradePlanResponse;
    expect(zeroStopDistance.risk.positionSize).toBeNull();
    expect(zeroStopDistance.risk.riskRewardRatio).toBeNull();

    await fetch(`${baseUrl}/api/trading/trade-plans/${noAccountValue.id}`, { method: "DELETE" });
    await fetch(`${baseUrl}/api/trading/trade-plans/${zeroStopDistance.id}`, { method: "DELETE" });
  });

  it("validates status transitions, rejecting an invalid one with 400", async () => {
    const createRes = await fetch(`${baseUrl}/api/trading/trade-plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: "TSLA",
        direction: "long",
        thesis: "Testing status transitions.",
        accountRiskPct: 1,
        entryPrice: 200,
        stopPrice: 190,
        targetPrice: 230,
      }),
    });
    const created = (await createRes.json()) as TradePlanResponse;
    expect(created.status).toBe("draft");

    // draft -> closed is not an allowed transition (must go through active first)
    const invalidRes = await fetch(`${baseUrl}/api/trading/trade-plans/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed" }),
    });
    expect(invalidRes.status).toBe(400);

    // draft -> active is allowed
    const validRes = await fetch(`${baseUrl}/api/trading/trade-plans/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    expect(validRes.status).toBe(200);

    await fetch(`${baseUrl}/api/trading/trade-plans/${created.id}`, { method: "DELETE" });
  });

  it("returns 400 for a missing required field", async () => {
    const res = await fetch(`${baseUrl}/api/trading/trade-plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL", direction: "long" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid direction enum value", async () => {
    const res = await fetch(`${baseUrl}/api/trading/trade-plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: "AAPL",
        direction: "sideways",
        thesis: "x",
        accountRiskPct: 1,
        entryPrice: 100,
        stopPrice: 95,
        targetPrice: 110,
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for PATCH/DELETE on a nonexistent id", async () => {
    const patchRes = await fetch(`${baseUrl}/api/trading/trade-plans/999999999`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thesis: "x" }),
    });
    expect(patchRes.status).toBe(404);

    const deleteRes = await fetch(`${baseUrl}/api/trading/trade-plans/999999999`, { method: "DELETE" });
    expect(deleteRes.status).toBe(404);
  });

  it("returns 400 for a non-numeric id", async () => {
    const res = await fetch(`${baseUrl}/api/trading/trade-plans/not-a-number`, { method: "DELETE" });
    expect(res.status).toBe(400);
  });
});
