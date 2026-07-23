// Phase 40 — Institutional Decision Support & Executive Insights Engine.
import { describe, it, expect } from "vitest";
import { DECISION_SUPPORT_LEARNING_TOPICS, getDecisionSupportLearning, allDecisionSupportLearning } from "./decisionSupportLearning.js";

describe("getDecisionSupportLearning", () => {
  it("resolves a non-empty set of real Learning Centre links for every one of the 7 topics — zero silently-dropped, unresolvable topic keys", () => {
    for (const topic of DECISION_SUPPORT_LEARNING_TOPICS) {
      const learning = getDecisionSupportLearning(topic);
      expect(learning).not.toBeNull();
      expect(learning!.topic).toBe(topic);
      expect(learning!.links.length).toBeGreaterThan(0);
      for (const link of learning!.links) {
        expect(typeof link.title).toBe("string");
        expect(link.title.length).toBeGreaterThan(0);
        expect(typeof link.summary).toBe("string");
        expect(link.summary.length).toBeGreaterThan(0);
        expect(link.href).toBe(`/learn/paths/${link.pathKey}/${link.topicKey}`);
      }
    }
  });

  it("connects the 'risk_interpretation' topic to real, already-existing Portfolio Health content", () => {
    const learning = getDecisionSupportLearning("risk_interpretation")!;
    expect(learning.links.some((l) => l.topicKey === "portfolio-health")).toBe(true);
  });

  it("connects the 'diversification' topic to real, already-existing Portfolio Diversification content", () => {
    const learning = getDecisionSupportLearning("diversification")!;
    expect(learning.links.some((l) => l.topicKey === "portfolio-diversification")).toBe(true);
  });

  it("connects the 'capital_allocation' topic to real, already-existing Buying Power content", () => {
    const learning = getDecisionSupportLearning("capital_allocation")!;
    expect(learning.links.some((l) => l.topicKey === "portfolio-buying-power")).toBe(true);
  });

  it("returns null for an unknown topic, never a fabricated learning bundle", () => {
    expect(getDecisionSupportLearning("not_a_real_topic")).toBeNull();
    expect(getDecisionSupportLearning("")).toBeNull();
  });
});

describe("allDecisionSupportLearning", () => {
  it("returns exactly the 7 topics, in order, each matching its own single-topic lookup", () => {
    const all = allDecisionSupportLearning();
    expect(all).toHaveLength(7);
    expect(all.map((e) => e.topic)).toEqual([...DECISION_SUPPORT_LEARNING_TOPICS]);
    for (const entry of all) {
      expect(entry).toEqual(getDecisionSupportLearning(entry.topic));
    }
  });
});
