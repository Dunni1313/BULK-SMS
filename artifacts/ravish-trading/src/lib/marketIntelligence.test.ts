// v1.5.0, Sprint 20 — Institutional Market Intelligence Engine. Direct
// unit coverage over the pure entity-linking/grouping functions — proves
// every enrichment traces to real graph edges/watchlist membership, never
// a fabricated relevance signal.

import { describe, it, expect } from "vitest";
import {
  enrichMarketIntelligenceItem,
  enrichMarketIntelligenceFeed,
  watchlistRelevantItems,
  priorityItems,
  todaysKeyEvents,
  upcomingEconomicReleases,
  portfolioRelevantItems,
  buildMarketIntelligenceCoachNarrative,
} from "./marketIntelligence";
import type { KnowledgeGraph } from "./knowledgeGraph";
import type { MarketIntelligenceItem } from "@workspace/api-client-react";

function item(overrides: Partial<MarketIntelligenceItem> = {}): MarketIntelligenceItem {
  return {
    id: "earnings:AAPL:2026-08-20",
    headline: "AAPL earnings",
    category: "earnings",
    source: "Simulated Economic/Event Calendar (eventRisk.ts)",
    dataSource: "SIMULATED",
    timestamp: "2026-08-20T00:00:00.000Z",
    impact: "high",
    affectedAssets: ["AAPL"],
    affectedSectors: [],
    potentialRisks: ["Post-earnings implied-volatility crush for open premium."],
    potentialOpportunities: [],
    summary: "AAPL earnings — in 5 days (2026-08-20).",
    learnMore: { pathKey: "volatility", topicKey: "volatility-earnings", label: "Earnings Volatility & IV Crush" },
    ...overrides,
  };
}

function emptyGraph(): KnowledgeGraph {
  return { nodes: [], edges: [], generatedAt: new Date().toISOString() };
}

function graphWithCompanyLinks(): KnowledgeGraph {
  return {
    nodes: [
      { type: "company", id: "company:AAPL", rawId: "AAPL", label: "AAPL", coachId: null, symbol: "AAPL", tags: [], href: "/stock-analyst?symbol=AAPL", detail: "Every entity tagged AAPL.", createdAt: null },
      { type: "notebook", id: "notebook:1", rawId: 1, label: "AAPL thesis notebook", coachId: "investing", symbol: null, tags: ["AAPL"], href: "/institutional-ai-coach", detail: "Investing research notebook.", createdAt: "2026-08-01T00:00:00Z" },
      { type: "strategy", id: "strategy:1", rawId: 1, label: "AAPL covered call", coachId: "options", symbol: null, tags: ["AAPL"], href: "/institutional-ai-coach", detail: "Options strategy — active.", createdAt: "2026-08-01T00:00:00Z" },
      { type: "journal-entry", id: "journal-entry:1", rawId: 1, label: "AAPL lesson", coachId: null, symbol: null, tags: ["AAPL"], href: "/journal", detail: "Lesson recorded: sized correctly.", createdAt: "2026-08-01T00:00:00Z" },
    ],
    edges: [
      { from: "notebook:1", to: "company:AAPL", relation: "relates to", evidence: "shared tag: AAPL" },
      { from: "strategy:1", to: "company:AAPL", relation: "relates to", evidence: "shared tag: AAPL" },
      { from: "journal-entry:1", to: "company:AAPL", relation: "relates to", evidence: "shared tag: AAPL" },
    ],
    generatedAt: new Date().toISOString(),
  };
}

describe("enrichMarketIntelligenceItem", () => {
  it("marks an item watched only when an affected asset is genuinely on a watched list", () => {
    const watched = enrichMarketIntelligenceItem(item(), emptyGraph(), new Set(["AAPL"]), new Set());
    expect(watched.isWatched).toBe(true);
    const unwatched = enrichMarketIntelligenceItem(item(), emptyGraph(), new Set(["MSFT"]), new Set());
    expect(unwatched.isWatched).toBe(false);
  });

  it("always marks macro/central_banks items watched — market-wide items affect every portfolio regardless of watchlist", () => {
    const macro = enrichMarketIntelligenceItem(item({ category: "macro", affectedAssets: [] }), emptyGraph(), new Set(), new Set());
    expect(macro.isWatched).toBe(true);
    const central = enrichMarketIntelligenceItem(item({ category: "central_banks", affectedAssets: [] }), emptyGraph(), new Set(), new Set());
    expect(central.isWatched).toBe(true);
  });

  it("never fabricates a held holding — relatedHoldings is only ever a real subset of affectedAssets intersected with the caller-supplied held set", () => {
    const held = enrichMarketIntelligenceItem(item(), emptyGraph(), new Set(["AAPL"]), new Set(["AAPL"]));
    expect(held.relatedHoldings).toEqual(["AAPL"]);
    const notHeld = enrichMarketIntelligenceItem(item(), emptyGraph(), new Set(["AAPL"]), new Set());
    expect(notHeld.relatedHoldings).toEqual([]);
  });

  it("isPriority requires BOTH high impact AND (watched or held) — never impact alone", () => {
    const priorityHit = enrichMarketIntelligenceItem(item({ impact: "high" }), emptyGraph(), new Set(["AAPL"]), new Set());
    expect(priorityHit.isPriority).toBe(true);
    const highButIrrelevant = enrichMarketIntelligenceItem(item({ impact: "high" }), emptyGraph(), new Set(["MSFT"]), new Set());
    expect(highButIrrelevant.isPriority).toBe(false);
    const relevantButLowImpact = enrichMarketIntelligenceItem(item({ impact: "low" }), emptyGraph(), new Set(["AAPL"]), new Set());
    expect(relevantButLowImpact.isPriority).toBe(false);
  });

  it("connects related research/strategies/lessons via the real Knowledge Graph company node — never a fabricated link", () => {
    const enriched = enrichMarketIntelligenceItem(item(), graphWithCompanyLinks(), new Set(["AAPL"]), new Set());
    expect(enriched.relatedResearch.map((r) => r.label)).toEqual(["AAPL thesis notebook"]);
    expect(enriched.relatedStrategies.map((r) => r.label)).toEqual(["AAPL covered call"]);
    expect(enriched.relatedLessons.map((r) => r.label)).toEqual(["AAPL lesson"]);
  });

  it("reports no related entities when the affected asset has no company node in the graph, never a fabricated placeholder", () => {
    const enriched = enrichMarketIntelligenceItem(item(), emptyGraph(), new Set(["AAPL"]), new Set());
    expect(enriched.relatedResearch).toEqual([]);
    expect(enriched.relatedStrategies).toEqual([]);
    expect(enriched.relatedLessons).toEqual([]);
  });

  it("suggests a real, already-shipped playbook id per category, or none for an unmapped category", () => {
    const earnings = enrichMarketIntelligenceItem(item({ category: "earnings" }), emptyGraph(), new Set(), new Set());
    expect(earnings.relatedPlaybook?.id).toBe("investment-research");
    expect(earnings.relatedPlaybook?.href).toBe("/playbooks?playbookId=investment-research");
    const volatility = enrichMarketIntelligenceItem(item({ category: "volatility" }), emptyGraph(), new Set(), new Set());
    expect(volatility.relatedPlaybook?.id).toBe("risk-review");
  });
});

describe("Command Centre / page grouping filters", () => {
  const enriched = [
    enrichMarketIntelligenceItem(item({ id: "a", impact: "high" }), emptyGraph(), new Set(["AAPL"]), new Set(["AAPL"])),
    enrichMarketIntelligenceItem(item({ id: "b", category: "economic_events", affectedAssets: [] }), emptyGraph(), new Set(), new Set()),
    enrichMarketIntelligenceItem(item({ id: "c", category: "central_banks", affectedAssets: [], timestamp: "2026-08-15T00:00:00.000Z" }), emptyGraph(), new Set(), new Set()),
    enrichMarketIntelligenceItem(item({ id: "d", affectedAssets: ["MSFT"], timestamp: "2026-08-15T00:00:00.000Z" }), emptyGraph(), new Set(["MSFT"]), new Set()),
  ];

  it("watchlistRelevantItems returns only isWatched items", () => {
    expect(watchlistRelevantItems(enriched).map((i) => i.id).sort()).toEqual(["a", "c", "d"]);
  });

  it("priorityItems returns only isPriority items", () => {
    // "c" is central_banks (market-wide, always watched) at default high
    // impact, so it is genuinely priority too — not a fabricated inclusion.
    expect(priorityItems(enriched).map((i) => i.id)).toEqual(["a", "c", "d"]);
  });

  it("todaysKeyEvents filters to today's date and excludes low-impact items", () => {
    expect(todaysKeyEvents(enriched, "2026-08-15").map((i) => i.id).sort()).toEqual(["c", "d"]);
  });

  it("upcomingEconomicReleases returns only economic_events/central_banks categories", () => {
    expect(upcomingEconomicReleases(enriched).map((i) => i.id).sort()).toEqual(["b", "c"]);
  });

  it("portfolioRelevantItems reuses the same relevance set as watchlist relevance — no duplicate calculation", () => {
    expect(portfolioRelevantItems(enriched).map((i) => i.id).sort()).toEqual(watchlistRelevantItems(enriched).map((i) => i.id).sort());
  });
});

describe("enrichMarketIntelligenceFeed", () => {
  it("enriches every item in the feed, preserving order", () => {
    const feed = [item({ id: "x" }), item({ id: "y", category: "macro" })];
    const enriched = enrichMarketIntelligenceFeed(feed, emptyGraph(), new Set(), new Set());
    expect(enriched.map((i) => i.id)).toEqual(["x", "y"]);
  });
});

describe("buildMarketIntelligenceCoachNarrative", () => {
  it("never predicts price direction or issues a trading signal — only restates already-known facts", () => {
    const enriched = enrichMarketIntelligenceItem(item(), graphWithCompanyLinks(), new Set(["AAPL"]), new Set(["AAPL"]));
    const narrative = buildMarketIntelligenceCoachNarrative(enriched);
    const allText = `${narrative.whyThisMatters} ${narrative.affectedAssets} ${narrative.affectedHoldings} ${narrative.researchToReview} ${narrative.playbooksToConsider}`;
    expect(allText).not.toMatch(/\bbuy\b|\bsell\b|price target|will rise|will fall|expect.*(higher|lower)/i);
    expect(narrative.affectedHoldings).toContain("AAPL");
    expect(narrative.researchToReview).toContain("AAPL thesis notebook");
    expect(narrative.playbooksToConsider).toContain("Investment Research");
  });

  it("honestly states when no related research or playbook exists, never fabricating one", () => {
    // "sentiment" is a reserved-but-unmapped category — genuinely has no
    // suggested playbook, unlike market_breadth which maps to Risk Review.
    const enriched = enrichMarketIntelligenceItem(item({ category: "sentiment", affectedAssets: [] }), emptyGraph(), new Set(), new Set());
    const narrative = buildMarketIntelligenceCoachNarrative(enriched);
    expect(narrative.researchToReview).toMatch(/no related research/i);
    expect(narrative.playbooksToConsider).toMatch(/no specific playbook/i);
  });
});
