// Phase 38 — Institutional Performance & Attribution Engine.
import { describe, it, expect } from "vitest";
import { getPerformanceAttributionLearning, allPerformanceAttributionLearning } from "./performanceAttributionLearning.js";
import { PERFORMANCE_ATTRIBUTION_COACH_TOPICS } from "./performanceAttributionCoach.js";

describe("getPerformanceAttributionLearning", () => {
  it("resolves a non-empty set of real Learning Centre links for every one of the 5 coach topics — zero silently-dropped, unresolvable topic keys", () => {
    for (const topic of PERFORMANCE_ATTRIBUTION_COACH_TOPICS) {
      const learning = getPerformanceAttributionLearning(topic);
      expect(learning).not.toBeNull();
      expect(learning!.topic).toBe(topic);
      expect(learning!.links.length).toBeGreaterThan(0);
      for (const link of learning!.links) {
        expect(typeof link.title).toBe("string");
        expect(link.title.length).toBeGreaterThan(0);
        expect(typeof link.summary).toBe("string");
        expect(link.summary.length).toBeGreaterThan(0);
        expect(link.href).toBe(`/learn/paths/${link.pathKey}/${link.topicKey}`);
        expect(["metrics", "attribution", "capital", "risk_adjusted", "interpretation"]).toContain(link.category);
      }
    }
  });

  it("connects the 'performance_metrics' topic to real win-rate content", () => {
    const learning = getPerformanceAttributionLearning("performance_metrics")!;
    expect(learning.links.some((l) => l.topicKey === "performance-win-rate")).toBe(true);
  });

  it("connects the 'capital_efficiency' topic to real Institutional Capital Allocation content", () => {
    const learning = getPerformanceAttributionLearning("capital_efficiency")!;
    expect(learning.links.some((l) => l.topicKey === "institutional-capital-allocation")).toBe(true);
  });

  it("connects the 'risk_adjusted_returns' topic to the closest real, existing analogues (no dedicated Sharpe/Sortino lesson exists yet — honestly reused, never invented)", () => {
    const learning = getPerformanceAttributionLearning("risk_adjusted_returns")!;
    expect(learning.links.some((l) => l.topicKey === "performance-expectancy")).toBe(true);
    expect(learning.links.some((l) => l.topicKey === "performance-drawdown")).toBe(true);
  });

  it("connects the 'portfolio_interpretation' topic to real diversification/correlation content", () => {
    const learning = getPerformanceAttributionLearning("portfolio_interpretation")!;
    expect(learning.links.some((l) => l.topicKey === "portfolio-diversification")).toBe(true);
    expect(learning.links.some((l) => l.topicKey === "portfolio-correlation")).toBe(true);
  });

  it("returns null for an unknown topic, never a fabricated learning bundle", () => {
    expect(getPerformanceAttributionLearning("not_a_real_topic")).toBeNull();
    expect(getPerformanceAttributionLearning("")).toBeNull();
  });
});

describe("allPerformanceAttributionLearning", () => {
  it("returns exactly the 5 topics, in order, each matching its own single-topic lookup", () => {
    const all = allPerformanceAttributionLearning();
    expect(all).toHaveLength(5);
    expect(all.map((e) => e.topic)).toEqual([...PERFORMANCE_ATTRIBUTION_COACH_TOPICS]);
    for (const entry of all) {
      expect(entry).toEqual(getPerformanceAttributionLearning(entry.topic));
    }
  });
});
