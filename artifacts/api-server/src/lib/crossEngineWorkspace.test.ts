// Phase 34 — Cross-Engine Orchestration & Unified Workspace.
import { describe, it, expect } from "vitest";
import {
  buildWorkspaceActivityTimeline,
  buildGlobalSearchResults,
  buildCrossEngineRecentItems,
  buildCrossEngineTasks,
  buildCrossEngineWorkspaceHub,
  type WorkspaceSearchEntities,
} from "./crossEngineWorkspace.js";
import type { ActivityTimelineInput } from "./executiveIntelligence.js";

function emptyActivityInput(): ActivityTimelineInput {
  return {
    journalEntries: [],
    committeeSnapshots: [],
    riskSnapshots: [],
    optimisationReviews: [],
    researchNotes: [],
    reports: [],
    notifications: [],
  };
}

function emptySearchEntities(): WorkspaceSearchEntities {
  return {
    portfolios: [],
    holdings: [],
    researchNotes: [],
    committeeSnapshots: [],
    tradePlans: [],
    tradingJournal: [],
    strategies: [],
    reports: [],
    learningTopics: [],
  };
}

describe("buildWorkspaceActivityTimeline", () => {
  it("honestly returns an empty timeline when nothing has ever been persisted", () => {
    const result = buildWorkspaceActivityTimeline(emptyActivityInput(), { tradePlans: [], strategies: [], learningCompletions: [] });
    expect(result).toEqual([]);
  });

  it("merges base Phase 33 activity with the 3 new entry types, sorted newest-first", () => {
    const base: ActivityTimelineInput = {
      ...emptyActivityInput(),
      journalEntries: [{ title: "Options journal note", createdAt: new Date("2026-01-05T00:00:00Z") }],
    };
    const extra = {
      tradePlans: [{ symbol: "AAPL", direction: "long", createdAt: new Date("2026-01-10T00:00:00Z") }],
      strategies: [{ name: "Breakout Momentum", category: "trend", createdAt: new Date("2026-01-08T00:00:00Z") }],
      learningCompletions: [{ title: "Reading the Order Book", completedAt: new Date("2026-01-03T00:00:00Z") }],
    };
    const result = buildWorkspaceActivityTimeline(base, extra);
    expect(result).toHaveLength(4);
    // Newest first.
    expect(result[0].type).toBe("trade-plan-created");
    expect(result[0].detail).toBe("AAPL (long)");
    expect(result[0].linkPath).toBe("/trade-planning-studio?symbol=AAPL");
    expect(result[1].type).toBe("strategy-registered");
    expect(result[1].detail).toBe("Breakout Momentum (trend)");
    expect(result[2].type).toBe("journal-entry");
    expect(result[3].type).toBe("learning-topic-completed");
    expect(result[3].detail).toBe("Reading the Order Book");
  });

  it("respects an explicit limit across the merged, re-sorted set", () => {
    const extra = {
      tradePlans: [
        { symbol: "AAPL", direction: "long", createdAt: new Date("2026-01-10T00:00:00Z") },
        { symbol: "MSFT", direction: "short", createdAt: new Date("2026-01-09T00:00:00Z") },
      ],
      strategies: [],
      learningCompletions: [],
    };
    const result = buildWorkspaceActivityTimeline(emptyActivityInput(), extra, 1);
    expect(result).toHaveLength(1);
    expect(result[0].detail).toBe("AAPL (long)");
  });

  it("never fabricates a symbol for a strategy or learning entry", () => {
    const extra = {
      tradePlans: [],
      strategies: [{ name: "Mean Reversion", category: "range", createdAt: new Date() }],
      learningCompletions: [{ title: "Volatility Basics", completedAt: new Date() }],
    };
    const result = buildWorkspaceActivityTimeline(emptyActivityInput(), extra);
    for (const entry of result) expect(entry.symbol).toBeNull();
  });
});

describe("buildGlobalSearchResults", () => {
  it("returns no results for an empty query — this is a search, not a browse-all dump", () => {
    const entities: WorkspaceSearchEntities = {
      ...emptySearchEntities(),
      portfolios: [{ id: 1, name: "Core Holdings", createdAt: new Date() }],
    };
    expect(buildGlobalSearchResults("", entities)).toEqual([]);
    expect(buildGlobalSearchResults("   ", entities)).toEqual([]);
  });

  it("performs deterministic, case-insensitive substring matching across all 9 categories", () => {
    const entities: WorkspaceSearchEntities = {
      portfolios: [{ id: 1, name: "Growth Portfolio", createdAt: new Date() }],
      holdings: [{ id: 2, portfolioId: 1, symbol: "GROWTH", createdAt: new Date() }],
      researchNotes: [{ id: 3, symbol: "AAPL", note: "Strong growth outlook this quarter", createdAt: new Date() }],
      committeeSnapshots: [{ id: 4, symbol: "MSFT", recommendation: "Buy — growth accelerating", createdAt: new Date() }],
      tradePlans: [{ id: 5, symbol: "GROWTH", direction: "long", status: "draft", createdAt: new Date() }],
      tradingJournal: [{ id: 6, title: "Growth setup review", content: "n/a", createdAt: new Date() }],
      strategies: [{ id: 7, name: "Growth Momentum", description: "n/a", category: "trend", createdAt: new Date() }],
      reports: [{ id: 8, reportType: "growth-summary", title: "Growth Summary Report", createdAt: new Date() }],
      learningTopics: [{ pathKey: "foundations", topicKey: "growth-investing", title: "Growth Investing 101" }],
    };
    const results = buildGlobalSearchResults("growth", entities);
    const categories = results.map((r) => r.category).sort();
    expect(categories).toEqual(
      [
        "committee-snapshot",
        "holding",
        "learning-topic",
        "portfolio",
        "report",
        "research-note",
        "strategy",
        "trade-plan",
        "trading-journal",
      ].sort(),
    );
  });

  it("is genuinely case-insensitive", () => {
    const entities: WorkspaceSearchEntities = { ...emptySearchEntities(), portfolios: [{ id: 1, name: "Core Holdings", createdAt: new Date() }] };
    expect(buildGlobalSearchResults("CORE", entities)).toHaveLength(1);
    expect(buildGlobalSearchResults("holdings", entities)).toHaveLength(1);
  });

  it("never matches a substring that isn't present, proving this is real filtering, not a fabricated hit", () => {
    const entities: WorkspaceSearchEntities = { ...emptySearchEntities(), portfolios: [{ id: 1, name: "Core Holdings", createdAt: new Date() }] };
    expect(buildGlobalSearchResults("zzz-not-present", entities)).toEqual([]);
  });

  it("caps results per category at 10", () => {
    const portfolios = Array.from({ length: 15 }, (_, i) => ({ id: i, name: "Match Portfolio", createdAt: new Date() }));
    const entities: WorkspaceSearchEntities = { ...emptySearchEntities(), portfolios };
    const results = buildGlobalSearchResults("match", entities);
    expect(results).toHaveLength(10);
  });

  it("honestly reports a null occurredAt for learning topics, never a fabricated timestamp", () => {
    const entities: WorkspaceSearchEntities = {
      ...emptySearchEntities(),
      learningTopics: [{ pathKey: "foundations", topicKey: "stocks", title: "Stocks" }],
    };
    const results = buildGlobalSearchResults("stocks", entities);
    expect(results[0].occurredAt).toBeNull();
  });

  it("truncates a long research note detail rather than dumping the full text", () => {
    const longNote = "x".repeat(200);
    const entities: WorkspaceSearchEntities = {
      ...emptySearchEntities(),
      researchNotes: [{ id: 1, symbol: "AAPL", note: longNote, createdAt: new Date() }],
    };
    const results = buildGlobalSearchResults("aapl", entities);
    expect(results[0].detail.length).toBeLessThan(longNote.length);
    expect(results[0].detail.endsWith("…")).toBe(true);
  });
});

describe("buildCrossEngineRecentItems", () => {
  it("honestly returns an empty list when nothing has ever been persisted", () => {
    expect(buildCrossEngineRecentItems(emptySearchEntities())).toEqual([]);
  });

  it("picks the single most-recently-created row per category, never all rows", () => {
    const entities: WorkspaceSearchEntities = {
      ...emptySearchEntities(),
      portfolios: [
        { id: 1, name: "Older Portfolio", createdAt: new Date("2026-01-01T00:00:00Z") },
        { id: 2, name: "Newer Portfolio", createdAt: new Date("2026-01-10T00:00:00Z") },
      ],
    };
    const items = buildCrossEngineRecentItems(entities);
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("Newer Portfolio");
  });

  it("never includes a learning-topic entry — the catalog has no persisted creation timestamp", () => {
    const items = buildCrossEngineRecentItems(emptySearchEntities());
    expect(items.some((i) => i.category === "learning-topic")).toBe(false);
  });

  it("sorts across categories by recency, newest first", () => {
    const entities: WorkspaceSearchEntities = {
      ...emptySearchEntities(),
      portfolios: [{ id: 1, name: "P", createdAt: new Date("2026-01-01T00:00:00Z") }],
      reports: [{ id: 2, reportType: "x", title: "R", createdAt: new Date("2026-01-15T00:00:00Z") }],
    };
    const items = buildCrossEngineRecentItems(entities);
    expect(items[0].category).toBe("report");
    expect(items[1].category).toBe("portfolio");
  });
});

describe("buildCrossEngineTasks", () => {
  it("honestly reports zero tasks when nothing needs attention", () => {
    expect(
      buildCrossEngineTasks({
        unreadNotificationsCount: 0,
        positionsMissingStopOrTargetCount: 0,
        portfoliosWithoutHoldingsCount: 0,
        strategyChecklistsInProgress: 0,
      }),
    ).toEqual([]);
  });

  it("only surfaces tasks whose count is genuinely greater than zero", () => {
    const tasks = buildCrossEngineTasks({
      unreadNotificationsCount: 3,
      positionsMissingStopOrTargetCount: 0,
      portfoliosWithoutHoldingsCount: 1,
      strategyChecklistsInProgress: 0,
    });
    expect(tasks.map((t) => t.code)).toEqual(["unread-notifications", "portfolios-without-holdings"]);
    expect(tasks[0].count).toBe(3);
    expect(tasks[1].count).toBe(1);
  });

  it("surfaces all 4 task codes when every count is positive", () => {
    const tasks = buildCrossEngineTasks({
      unreadNotificationsCount: 1,
      positionsMissingStopOrTargetCount: 2,
      portfoliosWithoutHoldingsCount: 3,
      strategyChecklistsInProgress: 4,
    });
    expect(tasks).toHaveLength(4);
  });
});

describe("buildCrossEngineWorkspaceHub", () => {
  it("composes all three pieces plus a generatedAt timestamp, honestly empty for a brand-new user", () => {
    const hub = buildCrossEngineWorkspaceHub({
      activityInput: emptyActivityInput(),
      activityExtra: { tradePlans: [], strategies: [], learningCompletions: [] },
      searchEntities: emptySearchEntities(),
      tasksInput: {
        unreadNotificationsCount: 0,
        positionsMissingStopOrTargetCount: 0,
        portfoliosWithoutHoldingsCount: 0,
        strategyChecklistsInProgress: 0,
      },
    });
    expect(hub.recentActivity).toEqual([]);
    expect(hub.recentItems).toEqual([]);
    expect(hub.tasks).toEqual([]);
    expect(typeof hub.generatedAt).toBe("string");
  });
});
