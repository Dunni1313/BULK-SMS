// Institutional Intelligence Engine sprint — Phase 8, Sprint 1 (AI Coach
// Foundation). Observation Engine + Explanation Engine.
//
// Every observation below is a deterministic, rule-based derivation
// from figures ALREADY computed by an existing, unmodified module —
// primarily lib/portfolioDashboard.ts's own PortfolioDashboardResult
// (itself already a composition of Position Sizing, Portfolio Stress
// Test, Event Risk, and Correlation & Concentration — see that file's
// own header for its own reuse chain), plus lib/thetaIncome.ts's own
// ThetaIncome. This module introduces ZERO new pricing/risk/portfolio
// calculations — every "signal" here is either a direct read of an
// already-classified field (e.g. dash.guidance's own codes, an already-
// computed health-factor score) or a trend comparison via
// intelligenceTrend.ts's own computeTrend() against the most recently
// recorded prior day's snapshot (never a fabricated trend when no prior
// snapshot exists — the observation is simply not emitted).
//
// This is NOT an LLM integration, NOT a chatbot, and NOT a statistical
// prediction engine — every observation is 100% reproducible by
// re-running the same rule against the same already-computed inputs.
// No trade recommendation, no execution suggestion, and no probability
// estimate is ever generated — "confidence" (below) is a disclosed
// classification of how directly each observation traces back to an
// already-computed source, never an AI-style likelihood.

import type { PortfolioDashboardResult } from "./portfolioDashboard.js";
import type { ThetaIncome } from "./thetaIncome.js";
import type { IntelligenceSnapshotRow } from "@workspace/db";
import { computeTrend, type TrendResult } from "./intelligenceTrend.js";
import { learningLinksFor, type LearningCategory, type LearningLink } from "./intelligenceLearning.js";

export type ObservationSeverity = "info" | "positive" | "watch" | "elevated";

export interface ObservationMetric {
  label: string;
  value: string;
}

export type ObservationConfidence = "high" | "moderate";

export interface Observation {
  code: string;
  category: LearningCategory;
  severity: ObservationSeverity;
  title: string;
  explanation: string;
  supportingMetrics: ObservationMetric[];
  sourceModule: string;
  timestamp: string;
  confidence: ObservationConfidence;
  confidenceReason: string;
  learningLinks: LearningLink[];
}

// Named, disclosed thresholds for the handful of genuinely new banding
// rules this engine introduces (never a fabricated statistical model —
// simple threshold derivations over already-computed 0-100 health-
// factor scores, the same "state a reasonable default, disclose it"
// precedent as every prior sprint's own named constants).
export const LARGE_EXPOSURE_SCORE_THRESHOLD = 40;
export const HEALTH_SCORE_TREND_THRESHOLD_PCT = 3;

function fmtUsd(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtPct(n: number): string {
  return `${n.toFixed(2)}%`;
}

function healthFactor(dash: PortfolioDashboardResult, code: string) {
  return dash.healthFactors.find((f) => f.code === code) ?? null;
}

function baseObservation(
  code: string,
  category: LearningCategory,
  severity: ObservationSeverity,
  title: string,
  explanation: string,
  supportingMetrics: ObservationMetric[],
  sourceModule: string,
  timestamp: string,
  confidence: ObservationConfidence,
  confidenceReason: string,
): Observation {
  return {
    code,
    category,
    severity,
    title,
    explanation,
    supportingMetrics,
    sourceModule,
    timestamp,
    confidence,
    confidenceReason,
    learningLinks: learningLinksFor(category),
  };
}

// ─── Trend-based observations (require a prior snapshot; never fabricated) ──

function portfolioHealthObservation(
  dash: PortfolioDashboardResult,
  prior: IntelligenceSnapshotRow | null,
  timestamp: string,
): Observation | null {
  const trend = computeTrend(dash.healthScore, prior?.healthScore ?? null, HEALTH_SCORE_TREND_THRESHOLD_PCT);
  if (trend.direction === "insufficient_history" || trend.direction === "stable") return null;
  const improved = trend.direction === "improving";
  return baseObservation(
    improved ? "portfolio_health_improved" : "portfolio_health_declined",
    "portfolio_health",
    improved ? "positive" : "watch",
    improved ? "Portfolio Health improved" : "Portfolio Health declined",
    improved
      ? `Portfolio Health Score rose from ${prior!.healthScore} to ${dash.healthScore} since the last recorded snapshot.`
      : `Portfolio Health Score fell from ${prior!.healthScore} to ${dash.healthScore} since the last recorded snapshot.`,
    [
      { label: "Current Health Score", value: `${dash.healthScore}/100` },
      { label: "Prior Health Score", value: `${prior!.healthScore}/100` },
      { label: "Change", value: `${trend.changeAbs! > 0 ? "+" : ""}${trend.changeAbs}` },
    ],
    "portfolioDashboard.ts — healthScore",
    timestamp,
    "moderate",
    "Comparative trend based on exactly one prior recorded snapshot.",
  );
}

function buyingPowerObservation(
  dash: PortfolioDashboardResult,
  prior: IntelligenceSnapshotRow | null,
  timestamp: string,
): Observation | null {
  const trend = computeTrend(dash.buyingPower, prior?.buyingPower ?? null);
  if (trend.direction === "insufficient_history" || trend.direction === "stable") return null;
  const increasing = trend.direction === "improving";
  return baseObservation(
    increasing ? "buying_power_increasing" : "buying_power_decreasing",
    "buying_power",
    "info",
    increasing ? "Buying Power increasing" : "Buying Power decreasing",
    `Buying power moved from ${fmtUsd(prior!.buyingPower)} to ${fmtUsd(dash.buyingPower)} since the last recorded snapshot (${trend.changePct}%).`,
    [
      { label: "Current Buying Power", value: fmtUsd(dash.buyingPower) },
      { label: "Prior Buying Power", value: fmtUsd(prior!.buyingPower) },
      { label: "Change", value: `${trend.changePct}%` },
    ],
    "portfolioDashboard.ts — buyingPower",
    timestamp,
    "moderate",
    "Comparative trend based on exactly one prior recorded snapshot.",
  );
}

function thetaIncomeObservation(
  theta: ThetaIncome,
  prior: IntelligenceSnapshotRow | null,
  timestamp: string,
): Observation | null {
  const trend = computeTrend(theta.monthly, prior?.thetaMonthly ?? null);
  if (trend.direction === "insufficient_history" || trend.direction === "stable") return null;
  const improving = trend.direction === "improving";
  return baseObservation(
    improving ? "theta_income_improving" : "theta_income_slowing",
    "theta_income",
    improving ? "positive" : "watch",
    improving ? "Theta income improving" : "Theta income slowing",
    `Projected monthly theta income moved from ${fmtUsd(prior!.thetaMonthly)} to ${fmtUsd(theta.monthly)} since the last recorded snapshot (${trend.changePct}%).`,
    [
      { label: "Current Monthly Theta", value: fmtUsd(theta.monthly) },
      { label: "Prior Monthly Theta", value: fmtUsd(prior!.thetaMonthly) },
      { label: "Change", value: `${trend.changePct}%` },
    ],
    "thetaIncome.ts — monthly",
    timestamp,
    "moderate",
    "Comparative trend based on exactly one prior recorded snapshot.",
  );
}

function diversificationObservation(
  dash: PortfolioDashboardResult,
  prior: IntelligenceSnapshotRow | null,
  timestamp: string,
): Observation | null {
  const factor = healthFactor(dash, "diversification");
  if (!factor) return null;
  const trend = computeTrend(factor.score, prior?.diversificationScore ?? null, HEALTH_SCORE_TREND_THRESHOLD_PCT);
  if (trend.direction === "insufficient_history" || trend.direction === "stable") return null;
  const improving = trend.direction === "improving";
  return baseObservation(
    improving ? "diversification_improving" : "diversification_declining",
    "diversification",
    improving ? "positive" : "watch",
    improving ? "Diversification improving" : "Diversification declining",
    `Sector-level diversification health factor moved from ${prior!.diversificationScore}/100 to ${factor.score}/100 since the last recorded snapshot.`,
    [
      { label: "Current Score", value: `${factor.score}/100` },
      { label: "Prior Score", value: `${prior!.diversificationScore}/100` },
    ],
    "portfolioConcentration.ts — breakdowns.sector.concentrationScore",
    timestamp,
    "moderate",
    "Comparative trend based on exactly one prior recorded snapshot.",
  );
}

// ─── Point-in-time observations (always available, no history needed) ──────

function concentrationObservation(dash: PortfolioDashboardResult, timestamp: string): Observation | null {
  const elevated = dash.guidance.some((g) => g.code === "elevated_concentration" || g.code === "review_large_positions");
  if (!elevated) return null;
  const factor = healthFactor(dash, "concentration");
  return baseObservation(
    "concentration_elevated",
    "concentration",
    "elevated",
    "Concentration elevated",
    dash.highestConcentration
      ? `${dash.highestConcentration.bucket.label} accounts for ${fmtPct(dash.highestConcentration.bucket.weightPct)} of deployed portfolio risk.`
      : "The Correlation & Concentration overlay reports elevated concentration.",
    [
      { label: "Concentration Health Factor", value: factor ? `${factor.score}/100` : "—" },
      ...(dash.highestConcentration ? [{ label: "Largest Position", value: `${dash.highestConcentration.bucket.label} (${fmtPct(dash.highestConcentration.bucket.weightPct)})` }] : []),
    ],
    "portfolioConcentration.ts — riskGuidance / summary.largestConcentration",
    timestamp,
    "high",
    "Directly reused from the Correlation & Concentration overlay's own already-classified guidance.",
  );
}

function directionalExposureObservation(dash: PortfolioDashboardResult, timestamp: string): Observation | null {
  const factor = healthFactor(dash, "directional_exposure");
  if (!factor || factor.score >= LARGE_EXPOSURE_SCORE_THRESHOLD) return null;
  return baseObservation(
    "large_directional_exposure",
    "directional_exposure",
    "elevated",
    "Large directional exposure",
    dash.highestDirectionalExposure
      ? `The portfolio is net ${dash.highestDirectionalExposure.direction} with ${fmtUsd(dash.highestDirectionalExposure.exposureDollars)} of directional exposure.`
      : "The portfolio's long/short exposure is meaningfully imbalanced.",
    [
      { label: "Directional Exposure Health Factor", value: `${factor.score}/100` },
      ...(dash.highestDirectionalExposure
        ? [{ label: "Net Exposure", value: `${fmtUsd(dash.highestDirectionalExposure.exposureDollars)} (${dash.highestDirectionalExposure.direction})` }]
        : []),
    ],
    "portfolioConcentration.ts — longShort.longPct / shortPct",
    timestamp,
    "high",
    "Directly derived from the Correlation & Concentration overlay's own already-computed long/short split.",
  );
}

function greeksExposureObservation(dash: PortfolioDashboardResult, timestamp: string): Observation | null {
  const factor = healthFactor(dash, "net_greeks_exposure");
  if (!factor || factor.score >= LARGE_EXPOSURE_SCORE_THRESHOLD) return null;
  return baseObservation(
    "large_greeks_exposure",
    "greeks_exposure",
    "elevated",
    "Large Greeks exposure",
    dash.largestRiskContributor
      ? `${dash.largestRiskContributor.symbol} accounts for ${fmtPct(dash.largestRiskContributor.deltaSharePct)} of total portfolio delta exposure.`
      : "A single position accounts for a large share of total portfolio delta exposure.",
    [
      { label: "Net Greeks Exposure Health Factor", value: `${factor.score}/100` },
      ...(dash.largestRiskContributor
        ? [{ label: "Largest Contributor", value: `${dash.largestRiskContributor.symbol} (${fmtPct(dash.largestRiskContributor.deltaSharePct)} of delta)` }]
        : []),
    ],
    "portfolioConcentration.ts — greeksContributions[0].deltaSharePct",
    timestamp,
    "high",
    "Directly derived from the Correlation & Concentration overlay's own already-computed Greeks contribution ranking.",
  );
}

function eventRiskObservation(dash: PortfolioDashboardResult, timestamp: string): Observation | null {
  const level = dash.highestEventRisk?.riskLevel;
  if (level !== "high" && level !== "medium") return null;
  const factor = healthFactor(dash, "event_risk");
  return baseObservation(
    "event_risk_elevated",
    "event_risk",
    "elevated",
    "Event Risk elevated",
    `${dash.highestEventRisk!.symbol} carries a "${level}" event-risk classification from the Earnings & Event Risk Portfolio Overlay.`,
    [
      { label: "Event Risk Health Factor", value: factor ? `${factor.score}/100` : "—" },
      { label: "Highest Risk Position", value: `${dash.highestEventRisk!.symbol} (${level})` },
    ],
    "portfolioEventRisk.ts — summary.highestRiskPosition",
    timestamp,
    "high",
    "Directly reused from the Earnings & Event Risk Portfolio Overlay's own already-classified risk level.",
  );
}

function brokerStatusObservation(dash: PortfolioDashboardResult, timestamp: string): Observation | null {
  if (!dash.credentialsConfigured) return null;
  if (dash.brokerConnected !== false) return null;
  return baseObservation(
    "broker_disconnected",
    "broker_status",
    "watch",
    "Broker disconnected",
    "The most recent Broker Health check did not report a successful connection to the configured Alpaca Paper account.",
    [
      { label: "Broker Connected", value: "No" },
      { label: "Last Successful Check", value: dash.lastBrokerCheckAt ?? "Never" },
    ],
    "portfolioDashboard.ts — brokerConnected / lastBrokerCheckAt",
    timestamp,
    "high",
    "Directly reused from the cached Broker Health disclosure — never a live check triggered by this engine.",
  );
}

function paperTradingActiveObservation(timestamp: string): Observation {
  return baseObservation(
    "paper_trading_active",
    "paper_trading_status",
    "info",
    "Paper Trading active",
    "This platform operates in Paper Trading mode only — every figure above reflects a simulated account, never real capital.",
    [{ label: "Mode", value: "Paper Trading" }],
    "platform — paperTradingMode",
    timestamp,
    "high",
    "A structural platform fact, not a derived calculation.",
  );
}

function credentialsUnavailableObservation(dash: PortfolioDashboardResult, timestamp: string): Observation | null {
  if (dash.credentialsConfigured) return null;
  return baseObservation(
    "credentials_unavailable",
    "credentials_status",
    "watch",
    "Credentials unavailable",
    "No Alpaca Paper Trading credentials are configured, so no Broker Health check can be performed.",
    [{ label: "Credentials Configured", value: "No" }],
    "portfolioDashboard.ts — credentialsConfigured",
    timestamp,
    "high",
    "Directly reused from the cached credentials disclosure.",
  );
}

export interface ObservationTrends {
  health: TrendResult;
  buyingPower: TrendResult;
  theta: TrendResult;
}

export function buildObservations(
  dash: PortfolioDashboardResult,
  theta: ThetaIncome,
  prior: IntelligenceSnapshotRow | null,
  timestamp: string = new Date().toISOString(),
): Observation[] {
  const observations = [
    portfolioHealthObservation(dash, prior, timestamp),
    buyingPowerObservation(dash, prior, timestamp),
    thetaIncomeObservation(theta, prior, timestamp),
    diversificationObservation(dash, prior, timestamp),
    concentrationObservation(dash, timestamp),
    directionalExposureObservation(dash, timestamp),
    greeksExposureObservation(dash, timestamp),
    eventRiskObservation(dash, timestamp),
    brokerStatusObservation(dash, timestamp),
    paperTradingActiveObservation(timestamp),
    credentialsUnavailableObservation(dash, timestamp),
  ].filter((o): o is Observation => o !== null);
  return observations;
}

// Explanation Engine — a stable formatting entry point over an
// already-built Observation, so every future AI module reads "why did
// this happen" the same way rather than re-deriving its own explanation
// format. Never adds new information beyond what the Observation itself
// already carries.
export interface Explanation {
  why: string;
  contributingMetrics: ObservationMetric[];
  sourceModule: string;
  reviewSuggestion: string;
}

export function explainObservation(observation: Observation): Explanation {
  return {
    why: observation.explanation,
    contributingMetrics: observation.supportingMetrics,
    sourceModule: observation.sourceModule,
    reviewSuggestion:
      observation.learningLinks.find((l) => !l.comingSoon)?.label ??
      "No specific existing page is directly linked to this observation.",
  };
}
