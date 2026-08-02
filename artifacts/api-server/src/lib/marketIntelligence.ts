// v1.5.0, Sprint 20 — Institutional Market Intelligence Engine.
//
// NOT another Research module. NOT another dashboard. Research is
// user-created; Market Intelligence is external context. This module is a
// pure, stateless COMPOSITION layer that collects, classifies, and exposes
// already-computed market context so the rest of the platform (Command
// Centre, Research, Decision Workflow, Portfolio Intelligence, Knowledge
// Graph, AI Coach) can consume it — it introduces zero new provider
// integrations, zero new pricing/valuation formulas, and zero persistence.
//
// ─── MANDATORY REUSE AUDIT (performed before writing this file) ──────────
//   Economic Events / Central Banks / Earnings / Corporate Actions →
//     lib/eventRisk.ts's own getUpcomingEvents() (Task #? — the platform's
//     one, existing, deterministic economic/market event calendar). Read
//     directly, never re-derived.
//   Macro (Options Engine read) → lib/marketBriefing.ts's own
//     buildMarketBriefing() — regime/synthetic VIX/breadth. Read directly.
//   Macro (Investing Engine read) → lib/investingMacro.ts's own
//     buildMacroContext() — a genuinely different, never-merged signal
//     (rate regime vs. options-IV regime), matching that module's own
//     "engines never depend on each other's internals" precedent.
//   Volatility / Market Breadth → also lib/marketBriefing.ts's own already-
//     computed syntheticVix/avgIvRank/breadth fields — a second read of
//     the SAME object, never a new formula.
//   Options Activity → lib/optionsMath.ts's own getSnapshot() (openInterest
//     + ivRank per symbol, already fetched by every other consumer of that
//     module) — this file's only genuinely new logic is flagging which
//     universe symbols currently show elevated open interest / IV rank,
//     never a fabricated "unusual options flow" feed.
//   Sector Trends / Commodities / Currencies / Sentiment → audited
//     directly: no sector-level performance series, commodity price,
//     currency rate, or sentiment index exists anywhere in this codebase
//     today. Honestly left as defined-but-empty categories (see
//     MARKET_INTELLIGENCE_CATEGORY_META below) rather than fabricated —
//     the same "reserved for a future data provider" discipline
//     lib/investingMacro.ts and lib/portfolioRiskIntelligence.ts (currency
//     exposure) already established.
//   Watchlists / Portfolio Intelligence / Knowledge Graph / AI Coach /
//     Learning Centre → deliberately NOT read from here. Every one of
//     those is per-user state; this module stays a stateless, market-wide
//     read (mirroring GET /events and GET /briefing's own precedent — no
//     auth/tenant scoping needed). The frontend's useMarketIntelligence.ts
//     hook is where per-user entity-linking (Related Research/Portfolio
//     Holdings/Strategies/Lessons/Playbooks, Watchlist relevance, Portfolio
//     exposure) actually happens, composing this feed with the
//     already-shipped Knowledge Graph (Sprint 17) and Portfolio & Risk
//     Intelligence (Sprint 15) hooks — zero duplicate calculation there
//     either.
//
// STRICTLY OUT OF SCOPE, by design: no trading signal, no buy/sell
// recommendation, no AI price prediction, no duplicate news/watchlist/
// research system, no broker integration.

import { UNIVERSE_SYMBOLS, getSnapshot, todayStr, type EventRiskEvent } from "./optionsMath.js";
import { getUpcomingEvents } from "./eventRisk.js";
import { buildMarketBriefing } from "./marketBriefing.js";
import { buildMacroContext } from "./investingMacro.js";

export const MARKET_INTELLIGENCE_CATEGORIES = [
  "macro",
  "economic_events",
  "central_banks",
  "earnings",
  "corporate_actions",
  "sector_trends",
  "commodities",
  "currencies",
  "indices",
  "volatility",
  "options_activity",
  "market_breadth",
  "sentiment",
] as const;

export type MarketIntelligenceCategory = (typeof MARKET_INTELLIGENCE_CATEGORIES)[number];

export interface MarketIntelligenceCategoryMeta {
  category: MarketIntelligenceCategory;
  label: string;
  description: string;
  dataAvailable: boolean;
  unavailableReason: string | null;
}

// Every category exists in the taxonomy today, per the approved scope's own
// "each category should support future data providers" instruction — but
// only the categories with a genuine underlying signal (even if that
// signal is itself a disclosed SIMULATED proxy) actually produce items.
// The rest are honestly disclosed as reserved, never fabricated.
export const MARKET_INTELLIGENCE_CATEGORY_META: Record<MarketIntelligenceCategory, MarketIntelligenceCategoryMeta> = {
  macro: { category: "macro", label: "Macro", description: "Broad market regime reads from both the Options Income and Investing engines.", dataAvailable: true, unavailableReason: null },
  economic_events: { category: "economic_events", label: "Economic Events", description: "CPI, jobs, PCE, and other scheduled macro releases.", dataAvailable: true, unavailableReason: null },
  central_banks: { category: "central_banks", label: "Central Banks", description: "FOMC rate decisions.", dataAvailable: true, unavailableReason: null },
  earnings: { category: "earnings", label: "Earnings", description: "Upcoming earnings dates across the tracked universe.", dataAvailable: true, unavailableReason: null },
  corporate_actions: { category: "corporate_actions", label: "Corporate Actions", description: "Ex-dividend dates across the tracked universe.", dataAvailable: true, unavailableReason: null },
  sector_trends: { category: "sector_trends", label: "Sector Trends", description: "Sector-level performance trends.", dataAvailable: false, unavailableReason: "No sector-level performance series exists in this codebase yet — reserved for a future data provider." },
  commodities: { category: "commodities", label: "Commodities", description: "Commodity price context.", dataAvailable: false, unavailableReason: "No commodity price feed exists in this codebase yet — reserved for a future data provider." },
  currencies: { category: "currencies", label: "Currencies", description: "Currency / FX context.", dataAvailable: false, unavailableReason: "No currency/FX feed exists in this codebase yet — reserved for a future data provider (see Portfolio & Risk Intelligence's own currency_exposure signal, which is unavailable for the same reason)." },
  indices: { category: "indices", label: "Indices", description: "Index-level breadth and regime context.", dataAvailable: true, unavailableReason: null },
  volatility: { category: "volatility", label: "Volatility", description: "The Options Engine's own synthetic VIX / IV-rank read.", dataAvailable: true, unavailableReason: null },
  options_activity: { category: "options_activity", label: "Options Activity", description: "Universe symbols showing elevated open interest or IV rank.", dataAvailable: true, unavailableReason: null },
  market_breadth: { category: "market_breadth", label: "Market Breadth", description: "Share of the tracked universe trading higher on the day.", dataAvailable: true, unavailableReason: null },
  sentiment: { category: "sentiment", label: "Sentiment", description: "Market sentiment index.", dataAvailable: false, unavailableReason: "No sentiment index or survey feed exists in this codebase yet — reserved for a future data provider." },
};

export type MarketIntelligenceImpact = "low" | "medium" | "high";

export interface MarketIntelligenceItem {
  id: string;
  headline: string;
  category: MarketIntelligenceCategory;
  source: string;
  dataSource: "SIMULATED" | "LIVE";
  timestamp: string;
  impact: MarketIntelligenceImpact;
  affectedAssets: string[];
  affectedSectors: string[];
  potentialRisks: string[];
  potentialOpportunities: string[];
  summary: string;
  learnMore: { pathKey: string; topicKey: string; label: string } | null;
}

export interface MarketIntelligenceFeed {
  items: MarketIntelligenceItem[];
  categories: MarketIntelligenceCategoryMeta[];
  generatedAt: string;
}

const EVENT_RISK_TOPIC = { pathKey: "portfolio", topicKey: "portfolio-event-risk", label: "Event Risk" };
const VOLATILITY_TOPIC = { pathKey: "volatility", topicKey: "volatility-iv-rank", label: "IV Rank" };
const EARNINGS_TOPIC = { pathKey: "volatility", topicKey: "volatility-earnings", label: "Earnings Volatility & IV Crush" };

function eventItem(ev: EventRiskEvent): MarketIntelligenceItem {
  const category: MarketIntelligenceCategory = ev.type === "fomc" ? "central_banks" : ev.type === "earnings" ? "earnings" : ev.type === "dividend" ? "corporate_actions" : "economic_events";
  const affectedAssets = ev.symbol ? [ev.symbol] : [];
  const potentialRisks: string[] =
    ev.type === "earnings"
      ? ["Post-earnings implied-volatility crush for open premium.", "Overnight gap risk through the print."]
      : ev.type === "fomc"
        ? ["Broad, market-wide volatility around the rate decision."]
        : ev.type === "dividend"
          ? ["Small, mechanical price adjustment on the ex-dividend date."]
          : ["Elevated macro volatility around the scheduled release."];
  const potentialOpportunities: string[] =
    ev.type === "earnings"
      ? ["Implied volatility normalizing after the print may reset premium levels for sellers waiting on the sidelines."]
      : ev.type === "fomc" || ev.type === "cpi" || ev.type === "jobs" || ev.type === "economic"
        ? ["A stable/as-expected outcome could reduce near-term macro uncertainty."]
        : [];
  return {
    id: `${category}:${ev.type}:${ev.symbol ?? "market"}:${ev.date}`,
    headline: ev.label,
    category,
    source: "Simulated Economic/Event Calendar (eventRisk.ts)",
    dataSource: "SIMULATED",
    timestamp: `${ev.date}T00:00:00.000Z`,
    impact: ev.impact,
    affectedAssets,
    affectedSectors: [],
    potentialRisks,
    potentialOpportunities,
    summary: `${ev.label} — ${ev.daysAway === 0 ? "today" : ev.daysAway === 1 ? "tomorrow" : `in ${ev.daysAway} days`} (${ev.date}).`,
    learnMore: ev.type === "earnings" ? EARNINGS_TOPIC : EVENT_RISK_TOPIC,
  };
}

function briefingItems(now: number): MarketIntelligenceItem[] {
  const briefing = buildMarketBriefing(now);
  const macroItem: MarketIntelligenceItem = {
    id: `macro:options-engine:${briefing.date}`,
    headline: `Options Engine market regime: ${briefing.regimeLabel}`,
    category: "macro",
    source: "Options Income Engine — Market Briefing (marketBriefing.ts)",
    dataSource: "SIMULATED",
    timestamp: `${briefing.date}T00:00:00.000Z`,
    impact: briefing.regime === "risk_off" ? "high" : briefing.regime === "risk_on" ? "low" : "medium",
    affectedAssets: [],
    affectedSectors: [],
    potentialRisks: briefing.regime === "risk_off" ? ["Elevated market-wide volatility and tail risk."] : [],
    potentialOpportunities: briefing.regime === "risk_on" ? ["Constructive tape may support directional and income strategies alike."] : [],
    summary: briefing.headline,
    learnMore: EVENT_RISK_TOPIC,
  };
  const volatilityItem: MarketIntelligenceItem = {
    id: `volatility:options-engine:${briefing.date}`,
    headline: `Synthetic VIX ~${briefing.syntheticVix} (${briefing.vixLabel})`,
    category: "volatility",
    source: "Options Income Engine — Market Briefing (marketBriefing.ts)",
    dataSource: "SIMULATED",
    timestamp: `${briefing.date}T00:00:00.000Z`,
    impact: briefing.vixLabel === "Elevated" ? "high" : briefing.vixLabel === "Subdued" ? "low" : "medium",
    affectedAssets: [],
    affectedSectors: [],
    potentialRisks: briefing.vixLabel === "Elevated" ? ["Wider expected moves across the tracked universe."] : [],
    potentialOpportunities: [],
    summary: `${briefing.ivEnvironment} Average IV rank ${briefing.avgIvRank}/100.`,
    learnMore: VOLATILITY_TOPIC,
  };
  const breadthItem: MarketIntelligenceItem = {
    id: `market_breadth:options-engine:${briefing.date}`,
    headline: `Market breadth: ${briefing.breadth}% of the tracked universe higher today`,
    category: "market_breadth",
    source: "Options Income Engine — Market Briefing (marketBriefing.ts)",
    dataSource: "SIMULATED",
    timestamp: `${briefing.date}T00:00:00.000Z`,
    impact: briefing.breadth <= 30 || briefing.breadth >= 70 ? "medium" : "low",
    affectedAssets: [],
    affectedSectors: [],
    potentialRisks: briefing.breadth <= 30 ? ["Narrow, weak breadth — few names participating in any rally."] : [],
    potentialOpportunities: briefing.breadth >= 70 ? ["Broad participation across the tracked universe."] : [],
    summary: `${briefing.breadth}% of the ${UNIVERSE_SYMBOLS.length}-name tracked universe is trading higher today.`,
    learnMore: null,
  };
  return [macroItem, volatilityItem, breadthItem];
}

function investingMacroItem(asOf: string): MarketIntelligenceItem {
  const macro = buildMacroContext(asOf);
  return {
    id: `macro:investing-engine:${asOf}`,
    headline: `Investing Engine macro proxy: ${macro.regimeLabel}`,
    category: "macro",
    source: "Investing Engine — Macro Proxy (investingMacro.ts)",
    dataSource: "SIMULATED",
    timestamp: `${asOf}T00:00:00.000Z`,
    impact: macro.regime === "stable_rates" ? "low" : "medium",
    affectedAssets: [],
    affectedSectors: [],
    potentialRisks: macro.regime === "rising_rates" ? ["Rising-rate environments typically pressure valuation multiples on long-duration growth names."] : [],
    potentialOpportunities: macro.regime === "falling_rates" ? ["Falling-rate environments typically support valuation multiples and rate-sensitive sectors."] : [],
    summary: macro.summary,
    learnMore: null,
  };
}

// Options Activity — a real, honest reuse of getSnapshot()'s own
// openInterest/ivRank fields (never fabricated): a universe symbol is
// flagged when its open interest sits in the top third of the universe AND
// its IV rank is elevated (>= 60) — both already-computed numbers, this
// module's only new logic is the flagging threshold itself.
const OPTIONS_ACTIVITY_IV_RANK_THRESHOLD = 60;

function optionsActivityItems(now: number): MarketIntelligenceItem[] {
  const date = todayStr(new Date(now));
  const snaps = UNIVERSE_SYMBOLS.map((s) => getSnapshot(s, date)).filter((s): s is NonNullable<typeof s> => s != null);
  if (snaps.length === 0) return [];
  const sortedByOi = [...snaps].sort((a, b) => b.openInterest - a.openInterest);
  const topThirdCount = Math.max(1, Math.ceil(sortedByOi.length / 3));
  const topOiSymbols = new Set(sortedByOi.slice(0, topThirdCount).map((s) => s.symbol));
  const flagged = snaps.filter((s) => topOiSymbols.has(s.symbol) && s.ivRank >= OPTIONS_ACTIVITY_IV_RANK_THRESHOLD);
  return flagged.map((s) => ({
    id: `options_activity:${s.symbol}:${date}`,
    headline: `${s.symbol}: elevated open interest and IV rank`,
    category: "options_activity" as const,
    source: "Options Income Engine — Snapshot (optionsMath.ts)",
    dataSource: "SIMULATED" as const,
    timestamp: `${date}T00:00:00.000Z`,
    impact: "medium" as const,
    affectedAssets: [s.symbol],
    affectedSectors: [],
    potentialRisks: ["Elevated IV rank means larger expected moves are already priced in."],
    potentialOpportunities: ["Elevated IV rank favors premium-selling strategies for names already on a watchlist."],
    summary: `${s.symbol} shows top-third open interest (${s.openInterest.toLocaleString()}) in the tracked universe with an IV rank of ${s.ivRank}/100.`,
    learnMore: VOLATILITY_TOPIC,
  }));
}

export function buildMarketIntelligenceFeed(now: number = Date.now(), symbols: string[] = UNIVERSE_SYMBOLS, horizonDays = 45): MarketIntelligenceFeed {
  const events = getUpcomingEvents(symbols, now, horizonDays);
  const items: MarketIntelligenceItem[] = [
    ...events.map(eventItem),
    ...briefingItems(now),
    investingMacroItem(todayStr(new Date(now))),
    ...optionsActivityItems(now),
  ].sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.headline.localeCompare(b.headline));

  return {
    items,
    categories: MARKET_INTELLIGENCE_CATEGORIES.map((c) => MARKET_INTELLIGENCE_CATEGORY_META[c]),
    generatedAt: new Date().toISOString(),
  };
}
