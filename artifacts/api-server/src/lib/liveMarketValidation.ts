// Phase 11 — Live Market Operations & Production Validation. "Audit every
// market data source. Detect stale data. Detect missing data. Detect
// conflicting providers."
//
// A pure CONSOLIDATION layer, per this phase's own "reuse everything
// already built... do not duplicate" instruction — every provider status
// below is read from an already-existing, already-tested source:
//   - Options Engine (the original, pre-Phase-1 platform): selectProvider()
//     (lib/providers/index.ts) — Alpaca/Polygon/Mock options-chain data.
//   - Engine 1 (Investing): getFundamentalsProviderStatuses()
//     (lib/fundamentals.ts) — FMP/Alpha Vantage, already tracks
//     not_configured/rate_limited/unreachable/no_data/ok/idle per provider.
//   - Engine 2 (Trading): getMarketDataProvider() (lib/tradingMarketData.ts)
//     — SIMULATED only; a live provider is explicitly deferred (Phase 3
//     plan §25 Decision 7), never fabricated here.
//   - Market Calendar (lib/marketCalendar.ts, new this phase) — is the
//     market open right now, so staleness can be judged in context (a
//     provider that hasn't refreshed in 2 hours is unremarkable at 2am,
//     genuinely stale at 11am on a trading day).
//
// Zero new provider calls, zero new external network activity beyond what
// getMarketClockStatus() itself already makes (Alpaca's /v2/clock, live
// with a static fallback) — this module only reads already-computed status
// objects and applies staleness/missing-data thresholds to them.
//
// Honest architectural finding, disclosed rather than worked around:
// "detect conflicting providers" does not apply to this platform's design
// as built — each engine selects and queries exactly ONE active provider
// at a time (via a `settings` column), never two live sources concurrently
// for the same data, so there is no second reading to conflict with the
// first. A future multi-source consensus layer would need a genuinely
// different architecture (concurrent polling + a reconciliation rule),
// not a bug fix here. See docs/Live-Market-Validation.md.

import { selectProvider, type ProviderSettings } from "./providers/index.js";
import { getFundamentalsProviderStatuses, type FundamentalsProviderStatusEntry } from "./fundamentals.js";
import { getMarketDataProvider } from "./tradingMarketData.js";
import { getMarketClockStatus, type MarketClockStatus } from "./marketCalendar.js";

// A provider is flagged stale when it has a known last-success time older
// than this, AND the market is currently open — an identical staleness
// figure is unremarkable outside market hours, so the flag is never raised
// then (matching the honest "no forecast, only a factual read" discipline
// this platform's engines already apply elsewhere).
const STALE_THRESHOLD_MINUTES = 15;

export interface MarketDataSourceStatus {
  engine: "options" | "investing" | "trading";
  source: string;
  connected: boolean;
  keyPresent: boolean | null; // null when the concept doesn't apply (e.g. mock)
  lastSuccessAt: string | null;
  staleMinutes: number | null;
  stale: boolean;
  missingData: boolean;
  message: string;
}

export interface LiveMarketValidationReport {
  generatedAt: string;
  marketClock: MarketClockStatus;
  optionsEngine: MarketDataSourceStatus;
  investingEngine: MarketDataSourceStatus[];
  tradingEngine: MarketDataSourceStatus;
  conflictingProviderDetection: {
    applicable: false;
    reason: string;
  };
  overallStale: boolean;
  overallMissingData: boolean;
}

function minutesSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const diffMs = now.getTime() - new Date(iso).getTime();
  if (Number.isNaN(diffMs)) return null;
  return Math.round(diffMs / 60000);
}

function investingSourceStatus(entry: FundamentalsProviderStatusEntry, now: Date, marketOpen: boolean): MarketDataSourceStatus {
  const staleMinutes = minutesSince(entry.lastSuccessAt, now);
  const stale = marketOpen && staleMinutes != null && staleMinutes > STALE_THRESHOLD_MINUTES && entry.selected;
  const missingData = entry.keyPresent && (entry.state === "rate_limited" || entry.state === "unreachable" || entry.state === "no_data");
  return {
    engine: "investing",
    source: entry.label,
    connected: entry.state === "ok",
    keyPresent: entry.keyPresent,
    lastSuccessAt: entry.lastSuccessAt,
    staleMinutes,
    stale,
    missingData,
    message: entry.message,
  };
}

export async function buildLiveMarketValidationReport(
  userId: string | undefined,
  optionsSettings: ProviderSettings,
  fundamentalsSettings: { fundamentalsProvider?: string | null } | null,
): Promise<LiveMarketValidationReport> {
  const now = new Date();
  const marketClock = await getMarketClockStatus(optionsSettings.alpacaApiKey);
  const marketOpen = marketClock.isOpen;

  const optionsSelection = selectProvider(optionsSettings);
  const optionsEngine: MarketDataSourceStatus = {
    engine: "options",
    source: optionsSelection.active,
    connected: optionsSelection.connected,
    keyPresent: optionsSelection.active !== "mock" ? true : null,
    lastSuccessAt: null, // selectProvider() itself carries no timestamp — an honest gap, not fabricated.
    staleMinutes: null,
    stale: false,
    missingData: optionsSelection.mode === "live" && !optionsSelection.connected,
    message: optionsSelection.reason,
  };

  const investingStatuses = getFundamentalsProviderStatuses(fundamentalsSettings);
  const investingEngine = investingStatuses.map((entry) => investingSourceStatus(entry, now, marketOpen));

  const tradingProvider = await getMarketDataProvider(userId);
  const tradingEngine: MarketDataSourceStatus = {
    engine: "trading",
    source: tradingProvider.id,
    connected: tradingProvider.isLive,
    keyPresent: null,
    lastSuccessAt: null,
    staleMinutes: null,
    stale: false,
    missingData: false,
    message: tradingProvider.isLive
      ? "Engine 2 is running against a live market data provider."
      : "Engine 2 has no live market data provider today — SIMULATED only, per the explicitly deferred Live Market-Data Provider decision.",
  };

  const allSources = [optionsEngine, ...investingEngine, tradingEngine];

  return {
    generatedAt: now.toISOString(),
    marketClock,
    optionsEngine,
    investingEngine,
    tradingEngine,
    conflictingProviderDetection: {
      applicable: false,
      reason:
        "Each engine selects and queries exactly one active provider at a time (via a settings column) rather than " +
        "concurrently polling multiple live sources for the same data — there is no second reading to conflict with " +
        "the first. A multi-source consensus layer would require a different architecture, not a bug fix.",
    },
    overallStale: allSources.some((s) => s.stale),
    overallMissingData: allSources.some((s) => s.missingData),
  };
}
