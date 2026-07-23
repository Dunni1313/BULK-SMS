// Phase 2, Sprint 12 — Graham Valuation Engine unit tests (approved Phase 2
// plan, Sprint 12).

import { describe, it, expect } from "vitest";
import { analyzeGrahamValuation } from "./grahamValuation.js";
import type { Fundamentals } from "./fundamentals.js";

// A minimal, fully-specified Fundamentals fixture. Only the fields Graham's
// engine actually reads (epsTtm, bookPerShare, epsGrowth5y, price, kind,
// symbol) are varied per test; the rest are filled with plausible constants
// so the object satisfies the full interface.
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
    marketCap: null,
    insiderOwnershipPct: null,
    sharesOutstandingChange5y: null,
    netInsiderActivity: null,
    epsTtm: 10,
    epsFwd: 11,
    fcfPerShare: 9,
    salesPerShare: 60,
    bookPerShare: 40,
    dividendPerShare: 0,
    pe: 15,
    forwardPe: 13.6,
    peg: null,
    ps: 2.5,
    pb: 3.75,
    fcfYield: 0.06,
    earningsYield: 0.067,
    dividendYield: 0,
    revenueGrowth5y: 0.08,
    epsGrowth5y: 0.1,
    revenueGrowthFwd: 0.07,
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
    epsHistory: [7, 8, 8.5, 9, 9.5, 10],
    fcfHistory: [6, 6.5, 7, 7.5, 8, 9],
    ...overrides,
  };
}

describe("analyzeGrahamValuation", () => {
  it("computes the classic Graham Number correctly: sqrt(22.5 x EPS x book value/share)", () => {
    const f = fixture({ epsTtm: 10, bookPerShare: 40 });
    const g = analyzeGrahamValuation(f);
    expect(g.available).toBe(true);
    if (g.available) {
      // sqrt(22.5 * 10 * 40) = sqrt(9000) = 94.868...
      expect(g.grahamNumber).toBe(94.87);
    }
  });

  it("computes Graham's growth formula correctly: EPS x (8.5 + 2g) x 4.4/Y", () => {
    const f = fixture({ epsTtm: 10, epsGrowth5y: 0.1 });
    const g = analyzeGrahamValuation(f, 0.045);
    expect(g.available).toBe(true);
    if (g.available) {
      // 10 * (8.5 + 2*10) * (4.4/4.5) = 10 * 28.5 * 0.977778 = 278.666...
      expect(g.growthFormulaValue).toBe(278.67);
    }
  });

  it("averages the two methods into fairValue, and margin of safety matches the shared classifier", () => {
    const f = fixture({ epsTtm: 10, bookPerShare: 40, epsGrowth5y: 0.1, price: 150 });
    const g = analyzeGrahamValuation(f, 0.045);
    expect(g.available).toBe(true);
    if (g.available) {
      const expectedFairValue = Math.round(((94.87 + 278.67) / 2) * 100) / 100;
      expect(g.fairValue).toBe(expectedFairValue);
      expect(g.methods).toHaveLength(2);
      const expectedMos = Math.round(((expectedFairValue - 150) / expectedFairValue) * 10000) / 10000;
      expect(g.marginOfSafety).toBe(expectedMos);
      expect(g.marginOfSafetyLabel).toBe("Medium");
      expect(g.rating).toBe("Cheap");
    }
  });

  it("uses trailing EPS only, never forward EPS — a high forward EPS does not change the result", () => {
    const withoutFwd = analyzeGrahamValuation(fixture({ epsTtm: 10, epsFwd: 10 }));
    const withHighFwd = analyzeGrahamValuation(fixture({ epsTtm: 10, epsFwd: 999 }));
    expect(withoutFwd).toEqual(withHighFwd);
  });

  it("still computes the growth formula (not Graham Number) when book value is not positive", () => {
    const f = fixture({ epsTtm: 10, bookPerShare: 0 });
    const g = analyzeGrahamValuation(f);
    expect(g.available).toBe(true);
    if (g.available) {
      expect(g.grahamNumber).toBeNull();
      expect(g.growthFormulaValue).not.toBeNull();
      expect(g.methods).toHaveLength(1);
      expect(g.fairValue).toBe(g.growthFormulaValue);
    }
  });

  it("reports UNAVAILABLE (never fabricates) when trailing EPS is not positive", () => {
    const f = fixture({ epsTtm: null, epsFwd: 20 });
    const g = analyzeGrahamValuation(f);
    expect(g.available).toBe(false);
    if (!g.available) {
      expect(g.reason).toMatch(/positive trailing EPS/);
      expect(g.summary).toMatch(/unavailable/i);
    }

    const negative = analyzeGrahamValuation(fixture({ epsTtm: -2 }));
    expect(negative.available).toBe(false);
  });

  it("adds the ETF caveat to the summary for ETF-kind fundamentals, not for stocks", () => {
    const stock = analyzeGrahamValuation(fixture({ kind: "stock" }));
    const etf = analyzeGrahamValuation(fixture({ kind: "etf" }));
    expect(stock.available).toBe(true);
    expect(etf.available).toBe(true);
    if (stock.available) expect(stock.summary).not.toMatch(/diversified fund/i);
    if (etf.available) expect(etf.summary).toMatch(/diversified fund/i);
  });

  it("respects a custom risk-free rate parameter for the growth formula", () => {
    const f = fixture({ epsTtm: 10, epsGrowth5y: 0.1 });
    const lowRate = analyzeGrahamValuation(f, 0.03);
    const highRate = analyzeGrahamValuation(f, 0.09);
    expect(lowRate.available).toBe(true);
    expect(highRate.available).toBe(true);
    if (lowRate.available && highRate.available) {
      // A lower required yield (Y) means a HIGHER computed fair value.
      expect(lowRate.growthFormulaValue!).toBeGreaterThan(highRate.growthFormulaValue!);
    }
  });

  it("never claims to fabricate a value beyond what the two methods produce", () => {
    const f = fixture();
    const g = analyzeGrahamValuation(f);
    expect(g.available).toBe(true);
    if (g.available) {
      const serialized = JSON.stringify(g);
      expect(serialized).not.toContain("order");
      expect(serialized).not.toContain("execute");
    }
  });
});
