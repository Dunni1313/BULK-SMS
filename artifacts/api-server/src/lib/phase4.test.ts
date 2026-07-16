import { describe, it, expect } from "vitest";
import { selectProvider } from "./providers/index.js";
import { MockOptionsProvider } from "./providers/mockProvider.js";
import type { OptionQuote } from "./providers/types.js";
import {
  checkData,
  checkFreshness,
  checkLiquidity,
  checkContract,
  spreadPct,
  MAX_QUOTE_AGE_MS,
} from "./marketData.js";
import { analyzeEarnings } from "./earnings.js";
import { computeThetaIncome } from "./thetaIncome.js";
import { runScan } from "./liveScanner.js";

const NOW = Date.parse("2026-06-06T15:00:00.000Z");

function quote(overrides: Partial<OptionQuote> = {}): OptionQuote {
  return {
    symbol: "SPY",
    strike: 500,
    type: "put",
    expiration: "2026-07-18",
    bid: 4.9,
    ask: 5.1,
    mid: 5.0,
    delta: -0.2,
    theta: -0.05,
    vega: 0.1,
    gamma: 0.01,
    iv: 0.22,
    openInterest: 5000,
    volume: 1200,
    quoteTime: new Date(NOW - 60_000).toISOString(),
    ...overrides,
  };
}

describe("selectProvider fallback", () => {
  it("uses mock when scanner mode is mock", () => {
    const s = selectProvider({ scannerMode: "mock", marketDataProvider: "alpaca" });
    expect(s.active).toBe("mock");
    expect(s.mode).toBe("mock");
    expect(s.connected).toBe(false);
    expect(s.requested).toBe("alpaca");
  });

  it("falls back to mock in live mode when provider credentials are missing", () => {
    const s = selectProvider({ scannerMode: "live", marketDataProvider: "alpaca", alpacaApiKey: null });
    expect(s.active).toBe("mock");
    expect(s.mode).toBe("live");
    expect(s.connected).toBe(false);
    expect(s.reason).toMatch(/fall(ing)? back to mock/i);
  });

  it("falls back to mock for the polygon placeholder", () => {
    const s = selectProvider({ scannerMode: "live", marketDataProvider: "polygon" });
    expect(s.active).toBe("mock");
    expect(s.connected).toBe(false);
  });
});

describe("marketData filters", () => {
  it("accepts a well-formed fresh liquid contract", () => {
    expect(checkContract(quote(), NOW).ok).toBe(true);
  });

  it("rejects missing greeks", () => {
    const r = checkData(quote({ theta: NaN }));
    expect(r.ok).toBe(false);
    expect(r.kind).toBe("data");
  });

  it("rejects missing/zero IV", () => {
    expect(checkData(quote({ iv: 0 })).ok).toBe(false);
  });

  it("rejects stale quotes beyond the freshness window", () => {
    const stale = quote({ quoteTime: new Date(NOW - MAX_QUOTE_AGE_MS - 60_000).toISOString() });
    const r = checkFreshness(stale, NOW);
    expect(r.ok).toBe(false);
    expect(r.kind).toBe("freshness");
  });

  it("rejects low open interest", () => {
    const r = checkLiquidity(quote({ openInterest: 50 }));
    expect(r.ok).toBe(false);
    expect(r.kind).toBe("liquidity");
  });

  it("rejects low volume", () => {
    expect(checkLiquidity(quote({ volume: 1 })).ok).toBe(false);
  });

  it("rejects zero-bid options", () => {
    expect(checkLiquidity(quote({ bid: 0 })).ok).toBe(false);
  });

  it("rejects wide spreads", () => {
    const r = checkLiquidity(quote({ bid: 4.0, ask: 6.0, mid: 5.0 }));
    expect(r.ok).toBe(false);
    expect(r.kind).toBe("liquidity");
  });

  it("computes spread as a fraction of mid", () => {
    expect(spreadPct({ bid: 4.9, ask: 5.1, mid: 5.0 })).toBeCloseTo(0.04, 5);
  });

  it("rejects an Alpaca-shaped quote whose greeks were absent (NaN), not coerced to 0", () => {
    // AlpacaOptionsProvider preserves missing greeks as NaN so they fail the gate.
    const r = checkContract(quote({ theta: NaN, vega: NaN }), NOW);
    expect(r.ok).toBe(false);
    expect(r.kind).toBe("data");
  });
});

describe("earnings engine", () => {
  it("returns null when no earnings within window", () => {
    expect(
      analyzeEarnings({ symbol: "AAPL", name: "Apple", price: 200, iv: 0.5, ivRank: 80, ivBase: 0.25, earningsInDays: 30, earningsDate: "2026-07-30" }),
    ).toBeNull();
  });

  it("returns null when IV rank is not elevated", () => {
    expect(
      analyzeEarnings({ symbol: "AAPL", name: "Apple", price: 200, iv: 0.3, ivRank: 40, ivBase: 0.25, earningsInDays: 5, earningsDate: "2026-06-11" }),
    ).toBeNull();
  });

  it("recommends an iron fly for very high IV rank pricing more than history", () => {
    const play = analyzeEarnings({ symbol: "NVDA", name: "Nvidia", price: 1000, iv: 1.2, ivRank: 85, ivBase: 0.4, earningsInDays: 3, earningsDate: "2026-06-09" });
    expect(play).not.toBeNull();
    expect(play!.recommendedStrategy).toBe("iron_fly");
    expect(play!.expectedMovePct).toBeGreaterThan(0);
    expect(play!.ivCrushPotentialPct).toBeGreaterThan(0);
  });

  it("recommends an iron condor for high but not extreme IV rank", () => {
    const play = analyzeEarnings({ symbol: "MSFT", name: "Microsoft", price: 450, iv: 0.45, ivRank: 62, ivBase: 0.3, earningsInDays: 4, earningsDate: "2026-06-10" });
    expect(play).not.toBeNull();
    expect(play!.recommendedStrategy).toBe("iron_condor");
  });
});

describe("theta income", () => {
  it("aggregates and projects across horizons", () => {
    const t = computeThetaIncome([
      { symbol: "SPY", strategy: "iron_condor", theta: 10 },
      { symbol: "SPY", strategy: "calendar_spread", theta: 5 },
      { symbol: "QQQ", strategy: "iron_condor", theta: 5 },
    ]);
    expect(t.daily).toBe(20);
    expect(t.weekly).toBe(140);
    expect(t.monthly).toBe(600);
    expect(t.annualized).toBe(7300);
    expect(t.bySymbol[0]).toEqual({ key: "SPY", theta: 15 });
    expect(t.byStrategy.find((b) => b.key === "iron_condor")!.theta).toBe(15);
  });

  it("handles an empty portfolio", () => {
    const t = computeThetaIncome([]);
    expect(t.daily).toBe(0);
    expect(t.bySymbol).toHaveLength(0);
  });
});

describe("runScan via mock provider", () => {
  it("produces positive-EV quotes and meaningful health counters", async () => {
    const { quotes, health } = await runScan(
      { scannerMode: "mock", marketDataProvider: "mock", shortDelta: 0.2, defaultDte: 45 },
      ["SPY", "QQQ", "NVDA"],
    );
    expect(health.provider).toBe("mock");
    expect(health.symbolsScanned).toBe(3);
    expect(health.contractsScanned).toBeGreaterThan(0);
    expect(health.positiveEvFound).toBe(quotes.length);
    for (const q of quotes) {
      expect(q.rejected).toBe(false);
      expect(q.ev).toBeGreaterThan(0);
    }
  });

  it("is deterministic across runs", async () => {
    const a = await runScan({ scannerMode: "mock", marketDataProvider: "mock" }, ["SPY"], NOW);
    const b = await runScan({ scannerMode: "mock", marketDataProvider: "mock" }, ["SPY"], NOW);
    expect(a.quotes.length).toBe(b.quotes.length);
  });

  it("exposes the mock provider as available", () => {
    expect(new MockOptionsProvider().isAvailable()).toBe(true);
  });
});
