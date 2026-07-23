// Phase 41 — Institutional Portfolio Rebalancing & Allocation Planning
// Engine.
import { describe, it, expect } from "vitest";
import { REBALANCING_COACH_TOPICS, explainRebalancingTopic, allRebalancingTopics } from "./rebalancingCoach.js";
import { COACH_DISCLAIMER } from "./coach.js";

describe("explainRebalancingTopic", () => {
  it("returns a well-shaped explanation for every one of the 5 named topics", () => {
    for (const topic of REBALANCING_COACH_TOPICS) {
      const explanation = explainRebalancingTopic(topic);
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
    for (const topic of REBALANCING_COACH_TOPICS) {
      expect(explainRebalancingTopic(topic)!.disclaimer).toBe(COACH_DISCLAIMER);
    }
  });

  it("returns null for an unknown topic, never a fabricated explanation", () => {
    expect(explainRebalancingTopic("not_a_real_topic")).toBeNull();
    expect(explainRebalancingTopic("")).toBeNull();
  });

  it("never recommends a trade, a hedge, or a specific symbol — structurally, since no function here accepts one", () => {
    // explainRebalancingTopic's own signature takes only a topic key (a
    // string from a fixed 5-value enum) — there is no parameter through
    // which a symbol, position, or account figure could ever reach the
    // explanation text.
    for (const topic of REBALANCING_COACH_TOPICS) {
      const text = explainRebalancingTopic(topic)!.explanation.join(" ").toLowerCase();
      expect(text).not.toMatch(/\byou should (buy|sell|open|close|hedge)\b|\bwe recommend\b|recommend(ed)? (buying|selling|opening|closing|hedging)/);
    }
  });

  it("never states a probability estimate, a forecast, a buy/sell signal, or a suggested trade/share count", () => {
    for (const topic of REBALANCING_COACH_TOPICS) {
      const text = explainRebalancingTopic(topic)!.explanation.join(" ").toLowerCase();
      expect(text).not.toMatch(/\b\d+%\s*(chance|likelihood|probability)\b|\blikely to (happen|occur)\b|\bbuy signal\b|\bsell signal\b/);
      expect(text).not.toMatch(/\bbuy \d+ shares\b|\bsell \d+ shares\b|\bplace (an|a) order\b/);
    }
  });
});

describe("allRebalancingTopics", () => {
  it("returns exactly the 5 named topics, in order, each matching its own single-topic lookup", () => {
    const all = allRebalancingTopics();
    expect(all).toHaveLength(5);
    expect(all.map((e) => e.topic)).toEqual([...REBALANCING_COACH_TOPICS]);
    for (const entry of all) {
      expect(entry).toEqual(explainRebalancingTopic(entry.topic));
    }
  });
});
