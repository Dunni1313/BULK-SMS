// Phase 29 — Institutional Trading AI Coach. Pure unit coverage over
// lib/tradingCoach.ts's 8 deterministic explain functions — no database, no
// provider, no LLM. Hand-constructed fixtures matching the real
// MultiTimeframeAnalysis/LiquidityAnalysis/SessionData/
// TradingRiskAnalysisWithContext/ScenarioComparisonResult shapes exactly, so
// every explanation is proven to genuinely quote its inputs rather than
// fabricate a value.

import { describe, it, expect } from "vitest";
import {
  TRADING_COACH_TYPES,
  TRADING_COACH_LABELS,
  SYMBOL_SCOPED_TRADING_COACHES,
  ACCOUNT_SCOPED_TRADING_COACHES,
  TRADING_COACH_DISCLAIMER,
  explainStructureCoach,
  explainLiquidityCoach,
  explainSessionCoach,
  explainRiskCoach,
  explainTradePlanCoach,
  explainJournalCoach,
  explainPsychologyCoach,
  explainScenarioCoach,
} from "./tradingCoach.js";
import type { MultiTimeframeAnalysis } from "./tradingMultiTimeframe.js";
import type { LiquidityAnalysis } from "./tradingLiquidity.js";
import type { TradingRiskAnalysisWithContext } from "./tradingRisk.js";
import type { ScenarioComparisonResult } from "./tradingScenarioComparison.js";

describe("tradingCoach.ts — TRADING_COACH_TYPES / labels", () => {
  it("has exactly the 8 requested coaches", () => {
    expect(TRADING_COACH_TYPES).toEqual(["structure", "liquidity", "session", "risk", "trade-plan", "journal", "scenario", "psychology"]);
    for (const c of TRADING_COACH_TYPES) expect(TRADING_COACH_LABELS[c]).toBeTruthy();
  });

  it("symbol-scoped and account-scoped coaches are mutually exclusive and cover every coach type", () => {
    const union = new Set([...SYMBOL_SCOPED_TRADING_COACHES, ...ACCOUNT_SCOPED_TRADING_COACHES]);
    expect(union.size).toBe(TRADING_COACH_TYPES.length - 1); // scenario is neither (stateless POST)
    for (const c of SYMBOL_SCOPED_TRADING_COACHES) expect(ACCOUNT_SCOPED_TRADING_COACHES).not.toContain(c);
  });

  it("the disclaimer never claims a signal, prediction, or recommendation is created", () => {
    expect(TRADING_COACH_DISCLAIMER).toMatch(/never creates a.*trading signal/i);
    expect(TRADING_COACH_DISCLAIMER).toMatch(/predicts a future price/i);
    expect(TRADING_COACH_DISCLAIMER).toMatch(/recommends buying or selling/i);
    expect(TRADING_COACH_DISCLAIMER).toMatch(/invents a probability/i);
  });
});

function multiTimeframeFixture(overrides: Partial<MultiTimeframeAnalysis> = {}): MultiTimeframeAnalysis {
  return {
    symbol: "AAPL",
    dataSource: "SIMULATED",
    timeframes: [
      {
        interval: "1D",
        structure: {
          symbol: "AAPL",
          interval: "1D",
          dataSource: "SIMULATED",
          candleCount: 90,
          currentPrice: 150,
          trend: "uptrend",
          trendDetail: "Higher highs and higher lows detected.",
          swingPoints: [],
          zones: [{ price: 148, kind: "support", strength: 3 }],
          confidenceLevel: "High",
          confidenceExplanation: "Enough candles for a reliable read.",
          summary: "AAPL is in an uptrend on 1D.",
        },
      },
    ],
    trendAgreement: "unanimous",
    dominantTrend: "uptrend",
    confluenceScore: 100,
    confidenceLevel: "High",
    confidenceExplanation: "All timeframes agree.",
    summary: "AAPL reads uptrend with unanimous agreement.",
    ...overrides,
  };
}

describe("explainStructureCoach", () => {
  it("quotes the multi-timeframe trend, zones, and confluence — never fabricating a value", () => {
    const mtf = multiTimeframeFixture();
    const e = explainStructureCoach("AAPL", mtf);
    expect(e.coach).toBe("structure");
    expect(e.symbol).toBe("AAPL");
    expect(e.headline).toContain("uptrend");
    expect(e.headline).toContain("unanimous");
    expect(e.metricsUsed[0].detail).toContain("uptrend");
    expect(e.supportingEvidence.some((s) => s.detail.includes("148"))).toBe(true);
    expect(e.strengthsIncreasingConfidence.some((s) => s.includes("100%"))).toBe(true);
    expect(e.risksReducingConfidence).toEqual([]);
    expect(e.calculationSources.join(" ")).toMatch(/Market Structure/);
    expect(e.disclaimer).toBe(TRADING_COACH_DISCLAIMER);
  });

  it("honestly surfaces a split trend agreement as a risk, never hiding the disagreement", () => {
    const mtf = multiTimeframeFixture({ trendAgreement: "split", dominantTrend: null, confluenceScore: null });
    const e = explainStructureCoach("AAPL", mtf);
    expect(e.headline).toContain("do not share a single dominant trend");
    expect(e.risksReducingConfidence.some((r) => r.includes("genuinely disagree"))).toBe(true);
  });

  it("surfaces a Low-confidence timeframe as a risk", () => {
    const mtf = multiTimeframeFixture();
    mtf.timeframes[0].structure.confidenceLevel = "Low";
    mtf.timeframes[0].structure.confidenceExplanation = "Too few candles.";
    const e = explainStructureCoach("AAPL", mtf);
    expect(e.risksReducingConfidence.some((r) => r.includes("Too few candles"))).toBe(true);
  });
});

function liquidityFixture(overrides: Partial<LiquidityAnalysis> = {}): LiquidityAnalysis {
  return {
    symbol: "AAPL",
    interval: "1D",
    dataSource: "SIMULATED",
    candleCount: 90,
    currentPrice: 150,
    volumeProfile: [{ price: 150, volume: 1_000_000, pctOfTotal: 42.5 }],
    avgDollarVolume: 30_000_000,
    liquidityScore: 80,
    liquidityBand: "High",
    buySellPressure: { buyPct: 60, sellPct: 40, direction: "buying" },
    confidenceLevel: "High",
    confidenceExplanation: "Enough candles.",
    summary: "AAPL reads High liquidity with buying pressure.",
    ...overrides,
  };
}

describe("explainLiquidityCoach", () => {
  it("quotes liquidity band, dollar volume, pressure, and the volume profile — never fabricating a value", () => {
    const e = explainLiquidityCoach("AAPL", liquidityFixture());
    expect(e.coach).toBe("liquidity");
    expect(e.headline).toContain("High liquidity");
    expect(e.headline).toContain("buying");
    expect(e.metricsUsed.some((m) => m.detail.includes("30,000,000"))).toBe(true);
    expect(e.supportingEvidence[0].detail).toContain("42.5%");
    expect(e.strengthsIncreasingConfidence.length).toBeGreaterThan(0);
  });

  it("flags Low liquidity band and Low confidence as risks", () => {
    const e = explainLiquidityCoach("AAPL", liquidityFixture({ liquidityBand: "Low", confidenceLevel: "Low", confidenceExplanation: "Thin sample." }));
    expect(e.risksReducingConfidence.some((r) => r.includes("Thin sample"))).toBe(true);
    expect(e.risksReducingConfidence.some((r) => r.includes("Low"))).toBe(true);
  });
});

describe("explainSessionCoach", () => {
  it("quotes active sessions and session high/low", () => {
    const e = explainSessionCoach("AAPL", { symbol: "AAPL", asOf: new Date().toISOString(), activeSessions: ["london", "new_york"], sessionHigh: 152, sessionLow: 148 });
    expect(e.coach).toBe("session");
    expect(e.headline).toContain("2 sessions are currently open");
    expect(e.metricsUsed.some((m) => m.detail.includes("152"))).toBe(true);
    expect(e.strengthsIncreasingConfidence.some((s) => s.includes("overlapping"))).toBe(true);
  });

  it("honestly reports no session open, never fabricating an active session", () => {
    const e = explainSessionCoach("AAPL", { symbol: "AAPL", asOf: new Date().toISOString(), activeSessions: [], sessionHigh: null, sessionLow: null });
    expect(e.headline).toContain("No named trading session is currently open");
    expect(e.strengthsIncreasingConfidence).toEqual([]);
  });

  it("honestly reports unavailable session data as null, not a crash", () => {
    const e = explainSessionCoach("AAPL", null);
    expect(e.headline).toContain("not available");
    expect(e.risksReducingConfidence.length).toBeGreaterThan(0);
  });
});

function riskFixture(overrides: Partial<TradingRiskAnalysisWithContext> = {}): TradingRiskAnalysisWithContext {
  return {
    overall: { score: 82, label: "Strong", detail: "No caps breached." },
    positionSizing: { score: 90, label: "Strong", detail: "Largest position within cap.", largestPositionSymbol: "AAPL", largestPositionRiskPct: 1.5, capBreached: false, unpricedSymbols: [] },
    stopDiscipline: { score: 100, label: "Excellent", detail: "Every position has a stop and target.", openPositionsCount: 1, positionsWithStop: 1, positionsWithTarget: 1, positionsFullyPlanned: 1, missingStopSymbols: [], missingTargetSymbols: [] },
    portfolioBudget: {
      score: 75,
      label: "Acceptable",
      detail: "Aggregate risk within cap.",
      accountValue: 100_000,
      totalRiskDollars: 1_500,
      totalRiskUsedPct: 1.5,
      capBreached: false,
      perPosition: [{ id: 1, symbol: "AAPL", riskDollars: 1_500, riskPct: 1.5, withinLimit: true }],
    },
    components: [],
    accountValue: 100_000,
    openPositionsCount: 1,
    positionContexts: [],
    ...overrides,
  };
}

describe("explainRiskCoach", () => {
  it("quotes overall/position-sizing/stop-discipline/portfolio-budget verbatim", () => {
    const e = explainRiskCoach("AAPL", riskFixture());
    expect(e.coach).toBe("risk");
    expect(e.headline).toContain("Strong");
    expect(e.headline).toContain("1 open position");
    expect(e.supportingEvidence.some((s) => s.label === "AAPL" && s.detail.includes("1500.00"))).toBe(true);
    expect(e.strengthsIncreasingConfidence.length).toBeGreaterThan(0);
  });

  it("surfaces a breached cap and missing stop/target symbols as risks, never hiding them", () => {
    const risk = riskFixture({
      positionSizing: { score: 60, label: "Weak", detail: "Cap breached.", largestPositionSymbol: "TSLA", largestPositionRiskPct: 8, capBreached: true, unpricedSymbols: [] },
      stopDiscipline: { score: 40, label: "Poor", detail: "Missing stops.", openPositionsCount: 2, positionsWithStop: 1, positionsWithTarget: 0, positionsFullyPlanned: 0, missingStopSymbols: ["TSLA"], missingTargetSymbols: ["AAPL", "TSLA"] },
    });
    const e = explainRiskCoach("AAPL", risk);
    expect(e.risksReducingConfidence.some((r) => r.includes("Cap breached"))).toBe(true);
    expect(e.risksReducingConfidence.some((r) => r.includes("TSLA"))).toBe(true);
    expect(e.risksReducingConfidence.some((r) => r.includes("AAPL, TSLA"))).toBe(true);
  });
});

describe("explainTradePlanCoach", () => {
  it("honestly reports no plan exists, never fabricating one", () => {
    const e = explainTradePlanCoach("AAPL", null);
    expect(e.coach).toBe("trade-plan");
    expect(e.headline).toContain("No trade plan has been saved yet");
    expect(e.metricsUsed).toEqual([]);
  });

  it("quotes a real saved plan's direction/entry/stop/target/position size/R:R verbatim", () => {
    const e = explainTradePlanCoach("AAPL", {
      id: 1,
      symbol: "AAPL",
      direction: "long",
      status: "active",
      thesis: "Breaking out of a base.",
      risk: { accountRiskPct: 1, entryPrice: 150, stopPrice: 145, targetPrice: 165, positionSize: 40, riskRewardRatio: 3 },
      createdAt: new Date().toISOString(),
    });
    expect(e.headline).toContain("40 shares");
    expect(e.headline).toContain("3.00:1");
    expect(e.metricsUsed.some((m) => m.detail === "long")).toBe(true);
    expect(e.supportingEvidence.some((s) => s.detail === "Breaking out of a base.")).toBe(true);
    expect(e.strengthsIncreasingConfidence.some((s) => s.includes("2:1"))).toBe(true);
  });

  it("honestly reports non-computable position size / risk-reward as risks, never a fabricated number", () => {
    const e = explainTradePlanCoach("AAPL", {
      id: 2,
      symbol: "AAPL",
      direction: "long",
      status: "draft",
      thesis: "",
      risk: { accountRiskPct: 1, entryPrice: 150, stopPrice: 150, targetPrice: 150, positionSize: null, riskRewardRatio: null },
      createdAt: new Date().toISOString(),
    });
    expect(e.risksReducingConfidence.some((r) => r.includes("no account value"))).toBe(true);
    expect(e.risksReducingConfidence.some((r) => r.includes("same price"))).toBe(true);
    expect(e.risksReducingConfidence.some((r) => r.includes("No thesis"))).toBe(true);
  });
});

describe("explainJournalCoach", () => {
  it("honestly reports no entries, never fabricating one", () => {
    const e = explainJournalCoach([]);
    expect(e.headline).toContain("No Trading Journal entries");
    expect(e.symbol).toBeNull();
  });

  it("tallies real recorded fields — entry count, lesson-learned ratio, most common mood", () => {
    const e = explainJournalCoach([
      { title: "A", mood: "confident", lessonLearned: "Stuck to the plan.", rMultiple: 2, setupType: "breakout", createdAt: new Date().toISOString() },
      { title: "B", mood: "confident", lessonLearned: null, rMultiple: -1, setupType: null, createdAt: new Date().toISOString() },
    ]);
    expect(e.headline).toContain("2 journal entries recorded");
    expect(e.headline).toContain("1 include a lesson learned");
    expect(e.metricsUsed.some((m) => m.detail.includes("confident (2 entries)"))).toBe(true);
    expect(e.risksReducingConfidence.some((r) => r.includes("1 of 2"))).toBe(true);
  });
});

describe("explainPsychologyCoach", () => {
  it("honestly reports no entries, never fabricating a diagnosis", () => {
    const e = explainPsychologyCoach([]);
    expect(e.headline).toContain("No Trading Journal entries");
  });

  it("tallies real recorded R-multiples into win/loss counts and a documentation ratio — never a psychological score", () => {
    const e = explainPsychologyCoach([
      { title: "A", mood: "confident", lessonLearned: "Good discipline.", rMultiple: 2, setupType: null, createdAt: new Date().toISOString() },
      { title: "B", mood: "anxious", lessonLearned: "Good discipline.", rMultiple: -1, setupType: null, createdAt: new Date().toISOString() },
      { title: "C", mood: "neutral", lessonLearned: null, rMultiple: null, setupType: null, createdAt: new Date().toISOString() },
    ]);
    expect(e.headline).toContain("1 recorded win(s) vs. 1 recorded loss(es)");
    expect(e.metricsUsed.some((m) => m.detail === "67%")).toBe(true);
    expect(e.disclaimer).toBe(TRADING_COACH_DISCLAIMER);
  });

  it("flags a low documentation ratio honestly, never hiding it", () => {
    const e = explainPsychologyCoach([
      { title: "A", mood: "confident", lessonLearned: null, rMultiple: 1, setupType: null, createdAt: new Date().toISOString() },
      { title: "B", mood: "confident", lessonLearned: null, rMultiple: -1, setupType: null, createdAt: new Date().toISOString() },
    ]);
    expect(e.risksReducingConfidence.some((r) => r.includes("0% of entries"))).toBe(true);
  });
});

function scenarioComparisonFixture(overrides: Partial<ScenarioComparisonResult> = {}): ScenarioComparisonResult {
  return {
    symbol: "AAPL",
    accountValue: 100_000,
    scenarios: [
      { name: "Tight stop", direction: "long", risk: { accountRiskPct: 1, entryPrice: 150, stopPrice: 148, targetPrice: 160, positionSize: 500, riskRewardRatio: 5 } },
      { name: "Wide stop", direction: "long", risk: { accountRiskPct: 1, entryPrice: 150, stopPrice: 140, targetPrice: 160, positionSize: 100, riskRewardRatio: 1 } },
    ],
    bestRiskRewardName: "Tight stop",
    tightestRiskName: "Wide stop",
    summary: "2 scenarios compared for AAPL.",
    ...overrides,
  };
}

describe("explainScenarioCoach", () => {
  it("honestly reports zero scenarios, never fabricating one", () => {
    const e = explainScenarioCoach({ symbol: null, accountValue: null, scenarios: [], bestRiskRewardName: null, tightestRiskName: null, summary: "" });
    expect(e.headline).toContain("No scenarios were provided");
  });

  it("quotes each scenario's own computed position size/R:R and the honest best-R:R/tightest-risk identification", () => {
    const e = explainScenarioCoach(scenarioComparisonFixture());
    expect(e.coach).toBe("scenario");
    expect(e.symbol).toBe("AAPL");
    expect(e.headline).toContain('"Tight stop" has the best risk/reward ratio');
    expect(e.metricsUsed.some((m) => m.label === "Tight stop" && m.detail.includes("5.00:1"))).toBe(true);
    expect(e.strengthsIncreasingConfidence.some((s) => s.includes('"Tight stop"'))).toBe(true);
    expect(e.strengthsIncreasingConfidence.some((s) => s.includes('"Wide stop"'))).toBe(true);
  });

  it("never says 'recommended' anywhere in its own explanation text", () => {
    const e = explainScenarioCoach(scenarioComparisonFixture());
    const allText = JSON.stringify(e).toLowerCase();
    expect(allText).not.toContain("recommended scenario");
    expect(allText).not.toContain("best trade");
  });

  it("honestly reports non-computable best/tightest, never fabricating a winner", () => {
    const e = explainScenarioCoach(scenarioComparisonFixture({ bestRiskRewardName: null, tightestRiskName: null }));
    expect(e.risksReducingConfidence.length).toBe(2);
    expect(e.strengthsIncreasingConfidence).toEqual([]);
  });
});
