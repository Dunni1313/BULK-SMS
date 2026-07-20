// Phase 27 — Institutional Liquidity & Session Workbench.
//
// An integration/workflow phase, not a rebuild of Phase 25's Session
// Service. sessionService.ts's own buildSessionData()/activeSessionsAt()
// are reused here completely unmodified (activeSessionsAt is imported
// directly, not reimplemented) — this is a NEW, sibling file that answers
// a genuinely different question sessionService.ts never answered:
// "for each of the 4 real named sessions, what is its own most recent
// window's start/end/high/low/range/duration/data-freshness, and which
// one is currently active, which one most recently closed (previous),
// and which one opens next (upcoming)?" The exact "build a new sibling
// module that reuses the same MarketDataProvider/TRADING_SESSION_WINDOWS
// building blocks rather than rebuilding the existing service" precedent
// tradingStructureTimeline.ts already established for the Market
// Structure Engine (Phase 26).
//
// SAFETY CONTRACT, unbroken: no synthetic sessions — only the 4 real
// named windows (sydney/tokyo/london/new_york) already defined in
// tradingDomainModel.ts's TRADING_SESSION_WINDOWS are ever considered.
// Every high/low/range/candleCount is derived from real (SIMULATED or
// LIVE) candle data already resolved via the existing MarketDataProvider
// seam — never fabricated. No LLM call, no new score, no new probability
// anywhere in this module — "previous"/"active"/"upcoming" are pure,
// deterministic facts about real timestamps, not a classification or a
// forecast.

import { getMarketDataProvider, isValidTradingTickerShape, type Timeframe } from "./marketDataService.js";
import { activeSessionsAt } from "./sessionService.js";
import { TRADING_SESSION_WINDOWS, type TradingSessionName } from "../tradingDomainModel.js";
import { todayStr } from "../deterministic.js";

export type SessionWindowRole = "active" | "previous" | "upcoming" | "other";

export interface SessionWindowSummary {
  name: TradingSessionName;
  label: string;
  role: SessionWindowRole;
  isActive: boolean;
  // startIso/endIso/high/low/range/candleCount/freshnessMinutes always
  // describe this session's own current-or-most-recent occurrence (its
  // "last time open," even for a session in progress) — a consistent,
  // comparison-friendly window every session shares. nextStartIso is a
  // separate, always-present fact ("when does this session open next"),
  // decoupled so the "upcoming" session's own forward-looking timing is
  // never conflated with its most-recent occurrence's historical data.
  startIso: string;
  endIso: string;
  nextStartIso: string;
  durationHours: number;
  high: number | null;
  low: number | null;
  range: number | null;
  candleCount: number;
  freshnessMinutes: number | null;
}

export interface SessionWindowsOverview {
  symbol: string;
  asOf: string;
  dataSource: "SIMULATED" | "LIVE";
  activeSessionNames: TradingSessionName[];
  overlap: boolean;
  sessions: SessionWindowSummary[];
  activeSession: SessionWindowSummary | null;
  previousSession: SessionWindowSummary | null;
  upcomingSession: SessionWindowSummary | null;
  summary: string;
}

const HOUR_MS = 60 * 60 * 1000;
// 15m candles, the max lookback tradingMarketData.ts's own MAX_LOOKBACK
// table allows for that interval (~32.5h) — comfortably covers every
// session window's current occurrence, which always falls within the
// trailing 24h of `asOf`.
const SESSION_CANDLE_INTERVAL: Timeframe = "15m";
const SESSION_CANDLE_LOOKBACK = 130;

function durationHoursFor(startUtcHour: number, endUtcHour: number): number {
  return ((endUtcHour - startUtcHour + 24) % 24) || 24;
}

// The most recent start (<= asOf) of this session's own daily window, as
// an absolute instant. If today's occurrence hasn't begun yet, this
// correctly resolves to yesterday's occurrence instead of a future one.
function mostRecentStart(asOfMs: number, startUtcHour: number): number {
  const asOfDate = new Date(asOfMs);
  const candidate = Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth(), asOfDate.getUTCDate(), startUtcHour, 0, 0, 0);
  return candidate > asOfMs ? candidate - 24 * HOUR_MS : candidate;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

// Pure — never touches a provider. `candles` must already be oldest ->
// newest. Never fabricates a session's high/low when no candle falls
// inside its own window (honestly null instead).
export function buildSessionWindowsFromCandles(
  candles: { time: string; high: number; low: number }[],
  symbol: string,
  asOf: string,
  isLive: boolean,
): SessionWindowsOverview {
  const asOfMs = new Date(asOf).getTime();
  const activeNames = activeSessionsAt(new Date(asOf));

  const raw = TRADING_SESSION_WINDOWS.map((w) => {
    const durationHours = durationHoursFor(w.startUtcHour, w.endUtcHour);
    const startMs = mostRecentStart(asOfMs, w.startUtcHour);
    const endMs = startMs + durationHours * HOUR_MS;
    const isActive = asOfMs >= startMs && asOfMs < endMs;
    const nextStartMs = startMs + 24 * HOUR_MS;

    const windowCandles = candles.filter((c) => {
      const t = new Date(c.time).getTime();
      return t >= startMs && t < endMs;
    });
    const high = windowCandles.length > 0 ? Math.max(...windowCandles.map((c) => c.high)) : null;
    const low = windowCandles.length > 0 ? Math.min(...windowCandles.map((c) => c.low)) : null;
    const range = high !== null && low !== null ? round2(high - low) : null;
    const latestCandleMs = windowCandles.length > 0 ? Math.max(...windowCandles.map((c) => new Date(c.time).getTime())) : null;
    const freshnessMinutes = latestCandleMs !== null ? Math.round((asOfMs - latestCandleMs) / 60000) : null;

    return {
      name: w.name,
      label: w.label,
      isActive,
      startMs,
      endMs,
      nextStartMs,
      durationHours,
      high,
      low,
      range,
      candleCount: windowCandles.length,
      freshnessMinutes,
    };
  });

  const closed = raw.filter((r) => !r.isActive);
  const previousRaw = closed.length > 0 ? closed.reduce((a, b) => (b.endMs > a.endMs ? b : a)) : null;
  const upcomingRaw = closed.length > 0 ? closed.reduce((a, b) => (b.nextStartMs < a.nextStartMs ? b : a)) : null;

  const sessions: SessionWindowSummary[] = raw
    .map((r) => {
      const role: SessionWindowRole = r.isActive
        ? "active"
        : previousRaw && r.name === previousRaw.name
          ? "previous"
          : upcomingRaw && r.name === upcomingRaw.name
            ? "upcoming"
            : "other";
      return {
        name: r.name,
        label: r.label,
        role,
        isActive: r.isActive,
        startIso: new Date(r.startMs).toISOString(),
        endIso: new Date(r.endMs).toISOString(),
        nextStartIso: new Date(r.nextStartMs).toISOString(),
        durationHours: r.durationHours,
        high: r.high,
        low: r.low,
        range: r.range,
        candleCount: r.candleCount,
        freshnessMinutes: r.freshnessMinutes,
      };
    })
    .sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime());

  const activeSession = sessions.find((s) => s.role === "active") ?? null;
  const previousSession = sessions.find((s) => s.role === "previous") ?? null;
  const upcomingSession = sessions.find((s) => s.role === "upcoming") ?? null;

  const overlap = activeNames.length > 1;
  const summaryParts: string[] = [];
  summaryParts.push(
    activeNames.length > 0
      ? `${activeNames.map((n) => n.replace("_", " ")).join(" + ")} currently open${overlap ? " (overlap)" : ""}`
      : "no session currently open",
  );
  if (previousSession) summaryParts.push(`${previousSession.label} most recently closed`);
  if (upcomingSession) summaryParts.push(`${upcomingSession.label} opens next`);
  const summary = `${symbol}: ${summaryParts.join("; ")}.`;

  return {
    symbol,
    asOf,
    dataSource: isLive ? "LIVE" : "SIMULATED",
    activeSessionNames: activeNames,
    overlap,
    sessions,
    activeSession,
    previousSession,
    upcomingSession,
    summary,
  };
}

// Orchestration helper — reuses the existing MarketDataProvider seam
// unmodified. Honestly returns null for an invalid ticker shape, matching
// every other honest-null seam in this codebase (including
// sessionService.ts's own buildSessionData()).
export async function buildSessionWindows(symbol: string, asOf?: string): Promise<SessionWindowsOverview | null> {
  if (!isValidTradingTickerShape(symbol)) return null;

  const nowIso = asOf ?? new Date().toISOString();
  const provider = await getMarketDataProvider();
  // getCandles()'s own asOf param expects a date-only string (todayStr()'s
  // own format), not a full timestamp — the same distinction
  // sessionService.ts's buildSessionData() already documents and handles;
  // nowIso itself is preserved for the response's own asOf field and the
  // millisecond-precision window/freshness math above.
  const candles = await provider.getCandles(symbol, SESSION_CANDLE_INTERVAL, SESSION_CANDLE_LOOKBACK, todayStr(new Date(nowIso)));
  if (!candles) return null;

  return buildSessionWindowsFromCandles(candles, symbol.toUpperCase(), nowIso, provider.isLive);
}
