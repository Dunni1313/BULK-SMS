// Phase 38 — Institutional Performance & Attribution Engine.
import { describe, it, expect } from "vitest";
import { PERFORMANCE_ATTRIBUTION_COACH_TOPICS, explainPerformanceAttributionTopic, allPerformanceAttributionTopics } from "./performanceAttributionCoach.js";
import { COACH_DISCLAIMER } from "./coach.js";

describe("explainPerformanceAttributionTopic", () => {
  it("returns a well-shaped explanation for every one of the 5 named topics", () => {
    for (const topic of PERFORMANCE_ATTRIBUTION_COACH_TOPICS) {
      const explanation = explainPerformanceAttributionTopic(topic);
      expect(explanation).not.toBeNull();
      expect(explanation!.topic).toBe(topic);
      expect(typeof explanation!.title).toBe("string");
      expect(explanation!.title.length).toBeGreaterThan(0);
      expect(explanation!.explanation.length).toBeGreaterThan(0);
      for (const paragraph of explanation!.explanation) {
        expect(typeof paragraph).toBe("string");
        expect(paragraph.length).toBeGreaterThan(0);
      }
    }
  });

  it("always carries the same, unmodified COACH_DISCLAIMER text every other coach domain uses", () => {
    for (const topic of PERFORMANCE_ATTRIBUTION_COACH_TOPICS) {
      expect(explainPerformanceAttributionTopic(topic)!.disclaimer).toBe(COACH_DISCLAIMER);
    }
  });

  it("returns null for an unknown topic, never a fabricated explanation", () => {
    expect(explainPerformanceAttributionTopic("not_a_real_topic")).toBeNull();
    expect(explainPerformanceAttributionTopic("")).toBeNull();
  });

  it("never recommends a trade, a rebalance, or a specific symbol — structurally, since no function here accepts one", () => {
    // explainPerformanceAttributionTopic's own signature takes only a topic
    // key (a string from a fixed 5-value enum) — there is no parameter
    // through which a symbol, position, or account figure could ever reach
    // the explanation text.
    for (const topic of PERFORMANCE_ATTRIBUTION_COACH_TOPICS) {
      const text = explainPerformanceAttributionTopic(topic)!.explanation.join(" ").toLowerCase();
      expect(text).not.toMatch(/\byou should (buy|sell|open|close|rebalance)\b|\bwe recommend\b|recommend(ed)? (buying|selling|opening|closing|rebalancing)/);
    }
  });

  it("never fabricates a forecast, prediction, or future-return claim", () => {
    for (const topic of PERFORMANCE_ATTRIBUTION_COACH_TOPICS) {
      const text = explainPerformanceAttributionTopic(topic)!.explanation.join(" ").toLowerCase();
      expect(text).not.toMatch(/will (return|earn|gain|outperform)|expected future return|forecast(ed)? return/);
    }
  });
});

describe("allPerformanceAttributionTopics", () => {
  it("returns exactly the 5 named topics, in order, each matching its own single-topic lookup", () => {
    const all = allPerformanceAttributionTopics();
    expect(all).toHaveLength(5);
    expect(all.map((e) => e.topic)).toEqual([...PERFORMANCE_ATTRIBUTION_COACH_TOPICS]);
    for (const entry of all) {
      expect(entry).toEqual(explainPerformanceAttributionTopic(entry.topic));
    }
  });
});
