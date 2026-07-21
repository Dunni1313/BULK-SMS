// Phase 36 — Institutional Position Lifecycle Manager.
import { describe, it, expect } from "vitest";
import { LIFECYCLE_COACH_TOPICS, explainLifecycleTopic, allLifecycleTopics } from "./optionsLifecycleCoach.js";
import { COACH_DISCLAIMER } from "./coach.js";

describe("explainLifecycleTopic", () => {
  it("returns a well-shaped explanation for every one of the 5 named topics", () => {
    for (const topic of LIFECYCLE_COACH_TOPICS) {
      const explanation = explainLifecycleTopic(topic);
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
    for (const topic of LIFECYCLE_COACH_TOPICS) {
      expect(explainLifecycleTopic(topic)!.disclaimer).toBe(COACH_DISCLAIMER);
    }
  });

  it("returns null for an unknown topic, never a fabricated explanation", () => {
    expect(explainLifecycleTopic("not_a_real_topic")).toBeNull();
    expect(explainLifecycleTopic("")).toBeNull();
  });

  it("never recommends a trade, a direction, or a specific symbol — structurally, since no function here accepts one", () => {
    // explainLifecycleTopic's own signature takes only a topic key (a
    // string from a fixed 5-value enum) — there is no parameter through
    // which a symbol, strike, or quote could ever reach the explanation
    // text. This test asserts the observable consequence: the produced
    // text never contains an imperative trade recommendation (mechanics
    // language like "must buy 100 shares" describing what assignment
    // requires of the option's seller is legitimate and expected — this
    // only guards against the model recommending an actual action).
    for (const topic of LIFECYCLE_COACH_TOPICS) {
      const text = explainLifecycleTopic(topic)!.explanation.join(" ").toLowerCase();
      expect(text).not.toMatch(/\byou should (buy|sell|open|close)\b|\bwe recommend\b|recommend(ed)? (buying|selling|opening|closing)/);
    }
  });
});

describe("allLifecycleTopics", () => {
  it("returns exactly the 5 named topics, in order, each matching its own single-topic lookup", () => {
    const all = allLifecycleTopics();
    expect(all).toHaveLength(5);
    expect(all.map((e) => e.topic)).toEqual([...LIFECYCLE_COACH_TOPICS]);
    for (const entry of all) {
      expect(entry).toEqual(explainLifecycleTopic(entry.topic));
    }
  });
});
