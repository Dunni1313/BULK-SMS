// AI Teacher & Learning Centre sprint — Learning Paths. Pure unit
// coverage, no database, no network: content is a plain, deterministic
// TypeScript literal. Cross-references lib/glossary.ts's own real
// keys/routes so the two content modules can never silently drift apart.

import { describe, it, expect } from "vitest";
import { LEARNING_PATHS, getLearningPath, getLearningTopic, allLearningTopics } from "./learningPaths.js";
import { getGlossaryTerm } from "./glossary.js";

describe("learning path content", () => {
  it("has exactly the 12 requested paths, in the requested order (v1.4.0 Sprint L2A adds options-income-engine)", () => {
    expect(LEARNING_PATHS.map((p) => p.key)).toEqual([
      "foundations",
      "greeks",
      "volatility",
      "strategies",
      "portfolio",
      "performance",
      "institutional",
      // Phase 21 — Institutional AI Coach & Education Platform. An
      // Engine-1-scoped path (distinct from "institutional", Engine 3's own
      // options-portfolio thinking).
      "institutional-investing",
      // Phase 29 — Institutional Trading AI Coach. An Engine-2-scoped
      // path (distinct from both "institutional" and "institutional-investing").
      "trading-engine",
      // v1.4.0, Sprint L2A — Interactive Module Guides. A new path, the
      // Engine-3-scoped counterpart to institutional-investing/trading-
      // engine above — the "engine tour" role neither of the pre-existing
      // Engine-3 paths (institutional/strategies/etc., all pure options
      // CONCEPT vocabulary) filled until this sprint.
      "options-income-engine",
      // Phase 30 — Institutional Strategy Framework. A path teaching
      // the FRAMEWORK itself (registering metadata, the Checklist Engine,
      // evidence citations), never a real trading methodology's own rules.
      "strategy-framework",
      // v1.4.0, Sprint L1 — Learning Centre Foundation. A path
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

  it("an externalHref or relatedModuleHrefs entry, when present, is a real, existing platform route — never a fabricated URL", () => {
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
      // before this content was written. Includes every relatedModuleHrefs
      // target the 3 new foundation topics reference, not just externalHref.
      "/command-center",
      "/learn",
      "/",
      "/settings",
      "/notifications",
      "/executive-intelligence",
      "/institutional-dashboard",
      "/learn/paths",
      "/learn/glossary",
      // v1.4.0, Sprint L2A — Interactive Module Guides. Every route this
      // sprint's own 4 deepened/new module-guide topics point to, confirmed
      // by direct inspection of App.tsx before this content was written.
      "/trading-research",
      "/trade-execution-center",
      "/scanner",
      "/adjustments",
      "/learn/paths/platform-basics",
      "/learn/paths/institutional-investing",
      "/learn/paths/trading-engine",
      "/learn/paths/options-income-engine",
      // v1.4.0, Sprint L2B — Cross-Engine & Portfolio Hubs. Every route
      // this sprint's own 4 new/expanded module-guide topics point to,
      // confirmed by direct inspection of App.tsx before this content was
      // written.
      "/assistant",
      "/portfolio-ai",
      "/institutional-mentor",
      "/learn/quiz",
      "/lessons",
      // v1.4.0, Sprint L2C — Trading Workflow Academy. Every route this
      // sprint's own upgraded/new module-guide topics point to, confirmed
      // by direct inspection of App.tsx before this content was written.
      "/trade-workspace",
      "/trades",
      "/strategy-workbench",
      "/reporting-centre",
      "/learn/paths/strategy-framework",
      // v1.4.0, Sprint L2D — Platform Operations Academy. Every route this
      // sprint's own upgraded/new module-guide topics point to, confirmed
      // by direct inspection of App.tsx before this content was written.
      "/stock-analyst/scanner",
      "/watchlists-engine",
      "/stock-analyst",
      "/monitoring-compliance-engine",
      "/events",
      "/daily-report",
    ]);
    for (const { topic } of allLearningTopics()) {
      if (topic.externalHref) {
        expect(knownRoutes.has(topic.externalHref)).toBe(true);
      }
      for (const href of topic.relatedModuleHrefs ?? []) {
        expect(knownRoutes.has(href)).toBe(true);
      }
    }
  });
});

// v1.4.0, Sprint L1 — Learning Centre Foundation. Sprint L2A upgraded
// command-centre-overview in place; Sprint L2B inserted 2 further module
// guides (institutional-dashboard-overview, ai-coach-overview) between it
// and learning-centre-overview — a disclosed, intentional expansion from 3
// to 5 topics, not a regression of the original 3.
describe("platform-basics path — the foundation lessons, and the template for future rich lessons", () => {
  const path = getLearningPath("platform-basics")!;

  it("exists with exactly the 6 approved foundation topics, in curriculum order", () => {
    expect(path).not.toBeNull();
    expect(path.topics.map((t) => t.key)).toEqual([
      "platform-basics-navigation",
      "command-centre-overview",
      "institutional-dashboard-overview",
      "ai-coach-overview",
      "platform-settings-personalisation",
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

  it("chains correctly: navigation -> command centre -> institutional dashboard -> AI coach -> settings & personalisation -> learning centre overview -> end", () => {
    expect(getLearningTopic("platform-basics", "platform-basics-navigation")!.nextStepKeys).toEqual(["command-centre-overview"]);
    expect(getLearningTopic("platform-basics", "command-centre-overview")!.nextStepKeys).toEqual(["institutional-dashboard-overview"]);
    expect(getLearningTopic("platform-basics", "institutional-dashboard-overview")!.nextStepKeys).toEqual(["ai-coach-overview"]);
    expect(getLearningTopic("platform-basics", "ai-coach-overview")!.nextStepKeys).toEqual(["platform-settings-personalisation"]);
    expect(getLearningTopic("platform-basics", "platform-settings-personalisation")!.nextStepKeys).toEqual(["learning-centre-overview"]);
    expect(getLearningTopic("platform-basics", "learning-centre-overview")!.nextStepKeys).toEqual([]);
  });

  it("the topics never touched by any rich-content sprint remain plain — never a silent regression of an untouched topic", () => {
    // v1.4.0, Sprint L2A — Interactive Module Guides deepened one
    // pre-existing topic in place (investing-research-terminal, the
    // Institutional Investing Engine's own module guide) and added 2 brand
    // new ones (trading-engine-overview, options-income-engine-overview).
    // v1.4.0, Sprint L2B — Cross-Engine & Portfolio Hubs added 2 further
    // topics OUTSIDE platform-basics: portfolio-ai-overview (a new second
    // topic in options-income-engine) and investing-institutional-mentor (a
    // new final topic in institutional-investing). platform-basics' own 2
    // new topics (institutional-dashboard-overview, ai-coach-overview) are
    // already excluded below via the pathKey filter, same as
    // command-centre-overview always was.
    // v1.4.0, Sprint L2C — Trading Workflow Academy deepened 3 pre-existing
    // topics in place (trading-market-structure, strategy-framework-overview,
    // trading-journal-review) and added 1 brand new one
    // (trade-execution-order-management, a 3rd topic in options-income-engine).
    // v1.4.0, Sprint L2D — Platform Operations Academy deepened 1 further
    // pre-existing topic in place (investing-monitoring — its own body/
    // whyItMatters/relatedGlossaryKeys/externalHref/estimatedMinutes fields
    // stay, only the content within them was corrected/expanded) and added
    // 2 brand new NON-platform-basics topics (options-scanner-watchlists, a
    // 4th topic in options-income-engine; investing-research-workflow, a
    // new topic inserted into institutional-investing right after
    // investing-research-terminal). platform-settings-personalisation (this
    // sprint's 3rd new topic) lives in platform-basics and is already
    // excluded below via the pathKey filter, same as
    // institutional-dashboard-overview/ai-coach-overview always were.
    // v1.4.0, Sprint L2E — Trading Academy Foundations (the first Trading
    // Academy sprint, distinct from the prior Platform Academy sprints)
    // deepened 2 further pre-existing plain topics in place
    // (trading-liquidity, trading-risk-management — both already existed
    // as short/plain topics matching 2 of the 4 requested modules) and
    // added 2 brand new topics (market-structure-fundamentals, inserted
    // into trading-engine right after trading-market-structure;
    // volume-profile-vwap, inserted right after trading-liquidity) — all 4
    // living in trading-engine, none in platform-basics.
    // Every OTHER topic remains completely untouched, proven below.
    const richContentKeys = new Set([
      "investing-research-terminal",
      "trading-engine-overview",
      "options-income-engine-overview",
      "portfolio-ai-overview",
      "investing-institutional-mentor",
      "trading-market-structure",
      "strategy-framework-overview",
      "trading-journal-review",
      "trade-execution-order-management",
      "investing-monitoring",
      "options-scanner-watchlists",
      "investing-research-workflow",
      "market-structure-fundamentals",
      "trading-liquidity",
      "volume-profile-vwap",
      "trading-risk-management",
    ]);
    const stillPlainTopics = allLearningTopics().filter(
      ({ pathKey, topic }) => pathKey !== "platform-basics" && !richContentKeys.has(topic.key),
    );
    expect(stillPlainTopics.length).toBe(61);
    for (const { topic } of stillPlainTopics) {
      expect(topic.difficulty).toBeUndefined();
      expect(topic.workflowSteps).toBeUndefined();
    }
  });

  it("Sprint L2A/L2B/L2C/L2D/L2E's own module-guide topics each populate the full rich-content shape", () => {
    const moduleGuideKeys = [
      "command-centre-overview",
      "investing-research-terminal",
      "trading-engine-overview",
      "options-income-engine-overview",
      "institutional-dashboard-overview",
      "ai-coach-overview",
      "portfolio-ai-overview",
      "investing-institutional-mentor",
      "trading-market-structure",
      "strategy-framework-overview",
      "trading-journal-review",
      "trade-execution-order-management",
      "investing-monitoring",
      "options-scanner-watchlists",
      "investing-research-workflow",
      "platform-settings-personalisation",
      "market-structure-fundamentals",
      "trading-liquidity",
      "volume-profile-vwap",
      "trading-risk-management",
    ];
    for (const key of moduleGuideKeys) {
      const { topic } = allLearningTopics().find(({ topic: t }) => t.key === key)!;
      expect(topic.difficulty).toBeDefined();
      expect(topic.institutionalThinking!.length).toBeGreaterThan(10);
      expect(topic.screenWalkthrough!.length).toBeGreaterThan(0);
      expect(topic.workflowSteps!.length).toBeGreaterThan(0);
      expect(topic.metricsExplained!.length).toBeGreaterThan(0);
      expect(topic.workedExamples!.length).toBe(3);
      expect(topic.workedExamples!.map((e) => e.label)).toEqual(["Good Opportunity", "Average Opportunity", "Poor Opportunity"]);
      expect(topic.commonMistakes!.length).toBeGreaterThan(0);
      expect(topic.riskWarnings!.length).toBeGreaterThan(0);
      expect(topic.aiCoachPrompts!.length).toBeGreaterThan(0);
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
