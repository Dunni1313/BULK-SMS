// Institutional Intelligence Engine sprint — Phase 8, Sprint 1 (AI Coach
// Foundation). Pure unit coverage of the Explanation Engine
// (explainObservation()) — a stable formatting entry point over an
// already-built Observation, using a hand-constructed literal fixture so
// this file never needs a database connection. buildObservations()
// itself (fed by a real PortfolioDashboardResult) is covered end-to-end
// against real, isolated users in lib/intelligenceEngine.test.ts —
// this file only proves the Explanation Engine never invents information
// beyond what the Observation already carries.

import { describe, it, expect } from "vitest";
import { explainObservation, type Observation } from "./intelligenceObservations.js";

function fixtureObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    code: "concentration_elevated",
    category: "concentration",
    severity: "elevated",
    title: "Concentration elevated",
    explanation: "NVDA accounts for 100.00% of deployed portfolio risk.",
    supportingMetrics: [
      { label: "Concentration Health Factor", value: "0/100" },
      { label: "Largest Position", value: "NVDA (100.00%)" },
    ],
    sourceModule: "portfolioConcentration.ts — riskGuidance / summary.largestConcentration",
    timestamp: "2026-01-01T00:00:00.000Z",
    confidence: "high",
    confidenceReason: "Directly reused from the Correlation & Concentration overlay's own already-classified guidance.",
    learningLinks: [
      { label: "Correlation & Concentration", href: "/concentration-risk", comingSoon: false },
      { label: "AI Teacher", href: null, comingSoon: true },
    ],
    ...overrides,
  };
}

describe("explainObservation", () => {
  it("the explanation's 'why' is exactly the observation's own explanation text — never rewritten or embellished", () => {
    const observation = fixtureObservation();
    const explanation = explainObservation(observation);
    expect(explanation.why).toBe(observation.explanation);
  });

  it("contributingMetrics is exactly the observation's own supportingMetrics — never a second, competing metrics list", () => {
    const observation = fixtureObservation();
    const explanation = explainObservation(observation);
    expect(explanation.contributingMetrics).toEqual(observation.supportingMetrics);
  });

  it("sourceModule is passed through unchanged, so 'which existing module generated it' is always traceable", () => {
    const observation = fixtureObservation();
    const explanation = explainObservation(observation);
    expect(explanation.sourceModule).toBe(observation.sourceModule);
  });

  it("reviewSuggestion picks the first real (non-coming-soon) learning link's own label", () => {
    const observation = fixtureObservation();
    const explanation = explainObservation(observation);
    expect(explanation.reviewSuggestion).toBe("Correlation & Concentration");
  });

  it("honestly reports no specific page when every learning link is a 'coming soon' placeholder", () => {
    const observation = fixtureObservation({
      learningLinks: [{ label: "AI Teacher", href: null, comingSoon: true }],
    });
    const explanation = explainObservation(observation);
    expect(explanation.reviewSuggestion).toBe("No specific existing page is directly linked to this observation.");
  });

  it("never adds a recommendation or execution suggestion — only explanation, contributing metrics, source, and a review pointer", () => {
    const observation = fixtureObservation();
    const explanation = explainObservation(observation);
    expect(Object.keys(explanation).sort()).toEqual(
      ["contributingMetrics", "reviewSuggestion", "sourceModule", "why"].sort(),
    );
  });
});
