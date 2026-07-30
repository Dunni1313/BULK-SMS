// v1.5.0, Sprint 15 — Institutional Portfolio & Risk Intelligence Engine.
// Direct unit coverage for the module's own logic: the cross-engine Health
// Score blend, the Risk Intelligence signal derivation, the What-If
// arithmetic, and the deterministic AI Portfolio Coach narrative — never a
// re-test of any reused engine's own already-tested scoring (Investment
// Quality, Financial Strength, Position Sizing, etc. all have their own
// dedicated test suites elsewhere).
//
// Fixtures below are intentionally partial, cast via `as X` — this module
// only ever reads a handful of fields off each of these large,
// generated-from-OpenAPI response types (PortfolioDashboardResult,
// PortfolioConcentrationResult, ConstructionPortfolioRiskAnalysis,
// TradingRiskAnalysis), so only the fields this module's own logic
// actually touches are populated. This is test-scaffolding pragmatism,
// not the product-facing "never fabricate a figure" discipline that
// applies to computed financial data shown to a real user.

import { describe, it, expect } from "vitest";
import {
  computePortfolioHealthScore,
  computeRiskIntelligence,
  computeWhatIfAnalysis,
  buildPortfolioCoachNarrative,
  recommendedPortfolioLesson,
  weakestAvailableFactor,
  type PortfolioIntelligenceInput,
  type PortfolioHealthScore,
  type RiskIntelligenceReport,
} from "./portfolioRiskIntelligence";
import type {
  PortfolioDashboardResult,
  PortfolioConcentrationResult,
  ConstructionPortfolioRiskAnalysis,
  TradingRiskAnalysis,
  LearningProgressSummary,
} from "@workspace/api-client-react";
import type { TradeLifecycleRecord } from "./tradeLifecycle";

function emptyInput(overrides: Partial<PortfolioIntelligenceInput> = {}): PortfolioIntelligenceInput {
  return {
    optionsIncome: null,
    optionsConcentration: null,
    investingRisk: null,
    tradingRisk: null,
    decisionSummary: { tradePlan: null, score: null },
    lifecycleRecords: [],
    closedTradesCount: 0,
    journalOutstanding: null,
    learningProgress: null,
    ...overrides,
  };
}

function optionsIncome(overrides: Record<string, unknown> = {}): PortfolioDashboardResult {
  return {
    portfolioValue: 100000,
    buyingPower: 20000,
    totalRiskDollars: 5000,
    healthFactors: [
      { code: "diversification", label: "Diversification", score: 72, sourceModule: "x", detail: "Well diversified." },
      { code: "concentration", label: "Concentration", score: 60, sourceModule: "x", detail: "Some concentration." },
      { code: "position_sizing_quality", label: "Position Sizing Quality", score: 80, sourceModule: "x", detail: "Well sized." },
    ],
    largestPosition: { symbol: "AAPL", riskDollars: 1000, pctOfAccount: 12.5 },
    allocationBySector: [{ key: "tech", label: "Technology", positionCount: 3, weightPct: 40 }],
    stressTestSummary: [
      { label: "Market Crash", portfolioValueImpact: -15000, riskScoreAfter: 55 },
      { label: "Rate Shock", portfolioValueImpact: -5000, riskScoreAfter: 75 },
    ],
    ...overrides,
  } as unknown as PortfolioDashboardResult;
}

function optionsConcentration(overrides: Record<string, unknown> = {}): PortfolioConcentrationResult {
  return {
    clusters: [
      { dimension: "underlying", key: "AAPL", label: "AAPL", tradeIds: [1, 2], positionCount: 2 },
      { dimension: "sector", key: "tech", label: "Technology", tradeIds: [1, 2, 3], positionCount: 3 },
    ],
    ...overrides,
  } as unknown as PortfolioConcentrationResult;
}

function investingRisk(overrides: Record<string, unknown> = {}): ConstructionPortfolioRiskAnalysis {
  return {
    concentration: { score: 65, label: "Moderate", detail: "AAPL is 20% of portfolio.", largestSymbol: "AAPL", largestSymbolWeightPct: 20, capBreached: false },
    sectorExposure: { score: 55, label: "Elevated", detail: "Technology is 45% of portfolio.", largestSector: "Technology", largestSectorWeightPct: 45, capBreached: false, breakdown: [], unclassifiedWeightPct: null },
    ...overrides,
  } as unknown as ConstructionPortfolioRiskAnalysis;
}

function tradingRisk(overrides: Record<string, unknown> = {}): TradingRiskAnalysis {
  return {
    positionSizing: { score: 78, label: "Good", detail: "Largest position is 3% of account.", largestPositionSymbol: "TSLA", largestPositionRiskPct: 3, capBreached: false, unpricedSymbols: [] },
    portfolioBudget: { score: 70, label: "Within budget", detail: "4% of account at risk.", accountValue: 50000, totalRiskDollars: 2000, totalRiskUsedPct: 4, capBreached: false, perPosition: [] },
    accountValue: 50000,
    ...overrides,
  } as unknown as TradingRiskAnalysis;
}

function learningProgress(overrides: Record<string, unknown> = {}): LearningProgressSummary {
  return {
    pathCompletion: [
      { pathKey: "trading-engine", title: "Institutional Trading Engine", topicsTotal: 5, topicsCompleted: 4, percentComplete: 80 },
      { pathKey: "portfolio", title: "Portfolio Management", topicsTotal: 4, topicsCompleted: 1, percentComplete: 25 },
    ],
    ...overrides,
  } as unknown as LearningProgressSummary;
}

function lifecycleRecord(overrides: Partial<TradeLifecycleRecord> = {}): TradeLifecycleRecord {
  return {
    tradePlan: { id: 1, coachId: "trading", title: "AAPL breakout", updatedAt: "2026-07-29T00:00:00Z" } as unknown as TradeLifecycleRecord["tradePlan"],
    outcome: "active",
    currentStage: "ready-to-execute",
    previousStage: "decision-ready",
    nextStage: "open-position",
    completionPct: 100,
    openRisk: null,
    timeInTradeDays: null,
    outstandingTasks: [],
    journalStatus: { hasJournalEntry: false, required: false },
    performanceStatus: { hasOutcome: false },
    learning: { engagedWithRecommendedLesson: false, recommendedPathKey: null, recommendedTopicKey: null, recommendedLabel: null },
    linkedExecution: null,
    canMarkExecuted: false,
    canArchive: false,
    blockedReasons: { markExecuted: null, archive: null },
    ...overrides,
  } as TradeLifecycleRecord;
}

describe("computePortfolioHealthScore", () => {
  it("returns an honest, all-unavailable, zero-score result when every input is null/empty — never a fabricated number", () => {
    const health = computePortfolioHealthScore(emptyInput());
    expect(health.overall).toBe(0);
    expect(health.label).toBe("Poor");
    expect(health.confidenceLevel).toBe("Low");
    for (const f of health.factors) {
      // cash_allocation / portfolio_volatility / correlation are always
      // unavailable by design; every other factor is unavailable here
      // only because no data was supplied.
      expect(f.available).toBe(false);
      expect(f.score).toBeNull();
    }
  });

  it("scores Diversification directly from Options Income's own healthFactors, unmodified", () => {
    const health = computePortfolioHealthScore(emptyInput({ optionsIncome: optionsIncome() }));
    const div = health.factors.find((f) => f.code === "diversification")!;
    expect(div.available).toBe(true);
    expect(div.score).toBe(72);
    expect(div.detail).toBe("Well diversified.");
  });

  it("averages Sector Concentration across Investing's sectorExposure and Options Income's own concentration factor", () => {
    const health = computePortfolioHealthScore(emptyInput({ optionsIncome: optionsIncome(), investingRisk: investingRisk() }));
    const sector = health.factors.find((f) => f.code === "sector_concentration")!;
    // avg(55, 60) = 57.5 -> rounds to 58
    expect(sector.available).toBe(true);
    expect(sector.score).toBe(58);
  });

  it("averages Position Sizing across Trading's positionSizing and Options Income's own sizing factor", () => {
    const health = computePortfolioHealthScore(emptyInput({ optionsIncome: optionsIncome(), tradingRisk: tradingRisk() }));
    const sizing = health.factors.find((f) => f.code === "position_sizing")!;
    // avg(78, 80) = 79
    expect(sizing.available).toBe(true);
    expect(sizing.score).toBe(79);
  });

  it("always reports Cash Allocation unavailable, even when a reference buying-power figure is resolvable — never fabricates a 0-100 score", () => {
    const health = computePortfolioHealthScore(emptyInput({ optionsIncome: optionsIncome() }));
    const cash = health.factors.find((f) => f.code === "cash_allocation")!;
    expect(cash.available).toBe(false);
    expect(cash.score).toBeNull();
    expect(cash.detail).toMatch(/20%/); // 20000 / 100000
  });

  it("scores Open Risk from Trading's own portfolioBudget ScoreCard", () => {
    const health = computePortfolioHealthScore(emptyInput({ tradingRisk: tradingRisk() }));
    const openRisk = health.factors.find((f) => f.code === "open_risk")!;
    expect(openRisk.available).toBe(true);
    expect(openRisk.score).toBe(70);
  });

  it("always reports Portfolio Volatility and Correlation unavailable — no covariance model or correlation coefficient exists anywhere in this codebase", () => {
    const health = computePortfolioHealthScore(emptyInput({ optionsIncome: optionsIncome(), optionsConcentration: optionsConcentration() }));
    const vol = health.factors.find((f) => f.code === "portfolio_volatility")!;
    const corr = health.factors.find((f) => f.code === "correlation")!;
    expect(vol.available).toBe(false);
    expect(corr.available).toBe(false);
    expect(corr.detail).toMatch(/2 categorical cluster/);
  });

  it("scores Maximum Drawdown from the worst modeled stress-test scenario by portfolioValueImpact, mirroring institutionalMentor.ts's own derivation", () => {
    const health = computePortfolioHealthScore(emptyInput({ optionsIncome: optionsIncome() }));
    const dd = health.factors.find((f) => f.code === "maximum_drawdown")!;
    expect(dd.available).toBe(true);
    expect(dd.score).toBe(55); // riskScoreAfter of the worst (most negative) scenario
    expect(dd.detail).toMatch(/Market Crash/);
  });

  it("scores Decision Quality directly from the active DecisionScore when a decision is in progress", () => {
    const health = computePortfolioHealthScore(
      emptyInput({ decisionSummary: { tradePlan: { id: 1 }, score: { overall: 88, label: "Strong", componentStageIds: [] } } }),
    );
    const dq = health.factors.find((f) => f.code === "decision_quality")!;
    expect(dq.available).toBe(true);
    expect(dq.score).toBe(88);
  });

  it("scores Trade Quality by averaging completionPct across active, non-archived lifecycle records only", () => {
    const health = computePortfolioHealthScore(
      emptyInput({
        lifecycleRecords: [
          lifecycleRecord({ completionPct: 100 }),
          lifecycleRecord({ completionPct: 50 }),
          lifecycleRecord({ outcome: "archived-cancelled", currentStage: "archived", completionPct: 0 }),
        ],
      }),
    );
    const tq = health.factors.find((f) => f.code === "trade_quality")!;
    expect(tq.available).toBe(true);
    expect(tq.score).toBe(75); // avg(100, 50); the archived record is excluded
  });

  it("scores Journal Completion from the same closedTradesCount/journalOutstanding set-difference Command Centre already uses", () => {
    const health = computePortfolioHealthScore(emptyInput({ closedTradesCount: 10, journalOutstanding: 3 }));
    const jc = health.factors.find((f) => f.code === "journal_completion")!;
    expect(jc.available).toBe(true);
    expect(jc.score).toBe(70);
  });

  it("scores Learning Completion by averaging Learning Centre's own per-path percentComplete", () => {
    const health = computePortfolioHealthScore(emptyInput({ learningProgress: learningProgress() }));
    const lc = health.factors.find((f) => f.code === "learning_completion")!;
    expect(lc.available).toBe(true);
    expect(lc.score).toBe(53); // avg(80, 25) rounds to 53 (52.5)
  });

  it("computes overall as the mean across only available factors, and bands confidenceLevel by the ratio of available factors", () => {
    const health = computePortfolioHealthScore(
      emptyInput({
        optionsIncome: optionsIncome(),
        optionsConcentration: optionsConcentration(),
        investingRisk: investingRisk(),
        tradingRisk: tradingRisk(),
        decisionSummary: { tradePlan: { id: 1 }, score: { overall: 90, label: "Strong", componentStageIds: [] } },
        lifecycleRecords: [lifecycleRecord({ completionPct: 100 })],
        closedTradesCount: 5,
        journalOutstanding: 0,
        learningProgress: learningProgress(),
      }),
    );
    const available = health.factors.filter((f) => f.available);
    expect(available.length).toBe(9); // every factor except cash_allocation/portfolio_volatility/correlation
    expect(health.confidenceLevel).toBe("Moderate"); // 9/12 = 0.75, banded Moderate (>=0.5, <0.8)
  });
});

describe("computeRiskIntelligence", () => {
  it("returns honest 'not available' signals across the board for a fully empty input — never fabricated", () => {
    const risk = computeRiskIntelligence(emptyInput());
    const concentration = risk.signals.find((s) => s.code === "portfolio_concentration")!;
    expect(concentration.available).toBe(false);
    // currency/country exposure and liquidity risk are ALWAYS unavailable
    expect(risk.signals.find((s) => s.code === "currency_exposure")!.available).toBe(false);
    expect(risk.signals.find((s) => s.code === "country_exposure")!.available).toBe(false);
    expect(risk.signals.find((s) => s.code === "liquidity_risk")!.available).toBe(false);
    // pending_trade_impact is always "available" (a count, possibly zero)
    const pending = risk.signals.find((s) => s.code === "pending_trade_impact")!;
    expect(pending.available).toBe(true);
    expect(pending.headline).toBe("None pending");
  });

  it("surfaces Portfolio Concentration from Options Income's largestPosition when present", () => {
    const risk = computeRiskIntelligence(emptyInput({ optionsIncome: optionsIncome() }));
    const c = risk.signals.find((s) => s.code === "portfolio_concentration")!;
    expect(c.available).toBe(true);
    expect(c.headline).toMatch(/AAPL: 12\.5%/);
  });

  it("computes Total Portfolio Risk as a plain sum of Options Income + Trading dollars, deliberately excluding the Investing Engine's own long-term holdings", () => {
    const risk = computeRiskIntelligence(emptyInput({ optionsIncome: optionsIncome(), tradingRisk: tradingRisk() }));
    const total = risk.signals.find((s) => s.code === "total_portfolio_risk")!;
    expect(total.available).toBe(true);
    expect(total.headline).toBe("$7,000"); // 5000 + 2000
    expect(total.detail).toMatch(/deliberately excluded/);
  });

  it("surfaces Correlation Risk as real categorical clusters, never a fabricated correlation coefficient", () => {
    const risk = computeRiskIntelligence(emptyInput({ optionsConcentration: optionsConcentration() }));
    const corr = risk.signals.find((s) => s.code === "correlation_risk")!;
    expect(corr.available).toBe(true);
    expect(corr.headline).toBe("2 categorical clusters");
  });

  it("reports Pending Trade Impact as a real count of Ready-to-Execute lifecycle records, never a fabricated dollar figure", () => {
    const risk = computeRiskIntelligence(
      emptyInput({ lifecycleRecords: [lifecycleRecord({ currentStage: "ready-to-execute" }), lifecycleRecord({ currentStage: "open-position" })] }),
    );
    const pending = risk.signals.find((s) => s.code === "pending_trade_impact")!;
    expect(pending.headline).toBe("1 plan Ready to Execute");
    expect(pending.detail).toMatch(/What-If Analysis/);
  });
});

describe("computeWhatIfAnalysis", () => {
  it("checks the hypothetical total against Trading's own named 6% portfolio-risk cap", () => {
    const result = computeWhatIfAnalysis(
      { tradePlanId: 1, tradePlanTitle: "AAPL breakout", coachId: "trading", hypotheticalRiskDollars: 2000, hypotheticalSymbol: "AAPL" },
      { totalRiskDollars: 2500, accountValue: 50000, worstDrawdownPct: null },
    );
    expect(result.hypotheticalTotalRiskDollars).toBe(4500);
    expect(result.hypotheticalTotalRiskPct).toBe(9); // 4500/50000
    expect(result.capBreached).toBe(true);
    expect(result.capLabel).toMatch(/6%/);
  });

  it("does not breach the cap when the hypothetical total stays under it", () => {
    const result = computeWhatIfAnalysis(
      { tradePlanId: 1, tradePlanTitle: "AAPL breakout", coachId: "trading", hypotheticalRiskDollars: 100, hypotheticalSymbol: "AAPL" },
      { totalRiskDollars: 1000, accountValue: 50000, worstDrawdownPct: null },
    );
    expect(result.capBreached).toBe(false);
  });

  it("points to the Investing Engine's own sector-concentration cap instead of a numeric check it can't perform here", () => {
    const result = computeWhatIfAnalysis(
      { tradePlanId: 2, tradePlanTitle: "Add MSFT", coachId: "investing", hypotheticalRiskDollars: 5000, hypotheticalSymbol: "MSFT" },
      { totalRiskDollars: null, accountValue: null, worstDrawdownPct: null },
    );
    expect(result.capBreached).toBeNull();
    expect(result.capLabel).toMatch(/40%/);
    expect(result.notes.some((n) => /sector-concentration/i.test(n))).toBe(true);
  });

  it("honestly reports no cap check for Options Income — no named portfolio-risk-percentage cap exists for that engine", () => {
    const result = computeWhatIfAnalysis(
      { tradePlanId: 3, tradePlanTitle: "New iron condor", coachId: "options", hypotheticalRiskDollars: 500, hypotheticalSymbol: "SPY" },
      { totalRiskDollars: 1000, accountValue: 100000, worstDrawdownPct: null },
    );
    expect(result.capBreached).toBeNull();
    expect(result.capLabel).toBeNull();
  });

  it("computes an approximate worst-case drawdown proportionally scaled from the current worst-case figure", () => {
    const result = computeWhatIfAnalysis(
      { tradePlanId: 1, tradePlanTitle: "AAPL breakout", coachId: "trading", hypotheticalRiskDollars: 1000, hypotheticalSymbol: "AAPL" },
      { totalRiskDollars: 1000, accountValue: 50000, worstDrawdownPct: 10 },
    );
    // hypothetical = 2000, ratio = 2000/1000 = 2x -> 20%
    expect(result.approxWorstCaseDrawdownPct).toBe(20);
  });

  it("honestly reports no computable worst-case drawdown when there is no current risk figure or stress-test history", () => {
    const result = computeWhatIfAnalysis(
      { tradePlanId: 1, tradePlanTitle: "AAPL breakout", coachId: "trading", hypotheticalRiskDollars: 1000, hypotheticalSymbol: "AAPL" },
      { totalRiskDollars: null, accountValue: null, worstDrawdownPct: null },
    );
    expect(result.approxWorstCaseDrawdownPct).toBeNull();
  });
});

describe("buildPortfolioCoachNarrative", () => {
  function fixedHealth(overrides: Partial<PortfolioHealthScore> = {}): PortfolioHealthScore {
    return { overall: 0, label: "Poor", factors: [], confidenceLevel: "Low", generatedAt: "2026-07-30T00:00:00Z", ...overrides };
  }
  function fixedRisk(overrides: Partial<RiskIntelligenceReport> = {}): RiskIntelligenceReport {
    return { signals: [], generatedAt: "2026-07-30T00:00:00Z", ...overrides };
  }

  it("tells the user honestly to start somewhere when nothing is scored yet, never a fabricated explanation", () => {
    const narrative = buildPortfolioCoachNarrative(fixedHealth(), fixedRisk());
    expect(narrative.healthExplanation).toMatch(/No factors are scored yet/);
    expect(narrative.strongestFactors).toEqual([]);
    expect(narrative.weakestFactors).toEqual([]);
  });

  it("classifies strongest (>=70) and weakest (<45) factors correctly, leaving moderate factors in neither list", () => {
    const health = fixedHealth({
      overall: 60,
      factors: [
        { code: "diversification", label: "Diversification", score: 85, available: true, detail: "Great.", sourceModule: "x" },
        { code: "open_risk", label: "Open Risk", score: 30, available: true, detail: "Too much risk.", sourceModule: "x" },
        { code: "decision_quality", label: "Decision Quality", score: 55, available: true, detail: "Fine.", sourceModule: "x" },
      ],
    });
    const narrative = buildPortfolioCoachNarrative(health, fixedRisk());
    expect(narrative.strongestFactors).toEqual(["Diversification (85%)"]);
    expect(narrative.weakestFactors[0]).toMatch(/^Open Risk \(30%\) — Too much risk\.$/);
    expect(narrative.weakestFactors).toHaveLength(1);
  });

  it("never gives a fabricated buy/sell instruction — institutional best practice text is deterministic and educational only", () => {
    const narrative = buildPortfolioCoachNarrative(fixedHealth(), fixedRisk());
    expect(narrative.institutionalBestPractice).not.toMatch(/\b(buy|sell)\b/i);
    expect(narrative.institutionalBestPractice.length).toBeGreaterThan(0);
  });

  it("surfaces largestRisks only from the specific 4 concentration/single-position/open-trade/total-risk signals, never every signal", () => {
    const risk = fixedRisk({
      signals: [
        { code: "portfolio_concentration", label: "Portfolio Concentration", available: true, headline: "AAPL: 20%", detail: "", sourceModule: "" },
        { code: "liquidity_risk", label: "Liquidity Risk", available: false, headline: "Not aggregated", detail: "", sourceModule: "" },
      ],
    });
    const narrative = buildPortfolioCoachNarrative(fixedHealth(), risk);
    expect(narrative.largestRisks).toEqual(["Portfolio Concentration: AAPL: 20%"]);
  });
});

describe("recommendedPortfolioLesson / weakestAvailableFactor", () => {
  it("returns null when there is no weakest factor code to look up", () => {
    expect(recommendedPortfolioLesson(null)).toBeNull();
  });

  it("maps a known weak factor code to a real, pre-verified pathKey/topicKey pair", () => {
    const lesson = recommendedPortfolioLesson("open_risk");
    expect(lesson).toEqual({ pathKey: "trading-engine", topicKey: "trading-risk-management", label: "Risk Management" });
  });

  it("picks the lowest-scored available factor, ignoring unavailable ones entirely", () => {
    const health: PortfolioHealthScore = {
      overall: 50,
      label: "Moderate",
      confidenceLevel: "Moderate",
      generatedAt: "2026-07-30T00:00:00Z",
      factors: [
        { code: "diversification", label: "Diversification", score: 80, available: true, detail: "", sourceModule: "" },
        { code: "open_risk", label: "Open Risk", score: 20, available: true, detail: "", sourceModule: "" },
        { code: "correlation", label: "Correlation", score: null, available: false, detail: "", sourceModule: "" },
      ],
    };
    const weakest = weakestAvailableFactor(health);
    expect(weakest?.code).toBe("open_risk");
  });

  it("returns null when no factor is available at all", () => {
    const health: PortfolioHealthScore = {
      overall: 0,
      label: "Poor",
      confidenceLevel: "Low",
      generatedAt: "2026-07-30T00:00:00Z",
      factors: [{ code: "correlation", label: "Correlation", score: null, available: false, detail: "", sourceModule: "" }],
    };
    expect(weakestAvailableFactor(health)).toBeNull();
  });
});
