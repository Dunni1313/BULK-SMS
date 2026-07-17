// Institutional Intelligence Engine sprint — Phase 8, Sprint 1 (AI Coach
// Foundation). Health Engine.
//
// Aggregates every existing health metric this platform already
// computes — Portfolio Health (dash.healthScore/overallRiskRating,
// itself already a blend of Concentration/Diversification/Event Risk/
// Net Greeks/Directional Exposure/Position Sizing Quality/Position
// Count/Expiration Distribution, per lib/portfolioDashboard.ts's own
// header), plus Broker health — into ONE overall view. Deliberately
// "aggregate by reference": the Overall Health Score and Overall Risk
// Rating shown here are the exact same values
// lib/portfolioDashboard.ts already computed, never a second,
// competing score. Health Drivers are dash.healthFactors themselves,
// re-sorted (worst-first) — zero new scoring.

import type { PortfolioDashboardResult } from "./portfolioDashboard.js";
import type { IntelligenceSnapshotRow } from "@workspace/db";
import { computeTrend, type TrendDirection } from "./intelligenceTrend.js";
import { HEALTH_SCORE_TREND_THRESHOLD_PCT } from "./intelligenceObservations.js";

export interface HealthDriver {
  code: string;
  label: string;
  score: number;
  detail: string;
}

export interface BrokerHealthSummary {
  credentialsConfigured: boolean;
  connected: boolean | null;
  label: string;
}

export interface HealthOverview {
  overallHealthScore: number;
  overallRiskRating: { code: string; label: string };
  healthTrend: TrendDirection;
  healthTrendDetail: string;
  healthDrivers: HealthDriver[];
  brokerHealth: BrokerHealthSummary;
  healthSummary: string;
}

function brokerLabel(credentialsConfigured: boolean, connected: boolean | null): string {
  if (!credentialsConfigured) return "No credentials configured";
  if (connected === true) return "Connected";
  if (connected === false) return "Disconnected";
  return "Not yet checked";
}

export function buildHealthOverview(
  dash: PortfolioDashboardResult,
  prior: IntelligenceSnapshotRow | null,
): HealthOverview {
  const trend = computeTrend(dash.healthScore, prior?.healthScore ?? null, HEALTH_SCORE_TREND_THRESHOLD_PCT);

  const healthTrendDetail =
    trend.direction === "insufficient_history"
      ? "No prior recorded snapshot exists yet — trend will be available after the next recorded day."
      : trend.direction === "stable"
        ? `Health Score is stable at ${dash.healthScore}/100 (prior: ${prior!.healthScore}/100).`
        : trend.direction === "improving"
          ? `Health Score rose from ${prior!.healthScore}/100 to ${dash.healthScore}/100.`
          : `Health Score fell from ${prior!.healthScore}/100 to ${dash.healthScore}/100.`;

  const healthDrivers: HealthDriver[] = [...dash.healthFactors]
    .sort((a, b) => a.score - b.score)
    .map((f) => ({ code: f.code, label: f.label, score: f.score, detail: f.detail }));

  const brokerHealth: BrokerHealthSummary = {
    credentialsConfigured: dash.credentialsConfigured,
    connected: dash.brokerConnected,
    label: brokerLabel(dash.credentialsConfigured, dash.brokerConnected),
  };

  const weakestDriver = healthDrivers[0];
  const healthSummary =
    dash.overallRiskRating.code === "healthy"
      ? `Portfolio Health is healthy at ${dash.healthScore}/100.`
      : `Portfolio Health is ${dash.overallRiskRating.label.toLowerCase()} at ${dash.healthScore}/100 — the weakest contributing factor is ${weakestDriver.label} (${weakestDriver.score}/100).`;

  return {
    overallHealthScore: dash.healthScore,
    overallRiskRating: dash.overallRiskRating,
    healthTrend: trend.direction,
    healthTrendDetail,
    healthDrivers,
    brokerHealth,
    healthSummary,
  };
}
