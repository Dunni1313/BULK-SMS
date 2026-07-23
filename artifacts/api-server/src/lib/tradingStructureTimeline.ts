// Phase 26 — Institutional Market Structure Workbench.
//
// The only genuinely new module this phase — a deterministic Structure
// Shift Timeline. Deliberately NOT a new algorithm: this reuses Sprint 33's
// already-tested, unexported analyzeMarketStructure() exactly as
// tradingBacktest.ts's own "structure-breakout" strategy already does
// (calling it repeatedly over an expanding window of already-resolved
// candles to read trend at each point in time) — the same disclosed,
// precedented technique, applied here to build a genuine event timeline
// instead of a trading rule. HH/HL/LH/LL labeling and support/resistance
// "test" detection are pure comparisons over the already-computed
// swingPoints/zones arrays and the exported ZONE_TOLERANCE_PCT constant —
// zero new scoring, zero new probability, zero new classification formula.
//
// Per the approved scope: events are named exactly as specified (new
// higher high / new higher low / new lower high / new lower low / trend
// change / range entry / range exit / support test / resistance test) —
// never BOS/CHOCH/MSS or any other strategy-specific terminology, since
// none of those concepts exist canonically anywhere in this codebase.
//
// SAFETY CONTRACT, unbroken from every prior SIMULATED engine in this
// codebase: every event is derived from real (SIMULATED or LIVE) candle
// data already resolved via the existing MarketDataProvider seam — never
// fabricated. No LLM call anywhere in this module.

import type { Candle, MarketDataProvider, Timeframe } from "./tradingMarketData.js";
import {
  analyzeMarketStructure,
  ZONE_TOLERANCE_PCT,
  type SwingPoint,
  type TrendStructure,
} from "./tradingMarketStructure.js";

export type StructureShiftEventType =
  | "higher_high"
  | "higher_low"
  | "lower_high"
  | "lower_low"
  | "trend_change"
  | "range_entry"
  | "range_exit"
  | "support_test"
  | "resistance_test";

export interface StructureShiftEvent {
  time: string;
  type: StructureShiftEventType;
  label: string;
  price: number;
  detail: string;
}

export interface StructureShiftTimeline {
  symbol: string;
  interval: Timeframe;
  dataSource: "SIMULATED" | "LIVE";
  candleCount: number;
  events: StructureShiftEvent[];
  summary: string;
}

const EVENT_LABELS: Record<StructureShiftEventType, string> = {
  higher_high: "New Higher High",
  higher_low: "New Higher Low",
  lower_high: "New Lower High",
  lower_low: "New Lower Low",
  trend_change: "Trend Change",
  range_entry: "Range Entry",
  range_exit: "Range Exit",
  support_test: "Support Test",
  resistance_test: "Resistance Test",
};

// Minimum candles before the first trend-change comparison point is
// evaluated — smaller than tradingBacktest.ts's own MIN_STRUCTURE_WINDOW
// (a strategy-specific constant, not reused here) since a timeline is
// purely descriptive: analyzeMarketStructure() itself already honestly
// reports "range" with a reason for a too-thin sample, so starting early
// never fabricates a read, it just naturally reports "range" until enough
// swings accumulate.
const MIN_TIMELINE_WINDOW = 10;

function swingSequenceEvents(swingPoints: SwingPoint[]): StructureShiftEvent[] {
  const events: StructureShiftEvent[] = [];
  let prevHigh: SwingPoint | null = null;
  let prevLow: SwingPoint | null = null;

  for (const p of swingPoints) {
    if (p.kind === "high") {
      if (prevHigh) {
        if (p.price > prevHigh.price) {
          events.push({
            time: p.time,
            type: "higher_high",
            label: EVENT_LABELS.higher_high,
            price: p.price,
            detail: `Swing high at $${p.price.toFixed(2)}, up from the prior swing high at $${prevHigh.price.toFixed(2)}.`,
          });
        } else if (p.price < prevHigh.price) {
          events.push({
            time: p.time,
            type: "lower_high",
            label: EVENT_LABELS.lower_high,
            price: p.price,
            detail: `Swing high at $${p.price.toFixed(2)}, down from the prior swing high at $${prevHigh.price.toFixed(2)}.`,
          });
        }
      }
      prevHigh = p;
    } else {
      if (prevLow) {
        if (p.price > prevLow.price) {
          events.push({
            time: p.time,
            type: "higher_low",
            label: EVENT_LABELS.higher_low,
            price: p.price,
            detail: `Swing low at $${p.price.toFixed(2)}, up from the prior swing low at $${prevLow.price.toFixed(2)}.`,
          });
        } else if (p.price < prevLow.price) {
          events.push({
            time: p.time,
            type: "lower_low",
            label: EVENT_LABELS.lower_low,
            price: p.price,
            detail: `Swing low at $${p.price.toFixed(2)}, down from the prior swing low at $${prevLow.price.toFixed(2)}.`,
          });
        }
      }
      prevLow = p;
    }
  }
  return events;
}

function zoneTestEvents(swingPoints: SwingPoint[], zones: { price: number; kind: "support" | "resistance" }[]): StructureShiftEvent[] {
  const events: StructureShiftEvent[] = [];
  for (const p of swingPoints) {
    for (const zone of zones) {
      if (zone.price <= 0) continue;
      if (Math.abs(p.price - zone.price) / zone.price > ZONE_TOLERANCE_PCT) continue;
      const type: StructureShiftEventType = zone.kind === "support" ? "support_test" : "resistance_test";
      events.push({
        time: p.time,
        type,
        label: EVENT_LABELS[type],
        price: p.price,
        detail: `Price tested the ${zone.kind} zone near $${zone.price.toFixed(2)}.`,
      });
    }
  }
  return events;
}

// Reuses analyzeMarketStructure() (Sprint 33, unmodified) repeatedly over
// an expanding candle window — the exact technique tradingBacktest.ts's own
// "structure-breakout" strategy already established — to detect genuine
// trend-change points. `candles` must already be oldest -> newest.
function trendChangeEvents(candles: Candle[], symbol: string, interval: Timeframe, isLive: boolean): StructureShiftEvent[] {
  const events: StructureShiftEvent[] = [];
  let prevTrend: TrendStructure | null = null;

  for (let i = MIN_TIMELINE_WINDOW; i < candles.length; i++) {
    const window = candles.slice(0, i + 1);
    const trendToday = analyzeMarketStructure(window, symbol, interval, isLive).trend;
    if (prevTrend !== null && trendToday !== prevTrend) {
      const time = candles[i].time;
      const price = candles[i].close;
      if (prevTrend !== "range" && trendToday === "range") {
        events.push({
          time,
          type: "range_entry",
          label: EVENT_LABELS.range_entry,
          price,
          detail: `Structure shifted from ${prevTrend} into a range.`,
        });
      } else if (prevTrend === "range" && trendToday !== "range") {
        events.push({
          time,
          type: "range_exit",
          label: EVENT_LABELS.range_exit,
          price,
          detail: `Structure exited its range into a ${trendToday}.`,
        });
      } else {
        events.push({
          time,
          type: "trend_change",
          label: EVENT_LABELS.trend_change,
          price,
          detail: `Trend changed from ${prevTrend} to ${trendToday}.`,
        });
      }
    }
    prevTrend = trendToday;
  }
  return events;
}

function buildSummary(symbol: string, events: StructureShiftEvent[], candleCount: number): string {
  if (candleCount === 0) return `${symbol}: no candle data available to build a structure shift timeline.`;
  if (events.length === 0) return `${symbol}: no structure shift events detected in this sample.`;
  const last = events[events.length - 1];
  return `${symbol}: ${events.length} structure shift event(s) detected. Most recent: ${last.label} at $${last.price.toFixed(2)}.`;
}

// Pure — never touches a provider. `candles` must already be oldest ->
// newest (the shape MarketDataProvider.getCandles() already returns).
export function buildStructureShiftTimelineFromCandles(
  candles: Candle[],
  symbol: string,
  interval: Timeframe,
  isLive: boolean,
): StructureShiftTimeline {
  const full = analyzeMarketStructure(candles, symbol, interval, isLive);
  const events = [
    ...swingSequenceEvents(full.swingPoints),
    ...zoneTestEvents(full.swingPoints, full.zones),
    ...trendChangeEvents(candles, symbol, interval, isLive),
  ].sort((a, b) => a.time.localeCompare(b.time));

  return {
    symbol,
    interval,
    dataSource: isLive ? "LIVE" : "SIMULATED",
    candleCount: candles.length,
    events,
    summary: buildSummary(symbol, events, candles.length),
  };
}

// Orchestration helper: resolves candles via the provided MarketDataProvider
// (Sprint 32's seam, unmodified) and calls the pure builder above. Honestly
// returns null when the provider can't resolve the symbol (invalid ticker
// shape) — never fabricates a timeline for an unresolvable symbol.
export async function buildStructureShiftTimeline(
  symbol: string,
  interval: Timeframe,
  lookback: number,
  provider: MarketDataProvider,
): Promise<StructureShiftTimeline | null> {
  const candles = await provider.getCandles(symbol, interval, lookback);
  if (!candles) return null;
  return buildStructureShiftTimelineFromCandles(candles, symbol.toUpperCase(), interval, provider.isLive);
}
