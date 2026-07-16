// Phase 4, Sprint 58 — live route integration test for the Options
// Engine-Native Backtesting surface (approved Phase 4 plan, Sprint 58).
// Uses the real app + a real Postgres connection (no auth session needed —
// unauthenticated requests resolve to the legacy-owner stand-in per
// tenantScope.ts). This route is a thin pass-through to
// lib/optionsBacktest.ts's already-unit-tested buildOptionsBacktest() plus
// a real persistence write — these tests prove the HTTP wiring and
// persistence, not the walk-forward simulation math itself (covered by
// lib/optionsBacktest.test.ts's own 21 tests).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface OptionsBacktestTradeResponse {
  entryDate: string;
  expirationDate: string;
  entryCredit: number;
  exitDate: string;
  exitDebit: number;
  exitReason: string;
  pnl: number;
  maxLoss: number;
  rMultiple: number;
  daysHeld: number;
}

interface OptionsBacktestResultResponse {
  id: number;
  createdAt: string;
  symbol: string;
  strategy: string;
  underlyingDataSource: string;
  optionsDataSource: string;
  candleCount: number;
  available: boolean;
  unavailableReason: string | null;
  trades: OptionsBacktestTradeResponse[];
  totalTrades: number;
  winRate: number | null;
  avgR: number | null;
  totalReturnPct: number | null;
  maxDrawdownPct: number | null;
  sharpeRatio: number | null;
  equityCurve: { date: string; value: number; drawdownPct: number }[];
  summary: string;
}

describe("Options Engine-Native Backtesting routes (live, real Postgres, SIMULATED path)", () => {
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

  it("runs an iron_condor backtest for a known symbol and persists it, well-shaped and honestly labeled", async () => {
    const res = await fetch(`${baseUrl}/api/options-backtest/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "SPY", strategy: "iron_condor", lookback: 180 }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as OptionsBacktestResultResponse;
    expect(body.id).toBeGreaterThan(0);
    expect(typeof body.createdAt).toBe("string");
    expect(body.symbol).toBe("SPY");
    expect(body.strategy).toBe("iron_condor");
    expect(body.underlyingDataSource).toBe("SIMULATED");
    expect(body.optionsDataSource).toBe("SIMULATED");
    expect(body.candleCount).toBe(180);
    expect(body.available).toBe(true);
    expect(Array.isArray(body.trades)).toBe(true);
    expect(Array.isArray(body.equityCurve)).toBe(true);
    expect(typeof body.summary).toBe("string");
    expect(body.summary.length).toBeGreaterThan(0);

    // Every trade's own bookkeeping is internally consistent — a real
    // trade log, never fabricated statistics.
    expect(body.totalTrades).toBeGreaterThan(0);
    for (const t of body.trades) {
      expect(t.entryCredit).toBeGreaterThan(0);
      expect(t.exitDebit).toBeGreaterThanOrEqual(0);
      expect(t.maxLoss).toBeGreaterThan(0);
      expect(["profit-target", "stop-loss", "dte-trigger", "expiration", "end-of-period"]).toContain(t.exitReason);
      expect(t.pnl).toBeCloseTo(t.entryCredit - t.exitDebit, 2);
    }
    expect(body.winRate).not.toBeNull();
    expect(body.avgR).not.toBeNull();
    expect(body.equityCurve.length).toBe(body.trades.length);

    // Persisted for real — appears in the user's own results list.
    const listRes = await fetch(`${baseUrl}/api/options-backtest/results`);
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as OptionsBacktestResultResponse[];
    expect(list.some((r) => r.id === body.id)).toBe(true);
  });

  it("honestly reports unavailable, never a fabricated backtest, when too few candles are requested", async () => {
    const res = await fetch(`${baseUrl}/api/options-backtest/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "MSFT", strategy: "iron_condor", lookback: 10 }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as OptionsBacktestResultResponse;
    expect(body.available).toBe(false);
    expect(body.unavailableReason).toMatch(/at least/i);
    expect(body.totalTrades).toBe(0);
    expect(body.trades).toEqual([]);
    expect(body.winRate).toBeNull();
  });

  it("honestly reports unavailable — never a fabricated backtest, never a 404 either — for a symbol Engine 2 can resolve candles for but optionsMath.ts's own IV model doesn't cover", async () => {
    // A fake-but-valid-shaped ticker: Engine 2's SimulatedMarketDataProvider
    // synthesizes a plausible candle series for any valid-shaped symbol
    // outside its own default universe, but optionsMath.ts's own
    // getSnapshot() only resolves IV for its fixed 10-symbol UNIVERSE — the
    // disclosed scope boundary from Sprint 57's own MarketDataProvider
    // reuse evaluation, exercised here over real HTTP.
    const res = await fetch(`${baseUrl}/api/options-backtest/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "ZQXWK", strategy: "iron_condor", lookback: 180 }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as OptionsBacktestResultResponse;
    expect(body.available).toBe(false);
    expect(body.unavailableReason).toMatch(/outside optionsMath\.ts's own supported options universe/i);
  });

  it("returns 404 for an unresolvable (invalid-shaped) symbol, never fabricating a backtest", async () => {
    const res = await fetch(`${baseUrl}/api/options-backtest/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "NOT A TICKER!!", strategy: "iron_condor" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for a missing required field", async () => {
    const res = await fetch(`${baseUrl}/api/options-backtest/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid strategy enum value", async () => {
    const res = await fetch(`${baseUrl}/api/options-backtest/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL", strategy: "iron_fly" }),
    });
    expect(res.status).toBe(400);
  });

  it("defaults lookback to 180 when omitted", async () => {
    const res = await fetch(`${baseUrl}/api/options-backtest/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "GOOGL", strategy: "iron_condor" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as OptionsBacktestResultResponse;
    expect(body.candleCount).toBe(180);
  });

  it("is deterministic across repeated runs for the same symbol/strategy/lookback", async () => {
    const runOnce = async () => {
      const res = await fetch(`${baseUrl}/api/options-backtest/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: "TSLA", strategy: "iron_condor", lookback: 150 }),
      });
      const body = (await res.json()) as OptionsBacktestResultResponse;
      const { id, createdAt, ...rest } = body;
      void id;
      void createdAt;
      return rest;
    };
    const a = await runOnce();
    const b = await runOnce();
    expect(a).toEqual(b);
  });

  it("respects entry/exit parameter overrides in the request body", async () => {
    const res = await fetch(`${baseUrl}/api/options-backtest/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: "AAPL",
        strategy: "iron_condor",
        lookback: 31,
        entryDte: 7,
        dteExitTrigger: 0,
        profitTargetPct: 2.0,
        stopLossMultiple: 100,
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as OptionsBacktestResultResponse;
    expect(body.available).toBe(true);
    if (body.totalTrades > 0) {
      // With profit-target/stop-loss disabled, only expiration or
      // end-of-period can close a position.
      for (const t of body.trades) {
        expect(["expiration", "end-of-period"]).toContain(t.exitReason);
      }
    }
  });

  it("lists only well-shaped results, newest first", async () => {
    const res = await fetch(`${baseUrl}/api/options-backtest/results`);
    expect(res.status).toBe(200);
    const list = (await res.json()) as OptionsBacktestResultResponse[];
    expect(list.length).toBeGreaterThan(0);
    for (let i = 1; i < list.length; i++) {
      expect(new Date(list[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(new Date(list[i].createdAt).getTime());
    }
  });
});
