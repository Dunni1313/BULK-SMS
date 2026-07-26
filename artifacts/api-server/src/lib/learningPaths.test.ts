// AI Teacher & Learning Centre sprint — Learning Paths. Pure unit
// coverage, no database, no network: content is a plain, deterministic
// TypeScript literal. Cross-references lib/glossary.ts's own real
// keys/routes so the two content modules can never silently drift apart.

import { describe, it, expect } from "vitest";
import { LEARNING_PATHS, getLearningPath, getLearningTopic, allLearningTopics } from "./learningPaths.js";
import { getGlossaryTerm } from "./glossary.js";

describe("learning path content", () => {
  it("has exactly the 11 requested paths, in the requested order (v1.4.0 Sprint L1 adds platform-basics)", () => {
    expect(LEARNING_PATHS.map((p) => p.key)).toEqual([
      "foundations",
      "greeks",
      "volatility",
      "strategies",
      "portfolio",
      "performance",
      "institutional",
      // Phase 21 — Institutional AI Coach & Education Platform. A 9th,
      // Engine-1-scoped path (distinct from "institutional", Engine 3's own
      // options-portfolio thinking).
      "institutional-investing",
      // Phase 29 — Institutional Trading AI Coach. A 10th, Engine-2-scoped
      // path (distinct from both "institutional" and "institutional-investing").
      "trading-engine",
      // Phase 30 — Institutional Strategy Framework. An 11th path teaching
      // the FRAMEWORK itself (registering metadata, the Checklist Engine,
      // evidence citations), never a real trading methodology's own rules.
      "strategy-framework",
      // v1.4.0, Sprint L1 — Learning Centre Foundation. A 12th path
      // teaching platform mechanics (navigation, Command Centre, the
      // Learning Centre itself) — never an investing/trading concept.
      "platform-basics",
    ]);
  });

  it("every path has at least one topic, and every topic key is globally unique", () => {
    const allTopics = allLearningTopics();
    expect(LEARNING_PATHS.every((p) => p.topics.length > 0)).toBe(true);
    const topicKeys = allTopics.map((t) => t.topic.key);
    expect(new Set(topicKeys).size).toBe(topicKeys.length);
  });

  it("every topic's relatedGlossaryKeys reference a REAL glossary term — never a dangling cross-reference", () => {
    for (const { topic } of allLearningTopics()) {
      for (const key of topic.relatedGlossaryKeys) {
        expect(getGlossaryTerm(key)).not.toBeNull();
      }
    }
  });

  it("every topic has a positive estimatedMinutes and a non-empty body", () => {
    for (const { topic } of allLearningTopics()) {
      expect(topic.estimatedMinutes).toBeGreaterThan(0);
      expect(topic.body.length).toBeGreaterThan(0);
      expect(topic.whyItMatters.length).toBeGreaterThan(10);
    }
  });

  it("an externalHref, when present, is a real, existing platform route — never a fabricated URL", () => {
    // Every existing route this sprint's own topics point to, confirmed
    // by direct inspection of App.tsx before this content was written.
    const knownRoutes = new Set([
      "/learn/delta",
      "/learn/greeks",
      "/portfolio",
      "/portfolio-dashboard",
      "/position-sizing",
      "/concentration-risk",
      "/stress-test",
      "/event-risk",
      "/options-dashboard",
      "/trade-performance",
      "/adjustment-preview",
      "/learn/strategy-academy/covered_call",
      "/learn/strategy-academy/cash_secured_put",
      "/learn/strategy-academy/wheel",
      "/learn/strategy-academy/vertical_spread",
      "/learn/strategy-academy/iron_condor",
      "/learn/strategy-academy/iron_fly",
      "/learn/strategy-academy/calendar_spread",
      "/learn/strategy-academy/diagonal_spread",
      // Phase 21 — Institutional AI Coach & Education Platform's own
      // Institutional Investing Engine path, confirmed by direct inspection
      // of App.tsx before this content was written.
      "/research-terminal",
      "/decision-engine",
      "/stock-analyst/portfolio-optimisation",
      "/stock-analyst/investment-committee",
      "/monitoring-dashboard",
      "/opportunity-discovery",
      // Phase 29 — Institutional Trading AI Coach's own Institutional
      // Trading Engine path, confirmed by direct inspection of App.tsx
      // before this content was written.
      "/market-structure-workbench",
      "/liquidity-workbench",
      "/trade-planning-studio",
      "/trading-journal",
      "/trading-ai-coach",
      // Phase 30 — Institutional Strategy Framework's own path, confirmed
      // by direct inspection of App.tsx before this content was written.
      "/strategy-framework",
      // v1.4.0, Sprint L1 — Learning Centre Foundation's own
      // platform-basics path, confirmed by direct inspection of App.tsx
      // before this content was written.
      "/command-center",
      "/learn",
    ]);
    for (const { topic } of allLearningTopics()) {
      if (topic.externalHref) {
        expect(knownRoutes.has(topic.externalHref)).toBe(true);
      }
    }
  });
});

// v1.4.0, Sprint L1 — Learning Centre Foundation.
describe("platform-basics path — the first 3 foundation lessons, and the template for future rich lessons", () => {
  const path = getLearningPath("platform-basics")!;

  it("exists with exactly the 3 approved foundation topics, in curriculum order", () => {
    expect(path).not.toBeNull();
    expect(path.topics.map((t) => t.key)).toEqual([
      "platform-basics-navigation",
      "command-centre-overview",
      "learning-centre-overview",
    ]);
  });

  it("every topic populates the new optional rich fields — the template every future lesson follows", () => {
    for (const topic of path.topics) {
      expect(topic.difficulty).toBe("beginner");
      expect(topic.whyItExists!.length).toBeGreaterThan(10);
      expect(topic.institutionalThinking!.length).toBeGreaterThan(10);
      expect(topic.workflowSteps!.length).toBeGreaterThan(0);
      expect(topic.bestPractices!.length).toBeGreaterThan(0);
      expect(topic.aiCoachPrompts!.length).toBeGreaterThan(0);
    }
  });

  it("every topic's nextStepKeys, when present, resolves to a real topic within this same path", () => {
    for (const topic of path.topics) {
      for (const nextKey of topic.nextStepKeys ?? []) {
        expect(path.topics.some((t) => t.key === nextKey)).toBe(true);
      }
    }
  });

  it("chains correctly: navigation -> command centre -> learning centre overview -> end", () => {
    expect(getLearningTopic("platform-basics", "platform-basics-navigation")!.nextStepKeys).toEqual(["command-centre-overview"]);
    expect(getLearningTopic("platform-basics", "command-centre-overview")!.nextStepKeys).toEqual(["learning-centre-overview"]);
    expect(getLearningTopic("platform-basics", "learning-centre-overview")!.nextStepKeys).toEqual([]);
  });

  it("the pre-existing 68 topics remain untouched — none of them acquired a rich field this sprint", () => {
    const preExistingTopics = allLearningTopics().filter(({ pathKey }) => pathKey !== "platform-basics");
    expect(preExistingTopics.length).toBe(68);
    for (const { topic } of preExistingTopics) {
      expect(topic.difficulty).toBeUndefined();
      expect(topic.workflowSteps).toBeUndefined();
    }
  });
});

describe("getLearningPath", () => {
  it("resolves a known path by key", () => {
    expect(getLearningPath("portfolio")?.title).toBe("Portfolio");
  });

  it("honestly returns null for an unknown key — never a fabricated path", () => {
    expect(getLearningPath("not-a-real-path")).toBeNull();
  });
});

describe("getLearningTopic", () => {
  it("resolves a known topic within a known path", () => {
    const topic = getLearningTopic("greeks", "greeks-delta");
    expect(topic).not.toBeNull();
    expect(topic!.title).toBe("Delta");
  });

  it("honestly returns null for a known path but unknown topic", () => {
    expect(getLearningTopic("greeks", "not-a-real-topic")).toBeNull();
  });

  it("honestly returns null for an unknown path entirely", () => {
    expect(getLearningTopic("not-a-real-path", "anything")).toBeNull();
  });
});
