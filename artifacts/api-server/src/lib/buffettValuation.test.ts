// Phase 2, Sprint 14 — Buffett Valuation Engine unit tests (approved Phase 2
// plan, Sprint 14).

import { describe, it, expect } from "vitest";
import { analyzeBuffettValuation } from "./buffettValuation.js";
import type { Fundamentals } from "./fundamentals.js";
import type { BusinessQuality, MoatAnalysis } from "./valueInvesting.js";

function fixture(overrides: Partial<Fundamentals> = {}): Fundamentals {
  return {
    symbol: "TEST",
    name: "Test Co",
    kind: "stock",
    dataSource: "SIMULATED",
    asOf: "2026-01-15",
    fetchedAt: "2026-01-15T00:00:00.000Z",
    price: 150,
    sector: null,
    industry: null,
    beta: null,
    insiderOwnershipPct: null,
    sharesOutstandingChange5y: null,
    netInsiderActivity: null,
    epsTtm: 8,
    epsFwd: 9,
    fcfPerShare: 10,
    salesPerShare: 60,
    bookPerShare: 40,
    dividendPerShare: 0,
    pe: 18.75,
    forwardPe: 16.7,
    peg: null,
    ps: 2.5,
    pb: 3.75,
    fcfYield: 0.067,
    earningsYield: 0.053,
    dividendYield: 0,
    revenueGrowth5y: 0.1,
    epsGrowth5y: 0.1,
    revenueGrowthFwd: 0.09,
    grossMargin: 0.4,
    operatingMargin: 0.2,
    netMargin: 0.15,
    roe: 0.2,
    roic: 0.15,
    debtToEquity: 0.3,
    interestCoverage: 15,
    currentRatio: 1.5,
    netCashPerShare: 2,
    fcfPositiveYears: 9,
    fcfMargin: 0.15,
    qualitative: {
      pricingPower: 50, brand: 50, customerLoyalty: 50, recurringRevenue: 50, scale: 50,
      switchingCost: 50, networkEffect: 50, ipStrength: 50, distribution: 50, regulatoryAdvantage: 50,
    },
    revenueHistory: [50, 52, 54, 56, 58, 60],
    epsHistory: [5, 6, 6.5, 7, 7.5, 8],
    fcfHistory: [6, 6.5, 7, 7.5, 8, 10],
    ...overrides,
  };
}

function bqFixture(score: number): BusinessQuality {
  return { score, rating: "Wonderful", factors: [], summary: "" };
}

function moatFixture(rating: MoatAnalysis["rating"]): MoatAnalysis {
  return { rating, score: 50, durabilityYears: 10, sources: [], summary: "" };
}

describe("analyzeBuffettValuation", () => {
  it("capitalizes owner earnings as a no-growth perpetuity at the quality/moat-adjusted required return", () => {
    const f = fixture({ fcfPerShare: 10, price: 150 });
    const b = analyzeBuffettValuation(f, bqFixture(100), moatFixture("Wide"), 0.09);
    expect(b.available).toBe(true);
    if (b.available) {
      // quality bonus 2% (score 100) + moat bonus 2% (Wide) = 4% discount, clamped to max 4%.
      expect(b.requiredReturn).toBe(0.05);
      // 10 / 0.05 = 200
      expect(b.fairValue).toBe(200);
      expect(b.ownerEarnings).toBe(10);
    }
  });

  it("uses the full base required return when quality is average and there is no moat", () => {
    const f = fixture({ fcfPerShare: 10 });
    const b = analyzeBuffettValuation(f, bqFixture(50), moatFixture("None"), 0.09);
    expect(b.available).toBe(true);
    if (b.available) {
      expect(b.requiredReturn).toBe(0.09);
      // 10 / 0.09 = 111.11
      expect(b.fairValue).toBe(111.11);
    }
  });

  it("never lets the required return collapse below the 3% floor", () => {
    const f = fixture({ fcfPerShare: 10 });
    const b = analyzeBuffettValuation(f, bqFixture(100), moatFixture("Wide"), 0.03);
    expect(b.available).toBe(true);
    if (b.available) {
      expect(b.requiredReturn).toBeGreaterThanOrEqual(0.03);
    }
  });

  it("computes margin of safety and rating via the shared classifyMarginOfSafety", () => {
    const f = fixture({ fcfPerShare: 10, price: 150 });
    const b = analyzeBuffettValuation(f, bqFixture(100), moatFixture("Wide"), 0.09);
    expect(b.available).toBe(true);
    if (b.available) {
      // (200 - 150) / 200 = 0.25
      expect(b.marginOfSafety).toBe(0.25);
      expect(b.marginOfSafetyLabel).toBe("High");
      expect(b.rating).toBe("Cheap");
    }
  });

  it("reports UNAVAILABLE (never fabricates) when free cash flow is not positive", () => {
    const negative = analyzeBuffettValuation(fixture({ fcfPerShare: -1 }), bqFixture(70), moatFixture("Medium"));
    expect(negative.available).toBe(false);
    if (!negative.available) {
      expect(negative.reason).toMatch(/positive free cash flow/i);
      expect(negative.summary).toMatch(/unavailable/i);
    }
  });

  it("adds the ETF caveat to the summary for ETF-kind fundamentals, not for stocks", () => {
    const stock = analyzeBuffettValuation(fixture({ kind: "stock" }), bqFixture(70), moatFixture("Medium"));
    const etf = analyzeBuffettValuation(fixture({ kind: "etf" }), bqFixture(70), moatFixture("Medium"));
    expect(stock.available).toBe(true);
    expect(etf.available).toBe(true);
    if (stock.available) expect(stock.summary).not.toMatch(/diversified fund/i);
    if (etf.available) expect(etf.summary).toMatch(/diversified fund/i);
  });

  it("a wider moat and higher quality score never produce a LOWER fair value than a weaker one", () => {
    const f = fixture({ fcfPerShare: 10 });
    const weak = analyzeBuffettValuation(f, bqFixture(50), moatFixture("None"));
    const strong = analyzeBuffettValuation(f, bqFixture(100), moatFixture("Wide"));
    expect(weak.available).toBe(true);
    expect(strong.available).toBe(true);
    if (weak.available && strong.available) {
      expect(strong.fairValue).toBeGreaterThan(weak.fairValue);
    }
  });

  it("defaults baseRequiredReturn to 9% when omitted", () => {
    const f = fixture({ fcfPerShare: 10 });
    const explicit = analyzeBuffettValuation(f, bqFixture(70), moatFixture("Medium"), 0.09);
    const defaulted = analyzeBuffettValuation(f, bqFixture(70), moatFixture("Medium"));
    expect(defaulted).toEqual(explicit);
  });
});
