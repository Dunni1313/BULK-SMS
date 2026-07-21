// Phase 37 — Institutional Risk & Exposure Intelligence Engine.
import { describe, it, expect } from "vitest";
import { RISK_EXPOSURE_COACH_TOPICS, explainRiskExposureTopic, allRiskExposureTopics } from "./riskExposureCoach.js";
import { COACH_DISCLAIMER } from "./coach.js";

describe("explainRiskExposureTopic", () => {
  it("returns a well-shaped explanation for every one of the 7 named topics", () => {
    for (const topic of RISK_EXPOSURE_COACH_TOPICS) {
      const explanation = explainRiskExposureTopic(topic);
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
    for (const topic of RISK_EXPOSURE_COACH_TOPICS) {
      expect(explainRiskExposureTopic(topic)!.disclaimer).toBe(COACH_DISCLAIMER);
    }
  });

  it("returns null for an unknown topic, never a fabricated explanation", () => {
    expect(explainRiskExposureTopic("not_a_real_topic")).toBeNull();
    expect(explainRiskExposureTopic("")).toBeNull();
  });

  it("never recommends a trade, a hedge, a rebalance, or a specific symbol — structurally, since no function here accepts one", () => {
    // explainRiskExposureTopic's own signature takes only a topic key (a
    // string from a fixed 7-value enum) — there is no parameter through
    // which a symbol, position, or account figure could ever reach the
    // explanation text.
    for (const topic of RISK_EXPOSURE_COACH_TOPICS) {
      const text = explainRiskExposureTopic(topic)!.explanation.join(" ").toLowerCase();
      expect(text).not.toMatch(/\byou should (buy|sell|open|close|hedge|rebalance)\b|\bwe recommend\b|recommend(ed)? (buying|selling|opening|closing|hedging|rebalancing)/);
    }
  });
});

describe("allRiskExposureTopics", () => {
  it("returns exactly the 7 named topics, in order, each matching its own single-topic lookup", () => {
    const all = allRiskExposureTopics();
    expect(all).toHaveLength(7);
    expect(all.map((e) => e.topic)).toEqual([...RISK_EXPOSURE_COACH_TOPICS]);
    for (const entry of all) {
      expect(entry).toEqual(explainRiskExposureTopic(entry.topic));
    }
  });
});
