// Phase 25 — Institutional Trade Workspace.
//
// The one genuinely new piece of Market Data orchestration this phase:
// buildSessionData() reuses the already-shipped MarketDataProvider seam
// (Sprint 32) plus Phase 24's own already-defined, previously-unused
// TRADING_SESSION_WINDOWS to answer "which named sessions are open right
// now, and what's today's session high/low" — descriptive, not
// predictive. No signal generation: this never decides whether a session
// overlap is bullish/bearish, only reports which windows are currently
// open and today's realized range.

import { getMarketDataProvider, isValidTradingTickerShape } from "./marketDataService.js";
import { TRADING_SESSION_WINDOWS, type SessionData, type TradingSessionName } from "../tradingDomainModel.js";
import { todayStr } from "../deterministic.js";

function isHourInWindow(hour: number, startUtcHour: number, endUtcHour: number): boolean {
  if (startUtcHour <= endUtcHour) return hour >= startUtcHour && hour < endUtcHour;
  // wraps past midnight (e.g. Sydney 21 -> 06)
  return hour >= startUtcHour || hour < endUtcHour;
}

export function activeSessionsAt(date: Date): TradingSessionName[] {
  const hour = date.getUTCHours();
  return TRADING_SESSION_WINDOWS.filter((w) => isHourInWindow(hour, w.startUtcHour, w.endUtcHour)).map((w) => w.name);
}

function isSameUtcDate(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/**
 * Honestly returns null for an invalid ticker shape, matching every other
 * honest-null seam in this codebase. When candles resolve but none fall on
 * today's UTC calendar date (a thin/edge sample), sessionHigh/sessionLow
 * are honestly null rather than fabricated from a different day's bars.
 */
export async function buildSessionData(symbol: string, asOf?: string): Promise<SessionData | null> {
  if (!isValidTradingTickerShape(symbol)) return null;

  const nowIso = asOf ?? new Date().toISOString();
  const now = new Date(nowIso);
  const provider = await getMarketDataProvider();
  // getCandles()'s own asOf param expects a date-only string (todayStr()'s
  // own format, matching SimulatedMarketDataProvider's documented default),
  // not a full timestamp — nowIso itself is preserved for the response's
  // own asOf field and the isSameUtcDate/activeSessionsAt comparisons below.
  const candles = await provider.getCandles(symbol, "15m", 96, todayStr(now));

  const todayCandles = (candles ?? []).filter((c) => isSameUtcDate(new Date(c.time), now));
  const sessionHigh = todayCandles.length > 0 ? Math.max(...todayCandles.map((c) => c.high)) : null;
  const sessionLow = todayCandles.length > 0 ? Math.min(...todayCandles.map((c) => c.low)) : null;

  return {
    symbol: symbol.toUpperCase(),
    asOf: nowIso,
    activeSessions: activeSessionsAt(now),
    sessionHigh,
    sessionLow,
  };
}
