// Phase 27 — Institutional Liquidity & Session Workbench.
//
// Unit tests for the new sessionWindows.ts module. sessionService.ts's own
// activeSessionsAt() is reused unmodified — these tests reuse the exact
// UTC-hour fixtures sessionService.test.ts already established for that
// function, then layer on the genuinely new previous/active/upcoming role
// classification and per-window high/low/range/duration/freshness math.
//
// Disclosed, honest data-coverage limitation (not a bug): the existing
// SimulatedMarketDataProvider's own intraday bar generation only produces
// candles within a stylized ~09:30-16:00 UTC business-hours window (see
// tradingMarketData.ts's barTime()/BARS_PER_DAY) — a modeling choice that
// predates this phase and is out of scope to change (reuse-only). Sydney
// (21:00-06:00 UTC) and Tokyo (00:00-09:00 UTC) never overlap that window
// at all, so their own high/low/candleCount honestly read null/0 — the
// same "thin/empty sample -> honest empty result, never fabricated" rule
// every other engine in this codebase already follows. London (07:00-16:00)
// fully overlaps it; New York (12:00-21:00) partially overlaps it
// (12:00-16:00) and gets a real, partial reading.

import { describe, it, expect } from "vitest";
import { buildSessionWindowsFromCandles, buildSessionWindows } from "./sessionWindows.js";

function candle(time: string, high: number, low: number) {
  return { time, high, low };
}

describe("buildSessionWindowsFromCandles", () => {
  it("classifies London active, Tokyo/Sydney closed at hour 10 UTC on 2026-01-05, matching sessionService.test.ts's own fixture", () => {
    const asOf = "2026-01-05T10:00:00.000Z";
    const result = buildSessionWindowsFromCandles([], "AAPL", asOf, false);
    expect(result.activeSessionNames).toEqual(["london"]);
    expect(result.overlap).toBe(false);

    const london = result.sessions.find((s) => s.name === "london")!;
    expect(london.isActive).toBe(true);
    expect(london.role).toBe("active");
    expect(london.durationHours).toBe(9);

    const tokyo = result.sessions.find((s) => s.name === "tokyo")!;
    const sydney = result.sessions.find((s) => s.name === "sydney")!;
    expect(tokyo.isActive).toBe(false);
    expect(sydney.isActive).toBe(false);
  });

  it("classifies both London and New York active during their 12:00-16:00 UTC overlap", () => {
    const asOf = "2026-01-05T13:00:00.000Z";
    const result = buildSessionWindowsFromCandles([], "AAPL", asOf, false);
    expect(result.activeSessionNames.sort()).toEqual(["london", "new_york"].sort());
    expect(result.overlap).toBe(true);
    expect(result.activeSession).not.toBeNull();
  });

  it("identifies exactly one previous (most recently closed) and one upcoming (soonest to open) session among the closed ones", () => {
    const asOf = "2026-01-05T10:00:00.000Z"; // London active; Tokyo/Sydney/New York closed
    const result = buildSessionWindowsFromCandles([], "AAPL", asOf, false);
    expect(result.previousSession).not.toBeNull();
    expect(result.upcomingSession).not.toBeNull();
    // A currently-active session is never itself labeled previous/upcoming.
    expect(result.previousSession!.name).not.toBe("london");
    expect(result.upcomingSession!.name).not.toBe("london");
    // The previous session's own window must have already ended by asOf.
    expect(new Date(result.previousSession!.endIso).getTime()).toBeLessThanOrEqual(new Date(asOf).getTime());
    // The upcoming session's own next start must be strictly in the future,
    // and must be the soonest such start among every closed session.
    expect(new Date(result.upcomingSession!.nextStartIso).getTime()).toBeGreaterThan(new Date(asOf).getTime());
    for (const s of result.sessions) {
      if (!s.isActive) {
        expect(new Date(result.upcomingSession!.nextStartIso).getTime()).toBeLessThanOrEqual(new Date(s.nextStartIso).getTime());
      }
    }
  });

  it("honestly reports null high/low/range and zero candleCount for a session whose window has no overlapping candle data (Tokyo/Sydney), never fabricating a range", () => {
    const asOf = "2026-01-05T13:00:00.000Z";
    // Candles only within London/New York's own 09:30-16:00 UTC business-hours
    // window (the real SimulatedMarketDataProvider's own coverage) — none in
    // Tokyo's (00:00-09:00) or Sydney's (21:00-06:00) windows.
    const candles = [
      candle("2026-01-05T09:30:00.000Z", 101, 99),
      candle("2026-01-05T12:00:00.000Z", 105, 100),
      candle("2026-01-05T15:45:00.000Z", 103, 98),
    ];
    const result = buildSessionWindowsFromCandles(candles, "AAPL", asOf, false);

    const tokyo = result.sessions.find((s) => s.name === "tokyo")!;
    const sydney = result.sessions.find((s) => s.name === "sydney")!;
    expect(tokyo.high).toBeNull();
    expect(tokyo.low).toBeNull();
    expect(tokyo.range).toBeNull();
    expect(tokyo.candleCount).toBe(0);
    expect(tokyo.freshnessMinutes).toBeNull();
    expect(sydney.candleCount).toBe(0);

    const london = result.sessions.find((s) => s.name === "london")!;
    expect(london.candleCount).toBeGreaterThan(0);
    expect(london.high).not.toBeNull();
    expect(london.low).not.toBeNull();
    expect(london.range).toBe(round2(london.high! - london.low!));
  });

  it("computes a real, non-null range for a session with genuine overlapping candle data", () => {
    const asOf = "2026-01-05T13:00:00.000Z";
    const candles = [candle("2026-01-05T12:15:00.000Z", 110, 90)];
    const result = buildSessionWindowsFromCandles(candles, "AAPL", asOf, false);
    const newYork = result.sessions.find((s) => s.name === "new_york")!;
    expect(newYork.high).toBe(110);
    expect(newYork.low).toBe(90);
    expect(newYork.range).toBe(20);
    expect(newYork.candleCount).toBe(1);
    expect(newYork.freshnessMinutes).not.toBeNull();
  });

  it("labels every window's own duration as exactly 9 hours, computed from the real start/end UTC hours, never hardcoded per-session", () => {
    const result = buildSessionWindowsFromCandles([], "AAPL", "2026-01-05T03:00:00.000Z", false);
    for (const s of result.sessions) expect(s.durationHours).toBe(9);
  });

  it("is deterministic across repeated calls for the same inputs", () => {
    const asOf = "2026-01-05T13:00:00.000Z";
    const candles = [candle("2026-01-05T12:15:00.000Z", 110, 90)];
    const a = buildSessionWindowsFromCandles(candles, "AAPL", asOf, false);
    const b = buildSessionWindowsFromCandles(candles, "AAPL", asOf, false);
    expect(a).toEqual(b);
  });

  it("labels the dataSource honestly (SIMULATED vs LIVE) from the provider's own isLive flag", () => {
    const simulated = buildSessionWindowsFromCandles([], "AAPL", "2026-01-05T13:00:00.000Z", false);
    const live = buildSessionWindowsFromCandles([], "AAPL", "2026-01-05T13:00:00.000Z", true);
    expect(simulated.dataSource).toBe("SIMULATED");
    expect(live.dataSource).toBe("LIVE");
  });
});

describe("buildSessionWindows (orchestration)", () => {
  it("honestly returns null for an invalid ticker shape", async () => {
    const result = await buildSessionWindows("NOT A TICKER!!");
    expect(result).toBeNull();
  });

  it("resolves a well-shaped overview for a valid symbol, uppercasing it, with all 4 named sessions present", async () => {
    const result = await buildSessionWindows("aapl", "2026-06-15T13:00:00.000Z");
    expect(result).not.toBeNull();
    expect(result!.symbol).toBe("AAPL");
    expect(result!.sessions.map((s) => s.name).sort()).toEqual(["london", "new_york", "sydney", "tokyo"].sort());
  });

  it("is deterministic across repeated calls for the same symbol/asOf", async () => {
    const a = await buildSessionWindows("MSFT", "2026-06-15T13:00:00.000Z");
    const b = await buildSessionWindows("MSFT", "2026-06-15T13:00:00.000Z");
    expect(a).toEqual(b);
  });
});

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
