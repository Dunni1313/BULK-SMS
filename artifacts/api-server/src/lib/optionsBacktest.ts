// Phase 4, Sprint 57 — Options Engine-Native Backtesting (Core) (approved
// Phase 4 plan, Sprint 57; see docs/Phase-4-Master-Execution-Plan.md's
// Sprint 57 as-built note).
//
// Objective: a genuine walk-forward options-strategy backtest — replaying a
// real simulated underlying price path bar-by-bar through actual
// options-pricing math (Black-Scholes via optionsMath.ts, read from, never
// modified) — replacing the trust gap in routes/backtest.ts's existing
// generator. That existing route does not replay real trades at all: it
// synthesizes a weekly equity curve directly from randomly-seeded
// win-rate/avg-win/avg-loss statistics (confirmed by direct inspection
// before writing this module; see routes/backtest.ts's own
// generateEquityCurve()). routes/backtest.ts is left completely in place,
// unmodified, as a parallel legacy path — this module never touches it.
//
// ═══ MarketDataProvider reuse evaluation (required by the approved plan,
// documented here regardless of outcome — see also the Sprint 57
// completion report) ═══
//
// REUSED, not replaced. Engine 2's `MarketDataProvider.getCandles(symbol,
// "1D", lookback)` (lib/tradingMarketData.ts, Sprint 32, imported
// unmodified) supplies the walked underlying SPOT price path — every day's
// open/high/low/close used as S(t) throughout the simulation. This is the
// ONLY source of underlying price movement in this module; no independent
// price-simulation code was written.
//
// Options pricing needs a second input Engine 2 has no concept of: implied
// volatility. optionsMath.ts's own `getSnapshot(symbol, date)` (Phase 2 and
// earlier, already deterministic and day-seeded) supplies `iv`/`ivRank`/
// `spreadPct`/`openInterest`/`liquidityScore` for each walked day — its own
// `.price` field is deliberately never read here, since Engine 2's real
// walked price is used for spot instead. This is a legitimate compose-not-
// duplicate reuse of an already-existing, already-tested IV model — not a
// second, competing price generator, and not a new IV-simulation formula.
//
// No genuine incompatibility was found between the two systems: they are
// deliberately, independently seeded (per the Architecture Blueprint's
// "engines never depend on each other's internals" rule, the same
// precedent tradingMarketData.ts's own TRADING_MARKET_UNIVERSE already
// established for base prices), but only ONE (Engine 2's) is ever used as
// the authoritative spot path here — the two are never blended or
// averaged. A real, disclosed scope boundary DOES exist, inherited from
// optionsMath.ts's own pre-existing design, not introduced by this sprint:
// `getSnapshot()` only resolves IV for the original 10-symbol `UNIVERSE`
// (unlike Engine 2's own provider, which synthesizes a plausible series for
// any valid-shaped ticker) — so this module can only run a backtest for
// those 10 symbols, honestly reporting `available: false` for any other
// symbol rather than fabricating an IV assumption. Extending optionsMath.ts
// itself to cover more symbols would require modifying a protected file and
// was correctly out of scope.
//
// Core only this sprint (per the approved plan) — no route, no UI, no
// database table, mirroring every one of Engine 2's own "Core" sprints
// (33-37) exactly. Exactly one strategy this sprint: iron_condor (the
// platform's own flagship strategy, and the most complete existing
// entry-quote builder — buildIronCondor()). Additional strategies are a
// natural, disclosed extension point for a later sprint, never silently
// promised.
//
// SAFETY CONTRACT, unbroken from every prior SIMULATED engine in this
// codebase: a backtest with too few candles, or for a symbol
// optionsMath.ts's own IV model doesn't cover, honestly reports itself
// unavailable with zero trades — never a fabricated trade or equity point.
// A rejected entry quote (optionsMath.ts's own `finalize()` rejection —
// negative EV, wide spread, low open interest) is never entered; the walk
// simply tries again the next day. No LLM call, no live broker, Level 2,
// order-flow, or execution data anywhere in this module — this NEVER
// places a real order, it only replays already-resolved historical
// (SIMULATED or LIVE, per Engine 2's own provider) candles through
// deterministic pricing math.

import type { Candle, MarketDataProvider } from "./tradingMarketData.js";
import { getSnapshot, buildIronCondor, bs, expirationFromDte, type Snapshot, type StrategyQuote } from "./optionsMath.js";

export type OptionsBacktestStrategy = "iron_condor";

export type OptionsBacktestExitReason = "profit-target" | "stop-loss" | "dte-trigger" | "expiration" | "end-of-period";

export interface OptionsBacktestTrade {
  entryDate: string;
  expirationDate: string;
  entryCredit: number; // dollars received at entry
  exitDate: string;
  exitDebit: number; // dollars paid (or received, if negative) to close
  exitReason: OptionsBacktestExitReason;
  pnl: number; // dollars: entryCredit - exitDebit
  maxLoss: number; // dollars, from the entry quote's own finalize()
  rMultiple: number; // pnl / maxLoss
  daysHeld: number;
}

export interface OptionsBacktestEquityPoint {
  date: string;
  value: number;
  drawdownPct: number;
}

export interface OptionsBacktestResult {
  symbol: string;
  strategy: OptionsBacktestStrategy;
  // Two genuinely distinct data sources, honestly labeled separately rather
  // than conflated into one field: the underlying price path (Engine 2,
  // may one day be LIVE per that engine's own deferred live-provider work)
  // and the options/IV pricing model (optionsMath.ts has no LIVE variant
  // anywhere in this codebase, so this is always SIMULATED today).
  underlyingDataSource: "SIMULATED" | "LIVE";
  optionsDataSource: "SIMULATED";
  candleCount: number;
  available: boolean;
  unavailableReason: string | null;
  trades: OptionsBacktestTrade[];
  totalTrades: number;
  winRate: number | null; // null, never 0, when totalTrades is 0
  avgR: number | null;
  totalReturnPct: number | null;
  maxDrawdownPct: number | null;
  sharpeRatio: number | null;
  equityCurve: OptionsBacktestEquityPoint[];
  summary: string;
}

// Named, adjustable constants — a fixed, disclosed management convention,
// the same "state a reasonable named default" precedent as
// tradingBacktest.ts's own DEFAULT_STOP_LOSS_PCT/DEFAULT_TARGET_PCT.
export const DEFAULT_ENTRY_DTE = 45; // matches buildIronCondor()'s own default
export const DEFAULT_SHORT_DELTA = 0.2; // matches buildIronCondor()'s own default
export const DEFAULT_PROFIT_TARGET_PCT = 0.5; // close at 50% of max profit captured — a widely-used real-world iron-condor management convention
export const DEFAULT_STOP_LOSS_MULTIPLE = 2; // close when the cost to close reaches 2x the credit received
export const DEFAULT_DTE_EXIT_TRIGGER = 21; // matches this codebase's own existing adjDteTrigger settings default (lib/db/src/schema/settings.ts)
// Minimum daily candles needed before a backtest is considered meaningful —
// enough runway to plausibly complete at least a partial iron-condor
// lifecycle, the same "enough of a window to be meaningful, not just
// technically non-empty" reasoning as tradingBacktest.ts's own
// MIN_STRUCTURE_WINDOW.
export const MIN_CANDLES_REQUIRED = 30;
const STARTING_EQUITY = 100_000;

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(dateOnly(b)).getTime() - new Date(dateOnly(a)).getTime()) / 86_400_000);
}

function intrinsicValue(S: number, K: number, type: "call" | "put"): number {
  return type === "call" ? Math.max(0, S - K) : Math.max(0, K - S);
}

// Dollar cost to close every leg of a quote today, generalized over
// `legs[]` rather than hardcoded to iron condor's own 4 named strikes —
// buying back a leg you sold costs its current value; selling a leg you
// bought returns its current value (a negative cost). `legPrice` supplies
// each leg's current per-share value — a fresh bs() reprice for a normal
// mark-to-market day, or true intrinsic value on the expiration day itself
// (see the two call sites below). The entry credit itself is read directly
// from the entry quote's own already-computed `.credit` field, never
// re-derived through this helper.
function costToCloseFromPrices(quote: StrategyQuote, legPrice: (legIndex: number) => number): number {
  let total = 0;
  quote.legs.forEach((leg, i) => {
    const price = legPrice(i);
    total += leg.side === "sell" ? price : -price;
  });
  return total * 100;
}

interface OpenPosition {
  entryDate: string;
  expirationDate: string;
  quote: StrategyQuote;
}

function buildSummary(symbol: string, strategy: OptionsBacktestStrategy, result: Omit<OptionsBacktestResult, "summary">): string {
  if (!result.available) return `Options backtest for ${symbol} (${strategy}) is unavailable: ${result.unavailableReason}`;
  if (result.totalTrades === 0) {
    return `${symbol} (${strategy}) never opened a position over the ${result.candleCount}-candle sample — every candidate entry was rejected (negative EV, wide spread, or low open interest).`;
  }
  const wr = result.winRate !== null ? `${round2(result.winRate * 100)}%` : "n/a";
  const ret = result.totalReturnPct !== null ? `${round2(result.totalReturnPct * 100)}%` : "n/a";
  return (
    `${symbol} (${strategy}) took ${result.totalTrades} trade(s) over the ${result.candleCount}-candle sample: ` +
    `${wr} win rate, ${ret} total return, ${round2(result.maxDrawdownPct !== null ? result.maxDrawdownPct * 100 : 0)}% max drawdown.`
  );
}

// Pure — never touches a provider, never generates new randomness beyond
// what optionsMath.ts's own getSnapshot()/buildIronCondor() already do
// deterministically. `candles` must already be oldest -> newest daily bars.
export function runOptionsBacktest(
  candles: Candle[],
  symbol: string,
  strategy: OptionsBacktestStrategy,
  isLive: boolean,
  opts: {
    entryDte?: number;
    shortDelta?: number;
    profitTargetPct?: number;
    stopLossMultiple?: number;
    dteExitTrigger?: number;
  } = {},
): OptionsBacktestResult {
  const entryDte = opts.entryDte ?? DEFAULT_ENTRY_DTE;
  const shortDelta = opts.shortDelta ?? DEFAULT_SHORT_DELTA;
  const profitTargetPct = opts.profitTargetPct ?? DEFAULT_PROFIT_TARGET_PCT;
  const stopLossMultiple = opts.stopLossMultiple ?? DEFAULT_STOP_LOSS_MULTIPLE;
  const dteExitTrigger = opts.dteExitTrigger ?? DEFAULT_DTE_EXIT_TRIGGER;
  const underlyingDataSource: "SIMULATED" | "LIVE" = isLive ? "LIVE" : "SIMULATED";

  function unavailable(reason: string): OptionsBacktestResult {
    const base: Omit<OptionsBacktestResult, "summary"> = {
      symbol,
      strategy,
      underlyingDataSource,
      optionsDataSource: "SIMULATED",
      candleCount: candles.length,
      available: false,
      unavailableReason: reason,
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

  if (candles.length < MIN_CANDLES_REQUIRED) {
    return unavailable(`At least ${MIN_CANDLES_REQUIRED} daily candles are needed to run an options backtest — only ${candles.length} available.`);
  }
  // getSnapshot() only resolves IV for optionsMath.ts's own fixed 10-symbol
  // universe (see the module doc comment's reuse-evaluation section) — this
  // check is symbol-only, so any date suffices to probe it.
  if (getSnapshot(symbol, dateOnly(candles[0].time)) === null) {
    return unavailable(`${symbol} is outside optionsMath.ts's own supported options universe — no IV model exists for it.`);
  }

  const trades: OptionsBacktestTrade[] = [];
  let position: OpenPosition | null = null;

  for (let i = 0; i < candles.length; i++) {
    const dateStr = dateOnly(candles[i].time);
    const spot = candles[i].close;
    const snap = getSnapshot(symbol, dateStr)!; // non-null: checked once above, symbol-only

    if (position) {
      const daysToExpiry = daysBetween(dateStr, position.expirationDate);
      const T = Math.max(daysToExpiry, 0) / 365;

      if (daysToExpiry <= 0) {
        const exitDebit = costToCloseFromPrices(position.quote, (i) => intrinsicValue(spot, position!.quote.legs[i].strike, position!.quote.legs[i].optionType));
        trades.push(closeTrade(position, dateStr, exitDebit, "expiration"));
        position = null;
      } else {
        const legPrice = (legIndex: number) => {
          const leg = position!.quote.legs[legIndex];
          return bs(spot, leg.strike, T, snap.iv, leg.optionType).price;
        };
        const exitDebit = costToCloseFromPrices(position.quote, legPrice);
        const pnlIfClosedNow = position.quote.credit - exitDebit;

        let exitReason: OptionsBacktestExitReason | null = null;
        if (pnlIfClosedNow >= profitTargetPct * position.quote.maxProfit) exitReason = "profit-target";
        else if (exitDebit - position.quote.credit >= stopLossMultiple * position.quote.credit) exitReason = "stop-loss";
        else if (daysToExpiry <= dteExitTrigger) exitReason = "dte-trigger";

        if (exitReason) {
          trades.push(closeTrade(position, dateStr, exitDebit, exitReason));
          position = null;
        }
      }
    }

    if (!position) {
      const entrySnap: Snapshot = { ...snap, price: spot };
      const quote = buildIronCondor(entrySnap, { shortDelta, dte: entryDte });
      if (!quote.rejected) {
        const expirationDate = expirationFromDte(entryDte, new Date(candles[i].time));
        position = { entryDate: dateStr, expirationDate, quote };
      }
      // A rejected quote (negative EV / wide spread / low OI — optionsMath.ts's
      // own finalize() judgment, read here, never overridden) is never
      // entered; the walk simply tries again the next day.
    }
  }

  // A position still open at the end of the sample is honestly closed at
  // the final candle's own close via a real reprice, never left dangling —
  // mirrors tradingBacktest.ts's own "end-of-period" precedent exactly.
  if (position) {
    const last = candles[candles.length - 1];
    const lastDateStr = dateOnly(last.time);
    const daysToExpiry = Math.max(0, daysBetween(lastDateStr, position.expirationDate));
    const T = Math.max(daysToExpiry, 1) / 365;
    const lastSnap = getSnapshot(symbol, lastDateStr)!;
    const exitDebit = costToCloseFromPrices(position.quote, (legIndex) => {
      const leg = position!.quote.legs[legIndex];
      return bs(last.close, leg.strike, T, lastSnap.iv, leg.optionType).price;
    });
    trades.push(closeTrade(position, lastDateStr, exitDebit, "end-of-period"));
  }

  const equityCurve: OptionsBacktestEquityPoint[] = [];
  let equity = STARTING_EQUITY;
  let peak = STARTING_EQUITY;
  for (const t of trades) {
    equity += t.pnl;
    if (equity > peak) peak = equity;
    const drawdownPct = round4(peak > 0 ? (equity - peak) / peak : 0);
    equityCurve.push({ date: t.exitDate, value: round2(equity), drawdownPct });
  }

  const totalTrades = trades.length;
  let base: Omit<OptionsBacktestResult, "summary">;

  if (totalTrades === 0) {
    base = {
      symbol,
      strategy,
      underlyingDataSource,
      optionsDataSource: "SIMULATED",
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
    const wins = trades.filter((t) => t.pnl > 0);
    const winRate = round4(wins.length / totalTrades);
    const avgR = round2(trades.reduce((s, t) => s + t.rMultiple, 0) / totalTrades);
    const totalReturnPct = round4((equity - STARTING_EQUITY) / STARTING_EQUITY);
    const maxDrawdownPct = round4(Math.min(0, ...equityCurve.map((p) => p.drawdownPct)));

    const meanPnlPct = trades.reduce((s, t) => s + t.pnl / STARTING_EQUITY, 0) / totalTrades;
    const variance = trades.reduce((s, t) => s + (t.pnl / STARTING_EQUITY - meanPnlPct) ** 2, 0) / totalTrades;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? round2((meanPnlPct / stdDev) * Math.sqrt(totalTrades)) : null;

    base = {
      symbol,
      strategy,
      underlyingDataSource,
      optionsDataSource: "SIMULATED",
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

function closeTrade(
  position: OpenPosition,
  exitDate: string,
  exitDebit: number,
  exitReason: OptionsBacktestExitReason,
): OptionsBacktestTrade {
  const pnl = round2(position.quote.credit - exitDebit);
  return {
    entryDate: position.entryDate,
    expirationDate: position.expirationDate,
    entryCredit: round2(position.quote.credit),
    exitDate,
    exitDebit: round2(exitDebit),
    exitReason,
    pnl,
    maxLoss: round2(position.quote.maxLoss),
    rMultiple: position.quote.maxLoss > 0 ? round4(pnl / position.quote.maxLoss) : 0,
    daysHeld: daysBetween(position.entryDate, exitDate),
  };
}

// Orchestration: resolves the underlying's daily candle series via the
// provided MarketDataProvider (Sprint 32's seam, unmodified) and calls the
// pure walk-forward above. Honestly returns null when the provider can't
// resolve the symbol — never fabricates a backtest for an unresolvable
// symbol.
export async function buildOptionsBacktest(
  symbol: string,
  strategy: OptionsBacktestStrategy,
  lookbackDays: number,
  provider: MarketDataProvider,
  opts: {
    entryDte?: number;
    shortDelta?: number;
    profitTargetPct?: number;
    stopLossMultiple?: number;
    dteExitTrigger?: number;
  } = {},
): Promise<OptionsBacktestResult | null> {
  const sym = symbol.toUpperCase();
  const candles = await provider.getCandles(sym, "1D", lookbackDays);
  if (!candles) return null;
  return runOptionsBacktest(candles, sym, strategy, provider.isLive, opts);
}
