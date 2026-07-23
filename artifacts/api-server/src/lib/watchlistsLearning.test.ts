// Phase 43 — Institutional Watchlists & Opportunity Dashboard.
import { describe, it, expect } from "vitest";
import { WATCHLISTS_LEARNING_TOPICS, getWatchlistsLearning, allWatchlistsLearning } from "./watchlistsLearning.js";

describe("getWatchlistsLearning", () => {
  it("resolves a non-empty set of real Learning Centre links for every one of the 6 topics — zero silently-dropped, unresolvable topic keys", () => {
    for (const topic of WATCHLISTS_LEARNING_TOPICS) {
      const learning = getWatchlistsLearning(topic);
      expect(learning).not.toBeNull();
      expect(learning!.topic).toBe(topic);
      expect(learning!.links.length).toBeGreaterThan(0);
      for (const link of learning!.links) {
        expect(typeof link.title).toBe("string");
        expect(link.title.length).toBeGreaterThan(0);
        expect(typeof link.summary).toBe("string");
        expect(link.summary.length).toBeGreaterThan(0);
        expect(link.href).toBe(`/learn/paths/${link.pathKey}/${link.topicKey}`);
      }
    }
  });

  it("connects the 'watchlists' topic to real, already-existing Investing Monitoring / Research Terminal content", () => {
    const learning = getWatchlistsLearning("watchlists")!;
    expect(learning.links.some((l) => l.topicKey === "investing-monitoring")).toBe(true);
    expect(learning.links.some((l) => l.topicKey === "investing-research-terminal")).toBe(true);
  });

  it("connects the 'portfolio_monitoring' topic to real, already-existing Portfolio Health content", () => {
    const learning = getWatchlistsLearning("portfolio_monitoring")!;
    expect(learning.links.some((l) => l.topicKey === "portfolio-health")).toBe(true);
  });

  it("connects the 'asset_research' topic to real, already-existing Opportunity Discovery content", () => {
    const learning = getWatchlistsLearning("asset_research")!;
    expect(learning.links.some((l) => l.topicKey === "investing-opportunity-discovery")).toBe(true);
  });

  it("connects the 'institutional_workflows' topic to real, already-existing Process Over Prediction content", () => {
    const learning = getWatchlistsLearning("institutional_workflows")!;
    expect(learning.links.some((l) => l.topicKey === "institutional-process-over-prediction")).toBe(true);
  });

  it("connects the 'diversification' topic to real, already-existing Portfolio Diversification content", () => {
    const learning = getWatchlistsLearning("diversification")!;
    expect(learning.links.some((l) => l.topicKey === "portfolio-diversification")).toBe(true);
  });

  it("connects the 'capital_allocation' topic to real, already-existing Institutional Capital Allocation content", () => {
    const learning = getWatchlistsLearning("capital_allocation")!;
    expect(learning.links.some((l) => l.topicKey === "institutional-capital-allocation")).toBe(true);
  });

  it("returns null for an unknown topic, never a fabricated learning bundle", () => {
    expect(getWatchlistsLearning("not_a_real_topic")).toBeNull();
    expect(getWatchlistsLearning("")).toBeNull();
  });
});

describe("allWatchlistsLearning", () => {
  it("returns exactly the 6 topics, in order, each matching its own single-topic lookup", () => {
    const all = allWatchlistsLearning();
    expect(all).toHaveLength(6);
    expect(all.map((e) => e.topic)).toEqual([...WATCHLISTS_LEARNING_TOPICS]);
    for (const entry of all) {
      expect(entry).toEqual(getWatchlistsLearning(entry.topic));
    }
  });
});
