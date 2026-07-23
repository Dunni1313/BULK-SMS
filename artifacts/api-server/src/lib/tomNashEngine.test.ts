// Phase 2, Sprint 16 — Tom Nash Investment Engine (Core) unit tests (approved
// Phase 2 plan, Sprint 16).

import { describe, it, expect } from "vitest";
import { analyzeTomNash } from "./tomNashEngine.js";
import type { MacroContext } from "./investingMacro.js";
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

  it("Capital Allocation pillar averages Cash Position / Debt Levels / ROIC-as-capital-efficiency, excluding Share Dilution/Buybacks and Insider Ownership from the number when they're unavailable but showing both as unavailable", () => {
    const iq = fixtureIq({}, {
      "Cash Position": { score: 90, weight: 0.08 },
      "Debt Levels": { score: 70, weight: 0.1 },
      "Return on Invested Capital": { score: 50, weight: 0.12 },
    });
    const t = analyzeTomNash(fixtureFundamentals(), iq, fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett());
    const expected = Math.round(((90 * 0.08 + 70 * 0.1 + 50 * 0.12) / (0.08 + 0.1 + 0.12)) * 10) / 10;
    expect(t.capitalAllocation.score).toBe(expected);
    expect(t.capitalAllocation.detail).toMatch(/Share Dilution\/Buybacks unavailable/);
    expect(t.capitalAllocation.detail).toMatch(/Insider Ownership unavailable/);
  });

  // Phase 2, Sprint 24 — extends the Sprint 16 3-metric average to include
  // Share Dilution/Buybacks and Insider Ownership once Investment Quality can
  // score them (still renormalized, still excluding whichever remain
  // unavailable — never fabricated).
  it("Capital Allocation pillar includes Share Dilution/Buybacks and Insider Ownership in the average once available (Sprint 24)", () => {
    const iq = fixtureIq({}, {
      "Cash Position": { score: 90, weight: 0.08 },
      "Debt Levels": { score: 70, weight: 0.1 },
      "Return on Invested Capital": { score: 50, weight: 0.12 },
      "Share Dilution / Buybacks": { availability: "available", score: 100, weight: 0.05, reason: undefined },
      "Insider Ownership": { availability: "available", score: 40, weight: 0.05, reason: undefined },
    });
    const t = analyzeTomNash(fixtureFundamentals(), iq, fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett());
    const expected = Math.round(
      ((90 * 0.08 + 70 * 0.1 + 50 * 0.12 + 100 * 0.05 + 40 * 0.05) / (0.08 + 0.1 + 0.12 + 0.05 + 0.05)) * 10,
    ) / 10;
    expect(t.capitalAllocation.score).toBe(expected);
    expect(t.capitalAllocation.detail).toMatch(/Share Dilution\/Buybacks 100\/100/);
    expect(t.capitalAllocation.detail).toMatch(/Insider Ownership 40\/100/);
  });

  it("Capital Allocation pillar surfaces netInsiderActivity as descriptive text only, never scored on its own", () => {
    const buying = analyzeTomNash(
      fixtureFundamentals({ netInsiderActivity: "buying" }),
      fixtureIq(),
      fixtureFin(),
      fixtureBlended(),
      fixtureGraham(),
      fixtureDcf(),
      fixtureBuffett(),
    );
    const none = analyzeTomNash(fixtureFundamentals(), fixtureIq(), fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett());
    expect(buying.capitalAllocation.detail).toMatch(/recent aggregate insider activity: buying/);
    expect(none.capitalAllocation.detail).not.toMatch(/recent aggregate insider activity/);
    // Descriptive text only — the numeric score is unaffected by netInsiderActivity.
    expect(buying.capitalAllocation.score).toBe(none.capitalAllocation.score);
  });

  it("Capital Allocation pillar's score is byte-identical to the pre-Sprint-24 3-metric formula whenever Share Dilution/Buybacks and Insider Ownership remain unavailable", () => {
    const iq = fixtureIq({}, {
      "Cash Position": { score: 65, weight: 0.08 },
      "Debt Levels": { score: 55, weight: 0.1 },
      "Return on Invested Capital": { score: 45, weight: 0.12 },
    });
    const t = analyzeTomNash(fixtureFundamentals(), iq, fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett());
    const preSprint24 = Math.round(((65 * 0.08 + 55 * 0.1 + 45 * 0.12) / (0.08 + 0.1 + 0.12)) * 10) / 10;
    expect(t.capitalAllocation.score).toBe(preSprint24);
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

  // Phase 2, Sprint 24 deliberately changed this: Insider Ownership is now
  // surfaced (available or unavailable) in the Capital Allocation pillar's
  // detail, and averaged in when available — see the dedicated Sprint 24
  // tests above. It is still never scored anywhere outside that one pillar.
  it("only the Capital Allocation pillar ever references Insider Ownership — no other pillar does", () => {
    const t = analyzeTomNash(fixtureFundamentals(), fixtureIq(), fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett());
    expect(t.capitalAllocation.detail).toMatch(/Insider Ownership/);
    for (const pillar of [t.businessQuality, t.growth, t.financialStrength, t.valuation]) {
      expect(pillar.detail).not.toMatch(/Insider Ownership/);
    }
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

  // Phase 2, Sprint 26 (Tom Nash Enhancement II) — Sector & Macro, Interest
  // Rate Sensitivity, and AI/Tech-Cycle are all informational: they never
  // enter PILLAR_WEIGHTS/the conviction-score average.
  describe("Sprint 26 — Sector & Macro / Interest Rate Sensitivity / AI-Tech-Cycle (informational only)", () => {
    const risingMacro: MacroContext = { asOf: "2026-01-15", regime: "rising_rates", regimeLabel: "Rising-Rate Environment", rateTrendPct: 0.004, dataSource: "SIMULATED", summary: "s" };
    const fallingMacro: MacroContext = { asOf: "2026-01-15", regime: "falling_rates", regimeLabel: "Falling-Rate Environment", rateTrendPct: -0.004, dataSource: "SIMULATED", summary: "s" };
    const stableMacro: MacroContext = { asOf: "2026-01-15", regime: "stable_rates", regimeLabel: "Stable-Rate Environment", rateTrendPct: 0.0001, dataSource: "SIMULATED", summary: "s" };

    it("surfaces sector/industry from Fundamentals directly, zero new provider calls", () => {
      const t = analyzeTomNash(
        fixtureFundamentals({ sector: "Technology", industry: "Software" }),
        fixtureIq(), fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett(), stableMacro,
      );
      expect(t.sectorMacro.sector).toBe("Technology");
      expect(t.sectorMacro.industry).toBe("Software");
      expect(t.sectorMacro.detail).toMatch(/Technology/);
    });

    it("honestly reports sector unknown when Fundamentals.sector is null, never a guessed classification", () => {
      const t = analyzeTomNash(fixtureFundamentals({ sector: null }), fixtureIq(), fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett(), stableMacro);
      expect(t.sectorMacro.sector).toBeNull();
      expect(t.sectorMacro.detail).toMatch(/Unknown sector/);
    });

    it("classifies a high-growth, high-multiple, no-dividend company as Long-Duration Growth", () => {
      const t = analyzeTomNash(
        fixtureFundamentals({ revenueGrowth5y: 0.3, forwardPe: 45, dividendYield: 0, debtToEquity: 1.5 }),
        fixtureIq(), fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett(), stableMacro,
      );
      expect(t.rateSensitivity.classification).toBe("Long-Duration Growth");
    });

    it("classifies a low-growth, high-dividend, low-multiple company as Value / Short-Duration", () => {
      const t = analyzeTomNash(
        fixtureFundamentals({ revenueGrowth5y: 0, forwardPe: 8, dividendYield: 0.05, debtToEquity: 0 }),
        fixtureIq(), fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett(), stableMacro,
      );
      expect(t.rateSensitivity.classification).toBe("Value / Short-Duration");
    });

    it("labels a Long-Duration Growth company as highly sensitive in a rising-rate regime and a likely beneficiary in a falling-rate regime", () => {
      const growthF = fixtureFundamentals({ revenueGrowth5y: 0.3, forwardPe: 45, dividendYield: 0, debtToEquity: 1.5 });
      const rising = analyzeTomNash(growthF, fixtureIq(), fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett(), risingMacro);
      const falling = analyzeTomNash(growthF, fixtureIq(), fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett(), fallingMacro);
      expect(rising.rateSensitivity.sensitivityLabel).toMatch(/High sensitivity to rising rates/);
      expect(falling.rateSensitivity.sensitivityLabel).toMatch(/beneficiary of falling rates/);
    });

    it("scores AI/Tech-Cycle from qualitative IP strength/pricing power/recurring revenue plus margin/growth — never an LLM claim about the company's actual strategy", () => {
      const highTech = analyzeTomNash(
        fixtureFundamentals({ grossMargin: 0.7, revenueGrowth5y: 0.25, qualitative: { pricingPower: 90, brand: 50, customerLoyalty: 50, recurringRevenue: 90, scale: 50, switchingCost: 50, networkEffect: 50, ipStrength: 90, distribution: 50, regulatoryAdvantage: 50 } }),
        fixtureIq(), fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett(), stableMacro,
      );
      const lowTech = analyzeTomNash(
        fixtureFundamentals({ grossMargin: 0.15, revenueGrowth5y: 0.01, qualitative: { pricingPower: 10, brand: 50, customerLoyalty: 50, recurringRevenue: 10, scale: 50, switchingCost: 50, networkEffect: 50, ipStrength: 10, distribution: 50, regulatoryAdvantage: 50 } }),
        fixtureIq(), fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett(), stableMacro,
      );
      expect(highTech.aiTechCycle.label).toBe("High");
      expect(lowTech.aiTechCycle.label).toBe("Low");
      expect(highTech.aiTechCycle.score).toBeGreaterThan(lowTech.aiTechCycle.score);
      expect(highTech.aiTechCycle.detail).not.toMatch(/roadmap will|plans to launch/i);
    });

    it("the 3 new dimensions never change convictionScore/verdict for an otherwise-identical fixture", () => {
      const withSector = analyzeTomNash(fixtureFundamentals({ sector: "Technology", industry: "Software" }), fixtureIq(), fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett(), risingMacro);
      const withoutSector = analyzeTomNash(fixtureFundamentals({ sector: null, industry: null }), fixtureIq(), fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett(), fallingMacro);
      expect(withSector.convictionScore).toBe(withoutSector.convictionScore);
      expect(withSector.verdict).toBe(withoutSector.verdict);
    });

    it("dataCompleteness is 1 when sector is known (all 8 dimensions available)", () => {
      const t = analyzeTomNash(fixtureFundamentals({ sector: "Technology", industry: "Software" }), fixtureIq(), fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett(), stableMacro);
      expect(t.dataCompleteness).toBe(1);
    });

    it("dataCompleteness drops below 1 when sector is unknown, and further when a core pillar is also unavailable", () => {
      const noSector = analyzeTomNash(fixtureFundamentals({ sector: null, industry: null }), fixtureIq(), fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett(), stableMacro);
      expect(noSector.dataCompleteness).toBeLessThan(1);

      const unavailableValuation: Valuation = { available: false, dataSource: "SIMULATED", price: 150, reason: "n/a", summary: "unavailable" };
      const unavailableGraham: GrahamValuation = { available: false, price: 150, reason: "n/a", summary: "unavailable" };
      const unavailableDcf: DcfValuation = { available: false, price: 150, discountRate: 0.09, terminalGrowthRate: 0.025, reason: "n/a", summary: "unavailable" };
      const unavailableBuffett: BuffettValuation = { available: false, price: 150, requiredReturn: 0.07, reason: "n/a", summary: "unavailable" };
      const noSectorNoValuation = analyzeTomNash(
        fixtureFundamentals({ sector: null, industry: null }), fixtureIq(), fixtureFin(),
        unavailableValuation, unavailableGraham, unavailableDcf, unavailableBuffett, stableMacro,
      );
      expect(noSectorNoValuation.dataCompleteness).toBeLessThan(noSector.dataCompleteness);
    });

    it("appends 3 informational rationale lines that never affect the 5 scored pillars' own detail text", () => {
      const t = analyzeTomNash(fixtureFundamentals({ sector: "Technology", industry: "Software" }), fixtureIq(), fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett(), stableMacro);
      expect(t.rationale.some((r) => r.startsWith("Sector & Macro (informational):"))).toBe(true);
      expect(t.rationale.some((r) => r.startsWith("Interest Rate Sensitivity (informational):"))).toBe(true);
      expect(t.rationale.some((r) => r.startsWith("AI & Technology-Cycle (informational"))).toBe(true);
    });

    it("defaults macro to a deterministic proxy seeded by Fundamentals.asOf when omitted — two omitted calls with the same asOf are byte-identical", () => {
      const f = fixtureFundamentals({ sector: "Technology", industry: "Software" });
      const a = analyzeTomNash(f, fixtureIq(), fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett());
      const b = analyzeTomNash(f, fixtureIq(), fixtureFin(), fixtureBlended(), fixtureGraham(), fixtureDcf(), fixtureBuffett());
      expect(a).toEqual(b);
    });
  });
});
