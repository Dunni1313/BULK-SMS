// Phase 2, Sprint 18 — Financial Ratio Analysis unit tests (approved Phase 2
// plan, Sprint 18).

import { describe, it, expect } from "vitest";
import { analyzeFinancialRatios } from "./financialRatios.js";
import type { Fundamentals } from "./fundamentals.js";

function fixture(overrides: Partial<Fundamentals> = {}): Fundamentals {
  return {
    symbol: "TEST",
    name: "Test Co",
    kind: "stock",
    dataSource: "SIMULATED",
    asOf: "2026-01-15",
    fetchedAt: "2026-01-15T00:00:00.000Z",
    price: 150,
    epsTtm: 10,
    epsFwd: 11,
    fcfPerShare: 9,
    salesPerShare: 60,
    bookPerShare: 40,
    dividendPerShare: 2,
    pe: 15,
    forwardPe: 13.6,
    peg: 1.5,
    ps: 2.5,
    pb: 3.75,
    fcfYield: 0.06,
    earningsYield: 0.067,
    dividendYield: 0.013,
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

function metric(ratios: ReturnType<typeof analyzeFinancialRatios>, label: string): { label: string; value: number | null; displayValue: string; available: boolean; reason?: string } {
  const all = [...ratios.valuation, ...ratios.profitability, ...ratios.liquidityAndLeverage];
  const m = all.find((x) => x.label === label);
  if (!m) throw new Error(`ratio not found: ${label}`);
  return m;
}

describe("analyzeFinancialRatios", () => {
  it("computes Payout Ratio from existing fields (dividendPerShare / epsTtm)", () => {
    const r = analyzeFinancialRatios(fixture({ dividendPerShare: 2, epsTtm: 10 }));
    const m = metric(r, "Payout Ratio");
    expect(m.available).toBe(true);
    expect(m.value).toBe(0.2);
    expect(m.displayValue).toBe("20%");
  });

  it("honestly reports Payout Ratio UNAVAILABLE when trailing EPS is not positive", () => {
    const r = analyzeFinancialRatios(fixture({ epsTtm: null }));
    const m = metric(r, "Payout Ratio");
    expect(m.available).toBe(false);
    expect(m.value).toBeNull();
    expect(m.reason).toMatch(/positive trailing EPS/);
  });

  it("always reports Quick Ratio, Return on Assets, and Asset Turnover UNAVAILABLE — never approximated or fabricated", () => {
    const r = analyzeFinancialRatios(fixture());
    for (const label of ["Quick Ratio", "Return on Assets", "Asset Turnover"]) {
      const m = metric(r, label);
      expect(m.available).toBe(false);
      expect(m.value).toBeNull();
      expect(m.reason).toMatch(/balance-sheet/i);
      expect(m.reason).toMatch(/Financial Statement Analysis/);
    }
  });

  it("reuses existing fields directly for valuation/profitability/leverage ratios, no recomputation", () => {
    const f = fixture({ pe: 18, forwardPe: 16, peg: 1.2, roe: 0.25, roic: 0.18, debtToEquity: 0.5, interestCoverage: 12 });
    const r = analyzeFinancialRatios(f);
    expect(metric(r, "P/E (trailing)").value).toBe(18);
    expect(metric(r, "P/E (forward)").value).toBe(16);
    expect(metric(r, "PEG").value).toBe(1.2);
    expect(metric(r, "Return on Equity").value).toBe(0.25);
    expect(metric(r, "Return on Invested Capital").value).toBe(0.18);
    expect(metric(r, "Debt/Equity").value).toBe(0.5);
    expect(metric(r, "Interest Coverage").value).toBe(12);
  });

  it("Current Ratio is unavailable for ETFs (not meaningful for a diversified fund), available for stocks", () => {
    const stock = analyzeFinancialRatios(fixture({ kind: "stock", currentRatio: 1.8 }));
    const etf = analyzeFinancialRatios(fixture({ kind: "etf", currentRatio: 1.8 }));
    expect(metric(stock, "Current Ratio").available).toBe(true);
    expect(metric(stock, "Current Ratio").value).toBe(1.8);
    expect(metric(etf, "Current Ratio").available).toBe(false);
  });

  it("reuses Fundamentals' history arrays directly for trend data, no new computation", () => {
    const f = fixture({
      revenueHistory: [10, 11, 12, 13, 14, 15],
      epsHistory: [1, 1.2, 1.4, 1.6, 1.8, 2],
      fcfHistory: [0.5, 0.6, 0.7, 0.8, 0.9, 1],
    });
    const r = analyzeFinancialRatios(f);
    expect(r.trends.find((t) => t.label === "Revenue per Share")!.history).toEqual(f.revenueHistory);
    expect(r.trends.find((t) => t.label === "EPS")!.history).toEqual(f.epsHistory);
    expect(r.trends.find((t) => t.label === "Free Cash Flow per Share")!.history).toEqual(f.fcfHistory);
  });

  it("summary honestly reports how many ratios are unavailable", () => {
    const r = analyzeFinancialRatios(fixture());
    expect(r.summary).toMatch(/of \d+ financial ratios computed/);
    expect(r.summary).toMatch(/await full balance-sheet data/);
  });

  it("never claims to fabricate or execute anything", () => {
    const r = analyzeFinancialRatios(fixture());
    const serialized = JSON.stringify(r);
    expect(serialized).not.toContain("order");
    expect(serialized).not.toContain("execute");
  });
});
