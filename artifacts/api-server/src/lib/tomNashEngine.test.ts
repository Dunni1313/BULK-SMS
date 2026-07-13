// Phase 2, Sprint 16 — Tom Nash Investment Engine (Core) unit tests (approved
// Phase 2 plan, Sprint 16).

import { describe, it, expect } from "vitest";
import { analyzeTomNash } from "./tomNashEngine.js";
import type { Fundamentals } from "./fundamentals.js";
import type { FinancialStrength, Valuation } from "./valueInvesting.js";
import type { InvestmentQualityAnalysis, QualityMetricScore } from "./investmentQuality.js";
import type { GrahamValuation } from "./grahamValuation.js";
import type { DcfValuation } from "./dcfValuation.js";
import type { BuffettValuation } from "./buffettValuation.js";

function fixtureFundamentals(overrides: Partial<Fundamentals> = {}): Fundamentals {
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

function metric(overrides: Partial<QualityMetricScore>): QualityMetricScore {
  return { metric: "X", availability: "available", score: 70, weight: 0.1, detail: "detail", ...overrides };
}

function fixtureIq(overrides: Partial<InvestmentQualityAnalysis> = {}, metricOverrides: Record<string, Partial<QualityMetricScore>> = {}): InvestmentQualityAnalysis {
  const names = [
    "Revenue Growth", "EPS Growth", "Free Cash Flow Growth", "Return on Equity",
    "Return on Invested Capital", "Gross Margin", "Operating Margin", "Net Margin",
    "Debt Levels", "Cash Position", "Share Dilution / Buybacks", "Insider Ownership",
  ];
  const metrics = names.map((n) =>
    metric({
      metric: n,
      ...(n === "Share Dilution / Buybacks" || n === "Insider Ownership"
        ? { availability: "unavailable" as const, score: null, reason: "unavailable" }
        : {}),
      ...(metricOverrides[n] ?? {}),
    }),
  );
  return {
    score: 72,
    metrics,
    strengths: [],
    weaknesses: [],
    confidenceLevel: "Moderate",
    confidenceExplanation: "10 of 12 quality metrics have usable data.",
    summary: "TEST scores 72/100 on investment quality.",
    ...overrides,
  };
}

function fixtureFin(overrides: Partial<FinancialStrength> = {}): FinancialStrength {
  return {
    rating: "Strong",
    score: 80,
    metrics: [],
    flags: [],
    summary: "TEST balance sheet rates Strong (80/100).",
    ...overrides,
  };
}

function fixtureBlended(overrides: Partial<Extract<Valuation, { available: true }>> = {}): Valuation {
  return {
    available: true,
    dataSource: "SIMULATED",
    price: 150,
    fairValue: 180,
    fairValueLow: 160,
    fairValueHigh: 200,
    methods: [],
    marginOfSafety: 0.1667,
    marginOfSafetyLabel: "Medium",
    rating: "Cheap",
    summary: "Trades below fair value.",
    ...overrides,
  };
}

function fixtureGraham(overrides: Partial<Extract<GrahamValuation, { available: true }>> = {}): GrahamValuation {
  return {
    available: true,
    price: 150,
    summary: "Trades below Graham fair value.",
    grahamNumber: 200,
    growthFormulaValue: 210,
    fairValue: 205,
    methods: [],
    marginOfSafety: 0.2683,
    marginOfSafetyLabel: "High",
    rating: "Cheap",
    ...overrides,
  };
}

function fixtureDcf(overrides: Partial<Extract<DcfValuation, { available: true }>> = {}): DcfValuation {
  return {
    available: true,
    price: 150,
    discountRate: 0.09,
    terminalGrowthRate: 0.025,
    summary: "Trades below DCF fair value.",
    projectionYears: 5,
    projectedFreeCashFlows: [10, 11, 12, 13, 14],
    terminalValue: 200,
    fairValue: 190,
    methods: [],
    marginOfSafety: 0.2105,
    marginOfSafetyLabel: "High",
    rating: "Cheap",
    confidenceLabel: "Moderate",
    confidenceExplanation: "Moderately sensitive to assumptions.",
    ...overrides,
  };
}

function fixtureBuffett(overrides: Partial<Extract<BuffettValuation, { available: true }>> = {}): BuffettValuation {
  return {
    available: true,
    price: 150,
    ownerEarnings: 9,
    requiredReturn: 0.07,
    fairValue: 128.57,
    methods: [],
    marginOfSafety: -0.1667,
    marginOfSafetyLabel: "None",
    rating: "Fair",
    summary: "Trades near Buffett fair value.",
    ...overrides,
  };
}

describe("analyzeTomNash", () => {
  it("Business Quality pillar reuses the Investment Quality Engine's overall score directly", () => {
    const iq = fixtureIq({ score: 83 });
    const t = analyzeTomNash(fixtureFundamentals(), iq, fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett());
    expect(t.businessQuality.score).toBe(83);
    expect(t.businessQuality.detail).toBe(iq.summary);
  });

  it("Growth pillar averages Revenue/EPS/FCF Growth metrics from Investment Quality, renormalized", () => {
    const iq = fixtureIq({}, {
      "Revenue Growth": { score: 60, weight: 0.1 },
      "EPS Growth": { score: 80, weight: 0.1 },
      "Free Cash Flow Growth": { score: 100, weight: 0.1 },
    });
    const t = analyzeTomNash(fixtureFundamentals(), iq, fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett());
    // equal weights -> simple average: (60+80+100)/3 = 80
    expect(t.growth.score).toBe(80);
  });

  it("Growth pillar excludes Free Cash Flow Growth from the average when it is unavailable, never fabricating a number", () => {
    const iq = fixtureIq({}, {
      "Revenue Growth": { score: 60, weight: 0.1 },
      "EPS Growth": { score: 80, weight: 0.1 },
      "Free Cash Flow Growth": { availability: "unavailable", score: null, reason: "not positive" },
    });
    const t = analyzeTomNash(fixtureFundamentals(), iq, fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett());
    expect(t.growth.score).toBe(70); // (60+80)/2
    expect(t.growth.detail).toMatch(/Free Cash Flow Growth unavailable/);
  });

  it("Capital Allocation pillar averages Cash Position / Debt Levels / ROIC-as-capital-efficiency, excluding Share Dilution/Buybacks from the number but showing it as unavailable", () => {
    const iq = fixtureIq({}, {
      "Cash Position": { score: 90, weight: 0.08 },
      "Debt Levels": { score: 70, weight: 0.1 },
      "Return on Invested Capital": { score: 50, weight: 0.12 },
    });
    const t = analyzeTomNash(fixtureFundamentals(), iq, fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett());
    const expected = Math.round(((90 * 0.08 + 70 * 0.1 + 50 * 0.12) / (0.08 + 0.1 + 0.12)) * 10) / 10;
    expect(t.capitalAllocation.score).toBe(expected);
    expect(t.capitalAllocation.detail).toMatch(/Share Dilution\/Buybacks unavailable/);
  });

  it("Financial Strength pillar directly reuses analyzeFinancialStrength's own score, unmodified", () => {
    const fin = fixtureFin({ score: 91, rating: "Strong" });
    const t = analyzeTomNash(fixtureFundamentals(), fixtureIq(), fin, fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett());
    expect(t.financialStrength.score).toBe(91);
  });

  it("Valuation pillar maps each available model's rating through the bucket table and averages", () => {
    const t = analyzeTomNash(
      fixtureFundamentals(),
      fixtureIq(),
      fixtureFin(),
      fixtureBlended({ rating: "Cheap" }),
      fixtureGraham({ rating: "Fair" }),
      fixtureDcf({ rating: "Expensive" }),
      fixtureBuffett({ rating: "Very Expensive" }),
    );
    // (100 + 65 + 35 + 0) / 4 = 50
    expect(t.valuation.score).toBe(50);
  });

  it("Valuation pillar excludes unavailable models from the average, never fabricating their rating", () => {
    const unavailableGraham: GrahamValuation = { available: false, price: 150, reason: "no positive trailing EPS", summary: "unavailable" };
    const t = analyzeTomNash(
      fixtureFundamentals(),
      fixtureIq(),
      fixtureFin(),
      fixtureBlended({ rating: "Cheap" }),
      unavailableGraham,
      fixtureDcf({ rating: "Cheap" }),
      fixtureBuffett({ rating: "Cheap" }),
    );
    expect(t.valuation.score).toBe(100); // average of the 3 available Cheap ratings only
  });

  it("Valuation pillar honestly reports unavailable (never fabricates) when all 4 models are unavailable", () => {
    const unavailableBlended: Valuation = { available: false, dataSource: "SIMULATED", price: 150, reason: "n/a", summary: "unavailable" };
    const unavailableGraham: GrahamValuation = { available: false, price: 150, reason: "n/a", summary: "unavailable" };
    const unavailableDcf: DcfValuation = { available: false, price: 150, discountRate: 0.09, terminalGrowthRate: 0.025, reason: "n/a", summary: "unavailable" };
    const unavailableBuffett: BuffettValuation = { available: false, price: 150, requiredReturn: 0.07, reason: "n/a", summary: "unavailable" };
    const t = analyzeTomNash(
      fixtureFundamentals(),
      fixtureIq(),
      fixtureFin(),
      unavailableBlended,
      unavailableGraham,
      unavailableDcf,
      unavailableBuffett,
    );
    expect(t.valuation.score).toBeNull();
    expect(t.valuation.detail).toMatch(/unavailable/i);
    // conviction score still computes from the other 4 pillars, renormalized
    expect(t.convictionScore).toBeGreaterThan(0);
  });

  it("computes the conviction score as an equal-weighted average across all 5 pillars when all are available", () => {
    const iq = fixtureIq({ score: 80 }, {
      "Revenue Growth": { score: 80 }, "EPS Growth": { score: 80 }, "Free Cash Flow Growth": { score: 80 },
      "Cash Position": { score: 80 }, "Debt Levels": { score: 80 }, "Return on Invested Capital": { score: 80 },
    });
    const t = analyzeTomNash(
      fixtureFundamentals(),
      iq,
      fixtureFin({ score: 80 }),
      fixtureBlended({ rating: "Cheap" }), // 100
      fixtureGraham({ rating: "Cheap" }), // 100
      fixtureDcf({ rating: "Cheap" }), // 100
      fixtureBuffett({ rating: "Cheap" }), // 100 -> valuation pillar = 100
    );
    // (80 + 80 + 80 + 80 + 100) / 5 = 84
    expect(t.convictionScore).toBe(84);
  });

  it("derives Buy/Hold/Wait from the approved thresholds (>=70 Buy, 45-69 Hold, <45 Wait)", () => {
    const strongIq = fixtureIq({ score: 95 }, {
      "Revenue Growth": { score: 95 }, "EPS Growth": { score: 95 }, "Free Cash Flow Growth": { score: 95 },
      "Cash Position": { score: 95 }, "Debt Levels": { score: 95 }, "Return on Invested Capital": { score: 95 },
    });
    const buy = analyzeTomNash(fixtureFundamentals(), strongIq, fixtureFin({ score: 95 }), fixtureBlended({ rating: "Cheap" }), fixtureGraham({ rating: "Cheap" }), fixtureDcf({ rating: "Cheap" }), fixtureBuffett({ rating: "Cheap" }));
    expect(buy.convictionScore).toBeGreaterThanOrEqual(70);
    expect(buy.verdict).toBe("Buy");

    const weakIq = fixtureIq({ score: 10 }, {
      "Revenue Growth": { score: 10 }, "EPS Growth": { score: 10 }, "Free Cash Flow Growth": { score: 10 },
      "Cash Position": { score: 10 }, "Debt Levels": { score: 10 }, "Return on Invested Capital": { score: 10 },
    });
    const wait = analyzeTomNash(fixtureFundamentals(), weakIq, fixtureFin({ score: 10 }), fixtureBlended({ rating: "Very Expensive" }), fixtureGraham({ rating: "Very Expensive" }), fixtureDcf({ rating: "Very Expensive" }), fixtureBuffett({ rating: "Very Expensive" }));
    expect(wait.convictionScore).toBeLessThan(45);
    expect(wait.verdict).toBe("Wait");
  });

  it("never pulls Insider Ownership into any pillar (explicitly out of scope for Sprint 16)", () => {
    const t = analyzeTomNash(fixtureFundamentals(), fixtureIq(), fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett());
    const serialized = JSON.stringify(t);
    expect(serialized).not.toMatch(/Insider Ownership/);
  });

  it("adds an ETF caveat to the summary for ETF-kind fundamentals, not for stocks", () => {
    const stock = analyzeTomNash(fixtureFundamentals({ kind: "stock" }), fixtureIq(), fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett());
    const etf = analyzeTomNash(fixtureFundamentals({ kind: "etf" }), fixtureIq(), fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett());
    expect(stock.summary).not.toMatch(/diversified fund/i);
    expect(etf.summary).toMatch(/diversified fund/i);
  });

  it("never claims to fabricate or execute anything", () => {
    const t = analyzeTomNash(fixtureFundamentals(), fixtureIq(), fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett());
    const serialized = JSON.stringify(t);
    expect(serialized).not.toContain("order");
    expect(serialized).not.toContain("execute");
  });
});
