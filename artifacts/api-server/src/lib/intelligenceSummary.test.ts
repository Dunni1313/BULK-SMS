// Institutional Intelligence Engine sprint — Phase 8, Sprint 1 (AI Coach
// Foundation). Pure unit coverage of the Summary Engine
// (buildDailySummary()) — deterministic template sentences only, no
// database, no network, no natural-language generation.

import { describe, it, expect } from "vitest";
import { buildDailySummary } from "./intelligenceSummary.js";
import type { HealthOverview } from "./intelligenceHealth.js";
import type { Observation } from "./intelligenceObservations.js";

function fixtureHealth(overrides: Partial<HealthOverview> = {}): HealthOverview {
  return {
    overallHealthScore: 90,
    overallRiskRating: { code: "healthy", label: "Healthy" },
    healthTrend: "insufficient_history",
    healthTrendDetail: "No prior recorded snapshot exists yet — trend will be available after the next recorded day.",
    healthDrivers: [],
    brokerHealth: { credentialsConfigured: false, connected: null, label: "No credentials configured" },
    healthSummary: "Portfolio Health is healthy at 90/100.",
    ...overrides,
  };
}

function fixtureObservation(code: string): Observation {
  return {
    code,
    category: "portfolio_health",
    severity: "info",
    title: code,
    explanation: "fixture",
    supportingMetrics: [],
    sourceModule: "fixture",
    timestamp: "2026-01-01T00:00:00.000Z",
    confidence: "high",
    confidenceReason: "fixture",
    learningLinks: [],
  };
}

describe("buildDailySummary", () => {
  it("a healthy, observation-free portfolio produces exactly the requested worked-example wording", () => {
    const summary = buildDailySummary(fixtureHealth(), [], new Date("2026-01-01T00:00:00.000Z"));
    expect(summary.headline).toBe("Portfolio Health remains strong.");
    expect(summary.bullets).toEqual([
      "Portfolio Health remains strong.",
      "Concentration remains moderate.",
      "No elevated Event Risk detected.",
      "Buying Power remains healthy.",
    ]);
    expect(summary.generatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("headline switches to 'moderate' for a moderate_risk rating", () => {
    const summary = buildDailySummary(fixtureHealth({ overallRiskRating: { code: "moderate_risk", label: "Moderate Risk" } }), []);
    expect(summary.headline).toBe("Portfolio Health is moderate.");
  });

  it("headline switches to 'needs attention' for an elevated_risk rating", () => {
    const summary = buildDailySummary(fixtureHealth({ overallRiskRating: { code: "elevated_risk", label: "Elevated Risk" } }), []);
    expect(summary.headline).toBe("Portfolio Health needs attention.");
  });

  it("headline switches to the review-recommended wording for a high_risk rating", () => {
    const summary = buildDailySummary(fixtureHealth({ overallRiskRating: { code: "high_risk", label: "High Risk" } }), []);
    expect(summary.headline).toBe("Portfolio Health is at elevated risk — review recommended.");
  });

  it("adds the diversification-improving bullet only when that observation is present", () => {
    const summary = buildDailySummary(fixtureHealth(), [fixtureObservation("diversification_improving")]);
    expect(summary.bullets).toContain("Diversification is improving.");
  });

  it("adds the diversification-declining bullet only when that observation is present", () => {
    const summary = buildDailySummary(fixtureHealth(), [fixtureObservation("diversification_declining")]);
    expect(summary.bullets).toContain("Diversification has declined.");
  });

  it("omits any diversification bullet entirely when no diversification trend was observed", () => {
    const summary = buildDailySummary(fixtureHealth(), []);
    expect(summary.bullets.some((b) => b.toLowerCase().includes("diversification"))).toBe(false);
  });

  it("switches the concentration bullet to the elevated wording when concentration_elevated is present", () => {
    const summary = buildDailySummary(fixtureHealth(), [fixtureObservation("concentration_elevated")]);
    expect(summary.bullets).toContain("Concentration is elevated — review recommended.");
    expect(summary.bullets).not.toContain("Concentration remains moderate.");
  });

  it("adds the theta-improving bullet only when that observation is present", () => {
    const summary = buildDailySummary(fixtureHealth(), [fixtureObservation("theta_income_improving")]);
    expect(summary.bullets).toContain("Theta income continues to increase.");
  });

  it("adds the theta-slowing bullet only when that observation is present", () => {
    const summary = buildDailySummary(fixtureHealth(), [fixtureObservation("theta_income_slowing")]);
    expect(summary.bullets).toContain("Theta income has slowed.");
  });

  it("omits any theta bullet entirely when no theta trend was observed", () => {
    const summary = buildDailySummary(fixtureHealth(), []);
    expect(summary.bullets.some((b) => b.toLowerCase().includes("theta"))).toBe(false);
  });

  it("switches the event-risk bullet to the elevated wording when event_risk_elevated is present", () => {
    const summary = buildDailySummary(fixtureHealth(), [fixtureObservation("event_risk_elevated")]);
    expect(summary.bullets).toContain("Event Risk is elevated — review recommended.");
  });

  it("switches the buying-power bullet to increasing wording when buying_power_increasing is present", () => {
    const summary = buildDailySummary(fixtureHealth(), [fixtureObservation("buying_power_increasing")]);
    expect(summary.bullets).toContain("Buying Power is increasing.");
  });

  it("switches the buying-power bullet to decreasing wording when buying_power_decreasing is present", () => {
    const summary = buildDailySummary(fixtureHealth(), [fixtureObservation("buying_power_decreasing")]);
    expect(summary.bullets).toContain("Buying Power is decreasing.");
  });

  it("is a pure function — repeated calls with the same inputs and now produce an equal result", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const a = buildDailySummary(fixtureHealth(), [fixtureObservation("concentration_elevated")], now);
    const b = buildDailySummary(fixtureHealth(), [fixtureObservation("concentration_elevated")], now);
    expect(a).toEqual(b);
  });
});
