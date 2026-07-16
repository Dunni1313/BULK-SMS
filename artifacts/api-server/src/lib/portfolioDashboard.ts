// Portfolio Risk Dashboard & Health Score sprint — a single executive
// dashboard unifying every prior read-only Paper Trading portfolio
// overlay this codebase already has: Position Sizing's own
// currentOpenTrades()/buildSnapshot() (lib/positionSizing.ts), the
// Portfolio Stress Test (lib/portfolioStressTest.ts), the Earnings &
// Event Risk Portfolio Overlay (lib/portfolioEventRisk.ts), and the
// Correlation & Concentration Risk Overlay (lib/portfolioConcentration.ts)
// — all reused unmodified, composed here into one Health Score and one
// executive summary. execution.ts, optionsMath.ts, risk.ts,
// autoExecution.ts, and autoAdjustment.ts are NOT modified by this
// sprint.
//
// This module NEVER contacts a broker execution endpoint, NEVER creates
// or modifies an order or position, and NEVER performs a database write
// of any kind — every function here is read-only, and it deliberately
// does NOT call ensureSeedTrades(), matching the same "no portfolio
// mutation, taken literally" precedent every prior sprint in this family
// already established.
//
// Portfolio Health Score scope, honestly disclosed rather than silently
// narrowed: per this sprint's own explicit "do not invent statistical
// models — every component must be derived from existing calculations"
// instruction, every one of the 8 requested Health Score factors below
// is a direct projection of a figure ALREADY computed by one of the 3
// reused overlays (or by buildSnapshot() itself) — never a new pricing
// call, never a new provider call, never a fabricated statistic. Two
// small, disclosed, named threshold constants are introduced
// (EVENT_RISK_LEVEL_HEALTH_SCORE and DASHBOARD_HEALTHY_POSITION_COUNT)
// for the 2 factors ("Event Risk" and "Number of Positions") that have
// no existing 0-100 score to project directly — the exact same "state a
// reasonable default, disclose it" precedent this whole codebase has
// followed since Position Sizing's own
// BUYING_POWER_EXHAUSTION_THRESHOLD_PCT/MAX_LEVERAGE_RATIO. This is a
// simple, transparent threshold/banding derivation over an
// already-computed classification or count — not a fabricated
// statistical model (a real correlation coefficient, a made-up VaR
// figure, or an ML score), which is what the "do not invent" instruction
// guards against, consistent with the Concentration sprint's own
// identical "do not invent new correlation models" scope decision.

import {
  currentOpenTrades,
  buildSnapshot,
  type TradeRow,
  type SymbolExposure,
  type PortfolioGreeksSnapshot,
} from "./positionSizing.js";
import { getAccountValue, getSettingsRow } from "./serverState.js";
import { readAlpacaCreds } from "./providers/alpacaProvider.js";
import {
  getLastBrokerCheckConnected,
  getLastSuccessfulBrokerCheck,
} from "./providers/alpacaBroker.js";
import {
  buildPortfolioStressTest,
  type PortfolioStressTestResult,
} from "./portfolioStressTest.js";
import {
  buildPortfolioEventRiskOverlay,
  type PortfolioEventRiskResult,
} from "./portfolioEventRisk.js";
import { type EventRiskLevel } from "./optionsMath.js";
import {
  buildPortfolioConcentrationOverlay,
  type PortfolioConcentrationResult,
  type ConcentrationBucket,
  CONCENTRATION_HIGH_MAX,
  SECTOR_CONCENTRATION_ADVISORY_THRESHOLD,
} from "./portfolioConcentration.js";

// Named, disclosed thresholds for this sprint's own 2 genuinely new
// (non-directly-reused) Health Score factor derivations — see the file
// header for why these are simple banding constants, not a fabricated
// statistical model.
export const EVENT_RISK_LEVEL_HEALTH_SCORE: Record<EventRiskLevel, number> = {
  none: 100,
  low: 75,
  medium: 50,
  high: 20,
};
export const DASHBOARD_HEALTHY_POSITION_COUNT = 5;

// The same 4-tier overall-rating banding convention already established
// by the Concentration overlay's own CONCENTRATION_WELL_DIVERSIFIED_MAX/
// CONCENTRATION_MODERATE_MAX/CONCENTRATION_HIGH_MAX (a well/moderate/
// high/review 4-way split), applied here to the blended 0-100 Health
// Score itself.
export const DASHBOARD_HEALTHY_MIN = 80;
export const DASHBOARD_MODERATE_MIN = 60;
export const DASHBOARD_ELEVATED_MIN = 40;

export type OverallRiskRatingCode = "healthy" | "moderate_risk" | "elevated_risk" | "high_risk";

export interface OverallRiskRating {
  code: OverallRiskRatingCode;
  label: string;
}

export interface HealthScoreFactor {
  code: string;
  label: string;
  score: number;
  sourceModule: string;
  detail: string;
}

export interface DashboardLargestPosition {
  symbol: string;
  riskDollars: number;
  pctOfAccount: number;
}

export interface DashboardRiskContributor {
  tradeId: number;
  symbol: string;
  delta: number;
  deltaSharePct: number;
}

export interface DashboardWidgetSummary {
  code: string;
  label: string;
  headline: string;
  detail: string;
  linkHref: string;
}

export type DashboardGuidanceCode =
  | "healthy_portfolio"
  | "moderate_risk"
  | "elevated_risk"
  | "high_risk"
  | "elevated_concentration"
  | "elevated_event_risk"
  | "diversification_recommended"
  | "review_large_positions";

export interface DashboardGuidanceAdvisory {
  code: DashboardGuidanceCode;
  label: string;
  detail: string;
}

export interface DashboardStressTestSummaryEntry {
  label: string;
  portfolioValueImpact: number;
  riskScoreAfter: number;
}

export interface PortfolioDashboardResult {
  // Executive Summary
  portfolioValue: number;
  buyingPower: number;
  totalRiskDollars: number;
  totalRiskPct: number;
  healthScore: number;
  overallRiskRating: OverallRiskRating;
  paperTradingMode: true;
  credentialsConfigured: boolean;
  brokerConnected: boolean | null;
  lastBrokerCheckAt: string | null;
  lastPortfolioUpdate: string;
  openPositionsCount: number;

  // Portfolio Health Score breakdown — every factor sourced from an
  // already-computed figure in one of the 3 reused overlays, see file
  // header.
  healthFactors: HealthScoreFactor[];

  // Risk Panels
  netGreeks: PortfolioGreeksSnapshot;
  largestPosition: DashboardLargestPosition | null;
  largestRiskContributor: DashboardRiskContributor | null;
  highestEventRisk: PortfolioEventRiskResult["summary"]["highestRiskPosition"];
  highestConcentration: PortfolioConcentrationResult["summary"]["largestConcentration"];
  highestDirectionalExposure: PortfolioConcentrationResult["summary"]["highestDirectionalExposure"];

  // Dashboard widget cards — each links to its own existing detailed page.
  widgets: DashboardWidgetSummary[];

  // Visualisation data — thin, reused subsets of the 3 overlays' own
  // already-computed output; never recomputed here.
  allocationBySymbol: ConcentrationBucket[];
  allocationBySector: ConcentrationBucket[];
  allocationByStrategy: ConcentrationBucket[];
  expirationDistribution: ConcentrationBucket[];
  eventTimelineSummary: PortfolioEventRiskResult["summary"];
  stressTestSummary: DashboardStressTestSummaryEntry[];

  // Informational-only guidance — never an execution recommendation.
  guidance: DashboardGuidanceAdvisory[];

  generatedAt: string;
}

function clampScore(n: number): number {
  return Math.round(Math.max(0, Math.min(100, n)));
}

function ratingFor(score: number): OverallRiskRating {
  if (score >= DASHBOARD_HEALTHY_MIN) return { code: "healthy", label: "Healthy" };
  if (score >= DASHBOARD_MODERATE_MIN) return { code: "moderate_risk", label: "Moderate Risk" };
  if (score >= DASHBOARD_ELEVATED_MIN) return { code: "elevated_risk", label: "Elevated Risk" };
  return { code: "high_risk", label: "High Risk" };
}

// Every factor below is a direct 0-100 health projection of an
// ALREADY-COMPUTED figure from one of the 3 reused overlays — see the
// file header for the full disclosure. `sourceModule` names exactly
// which existing module/field each factor was derived from, so this is
// auditable rather than opaque.
function buildHealthFactors(
  positionsCount: number,
  concentration: PortfolioConcentrationResult,
  eventRisk: PortfolioEventRiskResult,
  stressTest: PortfolioStressTestResult,
): HealthScoreFactor[] {
  const concentrationScore = concentration.summary.concentrationScore;
  const sectorScore = concentration.breakdowns.sector.concentrationScore;
  const expirationScore = concentration.breakdowns.expiration.concentrationScore;
  const highestRiskLevel = eventRisk.summary.highestRiskPosition?.riskLevel ?? "none";
  const topDeltaSharePct = concentration.greeksContributions[0]?.deltaSharePct ?? 0;
  const { longPct, shortPct } = concentration.longShort;

  return [
    {
      code: "concentration",
      label: "Concentration",
      // Direct reuse of Concentration overlay's own symbol-level
      // Herfindahl-Hirschman-Index concentrationScore (100 = fully
      // concentrated in one symbol) — inverted so higher is healthier.
      score: clampScore(100 - concentrationScore),
      sourceModule: "portfolioConcentration.ts — breakdowns.symbol.concentrationScore",
      detail: `Symbol-level concentration score of ${concentrationScore}/100 from the Concentration overlay.`,
    },
    {
      code: "diversification",
      label: "Diversification",
      // Deliberately the SECTOR dimension (distinct from the symbol-level
      // "Concentration" factor above) so this factor isn't a duplicate of
      // the same number — reused directly from the same overlay's own
      // sector breakdown.
      score: clampScore(100 - sectorScore),
      sourceModule: "portfolioConcentration.ts — breakdowns.sector.concentrationScore",
      detail: `Sector-level concentration score of ${sectorScore}/100 from the Concentration overlay's own sector breakdown.`,
    },
    {
      code: "event_risk",
      label: "Event Risk",
      // A disclosed label→score projection of the Event Risk overlay's
      // own already-classified highest risk level across the portfolio —
      // no new event data, just a health-score view of an existing
      // classification.
      score: EVENT_RISK_LEVEL_HEALTH_SCORE[highestRiskLevel],
      sourceModule: "portfolioEventRisk.ts — summary.highestRiskPosition.riskLevel",
      detail: `Highest portfolio event-risk level is "${highestRiskLevel}" from the Event Risk overlay.`,
    },
    {
      code: "net_greeks_exposure",
      label: "Net Greeks Exposure",
      // Reuses the Concentration overlay's own already-computed
      // greeksContributions[0].deltaSharePct — how much of the
      // portfolio's total |delta| exposure sits in a single position.
      score: positionsCount === 0 ? 100 : clampScore(100 - topDeltaSharePct),
      sourceModule: "portfolioConcentration.ts — greeksContributions[0].deltaSharePct",
      detail:
        positionsCount === 0
          ? "No open positions — no Greeks exposure to concentrate."
          : `The single largest position accounts for ${topDeltaSharePct}% of total portfolio delta exposure.`,
    },
    {
      code: "directional_exposure",
      label: "Directional Exposure",
      // Reuses the Concentration overlay's own already-computed
      // longPct/shortPct (which always sum to 100) — a simple balance
      // measure, not a new statistic.
      score: clampScore(100 - Math.abs(longPct - shortPct)),
      sourceModule: "portfolioConcentration.ts — longShort.longPct / shortPct",
      detail: `Long/short exposure split is ${longPct}% long / ${shortPct}% short from the Concentration overlay.`,
    },
    {
      code: "position_sizing_quality",
      label: "Position Sizing Quality",
      // Direct, unmodified reuse of Portfolio Stress Test's own already-
      // computed riskScoreBefore (itself a disclosed blend of
      // concentration/utilization-vs-cap/drawdown at the zero-shock base
      // case) — zero new formula here.
      score: stressTest.riskScoreBefore,
      sourceModule: "portfolioStressTest.ts — riskScoreBefore",
      detail: `Base-case risk score of ${stressTest.riskScoreBefore}/100 from the Portfolio Stress Test's own existing formula.`,
    },
    {
      code: "position_count",
      label: "Number of Positions",
      // No open positions carries no position-count risk (honestly
      // disclosed as a special case, matching every other overlay's own
      // "empty portfolio is not itself unhealthy" convention). Otherwise
      // a simple linear ramp against one named, disclosed threshold.
      score:
        positionsCount === 0
          ? 100
          : clampScore((positionsCount / DASHBOARD_HEALTHY_POSITION_COUNT) * 100),
      sourceModule: "positionSizing.ts — currentOpenTrades() count",
      detail:
        positionsCount === 0
          ? "No open positions."
          : `${positionsCount} open position${positionsCount === 1 ? "" : "s"} (${DASHBOARD_HEALTHY_POSITION_COUNT}+ treated as adequately diversified by count).`,
    },
    {
      code: "expiration_distribution",
      label: "Expiration Distribution",
      // Direct reuse of the Concentration overlay's own already-computed
      // expiration-dimension Herfindahl-Hirschman-Index score.
      score: clampScore(100 - expirationScore),
      sourceModule: "portfolioConcentration.ts — breakdowns.expiration.concentrationScore",
      detail: `Expiration-date concentration score of ${expirationScore}/100 from the Concentration overlay's own expiration breakdown.`,
    },
  ];
}

function buildGuidance(
  overallRiskRating: OverallRiskRating,
  concentration: PortfolioConcentrationResult,
  eventRisk: PortfolioEventRiskResult,
): DashboardGuidanceAdvisory[] {
  const guidance: DashboardGuidanceAdvisory[] = [];

  const primaryDetail: Record<OverallRiskRatingCode, string> = {
    healthy: "This portfolio's blended Health Score is in the healthy range.",
    moderate_risk: "This portfolio's blended Health Score indicates moderate risk — review the factor breakdown below.",
    elevated_risk: "This portfolio's blended Health Score indicates elevated risk — review the factor breakdown below.",
    high_risk: "This portfolio's blended Health Score indicates high risk — review the factor breakdown below.",
  };
  const primaryLabel: Record<OverallRiskRatingCode, string> = {
    healthy: "Healthy Portfolio",
    moderate_risk: "Moderate Risk",
    elevated_risk: "Elevated Risk",
    high_risk: "High Risk",
  };
  guidance.push({
    code:
      overallRiskRating.code === "healthy"
        ? "healthy_portfolio"
        : overallRiskRating.code === "moderate_risk"
          ? "moderate_risk"
          : overallRiskRating.code === "elevated_risk"
            ? "elevated_risk"
            : "high_risk",
    label: primaryLabel[overallRiskRating.code],
    detail: primaryDetail[overallRiskRating.code],
  });

  // Reuses the Concentration overlay's own already-computed riskGuidance
  // code directly — no new threshold derivation.
  if (
    concentration.riskGuidance.code === "high_concentration" ||
    concentration.riskGuidance.code === "review_exposure"
  ) {
    guidance.push({
      code: "elevated_concentration",
      label: "Elevated Concentration",
      detail: `The Concentration overlay reports "${concentration.riskGuidance.label}" — see the Concentration Risk page for the full breakdown.`,
    });
  }

  // Reuses the Concentration overlay's own already-computed sector-
  // concentration advisory (its own named, exported
  // SECTOR_CONCENTRATION_ADVISORY_THRESHOLD constant) rather than
  // re-deriving a new one.
  if (concentration.breakdowns.sector.concentrationScore >= SECTOR_CONCENTRATION_ADVISORY_THRESHOLD) {
    guidance.push({
      code: "diversification_recommended",
      label: "Diversification Recommended",
      detail: `Sector concentration score is ${concentration.breakdowns.sector.concentrationScore}/100 (advisory threshold ${SECTOR_CONCENTRATION_ADVISORY_THRESHOLD}) — see the Concentration Risk page's own sector breakdown.`,
    });
  }

  // Reuses the Event Risk overlay's own already-computed highRiskCount.
  if (eventRisk.summary.highRiskCount > 0) {
    guidance.push({
      code: "elevated_event_risk",
      label: "Elevated Event Risk",
      detail: `${eventRisk.summary.highRiskCount} position${eventRisk.summary.highRiskCount === 1 ? "" : "s"} carr${eventRisk.summary.highRiskCount === 1 ? "ies" : "y"} high event risk — see the Event Risk page for details.`,
    });
  }

  // Reuses the Concentration overlay's own already-computed largest
  // concentration bucket against its own already-exported
  // CONCENTRATION_HIGH_MAX threshold constant.
  const largest = concentration.summary.largestConcentration;
  if (largest && largest.bucket.weightPct >= CONCENTRATION_HIGH_MAX) {
    guidance.push({
      code: "review_large_positions",
      label: "Review Large Positions",
      detail: `${largest.bucket.label} accounts for ${largest.bucket.weightPct}% of deployed portfolio risk (review threshold ${CONCENTRATION_HIGH_MAX}%).`,
    });
  }

  return guidance;
}

function buildWidgets(
  trades: TradeRow[],
  snapshotExposure: SymbolExposure[],
  concentration: PortfolioConcentrationResult,
  eventRisk: PortfolioEventRiskResult,
  stressTest: PortfolioStressTestResult,
  credentialsConfigured: boolean,
  brokerConnected: boolean | null,
): DashboardWidgetSummary[] {
  return [
    {
      code: "position_sizing",
      label: "Position Sizing",
      headline: `${trades.length} open position${trades.length === 1 ? "" : "s"}`,
      detail:
        snapshotExposure.length > 0
          ? `Largest exposure: ${snapshotExposure[0].symbol} (${snapshotExposure[0].pctOfAccount}% of account).`
          : "No open positions to size.",
      linkHref: "/position-sizing",
    },
    {
      code: "stress_test",
      label: "Stress Test",
      headline: `Base risk score ${stressTest.riskScoreBefore}/100`,
      detail: `Base-case portfolio value ${stressTest.base.portfolioValue.toFixed(2)} across ${stressTest.scenarios.length} scenario${stressTest.scenarios.length === 1 ? "" : "s"}.`,
      linkHref: "/stress-test",
    },
    {
      code: "event_risk",
      label: "Event Risk",
      headline: `${eventRisk.summary.highRiskCount} high-risk position${eventRisk.summary.highRiskCount === 1 ? "" : "s"}`,
      detail: `${eventRisk.summary.positionsWithEvents} of ${eventRisk.summary.totalPositions} positions carry a tracked upcoming event.`,
      linkHref: "/event-risk",
    },
    {
      code: "concentration",
      label: "Concentration",
      headline: `${concentration.summary.concentrationScore}/100 concentration score`,
      detail: concentration.riskGuidance.label,
      linkHref: "/concentration-risk",
    },
    {
      code: "diversification",
      label: "Diversification",
      headline: `${concentration.summary.diversificationScore}/100 diversification score`,
      detail: concentration.summary.leastDiversifiedArea
        ? `Least diversified area: ${concentration.summary.leastDiversifiedArea.label}.`
        : "No open positions to diversify.",
      linkHref: "/concentration-risk",
    },
    {
      code: "greeks",
      label: "Greeks",
      headline: `Net delta ${concentration.netGreeks.delta}`,
      detail: `Net theta ${concentration.netGreeks.theta}, net vega ${concentration.netGreeks.vega}.`,
      linkHref: "/concentration-risk",
    },
    {
      code: "broker_health",
      label: "Broker Health",
      headline: credentialsConfigured
        ? brokerConnected === true
          ? "Connected"
          : brokerConnected === false
            ? "Disconnected"
            : "Not yet checked"
        : "No credentials configured",
      detail: credentialsConfigured
        ? "See Settings for the full Broker Connection Status check."
        : "Configure Alpaca Paper credentials in Settings to enable broker health checks.",
      linkHref: "/settings",
    },
  ];
}

export async function buildPortfolioDashboard(userId: string): Promise<PortfolioDashboardResult> {
  // Resolved ALONE, first, before any concurrent fan-out below.
  // getSettingsRow() is a plain check-then-insert with no upsert safety
  // (serverState.ts, unmodified by this sprint) — each of the 3 reused
  // overlays this function composes (buildPortfolioStressTest/
  // buildPortfolioEventRiskOverlay/buildPortfolioConcentrationOverlay)
  // independently calls getSettingsRow() itself, so firing all 3
  // concurrently for a brand-new user with no settings row yet would
  // race 3 simultaneous INSERTs against the same unique constraint.
  // Awaiting one resolution here first guarantees the row already exists
  // by the time the 3 sub-builders run concurrently — each of their own
  // internal calls becomes a safe, non-racy SELECT, never a second
  // INSERT. The same resolved row is reused directly below, so this is
  // not a second/duplicate lookup.
  const settings = await getSettingsRow(userId);

  const [trades, accountValue, stressTest, eventRisk, concentration] = await Promise.all([
    currentOpenTrades(userId),
    getAccountValue(userId),
    buildPortfolioStressTest({}, userId),
    buildPortfolioEventRiskOverlay(userId),
    buildPortfolioConcentrationOverlay(userId),
  ]);

  const credentialsConfigured = readAlpacaCreds(settings.alpacaApiKey) !== null;
  const brokerConnected = getLastBrokerCheckConnected();
  const lastBrokerCheckAt = getLastSuccessfulBrokerCheck();

  const structural = buildSnapshot(trades, accountValue);
  const generatedAt = new Date().toISOString();

  const healthFactors = buildHealthFactors(trades.length, concentration, eventRisk, stressTest);
  const healthScore = clampScore(
    healthFactors.reduce((sum, f) => sum + f.score, 0) / healthFactors.length,
  );
  const overallRiskRating = ratingFor(healthScore);

  const largestPosition: DashboardLargestPosition | null =
    structural.exposureBySymbol.length > 0
      ? {
          symbol: structural.exposureBySymbol[0].symbol,
          riskDollars: structural.exposureBySymbol[0].riskDollars,
          pctOfAccount: structural.exposureBySymbol[0].pctOfAccount,
        }
      : null;

  const largestRiskContributor: DashboardRiskContributor | null =
    concentration.greeksContributions.length > 0
      ? {
          tradeId: concentration.greeksContributions[0].tradeId,
          symbol: concentration.greeksContributions[0].symbol,
          delta: concentration.greeksContributions[0].delta,
          deltaSharePct: concentration.greeksContributions[0].deltaSharePct,
        }
      : null;

  const widgets = buildWidgets(
    trades,
    structural.exposureBySymbol,
    concentration,
    eventRisk,
    stressTest,
    credentialsConfigured,
    brokerConnected,
  );

  const guidance = buildGuidance(overallRiskRating, concentration, eventRisk);

  const stressTestSummary: DashboardStressTestSummaryEntry[] = stressTest.scenarios.map((s) => ({
    label: s.label,
    portfolioValueImpact: s.portfolioValueImpact,
    riskScoreAfter: s.riskScoreAfter,
  }));

  return {
    // Reused directly from the Portfolio Stress Test's own already-
    // computed base-case (zero-shock) portfolioValue — accountValue plus
    // real unrealized P&L across every open position, not a re-derived
    // figure.
    portfolioValue: stressTest.base.portfolioValue,
    buyingPower: stressTest.base.buyingPower,
    totalRiskDollars: structural.totalRiskDollars,
    totalRiskPct: structural.totalRiskPct,
    healthScore,
    overallRiskRating,
    paperTradingMode: true,
    credentialsConfigured,
    brokerConnected,
    lastBrokerCheckAt,
    lastPortfolioUpdate: generatedAt,
    openPositionsCount: trades.length,
    healthFactors,
    netGreeks: concentration.netGreeks,
    largestPosition,
    largestRiskContributor,
    highestEventRisk: eventRisk.summary.highestRiskPosition,
    highestConcentration: concentration.summary.largestConcentration,
    highestDirectionalExposure: concentration.summary.highestDirectionalExposure,
    widgets,
    allocationBySymbol: concentration.breakdowns.symbol.buckets,
    allocationBySector: concentration.breakdowns.sector.buckets,
    allocationByStrategy: concentration.breakdowns.strategy.buckets,
    expirationDistribution: concentration.breakdowns.expiration.buckets,
    eventTimelineSummary: eventRisk.summary,
    stressTestSummary,
    guidance,
    generatedAt,
  };
}
