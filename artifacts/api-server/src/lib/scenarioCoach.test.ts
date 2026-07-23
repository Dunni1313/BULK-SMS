// Phase 39 — Institutional Scenario & Stress Testing Engine.
import { describe, it, expect } from "vitest";
import { SCENARIO_COACH_TOPICS, explainScenarioTopic, allScenarioTopics } from "./scenarioCoach.js";
import { COACH_DISCLAIMER } from "./coach.js";

describe("explainScenarioTopic", () => {
  it("returns a well-shaped explanation for every one of the 5 named topics", () => {
    for (const topic of SCENARIO_COACH_TOPICS) {
      const explanation = explainScenarioTopic(topic);
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
    for (const topic of SCENARIO_COACH_TOPICS) {
      expect(explainScenarioTopic(topic)!.disclaimer).toBe(COACH_DISCLAIMER);
    }
  });

  it("returns null for an unknown topic, never a fabricated explanation", () => {
    expect(explainScenarioTopic("not_a_real_topic")).toBeNull();
    expect(explainScenarioTopic("")).toBeNull();
  });

  it("never recommends a trade, a hedge, a rebalance, or a specific symbol — structurally, since no function here accepts one", () => {
    // explainScenarioTopic's own signature takes only a topic key (a string
    // from a fixed 5-value enum) — there is no parameter through which a
    // symbol, position, or account figure could ever reach the explanation
    // text.
    for (const topic of SCENARIO_COACH_TOPICS) {
      const text = explainScenarioTopic(topic)!.explanation.join(" ").toLowerCase();
      expect(text).not.toMatch(/\byou should (buy|sell|open|close|hedge|rebalance)\b|\bwe recommend\b|recommend(ed)? (buying|selling|opening|closing|hedging|rebalancing)/);
    }
  });

  it("never states a probability estimate of a scenario actually occurring", () => {
    for (const topic of SCENARIO_COACH_TOPICS) {
      const text = explainScenarioTopic(topic)!.explanation.join(" ").toLowerCase();
      expect(text).not.toMatch(/\b\d+%\s*(chance|likelihood|probability)\b|\blikely to (happen|occur)\b/);
    }
  });
});

describe("allScenarioTopics", () => {
  it("returns exactly the 5 named topics, in order, each matching its own single-topic lookup", () => {
    const all = allScenarioTopics();
    expect(all).toHaveLength(5);
    expect(all.map((e) => e.topic)).toEqual([...SCENARIO_COACH_TOPICS]);
    for (const entry of all) {
      expect(entry).toEqual(explainScenarioTopic(entry.topic));
    }
  });
});
