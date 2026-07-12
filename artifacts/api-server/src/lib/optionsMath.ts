// Deterministic options-math engine: Black-Scholes pricing & greeks, delta-based
// strike selection, probability-of-profit, expected value, liquidity, and the
// Ravish Score. All market data is derived from seeded per-symbol snapshots so
// results are stable within a trading day and consistent across endpoints.

const RISK_FREE = 0.045;
// Volatility risk premium: implied vol systematically overstates realized vol,
// so the probability of staying inside the breakevens is computed with a haircut
// vol. This is the structural edge that makes net premium selling positive-EV.
const VRP_FACTOR = 0.82;
export function popVol(iv: number): number {
  return Math.max(0.01, iv * VRP_FACTOR);
}

// ─── Deterministic RNG ───────────────────────────────────────────────────────
function hashStr(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed: string): () => number {
  return mulberry32(hashStr(seed));
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

// ─── Normal distribution ─────────────────────────────────────────────────────
function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

export function normCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

// Acklam's inverse normal CDF approximation.
function normInv(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const plow = 0.02425;
  const phigh = 1 - plow;
  let q: number;
  let r: number;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= phigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(
    (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

// ─── Black-Scholes ───────────────────────────────────────────────────────────
export interface Greeks {
  price: number;
  delta: number;
  theta: number; // per day, per share
  vega: number; // per 1% vol, per share
  gamma: number;
}

export function bs(
  S: number,
  K: number,
  T: number,
  sigma: number,
  type: "call" | "put",
  r = RISK_FREE,
): Greeks {
  const t = Math.max(T, 1 / 365);
  const sig = Math.max(sigma, 0.01);
  const sqrtT = Math.sqrt(t);
  const d1 = (Math.log(S / K) + (r + (sig * sig) / 2) * t) / (sig * sqrtT);
  const d2 = d1 - sig * sqrtT;
  const nd1 = normPdf(d1);
  const disc = Math.exp(-r * t);
  const gamma = nd1 / (S * sig * sqrtT);
  const vega = (S * nd1 * sqrtT) / 100;
  if (type === "call") {
    const Nd1 = normCdf(d1);
    const Nd2 = normCdf(d2);
    const price = S * Nd1 - K * disc * Nd2;
    const theta =
      (-(S * nd1 * sig) / (2 * sqrtT) - r * K * disc * Nd2) / 365;
    return { price: Math.max(0.01, price), delta: Nd1, theta, vega, gamma };
  }
  const Nnd1 = normCdf(-d1);
  const Nnd2 = normCdf(-d2);
  const price = K * disc * Nnd2 - S * Nnd1;
  const theta = (-(S * nd1 * sig) / (2 * sqrtT) + r * K * disc * Nnd2) / 365;
  return { price: Math.max(0.01, price), delta: normCdf(d1) - 1, theta, vega, gamma };
}

// Risk-neutral probability that S_T > K.
export function probAbove(S: number, K: number, T: number, sigma: number, r = RISK_FREE): number {
  const t = Math.max(T, 1 / 365);
  const sig = Math.max(sigma, 0.01);
  const d2 = (Math.log(S / K) + (r - (sig * sig) / 2) * t) / (sig * Math.sqrt(t));
  return normCdf(d2);
}

// Strike that yields the given option delta (call delta in (0,1), put uses abs).
export function strikeForDelta(
  S: number,
  T: number,
  sigma: number,
  targetDelta: number,
  type: "call" | "put",
  r = RISK_FREE,
): number {
  const t = Math.max(T, 1 / 365);
  const sig = Math.max(sigma, 0.01);
  const sqrtT = Math.sqrt(t);
  const nTarget = type === "call" ? targetDelta : 1 - Math.abs(targetDelta);
  const d1 = normInv(nTarget);
  return S * Math.exp((r + (sig * sig) / 2) * t - d1 * sig * sqrtT);
}

// ─── Market snapshots (deterministic per symbol/day) ─────────────────────────
interface UniverseEntry {
  symbol: string;
  name: string;
  base: number;
  ivBase: number;
  tier: "etf" | "mega";
  hasEarnings: boolean;
}

export const UNIVERSE: UniverseEntry[] = [
  { symbol: "SPY", name: "SPDR S&P 500 ETF", base: 540, ivBase: 0.13, tier: "etf", hasEarnings: false },
  { symbol: "QQQ", name: "Invesco QQQ Trust", base: 460, ivBase: 0.16, tier: "etf", hasEarnings: false },
  { symbol: "IWM", name: "iShares Russell 2000 ETF", base: 200, ivBase: 0.19, tier: "etf", hasEarnings: false },
  { symbol: "NVDA", name: "NVIDIA Corporation", base: 900, ivBase: 0.48, tier: "mega", hasEarnings: true },
  { symbol: "META", name: "Meta Platforms Inc", base: 510, ivBase: 0.34, tier: "mega", hasEarnings: true },
  { symbol: "AAPL", name: "Apple Inc", base: 195, ivBase: 0.26, tier: "mega", hasEarnings: true },
  { symbol: "AMZN", name: "Amazon.com Inc", base: 185, ivBase: 0.32, tier: "mega", hasEarnings: true },
  { symbol: "MSFT", name: "Microsoft Corporation", base: 420, ivBase: 0.24, tier: "mega", hasEarnings: true },
  { symbol: "GOOGL", name: "Alphabet Inc", base: 175, ivBase: 0.29, tier: "mega", hasEarnings: true },
  { symbol: "TSLA", name: "Tesla Inc", base: 175, ivBase: 0.55, tier: "mega", hasEarnings: true },
];

export const UNIVERSE_SYMBOLS = UNIVERSE.map((u) => u.symbol);

export interface Snapshot {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  iv: number;
  ivRank: number;
  spreadPct: number;
  openInterest: number;
  liquidityScore: number;
  earningsInDays: number | null;
}

export function todayStr(date = new Date()): string {
  return date.toISOString().split("T")[0];
}

export function getSnapshot(symbol: string, dateStr = todayStr()): Snapshot | null {
  const u = UNIVERSE.find((e) => e.symbol === symbol.toUpperCase());
  if (!u) return null;
  const rng = makeRng(`${u.symbol}|${dateStr}`);
  const drift = (rng() - 0.5) * 0.04;
  const price = Math.round(u.base * (1 + drift) * 100) / 100;
  const change = Math.round((rng() - 0.48) * price * 0.025 * 100) / 100;
  const iv = Math.round(u.ivBase * (0.85 + rng() * 0.4) * 1000) / 1000;
  const ivRank =
    u.tier === "etf"
      ? Math.round(20 + rng() * 45)
      : Math.round(35 + rng() * 55);
  const spreadPct =
    u.tier === "etf" ? 0.01 + rng() * 0.015 : 0.02 + rng() * 0.04;
  const openInterest =
    u.tier === "etf"
      ? Math.round(8000 + rng() * 12000)
      : Math.round(1500 + rng() * 4500);
  const liquidityScore = Math.round(
    clamp(100 - spreadPct * 600 - (u.tier === "etf" ? 0 : 6), 50, 99),
  );
  const earningsInDays = u.hasEarnings ? Math.round(2 + rng() * 40) : null;
  return {
    symbol: u.symbol,
    name: u.name,
    price,
    change,
    changePercent: Math.round((change / price) * 10000) / 100,
    iv,
    ivRank,
    spreadPct,
    openInterest,
    liquidityScore,
    earningsInDays,
  };
}

export function strikeStep(price: number): number {
  return price < 100 ? 2.5 : price < 300 ? 5 : 10;
}

function roundStep(x: number, step: number): number {
  return Math.round(x / step) * step;
}

function floorStep(x: number, step: number): number {
  return Math.floor(x / step) * step;
}

function ceilStep(x: number, step: number): number {
  return Math.ceil(x / step) * step;
}

export function expirationFromDte(dte: number, from = new Date()): string {
  const d = new Date(from.getTime() + dte * 24 * 60 * 60 * 1000);
  return d.toISOString().split("T")[0];
}

// ─── Ravish Score ────────────────────────────────────────────────────────────
export interface ScoreComponents {
  popScore: number;
  evScore: number;
  thetaScore: number;
  winRateScore: number;
  liquidityScore: number;
  ivRankScore: number;
  total: number;
  tier: "elite" | "high_conviction" | "good" | "ignore";
}

const WIN_RATE_BASE: Record<string, number> = {
  iron_condor: 0.74,
  iron_fly: 0.63,
  calendar_spread: 0.68,
  earnings: 0.6,
};

// Single source of truth for the Ravish tier boundaries. Used by ravishScore and by
// any consumer that adjusts the raw score afterward (e.g. the Event Risk penalty) so
// the tier always stays in lockstep with the (possibly penalized) total.
export function scoreTier(total: number): ScoreComponents["tier"] {
  return total >= 68
    ? "elite"
    : total >= 62
      ? "high_conviction"
      : total >= 55
        ? "good"
        : "ignore";
}

export function historicalWinRate(strategy: string, pop: number): number {
  const base = WIN_RATE_BASE[strategy] ?? 0.65;
  return clamp(0.6 * base + 0.4 * (pop / 100), 0.4, 0.95);
}

export function ravishScore(input: {
  strategy: string;
  pop: number; // 0-100
  ev: number; // dollars
  maxProfit: number; // dollars
  maxLoss: number; // dollars
  dailyTheta: number; // dollars/day
  dte: number;
  liquidityScore: number; // 0-100
  ivRank: number; // 0-100
}): ScoreComponents {
  const popScore = clamp(input.pop, 0, 100);
  const evScore = clamp((input.ev / Math.max(input.maxProfit, 1)) * 250, 0, 100);
  const thetaEff =
    (Math.abs(input.dailyTheta) / Math.max(input.maxLoss, 1)) * 100 * input.dte;
  const thetaScore = clamp(thetaEff, 0, 100);
  const winRateScore = historicalWinRate(input.strategy, input.pop) * 100;
  const liquidityScore = clamp(input.liquidityScore, 0, 100);
  const ivRankScore = clamp(input.ivRank, 0, 100);
  const total =
    0.3 * popScore +
    0.25 * evScore +
    0.15 * thetaScore +
    0.15 * winRateScore +
    0.1 * liquidityScore +
    0.05 * ivRankScore;
  const tier = scoreTier(total);
  return {
    popScore: Math.round(popScore * 10) / 10,
    evScore: Math.round(evScore * 10) / 10,
    thetaScore: Math.round(thetaScore * 10) / 10,
    winRateScore: Math.round(winRateScore * 10) / 10,
    liquidityScore: Math.round(liquidityScore * 10) / 10,
    ivRankScore: Math.round(ivRankScore * 10) / 10,
    total: Math.round(total * 10) / 10,
    tier,
  };
}

// ─── Event risk ──────────────────────────────────────────────────────────────
export type EventRiskLevel = "none" | "low" | "medium" | "high";
export type EventRiskType =
  | "earnings"
  | "dividend"
  | "fomc"
  | "cpi"
  | "jobs"
  | "economic"
  | "news";

export interface EventRiskEvent {
  type: EventRiskType;
  label: string;
  date: string; // YYYY-MM-DD
  daysAway: number;
  impact: "low" | "medium" | "high";
  scope: "symbol" | "market";
  symbol: string | null; // null for market-wide events
}

// ─── Strategy quotes ─────────────────────────────────────────────────────────
export interface QuoteLeg {
  side: "buy" | "sell";
  optionType: "call" | "put";
  strike: number;
  expiration: string;
  openPrice: number;
  quantity: number;
}

export interface StrategyQuote {
  symbol: string;
  strategy: string;
  expiration: string;
  daysToExpiry: number;
  shortPutStrike: number | null;
  shortCallStrike: number | null;
  longPutStrike: number | null;
  longCallStrike: number | null;
  credit: number; // dollars (negative = net debit)
  maxProfit: number; // dollars
  maxLoss: number; // dollars
  pop: number; // 0-100
  ev: number; // dollars
  theta: number; // dollars/day (position)
  vega: number; // dollars per 1% vol (position)
  ivRank: number;
  liquidityScore: number;
  returnOnCapital: number;
  ravishScore: number;
  ravishTier: string;
  legs: QuoteLeg[];
  rejected: boolean;
  rejectReason: string | null;
  eventRiskLevel: EventRiskLevel;
  eventRiskPenalty: number;
  eventRiskEvents: EventRiskEvent[];
}

const LIQ_REJECT_SPREAD = 0.08;
const LIQ_REJECT_OI = 200;

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function finalize(
  snap: Snapshot,
  strategy: string,
  dte: number,
  base: {
    shortPutStrike: number | null;
    shortCallStrike: number | null;
    longPutStrike: number | null;
    longCallStrike: number | null;
    credit: number;
    maxProfit: number;
    maxLoss: number;
    pop: number;
    theta: number;
    vega: number;
    legs: QuoteLeg[];
  },
): StrategyQuote {
  const popFrac = clamp(base.pop, 0, 1);
  const ev = popFrac * base.maxProfit - (1 - popFrac) * base.maxLoss;
  const score = ravishScore({
    strategy,
    pop: popFrac * 100,
    ev,
    maxProfit: base.maxProfit,
    maxLoss: base.maxLoss,
    dailyTheta: base.theta,
    dte,
    liquidityScore: snap.liquidityScore,
    ivRank: snap.ivRank,
  });
  let rejected = false;
  let rejectReason: string | null = null;
  if (base.maxLoss <= 0) {
    rejected = true;
    rejectReason = "Invalid risk profile";
  } else if (ev <= 0) {
    rejected = true;
    rejectReason = "Negative expected value";
  } else if (snap.spreadPct > LIQ_REJECT_SPREAD) {
    rejected = true;
    rejectReason = "Bid/ask spread too wide";
  } else if (snap.openInterest < LIQ_REJECT_OI) {
    rejected = true;
    rejectReason = "Open interest too low";
  }
  return {
    symbol: snap.symbol,
    strategy,
    expiration: expirationFromDte(dte),
    daysToExpiry: dte,
    shortPutStrike: base.shortPutStrike,
    shortCallStrike: base.shortCallStrike,
    longPutStrike: base.longPutStrike,
    longCallStrike: base.longCallStrike,
    credit: round2(base.credit),
    maxProfit: round2(base.maxProfit),
    maxLoss: round2(base.maxLoss),
    pop: Math.round(popFrac * 1000) / 10,
    ev: round2(ev),
    theta: round2(base.theta),
    vega: round2(base.vega),
    ivRank: snap.ivRank,
    liquidityScore: snap.liquidityScore,
    returnOnCapital: Math.round((base.maxProfit / base.maxLoss) * 1000) / 10,
    ravishScore: score.total,
    ravishTier: score.tier,
    legs: base.legs,
    rejected,
    rejectReason,
    // Event-risk fields default to none here; execution computes the live assessment.
    eventRiskLevel: "none",
    eventRiskPenalty: 0,
    eventRiskEvents: [],
  };
}

export function buildIronCondor(
  snap: Snapshot,
  opts: { shortDelta?: number; dte?: number } = {},
): StrategyQuote {
  const shortDelta = opts.shortDelta ?? 0.2;
  const dte = opts.dte ?? 45;
  const T = dte / 365;
  const step = strikeStep(snap.price);
  const exp = expirationFromDte(dte);
  const shortPut = floorStep(strikeForDelta(snap.price, T, snap.iv, shortDelta, "put"), step);
  const shortCall = ceilStep(strikeForDelta(snap.price, T, snap.iv, shortDelta, "call"), step);
  const wing = Math.max(step, roundStep(snap.price * 0.025, step));
  const longPut = shortPut - wing;
  const longCall = shortCall + wing;

  const sp = bs(snap.price, shortPut, T, snap.iv, "put");
  const lp = bs(snap.price, longPut, T, snap.iv, "put");
  const sc = bs(snap.price, shortCall, T, snap.iv, "call");
  const lc = bs(snap.price, longCall, T, snap.iv, "call");

  const creditPer = sp.price + sc.price - lp.price - lc.price;
  const credit = creditPer * 100;
  const maxProfit = credit;
  const maxLoss = (wing - creditPer) * 100;
  const beLow = shortPut - creditPer;
  const beHigh = shortCall + creditPer;
  const pop =
    probAbove(snap.price, beLow, T, popVol(snap.iv)) -
    probAbove(snap.price, beHigh, T, popVol(snap.iv));
  const theta = (-sp.theta - sc.theta + lp.theta + lc.theta) * 100;
  const vega = (-sp.vega - sc.vega + lp.vega + lc.vega) * 100;

  return finalize(snap, "iron_condor", dte, {
    shortPutStrike: shortPut,
    shortCallStrike: shortCall,
    longPutStrike: longPut,
    longCallStrike: longCall,
    credit,
    maxProfit,
    maxLoss,
    pop,
    theta,
    vega,
    legs: [
      { side: "sell", optionType: "put", strike: shortPut, expiration: exp, openPrice: round2(sp.price), quantity: 1 },
      { side: "buy", optionType: "put", strike: longPut, expiration: exp, openPrice: round2(lp.price), quantity: 1 },
      { side: "sell", optionType: "call", strike: shortCall, expiration: exp, openPrice: round2(sc.price), quantity: 1 },
      { side: "buy", optionType: "call", strike: longCall, expiration: exp, openPrice: round2(lc.price), quantity: 1 },
    ],
  });
}

export function buildIronFly(
  snap: Snapshot,
  opts: { dte?: number; ivOverride?: number; strategy?: string } = {},
): StrategyQuote {
  const dte = opts.dte ?? 45;
  const iv = opts.ivOverride ?? snap.iv;
  const strategy = opts.strategy ?? "iron_fly";
  const T = dte / 365;
  const step = strikeStep(snap.price);
  const exp = expirationFromDte(dte);
  const k0 = roundStep(snap.price, step);
  const wing = Math.max(2 * step, roundStep(snap.price * 0.05, step));
  const longPut = k0 - wing;
  const longCall = k0 + wing;

  const sp = bs(snap.price, k0, T, iv, "put");
  const sc = bs(snap.price, k0, T, iv, "call");
  const lp = bs(snap.price, longPut, T, iv, "put");
  const lc = bs(snap.price, longCall, T, iv, "call");

  const creditPer = sp.price + sc.price - lp.price - lc.price;
  const credit = creditPer * 100;
  const maxProfit = credit;
  const maxLoss = (wing - creditPer) * 100;
  const beLow = k0 - creditPer;
  const beHigh = k0 + creditPer;
  const pop =
    probAbove(snap.price, beLow, T, popVol(iv)) - probAbove(snap.price, beHigh, T, popVol(iv));
  const theta = (-sp.theta - sc.theta + lp.theta + lc.theta) * 100;
  const vega = (-sp.vega - sc.vega + lp.vega + lc.vega) * 100;

  return finalize(snap, strategy, dte, {
    shortPutStrike: k0,
    shortCallStrike: k0,
    longPutStrike: longPut,
    longCallStrike: longCall,
    credit,
    maxProfit,
    maxLoss,
    pop,
    theta,
    vega,
    legs: [
      { side: "sell", optionType: "put", strike: k0, expiration: exp, openPrice: round2(sp.price), quantity: 1 },
      { side: "buy", optionType: "put", strike: longPut, expiration: exp, openPrice: round2(lp.price), quantity: 1 },
      { side: "sell", optionType: "call", strike: k0, expiration: exp, openPrice: round2(sc.price), quantity: 1 },
      { side: "buy", optionType: "call", strike: longCall, expiration: exp, openPrice: round2(lc.price), quantity: 1 },
    ],
  });
}

export function buildCalendar(
  snap: Snapshot,
  opts: { delta?: number; frontDte?: number; backDte?: number } = {},
): StrategyQuote {
  const delta = opts.delta ?? 0.27;
  const frontDte = opts.frontDte ?? 30;
  const backDte = opts.backDte ?? 60;
  const Tf = frontDte / 365;
  const Tb = backDte / 365;
  const step = strikeStep(snap.price);
  const frontExp = expirationFromDte(frontDte);
  const backExp = expirationFromDte(backDte);
  const strike = roundStep(strikeForDelta(snap.price, Tb, snap.iv, delta, "call"), step);

  const front = bs(snap.price, strike, Tf, snap.iv, "call");
  const back = bs(snap.price, strike, Tb, snap.iv, "call");
  const debitPer = back.price - front.price;
  const credit = -debitPer * 100;
  const maxLoss = debitPer * 100;
  // Value of the back leg when the front expires at-the-money.
  const backAtFront = bs(strike, strike, Tb - Tf, snap.iv, "call").price;
  const maxProfit = Math.max(1, (backAtFront - debitPer) * 100);
  const band = 0.9 * snap.price * snap.iv * Math.sqrt(Tf);
  const pop =
    probAbove(snap.price, strike - band, Tf, popVol(snap.iv)) -
    probAbove(snap.price, strike + band, Tf, popVol(snap.iv));
  const theta = (-front.theta + back.theta) * 100;
  const vega = (-front.vega + back.vega) * 100;

  return finalize(snap, "calendar_spread", frontDte, {
    shortPutStrike: null,
    shortCallStrike: strike,
    longPutStrike: null,
    longCallStrike: strike,
    credit,
    maxProfit,
    maxLoss,
    pop,
    theta,
    vega,
    legs: [
      { side: "sell", optionType: "call", strike, expiration: frontExp, openPrice: round2(front.price), quantity: 1 },
      { side: "buy", optionType: "call", strike, expiration: backExp, openPrice: round2(back.price), quantity: 1 },
    ],
  });
}

// Earnings IV-crush play: short ATM fly expiring just after the report, priced
// off elevated pre-earnings IV.
export function buildEarnings(snap: Snapshot): StrategyQuote | null {
  if (snap.earningsInDays === null) return null;
  const dte = Math.max(7, snap.earningsInDays + 3);
  return buildIronFly(snap, {
    dte,
    ivOverride: snap.iv * 1.4,
    strategy: "earnings",
  });
}
