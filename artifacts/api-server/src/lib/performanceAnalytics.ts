import { makeRng, UNIVERSE_SYMBOLS } from "./optionsMath.js";

// ─────────────────────────────────────────────────────────────────────────────
// Performance Analytics Engine
//
// The live trades table holds only a handful of closed positions — far too few for
// meaningful analytics. Consistent with the rest of the engine ("simulated with
// realistic math"), this module generates a DETERMINISTIC closed-trade population
// (seeded RNG → fully reproducible) and computes every metric + breakdown from it.
// Nothing here touches the real trades table.
//
// Convention: rate-like fields (winRate, maxDrawdown, returnOnCapital, actualPop,
// expectedPop) are fractions in [0,1]. The UI formats them as percentages.
// ─────────────────────────────────────────────────────────────────────────────

export type AnalyticsStrategy = "iron_condor" | "iron_fly" | "strangle" | "calendar_spread";

export const ANALYTICS_STRATEGIES: AnalyticsStrategy[] = [
  "iron_condor",
  "iron_fly",
  "strangle",
  "calendar_spread",
];

export interface SyntheticTrade {
  id: number;
  symbol: string;
  strategy: AnalyticsStrategy;
  openDate: string; // YYYY-MM-DD
  closeDate: string; // YYYY-MM-DD
  closeTs: number; // epoch ms, for ordering/filtering
  dte: number; // days to expiration at entry
  holdingDays: number;
  shortDelta: number; // delta of the short strike (the "delta used")
  ivRank: number; // 0-100
  capital: number; // capital at risk (max loss / margin)
  credit: number; // premium collected
  theta: number; // per-day theta at entry
  thetaCollected: number; // theta decay captured over the hold
  commission: number;
  slippage: number;
  expectedPop: number; // 0-1, modeled probability of profit at entry
  won: boolean;
  grossPnl: number; // before fees/slippage
  netPnl: number; // after commission + slippage
}

interface StrategyProfile {
  weight: number;
  legs: number;
  deltas: number[];
  dtes: number[];
  creditRatio: number; // credit / capital
  capitalBase: number;
  basePop: number; // pop anchor at the lowest delta
}

const PROFILES: Record<AnalyticsStrategy, StrategyProfile> = {
  iron_condor: { weight: 0.4, legs: 4, deltas: [0.1, 0.16, 0.2], dtes: [30, 45], creditRatio: 0.2, capitalBase: 900, basePop: 0.86 },
  iron_fly: { weight: 0.18, legs: 4, deltas: [0.2, 0.3], dtes: [21, 30, 45], creditRatio: 0.33, capitalBase: 1100, basePop: 0.68 },
  strangle: { weight: 0.22, legs: 2, deltas: [0.16, 0.2], dtes: [30, 45], creditRatio: 0.24, capitalBase: 1600, basePop: 0.82 },
  calendar_spread: { weight: 0.2, legs: 2, deltas: [0.1, 0.16], dtes: [30, 45], creditRatio: 0.28, capitalBase: 800, basePop: 0.76 },
};

// Per-symbol skill/edge tilt (deterministic), so best/worst tickers are stable and
// sensible: index ETFs grind out wins; high-beta single names swing harder.
function symbolEdge(symbol: string): number {
  const rng = makeRng(`pa|symedge|${symbol}`);
  const etfs = new Set(["SPY", "QQQ", "IWM"]);
  const base = etfs.has(symbol) ? 0.04 : -0.01;
  return base + (rng() - 0.5) * 0.1;
}

function pick<T>(arr: T[], r: number): T {
  return arr[Math.min(arr.length - 1, Math.floor(r * arr.length))];
}

function pickStrategy(r: number): AnalyticsStrategy {
  let acc = 0;
  for (const s of ANALYTICS_STRATEGIES) {
    acc += PROFILES[s].weight;
    if (r <= acc) return s;
  }
  return "iron_condor";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const TRADE_COUNT = 220;
const HISTORY_MONTHS = 24;

let cachedHistory: SyntheticTrade[] | null = null;

export function generateTradeHistory(seed = "ravish-perf-v1"): SyntheticTrade[] {
  if (cachedHistory) return cachedHistory;

  const trades: SyntheticTrade[] = [];
  const now = Date.now();
  const windowMs = HISTORY_MONTHS * 30 * 24 * 3600 * 1000;
  const dayMs = 24 * 3600 * 1000;

  for (let i = 0; i < TRADE_COUNT; i++) {
    const rng = makeRng(`${seed}|trade|${i}`);
    const strategy = pickStrategy(rng());
    const p = PROFILES[strategy];
    const symbol = pick(UNIVERSE_SYMBOLS, rng());
    const dte = pick(p.dtes, rng());
    const shortDelta = pick(p.deltas, rng());
    const ivRank = Math.round(15 + rng() * 80); // 15-95

    // Spread closes across the window (ascending), with jitter.
    const closeTs = now - windowMs + (windowMs * (i + rng() * 0.8)) / TRADE_COUNT;
    const holdingDays = Math.max(2, Math.round(dte * (0.35 + rng() * 0.5)));
    const closeDate = new Date(closeTs).toISOString().slice(0, 10);
    const openDate = new Date(closeTs - holdingDays * dayMs).toISOString().slice(0, 10);

    const capital = Math.round(p.capitalBase * (0.7 + rng() * 0.9));
    const credit = round2(capital * p.creditRatio * (0.8 + rng() * 0.4));
    const theta = round2((credit / dte) * (0.7 + rng() * 0.5));

    // Modeled probability of profit: anchored per strategy, lower as delta rises.
    const expectedPop = clamp(p.basePop - (shortDelta - p.deltas[0]) * 0.9 + (ivRank - 50) / 600, 0.45, 0.93);

    // Realized outcome tracks expected POP plus the symbol edge, minus a small
    // real-world drag — so "actual vs expected POP" reads slightly below expected.
    const effWin = clamp(expectedPop + symbolEdge(symbol) - 0.02, 0.4, 0.95);
    const won = rng() < effWin;

    const commission = round2(0.65 * p.legs);
    const slippage = round2(p.legs * (1.2 + rng() * 2.6));

    let grossPnl: number;
    if (won) {
      grossPnl = round2(credit * (0.5 + rng() * 0.4)); // capture 50-90% of credit
    } else {
      // Managed premium-selling stops losses at a small multiple of the credit
      // collected (not the full max loss). Undefined-risk strangles overshoot more.
      // Always capped at the defined max loss (capital).
      const lossMult = strategy === "strangle" ? 0.9 + rng() * 1.4 : 0.7 + rng() * 0.8;
      grossPnl = -Math.min(capital, round2(credit * lossMult));
    }
    const netPnl = round2(grossPnl - commission - slippage);
    const thetaCollected = round2(theta * holdingDays * (won ? 1 : 0.4));

    trades.push({
      id: i + 1,
      symbol,
      strategy,
      openDate,
      closeDate,
      closeTs,
      dte,
      holdingDays,
      shortDelta,
      ivRank,
      capital,
      credit,
      theta,
      thetaCollected,
      commission,
      slippage,
      expectedPop,
      won,
      grossPnl,
      netPnl,
    });
  }

  trades.sort((a, b) => a.closeTs - b.closeTs);
  cachedHistory = trades;
  return trades;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export type Period = "1m" | "3m" | "6m" | "1y" | "all";

export function filterByPeriod(trades: SyntheticTrade[], period: Period): SyntheticTrade[] {
  if (period === "all") return trades;
  const months = period === "1y" ? 12 : period === "6m" ? 6 : period === "3m" ? 3 : 1;
  const cutoff = Date.now() - months * 30 * 24 * 3600 * 1000;
  return trades.filter((t) => t.closeTs >= cutoff);
}

// ── Metric helpers ───────────────────────────────────────────────────────────

export interface CoreStats {
  totalTrades: number;
  winRate: number;
  avgWin: number; // mean net pnl of winners (positive)
  avgLoss: number; // mean net loss magnitude of losers (positive)
  profitFactor: number;
  expectancy: number;
  totalReturn: number; // sum net pnl
  totalCapitalDeployed: number;
  returnOnCapital: number; // totalReturn / totalCapitalDeployed
  actualPop: number; // realized win rate (0-1)
  expectedPop: number; // mean modeled pop (0-1)
}

export function computeCore(trades: SyntheticTrade[]): CoreStats {
  const n = trades.length;
  if (n === 0) {
    return {
      totalTrades: 0, winRate: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, expectancy: 0,
      totalReturn: 0, totalCapitalDeployed: 0, returnOnCapital: 0, actualPop: 0, expectedPop: 0,
    };
  }
  const winners = trades.filter((t) => t.netPnl > 0);
  const losers = trades.filter((t) => t.netPnl <= 0);
  const grossWin = winners.reduce((s, t) => s + t.netPnl, 0);
  const grossLoss = Math.abs(losers.reduce((s, t) => s + t.netPnl, 0));
  const avgWin = winners.length ? grossWin / winners.length : 0;
  const avgLoss = losers.length ? grossLoss / losers.length : 0;
  const winRate = winners.length / n;
  const totalReturn = trades.reduce((s, t) => s + t.netPnl, 0);
  const totalCapitalDeployed = trades.reduce((s, t) => s + t.capital, 0);
  return {
    totalTrades: n,
    winRate,
    avgWin: round2(avgWin),
    avgLoss: round2(avgLoss),
    profitFactor: grossLoss > 0 ? round2(grossWin / grossLoss) : grossWin > 0 ? 99 : 0,
    expectancy: round2(winRate * avgWin - (1 - winRate) * avgLoss),
    totalReturn: round2(totalReturn),
    totalCapitalDeployed: round2(totalCapitalDeployed),
    returnOnCapital: totalCapitalDeployed > 0 ? totalReturn / totalCapitalDeployed : 0,
    actualPop: winRate,
    expectedPop: trades.reduce((s, t) => s + t.expectedPop, 0) / n,
  };
}

export interface EquityPoint {
  date: string;
  value: number;
  drawdown: number; // fraction, <= 0
}

const STARTING_CAPITAL = 100000;

export function buildEquityCurve(trades: SyntheticTrade[]): { points: EquityPoint[]; maxDrawdown: number } {
  const points: EquityPoint[] = [];
  let value = STARTING_CAPITAL;
  let peak = value;
  let maxDd = 0;
  for (const t of trades) {
    value += t.netPnl;
    if (value > peak) peak = value;
    const drawdown = peak > 0 ? (value - peak) / peak : 0;
    if (drawdown < maxDd) maxDd = drawdown;
    points.push({ date: t.closeDate, value: round2(value), drawdown: round2(drawdown) });
  }
  return { points, maxDrawdown: Math.abs(round2(maxDd)) };
}

// Sharpe on the per-trade net-return series, annualized by trades/year cadence.
export function computeSharpe(trades: SyntheticTrade[]): number {
  if (trades.length < 2) return 0;
  const rets = trades.map((t) => t.netPnl / t.capital);
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
  const sd = Math.sqrt(variance);
  if (sd === 0) return 0;
  // Approximate trades-per-year cadence from the window span.
  const spanDays = Math.max(1, (trades[trades.length - 1].closeTs - trades[0].closeTs) / (24 * 3600 * 1000));
  const tradesPerYear = (trades.length / spanDays) * 365;
  return round2((mean / sd) * Math.sqrt(tradesPerYear));
}

export function computeSortino(trades: SyntheticTrade[]): number {
  if (trades.length < 2) return 0;
  const rets = trades.map((t) => t.netPnl / t.capital);
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const downside = rets.filter((r) => r < 0);
  if (downside.length === 0) return 99;
  const dd = Math.sqrt(downside.reduce((s, r) => s + r ** 2, 0) / downside.length);
  if (dd === 0) return 0;
  const spanDays = Math.max(1, (trades[trades.length - 1].closeTs - trades[0].closeTs) / (24 * 3600 * 1000));
  const tradesPerYear = (trades.length / spanDays) * 365;
  return round2((mean / dd) * Math.sqrt(tradesPerYear));
}

// ── Breakdowns ───────────────────────────────────────────────────────────────

export type BreakdownDimension = "strategy" | "ticker" | "duration" | "delta" | "ivrank";

export interface BreakdownBucket {
  key: string;
  label: string;
  totalTrades: number;
  winRate: number;
  totalReturn: number;
  avgReturn: number;
  profitFactor: number;
  expectancy: number;
  returnOnCapital: number;
  actualPop: number;
  expectedPop: number;
  avgHoldingDays: number;
  thetaCollected: number;
}

function durationBucket(dte: number): { key: string; label: string; order: number } {
  if (dte <= 21) return { key: "0-21", label: "0-21 DTE", order: 0 };
  if (dte <= 35) return { key: "22-35", label: "22-35 DTE", order: 1 };
  if (dte <= 45) return { key: "36-45", label: "36-45 DTE", order: 2 };
  return { key: "45+", label: "45+ DTE", order: 3 };
}

function deltaBucket(d: number): { key: string; label: string; order: number } {
  if (d <= 0.12) return { key: "0.10", label: "~0.10 Δ (far OTM)", order: 0 };
  if (d <= 0.17) return { key: "0.16", label: "~0.16 Δ (1 SD)", order: 1 };
  if (d <= 0.24) return { key: "0.20", label: "~0.20 Δ", order: 2 };
  return { key: "0.30", label: "~0.30 Δ (aggressive)", order: 3 };
}

function ivRankBucket(iv: number): { key: string; label: string; order: number } {
  if (iv < 25) return { key: "0-25", label: "Low IV (0-25)", order: 0 };
  if (iv < 50) return { key: "25-50", label: "Mid IV (25-50)", order: 1 };
  if (iv < 75) return { key: "50-75", label: "High IV (50-75)", order: 2 };
  return { key: "75-100", label: "Extreme IV (75-100)", order: 3 };
}

function bucketFor(t: SyntheticTrade, dim: BreakdownDimension): { key: string; label: string; order: number } {
  switch (dim) {
    case "strategy":
      return { key: t.strategy, label: strategyLabel(t.strategy), order: ANALYTICS_STRATEGIES.indexOf(t.strategy) };
    case "ticker":
      return { key: t.symbol, label: t.symbol, order: UNIVERSE_SYMBOLS.indexOf(t.symbol) };
    case "duration":
      return durationBucket(t.dte);
    case "delta":
      return deltaBucket(t.shortDelta);
    case "ivrank":
      return ivRankBucket(t.ivRank);
  }
}

export function strategyLabel(s: string): string {
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function computeBreakdown(trades: SyntheticTrade[], dim: BreakdownDimension): BreakdownBucket[] {
  const groups = new Map<string, { label: string; order: number; rows: SyntheticTrade[] }>();
  for (const t of trades) {
    const b = bucketFor(t, dim);
    const g = groups.get(b.key);
    if (g) g.rows.push(t);
    else groups.set(b.key, { label: b.label, order: b.order, rows: [t] });
  }
  const out: BreakdownBucket[] = [];
  for (const [key, g] of groups) {
    const core = computeCore(g.rows);
    out.push({
      key,
      label: g.label,
      totalTrades: core.totalTrades,
      winRate: core.winRate,
      totalReturn: core.totalReturn,
      avgReturn: round2(core.totalReturn / core.totalTrades),
      profitFactor: core.profitFactor,
      expectancy: core.expectancy,
      returnOnCapital: core.returnOnCapital,
      actualPop: core.actualPop,
      expectedPop: round2(core.expectedPop),
      avgHoldingDays: round2(g.rows.reduce((s, t) => s + t.holdingDays, 0) / g.rows.length),
      thetaCollected: round2(g.rows.reduce((s, t) => s + t.thetaCollected, 0)),
    });
  }
  // Stable order: by the bucket's natural order, falling back to key.
  out.sort((a, b) => {
    const oa = (groups.get(a.key)?.order ?? 0) - (groups.get(b.key)?.order ?? 0);
    return oa !== 0 ? oa : a.key.localeCompare(b.key);
  });
  return out;
}

// ── Top-level analytics assembly ─────────────────────────────────────────────

export interface TickerStat {
  symbol: string;
  totalTrades: number;
  winRate: number;
  totalReturn: number;
}

export interface PerformanceAnalytics extends CoreStats {
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  avgHoldingDays: number;
  thetaCollected: number;
  totalCommission: number;
  totalSlippage: number;
  commissionImpactPct: number; // (commission+slippage) / gross profit
  bestStrategy: string;
  worstStrategy: string;
  bestTickers: TickerStat[];
  worstTickers: TickerStat[];
  strategyBreakdown: BreakdownBucket[];
  monthlyReturns: { month: string; return: number; trades: number }[];
}

export function computeAnalytics(period: Period = "all"): PerformanceAnalytics {
  const all = generateTradeHistory();
  const trades = filterByPeriod(all, period);
  const core = computeCore(trades);
  const { maxDrawdown } = buildEquityCurve(trades);

  const grossProfit = trades.filter((t) => t.netPnl > 0).reduce((s, t) => s + t.netPnl, 0);
  const totalCommission = round2(trades.reduce((s, t) => s + t.commission, 0));
  const totalSlippage = round2(trades.reduce((s, t) => s + t.slippage, 0));
  const avgHoldingDays = trades.length ? round2(trades.reduce((s, t) => s + t.holdingDays, 0) / trades.length) : 0;
  const thetaCollected = round2(trades.reduce((s, t) => s + t.thetaCollected, 0));

  const strategyBreakdown = computeBreakdown(trades, "strategy");
  const byStrategySorted = [...strategyBreakdown].sort((a, b) => b.totalReturn - a.totalReturn);

  const tickerStats: TickerStat[] = computeBreakdown(trades, "ticker").map((b) => ({
    symbol: b.key,
    totalTrades: b.totalTrades,
    winRate: b.winRate,
    totalReturn: b.totalReturn,
  }));
  const tickersSorted = [...tickerStats].sort((a, b) => b.totalReturn - a.totalReturn);

  const monthlyReturns = computeMonthlyReturns(trades);

  return {
    ...core,
    maxDrawdown,
    sharpeRatio: computeSharpe(trades),
    sortinoRatio: computeSortino(trades),
    avgHoldingDays,
    thetaCollected,
    totalCommission,
    totalSlippage,
    commissionImpactPct: grossProfit > 0 ? round2((totalCommission + totalSlippage) / grossProfit) : 0,
    bestStrategy: byStrategySorted[0]?.label ?? "—",
    worstStrategy: byStrategySorted[byStrategySorted.length - 1]?.label ?? "—",
    bestTickers: tickersSorted.slice(0, 5),
    worstTickers: tickersSorted.slice(-5).reverse(),
    strategyBreakdown,
    monthlyReturns,
  };
}

function computeMonthlyReturns(trades: SyntheticTrade[]): { month: string; return: number; trades: number }[] {
  const groups = new Map<string, { ts: number; pnl: number; capital: number; count: number }>();
  for (const t of trades) {
    const d = new Date(t.closeTs);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const g = groups.get(key);
    if (g) {
      g.pnl += t.netPnl;
      g.capital += t.capital;
      g.count += 1;
    } else {
      groups.set(key, { ts: t.closeTs, pnl: t.netPnl, capital: t.capital, count: 1 });
    }
  }
  return [...groups.entries()]
    .sort((a, b) => a[1].ts - b[1].ts)
    .map(([, g]) => ({
      month: new Date(g.ts).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      return: g.capital > 0 ? round2(g.pnl / g.capital) : 0,
      trades: g.count,
    }));
}

export function getEquityCurve(period: Period = "all"): EquityPoint[] {
  const trades = filterByPeriod(generateTradeHistory(), period);
  return buildEquityCurve(trades).points;
}

export function getBreakdown(dim: BreakdownDimension, period: Period = "all"): BreakdownBucket[] {
  const trades = filterByPeriod(generateTradeHistory(), period);
  return computeBreakdown(trades, dim);
}
