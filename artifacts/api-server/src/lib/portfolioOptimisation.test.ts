// Phase 18 — Institutional Portfolio Optimisation Engine. Unit tests for the
// pure buildPortfolioOptimisation() function — no I/O, constructed fixtures
// only, matching the established "pure function tested against hand-built
// fixtures" precedent (investingRisk.test.ts, marginOfSafety.test.ts).
import { describe, it, expect } from "vitest";
import { buildPortfolioOptimisation, OPTIMISATION_DISCLAIMER } from "./portfolioOptimisation.js";
import type { PortfolioIntelligenceAnalysis, PortfolioHoldingIntelligence } from "./portfolioIntelligence.js";
import type { OpportunityRow } from "./opportunityDiscovery.js";

function blankRow(overrides: Partial<OpportunityRow> = {}): OpportunityRow {
  return {
    symbol: "X", name: "X Corp", kind: "stock", price: 100, sector: "Technology", industry: null,
    businessQualityScore: 50, businessQualityRating: "Average", investmentQualityScore: 50,
    moatRating: "None", moatScore: 0, competitiveAdvantageScore: null,
    financialStrengthRating: "Acceptable", financialStrengthScore: 50,
    valuationRating: "Fair", marginOfSafety: null,
    marketCap: null, revenueGrowth5y: 0, roic: 0, roe: 0, debtToEquity: 0, fcfMargin: 0, dividendYield: 0,
    investmentCommitteeVerdict: "Hold", investmentCommitteeConfidence: 50,
    tomNashConvictionScore: 50, tomNashVerdict: "Hold",
    decisionRecommendation: "Hold", rankScore: 50, rankExplanation: "x ranks 50/100.",
    dataSource: "SIMULATED", fetchedAt: new Date().toISOString(), simulated: true,
    ...overrides,
  };
}

function holdingIntel(symbol: string, weightPct: number | null): PortfolioHoldingIntelligence {
  return {
    symbol,
    weightPct,
    qualityScore: 50,
    capitalAllocationScore: 50,
    growthScore: 50,
    valuationRating: "Fair",
    committeeVerdict: "Hold",
    marketCapBand: "Large Cap",
    shares: null,
    avgCostBasis: null,
    currentPrice: null,
    costBasisValue: null,
    marketValue: null,
    unrealizedPnl: null,
    unrealizedPnlPct: null,
    dividendYield: null,
    dividendPerShare: null,
    estAnnualDividendIncome: null,
    suggestedShareDelta: null,
  };
}

function blankIntelligence(overrides: {
  holdings?: PortfolioHoldingIntelligence[];
  bySector?: { label: string; weightPct: number }[];
  cashAllocationPct?: number | null;
  sectorExposureCapBreached?: boolean;
  sectorExposureLargestSector?: string | null;
  sectorExposureLargestSectorWeightPct?: number | null;
} = {}): PortfolioIntelligenceAnalysis {
  return {
    qualityScore: { score: 62, label: "Average", detail: "detail" },
    capitalAllocationScore: { score: 58, label: "Average", detail: "detail" },
    diversificationScore: { score: 70, label: "Good", detail: "detail" },
    weightedMetrics: { roic: null, roe: null, grossMargin: null, operatingMargin: null, fcfYield: null, dividendYield: null, debtToEquity: null },
    allocation: {
      bySector: overrides.bySector ?? [],
      byIndustry: [],
      byMarketCapBand: [],
      byCountry: { available: false, reason: "no provider models country" },
      byCurrency: { available: false, reason: "no provider models currency" },
      growthValueMix: [],
      qualityMix: [],
      largestPositionPct: null,
      top10ExposurePct: null,
      cashAllocationPct: overrides.cashAllocationPct ?? null,
      cashAllocationNote: "note",
    },
    risk: {
      overall: { score: 55, label: "Moderate", detail: "detail" },
      concentration: { score: 60, label: "Moderate", detail: "detail", largestSymbol: null, largestSymbolWeightPct: null, capBreached: false },
      sectorExposure: {
        score: 60,
        label: "Moderate",
        detail: "detail",
        largestSector: overrides.sectorExposureLargestSector ?? null,
        largestSectorWeightPct: overrides.sectorExposureLargestSectorWeightPct ?? null,
        capBreached: overrides.sectorExposureCapBreached ?? false,
        breakdown: [],
        unclassifiedWeightPct: null,
      },
      cyclicality: { score: null, label: "Insufficient data", detail: "detail", portfolioBeta: null, coveragePct: null },
      cashRisk: { score: null, label: "Insufficient data", detail: "detail" },
      dividendDependence: { score: null, label: "Insufficient data", detail: "detail" },
      leverageExposure: { score: null, label: "Insufficient data", detail: "detail" },
      qualityDrift: { score: null, label: "Insufficient data", detail: "detail" },
      portfolioStability: { score: null, label: "Insufficient data", detail: "detail" },
    },
    income: { portfolioDividendYield: null, estAnnualDividendIncome: null },
    performance: { totalCostBasisValue: null, totalMarketValue: null, totalUnrealizedPnl: null, totalUnrealizedPnlPct: null, holdingsWithoutCostBasis: [] },
    holdings: overrides.holdings ?? [],
    unresolvedSymbols: [],
    summary: "summary",
  };
}

describe("buildPortfolioOptimisation", () => {
  it("classifies a Sell/Avoid-recommended holding as an Exit candidate", () => {
    const row = blankRow({ symbol: "WEAK", decisionRecommendation: "Sell", rankScore: 20 });
    const intelligence = blankIntelligence({ holdings: [holdingIntel("WEAK", 5)] });
    const result = buildPortfolioOptimisation(1, intelligence, [row], []);

    expect(result.exitCandidates).toHaveLength(1);
    expect(result.exitCandidates[0].symbol).toBe("WEAK");
    expect(result.trimCandidates).toHaveLength(0);
    expect(result.upgradeCandidates).toHaveLength(0);
    expect(result.positionQualityRanking[0].action).toBe("exit");
  });

  it("classifies a Reduce-recommended holding as a Trim candidate", () => {
    const row = blankRow({ symbol: "TRIMME", decisionRecommendation: "Reduce", rankScore: 40 });
    const intelligence = blankIntelligence({ holdings: [holdingIntel("TRIMME", 10)] });
    const result = buildPortfolioOptimisation(1, intelligence, [row], []);

    expect(result.trimCandidates).toHaveLength(1);
    expect(result.trimCandidates[0].symbol).toBe("TRIMME");
    expect(result.trimCandidates[0].reason).toContain("Reduce");
  });

  it("classifies a Hold-recommended holding above the single-symbol concentration cap as a Trim candidate, even with a strong rankScore", () => {
    const row = blankRow({ symbol: "BIG", decisionRecommendation: "Hold", rankScore: 80 });
    const intelligence = blankIntelligence({ holdings: [holdingIntel("BIG", 30)] });
    const result = buildPortfolioOptimisation(1, intelligence, [row], []);

    expect(result.trimCandidates).toHaveLength(1);
    expect(result.trimCandidates[0].reason).toContain("25%");
  });

  it("classifies a Hold-recommended holding whose sector breaches the sector concentration cap as a Trim candidate", () => {
    const row = blankRow({ symbol: "SECTORHEAVY", decisionRecommendation: "Hold", rankScore: 80, sector: "Technology" });
    const intelligence = blankIntelligence({
      holdings: [holdingIntel("SECTORHEAVY", 10)],
      sectorExposureCapBreached: true,
      sectorExposureLargestSector: "Technology",
      sectorExposureLargestSectorWeightPct: 45,
    });
    const result = buildPortfolioOptimisation(1, intelligence, [row], []);

    expect(result.trimCandidates).toHaveLength(1);
    expect(result.trimCandidates[0].reason).toContain("40%");
  });

  it("classifies a mediocre Hold as an Upgrade candidate only when a real, meaningfully-better same-sector alternative exists", () => {
    const heldRow = blankRow({ symbol: "MEDIOCRE", decisionRecommendation: "Hold", rankScore: 50, sector: "Technology" });
    const betterAlt = blankRow({ symbol: "BETTER", decisionRecommendation: "Buy", rankScore: 70, sector: "Technology" });
    const intelligence = blankIntelligence({ holdings: [holdingIntel("MEDIOCRE", 5)] });
    const result = buildPortfolioOptimisation(1, intelligence, [heldRow], [betterAlt]);

    expect(result.upgradeCandidates).toHaveLength(1);
    expect(result.upgradeCandidates[0].symbol).toBe("MEDIOCRE");
  });

  it("never classifies a mediocre Hold as Upgrade when no meaningfully-better alternative exists (gap below the threshold)", () => {
    const heldRow = blankRow({ symbol: "MEDIOCRE", decisionRecommendation: "Hold", rankScore: 50, sector: "Technology" });
    const almostAlt = blankRow({ symbol: "ALMOST", decisionRecommendation: "Buy", rankScore: 58, sector: "Technology" }); // gap of only 8, below the 15-point threshold
    const intelligence = blankIntelligence({ holdings: [holdingIntel("MEDIOCRE", 5)] });
    const result = buildPortfolioOptimisation(1, intelligence, [heldRow], [almostAlt]);

    expect(result.upgradeCandidates).toHaveLength(0);
    expect(result.positionQualityRanking[0].action).toBe("core");
  });

  it("classifies a strong Buy/Accumulate holding as Core, never a candidate for change", () => {
    const row = blankRow({ symbol: "STRONG", decisionRecommendation: "Buy", rankScore: 85 });
    const intelligence = blankIntelligence({ holdings: [holdingIntel("STRONG", 8)] });
    const result = buildPortfolioOptimisation(1, intelligence, [row], []);

    expect(result.exitCandidates).toHaveLength(0);
    expect(result.trimCandidates).toHaveLength(0);
    expect(result.upgradeCandidates).toHaveLength(0);
    expect(result.positionQualityRanking[0].action).toBe("core");
  });

  it("ranks Position Quality Ranking by the Decision Engine's own rankScore, descending", () => {
    const weak = blankRow({ symbol: "WEAK", rankScore: 30 });
    const strong = blankRow({ symbol: "STRONG", rankScore: 90 });
    const mid = blankRow({ symbol: "MID", rankScore: 60 });
    const intelligence = blankIntelligence({
      holdings: [holdingIntel("WEAK", 5), holdingIntel("STRONG", 5), holdingIntel("MID", 5)],
    });
    const result = buildPortfolioOptimisation(1, intelligence, [weak, strong, mid], []);

    expect(result.positionQualityRanking.map((p) => p.symbol)).toEqual(["STRONG", "MID", "WEAK"]);
  });

  it("finds same-sector Replacement Opportunities for a weak holding, reusing the wider universe's own Buy-rated, not-already-held rows", () => {
    const weak = blankRow({ symbol: "WEAK", decisionRecommendation: "Sell", rankScore: 20, sector: "Technology" });
    const sameSectorBuy = blankRow({ symbol: "REPL", decisionRecommendation: "Buy", rankScore: 80, sector: "Technology" });
    const differentSectorBuy = blankRow({ symbol: "OTHER", decisionRecommendation: "Buy", rankScore: 80, sector: "Healthcare" });
    const intelligence = blankIntelligence({ holdings: [holdingIntel("WEAK", 5)] });
    const result = buildPortfolioOptimisation(1, intelligence, [weak], [sameSectorBuy, differentSectorBuy]);

    expect(result.replacementOpportunities).toHaveLength(1);
    expect(result.replacementOpportunities[0].symbol).toBe("REPL");
    expect(result.replacementOpportunities[0].forSymbol).toBe("WEAK");
  });

  it("never suggests a replacement that is already held", () => {
    const weak = blankRow({ symbol: "WEAK", decisionRecommendation: "Sell", rankScore: 20, sector: "Technology" });
    const alreadyHeldBuy = blankRow({ symbol: "WEAK", decisionRecommendation: "Buy", rankScore: 80, sector: "Technology" });
    const intelligence = blankIntelligence({ holdings: [holdingIntel("WEAK", 5)] });
    const result = buildPortfolioOptimisation(1, intelligence, [weak], [alreadyHeldBuy]);

    expect(result.replacementOpportunities).toHaveLength(0);
  });

  it("surfaces Cash Deployment Suggestions only when cash allocation is meaningfully positive", () => {
    const held = blankRow({ symbol: "HELD", decisionRecommendation: "Buy", rankScore: 80 });
    const notHeld = blankRow({ symbol: "IDEA", decisionRecommendation: "Buy", rankScore: 75 });
    const withCash = blankIntelligence({ holdings: [holdingIntel("HELD", 90)], cashAllocationPct: 10 });
    const withoutCash = blankIntelligence({ holdings: [holdingIntel("HELD", 100)], cashAllocationPct: 0.5 });

    const resultWithCash = buildPortfolioOptimisation(1, withCash, [held], [notHeld]);
    const resultWithoutCash = buildPortfolioOptimisation(1, withoutCash, [held], [notHeld]);

    expect(resultWithCash.cashDeploymentSuggestions).toHaveLength(1);
    expect(resultWithCash.cashDeploymentSuggestions[0].symbol).toBe("IDEA");
    expect(resultWithCash.cashDeploymentSuggestions[0].forSymbol).toBeNull();
    expect(resultWithoutCash.cashDeploymentSuggestions).toHaveLength(0);
  });

  it("suggests reducing exposure via Capital Allocation Suggestions when Exit/Trim candidates exist, summing their real weights", () => {
    const exit = blankRow({ symbol: "EXIT", decisionRecommendation: "Sell", rankScore: 10 });
    const trim = blankRow({ symbol: "TRIM", decisionRecommendation: "Reduce", rankScore: 30 });
    const intelligence = blankIntelligence({ holdings: [holdingIntel("EXIT", 4), holdingIntel("TRIM", 6)] });
    const result = buildPortfolioOptimisation(1, intelligence, [exit, trim], []);

    const reduceSuggestion = result.capitalAllocationSuggestions.find((s) => s.action.includes("Reduce exposure"));
    expect(reduceSuggestion).toBeDefined();
    expect(reduceSuggestion!.detail).toContain("10.0%");
  });

  it("honestly reports no allocation changes suggested when everything is Core, within the concentration cap, and there is no meaningful cash", () => {
    const strong = blankRow({ symbol: "STRONG", decisionRecommendation: "Buy", rankScore: 90 });
    const intelligence = blankIntelligence({ holdings: [holdingIntel("STRONG", 20)], cashAllocationPct: 0 });
    const result = buildPortfolioOptimisation(1, intelligence, [strong], []);

    expect(result.capitalAllocationSuggestions).toHaveLength(1);
    expect(result.capitalAllocationSuggestions[0].action).toBe("No allocation changes suggested");
  });

  it("passes Portfolio Health, Concentration, and Diversification through unmodified from Portfolio Intelligence", () => {
    const row = blankRow({ symbol: "A" });
    const intelligence = blankIntelligence({ holdings: [holdingIntel("A", 5)], bySector: [{ label: "Technology", weightPct: 100 }] });
    const result = buildPortfolioOptimisation(1, intelligence, [row], []);

    expect(result.health.qualityScore).toBe(intelligence.qualityScore.score);
    expect(result.health.diversificationScore).toBe(intelligence.diversificationScore.score);
    expect(result.concentration).toEqual(intelligence.risk.concentration);
    expect(result.diversification.bySector).toEqual(intelligence.allocation.bySector);
  });

  it("every candidate's evidence quotes the Decision Engine's own already-written rankExplanation, never a new judgment", () => {
    const row = blankRow({ symbol: "WEAK", decisionRecommendation: "Sell", rankScore: 20, rankExplanation: "WEAK ranks with a synthesis score of 20/100." });
    const intelligence = blankIntelligence({ holdings: [holdingIntel("WEAK", 5)] });
    const result = buildPortfolioOptimisation(1, intelligence, [row], []);

    expect(result.exitCandidates[0].evidence.rankExplanation).toBe("WEAK ranks with a synthesis score of 20/100.");
    expect(result.exitCandidates[0].evidence.decisionEngineRecommendation).toBe("Sell");
    expect(result.exitCandidates[0].evidence.investmentCommitteeRecommendation).toBe(row.investmentCommitteeVerdict);
  });

  it("never predicts a price or forecasts a return anywhere in its candidate/evidence text (the disclaimer itself is exempt, since disclosing the invariant necessarily uses that vocabulary)", () => {
    const row = blankRow({ symbol: "WEAK", decisionRecommendation: "Sell", rankScore: 20 });
    const better = blankRow({ symbol: "REPL", decisionRecommendation: "Buy", rankScore: 80, sector: "Technology" });
    const intelligence = blankIntelligence({ holdings: [holdingIntel("WEAK", 5)], cashAllocationPct: 10 });
    const result = buildPortfolioOptimisation(1, intelligence, [row], [better]);
    const { disclaimer: _disclaimer, ...rest } = result;

    const allText = JSON.stringify(rest).toLowerCase();
    expect(allText).not.toMatch(/price target/);
    expect(allText).not.toMatch(/expected return/);
    expect(allText).not.toMatch(/forecast/);
    expect(allText).not.toMatch(/predict/);
  });

  it("carries the disclaimer disclosing this is deterministic reuse, never a new valuation model", () => {
    const intelligence = blankIntelligence();
    const result = buildPortfolioOptimisation(1, intelligence, [], []);
    expect(result.disclaimer).toBe(OPTIMISATION_DISCLAIMER);
    expect(result.disclaimer.toLowerCase()).toContain("never a new valuation model");
  });

  it("honestly returns empty candidate lists for a portfolio with no held rows", () => {
    const intelligence = blankIntelligence();
    const result = buildPortfolioOptimisation(1, intelligence, [], []);
    expect(result.positionQualityRanking).toEqual([]);
    expect(result.upgradeCandidates).toEqual([]);
    expect(result.trimCandidates).toEqual([]);
    expect(result.exitCandidates).toEqual([]);
    expect(result.replacementOpportunities).toEqual([]);
  });
});
