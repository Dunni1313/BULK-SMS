// Phase 2, Sprint 15 — Investment Quality Engine unit tests (approved Phase 2
// plan, Sprint 15).

import { describe, it, expect } from "vitest";
import { analyzeInvestmentQuality } from "./investmentQuality.js";
import { leverageScore, coverageScore, cashPositionScore } from "./valueInvesting.js";
import type { Fundamentals } from "./fundamentals.js";

// Same minimal-fixture style established in grahamValuation.test.ts /
// dcfValuation.test.ts / buffettValuation.test.ts.
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

function metric(q: ReturnType<typeof analyzeInvestmentQuality>, name: string) {
  const m = q.metrics.find((x) => x.metric === name);
  if (!m) throw new Error(`metric not found: ${name}`);
  return m;
}

describe("analyzeInvestmentQuality", () => {
  it("scores all 12 requested metrics, in the requested order", () => {
    const q = analyzeInvestmentQuality(fixture());
    expect(q.metrics.map((m) => m.metric)).toEqual([
      "Revenue Growth",
      "EPS Growth",
      "Free Cash Flow Growth",
      "Return on Equity",
      "Return on Invested Capital",
      "Gross Margin",
      "Operating Margin",
      "Net Margin",
      "Debt Levels",
      "Cash Position",
      "Share Dilution / Buybacks",
      "Insider Ownership",
    ]);
  });

  it("computes Revenue Growth / EPS Growth / ROE / ROIC / margins against their target benchmarks", () => {
    const q = analyzeInvestmentQuality(fixture({ revenueGrowth5y: 0.1, epsGrowth5y: 0.125, roe: 0.175, roic: 0.15, grossMargin: 0.3, operatingMargin: 0.125, netMargin: 0.15 }));
    expect(metric(q, "Revenue Growth").score).toBe(50); // 0.10 / 0.20
    expect(metric(q, "EPS Growth").score).toBe(50); // 0.125 / 0.25
    expect(metric(q, "Return on Equity").score).toBe(50); // 0.175 / 0.35
    expect(metric(q, "Return on Invested Capital").score).toBe(50); // 0.15 / 0.30
    expect(metric(q, "Gross Margin").score).toBe(50); // 0.30 / 0.60
    expect(metric(q, "Operating Margin").score).toBe(50); // 0.125 / 0.25
    expect(metric(q, "Net Margin").score).toBe(50); // 0.15 / 0.30
  });

  it("clamps every ratio-based metric to 100 even when the underlying fundamental exceeds its benchmark", () => {
    const q = analyzeInvestmentQuality(fixture({ revenueGrowth5y: 0.9, roe: 0.9 }));
    expect(metric(q, "Revenue Growth").score).toBe(100);
    expect(metric(q, "Return on Equity").score).toBe(100);
  });

  it("derives Free Cash Flow Growth as a CAGR from fcfHistory (oldest -> newest)", () => {
    const f = fixture({ fcfHistory: [6, 6.5, 7, 7.5, 8, 9] });
    const q = analyzeInvestmentQuality(f);
    const m = metric(q, "Free Cash Flow Growth");
    expect(m.availability).toBe("available");
    // (9/6)^(1/5) - 1
    const expectedGrowth = Math.pow(9 / 6, 1 / 5) - 1;
    expect(m.detail).toContain(`${(expectedGrowth * 100).toFixed(0)}%`);
    expect(m.score).toBe(Math.round(Math.min(100, Math.max(0, (expectedGrowth / 0.2) * 100)) * 10) / 10);
  });

  it("honestly reports Free Cash Flow Growth UNAVAILABLE (never fabricates) when either endpoint of the history is not positive", () => {
    const negativeStart = analyzeInvestmentQuality(fixture({ fcfHistory: [-1, 2, 3, 4, 5, 6] }));
    const negativeEnd = analyzeInvestmentQuality(fixture({ fcfHistory: [1, 2, 3, 4, 5, -6] }));
    for (const q of [negativeStart, negativeEnd]) {
      const m = metric(q, "Free Cash Flow Growth");
      expect(m.availability).toBe("unavailable");
      expect(m.score).toBeNull();
      expect(m.reason).toMatch(/not positive/i);
    }
  });

  it("Debt Levels and Cash Position reuse valueInvesting.ts's exact leverage/coverage/net-cash formulas", () => {
    const f = fixture({ debtToEquity: 0.6, interestCoverage: 10, netCashPerShare: -3 });
    const q = analyzeInvestmentQuality(f);
    const expectedDebt = Math.round((leverageScore(f) * (5 / 9) + coverageScore(f) * (4 / 9)) * 10) / 10;
    expect(metric(q, "Debt Levels").score).toBe(expectedDebt);
    const expectedCash = Math.round(cashPositionScore(f) * 10) / 10;
    expect(metric(q, "Cash Position").score).toBe(expectedCash);
  });

  it("reports Share Dilution/Buybacks and Insider Ownership UNAVAILABLE when the provider supplies no data — never fabricated", () => {
    const q = analyzeInvestmentQuality(fixture());
    const dilution = metric(q, "Share Dilution / Buybacks");
    const insider = metric(q, "Insider Ownership");
    expect(dilution.availability).toBe("unavailable");
    expect(dilution.score).toBeNull();
    expect(dilution.reason).toMatch(/share-count history/i);
    expect(insider.availability).toBe("unavailable");
    expect(insider.score).toBeNull();
    expect(insider.reason).toMatch(/insider-ownership data/i);
  });

  // Phase 2, Sprint 24 — Share Dilution/Buybacks and Insider Ownership are
  // scored when the provider supplies real data (currently SIMULATED always;
  // FMP for sharesOutstandingChange5y only; never fabricated otherwise).
  it("scores Share Dilution/Buybacks when sharesOutstandingChange5y is supplied — buybacks (negative) score higher than dilution (positive)", () => {
    const buyback = analyzeInvestmentQuality(fixture({ sharesOutstandingChange5y: -0.15 }));
    const dilutive = analyzeInvestmentQuality(fixture({ sharesOutstandingChange5y: 0.2 }));
    const buybackMetric = metric(buyback, "Share Dilution / Buybacks");
    const dilutiveMetric = metric(dilutive, "Share Dilution / Buybacks");
    expect(buybackMetric.availability).toBe("available");
    expect(buybackMetric.score).toBe(100);
    expect(buybackMetric.detail).toMatch(/buyback/i);
    expect(dilutiveMetric.availability).toBe("available");
    expect(dilutiveMetric.score).toBe(0);
    expect(dilutiveMetric.detail).toMatch(/dilution/i);
    expect(buybackMetric.score!).toBeGreaterThan(dilutiveMetric.score!);
  });

  it("scores Insider Ownership when insiderOwnershipPct is supplied, ramped against a 20% benchmark", () => {
    const q = analyzeInvestmentQuality(fixture({ insiderOwnershipPct: 0.1 }));
    const m = metric(q, "Insider Ownership");
    expect(m.availability).toBe("available");
    expect(m.score).toBe(50); // 0.10 / 0.20
    expect(m.detail).toMatch(/10\.0% of shares held by insiders/);
  });

  it("computes the overall score as a weighted average over ONLY the available metrics, renormalized", () => {
    const q = analyzeInvestmentQuality(fixture());
    const available = q.metrics.filter((m) => m.availability === "available" && m.score != null);
    const totalWeight = available.reduce((a, m) => a + m.weight, 0);
    const expected = Math.round(
      (available.reduce((a, m) => a + (m.score as number) * m.weight, 0) / totalWeight) * 10,
    ) / 10;
    expect(q.score).toBe(expected);
    expect(q.score).toBeGreaterThan(0);
    expect(q.score).toBeLessThanOrEqual(100);
  });

  it("reports Moderate confidence for every company today (10 of 12 metrics available), by design", () => {
    const strong = analyzeInvestmentQuality(fixture({ revenueGrowth5y: 0.3, epsGrowth5y: 0.3, roe: 0.4, roic: 0.35 }));
    const weak = analyzeInvestmentQuality(fixture({ revenueGrowth5y: 0.01, epsGrowth5y: 0.01, roe: 0.02, roic: 0.02 }));
    expect(strong.confidenceLevel).toBe("Moderate");
    expect(weak.confidenceLevel).toBe("Moderate");
    expect(strong.confidenceExplanation).toMatch(/10 of 12/);
    expect(strong.confidenceExplanation).toMatch(/Share Dilution \/ Buybacks/);
    expect(strong.confidenceExplanation).toMatch(/Insider Ownership/);
  });

  it("rises to High confidence once all 12 metrics have usable data (Sprint 24's two new fields supplied)", () => {
    const q = analyzeInvestmentQuality(fixture({ sharesOutstandingChange5y: -0.05, insiderOwnershipPct: 0.08 }));
    expect(q.metrics.every((m) => m.availability === "available")).toBe(true);
    expect(q.confidenceLevel).toBe("High");
    expect(q.confidenceExplanation).toMatch(/All 12 quality metrics/);
  });

  it("drops to Low confidence when FCF Growth is also unavailable (9 of 12)", () => {
    const q = analyzeInvestmentQuality(fixture({ fcfHistory: [-1, -1, -1, -1, -1, -1] }));
    expect(q.confidenceLevel).toBe("Low");
  });

  it("derives strengths from high-scoring available metrics, never from the unavailable ones", () => {
    const q = analyzeInvestmentQuality(fixture({ roic: 0.3, roe: 0.35 }));
    expect(q.strengths.length).toBeGreaterThan(0);
    for (const s of q.strengths) {
      expect(s).not.toMatch(/Dilution|Insider/);
    }
  });

  it("derives weaknesses from low-scoring available metrics, worst first", () => {
    const q = analyzeInvestmentQuality(fixture({ revenueGrowth5y: 0, epsGrowth5y: 0.3, roe: 0.35, roic: 0.3 }));
    expect(q.weaknesses.length).toBeGreaterThan(0);
    expect(q.weaknesses[0]).toMatch(/Revenue Growth/);
  });

  it("adds an ETF caveat to the summary for ETF-kind fundamentals, not for stocks", () => {
    const stock = analyzeInvestmentQuality(fixture({ kind: "stock" }));
    const etf = analyzeInvestmentQuality(fixture({ kind: "etf" }));
    expect(stock.summary).not.toMatch(/diversified fund/i);
    expect(etf.summary).toMatch(/diversified fund/i);
  });

  it("never claims to fabricate or execute anything", () => {
    const q = analyzeInvestmentQuality(fixture());
    const serialized = JSON.stringify(q);
    expect(serialized).not.toContain("order");
    expect(serialized).not.toContain("execute");
  });
});
