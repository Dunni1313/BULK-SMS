// Institutional Mentor — Phase 8, Sprint 5. The final intelligence layer
// of the Ravish Institutional Trading Operating System: teaches the user
// how a professional portfolio manager would evaluate THEIR OWN existing
// Paper Trading portfolio, using the same platform data every other
// engine already computes.
//
// PURE COMPOSITION. This module introduces ZERO new pricing, risk, or
// scoring calculations beyond a small number of DISCLOSED, named,
// threshold-banding constants (the same "state a reasonable default,
// disclose it" precedent this codebase has followed since Position
// Sizing's own BUYING_POWER_EXHAUSTION_THRESHOLD_PCT and Portfolio
// Dashboard's own EVENT_RISK_LEVEL_HEALTH_SCORE) for the ONE genuinely
// new figure introduced here (Income Generation's 0-100 score — no
// existing 0-100 income score exists anywhere else in this codebase to
// project directly, the same honest gap AI Portfolio Analyst already
// disclosed for Premium Collected/Income Forecast). Every other
// Scorecard category, Professional Review observation, Decision Review
// item, and narrative Review section is a direct pass-through, a plain
// array filter/sort/group, or the already-existing computeTrend()
// primitive applied to a genuinely stored historical figure (never a
// fabricated trend).
//
// Reused, unmodified: buildPortfolioDashboard() (Health/Risk/Capital/
// Position-Sizing/Greeks/Event source data), buildPortfolioConcentrationOverlay()
// (Diversification/Capital-Allocation/Correlation source data),
// buildPortfolioStressTest() (Risk Management source data),
// buildPortfolioEventRiskOverlay() (Event Preparation source data),
// buildTradeJournal() (Discipline/Behaviour/Decision source data — the
// AI Trade Journal, Phase 8 Sprint 4), currentOpenTrades(),
// computeTradeGreeks(), computeThetaIncome() (Income source data),
// computeTrend() (every historical trend below), learningLinksFor(),
// getLearningTopic(), getGlossaryTerm(), getStrategyAcademyEntry()
// (Institutional Lessons). Not an LLM, not a chatbot, not predictive AI,
// not financial advice, not portfolio optimisation, not trade
// recommendations, not execution logic.
//
// portfolioDashboard.ts/portfolioStressTest.ts/portfolioConcentration.ts/
// portfolioEventRisk.ts/positionSizing.ts/tradeJournal.ts/execution.ts/
// optionsMath.ts/risk.ts/autoExecution.ts/autoAdjustment.ts are read
// from, never modified — this file's own zero-line diff on those modules
// is confirmed by regression tests proving every reused figure is
// byte-identical to a standalone call.
//
// This module NEVER contacts a broker execution endpoint, NEVER creates
// or modifies an order or position, and NEVER performs a database write
// of any kind — every function here is read-only (it deliberately does
// NOT call ensureSeedTrades(), matching every prior sprint in this
// family's own "no portfolio mutation, taken literally" precedent). The
// only write this module can ever trigger is the same, already-existing,
// at-most-once-per-calendar-day intelligence_snapshots insert
// buildInstitutionalIntelligence()/buildPortfolioAnalyst() already
// perform indirectly via their own reused sub-builders — this module
// itself calls none of those, so it triggers no write of its own at all.

import { and, desc, eq, gte, lt } from "drizzle-orm";
import {
  db,
  intelligenceSnapshotsTable,
  valueWatchlistTable,
  investingPortfoliosTable,
  investingHoldingsTable,
  investingDecisionSnapshotsTable,
  investingDecisionNotesTable,
  investingSavedScreensTable,
  type IntelligenceSnapshotRow,
} from "@workspace/db";
import {
  buildPortfolioDashboard,
  type PortfolioDashboardResult,
  type DashboardGuidanceAdvisory,
  DASHBOARD_HEALTHY_MIN,
  DASHBOARD_MODERATE_MIN,
  DASHBOARD_ELEVATED_MIN,
} from "./portfolioDashboard.js";
import {
  buildPortfolioConcentrationOverlay,
  type PortfolioConcentrationResult,
  type ConcentrationBucket,
} from "./portfolioConcentration.js";
import { buildPortfolioStressTest, type PortfolioStressTestResult, type ScenarioComparisonEntry } from "./portfolioStressTest.js";
import { currentOpenTrades } from "./positionSizing.js";
import { computeTradeGreeks, getAccountValue } from "./serverState.js";
import { computeThetaIncome, type ThetaIncome } from "./thetaIncome.js";
import { computeTrend, type TrendDirection } from "./intelligenceTrend.js";
import {
  buildTradeJournal,
  type AITradeJournalResult,
  type BehaviorPattern,
  type BehaviorTrend,
  type DecisionQualitySummary,
  DISCIPLINE_PATTERN_THRESHOLD_PCT,
} from "./tradeJournal.js";
import { learningLinksFor, type LearningCategory, type LearningLink } from "./intelligenceLearning.js";
import { getLearningTopic } from "./learningPaths.js";
import { getGlossaryTerm } from "./glossary.js";
import { getStrategyAcademyEntry, type StrategyAcademyKey } from "./strategyAcademy.js";

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

// ─── Grading ─────────────────────────────────────────────────────────────────
// Reuses portfolioDashboard.ts's own already-exported 4-tier banding
// thresholds (DASHBOARD_HEALTHY_MIN/MODERATE_MIN/ELEVATED_MIN) — the same
// Excellent/Good/Fair/Poor split applied to every Scorecard category's
// own 0-100 score, rather than a second, competing threshold set.

export type MentorGrade = "Excellent" | "Good" | "Fair" | "Poor";

function gradeFor(score: number): MentorGrade {
  if (score >= DASHBOARD_HEALTHY_MIN) return "Excellent";
  if (score >= DASHBOARD_MODERATE_MIN) return "Good";
  if (score >= DASHBOARD_ELEVATED_MIN) return "Fair";
  return "Poor";
}

// ─── Portfolio Scorecard ─────────────────────────────────────────────────────
// 9 categories, each a direct projection of an ALREADY-COMPUTED figure
// from one of the reused overlays, cited by sourceModule so this is
// auditable rather than opaque — the same discipline
// portfolioDashboard.ts's own buildHealthFactors() already established.
// The one genuinely new figure (Income Generation) uses 4 small, named,
// disclosed threshold constants below.

export const INCOME_POSITIVE_THETA_BASE_SCORE = 80;
export const INCOME_ZERO_THETA_BASE_SCORE = 50;
export const INCOME_NEGATIVE_THETA_BASE_SCORE = 20;
export const INCOME_TREND_ADJUSTMENT = 10;

export type MentorScorecardCategory =
  | "capital_allocation"
  | "risk_management"
  | "diversification"
  | "discipline"
  | "income_generation"
  | "position_sizing"
  | "greeks_management"
  | "event_preparation"
  | "portfolio_health";

export interface MentorScorecardEntry {
  category: MentorScorecardCategory;
  label: string;
  score: number;
  grade: MentorGrade;
  sourceModule: string;
  why: string;
}

function clampScore(n: number): number {
  return Math.round(Math.max(0, Math.min(100, n)));
}

function incomeGenerationScore(positionsCount: number, monthlyTheta: number, trend: TrendDirection): number {
  if (positionsCount === 0) return 100;
  let base =
    monthlyTheta > 0
      ? INCOME_POSITIVE_THETA_BASE_SCORE
      : monthlyTheta === 0
        ? INCOME_ZERO_THETA_BASE_SCORE
        : INCOME_NEGATIVE_THETA_BASE_SCORE;
  if (trend === "improving") base += INCOME_TREND_ADJUSTMENT;
  else if (trend === "declining") base -= INCOME_TREND_ADJUSTMENT;
  return clampScore(base);
}

function worstStressScenarioByRiskScore(stressTest: PortfolioStressTestResult): ScenarioComparisonEntry | null {
  if (stressTest.scenarios.length === 0) return null;
  return [...stressTest.scenarios].sort((a, b) => a.riskScoreAfter - b.riskScoreAfter)[0];
}

function worstStressScenarioByImpact(stressTest: PortfolioStressTestResult): ScenarioComparisonEntry | null {
  if (stressTest.scenarios.length === 0) return null;
  return [...stressTest.scenarios].sort((a, b) => a.portfolioValueImpact - b.portfolioValueImpact)[0];
}

function buildScorecard(
  dash: PortfolioDashboardResult,
  concentration: PortfolioConcentrationResult,
  stressTest: PortfolioStressTestResult,
  journal: AITradeJournalResult,
  theta: ThetaIncome,
  incomeTrend: TrendDirection,
): MentorScorecardEntry[] {
  const strategyScore = concentration.breakdowns.strategy;
  const worstStress = worstStressScenarioByRiskScore(stressTest);
  const positionSizingFactor = dash.healthFactors.find((f) => f.code === "position_sizing_quality")!;
  const greeksFactor = dash.healthFactors.find((f) => f.code === "net_greeks_exposure")!;
  const eventFactor = dash.healthFactors.find((f) => f.code === "event_risk")!;
  const incomeScore = incomeGenerationScore(dash.openPositionsCount, theta.monthly, incomeTrend);

  return [
    {
      category: "capital_allocation",
      label: "Capital Allocation",
      score: clampScore(100 - strategyScore.concentrationScore),
      grade: gradeFor(100 - strategyScore.concentrationScore),
      sourceModule: "portfolioConcentration.ts — breakdowns.strategy.concentrationScore",
      why: `Capital is spread across ${strategyScore.buckets.length} strateg${strategyScore.buckets.length === 1 ? "y" : "ies"} with a strategy-level concentration score of ${strategyScore.concentrationScore}/100.`,
    },
    {
      category: "risk_management",
      label: "Risk Management",
      score: worstStress ? worstStress.riskScoreAfter : stressTest.riskScoreBefore,
      grade: gradeFor(worstStress ? worstStress.riskScoreAfter : stressTest.riskScoreBefore),
      sourceModule: "portfolioStressTest.ts — scenarios[].riskScoreAfter (worst scenario)",
      why: worstStress
        ? `The worst modeled stress scenario ("${worstStress.label}") leaves a risk score of ${worstStress.riskScoreAfter}/100 (portfolio value impact ${worstStress.portfolioValueImpact.toFixed(2)}).`
        : `Base-case risk score of ${stressTest.riskScoreBefore}/100 — no stress scenarios were evaluated.`,
    },
    {
      category: "diversification",
      label: "Diversification",
      score: concentration.summary.diversificationScore,
      grade: gradeFor(concentration.summary.diversificationScore),
      sourceModule: "portfolioConcentration.ts — summary.diversificationScore",
      why: `Diversification score of ${concentration.summary.diversificationScore}/100 across symbol, sector, strategy, and expiration dimensions.`,
    },
    {
      category: "discipline",
      label: "Discipline",
      score: journal.disciplineScore,
      grade: gradeFor(journal.disciplineScore),
      sourceModule: "tradeJournal.ts — disciplineScore (AI Trade Journal)",
      why: `${journal.decisionQualitySummary.sizingRespectedRatePct}% of closed trades respected position-sizing policy; ${journal.decisionQualitySummary.ruleBasedExitRatePct}% exited by a defined rule (stop-loss or profit target).`,
    },
    {
      category: "income_generation",
      label: "Income Generation",
      score: incomeScore,
      grade: gradeFor(incomeScore),
      sourceModule: "thetaIncome.ts — computeThetaIncome().monthly (banded, disclosed thresholds)",
      why:
        dash.openPositionsCount === 0
          ? "No open positions — no income currently expected."
          : `Monthly theta income is ${theta.monthly.toFixed(2)} (trend: ${incomeTrend}).`,
    },
    {
      category: "position_sizing",
      label: "Position Sizing",
      score: positionSizingFactor.score,
      grade: gradeFor(positionSizingFactor.score),
      sourceModule: "portfolioDashboard.ts — healthFactors.position_sizing_quality",
      why: positionSizingFactor.detail,
    },
    {
      category: "greeks_management",
      label: "Greeks Management",
      score: greeksFactor.score,
      grade: gradeFor(greeksFactor.score),
      sourceModule: "portfolioDashboard.ts — healthFactors.net_greeks_exposure",
      why: greeksFactor.detail,
    },
    {
      category: "event_preparation",
      label: "Event Preparation",
      score: eventFactor.score,
      grade: gradeFor(eventFactor.score),
      sourceModule: "portfolioDashboard.ts — healthFactors.event_risk",
      why: eventFactor.detail,
    },
    {
      category: "portfolio_health",
      label: "Portfolio Health",
      score: dash.healthScore,
      grade: gradeFor(dash.healthScore),
      sourceModule: "portfolioDashboard.ts — healthScore (blended)",
      why: `Blended Health Score of ${dash.healthScore}/100 (${dash.overallRiskRating.label}).`,
    },
  ];
}

// ─── Professional Review ─────────────────────────────────────────────────────
// Deterministic, fixed-template observations in the requested
// institutional-PM voice — every sentence gated by an already-computed
// threshold or a genuinely stored historical figure, never a new score
// and never a trade recommendation. The exact same technique the Summary
// Engine (intelligenceSummary.ts) and AI Portfolio Analyst's own
// buildInstitutionalInsights() already established.

export interface ProfessionalObservation {
  text: string;
  category: string;
  sourceModule: string;
}

function buildProfessionalReview(
  dash: PortfolioDashboardResult,
  scorecard: MentorScorecardEntry[],
  incomeTrend: TrendDirection,
  theta: ThetaIncome,
  diversificationWeeklyTrend: TrendDirection,
): ProfessionalObservation[] {
  const obs: ProfessionalObservation[] = [];
  const scoreFor = (c: MentorScorecardCategory) => scorecard.find((s) => s.category === c)!;

  const topSector = dash.allocationBySector[0];
  if (topSector) {
    obs.push({
      text: `An institutional portfolio manager would note that ${topSector.label} exposure represents ${topSector.weightPct}% of total allocation.`,
      category: "allocation",
      sourceModule: "portfolioConcentration.ts — breakdowns.sector",
    });
  }

  const capitalGrade = scoreFor("capital_allocation").grade;
  if (capitalGrade === "Excellent" || capitalGrade === "Good") {
    obs.push({ text: "Capital allocation remains balanced across strategies.", category: "capital_allocation", sourceModule: "portfolioConcentration.ts — breakdowns.strategy" });
  } else {
    obs.push({ text: "Capital allocation is concentrated in a small number of strategies.", category: "capital_allocation", sourceModule: "portfolioConcentration.ts — breakdowns.strategy" });
  }

  if (dash.openPositionsCount > 0) {
    if (incomeTrend === "stable" && theta.monthly > 0) {
      obs.push({ text: "Income generation is stable.", category: "income", sourceModule: "thetaIncome.ts" });
    } else if (incomeTrend === "improving") {
      obs.push({ text: "Income generation is improving.", category: "income", sourceModule: "thetaIncome.ts" });
    } else if (incomeTrend === "declining") {
      obs.push({ text: "Income generation is declining.", category: "income", sourceModule: "thetaIncome.ts" });
    }
  }

  const healthGrade = scoreFor("portfolio_health").grade;
  if (healthGrade === "Excellent") {
    obs.push({ text: "Portfolio health remains excellent.", category: "health", sourceModule: "portfolioDashboard.ts — healthScore" });
  } else if (healthGrade === "Poor") {
    obs.push({ text: "Portfolio health requires review.", category: "health", sourceModule: "portfolioDashboard.ts — healthScore" });
  }

  if (dash.overallRiskRating.code === "healthy") {
    obs.push({ text: "Risk remains well-controlled.", category: "risk", sourceModule: "portfolioDashboard.ts — overallRiskRating" });
  } else if (dash.overallRiskRating.code === "moderate_risk") {
    obs.push({ text: "Risk remains moderate.", category: "risk", sourceModule: "portfolioDashboard.ts — overallRiskRating" });
  } else {
    obs.push({ text: `Risk remains ${dash.overallRiskRating.label.toLowerCase()}.`, category: "risk", sourceModule: "portfolioDashboard.ts — overallRiskRating" });
  }

  if (diversificationWeeklyTrend === "improving") {
    obs.push({ text: "Diversification improved this week.", category: "diversification", sourceModule: "portfolioConcentration.ts — summary.diversificationScore (weekly trend via intelligence_snapshots)" });
  } else if (diversificationWeeklyTrend === "declining") {
    obs.push({ text: "Diversification declined this week.", category: "diversification", sourceModule: "portfolioConcentration.ts — summary.diversificationScore (weekly trend via intelligence_snapshots)" });
  }

  if (dash.openPositionsCount === 0) {
    obs.push({ text: "The portfolio currently holds no open positions.", category: "portfolio", sourceModule: "positionSizing.ts — currentOpenTrades()" });
  }

  return obs;
}

// ─── Decision Review ─────────────────────────────────────────────────────────
// Explains completed decisions — never a recommendation. Reuses the AI
// Trade Journal's own decisionQualitySummary/behaviorPatterns
// (retrospective, per-trade discipline) plus the Portfolio Dashboard's
// own guidance advisories (current-state, portfolio-level policy checks)
// — two genuinely different, already-computed sources, never
// re-deriving either.

export type DecisionReviewStatus = "followed" | "exceeded" | "improved" | "declined" | "neutral";

export interface DecisionReviewItem {
  code: string;
  text: string;
  status: DecisionReviewStatus;
  sourceModule: string;
  detail: string;
}

function buildDecisionReview(
  journal: AITradeJournalResult,
  dash: PortfolioDashboardResult,
  diversificationWeeklyTrend: TrendDirection,
  incomeTrend: TrendDirection,
): DecisionReviewItem[] {
  const items: DecisionReviewItem[] = [];

  items.push(
    journal.decisionQualitySummary.sizingRespectedRatePct >= DISCIPLINE_PATTERN_THRESHOLD_PCT
      ? {
          code: "sizing_followed_plan",
          text: "Position sizing followed plan.",
          status: "followed",
          sourceModule: "tradeJournal.ts — decisionQualitySummary.sizingRespectedRatePct",
          detail: `${journal.decisionQualitySummary.sizingRespectedRatePct}% of closed trades respected the configured max-risk-per-trade limit.`,
        }
      : {
          code: "sizing_exceeded_policy",
          text: "Position sizing exceeded policy on some trades.",
          status: "exceeded",
          sourceModule: "tradeJournal.ts — decisionQualitySummary.sizingRespectedRatePct",
          detail: `Only ${journal.decisionQualitySummary.sizingRespectedRatePct}% of closed trades respected the configured max-risk-per-trade limit (threshold ${DISCIPLINE_PATTERN_THRESHOLD_PCT}%).`,
        },
  );

  const riskGuidance = dash.guidance.find(
    (g: DashboardGuidanceAdvisory) =>
      g.code === "elevated_concentration" || g.code === "review_large_positions" || g.code === "elevated_risk" || g.code === "high_risk",
  );
  items.push(
    riskGuidance
      ? { code: "risk_allocation_exceeded", text: "Risk allocation exceeded policy on the current portfolio.", status: "exceeded", sourceModule: "portfolioDashboard.ts — guidance", detail: riskGuidance.detail }
      : {
          code: "risk_allocation_followed",
          text: "Risk allocation remains within policy.",
          status: "followed",
          sourceModule: "portfolioDashboard.ts — guidance",
          detail: `Overall risk rating is ${dash.overallRiskRating.label} — no risk-allocation advisory was triggered.`,
        },
  );

  if (diversificationWeeklyTrend === "improving" || diversificationWeeklyTrend === "declining") {
    const improved = diversificationWeeklyTrend === "improving";
    items.push({
      code: improved ? "diversification_improved" : "diversification_declined",
      text: improved ? "Diversification improved." : "Diversification declined.",
      status: improved ? "improved" : "declined",
      sourceModule: "portfolioConcentration.ts — summary.diversificationScore (weekly trend via intelligence_snapshots)",
      detail: `Diversification score has ${improved ? "risen" : "fallen"} over the trailing 7 recorded days.`,
    });
  }

  if (dash.openPositionsCount > 0 && (incomeTrend === "improving" || incomeTrend === "declining")) {
    const improved = incomeTrend === "improving";
    items.push({
      code: improved ? "income_consistency_improved" : "income_consistency_declined",
      text: improved ? "Income consistency improved." : "Income consistency declined.",
      status: improved ? "improved" : "declined",
      sourceModule: "thetaIncome.ts + intelligenceTrend.ts — monthly theta vs. prior recorded snapshot",
      detail: `Monthly theta income trend is ${incomeTrend}.`,
    });
  }

  const earningsPattern = journal.behaviorPatterns.find((p) => p.code === "repeated_earnings_exposure");
  if (earningsPattern) {
    items.push({
      code: "held_through_earnings",
      text: "Held through earnings on multiple occasions.",
      status: "neutral",
      sourceModule: "tradeJournal.ts — behaviorPatterns.repeated_earnings_exposure",
      detail: earningsPattern.detail,
    });
  }

  items.push(
    dash.overallRiskRating.code === "healthy" || dash.overallRiskRating.code === "moderate_risk"
      ? {
          code: "avoided_excessive_leverage",
          text: "Avoided excessive leverage.",
          status: "followed",
          sourceModule: "portfolioDashboard.ts — overallRiskRating",
          detail: `Overall risk rating is ${dash.overallRiskRating.label}, within the healthy/moderate range.`,
        }
      : {
          code: "leverage_review_recommended",
          text: "Total risk exposure warrants review.",
          status: "exceeded",
          sourceModule: "portfolioDashboard.ts — overallRiskRating",
          detail: `Overall risk rating is ${dash.overallRiskRating.label}.`,
        },
  );

  return items;
}

// ─── Capital Allocation Review ───────────────────────────────────────────────
// Reuses Portfolio Dashboard (buying power, portfolio value) and the
// Concentration overlay's own strategy/symbol breakdowns. Cash
// utilisation is simple arithmetic on 2 already-computed numbers
// (1 - buyingPower/portfolioValue) — not a new statistical model.

export interface CapitalAllocationReview {
  capitalEfficiencyScore: number;
  capitalEfficiencyGrade: MentorGrade;
  allocationByStrategy: ConcentrationBucket[];
  positionDistribution: ConcentrationBucket[];
  cashUtilizationPct: number;
  buyingPower: number;
  portfolioValue: number;
  summary: string;
}

function buildCapitalAllocationReview(
  dash: PortfolioDashboardResult,
  concentration: PortfolioConcentrationResult,
  scorecard: MentorScorecardEntry[],
): CapitalAllocationReview {
  const capital = scorecard.find((s) => s.category === "capital_allocation")!;
  const cashUtilizationPct = dash.portfolioValue > 0 ? round((1 - dash.buyingPower / dash.portfolioValue) * 100, 2) : 0;
  return {
    capitalEfficiencyScore: capital.score,
    capitalEfficiencyGrade: capital.grade,
    allocationByStrategy: concentration.breakdowns.strategy.buckets,
    positionDistribution: concentration.breakdowns.symbol.buckets,
    cashUtilizationPct,
    buyingPower: dash.buyingPower,
    portfolioValue: dash.portfolioValue,
    summary:
      dash.openPositionsCount === 0
        ? "No open positions — 100% of buying power remains uncommitted."
        : `${cashUtilizationPct}% of portfolio value is currently deployed across ${dash.openPositionsCount} position${dash.openPositionsCount === 1 ? "" : "s"}, with a capital-allocation grade of ${capital.grade}.`,
  };
}

// ─── Risk Review ─────────────────────────────────────────────────────────────
// Reuses Stress Testing, Event Risk, Concentration, and Portfolio
// Health — all already-computed pass-through fields off
// buildPortfolioDashboard(). Risk trend reuses computeTrend() against
// the genuinely stored prior day's own totalRiskPct
// (intelligence_snapshots.total_risk_pct), the same figure AI Portfolio
// Analyst's own RiskSummarySection already trends.

export interface RiskReview {
  largestPortfolioRisk: string;
  primaryContributor: string;
  riskTrend: TrendDirection;
  riskTrendDetail: string;
  worstStressScenario: { label: string; portfolioValueImpact: number; riskScoreAfter: number } | null;
  highestConcentration: PortfolioDashboardResult["highestConcentration"];
  highestEventRisk: PortfolioDashboardResult["highestEventRisk"];
  guidance: DashboardGuidanceAdvisory[];
  summary: string;
}

function buildRiskReview(
  dash: PortfolioDashboardResult,
  stressTest: PortfolioStressTestResult,
  prior: IntelligenceSnapshotRow | null,
): RiskReview {
  const worst = worstStressScenarioByImpact(stressTest);
  const riskTrend = computeTrend(dash.totalRiskPct, prior?.totalRiskPct ?? null);

  let largestPortfolioRisk = "No elevated risk detected";
  if (dash.highestEventRisk && (dash.highestEventRisk.riskLevel === "high" || dash.highestEventRisk.riskLevel === "medium")) {
    largestPortfolioRisk = `Event Risk (${dash.highestEventRisk.symbol}, ${dash.highestEventRisk.riskLevel})`;
  } else if (dash.highestConcentration) {
    largestPortfolioRisk = `Concentration (${dash.highestConcentration.bucket.label}, ${dash.highestConcentration.bucket.weightPct}% of deployed risk)`;
  }

  const primaryContributor = dash.largestRiskContributor
    ? `${dash.largestRiskContributor.symbol} (${dash.largestRiskContributor.deltaSharePct}% of total portfolio delta)`
    : "No open positions";

  return {
    largestPortfolioRisk,
    primaryContributor,
    riskTrend: riskTrend.direction,
    riskTrendDetail:
      riskTrend.direction === "insufficient_history"
        ? "No prior recorded snapshot exists yet — risk trend will be available after the next recorded day."
        : `Total portfolio risk is ${riskTrend.direction} (currently ${dash.totalRiskPct}% of account value).`,
    worstStressScenario: worst ? { label: worst.label, portfolioValueImpact: worst.portfolioValueImpact, riskScoreAfter: worst.riskScoreAfter } : null,
    highestConcentration: dash.highestConcentration,
    highestEventRisk: dash.highestEventRisk,
    guidance: dash.guidance,
    summary: `Overall risk rating is ${dash.overallRiskRating.label}. Largest identified risk: ${largestPortfolioRisk}.`,
  };
}

// ─── Income Review ───────────────────────────────────────────────────────────
// Theta Income is the one genuinely already-built income metric for
// this platform's real Paper Trading positions. Premium Collected and
// Historical Income for real closed trades do not exist anywhere in
// this codebase and are honestly NOT fabricated here — the same
// disclosure AI Portfolio Analyst's own IncomeSummarySection already
// made. Income Projection reuses Theta Income's own already-computed
// weekly/monthly/annualized figures directly.

export interface IncomeReview {
  monthlyTheta: number;
  weeklyTheta: number;
  dailyTheta: number;
  annualizedTheta: number;
  incomeTrend: TrendDirection;
  incomeTrendDetail: string;
  incomeSourceCount: number;
  bySymbol: ThetaIncome["bySymbol"];
  byStrategy: ThetaIncome["byStrategy"];
  summary: string;
}

function buildIncomeReview(theta: ThetaIncome, prior: IntelligenceSnapshotRow | null): IncomeReview {
  const trend = computeTrend(theta.monthly, prior?.thetaMonthly ?? null);
  const incomeTrendDetail =
    trend.direction === "insufficient_history"
      ? "No prior recorded snapshot exists yet — income trend will be available after the next recorded day."
      : trend.direction === "stable"
        ? `Monthly theta income is stable at ${theta.monthly.toFixed(2)} (prior: ${prior!.thetaMonthly.toFixed(2)}).`
        : trend.direction === "improving"
          ? `Monthly theta income rose from ${prior!.thetaMonthly.toFixed(2)} to ${theta.monthly.toFixed(2)}.`
          : `Monthly theta income fell from ${prior!.thetaMonthly.toFixed(2)} to ${theta.monthly.toFixed(2)}.`;

  return {
    monthlyTheta: theta.monthly,
    weeklyTheta: theta.weekly,
    dailyTheta: theta.daily,
    annualizedTheta: theta.annualized,
    incomeTrend: trend.direction,
    incomeTrendDetail,
    incomeSourceCount: theta.bySymbol.length,
    bySymbol: theta.bySymbol,
    byStrategy: theta.byStrategy,
    summary:
      theta.bySymbol.length === 0
        ? "No open positions currently generating theta income."
        : `Income is generated across ${theta.bySymbol.length} symbol${theta.bySymbol.length === 1 ? "" : "s"} and ${theta.byStrategy.length} strateg${theta.byStrategy.length === 1 ? "y" : "ies"}. Trend: ${trend.direction}.`,
  };
}

// ─── Behaviour Review ────────────────────────────────────────────────────────
// Direct pass-through of the AI Trade Journal's own already-computed
// disciplineScore/decisionQualitySummary/behaviorPatterns/behaviorTrend/
// strengths/areasToImprove — zero new scoring, this review's whole
// purpose is to explain long-term behavioural improvements the AI Trade
// Journal already tracks.

export interface BehaviourReview {
  disciplineScore: number;
  decisionQualitySummary: DecisionQualitySummary;
  behaviorPatterns: BehaviorPattern[];
  behaviorTrend: BehaviorTrend | null;
  strengths: BehaviorPattern[];
  areasToImprove: BehaviorPattern[];
  totalClosedTrades: number;
  summary: string;
}

function buildBehaviourReview(journal: AITradeJournalResult): BehaviourReview {
  return {
    disciplineScore: journal.disciplineScore,
    decisionQualitySummary: journal.decisionQualitySummary,
    behaviorPatterns: journal.behaviorPatterns,
    behaviorTrend: journal.behaviorTrend,
    strengths: journal.strengths,
    areasToImprove: journal.areasToImprove,
    totalClosedTrades: journal.totalClosedTrades,
    summary:
      journal.totalClosedTrades === 0
        ? "No completed trades yet — behavioural analysis will be available once trades close."
        : journal.behaviorTrend
          ? journal.behaviorTrend.detail
          : `Discipline Score of ${journal.disciplineScore}/100 across ${journal.totalClosedTrades} closed trade${journal.totalClosedTrades === 1 ? "" : "s"}.`,
  };
}

// ─── Institutional Lessons ───────────────────────────────────────────────────
// Mirrors AI Portfolio Analyst's own crossLinkFor() pattern exactly —
// reuses intelligenceLearning.ts's own per-category catalog (which
// already appends "Your Portfolio, Explained" — Explain Mode's own
// contextual portfolio-explanation view — and the AI Teacher entry point
// to every category) plus a Strategy Academy entry, never a fabricated
// URL.

export interface MentorLearningCrossLink {
  category: string;
  lessonHref: string | null;
  lessonTitle: string | null;
  glossaryHref: string | null;
  glossaryTerm: string | null;
  strategyHref: string | null;
  strategyLabel: string | null;
  explainModeHref: string | null;
}

const MENTOR_SECTION_CATEGORY: Record<string, LearningCategory> = {
  scorecard: "portfolio_health",
  capital_allocation: "buying_power",
  risk: "concentration",
  income: "theta_income",
  diversification: "diversification",
  greeks_management: "greeks_exposure",
  event_preparation: "event_risk",
};

const MENTOR_SECTION_STRATEGY: Record<string, StrategyAcademyKey> = {
  scorecard: "iron_condor",
  capital_allocation: "wheel",
  risk: "vertical_spread",
  income: "covered_call",
  diversification: "iron_fly",
  greeks_management: "iron_condor",
  event_preparation: "calendar_spread",
};

// Behaviour has no direct LearningCategory match (it is a Trade-Journal
// concept, not a portfolio-overlay one) — falls back to the same
// "institutional" learning path topic the AI Trade Journal itself
// already uses for exactly this reason.
function behaviourCrossLink(): MentorLearningCrossLink {
  const decisionTopic = getLearningTopic("institutional", "institutional-decision-quality");
  const glossaryTerm = getGlossaryTerm("decision-quality");
  const strategy = getStrategyAcademyEntry("vertical_spread");
  const links = learningLinksFor("portfolio_health");
  const explain = links.find((l: LearningLink) => l.label === "Your Portfolio, Explained") ?? null;
  return {
    category: "behaviour",
    lessonHref: decisionTopic ? `/learn/paths/institutional/institutional-decision-quality` : null,
    lessonTitle: decisionTopic?.title ?? null,
    glossaryHref: glossaryTerm ? `/learn/glossary/decision-quality` : null,
    glossaryTerm: glossaryTerm?.term ?? null,
    strategyHref: strategy ? `/learn/strategy-academy/${strategy.key}` : null,
    strategyLabel: strategy?.label ?? null,
    explainModeHref: explain?.href ?? null,
  };
}

function crossLinkForSection(section: keyof typeof MENTOR_SECTION_CATEGORY): MentorLearningCrossLink {
  const category = MENTOR_SECTION_CATEGORY[section];
  const links = learningLinksFor(category);
  const lesson = links.find((l: LearningLink) => l.label.startsWith("Lesson:")) ?? null;
  const glossary = links.find((l: LearningLink) => l.label.startsWith("Glossary:")) ?? null;
  const explain = links.find((l: LearningLink) => l.label === "Your Portfolio, Explained") ?? null;
  const strategyKey = MENTOR_SECTION_STRATEGY[section];
  const strategy = strategyKey ? getStrategyAcademyEntry(strategyKey) : null;
  return {
    category,
    lessonHref: lesson?.href ?? null,
    lessonTitle: lesson ? lesson.label.replace(/^Lesson:\s*/, "") : null,
    glossaryHref: glossary?.href ?? null,
    glossaryTerm: glossary ? glossary.label.replace(/^Glossary:\s*/, "") : null,
    strategyHref: strategy ? `/learn/strategy-academy/${strategy.key}` : null,
    strategyLabel: strategy?.label ?? null,
    explainModeHref: explain?.href ?? null,
  };
}

export interface MentorLearningSummary {
  scorecard: MentorLearningCrossLink;
  capitalAllocation: MentorLearningCrossLink;
  risk: MentorLearningCrossLink;
  income: MentorLearningCrossLink;
  diversification: MentorLearningCrossLink;
  greeksManagement: MentorLearningCrossLink;
  eventPreparation: MentorLearningCrossLink;
  behaviour: MentorLearningCrossLink;
}

function buildLearningSummary(): MentorLearningSummary {
  return {
    scorecard: crossLinkForSection("scorecard"),
    capitalAllocation: crossLinkForSection("capital_allocation"),
    risk: crossLinkForSection("risk"),
    income: crossLinkForSection("income"),
    diversification: crossLinkForSection("diversification"),
    greeksManagement: crossLinkForSection("greeks_management"),
    eventPreparation: crossLinkForSection("event_preparation"),
    behaviour: behaviourCrossLink(),
  };
}

// ─── Theta Income composition ────────────────────────────────────────────────
// The exact same 3-function composition AI Portfolio Analyst's own
// buildThetaIncome() already uses (currentOpenTrades -> computeTradeGreeks
// -> computeThetaIncome) — duplicated here as glue only (not exported
// from portfolioAnalyst.ts), matching that file's own disclosed
// precedent for why (a private, unexported helper is re-composed from
// its own reused, unmodified building blocks rather than modifying
// portfolioAnalyst.ts to export it).
async function buildThetaIncome(userId: string): Promise<ThetaIncome> {
  const trades = await currentOpenTrades(userId);
  const positions = trades.map((t) => ({
    symbol: t.symbol,
    strategy: t.strategy,
    theta: computeTradeGreeks(t).theta,
  }));
  return computeThetaIncome(positions);
}

// Mirrors intelligenceTimeline.ts's/portfolioAnalyst.ts's own
// "most recent row strictly before today" query — duplicated as a
// query, not as business logic, since neither exports it.
async function mostRecentPriorSnapshot(userId: string, now: Date): Promise<IntelligenceSnapshotRow | null> {
  const today = now.toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(intelligenceSnapshotsTable)
    .where(and(eq(intelligenceSnapshotsTable.userId, userId), lt(intelligenceSnapshotsTable.snapshotDate, today)))
    .orderBy(desc(intelligenceSnapshotsTable.snapshotDate))
    .limit(1);
  return rows[0] ?? null;
}

// A genuine, real, stored 7-day window over intelligence_snapshots'
// own diversificationScore column — a plain SELECT + computeTrend(),
// never a new statistical model, mirroring buildWeeklySummary()'s own
// precedent in portfolioAnalyst.ts (applied there to healthScore,
// applied here to diversificationScore).
async function weeklyDiversificationTrend(userId: string, now: Date): Promise<TrendDirection> {
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(intelligenceSnapshotsTable)
    .where(and(eq(intelligenceSnapshotsTable.userId, userId), gte(intelligenceSnapshotsTable.snapshotDate, cutoff)))
    .orderBy(intelligenceSnapshotsTable.snapshotDate);
  if (rows.length < 2) return "insufficient_history";
  return computeTrend(rows[rows.length - 1].diversificationScore, rows[0].diversificationScore).direction;
}

// Phase 12 — Institutional Investing Engine Consolidation & Integration.
// A single, plain, ownership-scoped read of the user's own Engine 1 Value
// Watchlist (value_watchlist, Phase 2 Sprint 27) — a bounded, additive
// integration point the repository audit identified as missing. This
// introduces ZERO new scoring: currentDecision/marginOfSafetyTarget are
// already-stored fields on the watchlist row itself, written when the
// user added or last researched the symbol via Engine 1's own /value-watchlist
// routes. The only genuinely new logic here is a plain count-and-bucket
// summary sentence over those already-stored decision strings.
export interface WatchlistReviewItem {
  symbol: string;
  category: string;
  currentDecision: string;
  marginOfSafetyTarget: number;
  reason: string;
  lastResearchedAt: string | null;
}

export interface WatchlistReview {
  itemCount: number;
  items: WatchlistReviewItem[];
  summary: string;
}

const WATCHLIST_REVIEW_LIMIT = 10;
const POSITIVE_DECISIONS = new Set(["LONG-TERM BUY", "BUY ONLY ON PULLBACK"]);
const NEGATIVE_DECISIONS = new Set(["TRIM", "AVOID"]);

async function buildWatchlistReview(userId: string): Promise<WatchlistReview> {
  const rows = await db
    .select()
    .from(valueWatchlistTable)
    .where(eq(valueWatchlistTable.userId, userId))
    .orderBy(desc(valueWatchlistTable.createdAt))
    .limit(WATCHLIST_REVIEW_LIMIT);

  const items: WatchlistReviewItem[] = rows.map((r) => ({
    symbol: r.symbol,
    category: r.category,
    currentDecision: r.currentDecision,
    marginOfSafetyTarget: r.marginOfSafetyTarget,
    reason: r.reason,
    lastResearchedAt: r.lastResearchedAt ? r.lastResearchedAt.toISOString() : null,
  }));

  if (items.length === 0) {
    return {
      itemCount: 0,
      items,
      summary: "Your Institutional Investing watchlist is empty. Research a company on the Value Research page and add it to your watchlist to see it reviewed here.",
    };
  }

  const positive = items.filter((i) => POSITIVE_DECISIONS.has(i.currentDecision)).length;
  const negative = items.filter((i) => NEGATIVE_DECISIONS.has(i.currentDecision)).length;
  const summary =
    `You are tracking ${items.length} compan${items.length === 1 ? "y" : "ies"} on your long-term investing watchlist. ` +
    `${positive} carr${positive === 1 ? "ies" : "y"} a favourable (Buy) decision from the deterministic value-investing engine, ` +
    `${negative} carr${negative === 1 ? "ies" : "y"} a Trim/Avoid decision, and the remainder sit at Watchlist/Hold.`;

  return { itemCount: items.length, items, summary };
}

// Phase 13 — Institutional Portfolio Manager. A single, plain,
// ownership-scoped read of the user's own Engine 1 target-allocation
// portfolios (investing_portfolios/investing_holdings, Phase 2 Sprint 28) —
// the same "bounded, additive integration point, zero new scoring" pattern
// buildWatchlistReview() above already established. Introduces no new
// analyzer composition — portfolio/holding counts are already-stored,
// already-cheap counts, not a call into lib/portfolioIntelligence.ts (which
// stays on-demand behind its own route, per that module's own established
// on-demand-vs-eager discipline).
export interface PortfolioReview {
  portfolioCount: number;
  totalHoldingsCount: number;
  summary: string;
}

async function buildPortfolioReview(userId: string): Promise<PortfolioReview> {
  const portfolios = await db
    .select({ id: investingPortfoliosTable.id, name: investingPortfoliosTable.name })
    .from(investingPortfoliosTable)
    .where(eq(investingPortfoliosTable.userId, userId));

  if (portfolios.length === 0) {
    return {
      portfolioCount: 0,
      totalHoldingsCount: 0,
      summary: "You have no target-allocation portfolios yet. Build one on the Institutional Portfolio Manager page to see it reviewed here.",
    };
  }

  const holdingRows = await db
    .select({ id: investingHoldingsTable.id })
    .from(investingHoldingsTable)
    .where(eq(investingHoldingsTable.userId, userId));

  return {
    portfolioCount: portfolios.length,
    totalHoldingsCount: holdingRows.length,
    summary:
      `You are tracking ${portfolios.length} target-allocation portfolio${portfolios.length === 1 ? "" : "s"} ` +
      `with ${holdingRows.length} total holding${holdingRows.length === 1 ? "" : "s"} on the Institutional Portfolio Manager.`,
  };
}

// Phase 14 — Institutional Investment Decision Engine review section. Same
// bounded, additive integration pattern as buildPortfolioReview() above: a
// plain, ownership-scoped count of the user's own saved decision snapshots
// and notes (investing_decision_snapshots/investing_decision_notes) —
// zero new scoring, zero call into lib/decisionEngine.ts's own per-symbol
// composition (that stays on-demand behind its own route). Deliberately
// named DecisionEngineReview, not "DecisionReview" — that name is already
// taken by the Options Engine's own pre-existing decision-journal review
// above, an unrelated concept.
export interface DecisionEngineReview {
  snapshotCount: number;
  noteCount: number;
  distinctSymbolCount: number;
  summary: string;
}

async function buildDecisionEngineReview(userId: string): Promise<DecisionEngineReview> {
  const snapshotRows = await db
    .select({ symbol: investingDecisionSnapshotsTable.symbol })
    .from(investingDecisionSnapshotsTable)
    .where(eq(investingDecisionSnapshotsTable.userId, userId));
  const noteRows = await db
    .select({ symbol: investingDecisionNotesTable.symbol })
    .from(investingDecisionNotesTable)
    .where(eq(investingDecisionNotesTable.userId, userId));

  const distinctSymbols = new Set([...snapshotRows.map((r) => r.symbol), ...noteRows.map((r) => r.symbol)]);

  if (snapshotRows.length === 0 && noteRows.length === 0) {
    return {
      snapshotCount: 0,
      noteCount: 0,
      distinctSymbolCount: 0,
      summary: "You have no saved Decision Engine snapshots or notes yet. Analyze a symbol on the Institutional Decision Engine page to see it reviewed here.",
    };
  }

  return {
    snapshotCount: snapshotRows.length,
    noteCount: noteRows.length,
    distinctSymbolCount: distinctSymbols.size,
    summary:
      `You have ${snapshotRows.length} saved decision snapshot${snapshotRows.length === 1 ? "" : "s"} and ` +
      `${noteRows.length} decision note${noteRows.length === 1 ? "" : "s"} across ${distinctSymbols.size} symbol${distinctSymbols.size === 1 ? "" : "s"} ` +
      `on the Institutional Decision Engine.`,
  };
}

// Phase 15 — Institutional Opportunity Discovery Engine review section. Same
// bounded, additive integration pattern as buildDecisionEngineReview() above:
// a plain, ownership-scoped count of the user's own saved Screener filter
// sets (investing_saved_screens) — zero new scanning/ranking, zero call into
// lib/opportunityDiscovery.ts's own scan orchestration (that stays on-demand
// behind its own page, since a scan is real, non-trivial work).
export interface OpportunityDiscoveryReview {
  savedScreenCount: number;
  summary: string;
}

async function buildOpportunityDiscoveryReview(userId: string): Promise<OpportunityDiscoveryReview> {
  const rows = await db
    .select({ id: investingSavedScreensTable.id })
    .from(investingSavedScreensTable)
    .where(eq(investingSavedScreensTable.userId, userId));

  if (rows.length === 0) {
    return {
      savedScreenCount: 0,
      summary: "You have no saved Screener filter sets yet. Save one on the Institutional Opportunity Discovery page to see it reviewed here.",
    };
  }

  return {
    savedScreenCount: rows.length,
    summary: `You have ${rows.length} saved screen${rows.length === 1 ? "" : "s"} on the Institutional Opportunity Discovery Engine.`,
  };
}

// ─── Top-level assembly ──────────────────────────────────────────────────────

export interface InstitutionalMentorResult {
  paperTradingMode: true;
  deterministicAnalysis: true;
  educationalOnly: true;
  scorecard: MentorScorecardEntry[];
  professionalReview: ProfessionalObservation[];
  decisionReview: DecisionReviewItem[];
  capitalAllocationReview: CapitalAllocationReview;
  riskReview: RiskReview;
  incomeReview: IncomeReview;
  behaviourReview: BehaviourReview;
  learningSummary: MentorLearningSummary;
  watchlistReview: WatchlistReview;
  portfolioReview: PortfolioReview;
  decisionEngineReview: DecisionEngineReview;
  opportunityDiscoveryReview: OpportunityDiscoveryReview;
  generatedAt: string;
}

export async function buildInstitutionalMentor(userId: string, now: Date = new Date()): Promise<InstitutionalMentorResult> {
  // Sequential, not Promise.all — mirrors AI Portfolio Analyst's own
  // disclosed precedent exactly: several of these sub-builders
  // independently resolve the same per-user settings row via
  // serverState.ts's own pre-existing getSettingsRow() (a plain
  // check-then-insert, not an upsert); for a genuinely brand-new user
  // whose row doesn't exist yet, firing them concurrently races two
  // inserts against the same unique constraint. Not this sprint's file
  // to fix (getSettingsRow() itself is shared, foundational code); a
  // sequential await here avoids the race entirely with no other
  // behavior change.
  const dash = await buildPortfolioDashboard(userId);
  const concentration = await buildPortfolioConcentrationOverlay(userId);
  const stressTest = await buildPortfolioStressTest({}, userId);
  const journal = await buildTradeJournal(userId);
  const theta = await buildThetaIncome(userId);
  const priorRow = await mostRecentPriorSnapshot(userId, now);
  const diversificationWeeklyTrend = await weeklyDiversificationTrend(userId, now);

  const incomeTrend = computeTrend(theta.monthly, priorRow?.thetaMonthly ?? null).direction;

  const scorecard = buildScorecard(dash, concentration, stressTest, journal, theta, incomeTrend);
  const professionalReview = buildProfessionalReview(dash, scorecard, incomeTrend, theta, diversificationWeeklyTrend);
  const decisionReview = buildDecisionReview(journal, dash, diversificationWeeklyTrend, incomeTrend);
  const capitalAllocationReview = buildCapitalAllocationReview(dash, concentration, scorecard);
  const riskReview = buildRiskReview(dash, stressTest, priorRow);
  const incomeReview = buildIncomeReview(theta, priorRow);
  const behaviourReview = buildBehaviourReview(journal);
  const learningSummary = buildLearningSummary();
  const watchlistReview = await buildWatchlistReview(userId);
  const portfolioReview = await buildPortfolioReview(userId);
  const decisionEngineReview = await buildDecisionEngineReview(userId);
  const opportunityDiscoveryReview = await buildOpportunityDiscoveryReview(userId);

  return {
    paperTradingMode: true,
    deterministicAnalysis: true,
    educationalOnly: true,
    scorecard,
    professionalReview,
    decisionReview,
    capitalAllocationReview,
    riskReview,
    incomeReview,
    behaviourReview,
    learningSummary,
    watchlistReview,
    portfolioReview,
    decisionEngineReview,
    opportunityDiscoveryReview,
    generatedAt: now.toISOString(),
  };
}
