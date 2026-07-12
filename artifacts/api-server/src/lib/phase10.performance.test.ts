import { describe, it, expect } from "vitest";
import {
  generateTradeHistory,
  computeCore,
  computeBreakdown,
  buildEquityCurve,
  computeAnalytics,
  getBreakdown,
  ANALYTICS_STRATEGIES,
  type BreakdownDimension,
} from "./performanceAnalytics.js";

describe("performance — synthetic history", () => {
  it("is deterministic across calls", () => {
    const a = generateTradeHistory();
    const b = generateTradeHistory();
    expect(a.length).toBe(b.length);
    expect(a[0]).toEqual(b[0]);
    expect(a[a.length - 1]).toEqual(b[b.length - 1]);
  });

  it("covers all four strategies including strangle", () => {
    const trades = generateTradeHistory();
    const seen = new Set(trades.map((t) => t.strategy));
    for (const s of ANALYTICS_STRATEGIES) expect(seen.has(s)).toBe(true);
    expect(seen.has("strangle")).toBe(true);
  });

  it("is ordered ascending by close time", () => {
    const trades = generateTradeHistory();
    for (let i = 1; i < trades.length; i++) {
      expect(trades[i].closeTs).toBeGreaterThanOrEqual(trades[i - 1].closeTs);
    }
  });

  it("produces realistic premium-selling numbers (winRate > loss-rate, PF > 1)", () => {
    const core = computeCore(generateTradeHistory());
    expect(core.winRate).toBeGreaterThan(0.55);
    expect(core.winRate).toBeLessThan(0.9);
    expect(core.profitFactor).toBeGreaterThan(1);
    expect(core.avgLoss).toBeGreaterThan(core.avgWin); // losses bigger than wins (defined-risk premium)
  });
});

describe("performance — metric formulas", () => {
  it("profit factor equals gross win / gross loss", () => {
    const trades = generateTradeHistory();
    const grossWin = trades.filter((t) => t.netPnl > 0).reduce((s, t) => s + t.netPnl, 0);
    const grossLoss = Math.abs(trades.filter((t) => t.netPnl <= 0).reduce((s, t) => s + t.netPnl, 0));
    const core = computeCore(trades);
    expect(core.profitFactor).toBeCloseTo(Math.round((grossWin / grossLoss) * 100) / 100, 2);
  });

  it("expectancy equals winRate*avgWin - lossRate*avgLoss", () => {
    const core = computeCore(generateTradeHistory());
    const expected = core.winRate * core.avgWin - (1 - core.winRate) * core.avgLoss;
    expect(core.expectancy).toBeCloseTo(Math.round(expected * 100) / 100, 1);
  });

  it("return on capital equals totalReturn / capital deployed", () => {
    const core = computeCore(generateTradeHistory());
    expect(core.returnOnCapital).toBeCloseTo(core.totalReturn / core.totalCapitalDeployed, 4);
  });

  it("max drawdown is a non-negative fraction and equity ends at start + totalReturn", () => {
    const trades = generateTradeHistory();
    const { points, maxDrawdown } = buildEquityCurve(trades);
    const core = computeCore(trades);
    expect(maxDrawdown).toBeGreaterThanOrEqual(0);
    expect(maxDrawdown).toBeLessThanOrEqual(1);
    expect(points[points.length - 1].value).toBeCloseTo(100000 + core.totalReturn, 0);
    // Drawdown is never positive.
    for (const p of points) expect(p.drawdown).toBeLessThanOrEqual(0);
  });
});

describe("performance — breakdowns reconcile", () => {
  const dims: BreakdownDimension[] = ["strategy", "ticker", "duration", "delta", "ivrank"];
  for (const dim of dims) {
    it(`${dim}: bucket trade counts and pnl sum to the totals`, () => {
      const trades = generateTradeHistory();
      const core = computeCore(trades);
      const buckets = computeBreakdown(trades, dim);
      expect(buckets.length).toBeGreaterThan(0);
      const sumTrades = buckets.reduce((s, b) => s + b.totalTrades, 0);
      const sumReturn = buckets.reduce((s, b) => s + b.totalReturn, 0);
      expect(sumTrades).toBe(core.totalTrades);
      expect(sumReturn).toBeCloseTo(core.totalReturn, 0);
    });
  }

  it("ticker breakdown only references universe symbols", () => {
    const buckets = getBreakdown("ticker", "all");
    for (const b of buckets) expect(b.key).toMatch(/^[A-Z]+$/);
  });
});

describe("performance — top-level analytics", () => {
  it("exposes best/worst strategy + tickers and event-free scalar metrics", () => {
    const a = computeAnalytics("all");
    expect(a.totalTrades).toBeGreaterThan(100);
    expect(a.bestTickers.length).toBeGreaterThan(0);
    expect(a.worstTickers.length).toBeGreaterThan(0);
    expect(a.bestTickers[0].totalReturn).toBeGreaterThanOrEqual(
      a.worstTickers[0].totalReturn,
    );
    expect(a.bestStrategy).not.toBe("—");
    expect(a.sharpeRatio).toBeGreaterThan(0);
    expect(a.commissionImpactPct).toBeGreaterThanOrEqual(0);
    expect(a.actualPop).toBeCloseTo(a.winRate, 5);
  });

  it("shorter periods return a subset of trades", () => {
    const all = computeAnalytics("all");
    const recent = computeAnalytics("3m");
    expect(recent.totalTrades).toBeLessThanOrEqual(all.totalTrades);
  });
});
