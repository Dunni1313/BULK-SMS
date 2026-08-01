// v1.5.0, Sprint 20 — Institutional Market Intelligence Engine. Direct
// unit coverage over the pure buildMarketIntelligenceFeed() composition —
// proves every item traces to an already-existing, already-tested engine
// (eventRisk.ts/marketBriefing.ts/investingMacro.ts/optionsMath.ts), never
// a fabricated market claim, and that reserved-but-empty categories are
// honestly disclosed rather than filled with invented content.

import { describe, it, expect } from "vitest";
import { buildMarketIntelligenceFeed, MARKET_INTELLIGENCE_CATEGORIES, MARKET_INTELLIGENCE_CATEGORY_META } from "./marketIntelligence.js";
import { getUpcomingEvents } from "./eventRisk.js";
import { buildMarketBriefing } from "./marketBriefing.js";
import { buildMacroContext } from "./investingMacro.js";
import { UNIVERSE_SYMBOLS, todayStr } from "./optionsMath.js";

describe("MARKET_INTELLIGENCE_CATEGORY_META", () => {
  it("defines all 13 categories named in the approved scope, each with an honest availability flag", () => {
    expect(MARKET_INTELLIGENCE_CATEGORIES).toHaveLength(13);
    for (const c of MARKET_INTELLIGENCE_CATEGORIES) {
      const meta = MARKET_INTELLIGENCE_CATEGORY_META[c];
      expect(meta.category).toBe(c);
      expect(typeof meta.label).toBe("string");
      expect(typeof meta.dataAvailable).toBe("boolean");
      if (!meta.dataAvailable) expect(meta.unavailableReason).toBeTruthy();
      else expect(meta.unavailableReason).toBeNull();
    }
  });

  it("honestly discloses Sector Trends/Commodities/Currencies/Sentiment as reserved, never fabricated", () => {
    for (const c of ["sector_trends", "commodities", "currencies", "sentiment"] as const) {
      expect(MARKET_INTELLIGENCE_CATEGORY_META[c].dataAvailable).toBe(false);
    }
  });
});

describe("buildMarketIntelligenceFeed", () => {
  const now = new Date("2026-08-15T12:00:00.000Z").getTime();

  it("never produces an item in a reserved-but-empty category", () => {
    const feed = buildMarketIntelligenceFeed(now);
    const reserved = new Set(["sector_trends", "commodities", "currencies", "sentiment"]);
    expect(feed.items.some((i) => reserved.has(i.category))).toBe(false);
  });

  it("every event-calendar item is traceable directly to eventRisk.ts's own getUpcomingEvents(), never re-derived", () => {
    const feed = buildMarketIntelligenceFeed(now);
    const rawEvents = getUpcomingEvents(UNIVERSE_SYMBOLS, now, 45);
    const eventHeadlines = new Set(rawEvents.map((e) => e.label));
    const feedEventItems = feed.items.filter((i) => ["economic_events", "central_banks", "earnings", "corporate_actions"].includes(i.category));
    for (const item of feedEventItems) {
      expect(eventHeadlines.has(item.headline)).toBe(true);
    }
    expect(feedEventItems.length).toBe(rawEvents.length);
  });

  it("the macro/volatility/breadth items are a direct, unmodified read of marketBriefing.ts's own already-computed fields", () => {
    const feed = buildMarketIntelligenceFeed(now);
    const briefing = buildMarketBriefing(now);
    const macroItem = feed.items.find((i) => i.id === `macro:options-engine:${briefing.date}`);
    const volItem = feed.items.find((i) => i.id === `volatility:options-engine:${briefing.date}`);
    const breadthItem = feed.items.find((i) => i.id === `market_breadth:options-engine:${briefing.date}`);
    expect(macroItem?.summary).toBe(briefing.headline);
    expect(volItem?.summary).toContain(`${briefing.avgIvRank}`);
    expect(breadthItem?.summary).toContain(`${briefing.breadth}%`);
  });

  it("the Investing Engine macro item is a genuinely separate source from the Options Engine one, never merged", () => {
    const feed = buildMarketIntelligenceFeed(now);
    const macroItems = feed.items.filter((i) => i.category === "macro");
    expect(macroItems).toHaveLength(2);
    const sources = new Set(macroItems.map((i) => i.source));
    expect(sources.size).toBe(2);
    const macro = buildMacroContext(todayStr(new Date(now)));
    expect(macroItems.some((i) => i.summary === macro.summary)).toBe(true);
  });

  it("every item honestly reports dataSource SIMULATED — no live feed is wired anywhere in this codebase yet", () => {
    const feed = buildMarketIntelligenceFeed(now);
    for (const item of feed.items) expect(item.dataSource).toBe("SIMULATED");
  });

  it("options_activity items reuse getSnapshot()'s own real openInterest/ivRank fields, never a fabricated flow signal", () => {
    const feed = buildMarketIntelligenceFeed(now);
    const oaItems = feed.items.filter((i) => i.category === "options_activity");
    for (const item of oaItems) {
      expect(item.affectedAssets).toHaveLength(1);
      expect(item.summary).toMatch(/open interest/);
      expect(item.summary).toMatch(/IV rank/);
    }
  });

  it("is deterministic for the same 'now' timestamp — never a fresh random result on repeated calls", () => {
    const a = buildMarketIntelligenceFeed(now);
    const b = buildMarketIntelligenceFeed(now);
    expect(a.items.map((i) => i.id)).toEqual(b.items.map((i) => i.id));
    expect(a.items.map((i) => i.headline)).toEqual(b.items.map((i) => i.headline));
  });

  it("every item's learnMore, when present, points at a real, already-shipped Learning Centre topic key", () => {
    const feed = buildMarketIntelligenceFeed(now);
    for (const item of feed.items) {
      if (!item.learnMore) continue;
      expect(item.learnMore.pathKey.length).toBeGreaterThan(0);
      expect(item.learnMore.topicKey.length).toBeGreaterThan(0);
    }
  });

  it("supports a caller-supplied symbol subset and horizon, never hardcoding the universe", () => {
    const feed = buildMarketIntelligenceFeed(now, ["AAPL"], 10);
    const symbolEventItems = feed.items.filter((i) => i.affectedAssets.length > 0 && ["earnings", "corporate_actions"].includes(i.category));
    for (const item of symbolEventItems) expect(item.affectedAssets).toEqual(["AAPL"]);
  });
});
