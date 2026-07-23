// Institutional Intelligence Engine sprint — Phase 8, Sprint 1 (AI Coach
// Foundation), updated by the AI Teacher & Learning Centre sprint
// (Phase 8, Sprint 2) now that the AI Teacher module it disclosed as
// comingSoon actually exists. Pure unit coverage of the Learning
// Engine's learningLinksFor() catalog lookup. No database, no network.

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
  it("every category returns at least one real, existing link, and none are ever comingSoon (the AI Teacher module now exists)", () => {
    for (const category of ALL_CATEGORIES) {
      const links = learningLinksFor(category);
      expect(links.length).toBeGreaterThanOrEqual(3);
      const comingSoonLinks = links.filter((l) => l.comingSoon);
      expect(comingSoonLinks.length).toBe(0);
      for (const link of links) {
        expect(link.href).not.toBeNull();
        expect(link.href!.startsWith("/")).toBe(true);
      }
    }
  });

  it("every category's link list ends with the AI Teacher & Learning Centre entry, resolved to a real URL", () => {
    for (const category of ALL_CATEGORIES) {
      const links = learningLinksFor(category);
      const last = links[links.length - 1];
      expect(last.label).toBe("AI Teacher & Learning Centre");
      expect(last.comingSoon).toBe(false);
      expect(last.href).toBe("/learn");
    }
  });

  it("every category's link list includes a 'Your Portfolio, Explained' deep link into Portfolio Learning Mode", () => {
    for (const category of ALL_CATEGORIES) {
      const links = learningLinksFor(category);
      expect(links.some((l) => l.href === "/learn?tab=portfolio")).toBe(true);
    }
  });

  it("categories with a matching Learning Path topic get a real, reused lesson link (never fabricated)", () => {
    const withLesson: LearningCategory[] = [
      "portfolio_health",
      "buying_power",
      "concentration",
      "diversification",
      "directional_exposure",
      "greeks_exposure",
      "event_risk",
      "theta_income",
    ];
    for (const category of withLesson) {
      const links = learningLinksFor(category);
      expect(links.some((l) => l.href?.startsWith("/learn/paths/"))).toBe(true);
    }
    // The 3 platform-status categories have no matching lesson topic and
    // are honestly omitted rather than fabricated.
    for (const category of ["broker_status", "paper_trading_status", "credentials_status"] as LearningCategory[]) {
      const links = learningLinksFor(category);
      expect(links.some((l) => l.href?.startsWith("/learn/paths/"))).toBe(false);
    }
  });

  it("categories with matching glossary terms get real, reused glossary links (never fabricated)", () => {
    const links = learningLinksFor("portfolio_health");
    expect(links.some((l) => l.href === "/learn/glossary/portfolio-health")).toBe(true);
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
