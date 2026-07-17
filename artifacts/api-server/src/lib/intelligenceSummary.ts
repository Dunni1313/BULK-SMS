// Institutional Intelligence Engine sprint — Phase 8, Sprint 1 (AI Coach
// Foundation). Summary Engine.
//
// Generates a deterministic daily summary as a small set of template
// sentences — a pure lookup over already-computed bands (the Health
// Engine's own overview, and the Observation Engine's own already-built
// observations), never a new calculation and never natural-language
// generation of any kind. Every sentence is chosen from a fixed,
// disclosed template table, matching the exact style of this sprint's
// own worked examples ("Portfolio Health remains strong.",
// "Diversification is improving.", "Concentration remains moderate.",
// "Theta income continues to increase.", "No elevated Event Risk
// detected.", "Buying Power remains healthy.").

import type { HealthOverview } from "./intelligenceHealth.js";
import type { Observation } from "./intelligenceObservations.js";

export interface DailySummary {
  headline: string;
  bullets: string[];
  generatedAt: string;
}

function healthSentence(health: HealthOverview): string {
  switch (health.overallRiskRating.code) {
    case "healthy":
      return "Portfolio Health remains strong.";
    case "moderate_risk":
      return "Portfolio Health is moderate.";
    case "elevated_risk":
      return "Portfolio Health needs attention.";
    default:
      return "Portfolio Health is at elevated risk — review recommended.";
  }
}

function diversificationSentence(observations: Observation[]): string | null {
  if (observations.some((o) => o.code === "diversification_improving")) return "Diversification is improving.";
  if (observations.some((o) => o.code === "diversification_declining")) return "Diversification has declined.";
  return null;
}

function concentrationSentence(observations: Observation[]): string {
  if (observations.some((o) => o.code === "concentration_elevated")) {
    return "Concentration is elevated — review recommended.";
  }
  return "Concentration remains moderate.";
}

function thetaSentence(observations: Observation[]): string | null {
  if (observations.some((o) => o.code === "theta_income_improving")) return "Theta income continues to increase.";
  if (observations.some((o) => o.code === "theta_income_slowing")) return "Theta income has slowed.";
  return null;
}

function eventRiskSentence(observations: Observation[]): string {
  if (observations.some((o) => o.code === "event_risk_elevated")) {
    return "Event Risk is elevated — review recommended.";
  }
  return "No elevated Event Risk detected.";
}

function buyingPowerSentence(observations: Observation[]): string {
  if (observations.some((o) => o.code === "buying_power_increasing")) return "Buying Power is increasing.";
  if (observations.some((o) => o.code === "buying_power_decreasing")) return "Buying Power is decreasing.";
  return "Buying Power remains healthy.";
}

export function buildDailySummary(
  health: HealthOverview,
  observations: Observation[],
  now: Date = new Date(),
): DailySummary {
  const bullets: string[] = [healthSentence(health)];
  const diversification = diversificationSentence(observations);
  if (diversification) bullets.push(diversification);
  bullets.push(concentrationSentence(observations));
  const theta = thetaSentence(observations);
  if (theta) bullets.push(theta);
  bullets.push(eventRiskSentence(observations));
  bullets.push(buyingPowerSentence(observations));

  return {
    headline: healthSentence(health),
    bullets,
    generatedAt: now.toISOString(),
  };
}
