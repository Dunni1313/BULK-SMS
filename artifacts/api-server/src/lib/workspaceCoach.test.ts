// Phase 44 — Institutional Portfolio Workspace & Workflow Center.
import { describe, it, expect } from "vitest";
import { WORKSPACE_COACH_TOPICS, explainWorkspaceTopic, allWorkspaceTopics } from "./workspaceCoach.js";
import { COACH_DISCLAIMER } from "./coach.js";

describe("explainWorkspaceTopic", () => {
  it("returns a well-shaped explanation for every one of the 5 named topics", () => {
    for (const topic of WORKSPACE_COACH_TOPICS) {
      const explanation = explainWorkspaceTopic(topic);
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
    for (const topic of WORKSPACE_COACH_TOPICS) {
      expect(explainWorkspaceTopic(topic)!.disclaimer).toBe(COACH_DISCLAIMER);
    }
  });

  it("returns null for an unknown topic, never a fabricated explanation", () => {
    expect(explainWorkspaceTopic("not_a_real_topic")).toBeNull();
    expect(explainWorkspaceTopic("")).toBeNull();
  });

  it("never recommends a trade, a hedge, or a specific symbol — structurally, since no function here accepts one", () => {
    // explainWorkspaceTopic's own signature takes only a topic key (a
    // string from a fixed 5-value enum) — there is no parameter through
    // which a symbol, position, or account figure could ever reach the
    // explanation text.
    for (const topic of WORKSPACE_COACH_TOPICS) {
      const text = explainWorkspaceTopic(topic)!.explanation.join(" ").toLowerCase();
      expect(text).not.toMatch(/\byou should (buy|sell|open|close|hedge)\b|\bwe recommend\b|recommend(ed)? (buying|selling|opening|closing|hedging)/);
    }
  });

  it("never states a probability estimate, a forecast, a buy/sell signal, or a suggested trade/share count", () => {
    for (const topic of WORKSPACE_COACH_TOPICS) {
      const text = explainWorkspaceTopic(topic)!.explanation.join(" ").toLowerCase();
      expect(text).not.toMatch(/\b\d+%\s*(chance|likelihood|probability)\b|\blikely to (happen|occur)\b|\bbuy signal\b|\bsell signal\b/);
      expect(text).not.toMatch(/\bbuy \d+ shares\b|\bsell \d+ shares\b|\bplace (an|a) order\b/);
    }
  });
});

describe("allWorkspaceTopics", () => {
  it("returns exactly the 5 named topics, in order, each matching its own single-topic lookup", () => {
    const all = allWorkspaceTopics();
    expect(all).toHaveLength(5);
    expect(all.map((e) => e.topic)).toEqual([...WORKSPACE_COACH_TOPICS]);
    for (const entry of all) {
      expect(entry).toEqual(explainWorkspaceTopic(entry.topic));
    }
  });
});
