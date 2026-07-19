// Phase 13 — Institutional Portfolio Manager. Unit tests for
// buildPortfolioIntelligence() and compareWatchlistToPortfolio(), covering
// concentrated/diversified/dividend/growth/value/cash-heavy portfolios,
// incomplete provider data, and full provider unavailability — the exact
// scenario list named in the approved Phase 13 spec's TESTING section.

import { describe, it, expect } from "vitest";
import { buildPortfolioIntelligence, compareWatchlistToPortfolio } from "./portfolioIntelligence.js";
import { SimulatedFundamentalsProvider } from "./fundamentals.js";
import type { Fundamentals, FundamentalsProvider, FetchOpts, DataSource } from "./fundamentals.js";
import type { PortfolioHoldingInput } from "./portfolioConstruction.js";

function makeFixture(symbol: string, overrides: Partial<Fundamentals> = {}): Fundamentals {
  return {
    symbol,
    name: `${symbol} Inc`,
    kind: "stock",
    dataSource: "SIMULATED",
    asOf: "2026-01-15",
    fetchedAt: "2026-01-15T00:00:00.000Z",
    price: 100,
    sector: "Technology",
    industry: "Software",
    beta: 1.1,
    marketCap: 50e9,
    insiderOwnershipPct: null,
    sharesOutstandingChange5y: null,
    netInsiderActivity: null,
    epsTtm: 8,
    epsFwd: 9,
    fcfPerShare: 10,
    salesPerShare: 60,
    bookPerShare: 40,
    dividendPerShare: 1,
    pe: 12.5,
    forwardPe: 11.1,
    peg: 1.0,
    ps: 1.67,
    pb: 2.5,
    fcfYield: 0.1,
    earningsYield: 0.08,
    dividendYield: 0.01,
    revenueGrowth5y: 0.1,
    epsGrowth5y: 0.12,
    revenueGrowthFwd: 0.09,
    grossMargin: 0.5,
    operatingMargin: 0.25,
    netMargin: 0.18,
    roe: 0.22,
    roic: 0.18,
    debtToEquity: 0.4,
    interestCoverage: 20,
    currentRatio: 1.5,
    netCashPerShare: 5,
    fcfPositiveYears: 9,
    fcfMargin: 0.17,
    qualitative: {
      pricingPower: 60,
      brand: 55,
      customerLoyalty: 55,
      recurringRevenue: 50,
      scale: 60,
      switchingCost: 50,
      networkEffect: 40,
      ipStrength: 50,
      distribution: 55,
      regulatoryAdvantage: 30,
    },
    revenueHistory: [40, 44, 48, 52, 56, 60],
    epsHistory: [5, 5.6, 6.3, 7, 7.5, 8],
    fcfHistory: [6, 6.8, 7.5, 8.3, 9.1, 10],
    ...overrides,
  };
}

class FakeProvider implements FundamentalsProvider {
  readonly id = "fake";
  readonly dataSource: DataSource = "SIMULATED";
  readonly isLive = false;
  constructor(private readonly data: Map<string, Fundamentals | null>) {}
  async getFundamentals(symbol: string, _asOf?: string, _opts?: FetchOpts): Promise<Fundamentals | null> {
    if (!this.data.has(symbol.toUpperCase())) return null;
    return this.data.get(symbol.toUpperCase()) ?? null;
  }
  async getFinancialStatements(): Promise<null> {
    return null;
  }
  async getEarningsHistory(): Promise<null> {
    return null;
  }
}

function h(overrides: Partial<PortfolioHoldingInput> = {}): PortfolioHoldingInput {
  return {
    id: 1,
    symbol: "AAA",
    targetWeightPct: 100,
    shares: 10,
    notes: "",
    ...overrides,
  };
}

describe("buildPortfolioIntelligence — empty portfolio", () => {
  it("returns honest insufficient-data scores and a plain-empty summary", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const result = await buildPortfolioIntelligence([], provider);
    expect(result.qualityScore.score).toBeNull();
    expect(result.capitalAllocationScore.score).toBeNull();
    expect(result.diversificationScore.score).toBeNull();
    expect(result.summary).toContain("no holdings yet");
    expect(result.holdings).toEqual([]);
  });
});

describe("buildPortfolioIntelligence — concentrated portfolio", () => {
  it("reports a high largestPositionPct and a low concentration score for a single dominant holding", async () => {
    const data = new Map<string, Fundamentals | null>([
      ["AAA", makeFixture("AAA")],
      ["BBB", makeFixture("BBB")],
    ]);
    const provider = new FakeProvider(data);
    const holdings = [
      h({ id: 1, symbol: "AAA", targetWeightPct: 90, shares: 900 }),
      h({ id: 2, symbol: "BBB", targetWeightPct: 10, shares: 10 }),
    ];
    const result = await buildPortfolioIntelligence(holdings, provider);
    expect(result.allocation.largestPositionPct).toBeGreaterThan(80);
    expect(result.risk.concentration.capBreached).toBe(true);
    expect(result.risk.concentration.score).not.toBeNull();
    expect(result.risk.concentration.score!).toBeLessThan(60);
  });
});

describe("buildPortfolioIntelligence — diversified portfolio", () => {
  it("reports a low largestPositionPct and a high diversification score across many sectors", async () => {
    const symbols = ["AAA", "BBB", "CCC", "DDD", "EEE", "FFF"];
    const sectors = ["Technology", "Healthcare", "Financials", "Consumer Discretionary", "Industrials", "Energy"];
    const data = new Map<string, Fundamentals | null>(
      symbols.map((s, i) => [s, makeFixture(s, { sector: sectors[i], industry: `${sectors[i]} Sub` })]),
    );
    const provider = new FakeProvider(data);
    const holdings = symbols.map((s, i) => h({ id: i + 1, symbol: s, targetWeightPct: 100 / symbols.length, shares: 10 }));
    const result = await buildPortfolioIntelligence(holdings, provider);
    expect(result.allocation.largestPositionPct).toBeLessThan(25);
    expect(result.diversificationScore.score).not.toBeNull();
    expect(result.diversificationScore.score!).toBeGreaterThan(70);
    expect(result.allocation.bySector.length).toBe(6);
    // Percentages sum to (approximately) 100.
    const total = result.allocation.bySector.reduce((s, x) => s + x.weightPct, 0);
    expect(Math.round(total)).toBe(100);
  });
});

describe("buildPortfolioIntelligence — dividend-heavy portfolio", () => {
  it("reports a high portfolio dividend yield and an elevated dividend-dependence signal", async () => {
    const data = new Map<string, Fundamentals | null>([
      ["AAA", makeFixture("AAA", { dividendYield: 0.06, dividendPerShare: 6 })],
    ]);
    const provider = new FakeProvider(data);
    const holdings = [h({ id: 1, symbol: "AAA", targetWeightPct: 100, shares: 100 })];
    const result = await buildPortfolioIntelligence(holdings, provider);
    expect(result.weightedMetrics.dividendYield).toBeCloseTo(0.06, 3);
    expect(result.income.portfolioDividendYield).toBeCloseTo(0.06, 3);
    expect(result.income.estAnnualDividendIncome).toBe(600);
    expect(result.risk.dividendDependence.score).not.toBeNull();
    expect(result.risk.dividendDependence.detail).toMatch(/depends on continued dividend/);
  });
});

describe("buildPortfolioIntelligence — growth portfolio", () => {
  it("classifies a high-growth, high-conviction holding into the Growth bucket", async () => {
    const data = new Map<string, Fundamentals | null>([
      [
        "AAA",
        makeFixture("AAA", {
          revenueGrowth5y: 0.35,
          epsGrowth5y: 0.4,
          revenueGrowthFwd: 0.3,
          roic: 0.3,
          roe: 0.35,
          grossMargin: 0.7,
          operatingMargin: 0.35,
        }),
      ],
    ]);
    const provider = new FakeProvider(data);
    const holdings = [h({ id: 1, symbol: "AAA", targetWeightPct: 100, shares: 10 })];
    const result = await buildPortfolioIntelligence(holdings, provider);
    const gv = result.allocation.growthValueMix.find((s) => s.label === "Growth");
    expect(gv).toBeDefined();
    expect(gv!.weightPct).toBeGreaterThan(0);
  });
});

describe("buildPortfolioIntelligence — value portfolio", () => {
  it("classifies a cheap, low-growth holding into the Value bucket", async () => {
    const data = new Map<string, Fundamentals | null>([
      [
        "AAA",
        makeFixture("AAA", {
          price: 50,
          epsTtm: 10,
          revenueGrowth5y: 0.02,
          epsGrowth5y: 0.01,
          revenueGrowthFwd: 0.01,
          fcfPerShare: 8,
          roic: 0.1,
          roe: 0.12,
        }),
      ],
    ]);
    const provider = new FakeProvider(data);
    const holdings = [h({ id: 1, symbol: "AAA", targetWeightPct: 100, shares: 10 })];
    const result = await buildPortfolioIntelligence(holdings, provider);
    const gv = result.allocation.growthValueMix;
    expect(gv.length).toBeGreaterThan(0);
    // Low growth + not overvalued should never be classified as "Growth".
    const growthSlice = gv.find((s) => s.label === "Growth");
    expect(growthSlice).toBeUndefined();
  });
});

describe("buildPortfolioIntelligence — cash-heavy (under-allocated) portfolio", () => {
  it("reports a large cashAllocationPct and an elevated cash-risk signal when target weights are far below 100%", async () => {
    const data = new Map<string, Fundamentals | null>([["AAA", makeFixture("AAA")]]);
    const provider = new FakeProvider(data);
    const holdings = [h({ id: 1, symbol: "AAA", targetWeightPct: 40, shares: 10 })];
    const result = await buildPortfolioIntelligence(holdings, provider);
    expect(result.allocation.cashAllocationPct).toBe(60);
    expect(result.allocation.cashAllocationNote).toMatch(/not a claim about an actual brokerage cash balance/);
    expect(result.risk.cashRisk.score).not.toBeNull();
    expect(result.risk.cashRisk.detail).toMatch(/under-invested/);
  });
});

describe("buildPortfolioIntelligence — incomplete provider data", () => {
  it("renormalizes weighted metrics over only the holdings with resolvable data, honestly excluding the rest", async () => {
    const data = new Map<string, Fundamentals | null>([
      ["AAA", makeFixture("AAA", { roic: 0.3, sector: "Technology" })],
      ["BBB", null], // symbol the provider genuinely cannot resolve
    ]);
    const provider = new FakeProvider(data);
    const holdings = [
      h({ id: 1, symbol: "AAA", targetWeightPct: 50, shares: 10 }),
      h({ id: 2, symbol: "BBB", targetWeightPct: 50, shares: 10 }),
    ];
    const result = await buildPortfolioIntelligence(holdings, provider);
    expect(result.unresolvedSymbols).toContain("BBB");
    // Only AAA contributed — renormalized weighted ROIC equals AAA's own value.
    expect(result.weightedMetrics.roic).toBeCloseTo(0.3, 4);
    const bbbHolding = result.holdings.find((x) => x.symbol === "BBB")!;
    expect(bbbHolding.currentPrice).toBeNull();
    expect(bbbHolding.qualityScore).toBeNull();
  });
});

describe("buildPortfolioIntelligence — provider fully unavailable for every symbol", () => {
  it("never fabricates a score, honestly reporting insufficient data throughout", async () => {
    const provider = new FakeProvider(new Map());
    const holdings = [h({ id: 1, symbol: "ZZZ", targetWeightPct: 100, shares: 10 })];
    const result = await buildPortfolioIntelligence(holdings, provider);
    expect(result.qualityScore.score).toBeNull();
    expect(result.capitalAllocationScore.score).toBeNull();
    expect(result.weightedMetrics.roic).toBeNull();
    expect(result.performance.totalMarketValue).toBeNull();
    expect(result.unresolvedSymbols).toContain("ZZZ");
  });
});

describe("buildPortfolioIntelligence — never-fabricate discipline for Country/Currency", () => {
  it("always reports Country and Currency exposure as unavailable, regardless of portfolio composition", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const result = await buildPortfolioIntelligence([h({ symbol: "AAPL", targetWeightPct: 100, shares: 5 })], provider);
    expect(result.allocation.byCountry.available).toBe(false);
    expect(result.allocation.byCurrency.available).toBe(false);
    expect(result.allocation.byCountry.reason).toMatch(/country/i);
    expect(result.allocation.byCurrency.reason).toMatch(/currency/i);
  });
});

describe("buildPortfolioIntelligence — Performance Analytics", () => {
  it("computes real unrealized P&L when avgCostBasis is entered, and honestly excludes holdings without one", async () => {
    const data = new Map<string, Fundamentals | null>([
      ["AAA", makeFixture("AAA", { price: 150 })],
      ["BBB", makeFixture("BBB", { price: 100 })],
    ]);
    const provider = new FakeProvider(data);
    const holdings = [
      h({ id: 1, symbol: "AAA", targetWeightPct: 50, shares: 10, avgCostBasis: 100 }),
      h({ id: 2, symbol: "BBB", targetWeightPct: 50, shares: 10, avgCostBasis: null }),
    ];
    const result = await buildPortfolioIntelligence(holdings, provider);
    const aaa = result.holdings.find((x) => x.symbol === "AAA")!;
    expect(aaa.costBasisValue).toBe(1000);
    expect(aaa.marketValue).toBe(1500);
    expect(aaa.unrealizedPnl).toBe(500);
    expect(aaa.unrealizedPnlPct).toBe(50);
    const bbb = result.holdings.find((x) => x.symbol === "BBB")!;
    expect(bbb.costBasisValue).toBeNull();
    expect(bbb.unrealizedPnl).toBeNull();
    expect(result.performance.holdingsWithoutCostBasis).toContain("BBB");
  });
});

describe("buildPortfolioIntelligence — Quality Drift", () => {
  it("is honestly unavailable with no previous snapshot, and computes a real delta when one is supplied", async () => {
    const data = new Map<string, Fundamentals | null>([["AAA", makeFixture("AAA")]]);
    const provider = new FakeProvider(data);
    const holdings = [h({ id: 1, symbol: "AAA", targetWeightPct: 100, shares: 10 })];

    const noHistory = await buildPortfolioIntelligence(holdings, provider);
    expect(noHistory.risk.qualityDrift.score).toBeNull();

    const currentQuality = noHistory.qualityScore.score;
    expect(currentQuality).not.toBeNull();
    const withHistory = await buildPortfolioIntelligence(holdings, provider, {
      qualityScore: (currentQuality as number) - 20,
      riskScore: null,
      diversificationScore: null,
    });
    expect(withHistory.risk.qualityDrift.score).not.toBeNull();
    expect(withHistory.risk.qualityDrift.label).toBe("Improving");
  });
});

describe("buildPortfolioIntelligence — position sizing / rebalancing assistant", () => {
  it("suggests a positive share delta for an under-weight holding and a negative one for an over-weight holding", async () => {
    const data = new Map<string, Fundamentals | null>([
      ["AAA", makeFixture("AAA", { price: 100 })],
      ["BBB", makeFixture("BBB", { price: 100 })],
    ]);
    const provider = new FakeProvider(data);
    const holdings = [
      h({ id: 1, symbol: "AAA", targetWeightPct: 80, shares: 5 }), // under target vs its 20-share peer at 50/50 value
      h({ id: 2, symbol: "BBB", targetWeightPct: 20, shares: 5 }),
    ];
    const result = await buildPortfolioIntelligence(holdings, provider);
    const aaa = result.holdings.find((x) => x.symbol === "AAA")!;
    const bbb = result.holdings.find((x) => x.symbol === "BBB")!;
    expect(aaa.suggestedShareDelta).not.toBeNull();
    expect(aaa.suggestedShareDelta!).toBeGreaterThan(0);
    expect(bbb.suggestedShareDelta).not.toBeNull();
    expect(bbb.suggestedShareDelta!).toBeLessThan(0);
  });
});

describe("buildPortfolioIntelligence — SIMULATED end-to-end smoke test", () => {
  it("produces a fully-shaped analysis for a real multi-symbol SIMULATED portfolio", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const holdings = [
      h({ id: 1, symbol: "AAPL", targetWeightPct: 40, shares: 10, avgCostBasis: 150 }),
      h({ id: 2, symbol: "MSFT", targetWeightPct: 30, shares: 5 }),
      h({ id: 3, symbol: "JNJ", targetWeightPct: 30, shares: 8 }),
    ];
    const result = await buildPortfolioIntelligence(holdings, provider);
    expect(result.holdings.length).toBe(3);
    expect(result.summary).toContain("holding(s) analyzed");
    expect(result.risk.overall).toBeDefined();
    expect(result.risk.concentration).toBeDefined();
    expect(result.risk.sectorExposure).toBeDefined();
    expect(result.risk.cyclicality).toBeDefined();
  });
});

describe("compareWatchlistToPortfolio", () => {
  it("classifies symbols into inBoth/onlyInWatchlist/onlyInPortfolio, case-insensitively", () => {
    const result = compareWatchlistToPortfolio(["AAPL", "msft", "KO"], ["aapl", "JNJ"]);
    expect(result.inBoth).toEqual(["AAPL"]);
    expect(result.onlyInWatchlist).toEqual(["KO", "MSFT"]);
    expect(result.onlyInPortfolio).toEqual(["JNJ"]);
    expect(result.summary).toContain("1 symbol(s)");
  });

  it("handles empty watchlist and empty portfolio honestly", () => {
    const result = compareWatchlistToPortfolio([], []);
    expect(result.inBoth).toEqual([]);
    expect(result.onlyInWatchlist).toEqual([]);
    expect(result.onlyInPortfolio).toEqual([]);
  });
});
