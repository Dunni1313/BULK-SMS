// v1.5.0, Sprint 17 — Institutional Knowledge & Intelligence Graph.

import { describe, it, expect } from "vitest";
import {
  buildKnowledgeGraph,
  relatedEntities,
  relatedEntitiesOfType,
  relatedEntitiesWithinTwoHops,
  nodeById,
  nodesByConnectionCount,
  searchKnowledgeGraph,
  buildInvestmentTimeline,
  discoverPatterns,
  answerKnowledgeQuestion,
  buildKnowledgeInsights,
  type KnowledgeGraphInput,
} from "./knowledgeGraph";
import type { AiNotebook } from "./ai-coach/notebooksApi";
import type { AiStrategy } from "./ai-coach/strategiesApi";
import type { TradePlan } from "./ai-coach/tradePlansApi";
import type { TradeLifecycleRecord } from "./tradeLifecycle";
import type { PortfolioHealthScore, RiskIntelligenceReport } from "./portfolioRiskIntelligence";
import type { JournalEntry } from "@workspace/api-client-react";

function notebook(overrides: Partial<AiNotebook> = {}): AiNotebook {
  return {
    id: 1,
    coachId: "trading",
    workspaceId: null,
    title: "NVDA momentum research",
    description: null,
    pinned: false,
    archived: false,
    tags: ["NVDA", "momentum"],
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function strategy(overrides: Partial<AiStrategy> = {}): AiStrategy {
  return {
    id: 10,
    coachId: "trading",
    workspaceId: null,
    title: "Breakout momentum",
    description: null,
    strategyType: "breakout",
    assetClass: "equity",
    folder: null,
    status: "active",
    pinned: false,
    archived: false,
    tags: ["momentum"],
    currentVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function tradePlan(overrides: Partial<TradePlan> = {}): TradePlan {
  return {
    id: 100,
    coachId: "trading",
    workspaceId: null,
    strategyId: 10,
    title: "NVDA breakout plan",
    plannedAsset: "NVDA",
    assetClass: "equity",
    direction: "long",
    status: "executed",
    pinned: false,
    tags: ["NVDA", "momentum"],
    currentVersion: 1,
    executedTradeRef: "500",
    executedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function lifecycleRecord(overrides: Partial<TradeLifecycleRecord> = {}): TradeLifecycleRecord {
  return {
    tradePlan: tradePlan(),
    outcome: "active",
    currentStage: "closed",
    previousStage: "managing",
    nextStage: "journal-pending",
    completionPct: 90,
    openRisk: null,
    timeInTradeDays: 3,
    outstandingTasks: [],
    journalStatus: { state: "missing", label: "No journal entry yet.", journalEntryId: null },
    performanceStatus: { state: "closed", unrealizedPnl: null, realizedPnl: 250 },
    learning: { engagedWithRecommendedLesson: false, recommendedPathKey: null, recommendedTopicKey: null, recommendedLabel: null },
    linkedExecution: {
      kind: "trading-position",
      status: "closed",
      openedAt: "2026-01-01T00:00:00.000Z",
      closedAt: "2026-01-04T00:00:00.000Z",
      symbol: "NVDA",
      quantity: 10,
      riskDollars: null,
      unrealizedPnl: null,
      realizedPnl: 250,
      detailUnavailable: false,
    },
    canMarkExecuted: false,
    canArchive: true,
    blockedReasons: { markExecuted: null, archive: null },
    ...overrides,
  };
}

function journalEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 900,
    tradeId: 500,
    title: "NVDA trade review",
    content: "Held the stop loss discipline all the way through.",
    mood: "confident",
    lessonLearned: "Respect the stop loss level.",
    tags: ["NVDA"],
    createdAt: new Date().toISOString(),
    ...overrides,
  } as JournalEntry;
}

function healthScore(overrides: Partial<PortfolioHealthScore> = {}): PortfolioHealthScore {
  return { overall: 72, label: "Strong", factors: [], confidenceLevel: "Moderate", generatedAt: new Date().toISOString(), ...overrides };
}

function riskReport(overrides: Partial<RiskIntelligenceReport> = {}): RiskIntelligenceReport {
  return { signals: [], generatedAt: new Date().toISOString(), ...overrides };
}

function baseInput(overrides: Partial<KnowledgeGraphInput> = {}): KnowledgeGraphInput {
  return {
    notebooks: [notebook()],
    strategies: [strategy()],
    lifecycleRecords: [lifecycleRecord()],
    journalEntries: [journalEntry()],
    portfolioHealth: healthScore(),
    riskReport: riskReport(),
    ...overrides,
  };
}

describe("buildKnowledgeGraph", () => {
  it("creates one node per notebook, strategy, trade plan, and journal entry", () => {
    const graph = buildKnowledgeGraph(baseInput());
    expect(graph.nodes.find((n) => n.id === "notebook:1")).toBeTruthy();
    expect(graph.nodes.find((n) => n.id === "strategy:10")).toBeTruthy();
    expect(graph.nodes.find((n) => n.id === "trade-plan:100")).toBeTruthy();
    expect(graph.nodes.find((n) => n.id === "journal-entry:900")).toBeTruthy();
  });

  it("links a trade plan to its strategy via the real strategyId foreign key", () => {
    const graph = buildKnowledgeGraph(baseInput());
    const edge = graph.edges.find((e) => e.from === "trade-plan:100" && e.to === "strategy:10");
    expect(edge).toBeTruthy();
    expect(edge!.relation).toBe("uses strategy");
    expect(edge!.evidence).toContain("strategyId");
  });

  it("links a trade plan to a derived company node from its plannedAsset", () => {
    const graph = buildKnowledgeGraph(baseInput());
    const companyNode = graph.nodes.find((n) => n.type === "company" && n.symbol === "NVDA");
    expect(companyNode).toBeTruthy();
    const edge = graph.edges.find((e) => e.from === "trade-plan:100" && e.to === companyNode!.id);
    expect(edge).toBeTruthy();
  });

  it("links a trade plan to its journal entry via the same executedTradeRef match tradeLifecycle.ts already performs", () => {
    const graph = buildKnowledgeGraph(baseInput({ lifecycleRecords: [lifecycleRecord({ journalStatus: { state: "reviewed", label: "Reviewed", journalEntryId: 900 } })] }));
    const edge = graph.edges.find((e) => e.from === "trade-plan:100" && e.to === "journal-entry:900");
    expect(edge).toBeTruthy();
    expect(edge!.relation).toBe("journaled as");
  });

  it("links entities that share a non-ticker tag to a derived theme node", () => {
    const graph = buildKnowledgeGraph(baseInput());
    const themeNode = graph.nodes.find((n) => n.type === "theme" && n.label === "momentum");
    expect(themeNode).toBeTruthy();
    const stratEdge = graph.edges.find((e) => e.from === "strategy:10" && e.to === themeNode!.id);
    const tradePlanEdge = graph.edges.find((e) => e.from === "trade-plan:100" && e.to === themeNode!.id);
    expect(stratEdge).toBeTruthy();
    expect(tradePlanEdge).toBeTruthy();
    expect(stratEdge!.evidence).toBe("shared tag: momentum");
  });

  it("classifies a ticker-shaped tag (1-5 uppercase letters) as a company, everything else as a theme", () => {
    const graph = buildKnowledgeGraph(
      baseInput({ notebooks: [notebook({ tags: ["NVDA", "AAPL", "long-term-thesis", "SPY"] })] }),
    );
    expect(graph.nodes.find((n) => n.id === "company:NVDA")).toBeTruthy();
    expect(graph.nodes.find((n) => n.id === "company:AAPL")).toBeTruthy();
    expect(graph.nodes.find((n) => n.id === "company:SPY")).toBeTruthy();
    expect(graph.nodes.find((n) => n.id === "theme:long-term-thesis")).toBeTruthy();
  });

  it("never fabricates a duplicate edge for the same pair+relation", () => {
    const graph = buildKnowledgeGraph(baseInput());
    const seenKeys = new Set<string>();
    for (const e of graph.edges) {
      const key = `${e.from}|${e.to}|${e.relation}`;
      expect(seenKeys.has(key)).toBe(false);
      seenKeys.add(key);
    }
  });

  it("builds an honest portfolio review node referencing recently closed trades and only available risk signals", () => {
    const graph = buildKnowledgeGraph(
      baseInput({
        riskReport: riskReport({
          signals: [
            { code: "portfolio_concentration", label: "Concentration", available: true, headline: "35% in NVDA", detail: "detail", sourceModule: "x" },
            { code: "correlation_risk", label: "Correlation", available: false, headline: "", detail: "no data", sourceModule: "x" },
          ],
        }),
      }),
    );
    const review = graph.nodes.find((n) => n.type === "portfolio-review");
    expect(review).toBeTruthy();
    // Only the 1 available signal is counted, never the unavailable one.
    expect(review!.detail).toContain("1 risk signal(s)");
    const referencesEdge = graph.edges.find((e) => e.from === review!.id && e.relation === "references");
    expect(referencesEdge).toBeTruthy();
  });

  it("produces no portfolio-review node when portfolioHealth is null (never fabricates a score)", () => {
    const graph = buildKnowledgeGraph(baseInput({ portfolioHealth: null }));
    expect(graph.nodes.find((n) => n.type === "portfolio-review")).toBeUndefined();
  });

  it("produces no portfolio-review node when confidenceLevel is Low — computePortfolioHealthScore() honestly returns 0/Poor for a brand-new user rather than null, so this must be gated explicitly", () => {
    const graph = buildKnowledgeGraph(baseInput({ portfolioHealth: healthScore({ overall: 0, label: "Poor", confidenceLevel: "Low" }) }));
    expect(graph.nodes.find((n) => n.type === "portfolio-review")).toBeUndefined();
  });

  it("is empty (but well-shaped) for a brand-new user with nothing recorded anywhere", () => {
    const graph = buildKnowledgeGraph({
      notebooks: [],
      strategies: [],
      lifecycleRecords: [],
      journalEntries: [],
      portfolioHealth: null,
      riskReport: null,
    });
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
  });
});

describe("traversal", () => {
  it("relatedEntities finds both outgoing and incoming edges for a node", () => {
    const graph = buildKnowledgeGraph(baseInput());
    const related = relatedEntities(graph, "trade-plan:100");
    expect(related.some((r) => r.node.id === "strategy:10")).toBe(true);
    const strategyRelated = relatedEntities(graph, "strategy:10");
    expect(strategyRelated.some((r) => r.node.id === "trade-plan:100")).toBe(true);
  });

  it("relatedEntitiesOfType filters to just one entity type", () => {
    const graph = buildKnowledgeGraph(baseInput());
    const companies = relatedEntitiesOfType(graph, "trade-plan:100", "company");
    expect(companies.every((r) => r.node.type === "company")).toBe(true);
    expect(companies.some((r) => r.node.symbol === "NVDA")).toBe(true);
  });

  it("relatedEntitiesWithinTwoHops finds a trade plan connected to a notebook only via a shared tag", () => {
    const graph = buildKnowledgeGraph(baseInput({ notebooks: [notebook({ tags: ["NVDA"] })] }));
    const twoHop = relatedEntitiesWithinTwoHops(graph, "notebook:1", "trade-plan");
    expect(twoHop.some((r) => r.node.id === "trade-plan:100")).toBe(true);
  });

  it("nodeById returns null for an unknown id, never throws", () => {
    const graph = buildKnowledgeGraph(baseInput());
    expect(nodeById(graph, "trade-plan:999999")).toBeNull();
  });

  it("nodesByConnectionCount sorts by real edge count, descending", () => {
    const graph = buildKnowledgeGraph(baseInput());
    const ranked = nodesByConnectionCount(graph);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].connections).toBeGreaterThanOrEqual(ranked[i].connections);
    }
    expect(ranked.every((r) => r.connections > 0)).toBe(true);
  });
});

describe("searchKnowledgeGraph", () => {
  it("matches on label directly", () => {
    const graph = buildKnowledgeGraph(baseInput());
    expect(searchKnowledgeGraph(graph, "breakout").some((r) => r.node.id === "strategy:10" && r.matchedOn === "label")).toBe(true);
  });

  it("matches on symbol when the query isn't present in the node's own label or tags", () => {
    // A plan whose title has no "NVDA" substring, but whose plannedAsset
    // (and therefore derived node.symbol) is NVDA.
    const graph = buildKnowledgeGraph(
      baseInput({
        strategies: [],
        lifecycleRecords: [lifecycleRecord({ tradePlan: tradePlan({ title: "Growth thesis Q3", plannedAsset: "NVDA", strategyId: null, tags: [] }) })],
      }),
    );
    const results = searchKnowledgeGraph(graph, "nvda");
    expect(results.some((r) => r.node.id === "trade-plan:100" && r.matchedOn === "symbol")).toBe(true);
  });

  it("matches on tag when the query isn't present in the node's own label or symbol", () => {
    // A notebook whose title has no "swingsetup" substring, tagged with it.
    const graph = buildKnowledgeGraph(baseInput({ notebooks: [notebook({ title: "Sector rotation ideas", tags: ["swingsetup"] })] }));
    const results = searchKnowledgeGraph(graph, "swingsetup");
    expect(results.some((r) => r.node.id === "notebook:1" && r.matchedOn === "tag")).toBe(true);
  });

  it("returns an empty array for a blank query, never every node", () => {
    const graph = buildKnowledgeGraph(baseInput());
    expect(searchKnowledgeGraph(graph, "   ")).toEqual([]);
  });

  it("respects an optional type filter", () => {
    const graph = buildKnowledgeGraph(baseInput());
    const results = searchKnowledgeGraph(graph, "nvda", ["notebook"]);
    expect(results.every((r) => r.node.type === "notebook")).toBe(true);
  });
});

describe("buildInvestmentTimeline", () => {
  const stages = [
    { id: "ideas", label: "Ideas", description: "d1" },
    { id: "research", label: "Research", description: "d2" },
    { id: "closed", label: "Closed", description: "d3" },
    { id: "journal-pending", label: "Journal Pending", description: "d4" },
    { id: "reviewed", label: "Reviewed", description: "d5" },
  ];

  it("marks every stage up to and including the current stage as reached", () => {
    const rec = lifecycleRecord({ currentStage: "closed" });
    const timeline = buildInvestmentTimeline(rec, stages, null);
    expect(timeline.find((t) => t.stageId === "ideas")!.reached).toBe(true);
    expect(timeline.find((t) => t.stageId === "closed")!.reached).toBe(true);
    expect(timeline.find((t) => t.stageId === "journal-pending")!.reached).toBe(false);
    expect(timeline.find((t) => t.stageId === "closed")!.isCurrent).toBe(true);
  });

  it("substitutes the real lesson learned text for the 'reviewed' stage description when reached", () => {
    const rec = lifecycleRecord({ currentStage: "reviewed" });
    const timeline = buildInvestmentTimeline(rec, stages, { lessonLearned: "Never chase a breakout without volume confirmation." });
    const reviewedEvent = timeline.find((t) => t.stageId === "reviewed")!;
    expect(reviewedEvent.description).toBe("Never chase a breakout without volume confirmation.");
  });

  it("never fabricates a lesson-learned description when none is reached yet", () => {
    const rec = lifecycleRecord({ currentStage: "closed" });
    const timeline = buildInvestmentTimeline(rec, stages, { lessonLearned: "Some lesson" });
    const reviewedEvent = timeline.find((t) => t.stageId === "reviewed")!;
    expect(reviewedEvent.description).toBe("d5");
  });

  it("labels every event with which module it was sourced from", () => {
    const rec = lifecycleRecord();
    const timeline = buildInvestmentTimeline(rec, stages, null);
    expect(timeline.every((t) => typeof t.sourceModule === "string" && t.sourceModule.length > 0)).toBe(true);
  });
});

describe("discoverPatterns", () => {
  it("never reports a recurring-lesson pattern from a single occurrence", () => {
    const patterns = discoverPatterns(
      buildKnowledgeGraph(baseInput()),
      [journalEntry({ content: "Broke my stop loss rule once." })],
      null,
    );
    expect(patterns.find((p) => p.kind === "recurring-lesson-keyword")).toBeUndefined();
  });

  it("reports a recurring-lesson pattern once at least 2 entries share a keyword category, with quoted evidence", () => {
    const entries = [
      journalEntry({ id: 1, title: "Trade A", content: "Ignored my stop loss again." }),
      journalEntry({ id: 2, title: "Trade B", lessonLearned: "Set a hard stop-loss next time." }),
    ];
    const patterns = discoverPatterns(buildKnowledgeGraph(baseInput()), entries, null);
    const p = patterns.find((p) => p.kind === "recurring-lesson-keyword");
    expect(p).toBeTruthy();
    expect(p!.evidence.length).toBeGreaterThanOrEqual(2);
  });

  it("reports a winning-strategy-cluster only when 2+ closed, profitable trade plans share a strategy", () => {
    const graph = buildKnowledgeGraph(
      baseInput({
        lifecycleRecords: [
          lifecycleRecord({ tradePlan: tradePlan({ id: 101 }), performanceStatus: { state: "closed", unrealizedPnl: null, realizedPnl: 100 } }),
          lifecycleRecord({ tradePlan: tradePlan({ id: 102 }), performanceStatus: { state: "closed", unrealizedPnl: null, realizedPnl: 50 } }),
        ],
      }),
    );
    const patterns = discoverPatterns(graph, [], null);
    const cluster = patterns.find((p) => p.kind === "winning-strategy-cluster");
    expect(cluster).toBeTruthy();
    expect(cluster!.evidence.length).toBe(2);
  });

  it("surfaces Sprint 15's own genuine risk signals unchanged, filtering out unavailable ones, never inventing a new score", () => {
    const risk = riskReport({
      signals: [
        { code: "portfolio_concentration", label: "Concentration", available: true, headline: "35% in NVDA", detail: "detail-a", sourceModule: "x" },
        { code: "single_position_risk", label: "Single-Position Risk", available: true, headline: "hi", detail: "detail-b", sourceModule: "x" },
      ],
    });
    const patterns = discoverPatterns(buildKnowledgeGraph(baseInput()), [], risk);
    const p = patterns.find((p) => p.kind === "portfolio-risk-signal");
    expect(p).toBeTruthy();
    expect(p!.evidence).toEqual(["Concentration: 35% in NVDA", "Single-Position Risk: hi"]);
  });

  it("never reports a portfolio-risk-signal pattern from the always-available 'Pending Trade Impact'/'Sector Exposure'/'Correlation Risk' signal codes alone — those aren't in the narrower genuine-risk set buildPortfolioCoachNarrative() itself already established", () => {
    const risk = riskReport({
      signals: [
        { code: "pending_trade_impact", label: "Pending Trade Impact", available: true, headline: "None pending", detail: "No trade plans are currently Ready to Execute.", sourceModule: "x" },
        { code: "correlation_risk", label: "Correlation Risk", available: true, headline: "1 categorical cluster", detail: "x", sourceModule: "x" },
        { code: "sector_exposure", label: "Sector Exposure", available: true, headline: "Tech: 40%", detail: "x", sourceModule: "x" },
      ],
    });
    const patterns = discoverPatterns(buildKnowledgeGraph(baseInput()), [], risk);
    expect(patterns.find((p) => p.kind === "portfolio-risk-signal")).toBeUndefined();
  });

  it("reports research-linked-to-wins only when a notebook is 2-hop-connected to 2+ profitable trade plans", () => {
    const graph = buildKnowledgeGraph(
      baseInput({
        notebooks: [notebook({ tags: ["momentum"] })],
        lifecycleRecords: [
          lifecycleRecord({ tradePlan: tradePlan({ id: 101, tags: ["momentum"] }), performanceStatus: { state: "closed", unrealizedPnl: null, realizedPnl: 100 } }),
          lifecycleRecord({ tradePlan: tradePlan({ id: 102, tags: ["momentum"] }), performanceStatus: { state: "closed", unrealizedPnl: null, realizedPnl: 50 } }),
        ],
      }),
    );
    const patterns = discoverPatterns(graph, [], null);
    expect(patterns.find((p) => p.kind === "research-linked-to-wins")).toBeTruthy();
  });
});

describe("answerKnowledgeQuestion", () => {
  it("trades-using-strategy honestly asks for a strategy first when none is chosen", () => {
    const answer = answerKnowledgeQuestion("trades-using-strategy", buildKnowledgeGraph(baseInput()), [], null);
    expect(answer.answer).toBe("Pick a strategy first.");
    expect(answer.citations).toEqual([]);
  });

  it("trades-using-strategy cites every real trade plan using that strategy", () => {
    const graph = buildKnowledgeGraph(baseInput());
    const answer = answerKnowledgeQuestion("trades-using-strategy", graph, [], null, "strategy:10");
    expect(answer.answer).toContain("NVDA breakout plan");
    expect(answer.citations.length).toBe(1);
  });

  it("trades-using-strategy honestly reports zero matches for an unused strategy", () => {
    const graph = buildKnowledgeGraph(baseInput({ strategies: [strategy({ id: 20, title: "Unused strategy" })], lifecycleRecords: [] }));
    const answer = answerKnowledgeQuestion("trades-using-strategy", graph, [], null, "strategy:20");
    expect(answer.answer).toContain("No trade plans reference");
  });

  it("research-behind-best-trades honestly reports when there are no profitable closed trades", () => {
    const graph = buildKnowledgeGraph(baseInput({ lifecycleRecords: [] }));
    const answer = answerKnowledgeQuestion("research-behind-best-trades", graph, [], null);
    expect(answer.answer).toContain("No closed, profitable trade plans yet");
  });

  it("recurring-mistakes reuses discoverPatterns() rather than a second detector", () => {
    const entries = [
      journalEntry({ id: 1, content: "Position sizing was way too large." }),
      journalEntry({ id: 2, lessonLearned: "Reduce position size next time." }),
    ];
    const answer = answerKnowledgeQuestion("recurring-mistakes", buildKnowledgeGraph(baseInput()), entries, null);
    expect(answer.answer).toContain("position sizing");
  });

  it("lessons-for-drawdown only cites entries with both a real recorded loss and a lesson learned", () => {
    const entries = [
      journalEntry({ id: 1, title: "Loss with lesson", realizedPnl: -100, lessonLearned: "Cut losses faster." }),
      journalEntry({ id: 2, title: "Loss without lesson", realizedPnl: -50, lessonLearned: null }),
      journalEntry({ id: 3, title: "Win", realizedPnl: 100, lessonLearned: "Ride winners longer." }),
    ];
    const answer = answerKnowledgeQuestion("lessons-for-drawdown", buildKnowledgeGraph(baseInput()), entries, null);
    expect(answer.answer).toContain("Loss with lesson");
    expect(answer.answer).not.toContain("Loss without lesson");
    expect(answer.answer).not.toContain("Ride winners longer");
    expect(answer.answer).toContain("no equity time-series");
  });

  it("lessons-for-drawdown honestly reports nothing when no loss carries a lesson", () => {
    const answer = answerKnowledgeQuestion("lessons-for-drawdown", buildKnowledgeGraph(baseInput()), [], null);
    expect(answer.answer).toContain("nothing to honestly report");
  });
});

describe("buildKnowledgeInsights", () => {
  it("produces a well-shaped, honestly-empty insights object for a brand-new user", () => {
    const graph = buildKnowledgeGraph({ notebooks: [], strategies: [], lifecycleRecords: [], journalEntries: [], portfolioHealth: null, riskReport: null });
    const insights = buildKnowledgeInsights(graph, [], null);
    expect(insights.recentDiscoveries).toEqual([]);
    expect(insights.frequentlyConnected).toEqual([]);
    expect(insights.repeatedMistakes).toEqual([]);
    expect(insights.strongestLearningImprovements).toEqual([]);
    expect(insights.emergingThemes).toEqual([]);
  });

  it("surfaces strongest learning improvements only from entries with both a lesson learned and a non-negative realized P&L", () => {
    const entries = [
      journalEntry({ id: 1, title: "Good outcome", realizedPnl: 50, lessonLearned: "Stuck to the plan." }),
      journalEntry({ id: 2, title: "Bad outcome", realizedPnl: -50, lessonLearned: "Ignored my thesis." }),
    ];
    const insights = buildKnowledgeInsights(buildKnowledgeGraph(baseInput()), entries, null);
    expect(insights.strongestLearningImprovements.some((s) => s.includes("Good outcome"))).toBe(true);
    expect(insights.strongestLearningImprovements.some((s) => s.includes("Bad outcome"))).toBe(false);
  });

  it("frequentlyConnected reuses nodesByConnectionCount rather than a second ranking formula", () => {
    const graph = buildKnowledgeGraph(baseInput());
    const insights = buildKnowledgeInsights(graph, [], null);
    const direct = nodesByConnectionCount(graph).slice(0, 5);
    expect(insights.frequentlyConnected.map((r) => r.node.id)).toEqual(direct.map((r) => r.node.id));
  });
});
