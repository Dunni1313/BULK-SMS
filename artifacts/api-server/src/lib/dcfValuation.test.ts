// Phase 2, Sprint 13 — DCF Valuation Engine unit tests (approved Phase 2 plan,
// Sprint 13). Expected values below are independently computed (see the
// project's own Sprint 13 planning notes) and hardcoded as regression
// fixtures, not re-derived from the code under test.

import { describe, it, expect } from "vitest";
import { analyzeDcfValuation } from "./dcfValuation.js";
import type { Fundamentals } from "./fundamentals.js";

function fixture(overrides: Partial<Fundamentals> = {}): Fundamentals {
  return {
    symbol: "TEST",
    name: "Test Co",
    kind: "stock",
    dataSource: "SIMULATED",
    asOf: "2026-01-15",
    fetchedAt: "2026-01-15T00:00:00.000Z",
    price: 100,
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
    dividendPerShare: 0,
    pe: 12.5,
    forwardPe: 11.1,
    peg: null,
    ps: 1.67,
    pb: 2.5,
    fcfYield: 0.1,
    earningsYield: 0.08,
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

describe("analyzeDcfValuation", () => {
  it("computes the 5-year projection, terminal value, and fair value exactly (hardcoded golden values)", () => {
    const f = fixture({ fcfPerShare: 10, revenueGrowth5y: 0.1, price: 100 });
    const d = analyzeDcfValuation(f, 0.09, 0.025, 5);
    expect(d.available).toBe(true);
    if (d.available) {
      expect(d.projectedFreeCashFlows).toEqual([11, 11.89, 12.64, 13.19, 13.52]);
      expect(d.terminalValue).toBe(213.2);
      expect(d.fairValue).toBe(186.56);
      expect(d.methods).toHaveLength(2);
      expect(d.methods[0].fairValue).toBe(47.99);
      expect(d.methods[1].fairValue).toBe(138.57);
    }
  });

  it("computes margin of safety and rating via the shared classifyMarginOfSafety, not duplicated logic", () => {
    const f = fixture({ fcfPerShare: 10, revenueGrowth5y: 0.1, price: 100 });
    const d = analyzeDcfValuation(f, 0.09, 0.025, 5);
    expect(d.available).toBe(true);
    if (d.available) {
      expect(d.marginOfSafety).toBe(0.464);
      expect(d.marginOfSafetyLabel).toBe("High");
      expect(d.rating).toBe("Cheap");
    }
  });

  it("derives a deterministic confidence label/explanation from a bull/bear sensitivity band", () => {
    const f = fixture({ fcfPerShare: 10, revenueGrowth5y: 0.1, price: 100 });
    const d = analyzeDcfValuation(f, 0.09, 0.025, 5);
    expect(d.available).toBe(true);
    if (d.available) {
      // A ~48% spread falls in the Moderate bucket ([35%, 75%)).
      expect(d.confidenceLabel).toBe("Moderate");
      expect(d.confidenceExplanation).toMatch(/moderately sensitive/i);
      expect(d.confidenceExplanation).toMatch(/48%/);
    }
  });

  it("reports UNAVAILABLE (never fabricates) when free cash flow is not positive", () => {
    const negative = analyzeDcfValuation(fixture({ fcfPerShare: -1 }));
    expect(negative.available).toBe(false);
    if (!negative.available) {
      expect(negative.reason).toMatch(/positive free cash flow/i);
      expect(negative.summary).toMatch(/unavailable/i);
    }

    const zero = analyzeDcfValuation(fixture({ fcfPerShare: 0 }));
    expect(zero.available).toBe(false);
  });

  it("reports UNAVAILABLE when the discount rate does not exceed the terminal growth rate", () => {
    const d = analyzeDcfValuation(fixture({ fcfPerShare: 10 }), 0.02, 0.025, 5);
    expect(d.available).toBe(false);
    if (!d.available) {
      expect(d.reason).toMatch(/discount rate must exceed/i);
    }
  });

  it("adds the ETF caveat to the summary for ETF-kind fundamentals, not for stocks", () => {
    const stock = analyzeDcfValuation(fixture({ kind: "stock" }));
    const etf = analyzeDcfValuation(fixture({ kind: "etf" }));
    expect(stock.available).toBe(true);
    expect(etf.available).toBe(true);
    if (stock.available) expect(stock.summary).not.toMatch(/diversified fund/i);
    if (etf.available) expect(etf.summary).toMatch(/diversified fund/i);
  });

  it("respects custom discount rate, terminal growth rate, and projection horizon parameters", () => {
    const f = fixture({ fcfPerShare: 10, revenueGrowth5y: 0.1 });
    const base = analyzeDcfValuation(f, 0.09, 0.025, 5);
    const higherDiscount = analyzeDcfValuation(f, 0.12, 0.025, 5);
    const shorterHorizon = analyzeDcfValuation(f, 0.09, 0.025, 3);
    expect(base.available).toBe(true);
    expect(higherDiscount.available).toBe(true);
    expect(shorterHorizon.available).toBe(true);
    if (base.available && higherDiscount.available) {
      // A higher discount rate must produce a LOWER fair value.
      expect(higherDiscount.fairValue).toBeLessThan(base.fairValue);
    }
    if (base.available && shorterHorizon.available) {
      expect(shorterHorizon.projectionYears).toBe(3);
      expect(shorterHorizon.projectedFreeCashFlows).toHaveLength(3);
    }
  });

  it("defaults discountRate/terminalGrowthRate/projectionYears to 9% / 2.5% / 5 years when omitted", () => {
    const f = fixture({ fcfPerShare: 10, revenueGrowth5y: 0.1, price: 100 });
    const explicit = analyzeDcfValuation(f, 0.09, 0.025, 5);
    const defaulted = analyzeDcfValuation(f);
    expect(defaulted).toEqual(explicit);
  });

  it("never claims to execute or submit anything", () => {
    const f = fixture();
    const d = analyzeDcfValuation(f);
    expect(d.available).toBe(true);
    if (d.available) {
      const serialized = JSON.stringify(d);
      expect(serialized).not.toContain("order");
      expect(serialized).not.toContain("execute");
    }
  });
});
