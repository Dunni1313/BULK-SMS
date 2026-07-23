// Phase 41 — Institutional Portfolio Rebalancing & Allocation Planning
// Engine.
import { describe, it, expect } from "vitest";
import { REBALANCING_LEARNING_TOPICS, getRebalancingLearning, allRebalancingLearning } from "./rebalancingLearning.js";

describe("getRebalancingLearning", () => {
  it("resolves a non-empty set of real Learning Centre links for every one of the 6 topics — zero silently-dropped, unresolvable topic keys", () => {
    for (const topic of REBALANCING_LEARNING_TOPICS) {
      const learning = getRebalancingLearning(topic);
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

  it("connects the 'asset_allocation' topic to real, already-existing Portfolio Diversification content", () => {
    const learning = getRebalancingLearning("asset_allocation")!;
    expect(learning.links.some((l) => l.topicKey === "portfolio-diversification")).toBe(true);
  });

  it("connects the 'diversification' topic to real, already-existing Portfolio Correlation content", () => {
    const learning = getRebalancingLearning("diversification")!;
    expect(learning.links.some((l) => l.topicKey === "portfolio-correlation")).toBe(true);
  });

  it("connects the 'capital_allocation' topic to real, already-existing Buying Power content", () => {
    const learning = getRebalancingLearning("capital_allocation")!;
    expect(learning.links.some((l) => l.topicKey === "portfolio-buying-power")).toBe(true);
  });

  it("connects the 'risk_management' topic to real, already-existing Portfolio Concentration content", () => {
    const learning = getRebalancingLearning("risk_management")!;
    expect(learning.links.some((l) => l.topicKey === "portfolio-concentration")).toBe(true);
  });

  it("returns null for an unknown topic, never a fabricated learning bundle", () => {
    expect(getRebalancingLearning("not_a_real_topic")).toBeNull();
    expect(getRebalancingLearning("")).toBeNull();
  });
});

describe("allRebalancingLearning", () => {
  it("returns exactly the 6 topics, in order, each matching its own single-topic lookup", () => {
    const all = allRebalancingLearning();
    expect(all).toHaveLength(6);
    expect(all.map((e) => e.topic)).toEqual([...REBALANCING_LEARNING_TOPICS]);
    for (const entry of all) {
      expect(entry).toEqual(getRebalancingLearning(entry.topic));
    }
  });
});
