// Phase 40 — Institutional Decision Support & Executive Insights Engine.
import { describe, it, expect } from "vitest";
import { DECISION_SUPPORT_COACH_TOPICS, explainDecisionSupportTopic, allDecisionSupportTopics } from "./decisionSupportCoach.js";
import { COACH_DISCLAIMER } from "./coach.js";

describe("explainDecisionSupportTopic", () => {
  it("returns a well-shaped explanation for every one of the 8 named topics", () => {
    for (const topic of DECISION_SUPPORT_COACH_TOPICS) {
      const explanation = explainDecisionSupportTopic(topic);
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
    for (const topic of DECISION_SUPPORT_COACH_TOPICS) {
      expect(explainDecisionSupportTopic(topic)!.disclaimer).toBe(COACH_DISCLAIMER);
    }
  });

  it("returns null for an unknown topic, never a fabricated explanation", () => {
    expect(explainDecisionSupportTopic("not_a_real_topic")).toBeNull();
    expect(explainDecisionSupportTopic("")).toBeNull();
  });

  it("never recommends a trade, a hedge, a rebalance, or a specific symbol — structurally, since no function here accepts one", () => {
    // explainDecisionSupportTopic's own signature takes only a topic key (a
    // string from a fixed 8-value enum) — there is no parameter through
    // which a symbol, position, or account figure could ever reach the
    // explanation text.
    for (const topic of DECISION_SUPPORT_COACH_TOPICS) {
      const text = explainDecisionSupportTopic(topic)!.explanation.join(" ").toLowerCase();
      expect(text).not.toMatch(/\byou should (buy|sell|open|close|hedge|rebalance)\b|\bwe recommend\b|recommend(ed)? (buying|selling|opening|closing|hedging|rebalancing)/);
    }
  });

  it("never states a probability estimate, a forecast, or a buy/sell signal", () => {
    for (const topic of DECISION_SUPPORT_COACH_TOPICS) {
      const text = explainDecisionSupportTopic(topic)!.explanation.join(" ").toLowerCase();
      expect(text).not.toMatch(/\b\d+%\s*(chance|likelihood|probability)\b|\blikely to (happen|occur)\b|\bbuy signal\b|\bsell signal\b/);
    }
  });
});

describe("allDecisionSupportTopics", () => {
  it("returns exactly the 8 named topics, in order, each matching its own single-topic lookup", () => {
    const all = allDecisionSupportTopics();
    expect(all).toHaveLength(8);
    expect(all.map((e) => e.topic)).toEqual([...DECISION_SUPPORT_COACH_TOPICS]);
    for (const entry of all) {
      expect(entry).toEqual(explainDecisionSupportTopic(entry.topic));
    }
  });
});
