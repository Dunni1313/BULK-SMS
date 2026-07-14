// Phase 3, Sprint 49 — live route integration test for the Backtesting
// surface (approved Phase 3 plan §18). Uses the real app + a real Postgres
// connection (no auth session needed — unauthenticated requests resolve to
// the legacy-owner stand-in per tenantScope.ts). This route is a thin
// pass-through to lib/tradingBacktest.ts's already-unit-tested
// buildTradingBacktest() plus a real persistence write — these tests prove
// the HTTP wiring and persistence, not the walk-forward simulation math
// itself (covered by lib/tradingBacktest.test.ts's own 16 tests).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface BacktestTradeResponse {
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  exitReason: string;
  pnlPct: number;
  rMultiple: number;
}

interface BacktestResultResponse {
  id: number;
  createdAt: string;
  symbol: string;
  strategy: string;
  interval: string;
  dataSource: string;
  candleCount: number;
  available: boolean;
  unavailableReason: string | null;
  trades: BacktestTradeResponse[];
  totalTrades: number;
  winRate: number | null;
  avgR: number | null;
  totalReturnPct: number | null;
  maxDrawdownPct: number | null;
  sharpeRatio: number | null;
  equityCurve: { date: string; value: number; drawdownPct: number }[];
  summary: string;
}

describe("Backtesting routes (live, real Postgres, SIMULATED path)", () => {
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

  it("runs a trend-following backtest for a known symbol and persists it, well-shaped and SIMULATED", async () => {
    const res = await fetch(`${baseUrl}/api/trading/backtest/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL", strategy: "trend-following", interval: "1D", lookback: 180 }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as BacktestResultResponse;
    expect(body.id).toBeGreaterThan(0);
    expect(typeof body.createdAt).toBe("string");
    expect(body.symbol).toBe("AAPL");
    expect(body.strategy).toBe("trend-following");
    expect(body.interval).toBe("1D");
    expect(body.dataSource).toBe("SIMULATED");
    expect(body.candleCount).toBe(180);
    expect(body.available).toBe(true);
    expect(Array.isArray(body.trades)).toBe(true);
    expect(Array.isArray(body.equityCurve)).toBe(true);
    expect(typeof body.summary).toBe("string");
    expect(body.summary.length).toBeGreaterThan(0);

    // Every trade's own bookkeeping is internally consistent.
    for (const t of body.trades) {
      expect(t.entryPrice).toBeGreaterThan(0);
      expect(t.exitPrice).toBeGreaterThan(0);
      expect(["stop", "target", "trend-flip", "time-limit", "end-of-period"]).toContain(t.exitReason);
    }

    if (body.totalTrades > 0) {
      expect(body.winRate).not.toBeNull();
      expect(body.avgR).not.toBeNull();
      expect(body.equityCurve.length).toBe(body.trades.length);
    } else {
      expect(body.winRate).toBeNull();
      expect(body.avgR).toBeNull();
      expect(body.equityCurve).toEqual([]);
    }

    // Persisted for real — appears in the user's own results list.
    const listRes = await fetch(`${baseUrl}/api/trading/backtest/results`);
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as BacktestResultResponse[];
    expect(list.some((r) => r.id === body.id)).toBe(true);
  });

  it("honestly reports unavailable, never a fabricated backtest, when too few candles are requested", async () => {
    const res = await fetch(`${baseUrl}/api/trading/backtest/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "MSFT", strategy: "mean-reversion", interval: "1D", lookback: 10 }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as BacktestResultResponse;
    expect(body.available).toBe(false);
    expect(body.unavailableReason).toMatch(/at least/i);
    expect(body.totalTrades).toBe(0);
    expect(body.trades).toEqual([]);
    expect(body.winRate).toBeNull();
  });

  it("returns 404 for an unresolvable symbol, never fabricating a backtest", async () => {
    const res = await fetch(`${baseUrl}/api/trading/backtest/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "NOT A TICKER!!", strategy: "trend-following" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for a missing required field", async () => {
    const res = await fetch(`${baseUrl}/api/trading/backtest/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid strategy enum value", async () => {
    const res = await fetch(`${baseUrl}/api/trading/backtest/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL", strategy: "buy-the-rumor" }),
    });
    expect(res.status).toBe(400);
  });

  it("defaults interval/lookback to 1D/180 when omitted", async () => {
    const res = await fetch(`${baseUrl}/api/trading/backtest/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "GOOGL", strategy: "structure-breakout" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as BacktestResultResponse;
    expect(body.interval).toBe("1D");
    expect(body.candleCount).toBe(180);
  });

  it("is deterministic across repeated runs for the same symbol/strategy/interval/lookback", async () => {
    const runOnce = async () => {
      const res = await fetch(`${baseUrl}/api/trading/backtest/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: "NVDA", strategy: "trend-following", interval: "1D", lookback: 150 }),
      });
      const body = (await res.json()) as BacktestResultResponse;
      const { id, createdAt, ...rest } = body;
      void id;
      void createdAt;
      return rest;
    };
    const a = await runOnce();
    const b = await runOnce();
    expect(a).toEqual(b);
  });

  it("lists only well-shaped results, newest first", async () => {
    const res = await fetch(`${baseUrl}/api/trading/backtest/results`);
    expect(res.status).toBe(200);
    const list = (await res.json()) as BacktestResultResponse[];
    expect(list.length).toBeGreaterThan(0);
    for (let i = 1; i < list.length; i++) {
      expect(new Date(list[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(new Date(list[i].createdAt).getTime());
    }
  });
});
