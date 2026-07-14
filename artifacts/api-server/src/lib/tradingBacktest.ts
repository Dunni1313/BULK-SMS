// Phase 3, Sprint 49 — Institutional Trading Engine, Backtesting (approved
// Phase 3 plan §18; see docs/Phase-3-Trading-Engine-Execution-Plan.md's
// Sprint 49 as-built note).
//
// Objective (§18): a genuine price-action backtest engine for Engine 2
// strategies (trend-following, mean-reversion, structure-break setups),
// distinct from routes/backtest.ts's options-strategy-equity-curve
// generator. That existing options backtest does not replay real trades at
// all — it synthesizes an equity curve directly from randomly-seeded
// win-rate/avg-win/avg-loss statistics (confirmed by direct inspection
// before writing this module). Engine 2's own backtest is deliberately a
// REAL walk-forward simulation: it replays an already-resolved SIMULATED
// candle series bar-by-bar, evaluates a genuine entry/exit rule at each
// bar, and produces the equity curve and trade log FROM those real
// simulated trades — never a fabricated statistical curve. Reuses
// routes/backtest.ts's own UI rendering pattern (Backtest.tsx's recharts
// equity curve) and the backtestResults table's persisted-results shape,
// not its options-specific simulation logic — routes/backtest.ts and
// lib/backtestResults.ts (if either existed as a shared lib) are not
// modified.
//
// The ONLY genuinely new logic in this module is the walk-forward harness
// and the three named entry/exit rule sets — the trend/zone SIGNAL itself
// is 100% reused, unmodified, from Sprint 33's analyzeMarketStructure(),
// called repeatedly over an expanding window of already-resolved candles
// (a legitimate, cheap, deterministic technique for a SIMULATED/bounded
// candle series — never re-fetches candles, never a new signal-detection
// algorithm).
//
// SAFETY CONTRACT, unbroken from every prior SIMULATED engine in this
// codebase: a backtest with too few candles to run honestly reports
// itself unavailable with zero trades, never a fabricated trade or
// equity point. A strategy that never triggers a signal honestly reports
// zero trades and null KPIs, never an invented win rate. No LLM call, no
// live broker, Level 2, order-flow, or execution data anywhere in this
// module — this NEVER places a real order, it only replays already-
// resolved historical (SIMULATED or LIVE) candles.

import type { Candle, MarketDataProvider, Timeframe } from "./tradingMarketData.js";
import { analyzeMarketStructure } from "./tradingMarketStructure.js";

export type BacktestStrategy = "trend-following" | "mean-reversion" | "structure-breakout";

export type BacktestExitReason = "stop" | "target" | "trend-flip" | "time-limit" | "end-of-period";

export interface BacktestTrade {
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  exitReason: BacktestExitReason;
  pnlPct: number; // (exitPrice - entryPrice) / entryPrice, rounded
  rMultiple: number; // pnlPct / stopLossPct — return measured in units of initial risk
}

export interface BacktestEquityPoint {
  date: string;
  value: number;
  drawdownPct: number;
}

export interface BacktestResult {
  symbol: string;
  strategy: BacktestStrategy;
  interval: Timeframe;
  dataSource: "SIMULATED" | "LIVE";
  candleCount: number;
  available: boolean;
  unavailableReason: string | null;
  trades: BacktestTrade[];
  totalTrades: number;
  winRate: number | null; // null, never 0, when totalTrades is 0
  avgR: number | null;
  totalReturnPct: number | null;
  maxDrawdownPct: number | null;
  sharpeRatio: number | null;
  equityCurve: BacktestEquityPoint[];
  summary: string;
}

// Named, adjustable constants — a fixed-risk-per-trade convention (every
// trade risks the same % of entry price), the simplest honest convention
// for a rule-based backtest; never varied per-trade without a documented
// reason to.
export const DEFAULT_STOP_LOSS_PCT = 0.03; // 3% below entry
export const DEFAULT_TARGET_PCT = 0.06; // 6% above entry (2R at the default stop)
export const MEAN_REVERSION_MAX_HOLD_DAYS = 10;
// Minimum candles needed before the first entry signal is evaluated — gives
// analyzeMarketStructure() (Sprint 33) enough of a window to produce a
// meaningful swing-based trend read rather than a trivially-thin one.
export const MIN_STRUCTURE_WINDOW = 30;
const STARTING_EQUITY = 100_000;

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}

interface OpenPosition {
  entryIndex: number;
  entryDate: string;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
}

function shouldEnter(
  strategy: BacktestStrategy,
  candles: Candle[],
  i: number,
  trendToday: string,
  trendYesterday: string | null,
  zonesToday: { price: number; kind: "support" | "resistance" }[],
): boolean {
  const low = candles[i].low;
  switch (strategy) {
    case "trend-following":
      return trendToday === "uptrend";
    case "structure-breakout":
      // A fresh flip INTO uptrend — never a signal on a day the trend was
      // already uptrend, so this never re-enters mid-trend.
      return trendToday === "uptrend" && trendYesterday !== null && trendYesterday !== "uptrend";
    case "mean-reversion": {
      // Enter when today's low touches or dips through the nearest support
      // zone below the current close — an honest "no signal" (false) when
      // no support zone has been detected yet, never a fabricated dip.
      const supports = zonesToday.filter((z) => z.kind === "support");
      if (supports.length === 0) return false;
      const nearestSupport = supports.reduce((a, b) => (b.price > a.price ? b : a));
      return low <= nearestSupport.price;
    }
  }
}

function shouldExit(
  strategy: BacktestStrategy,
  candles: Candle[],
  i: number,
  position: OpenPosition,
  trendToday: string,
): { exit: true; price: number; reason: BacktestExitReason } | { exit: false } {
  const bar = candles[i];
  // Stop and target are checked against the day's real range — a stop
  // triggers on the day's low, a target on the day's high, the standard
  // bar-level backtest convention. Stop is checked first (conservative:
  // if both would have triggered intraday, assume the worse outcome).
  if (bar.low <= position.stopPrice) return { exit: true, price: position.stopPrice, reason: "stop" };
  if (bar.high >= position.targetPrice) return { exit: true, price: position.targetPrice, reason: "target" };

  if (strategy === "trend-following" || strategy === "structure-breakout") {
    if (trendToday !== "uptrend") return { exit: true, price: bar.close, reason: "trend-flip" };
  }
  if (strategy === "mean-reversion") {
    if (i - position.entryIndex >= MEAN_REVERSION_MAX_HOLD_DAYS) {
      return { exit: true, price: bar.close, reason: "time-limit" };
    }
  }
  return { exit: false };
}

function buildSummary(symbol: string, strategy: BacktestStrategy, result: Omit<BacktestResult, "summary">): string {
  if (!result.available) return `Backtest for ${symbol} (${strategy}) is unavailable: ${result.unavailableReason}`;
  if (result.totalTrades === 0) {
    return `${symbol} (${strategy}) triggered no trade signals over the ${result.candleCount}-candle sample.`;
  }
  const wr = result.winRate !== null ? `${round2(result.winRate * 100)}%` : "n/a";
  const ret = result.totalReturnPct !== null ? `${round2(result.totalReturnPct * 100)}%` : "n/a";
  return (
    `${symbol} (${strategy}) took ${result.totalTrades} trade(s) over the ${result.candleCount}-candle sample: ` +
    `${wr} win rate, ${ret} total return, ${round2(result.maxDrawdownPct !== null ? result.maxDrawdownPct * 100 : 0)}% max drawdown.`
  );
}

// Pure — never touches a provider, never generates new randomness. `candles`
// must already be oldest -> newest. Walks forward bar-by-bar; at each bar,
// analyzeMarketStructure() (Sprint 33, reused unmodified) is recomputed
// over the expanding window candles.slice(0, i+1) to read that day's trend/
// zones — the only novel logic here is the entry/exit rule evaluation and
// trade/equity bookkeeping around it.
export function runTradingBacktest(
  candles: Candle[],
  symbol: string,
  strategy: BacktestStrategy,
  interval: Timeframe,
  isLive: boolean,
  opts: { stopLossPct?: number; targetPct?: number } = {},
): BacktestResult {
  const stopLossPct = opts.stopLossPct ?? DEFAULT_STOP_LOSS_PCT;
  const targetPct = opts.targetPct ?? DEFAULT_TARGET_PCT;
  const dataSource: "SIMULATED" | "LIVE" = isLive ? "LIVE" : "SIMULATED";

  if (candles.length < MIN_STRUCTURE_WINDOW + 1) {
    const base: Omit<BacktestResult, "summary"> = {
      symbol,
      strategy,
      interval,
      dataSource,
      candleCount: candles.length,
      available: false,
      unavailableReason: `At least ${MIN_STRUCTURE_WINDOW + 1} candles are needed to run a backtest — only ${candles.length} available.`,
      trades: [],
      totalTrades: 0,
      winRate: null,
      avgR: null,
      totalReturnPct: null,
      maxDrawdownPct: null,
      sharpeRatio: null,
      equityCurve: [],
    };
    return { ...base, summary: buildSummary(symbol, strategy, base) };
  }

  const trades: BacktestTrade[] = [];
  let position: OpenPosition | null = null;
  let previousTrend: string | null = null;

  for (let i = MIN_STRUCTURE_WINDOW; i < candles.length; i++) {
    const window = candles.slice(0, i + 1);
    const structure = analyzeMarketStructure(window, symbol, interval, isLive);
    const trendToday = structure.trend;

    if (position) {
      const outcome = shouldExit(strategy, candles, i, position, trendToday);
      if (outcome.exit) {
        const pnlPct = round4((outcome.price - position.entryPrice) / position.entryPrice);
        trades.push({
          entryDate: position.entryDate,
          entryPrice: position.entryPrice,
          exitDate: candles[i].time,
          exitPrice: outcome.price,
          exitReason: outcome.reason,
          pnlPct,
          rMultiple: round4(pnlPct / stopLossPct),
        });
        position = null;
      }
    }

    if (!position && shouldEnter(strategy, candles, i, trendToday, previousTrend, structure.zones)) {
      const entryPrice = candles[i].close;
      position = {
        entryIndex: i,
        entryDate: candles[i].time,
        entryPrice,
        stopPrice: entryPrice * (1 - stopLossPct),
        targetPrice: entryPrice * (1 + targetPct),
      };
    }

    previousTrend = trendToday;
  }

  // An open position at the end of the sample is honestly closed at the
  // final candle's close, never left dangling or silently dropped.
  if (position) {
    const last = candles[candles.length - 1];
    const pnlPct = round4((last.close - position.entryPrice) / position.entryPrice);
    trades.push({
      entryDate: position.entryDate,
      entryPrice: position.entryPrice,
      exitDate: last.time,
      exitPrice: last.close,
      exitReason: "end-of-period",
      pnlPct,
      rMultiple: round4(pnlPct / stopLossPct),
    });
  }

  const equityCurve: BacktestEquityPoint[] = [];
  let equity = STARTING_EQUITY;
  let peak = STARTING_EQUITY;
  for (const t of trades) {
    equity = equity * (1 + t.pnlPct);
    if (equity > peak) peak = equity;
    const drawdownPct = round4((equity - peak) / peak);
    equityCurve.push({ date: t.exitDate, value: round2(equity), drawdownPct });
  }

  const totalTrades = trades.length;
  let base: Omit<BacktestResult, "summary">;

  if (totalTrades === 0) {
    base = {
      symbol,
      strategy,
      interval,
      dataSource,
      candleCount: candles.length,
      available: true,
      unavailableReason: null,
      trades: [],
      totalTrades: 0,
      winRate: null,
      avgR: null,
      totalReturnPct: null,
      maxDrawdownPct: null,
      sharpeRatio: null,
      equityCurve: [],
    };
  } else {
    const wins = trades.filter((t) => t.pnlPct > 0);
    const winRate = round4(wins.length / totalTrades);
    const avgR = round2(trades.reduce((s, t) => s + t.rMultiple, 0) / totalTrades);
    const totalReturnPct = round4((equity - STARTING_EQUITY) / STARTING_EQUITY);
    const maxDrawdownPct = round4(Math.min(0, ...equityCurve.map((p) => p.drawdownPct)));

    const meanPnl = trades.reduce((s, t) => s + t.pnlPct, 0) / totalTrades;
    const variance = trades.reduce((s, t) => s + (t.pnlPct - meanPnl) ** 2, 0) / totalTrades;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? round2((meanPnl / stdDev) * Math.sqrt(totalTrades)) : null;

    base = {
      symbol,
      strategy,
      interval,
      dataSource,
      candleCount: candles.length,
      available: true,
      unavailableReason: null,
      trades,
      totalTrades,
      winRate,
      avgR,
      totalReturnPct,
      maxDrawdownPct,
      sharpeRatio,
      equityCurve,
    };
  }

  return { ...base, summary: buildSummary(symbol, strategy, base) };
}

// Orchestration: resolves candles via the provided MarketDataProvider
// (Sprint 32's seam, unmodified) and calls the pure backtest above.
// Honestly returns null when the provider can't resolve the symbol —
// never fabricates a backtest for an unresolvable symbol.
export async function buildTradingBacktest(
  symbol: string,
  strategy: BacktestStrategy,
  interval: Timeframe,
  lookback: number,
  provider: MarketDataProvider,
  opts: { stopLossPct?: number; targetPct?: number } = {},
): Promise<BacktestResult | null> {
  const candles = await provider.getCandles(symbol, interval, lookback);
  if (!candles) return null;
  return runTradingBacktest(candles, symbol.toUpperCase(), strategy, interval, provider.isLive, opts);
}
