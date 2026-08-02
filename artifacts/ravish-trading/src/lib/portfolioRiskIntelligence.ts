// v1.5.0, Sprint 15 — Institutional Portfolio & Risk Intelligence Engine.
//
// NOT a new portfolio page. NOT a new dashboard. This module is pure
// composition over already-existing, already-computed portfolio/risk data
// from all 3 engines — it introduces exactly ONE genuinely new concept
// (a cross-engine blended Portfolio Health Score) built entirely from
// numbers that already exist, plus a lightweight What-If arithmetic tool.
// Zero new pricing/valuation/scoring formulas duplicate anything the
// engines below already compute.
//
// Reused sources, verified against the real generated API types before
// writing a line of this file:
//   Engine 3 (Options Income) — buildPortfolioDashboard()'s own 8
//     healthFactors (diversification/concentration/position_sizing_quality/
//     etc, PortfolioDashboardResult), buildPortfolioConcentrationOverlay()'s
//     own clusters/summary (PortfolioConcentrationResult).
//   Engine 1 (Investing) — computePortfolioRisk()'s own concentration/
//     sectorExposure/betaEstimate ScoreCards (ConstructionPortfolioRiskAnalysis,
//     via GET /portfolio-construction/portfolios/:id/risk).
//   Engine 2 (Trading) — computeTradingRisk()'s own positionSizing/
//     stopDiscipline/portfolioBudget ScoreCards (TradingRiskAnalysis, via
//     GET /trading/risk).
//   Sprint 13 (Decision Workflow) — useActiveDecisionSummary()'s own
//     DecisionScore.
//   Sprint 14 (Execution & Lifecycle Manager) — useTradeLifecyclePipeline()'s
//     own TradeLifecycleRecord[] (completionPct, openRisk, currentStage).
//   Sprint 12 (Command Centre) — the exact same journalOutstanding
//     set-difference computation already used there.
//   Learning Centre — useGetLearningProgress()'s own pathCompletion array.
//
// Never fabricated: no statistical correlation coefficient, portfolio-level
// volatility model, cash-allocation health formula, currency exposure, or
// country exposure exists ANYWHERE in this codebase today (confirmed by a
// direct repository audit before writing this file) — those factors/signals
// below are always honestly reported unavailable, with a named reason,
// never invented. This mirrors the exact same discipline Investment Quality
// Engine (Phase 2 Sprint 15) established for its own 2 permanently-
// unavailable metrics.

import type {
  PortfolioDashboardResult,
  PortfolioConcentrationResult,
  ConstructionPortfolioRiskAnalysis,
  TradingRiskAnalysis,
  LearningProgressSummary,
} from "@workspace/api-client-react";
import type { CoachId } from "./ai-coach/capabilityRegistry";
import type { DecisionScore } from "./decisionWorkflow";
import type { TradeLifecycleRecord } from "./tradeLifecycle";

// ─── Portfolio Health Score ──────────────────────────────────────────────

export type HealthFactorCode =
  | "diversification"
  | "sector_concentration"
  | "position_sizing"
  | "cash_allocation"
  | "open_risk"
  | "portfolio_volatility"
  | "correlation"
  | "maximum_drawdown"
  | "decision_quality"
  | "trade_quality"
  | "journal_completion"
  | "learning_completion";

export interface HealthFactor {
  code: HealthFactorCode;
  label: string;
  score: number | null;
  available: boolean;
  detail: string;
  sourceModule: string;
}

export type PortfolioHealthLabel = "Excellent" | "Strong" | "Moderate" | "Elevated Risk" | "Poor";
export type ConfidenceLevel = "High" | "Moderate" | "Low";

export interface PortfolioHealthScore {
  overall: number;
  label: PortfolioHealthLabel;
  factors: HealthFactor[];
  confidenceLevel: ConfidenceLevel;
  generatedAt: string;
}

export interface PortfolioIntelligenceInput {
  optionsIncome: PortfolioDashboardResult | null;
  optionsConcentration: PortfolioConcentrationResult | null;
  investingRisk: ConstructionPortfolioRiskAnalysis | null;
  tradingRisk: TradingRiskAnalysis | null;
  decisionSummary: { tradePlan: unknown | null; score: DecisionScore | null };
  lifecycleRecords: TradeLifecycleRecord[];
  closedTradesCount: number;
  journalOutstanding: number | null;
  learningProgress: LearningProgressSummary | null;
}

function avg(values: (number | null | undefined)[]): number | null {
  const present = values.filter((v): v is number => v !== null && v !== undefined);
  if (present.length === 0) return null;
  return Math.round(present.reduce((s, v) => s + v, 0) / present.length);
}

function healthLabel(score: number): PortfolioHealthLabel {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Strong";
  if (score >= 50) return "Moderate";
  if (score >= 35) return "Elevated Risk";
  return "Poor";
}

function unavailable(code: HealthFactorCode, label: string, detail: string, sourceModule = "Not computed by any module in this codebase"): HealthFactor {
  return { code, label, score: null, available: false, detail, sourceModule };
}

export function computePortfolioHealthScore(input: PortfolioIntelligenceInput): PortfolioHealthScore {
  const { optionsIncome, optionsConcentration, investingRisk, tradingRisk, decisionSummary, lifecycleRecords, closedTradesCount, journalOutstanding, learningProgress } = input;

  const factors: HealthFactor[] = [];

  // 1. Diversification — Engine 3's own already-computed diversification
  // health factor (Herfindahl-based, across sector/strategy clusters).
  const diversification = (optionsIncome?.healthFactors ?? []).find((f) => f.code === "diversification") ?? null;
  factors.push(
    diversification
      ? { code: "diversification", label: "Diversification", score: diversification.score, available: true, detail: diversification.detail, sourceModule: "Options Income Engine — portfolioDashboard.ts healthFactors[diversification]" }
      : unavailable("diversification", "Diversification", "No open options-income positions to diversify across yet."),
  );

  // 2. Sector Concentration — averages Engine 1's real sector-exposure
  // ScoreCard with Engine 3's own "concentration" health factor, when both
  // are available; either alone otherwise.
  const investingSector = investingRisk?.sectorExposure.score ?? null;
  const optionsConcentrationFactor = (optionsIncome?.healthFactors ?? []).find((f) => f.code === "concentration") ?? null;
  const sectorScore = avg([investingSector, optionsConcentrationFactor?.score ?? null]);
  factors.push({
    code: "sector_concentration",
    label: "Sector Concentration",
    score: sectorScore,
    available: sectorScore !== null,
    detail:
      sectorScore === null
        ? "No sector-classified holdings resolved in either the Investing or Options Income portfolios."
        : `${investingRisk?.sectorExposure.detail ?? "Investing sector data unavailable."} ${optionsConcentrationFactor ? optionsConcentrationFactor.detail : ""}`.trim(),
    sourceModule: "Investing Engine — computePortfolioRisk().sectorExposure + Options Income Engine — portfolioDashboard.ts healthFactors[concentration]",
  });

  // 3. Position Sizing — averages Engine 2's real position-sizing ScoreCard
  // with Engine 3's own "position_sizing_quality" health factor.
  const tradingSizing = tradingRisk?.positionSizing.score ?? null;
  const optionsSizingFactor = (optionsIncome?.healthFactors ?? []).find((f) => f.code === "position_sizing_quality") ?? null;
  const sizingScore = avg([tradingSizing, optionsSizingFactor?.score ?? null]);
  factors.push({
    code: "position_sizing",
    label: "Position Sizing",
    score: sizingScore,
    available: sizingScore !== null,
    detail:
      sizingScore === null
        ? "No open Trading or Options Income positions to size-check yet."
        : `${tradingRisk?.positionSizing.detail ?? "Trading position-sizing data unavailable."} ${optionsSizingFactor ? optionsSizingFactor.detail : ""}`.trim(),
    sourceModule: "Trading Engine — computeTradingRisk().positionSizing + Options Income Engine — portfolioDashboard.ts healthFactors[position_sizing_quality]",
  });

  // 4. Cash Allocation — always honestly unavailable. No engine in this
  // codebase scores "healthy cash %" — Engine 3's buyingPower is a raw
  // dollar figure with no established banding to reuse, and Engines 1/2
  // have no cash concept at all (advisory-only, no real brokerage cash
  // tracking). A raw, unscored reference figure is still shown when
  // resolvable, never a fabricated 0-100 reading.
  const cashPct = optionsIncome && optionsIncome.portfolioValue > 0 ? Math.round((optionsIncome.buyingPower / optionsIncome.portfolioValue) * 1000) / 10 : null;
  factors.push({
    code: "cash_allocation",
    label: "Cash Allocation",
    score: null,
    available: false,
    detail:
      cashPct !== null
        ? `No established cash-allocation health scoring model exists across any engine. For reference only: Options Income buying power is ${cashPct}% of portfolio value.`
        : "No established cash-allocation health scoring model exists across any engine, and no buying-power figure is currently resolvable.",
    sourceModule: "Not computed by any module in this codebase",
  });

  // 5. Open Risk — Engine 2's real portfolio-risk-budget ScoreCard (% of
  // account at risk vs. its own named 6% cap).
  const openRiskScore = tradingRisk?.portfolioBudget.score ?? null;
  factors.push(
    openRiskScore !== null
      ? { code: "open_risk", label: "Open Risk", score: openRiskScore, available: true, detail: tradingRisk!.portfolioBudget.detail, sourceModule: "Trading Engine — computeTradingRisk().portfolioBudget" }
      : unavailable("open_risk", "Open Risk", "No open Trading positions with resolvable account-value risk yet."),
  );

  // 6. Portfolio Volatility — always honestly unavailable. Engine 2's own
  // Market Regime Engine computes REAL realized volatility, but only
  // per-symbol from candle data — never a portfolio-weighted, covariance-
  // aware blend, which would need the very correlation data factor 7 below
  // also doesn't have.
  factors.push(
    unavailable(
      "portfolio_volatility",
      "Portfolio Volatility",
      "No portfolio-level (weighted, covariance-aware) volatility model exists in this codebase — only per-symbol technical volatility (Engine 2's Market Regime Engine) is computed, and blending those into one portfolio figure would require correlation data this platform doesn't have (see Correlation below).",
    ),
  );

  // 7. Correlation — always honestly unavailable as a numeric coefficient.
  // Engine 3's own real categorical clusters (positions sharing an
  // underlying/sector/strategy/expiration) are surfaced as context, never
  // presented as a correlation figure.
  const clusterCount = optionsConcentration?.clusters.length ?? 0;
  factors.push(
    unavailable(
      "correlation",
      "Correlation",
      clusterCount > 0
        ? `No statistical correlation coefficient is computed anywhere in this codebase. ${clusterCount} categorical cluster${clusterCount === 1 ? "" : "s"} exist in your Options Income portfolio (positions sharing the same underlying, sector, strategy, or expiration) — see Correlation Risk below for detail.`
        : "No statistical correlation coefficient is computed anywhere in this codebase, and no categorical position clusters were found.",
      "Options Income Engine — portfolioConcentration.ts clusters (categorical grouping, never a correlation coefficient)",
    ),
  );

  // 8. Maximum Drawdown — reuses the EXACT same "worst scenario by
  // portfolioValueImpact" derivation institutionalMentor.ts already
  // established (Phase 2), applied here to the dashboard's own already-
  // computed default-scenario stress-test summary — zero new stress-test
  // logic, zero new scenario shocks.
  const stressTestSummary = optionsIncome?.stressTestSummary ?? [];
  const worstScenario = stressTestSummary.length > 0 ? [...stressTestSummary].sort((a, b) => a.portfolioValueImpact - b.portfolioValueImpact)[0] : null;
  factors.push(
    worstScenario
      ? {
          code: "maximum_drawdown",
          label: "Maximum Drawdown",
          score: worstScenario.riskScoreAfter,
          available: true,
          detail: `Worst modeled scenario ("${worstScenario.label}"): portfolio value impact of ${worstScenario.portfolioValueImpact.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}.`,
          sourceModule: "Options Income Engine — portfolioStressTest.ts scenarios[] (worst by portfolioValueImpact, same derivation as institutionalMentor.ts)",
        }
      : unavailable("maximum_drawdown", "Maximum Drawdown", "No stress-test scenarios available — requires at least one open options-income position."),
  );

  // 9. Decision Quality — reuses Decision Workflow's own already-computed
  // DecisionScore for the user's most recently active decision.
  factors.push(
    decisionSummary.tradePlan && decisionSummary.score
      ? { code: "decision_quality", label: "Decision Quality", score: decisionSummary.score.overall, available: true, detail: `Most recent decision in progress: ${decisionSummary.score.label} (${decisionSummary.score.overall}/100).`, sourceModule: "Decision Workflow — useActiveDecisionSummary()" }
      : unavailable("decision_quality", "Decision Quality", "No decision currently in progress."),
  );

  // 10. Trade Quality — averages Sprint 14's own already-computed
  // per-plan completionPct across every active (non-archived, non-
  // cancelled) trade plan.
  const activeRecords = lifecycleRecords.filter((r) => r.outcome === "active" && r.currentStage !== "archived");
  const tradeQualityScore = activeRecords.length > 0 ? avg(activeRecords.map((r) => r.completionPct)) : null;
  factors.push(
    tradeQualityScore !== null
      ? { code: "trade_quality", label: "Trade Quality", score: tradeQualityScore, available: true, detail: `Average lifecycle completion across ${activeRecords.length} active trade plan${activeRecords.length === 1 ? "" : "s"}.`, sourceModule: "Execution & Lifecycle Manager — useTradeLifecyclePipeline() (average completionPct)" }
      : unavailable("trade_quality", "Trade Quality", "No active trade plans yet."),
  );

  // 11. Journal Completion — the exact same set-difference computation
  // InstitutionalCommandCentre.tsx's own journalOutstanding already uses.
  const journalScore = closedTradesCount > 0 && journalOutstanding !== null ? Math.round((100 * (closedTradesCount - journalOutstanding)) / closedTradesCount) : null;
  factors.push(
    journalScore !== null
      ? { code: "journal_completion", label: "Journal Completion", score: journalScore, available: true, detail: `${closedTradesCount - (journalOutstanding ?? 0)} of ${closedTradesCount} recently closed trades journaled.`, sourceModule: "Command Centre — journalOutstanding (closed trades vs. journal entries set difference)" }
      : unavailable("journal_completion", "Journal Completion", "No recently closed trades yet."),
  );

  // 12. Learning Completion — averages Learning Centre's own already-
  // computed per-path percentComplete.
  const learningScore = learningProgress && learningProgress.pathCompletion.length > 0 ? avg(learningProgress.pathCompletion.map((p) => p.percentComplete)) : null;
  factors.push(
    learningScore !== null
      ? { code: "learning_completion", label: "Learning Completion", score: learningScore, available: true, detail: `Average completion across ${learningProgress!.pathCompletion.length} learning path${learningProgress!.pathCompletion.length === 1 ? "" : "s"}.`, sourceModule: "Learning Centre — useGetLearningProgress().pathCompletion" }
      : unavailable("learning_completion", "Learning Completion", "No learning path progress recorded yet."),
  );

  const availableFactors = factors.filter((f) => f.available && f.score !== null);
  const overall = availableFactors.length === 0 ? 0 : Math.round(availableFactors.reduce((s, f) => s + (f.score ?? 0), 0) / availableFactors.length);
  const availableRatio = availableFactors.length / factors.length;
  const confidenceLevel: ConfidenceLevel = availableRatio >= 0.8 ? "High" : availableRatio >= 0.5 ? "Moderate" : "Low";

  return { overall, label: healthLabel(overall), factors, confidenceLevel, generatedAt: new Date().toISOString() };
}

// ─── Risk Intelligence ────────────────────────────────────────────────────

export type RiskSignalCode =
  | "portfolio_concentration"
  | "sector_exposure"
  | "currency_exposure"
  | "country_exposure"
  | "single_position_risk"
  | "open_trade_risk"
  | "total_portfolio_risk"
  | "correlation_risk"
  | "liquidity_risk"
  | "pending_trade_impact";

export interface RiskSignal {
  code: RiskSignalCode;
  label: string;
  available: boolean;
  headline: string;
  detail: string;
  sourceModule: string;
}

export interface RiskIntelligenceReport {
  signals: RiskSignal[];
  generatedAt: string;
}

const fmtUsd0 = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function computeRiskIntelligence(input: PortfolioIntelligenceInput): RiskIntelligenceReport {
  const { optionsIncome, optionsConcentration, investingRisk, tradingRisk, lifecycleRecords } = input;
  const signals: RiskSignal[] = [];

  // 1. Portfolio Concentration — largest single-position reading from
  // whichever engines have resolvable positions.
  const optionsLargest = optionsIncome?.largestPosition;
  const investingLargestPct = investingRisk?.concentration.largestSymbolWeightPct ?? null;
  if (optionsLargest || investingLargestPct !== null) {
    signals.push({
      code: "portfolio_concentration",
      label: "Portfolio Concentration",
      available: true,
      headline: optionsLargest ? `${optionsLargest.symbol}: ${optionsLargest.pctOfAccount.toFixed(1)}% of account` : `${investingRisk!.concentration.largestSymbol}: ${investingLargestPct!.toFixed(1)}% of portfolio`,
      detail: [optionsLargest ? `Options Income: largest single-symbol risk is ${optionsLargest.symbol} at ${optionsLargest.pctOfAccount.toFixed(1)}% of account.` : null, investingRisk ? investingRisk.concentration.detail : null].filter(Boolean).join(" "),
      sourceModule: "Options Income Engine — portfolioDashboard.ts largestPosition + Investing Engine — computePortfolioRisk().concentration",
    });
  } else {
    signals.push({ code: "portfolio_concentration", label: "Portfolio Concentration", available: false, headline: "Not available", detail: "No positions resolved in either the Options Income or Investing portfolios.", sourceModule: "" });
  }

  // 2. Sector Exposure
  if (investingRisk?.sectorExposure.largestSector || optionsConcentration) {
    const largestOptionsSector = (optionsIncome?.allocationBySector ?? [])[0] ?? null;
    signals.push({
      code: "sector_exposure",
      label: "Sector Exposure",
      available: true,
      headline: investingRisk?.sectorExposure.largestSector
        ? `${investingRisk.sectorExposure.largestSector}: ${investingRisk.sectorExposure.largestSectorWeightPct?.toFixed(1)}%`
        : largestOptionsSector
          ? `${largestOptionsSector.label}: ${largestOptionsSector.weightPct.toFixed(1)}%`
          : "Not available",
      detail: [investingRisk?.sectorExposure.detail ?? null, largestOptionsSector ? `Options Income's largest sector allocation is ${largestOptionsSector.label} at ${largestOptionsSector.weightPct.toFixed(1)}%.` : null].filter(Boolean).join(" "),
      sourceModule: "Investing Engine — computePortfolioRisk().sectorExposure + Options Income Engine — portfolioDashboard.ts allocationBySector",
    });
  } else {
    signals.push({ code: "sector_exposure", label: "Sector Exposure", available: false, headline: "Not available", detail: "No sector-classified holdings resolved in either engine.", sourceModule: "" });
  }

  // 3-4. Currency / Country Exposure — always honestly unavailable.
  signals.push({ code: "currency_exposure", label: "Currency Exposure", available: false, headline: "Not tracked", detail: "No multi-currency or foreign-exchange holdings tracking exists anywhere in this codebase — every position is assumed USD-denominated.", sourceModule: "" });
  signals.push({ code: "country_exposure", label: "Country Exposure", available: false, headline: "Not tracked", detail: "No country-of-domicile classification exists anywhere in this codebase for any held symbol.", sourceModule: "" });

  // 5. Single-Position Risk — Engine 2's real cap-check.
  if (tradingRisk) {
    signals.push({
      code: "single_position_risk",
      label: "Single-Position Risk",
      available: true,
      headline: tradingRisk.positionSizing.largestPositionSymbol ? `${tradingRisk.positionSizing.largestPositionSymbol}: ${tradingRisk.positionSizing.largestPositionRiskPct?.toFixed(1)}% risk` : "No open positions",
      detail: tradingRisk.positionSizing.detail,
      sourceModule: "Trading Engine — computeTradingRisk().positionSizing",
    });
  } else {
    signals.push({ code: "single_position_risk", label: "Single-Position Risk", available: false, headline: "Not available", detail: "No open Trading positions resolved.", sourceModule: "" });
  }

  // 6. Open Trade Risk — Engine 2's portfolio risk budget.
  if (tradingRisk?.portfolioBudget) {
    signals.push({
      code: "open_trade_risk",
      label: "Open Trade Risk",
      available: true,
      headline: tradingRisk.portfolioBudget.totalRiskDollars !== null ? `${fmtUsd0(tradingRisk.portfolioBudget.totalRiskDollars)} (${tradingRisk.portfolioBudget.totalRiskUsedPct?.toFixed(1)}%)` : "Not available",
      detail: tradingRisk.portfolioBudget.detail,
      sourceModule: "Trading Engine — computeTradingRisk().portfolioBudget",
    });
  } else {
    signals.push({ code: "open_trade_risk", label: "Open Trade Risk", available: false, headline: "Not available", detail: "No open Trading positions with a resolvable account value.", sourceModule: "" });
  }

  // 7. Total Portfolio Risk — a plain sum of two already-computed dollar
  // figures, never a new risk formula. Investing Engine holdings are
  // typically long-term buy-and-hold and not risk-budgeted the same way
  // as Trading/Options positions, so they're deliberately excluded from
  // this sum, disclosed here rather than silently combined.
  const optionsRiskDollars = optionsIncome?.totalRiskDollars ?? null;
  const tradingRiskDollars = tradingRisk?.portfolioBudget.totalRiskDollars ?? null;
  const totalRiskDollars = optionsRiskDollars !== null || tradingRiskDollars !== null ? (optionsRiskDollars ?? 0) + (tradingRiskDollars ?? 0) : null;
  signals.push(
    totalRiskDollars !== null
      ? {
          code: "total_portfolio_risk",
          label: "Total Portfolio Risk",
          available: true,
          headline: fmtUsd0(totalRiskDollars),
          detail: "Combined open-risk dollars across Options Income + Trading positions. The Investing Engine's own holdings are typically long-term and not risk-budgeted the same way, so they're deliberately excluded from this sum.",
          sourceModule: "Options Income Engine — portfolioDashboard.ts totalRiskDollars + Trading Engine — computeTradingRisk().portfolioBudget.totalRiskDollars",
        }
      : { code: "total_portfolio_risk", label: "Total Portfolio Risk", available: false, headline: "Not available", detail: "No open Options Income or Trading positions.", sourceModule: "" },
  );

  // 8. Correlation Risk — real categorical clusters, never a coefficient.
  const clusters = optionsConcentration?.clusters ?? [];
  signals.push(
    clusters.length > 0
      ? { code: "correlation_risk", label: "Correlation Risk", available: true, headline: `${clusters.length} categorical cluster${clusters.length === 1 ? "" : "s"}`, detail: clusters.map((c) => `${c.label} (${c.positionCount} positions)`).join("; "), sourceModule: "Options Income Engine — portfolioConcentration.ts clusters" }
      : { code: "correlation_risk", label: "Correlation Risk", available: false, headline: "Not available", detail: "No statistical correlation coefficient exists anywhere in this codebase; no categorical clusters were found either.", sourceModule: "" },
  );

  // 9. Liquidity Risk — honestly unavailable at portfolio level.
  signals.push({
    code: "liquidity_risk",
    label: "Liquidity Risk",
    available: false,
    headline: "Not aggregated",
    detail: "Per-symbol liquidity scoring exists in the Trading Engine's own Liquidity Engine (Trading Research → Liquidity tab), but is not currently aggregated to a portfolio-wide figure here.",
    sourceModule: "",
  });

  // 10. Pending Trade Impact — a real count from Sprint 14's own lifecycle
  // pipeline, never a fabricated dollar sum (Ready-to-Execute plans have
  // no numeric risk figure until executed — see What-If Analysis).
  const readyToExecute = lifecycleRecords.filter((r) => r.currentStage === "ready-to-execute");
  signals.push({
    code: "pending_trade_impact",
    label: "Pending Trade Impact",
    available: true,
    headline: readyToExecute.length > 0 ? `${readyToExecute.length} plan${readyToExecute.length === 1 ? "" : "s"} Ready to Execute` : "None pending",
    detail:
      readyToExecute.length > 0
        ? `${readyToExecute.map((r) => r.tradePlan.title).join(", ")} — use What-If Analysis below to estimate portfolio impact before acting.`
        : "No trade plans are currently Ready to Execute.",
    sourceModule: "Execution & Lifecycle Manager — useTradeLifecyclePipeline() (stage: ready-to-execute)",
  });

  return { signals, generatedAt: new Date().toISOString() };
}

// ─── What-If Analysis — pure arithmetic over already-known caps/figures,
// never a new risk-scoring formula. Analysis only, never execution. ──────

export interface WhatIfInput {
  tradePlanId: number;
  tradePlanTitle: string;
  coachId: CoachId;
  hypotheticalRiskDollars: number;
  hypotheticalSymbol: string;
}

export interface WhatIfResult {
  input: WhatIfInput;
  currentTotalRiskDollars: number | null;
  hypotheticalTotalRiskDollars: number | null;
  currentTotalRiskPct: number | null;
  hypotheticalTotalRiskPct: number | null;
  capBreached: boolean | null;
  capLabel: string | null;
  approxWorstCaseDrawdownPct: number | null;
  notes: string[];
}

// Mirrors, never imports, the backend's own named cap constants (values
// only — the same cross-package "duplicate the constant, never the logic"
// precedent lib/investingUniverse.ts's TRADING_MARKET_UNIVERSE already
// established for a different pair of engines).
const TRADING_MAX_PORTFOLIO_RISK_PCT = 6;
const INVESTING_SECTOR_CONCENTRATION_CAP_PCT = 40;

export function computeWhatIfAnalysis(
  input: WhatIfInput,
  current: { totalRiskDollars: number | null; accountValue: number | null; worstDrawdownPct: number | null },
): WhatIfResult {
  const { totalRiskDollars, accountValue, worstDrawdownPct } = current;
  const notes: string[] = [];

  const hypotheticalTotalRiskDollars = totalRiskDollars !== null ? totalRiskDollars + input.hypotheticalRiskDollars : null;
  const currentTotalRiskPct = totalRiskDollars !== null && accountValue ? Math.round((10000 * totalRiskDollars) / accountValue) / 100 : null;
  const hypotheticalTotalRiskPct = hypotheticalTotalRiskDollars !== null && accountValue ? Math.round((10000 * hypotheticalTotalRiskDollars) / accountValue) / 100 : null;

  let capBreached: boolean | null = null;
  let capLabel: string | null = null;
  if (input.coachId === "trading" && hypotheticalTotalRiskPct !== null) {
    capBreached = hypotheticalTotalRiskPct > TRADING_MAX_PORTFOLIO_RISK_PCT;
    capLabel = `Trading Engine's own ${TRADING_MAX_PORTFOLIO_RISK_PCT}% portfolio-risk cap`;
  } else if (input.coachId === "investing") {
    capLabel = `Investing Engine's own ${INVESTING_SECTOR_CONCENTRATION_CAP_PCT}% sector-concentration cap`;
    notes.push("Sector-concentration impact for this specific symbol isn't computed here — check the Investing Engine's own Portfolio Construction risk view after adding this holding.");
  } else {
    notes.push("Options Income Engine has no single named portfolio-risk-percentage cap to check against — the before/after dollar and percentage figures above are shown for reference.");
  }

  const approxWorstCaseDrawdownPct =
    worstDrawdownPct !== null && totalRiskDollars !== null && totalRiskDollars > 0 && hypotheticalTotalRiskDollars !== null
      ? Math.round(worstDrawdownPct * (hypotheticalTotalRiskDollars / totalRiskDollars) * 100) / 100
      : null;
  if (approxWorstCaseDrawdownPct !== null) {
    notes.push("Worst-case drawdown is a proportional approximation scaled from the Options Income Engine's own most recent worst stress-test scenario — not a fresh re-run of that scenario against this specific hypothetical trade.");
  } else {
    notes.push("Worst-case scenario stress testing exists only for the Options Income Engine's own portfolio; not available for this trade plan's engine.");
  }

  return {
    input,
    currentTotalRiskDollars: totalRiskDollars,
    hypotheticalTotalRiskDollars,
    currentTotalRiskPct,
    hypotheticalTotalRiskPct,
    capBreached,
    capLabel,
    approxWorstCaseDrawdownPct,
    notes,
  };
}

// ─── AI Portfolio Coach — deterministic narrative over already-computed
// factors/signals, mirrors buildDecisionCoachNarrative()'s own established
// pattern exactly. The page's real free-form Q&A still routes through the
// platform's existing AskCoachLauncher — never a second, duplicate AI
// system. ───────────────────────────────────────────────────────────────

export interface PortfolioCoachNarrative {
  healthExplanation: string;
  strongestFactors: string[];
  weakestFactors: string[];
  largestRisks: string[];
  institutionalBestPractice: string;
  suggestedResearch: string[];
}

const STRONG_THRESHOLD = 70;
const WEAK_THRESHOLD = 45;

export function buildPortfolioCoachNarrative(health: PortfolioHealthScore, risk: RiskIntelligenceReport): PortfolioCoachNarrative {
  const available = health.factors.filter((f) => f.available && f.score !== null);
  const healthExplanation =
    available.length === 0
      ? "No factors are scored yet — start by opening a position in at least one engine, or completing a Trade Plan."
      : `Your Portfolio Health Score is ${health.overall}/100 (${health.label}), averaged across ${available.length} of 12 factors: ${available.map((f) => f.label).join(", ")}.`;

  const strongestFactors = available.filter((f) => (f.score ?? 0) >= STRONG_THRESHOLD).map((f) => `${f.label} (${f.score}%)`);
  const weakestFactors = available.filter((f) => (f.score ?? 0) < WEAK_THRESHOLD).map((f) => `${f.label} (${f.score}%) — ${f.detail}`);

  const largestRisks = risk.signals.filter((s) => s.available && (s.code === "portfolio_concentration" || s.code === "single_position_risk" || s.code === "open_trade_risk" || s.code === "total_portfolio_risk")).map((s) => `${s.label}: ${s.headline}`);

  const institutionalBestPractice =
    "Institutional desks review portfolio health on a fixed cadence (not reactively), diversify deliberately rather than accidentally, and size every position against a named account-risk cap — never against conviction alone.";

  const suggestedResearch = weakestFactors.length > 0 ? weakestFactors.slice(0, 3).map((_, i) => available.filter((f) => (f.score ?? 0) < WEAK_THRESHOLD)[i]?.label ?? "").filter(Boolean) : ["No urgent research areas — every scored factor is at least moderate."];

  return { healthExplanation, strongestFactors, weakestFactors, largestRisks, institutionalBestPractice, suggestedResearch };
}

// ─── Learning integration — real, pre-verified pathKey/topicKey pairs,
// checked directly against learningPaths.ts before being committed (same
// verification discipline DECISION_LEARNING_RECOMMENDATIONS/
// LIFECYCLE_LEARNING_RECOMMENDATIONS already established). ────────────────

export const PORTFOLIO_LEARNING_RECOMMENDATIONS: Partial<Record<HealthFactorCode, { pathKey: string; topicKey: string; label: string }>> = {
  diversification: { pathKey: "portfolio", topicKey: "portfolio-diversification", label: "Diversification" },
  sector_concentration: { pathKey: "portfolio", topicKey: "portfolio-diversification", label: "Diversification" },
  position_sizing: { pathKey: "portfolio", topicKey: "portfolio-position-sizing", label: "Position Sizing" },
  correlation: { pathKey: "portfolio", topicKey: "portfolio-correlation", label: "Correlation" },
  open_risk: { pathKey: "trading-engine", topicKey: "trading-risk-management", label: "Risk Management" },
  maximum_drawdown: { pathKey: "trading-engine", topicKey: "trading-risk-management", label: "Risk Management" },
};

export function recommendedPortfolioLesson(weakestFactorCode: HealthFactorCode | null): { pathKey: string; topicKey: string; label: string } | null {
  if (!weakestFactorCode) return null;
  return PORTFOLIO_LEARNING_RECOMMENDATIONS[weakestFactorCode] ?? null;
}

export function weakestAvailableFactor(health: PortfolioHealthScore): HealthFactor | null {
  const available = health.factors.filter((f) => f.available && f.score !== null);
  if (available.length === 0) return null;
  return [...available].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
}
