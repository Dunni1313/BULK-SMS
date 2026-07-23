// Phase 39 — Institutional Scenario & Stress Testing Engine.
import { describe, it, expect } from "vitest";
import { getScenarioLearning, allScenarioLearning } from "./scenarioLearning.js";
import { SCENARIO_COACH_TOPICS } from "./scenarioCoach.js";

describe("getScenarioLearning", () => {
  it("resolves a non-empty set of real Learning Centre links for every one of the 5 coach topics — zero silently-dropped, unresolvable topic keys", () => {
    for (const topic of SCENARIO_COACH_TOPICS) {
      const learning = getScenarioLearning(topic);
      expect(learning).not.toBeNull();
      expect(learning!.topic).toBe(topic);
      expect(learning!.links.length).toBeGreaterThan(0);
      for (const link of learning!.links) {
        expect(typeof link.title).toBe("string");
        expect(link.title.length).toBeGreaterThan(0);
        expect(typeof link.summary).toBe("string");
        expect(link.summary.length).toBeGreaterThan(0);
        expect(link.href).toBe(`/learn/paths/${link.pathKey}/${link.topicKey}`);
        expect(["scenario", "stress", "resilience", "greeks", "capital"]).toContain(link.category);
      }
    }
  });

  it("connects the 'greeks_impact' topic to real Portfolio Greeks content", () => {
    const learning = getScenarioLearning("greeks_impact")!;
    expect(learning.links.some((l) => l.topicKey === "greeks-portfolio-greeks")).toBe(true);
  });

  it("connects the 'stress_testing' topic to real, already-existing Portfolio Stress Testing content", () => {
    const learning = getScenarioLearning("stress_testing")!;
    expect(learning.links.some((l) => l.topicKey === "portfolio-stress-testing")).toBe(true);
  });

  it("connects the 'capital_impact' topic to real, already-existing Buying Power content", () => {
    const learning = getScenarioLearning("capital_impact")!;
    expect(learning.links.some((l) => l.topicKey === "portfolio-buying-power")).toBe(true);
  });

  it("returns null for an unknown topic, never a fabricated learning bundle", () => {
    expect(getScenarioLearning("not_a_real_topic")).toBeNull();
    expect(getScenarioLearning("")).toBeNull();
  });
});

describe("allScenarioLearning", () => {
  it("returns exactly the 5 topics, in order, each matching its own single-topic lookup", () => {
    const all = allScenarioLearning();
    expect(all).toHaveLength(5);
    expect(all.map((e) => e.topic)).toEqual([...SCENARIO_COACH_TOPICS]);
    for (const entry of all) {
      expect(entry).toEqual(getScenarioLearning(entry.topic));
    }
  });
});
