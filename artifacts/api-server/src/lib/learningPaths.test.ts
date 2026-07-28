// AI Teacher & Learning Centre sprint — Learning Paths. Pure unit
// coverage, no database, no network: content is a plain, deterministic
// TypeScript literal. Cross-references lib/glossary.ts's own real
// keys/routes so the two content modules can never silently drift apart.

import { describe, it, expect } from "vitest";
import { LEARNING_PATHS, getLearningPath, getLearningTopic, allLearningTopics } from "./learningPaths.js";
import { getGlossaryTerm } from "./glossary.js";

describe("learning path content", () => {
  it("has exactly the 14 requested paths, in the requested order (v1.4.0 Sprint L2A adds options-income-engine; Sprint L2J adds ai-academy; Sprint L2K adds professional-workflows)", () => {
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
      // v1.4.0, Sprint L2J — AI Coach & Institutional Mentor Academy. A
      // cross-engine path (spans Engine 1/2/3's AI features) teaching how
      // to work with every AI assistant on the platform — never a new AI
      // capability of its own.
      "ai-academy",
      // v1.4.0, Sprint L2K — Professional Institutional Workflows Academy.
      // A cross-engine path teaching real, end-to-end workflows (morning
      // prep, research, trading, portfolio review, options, weekly/monthly
      // review) over already-taught platform features — never a new
      // capability of its own.
      "professional-workflows",
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
      // v1.4.0, Sprint L2F — Options Academy Foundations. The one genuinely
      // new route this sprint's upgraded/new module-guide topics point to
      // (a concrete symbol-shaped Option Chain URL, since App.tsx's own
      // route is the dynamic "/options/:symbol"), confirmed by direct
      // inspection of App.tsx before this content was written. Every other
      // route this sprint references (/scanner, /trade-execution-center,
      // /portfolio, /portfolio-ai, /portfolio-dashboard, /position-sizing,
      // /stress-test, /event-risk, /concentration-risk, /options-dashboard,
      // /learn/delta, /learn/greeks) was already present above.
      "/options/SPY",
      // v1.4.0, Sprint L2H — Institutional Options Portfolio Management
      // Academy. The one genuinely new route this sprint's new/upgraded
      // module-guide topics point to (/portfolio-analyst was already a
      // real, registered App.tsx route — App.tsx:178 — simply never
      // referenced by any Learning Centre topic before now). Every other
      // route this sprint references (/portfolio-ai, /portfolio,
      // /trade-performance, /portfolio-dashboard, /concentration-risk,
      // /position-sizing, /adjustments, /adjustment-preview,
      // /institutional-mentor) was already present above.
      "/portfolio-analyst",
      // v1.4.0, Sprint L2I — Institutional Investing Academy. Every route
      // this sprint's new/upgraded module-guide topics point to, confirmed
      // real and registered by direct grep of App.tsx before this content
      // was written. /stock-analyst, /research-terminal, /decision-engine,
      // /stock-analyst/investment-committee, /monitoring-dashboard,
      // /stock-analyst/portfolio-optimisation, /reporting-centre, and
      // /opportunity-discovery were already present above.
      "/stock-analyst/executive-dashboard",
      "/institutional-ai-coach",
      "/rebalancing-engine",
      "/stock-analyst/portfolio-construction",
      // v1.4.0, Sprint L2J — AI Coach & Institutional Mentor Academy. The
      // one genuinely new route this sprint's new ai-academy path and
      // upgraded trading-ai-coach-overview topic point to (a confirmed
      // naming collision with /trading-ai-coach, itself already present
      // above — the two are separate, real, registered routes, confirmed
      // by direct grep of App.tsx before this content was written). Every
      // other route this sprint references (/assistant, /trading-ai-coach,
      // /institutional-ai-coach, /institutional-mentor, /portfolio-analyst,
      // /stock-analyst, /trading-research, /trading-journal,
      // /stock-analyst/portfolio-construction, /rebalancing-engine,
      // /research-terminal) was already present above.
      "/ai-trading-coach",
      // v1.4.0, Sprint L2K — Professional Institutional Workflows Academy.
      // Every genuinely new route this sprint's 6 new module-guide topics
      // point to, confirmed real and registered by direct grep of App.tsx
      // before this content was written. /stock-analyst/portfolio-construction,
      // /stress-test, /trade-adjustment-preview (see /adjustment-preview
      // below), /options/SPY, /concentration-risk, and every other route
      // this sprint references were already present above.
      "/scoring",
      "/order-preview",
      "/autopilot",
      "/journal",
      "/trade-history",
      "/risk-exposure-engine",
      "/options-lifecycle-manager",
      "/performance-attribution-engine",
      "/trading-analytics",
      "/performance",
      "/trade-journal-ai",
      "/portfolio-workspace",
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
    // v1.4.0, Sprint L2F — Options Academy Foundations (the first Options
    // Academy sprint). Investigation before writing any content discovered
    // a substantial pre-existing options-education structure (foundations/
    // greeks/volatility/strategies/portfolio/performance paths, all plain
    // topics predating the Sprint L1+ rich-content pattern). This sprint
    // deepened 2 further pre-existing plain topics in place
    // (foundations-options — the Fundamentals module; greeks-portfolio-
    // greeks — the Greeks module) and added 3 brand new topics
    // (volatility-pricing-probability, appended to the volatility path;
    // options-chain-contract-selection and options-risk-management, both
    // appended to options-income-engine right after
    // options-scanner-watchlists). volatility-hv also received a small,
    // disclosed factual correction in place (still plain, key unchanged,
    // not counted as rich content) — it previously implied IV-vs-HV
    // comparison was a real platform feature; HV is confirmed computed
    // nowhere in the codebase.
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
      "foundations-options",
      "greeks-portfolio-greeks",
      "volatility-pricing-probability",
      "options-chain-contract-selection",
      "options-risk-management",
      // v1.4.0, Sprint L2G — Options Strategies Academy. 3 brand-new
      // topics (long-call/long-put/protective-put) plus 5 upgraded-in-place
      // topics (covered-calls/verticals/iron-condor/iron-butterfly/
      // calendar) — strategies-csp/strategies-wheel/strategies-diagonal
      // were correctly out of scope and remain plain.
      "strategies-long-call",
      "strategies-long-put",
      "strategies-covered-calls",
      "strategies-protective-put",
      "strategies-verticals",
      "strategies-iron-condor",
      "strategies-iron-butterfly",
      "strategies-calendar",
      // v1.4.0, Sprint L2H — Institutional Options Portfolio Management
      // Academy. 3 brand-new topics (portfolio-overview/
      // portfolio-managing-positions/portfolio-ai-review-workflow) plus 2
      // upgraded-in-place topics (portfolio-concentration/
      // portfolio-position-sizing) — portfolio-health/
      // portfolio-buying-power/portfolio-diversification/
      // portfolio-correlation/portfolio-stress-testing/
      // portfolio-event-risk and all of PERFORMANCE_PATH were correctly
      // out of scope and remain plain.
      "portfolio-overview",
      "portfolio-concentration",
      "portfolio-position-sizing",
      "portfolio-managing-positions",
      "portfolio-ai-review-workflow",
      // v1.4.0, Sprint L2I — Institutional Investing Academy. 5 brand-new
      // topics (investing-executive-dashboard/investing-fundamental-
      // analysis/investing-portfolio-construction-workflow/investing-
      // rebalancing-and-review/investing-ai-coach) plus 1 upgraded-in-place
      // topic (investing-investment-committee, corrected to cover the real
      // "Narrate this verdict" LLM feature) — investing-business-quality/
      // investing-financial-strength/investing-decision-engine/
      // investing-portfolio-optimisation/investing-opportunity-discovery
      // were correctly out of scope and remain plain.
      // investing-margin-of-safety received a small, disclosed body-only
      // deepening (still plain, key unchanged, not counted as rich content
      // here) — matching the same precedent as volatility-hv's own factual
      // correction above.
      "investing-executive-dashboard",
      "investing-fundamental-analysis",
      "investing-portfolio-construction-workflow",
      "investing-rebalancing-and-review",
      "investing-ai-coach",
      "investing-investment-committee",
      // v1.4.0, Sprint L2J — AI Coach & Institutional Mentor Academy. 6
      // brand-new topics in the new ai-academy path, plus 1
      // upgraded-in-place topic (trading-ai-coach-overview, moved from a
      // 905-character plain stub to full module-guide depth — the only
      // topic in this sprint whose plain-vs-rich status actually changed).
      "ai-team-overview",
      "ai-writing-better-prompts",
      "ai-research-workflow",
      "ai-trading-workflow",
      "ai-portfolio-review",
      "ai-understanding-responses",
      "trading-ai-coach-overview",
      // v1.4.0, Sprint L2K — Professional Institutional Workflows Academy.
      // 6 brand-new topics in the new professional-workflows path. No
      // existing topic's plain-vs-rich status changed this sprint —
      // portfolio-ai-review-workflow (already rich since Phase 21) received
      // only a small, disclosed body-text correction (the newly-shipped
      // Portfolio Workspace Workflow Center), not a rich-content promotion.
      "workflow-morning-preparation",
      "workflow-research",
      "workflow-professional-trade",
      "workflow-portfolio-review",
      "workflow-options",
      "workflow-weekly-monthly-review",
    ]);
    const stillPlainTopics = allLearningTopics().filter(
      ({ pathKey, topic }) => pathKey !== "platform-basics" && !richContentKeys.has(topic.key),
    );
    expect(stillPlainTopics.length).toBe(50);
    for (const { topic } of stillPlainTopics) {
      expect(topic.difficulty).toBeUndefined();
      expect(topic.workflowSteps).toBeUndefined();
    }
  });

  it("Sprint L2A/L2B/L2C/L2D/L2E/L2F/L2G/L2H/L2I/L2J/L2K's own module-guide topics each populate the full rich-content shape", () => {
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
      "foundations-options",
      "greeks-portfolio-greeks",
      "volatility-pricing-probability",
      "options-chain-contract-selection",
      "options-risk-management",
      "strategies-long-call",
      "strategies-long-put",
      "strategies-covered-calls",
      "strategies-protective-put",
      "strategies-verticals",
      "strategies-iron-condor",
      "strategies-iron-butterfly",
      "strategies-calendar",
      "portfolio-overview",
      "portfolio-concentration",
      "portfolio-position-sizing",
      "portfolio-managing-positions",
      "portfolio-ai-review-workflow",
      "investing-executive-dashboard",
      "investing-fundamental-analysis",
      "investing-portfolio-construction-workflow",
      "investing-rebalancing-and-review",
      "investing-ai-coach",
      "investing-investment-committee",
      "ai-team-overview",
      "ai-writing-better-prompts",
      "ai-research-workflow",
      "ai-trading-workflow",
      "ai-portfolio-review",
      "ai-understanding-responses",
      "trading-ai-coach-overview",
      "workflow-morning-preparation",
      "workflow-research",
      "workflow-professional-trade",
      "workflow-portfolio-review",
      "workflow-options",
      "workflow-weekly-monthly-review",
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
