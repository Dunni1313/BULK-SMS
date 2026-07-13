// Phase 3, Sprint 32 — Institutional Trading Engine, Market Data Foundation
// (approved Phase 3 plan, Sprint 32). The provider seam every later Engine 2
// module (Market Structure, Order Flow, Multi-Timeframe, Probability, Regime
// Detection) builds on — see docs/Phase-3-Trading-Engine-Execution-Plan.md §10.
//
// SAFETY CONTRACT, unbroken from every prior SIMULATED engine in this
// codebase: never fabricate live price/volume/order-flow data. The only
// provider shipped this sprint is `SimulatedMarketDataProvider` — deterministic,
// seeded, clearly labeled `isLive: false`. A live provider (Polygon or
// otherwise) is explicitly deferred (Phase 3 plan §25 Decision 7) and, when
// built, slots into the exact `MarketDataProvider` interface below without
// any caller needing to change.
//
// TRADING_MARKET_UNIVERSE deliberately duplicates (does not import)
// lib/investingUniverse.ts's own symbol/base-price list, which itself
// deliberately duplicates optionsMath.ts's UNIVERSE — engines never depend
// on each other's internals (Architecture Blueprint §1; Phase 3 plan §0/§3).
// Same 10 real-world tickers/base prices for cross-engine plausibility, not
// because the data is shared — each engine's SIMULATED price for the same
// symbol on the same day is independently seeded and will differ.

import { makeRng, todayStr } from "./deterministic.js";

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "1D";

export interface Candle {
  time: string; // ISO timestamp of the bar's open
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketQuote {
  price: number;
  volume: number;
  asOf: string; // ISO timestamp of when this quote was generated
}

export interface MarketDataProvider {
  readonly id: string;
  readonly isLive: boolean;
  getCandles(symbol: string, interval: Timeframe, lookback: number, asOf?: string): Promise<Candle[] | null>;
  getQuote(symbol: string, asOf?: string): Promise<MarketQuote | null>;
}

export interface TradingUniverseEntry {
  symbol: string;
  name: string;
  basePrice: number;
}

// Default coverage universe for Engine 2's SIMULATED data. Base prices match
// optionsMath.ts's UNIVERSE / lib/investingUniverse.ts's INVESTING_UNIVERSE
// for these 10 symbols, on purpose (see module doc comment above).
export const TRADING_MARKET_UNIVERSE: TradingUniverseEntry[] = [
  { symbol: "SPY", name: "SPDR S&P 500 ETF", basePrice: 540 },
  { symbol: "QQQ", name: "Invesco QQQ Trust", basePrice: 460 },
  { symbol: "IWM", name: "iShares Russell 2000 ETF", basePrice: 200 },
  { symbol: "NVDA", name: "NVIDIA Corporation", basePrice: 900 },
  { symbol: "META", name: "Meta Platforms Inc", basePrice: 510 },
  { symbol: "AAPL", name: "Apple Inc", basePrice: 195 },
  { symbol: "AMZN", name: "Amazon.com Inc", basePrice: 185 },
  { symbol: "MSFT", name: "Microsoft Corporation", basePrice: 420 },
  { symbol: "GOOGL", name: "Alphabet Inc", basePrice: 175 },
  { symbol: "TSLA", name: "Tesla Inc", basePrice: 175 },
];

// A ticker-shaped string: 1-5 letters, optionally a share-class suffix like
// BRK.B. Rejects obvious non-tickers so unsupported input honestly reports
// "unknown symbol" rather than fabricating candles for arbitrary text.
const TICKER_RE = /^[A-Z]{1,5}(\.[A-Z])?$/;
export function isValidTradingTickerShape(symbol: string): boolean {
  return TICKER_RE.test(symbol.toUpperCase());
}

// Number of bars per trading session, per timeframe. A nominal 6.5-hour
// session is assumed (390 minutes) — this is a documented simplification
// (UTC-labeled, not real exchange-timezone hours), sufficient for a SIMULATED
// engine with no live consumer yet; real market-hours calendaring is a
// concern for the live-provider work this sprint explicitly defers.
const BARS_PER_DAY: Record<Timeframe, number> = {
  "1m": 390,
  "5m": 78,
  "15m": 26,
  "1h": 7,
  "1D": 1,
};

const INTERVAL_MINUTES: Record<Timeframe, number> = {
  "1m": 1,
  "5m": 5,
  "15m": 15,
  "1h": 60,
  "1D": 1440,
};

// Bounded lookback windows (Phase 3 plan §26 Technical Debt Review,
// Scalability: "consider a bounded lookback window... rather than unlimited
// history"). A caller requesting more than this is honestly capped, never
// silently given fewer bars than the cap without it being the documented
// result of capping.
export const MAX_LOOKBACK: Record<Timeframe, number> = {
  "1m": 390, // ~1 trading day
  "5m": 390, // ~5 trading days
  "15m": 130, // ~5 trading days
  "1h": 35, // ~5 trading days
  "1D": 180, // ~6 months
};

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return todayStr(d);
}

function syntheticBasePrice(symbol: string): number {
  const rng = makeRng(`${symbol}|trading-base-price`);
  return Math.round((20 + rng() * 380) * 100) / 100; // plausible $20-$400 range
}

function basePriceFor(symbol: string): number {
  const entry = TRADING_MARKET_UNIVERSE.find((u) => u.symbol === symbol);
  return entry?.basePrice ?? syntheticBasePrice(symbol);
}

function baseVolume(symbol: string): number {
  const rng = makeRng(`${symbol}|trading-base-volume`);
  return Math.round(500_000 + rng() * 9_500_000); // ~0.5M-10M shares, plausible large-cap/ETF range
}

// Deterministic daily close. Independent of lib/investingUniverse.ts's own
// investingPrice() formula/seed namespace — a different engine's own
// generator (per the "duplicate, don't share" rule above), same shape
// (base * (1 + bounded daily drift)), different seed.
function dailyClose(symbol: string, dateStr: string): number {
  const base = basePriceFor(symbol);
  const rng = makeRng(`${symbol}|trading-daily|${dateStr}`);
  const drift = (rng() - 0.5) * 0.04; // +/-2%
  return round2(base * (1 + drift));
}

function barTime(dateStr: string, interval: Timeframe, indexInDay: number): string {
  if (interval === "1D") return `${dateStr}T00:00:00.000Z`;
  const minutesFromMidnight = 9 * 60 + 30 + indexInDay * INTERVAL_MINUTES[interval]; // nominal 09:30 session start
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCMinutes(minutesFromMidnight);
  return d.toISOString();
}

function ohlcFromOpenClose(
  open: number,
  close: number,
  seed: string,
): { high: number; low: number; volume: number } {
  const rng = makeRng(seed);
  const wick = Math.abs(close - open) * (0.3 + rng() * 0.7) + Math.max(open, 1) * 0.0015;
  const high = Math.max(open, close) + wick * rng();
  const low = Math.min(open, close) - wick * (1 - rng());
  return { high: round2(high), low: round2(Math.max(0.01, low)), volume: 0 };
}

// One trading day's session, as `barsPerDay` internally-consistent bars
// walking from the previous day's close (the session's open) to this day's
// own deterministic close — never an independently-random walk disconnected
// from the day's own dailyClose() anchor.
function sessionBars(symbol: string, dateStr: string, interval: Timeframe): Candle[] {
  const barsPerDay = BARS_PER_DAY[interval];
  const sessionOpen = dailyClose(symbol, addDays(dateStr, -1));
  const sessionClose = dailyClose(symbol, dateStr);
  const walkRng = makeRng(`${symbol}|trading-intraday|${interval}|${dateStr}`);

  const points: number[] = [sessionOpen];
  for (let i = 1; i < barsPerDay; i++) {
    const t = i / barsPerDay;
    const base = sessionOpen + (sessionClose - sessionOpen) * t;
    const noise = (walkRng() - 0.5) * sessionOpen * 0.006; // +/-0.3% wiggle per step
    points.push(base + noise);
  }
  points.push(sessionClose);

  const vol = baseVolume(symbol);
  const bars: Candle[] = [];
  for (let i = 0; i < barsPerDay; i++) {
    const open = points[i];
    const close = points[i + 1];
    const barSeed = `${symbol}|trading-bar|${interval}|${dateStr}|${i}`;
    const { high, low } = ohlcFromOpenClose(open, close, barSeed);
    const barVolRng = makeRng(`${barSeed}|volume`);
    const volume = Math.max(1, Math.round(((barVolRng() * 0.6 + 0.7) * vol) / barsPerDay));
    bars.push({
      time: barTime(dateStr, interval, i),
      open: round2(open),
      high,
      low,
      close: round2(close),
      volume,
    });
  }
  return bars;
}

export class SimulatedMarketDataProvider implements MarketDataProvider {
  readonly id = "simulated";
  readonly isLive = false;

  async getCandles(
    symbol: string,
    interval: Timeframe,
    lookback: number,
    asOf: string = todayStr(),
  ): Promise<Candle[] | null> {
    const sym = symbol.toUpperCase();
    if (!isValidTradingTickerShape(sym)) return null;
    const n = Math.max(1, Math.min(lookback, MAX_LOOKBACK[interval]));

    if (interval === "1D") {
      const bars: Candle[] = [];
      for (let i = n - 1; i >= 0; i--) {
        const dateStr = addDays(asOf, -i);
        const open = dailyClose(sym, addDays(dateStr, -1));
        const close = dailyClose(sym, dateStr);
        const barSeed = `${sym}|trading-bar|1D|${dateStr}`;
        const { high, low } = ohlcFromOpenClose(open, close, barSeed);
        const barVolRng = makeRng(`${barSeed}|volume`);
        const volume = Math.round((barVolRng() * 0.6 + 0.7) * baseVolume(sym));
        bars.push({ time: barTime(dateStr, "1D", 0), open: round2(open), high, low, close: round2(close), volume });
      }
      return bars;
    }

    // Intraday: walk backward day by day, generating a full session's bars
    // per day until there are at least `n` bars, then trim to exactly n
    // (returned oldest -> newest).
    const barsPerDay = BARS_PER_DAY[interval];
    const daysNeeded = Math.ceil(n / barsPerDay) + 1;
    let all: Candle[] = [];
    for (let d = daysNeeded - 1; d >= 0; d--) {
      const dateStr = addDays(asOf, -d);
      all = all.concat(sessionBars(sym, dateStr, interval));
    }
    return all.slice(-n);
  }

  async getQuote(symbol: string, asOf: string = todayStr()): Promise<MarketQuote | null> {
    const sym = symbol.toUpperCase();
    if (!isValidTradingTickerShape(sym)) return null;
    const price = dailyClose(sym, asOf);
    const rng = makeRng(`${sym}|trading-quote|${asOf}`);
    const volume = Math.round((rng() * 0.6 + 0.7) * baseVolume(sym));
    return { price, volume, asOf: new Date().toISOString() };
  }
}

const simulatedMarketDataProvider = new SimulatedMarketDataProvider();

// Sprint 32 — only a SIMULATED provider exists. This resolver's shape
// mirrors getFundamentalsProvider()'s exactly (settings-driven selection
// with an honest fallback) so a future live provider (Phase 3 plan §10/§25
// Decision 7, explicitly deferred) slots in without any caller needing to
// change. Until then it always returns the simulated provider, regardless
// of the stored `tradingDataProvider` setting value — never a fabricated
// "connected" state.
export async function getMarketDataProvider(_userId?: string): Promise<MarketDataProvider> {
  return simulatedMarketDataProvider;
}
