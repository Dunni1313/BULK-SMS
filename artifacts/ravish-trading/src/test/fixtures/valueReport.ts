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
    grahamValuation: {
      available: true,
      price: 210.5,
      summary: "Trades below the Graham fair-value estimate.",
      grahamNumber: 230.5,
      growthFormulaValue: 245.2,
      fairValue: 237.85,
      methods: [
        { method: "Graham Number", fairValue: 230.5, detail: "sqrt(22.5 x EPS x book value/share)" },
        { method: "Graham Growth Formula", fairValue: 245.2, detail: "EPS x (8.5 + 2g) x 4.4/Y" },
      ],
      marginOfSafety: 0.115,
      marginOfSafetyLabel: ValueValuationMarginOfSafetyLabel.Low,
      rating: ValueValuationRating.Fair,
    },
    dcfValuation: {
      available: true,
      price: 210.5,
      discountRate: 0.09,
      terminalGrowthRate: 0.025,
      summary: "Trades below the DCF fair-value estimate.",
      projectionYears: 5,
      projectedFreeCashFlows: [12.1, 12.9, 13.6, 14.2, 14.6],
      terminalValue: 245.3,
      fairValue: 228.4,
      methods: [
        { method: "Projected Cash Flows", fairValue: 58.2, detail: "Present value of 5-yr FCF projection." },
        { method: "Terminal Value", fairValue: 170.2, detail: "Gordon-growth terminal value, discounted back 5 yrs." },
      ],
      marginOfSafety: 0.078,
      marginOfSafetyLabel: ValueValuationMarginOfSafetyLabel.Low,
      rating: ValueValuationRating.Fair,
      confidenceLabel: "Moderate",
      confidenceExplanation: "Fair value is moderately sensitive to the discount-rate/terminal-growth assumptions.",
    },
    buffettValuation: {
      available: true,
      price: 210.5,
      requiredReturn: 0.07,
      summary: "Trades below the Buffett fair-value estimate.",
      ownerEarnings: 14,
      fairValue: 200,
      methods: [
        { method: "Owner Earnings Perpetuity", fairValue: 200, detail: "$14.00 owner earnings / 7.0% required return." },
      ],
      marginOfSafety: -0.053,
      marginOfSafetyLabel: ValueValuationMarginOfSafetyLabel.None,
      rating: ValueValuationRating.Fair,
    },
    consolidatedMarginOfSafety: {
      price: 210.5,
      modelsConsidered: 4,
      modelsAvailable: 4,
      fairValues: [
        { model: "Blended", fairValue: 240 },
        { model: "Graham", fairValue: 237.85 },
        { model: "DCF", fairValue: 228.4 },
        { model: "Buffett", fairValue: 200 },
      ],
      minFairValue: 200,
      maxFairValue: 240,
      averageFairValue: 226.56,
      averageMarginOfSafety: 0.064,
      agreement: "majority",
      summary: "4 of 4 valuation models produced a usable fair-value estimate, ranging $200.00-$240.00 (average $226.56) against a $210.50 price; most available models agree, though not all.",
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
