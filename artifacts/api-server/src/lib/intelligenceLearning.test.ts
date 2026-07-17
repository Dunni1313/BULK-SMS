// Institutional Intelligence Engine sprint — Phase 8, Sprint 1 (AI Coach
// Foundation). Pure unit coverage of the Learning Engine's
// learningLinksFor() catalog lookup. No database, no network.

import { describe, it, expect } from "vitest";
import { learningLinksFor, type LearningCategory } from "./intelligenceLearning.js";

const ALL_CATEGORIES: LearningCategory[] = [
  "portfolio_health",
  "buying_power",
  "concentration",
  "diversification",
  "directional_exposure",
  "greeks_exposure",
  "event_risk",
  "theta_income",
  "broker_status",
  "paper_trading_status",
  "credentials_status",
];

describe("learningLinksFor", () => {
  it("every category returns at least one real, existing link plus the honestly-disclosed AI Teacher entry", () => {
    for (const category of ALL_CATEGORIES) {
      const links = learningLinksFor(category);
      expect(links.length).toBeGreaterThanOrEqual(2);
      const realLinks = links.filter((l) => !l.comingSoon);
      expect(realLinks.length).toBeGreaterThanOrEqual(1);
      for (const link of realLinks) {
        expect(link.href).not.toBeNull();
        expect(link.href!.startsWith("/")).toBe(true);
      }
    }
  });

  it("every category's link list ends with the AI Teacher 'coming soon' entry — never a fabricated URL", () => {
    for (const category of ALL_CATEGORIES) {
      const links = learningLinksFor(category);
      const last = links[links.length - 1];
      expect(last.label).toBe("AI Teacher");
      expect(last.comingSoon).toBe(true);
      expect(last.href).toBeNull();
    }
  });

  it("concentration and diversification both point at the Correlation & Concentration overlay", () => {
    expect(learningLinksFor("concentration").some((l) => l.href === "/concentration-risk")).toBe(true);
    expect(learningLinksFor("diversification").some((l) => l.href === "/concentration-risk")).toBe(true);
  });

  it("event_risk points at the Event Risk overlay's own dedicated page", () => {
    expect(learningLinksFor("event_risk").some((l) => l.href === "/event-risk")).toBe(true);
  });

  it("is a pure function — repeated calls for the same category return an equal result", () => {
    const a = learningLinksFor("portfolio_health");
    const b = learningLinksFor("portfolio_health");
    expect(a).toEqual(b);
  });
});
