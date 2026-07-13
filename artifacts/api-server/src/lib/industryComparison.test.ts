// Phase 2, Sprint 20 — Industry Comparison Engine unit tests (approved Phase 2
// plan, Sprint 20).

import { describe, it, expect } from "vitest";
import { buildIndustryComparison, DEFAULT_PEER_COUNT } from "./industryComparison.js";
import { SimulatedFundamentalsProvider } from "./fundamentals.js";
import type { Fundamentals, FundamentalsProvider, FetchOpts, DataSource } from "./fundamentals.js";

function makeFixture(symbol: string, overrides: Partial<Fundamentals> = {}): Fundamentals {
  return {
    symbol,
    name: `${symbol} Inc`,
    kind: "stock",
    dataSource: "SIMULATED",
    asOf: "2026-01-15",
    fetchedAt: "2026-01-15T00:00:00.000Z",
    price: 150,
    sector: null,
    industry: null,
    insiderOwnershipPct: null,
    sharesOutstandingChange5y: null,
    netInsiderActivity: null,
    epsTtm: 8,
    epsFwd: 9,
    fcfPerShare: 10,
    salesPerShare: 60,
    bookPerShare: 40,
    dividendPerShare: 1,
    pe: 18.75,
    forwardPe: 16.7,
    peg: 1.5,
    ps: 2.5,
    pb: 3.75,
    fcfYield: 0.067,
    earningsYield: 0.053,
    dividendYield: 0.007,
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

// Deterministic fake provider so peer ranking math can be tested against known
// values (not the SIMULATED engine's jittered/seeded numbers). Real symbols
// from the Technology sector's peer universe are reused so getSectorProfile()
// still classifies them correctly without needing a second sector table.
class FakeProvider implements FundamentalsProvider {
  readonly id = "fake";
  readonly dataSource: DataSource = "SIMULATED";
  readonly isLive = false;
  constructor(private readonly data: Map<string, Fundamentals>) {}
  async getFundamentals(symbol: string, _asOf?: string, _opts?: FetchOpts): Promise<Fundamentals | null> {
    return this.data.get(symbol.toUpperCase()) ?? null;
  }
  async getFinancialStatements(): Promise<null> {
    return null;
  }
}

describe("buildIndustryComparison — SIMULATED path (real provider, real sector taxonomy)", () => {
  it("returns a full comparison for a known Technology symbol with a 5-peer default group", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const result = await buildIndustryComparison("AAPL", provider);
    expect(result).not.toBeNull();
    expect(result!.sector).toBe("Technology");
    expect(result!.industry).toBe("Consumer Electronics");
    expect(result!.peerGroup.length).toBe(DEFAULT_PEER_COUNT);
    expect(result!.peerGroup.map((p) => p.symbol)).not.toContain("AAPL");
    expect(result!.metrics.length).toBe(17);
    expect(result!.confidenceLevel).toBeDefined();
    expect(result!.competitivePosition).toBeDefined();
  });

  it("honestly returns null for an invalid ticker shape, never fabricating a comparison", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const result = await buildIndustryComparison("NOT A TICKER!!", provider);
    expect(result).toBeNull();
  });

  it("respects an explicit peerCount override", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const result = await buildIndustryComparison("AAPL", provider, undefined, undefined, 2);
    expect(result!.peerGroup.length).toBe(2);
  });

  it("is cached — a second call for the same symbol/asOf returns the same object without re-fetching all peers", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const a = await buildIndustryComparison("MSFT", provider);
    const b = await buildIndustryComparison("MSFT", provider);
    expect(a).toEqual(b);
  });
});

describe("buildIndustryComparison — ranking math (fake provider, controlled fixtures)", () => {
  it("computes peer median, rank, and percentile correctly for a higher-better metric", async () => {
    const data = new Map<string, Fundamentals>();
    data.set("AAPL", makeFixture("AAPL", { revenueGrowth5y: 0.3 })); // target: best
    data.set("MSFT", makeFixture("MSFT", { revenueGrowth5y: 0.2 }));
    data.set("NVDA", makeFixture("NVDA", { revenueGrowth5y: 0.1 }));
    data.set("ORCL", makeFixture("ORCL", { revenueGrowth5y: 0.05 }));
    data.set("CRM", makeFixture("CRM", { revenueGrowth5y: 0.02 }));
    data.set("ADBE", makeFixture("ADBE", { revenueGrowth5y: 0.01 }));
    const provider = new FakeProvider(data);

    const result = await buildIndustryComparison("AAPL", provider, undefined, { forceRefresh: true });
    expect(result).not.toBeNull();
    const revGrowth = result!.metrics.find((m) => m.key === "revenueGrowth5y")!;
    expect(revGrowth.companyValue).toBe(0.3);
    expect(revGrowth.peerMedian).toBe(0.05); // median of [0.2, 0.1, 0.05, 0.02, 0.01]
    expect(revGrowth.rank).toBe(1); // best of 6
    expect(revGrowth.totalRanked).toBe(6);
    expect(revGrowth.percentile).toBe(100);
    expect(revGrowth.available).toBe(true);
  });

  it("ranks a lower-better metric (Debt-to-Equity) in the opposite direction", async () => {
    const data = new Map<string, Fundamentals>();
    data.set("AAPL", makeFixture("AAPL", { debtToEquity: 0.1 })); // target: lowest = best
    data.set("MSFT", makeFixture("MSFT", { debtToEquity: 0.3 }));
    data.set("NVDA", makeFixture("NVDA", { debtToEquity: 0.5 }));
    data.set("ORCL", makeFixture("ORCL", { debtToEquity: 0.7 }));
    data.set("CRM", makeFixture("CRM", { debtToEquity: 0.9 }));
    data.set("ADBE", makeFixture("ADBE", { debtToEquity: 1.1 }));
    const provider = new FakeProvider(data);

    const result = await buildIndustryComparison("AAPL", provider, undefined, { forceRefresh: true });
    const debt = result!.metrics.find((m) => m.key === "debtToEquity")!;
    expect(debt.rank).toBe(1);
    expect(debt.percentile).toBe(100);
  });

  it("excludes P/E, P/S, P/B from percentile/rank (context-only) per the approved Sprint 20 decision", async () => {
    const data = new Map<string, Fundamentals>();
    data.set("AAPL", makeFixture("AAPL", { pe: 50 }));
    data.set("MSFT", makeFixture("MSFT", { pe: 10 }));
    const provider = new FakeProvider(data);

    const result = await buildIndustryComparison("AAPL", provider, undefined, { forceRefresh: true }, 1);
    const pe = result!.metrics.find((m) => m.key === "pe")!;
    expect(pe.direction).toBe("context-only");
    expect(pe.rank).toBeNull();
    expect(pe.percentile).toBeNull();
    expect(pe.peerMedian).toBe(10);
    // Context-only metrics never contribute to strengths/weaknesses or overallPercentile.
    expect(result!.strengths.some((s) => s.includes("P/E"))).toBe(false);
    expect(result!.weaknesses.some((s) => s.includes("P/E"))).toBe(false);
  });

  it("drops a peer that fails to resolve rather than fabricating one", async () => {
    const data = new Map<string, Fundamentals>();
    data.set("AAPL", makeFixture("AAPL"));
    data.set("MSFT", makeFixture("MSFT"));
    // NVDA, ORCL, CRM, ADBE deliberately absent — resolveFundamentals returns null for them.
    const provider = new FakeProvider(data);

    const result = await buildIndustryComparison("AAPL", provider, undefined, { forceRefresh: true });
    expect(result!.peerGroup.length).toBe(1);
    expect(result!.peerGroup[0].symbol).toBe("MSFT");
  });

  it("honestly reports insufficient data when no peers resolve at all", async () => {
    const data = new Map<string, Fundamentals>();
    data.set("AAPL", makeFixture("AAPL"));
    const provider = new FakeProvider(data);

    const result = await buildIndustryComparison("AAPL", provider, undefined, { forceRefresh: true });
    expect(result!.peerGroup.length).toBe(0);
    expect(result!.overallPercentile).toBeNull();
    expect(result!.competitivePosition).toBe("Insufficient Data");
    expect(result!.confidenceLevel).toBe("Low");
    expect(result!.summary).toMatch(/no.*peers could be resolved/i);
  });

  it("derives strengths from top-third-percentile ranked metrics and weaknesses from bottom-third", async () => {
    const data = new Map<string, Fundamentals>();
    data.set("AAPL", makeFixture("AAPL", { revenueGrowth5y: 0.5, debtToEquity: 5.0 })); // best growth, worst debt
    data.set("MSFT", makeFixture("MSFT", { revenueGrowth5y: 0.1, debtToEquity: 0.3 }));
    data.set("NVDA", makeFixture("NVDA", { revenueGrowth5y: 0.08, debtToEquity: 0.2 }));
    data.set("ORCL", makeFixture("ORCL", { revenueGrowth5y: 0.06, debtToEquity: 0.4 }));
    data.set("CRM", makeFixture("CRM", { revenueGrowth5y: 0.04, debtToEquity: 0.5 }));
    data.set("ADBE", makeFixture("ADBE", { revenueGrowth5y: 0.02, debtToEquity: 0.6 }));
    const provider = new FakeProvider(data);

    const result = await buildIndustryComparison("AAPL", provider, undefined, { forceRefresh: true });
    expect(result!.strengths.some((s) => s.includes("Revenue Growth"))).toBe(true);
    expect(result!.weaknesses.some((s) => s.includes("Debt-to-Equity"))).toBe(true);
  });

  it("marks the result simulated when the target or any peer used fallback/SIMULATED data", async () => {
    const data = new Map<string, Fundamentals>();
    data.set("AAPL", makeFixture("AAPL", { dataSource: "LIVE" }));
    data.set("MSFT", makeFixture("MSFT", { dataSource: "SIMULATED" }));
    const provider = new FakeProvider(data);

    const result = await buildIndustryComparison("AAPL", provider, undefined, { forceRefresh: true }, 1);
    expect(result!.simulated).toBe(true);
  });

  it("does not mark the result simulated when target and all peers are LIVE with no fallback", async () => {
    const data = new Map<string, Fundamentals>();
    data.set("AAPL", makeFixture("AAPL", { dataSource: "LIVE" }));
    data.set("MSFT", makeFixture("MSFT", { dataSource: "LIVE" }));
    const provider = new FakeProvider(data);

    const result = await buildIndustryComparison("AAPL", provider, undefined, { forceRefresh: true }, 1);
    expect(result!.simulated).toBe(false);
  });
});
