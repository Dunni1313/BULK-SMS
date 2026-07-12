import {
  type ValueResearchReport,
  ValueResearchReportKind,
  ValueBusinessQualityRating,
  ValueMoatAnalysisRating,
  ValueFinancialStrengthRating,
  ValueValuationRating,
  ValueValuationMarginOfSafetyLabel,
  ValueDecisionVerdict,
  ValueStockVsOptionsVerdict,
  ValueRiskFlagSeverity,
} from "@workspace/api-client-react";

export function makeValueReport(
  overrides: Partial<ValueResearchReport> = {},
): ValueResearchReport {
  return {
    symbol: "AAPL",
    name: "Apple Inc.",
    kind: ValueResearchReportKind.stock,
    asOf: "2026-06-15T00:00:00.000Z",
    fetchedAt: "2026-06-15T00:00:00.000Z",
    dataSource: "Simulated fundamentals",
    simulated: true,
    price: 210.5,
    businessQuality: {
      score: 88,
      rating: ValueBusinessQualityRating.Wonderful,
      summary: "Best-in-class brand with durable consumer pull.",
      factors: [
        { label: "Returns on capital", score: 90, detail: "Consistently high ROIC." },
        { label: "Revenue stability", score: 82, detail: "Recurring services revenue." },
      ],
    },
    moat: {
      rating: ValueMoatAnalysisRating.Wide,
      score: 85,
      durabilityYears: 12,
      summary: "Ecosystem lock-in and switching costs.",
      sources: [
        { source: "Switching costs", strength: 80 },
        { source: "Brand", strength: 88 },
      ],
    },
    financialStrength: {
      rating: ValueFinancialStrengthRating.Strong,
      score: 84,
      summary: "Fortress balance sheet with large cash buffer.",
      metrics: [{ label: "Net debt / EBITDA", score: 90, detail: "Negative net debt." }],
      flags: [],
    },
    valuation: {
      available: true,
      dataSource: "Simulated DCF",
      price: 210.5,
      summary: "Trades near a modest discount to fair value.",
      fairValue: 240,
      fairValueLow: 215,
      fairValueHigh: 265,
      methods: [{ method: "DCF", fairValue: 240, detail: "10% discount rate." }],
      marginOfSafety: 0.14,
      marginOfSafetyLabel: ValueValuationMarginOfSafetyLabel.Medium,
      rating: ValueValuationRating.Fair,
    },
    decision: {
      verdict: ValueDecisionVerdict.BUY_ONLY_ON_PULLBACK,
      conviction: 72,
      summary: "High-quality compounder; wait for a wider margin of safety.",
      rationale: ["Wide moat", "Strong balance sheet"],
    },
    stockVsOptions: {
      verdict: ValueStockVsOptionsVerdict.Both,
      ivRank: 35,
      stockCase: "Own for long-term compounding.",
      optionsCase: "Sell puts to enter cheaper.",
      summary: "Suitable for both long-term holding and income.",
    },
    keyMetrics: [
      { label: "P/E", value: "28.4" },
      { label: "Dividend yield", value: "0.5%" },
    ],
    risks: [
      { severity: ValueRiskFlagSeverity.medium, text: "Hardware revenue concentration." },
    ],
    sections: [
      {
        id: "thesis",
        title: "Investment thesis",
        body: "Apple remains a wide-moat compounder.",
        bullets: ["Loyal customer base", "Growing services mix"],
      },
    ],
    disclaimer: "SIMULATED — educational only. Not investment advice.",
    ...overrides,
  };
}

export function makeUnavailableValuationReport(
  overrides: Partial<ValueResearchReport> = {},
): ValueResearchReport {
  const base = makeValueReport(overrides);
  return {
    ...base,
    valuation: {
      available: false,
      dataSource: "Simulated fundamentals",
      price: base.price,
      summary: "Fair value could not be estimated.",
      reason: "No reliable earnings to anchor a valuation.",
    },
    ...overrides,
  };
}
