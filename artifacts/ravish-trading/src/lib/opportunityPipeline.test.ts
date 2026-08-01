// v1.5.0, Sprint 21 — Institutional Opportunity Discovery Engine. Direct
// unit coverage over the pure discovery-composition functions — proves
// every discovered opportunity traces to a real, already-computed signal
// from an already-existing engine, never a fabricated one, and that the
// AI Discovery Coach never recommends buying/selling or predicts market
// direction.

import { describe, it, expect } from "vitest";
import {
  fromMarketIntelligence,
  fromWatchlistEvents,
  fromStaleWatchlistResearch,
  fromPortfolioGap,
  fromEmergingThemes,
  fromPreviouslyResearched,
  discoverOpportunities,
  buildOpportunityCoachNarrative,
  type DiscoveredOpportunity,
} from "./opportunityPipeline";
import type { MarketIntelligenceView } from "./marketIntelligence";
import type { ValueWatchlistItem, ResearchNoteItem } from "@workspace/api-client-react";
import type { HealthFactor } from "./portfolioRiskIntelligence";
import type { KnowledgeNode } from "./knowledgeGraph";

function marketIntelItem(overrides: Partial<MarketIntelligenceView> = {}): MarketIntelligenceView {
  return {
    id: "earnings:AAPL:today",
    headline: "AAPL earnings",
    category: "earnings",
    source: "Simulated Economic/Event Calendar (eventRisk.ts)",
    dataSource: "SIMULATED",
    timestamp: new Date().toISOString(),
    impact: "high",
    affectedAssets: ["AAPL"],
    affectedSectors: [],
    potentialRisks: ["Post-earnings IV crush."],
    potentialOpportunities: [],
    summary: "AAPL earnings — in 5 days.",
    learnMore: null,
    isWatched: true,
    isPriority: true,
    relatedResearch: [],
    relatedStrategies: [],
    relatedLessons: [],
    relatedHoldings: [],
    relatedPlaybook: null,
    ...overrides,
  };
}

function watchlistItem(overrides: Partial<ValueWatchlistItem> = {}): ValueWatchlistItem {
  return {
    id: 1,
    symbol: "MSFT",
    category: "core",
    fairValueEstimate: 400,
    desiredBuyPrice: 380,
    marginOfSafetyTarget: 20,
    reason: "Quality compounder.",
    currentDecision: "watch",
    lastResearchedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentPrice: null,
    priceTargetCrossed: null,
    marginOfSafetyTargetCrossed: null,
    ...overrides,
  };
}

describe("fromMarketIntelligence", () => {
  it("includes only priority/watched items, never a plain unwatched item", () => {
    const out = fromMarketIntelligence([marketIntelItem({ id: "a", isWatched: true, isPriority: false }), marketIntelItem({ id: "b", isWatched: false, isPriority: false })]);
    expect(out.map((o) => o.id)).toEqual(["market-intelligence:a"]);
  });

  it("carries real evidence from the item's own summary/risks/opportunities, never fabricated text", () => {
    const [out] = fromMarketIntelligence([marketIntelItem({ potentialOpportunities: ["A real opportunity line."] })]);
    expect(out.evidence).toContain("AAPL earnings — in 5 days.");
    expect(out.evidence).toContain("Post-earnings IV crush.");
    expect(out.evidence).toContain("A real opportunity line.");
  });

  it("maps category honestly and marks priority items high", () => {
    const [out] = fromMarketIntelligence([marketIntelItem({ category: "earnings", isPriority: true })]);
    expect(out.category).toBe("earnings");
    expect(out.priority).toBe("high");
  });
});

describe("fromWatchlistEvents", () => {
  it("never fabricates a crossed event for a watchlist item with no crossing", () => {
    expect(fromWatchlistEvents([watchlistItem({ priceTargetCrossed: false, marginOfSafetyTargetCrossed: false })])).toEqual([]);
  });

  it("surfaces a real price-target crossing with the actual numbers as evidence", () => {
    const [out] = fromWatchlistEvents([watchlistItem({ symbol: "MSFT", priceTargetCrossed: true, currentPrice: 375, desiredBuyPrice: 380 })]);
    expect(out.category).toBe("watchlist_event");
    expect(out.evidence[0]).toContain("375");
    expect(out.evidence[0]).toContain("380");
    expect(out.priority).toBe("high");
  });
});

describe("fromStaleWatchlistResearch", () => {
  it("flags a watchlist item never marked as researched", () => {
    const [out] = fromStaleWatchlistResearch([watchlistItem({ lastResearchedAt: null })]);
    expect(out.category).toBe("research_update_needed");
    expect(out.evidence[0]).toMatch(/never marked/i);
  });

  it("flags a watchlist item researched over 90 days ago, never one researched recently", () => {
    const old = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const out = fromStaleWatchlistResearch([watchlistItem({ symbol: "OLD", lastResearchedAt: old }), watchlistItem({ symbol: "RECENT", lastResearchedAt: recent })]);
    expect(out.map((o) => o.relatedAssets[0])).toEqual(["OLD"]);
  });
});

describe("fromPortfolioGap", () => {
  it("never fabricates a gap when the weakest factor is unavailable or null", () => {
    expect(fromPortfolioGap(null)).toEqual([]);
    const unavailable: HealthFactor = { code: "diversification", label: "Diversification", score: null, available: false, detail: "No data.", sourceModule: "" };
    expect(fromPortfolioGap(unavailable)).toEqual([]);
  });

  it("surfaces a real weakest-factor gap with its own detail as evidence", () => {
    const factor: HealthFactor = { code: "diversification", label: "Diversification", score: 40, available: true, detail: "Concentrated in 2 sectors.", sourceModule: "portfolioIntelligence.ts" };
    const [out] = fromPortfolioGap(factor);
    expect(out.category).toBe("portfolio_gap");
    expect(out.evidence).toEqual(["Concentrated in 2 sectors."]);
  });
});

describe("fromEmergingThemes", () => {
  it("maps each theme node into a knowledge_graph_relationship opportunity, never a fabricated connection count", () => {
    const node: KnowledgeNode = { type: "theme", id: "theme:ai", rawId: "ai", label: "AI", coachId: null, symbol: null, tags: [], href: null, detail: "", createdAt: null };
    const [out] = fromEmergingThemes([{ node, connections: 3 }]);
    expect(out.category).toBe("knowledge_graph_relationship");
    expect(out.evidence[0]).toContain("3");
  });
});

describe("fromPreviouslyResearched", () => {
  function note(overrides: Partial<ResearchNoteItem> = {}): ResearchNoteItem {
    return { id: 1, symbol: "GOOGL", note: "Real research note.", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...overrides };
  }

  it("excludes a symbol already covered by another source, never a duplicate opportunity", () => {
    expect(fromPreviouslyResearched([note({ symbol: "AAPL" })], new Set(["AAPL"]))).toEqual([]);
  });

  it("surfaces the real note content as evidence for an uncovered symbol", () => {
    const [out] = fromPreviouslyResearched([note()], new Set());
    expect(out.category).toBe("previously_researched");
    expect(out.evidence).toEqual(["Real research note."]);
  });

  it("caps at 5 and picks the most recently updated notes, never a fabricated ordering", () => {
    const notes = Array.from({ length: 8 }, (_, i) => note({ id: i, symbol: `SYM${i}`, updatedAt: new Date(Date.now() - i * 1000).toISOString() }));
    const out = fromPreviouslyResearched(notes, new Set());
    expect(out).toHaveLength(5);
    expect(out[0].relatedAssets[0]).toBe("SYM0");
  });
});

describe("discoverOpportunities", () => {
  it("composes every source and never double-counts a symbol between watchlist events/stale-research and previously-researched", () => {
    const out = discoverOpportunities({
      marketIntelligence: [marketIntelItem({ affectedAssets: ["AAPL"] })],
      watchlist: [watchlistItem({ symbol: "AAPL", priceTargetCrossed: true, currentPrice: 100, desiredBuyPrice: 110 })],
      weakestFactor: null,
      emergingThemes: [],
      researchNotes: [{ id: 1, symbol: "AAPL", note: "Old note.", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
    });
    const previouslyResearchedAAPL = out.filter((o) => o.category === "previously_researched" && o.relatedAssets.includes("AAPL"));
    expect(previouslyResearchedAAPL).toHaveLength(0);
  });
});

describe("buildOpportunityCoachNarrative", () => {
  function opportunity(overrides: Partial<DiscoveredOpportunity> = {}): DiscoveredOpportunity {
    return {
      id: "watchlist-event:AAPL",
      title: "AAPL: watchlist target crossed",
      category: "watchlist_event",
      origin: "Watchlist — target crossing (checkTargets)",
      evidence: ["Price target crossed."],
      relatedAssets: ["AAPL"],
      relatedSectors: [],
      priority: "high",
      ...overrides,
    };
  }

  it("never recommends buying or selling or predicts market direction", () => {
    const narrative = buildOpportunityCoachNarrative(opportunity(), new Set(["AAPL"]));
    const allText = `${narrative.whySurfaced} ${narrative.evidence} ${narrative.affectedHoldings} ${narrative.additionalResearchNeeded}`;
    expect(allText).not.toMatch(/\bbuy\b|\bsell\b|price target will|will rise|will fall/i);
  });

  it("honestly reports held vs. not-held symbols", () => {
    const held = buildOpportunityCoachNarrative(opportunity(), new Set(["AAPL"]));
    expect(held.affectedHoldings).toContain("AAPL");
    const notHeld = buildOpportunityCoachNarrative(opportunity(), new Set());
    expect(notHeld.affectedHoldings).toMatch(/does not appear/i);
  });
});
