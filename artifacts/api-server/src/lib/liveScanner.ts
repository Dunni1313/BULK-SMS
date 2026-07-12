// Live scanner: builds Iron Condors, Iron Flies, and Calendar Spreads from a
// provider's option chain, rejecting stale/illiquid/malformed contracts before
// scoring. Both mock and live modes flow through this pipeline so the market-data
// health counters are meaningful regardless of the active data source. Scoring
// reuses the tuned Ravish Score so live results rank consistently with the engine.

import {
  ravishScore,
  scoreTier,
  probAbove,
  popVol,
  strikeStep,
  type StrategyQuote,
  type QuoteLeg,
} from "./optionsMath.js";
import { getEventRiskForSymbol } from "./eventRisk.js";
import { checkContract, spreadPct, type RejectKind } from "./marketData.js";
import { selectProvider, type ProviderSettings } from "./providers/index.js";
import type { OptionChainData, OptionQuote, ProviderName } from "./providers/types.js";

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function dteOf(expiration: string, now = Date.now()): number {
  return Math.max(1, Math.round((Date.parse(expiration) - now) / 86_400_000));
}

// ─── Contract selection ──────────────────────────────────────────────────────
function expirations(chain: OptionChainData): string[] {
  return [...new Set(chain.contracts.map((c) => c.expiration))].sort();
}

function nearestExpiration(chain: OptionChainData, targetDte: number): string | null {
  const exps = expirations(chain);
  if (exps.length === 0) return null;
  let best = exps[0];
  let bestDiff = Infinity;
  for (const e of exps) {
    const diff = Math.abs(dteOf(e) - targetDte);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = e;
    }
  }
  return best;
}

function byDelta(
  chain: OptionChainData,
  type: "call" | "put",
  expiration: string,
  targetDelta: number,
): OptionQuote | null {
  let best: OptionQuote | null = null;
  let bestDiff = Infinity;
  for (const c of chain.contracts) {
    if (c.type !== type || c.expiration !== expiration) continue;
    const diff = Math.abs(Math.abs(c.delta) - Math.abs(targetDelta));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = c;
    }
  }
  return best;
}

function byStrike(
  chain: OptionChainData,
  type: "call" | "put",
  expiration: string,
  strike: number,
): OptionQuote | null {
  let best: OptionQuote | null = null;
  let bestDiff = Infinity;
  for (const c of chain.contracts) {
    if (c.type !== type || c.expiration !== expiration) continue;
    const diff = Math.abs(c.strike - strike);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = c;
    }
  }
  return best;
}

// ─── Build result ────────────────────────────────────────────────────────────
export interface BuildResult {
  quote: StrategyQuote | null; // null when legs are missing/rejected
  contractsExamined: number;
  liquidityRejected: number; // legs failing data/freshness/liquidity gates
}

function legToQuoteLeg(c: OptionQuote, side: "buy" | "sell"): QuoteLeg {
  return {
    side,
    optionType: c.type,
    strike: c.strike,
    expiration: c.expiration,
    openPrice: round2(c.mid),
    quantity: 1,
  };
}

// Validate every selected leg; returns the rejection kind if any leg fails.
function gateLegs(legs: OptionQuote[], now: number): RejectKind | null {
  for (const c of legs) {
    const r = checkContract(c, now);
    if (!r.ok) return r.kind;
  }
  return null;
}

interface FinalizeInput {
  symbol: string;
  strategy: string;
  expiration: string;
  dte: number;
  shortPutStrike: number | null;
  shortCallStrike: number | null;
  longPutStrike: number | null;
  longCallStrike: number | null;
  credit: number;
  maxProfit: number;
  maxLoss: number;
  pop: number; // fraction 0-1
  theta: number;
  vega: number;
  ivRank: number;
  liquidityScore: number;
  legs: QuoteLeg[];
}

// Scores a built strategy and applies risk-only rejection (liquidity/freshness are
// already enforced per-contract before this runs).
function finalizeLive(input: FinalizeInput): StrategyQuote {
  const popFrac = clamp(input.pop, 0, 1);
  const ev = popFrac * input.maxProfit - (1 - popFrac) * input.maxLoss;
  const score = ravishScore({
    strategy: input.strategy,
    pop: popFrac * 100,
    ev,
    maxProfit: input.maxProfit,
    maxLoss: input.maxLoss,
    dailyTheta: input.theta,
    dte: input.dte,
    liquidityScore: input.liquidityScore,
    ivRank: input.ivRank,
  });
  let rejected = false;
  let rejectReason: string | null = null;
  if (input.maxLoss <= 0) {
    rejected = true;
    rejectReason = "Invalid risk profile";
  } else if (ev <= 0) {
    rejected = true;
    rejectReason = "Negative expected value";
  }
  return {
    symbol: input.symbol,
    strategy: input.strategy,
    expiration: input.expiration,
    daysToExpiry: input.dte,
    shortPutStrike: input.shortPutStrike,
    shortCallStrike: input.shortCallStrike,
    longPutStrike: input.longPutStrike,
    longCallStrike: input.longCallStrike,
    credit: round2(input.credit),
    maxProfit: round2(input.maxProfit),
    maxLoss: round2(input.maxLoss),
    pop: Math.round(popFrac * 1000) / 10,
    ev: round2(ev),
    theta: round2(input.theta),
    vega: round2(input.vega),
    ivRank: input.ivRank,
    liquidityScore: input.liquidityScore,
    returnOnCapital: Math.round((input.maxProfit / Math.max(input.maxLoss, 1)) * 1000) / 10,
    ravishScore: score.total,
    ravishTier: score.tier,
    legs: input.legs,
    rejected,
    rejectReason,
    // Defaults; the actual event-risk penalty is applied in runScan where `now` and
    // the eventRiskEnabled setting are available.
    eventRiskLevel: "none",
    eventRiskPenalty: 0,
    eventRiskEvents: [],
  };
}

// Liquidity proxy (0-100) derived from the worst spread among the selected legs.
function liquidityScoreFromLegs(legs: OptionQuote[]): number {
  let worst = 0;
  for (const c of legs) worst = Math.max(worst, spreadPct(c));
  return Math.round(clamp(100 - worst * 600, 50, 99));
}

// ─── Strategy builders ───────────────────────────────────────────────────────
export function buildIronCondorFromChain(
  chain: OptionChainData,
  opts: { shortDelta?: number; dte?: number } = {},
  now = Date.now(),
): BuildResult {
  const shortDelta = opts.shortDelta ?? 0.2;
  const dte = opts.dte ?? 45;
  const exp = nearestExpiration(chain, dte);
  if (!exp) return { quote: null, contractsExamined: 0, liquidityRejected: 0 };
  const step = strikeStep(chain.underlyingPrice);

  const shortPut = byDelta(chain, "put", exp, shortDelta);
  const shortCall = byDelta(chain, "call", exp, shortDelta);
  if (!shortPut || !shortCall) return { quote: null, contractsExamined: 0, liquidityRejected: 0 };
  const wing = Math.max(step, Math.round((chain.underlyingPrice * 0.025) / step) * step);
  const longPut = byStrike(chain, "put", exp, shortPut.strike - wing);
  const longCall = byStrike(chain, "call", exp, shortCall.strike + wing);
  if (!longPut || !longCall) return { quote: null, contractsExamined: 2, liquidityRejected: 0 };

  const legs = [shortPut, longPut, shortCall, longCall];
  const reject = gateLegs(legs, now);
  if (reject) return { quote: null, contractsExamined: legs.length, liquidityRejected: 1 };

  const creditPer = shortPut.mid + shortCall.mid - longPut.mid - longCall.mid;
  const putWidth = shortPut.strike - longPut.strike;
  const callWidth = longCall.strike - shortCall.strike;
  const maxLoss = (Math.max(putWidth, callWidth) - creditPer) * 100;
  const T = dteOf(exp, now) / 365;
  const iv = chain.iv30 || shortPut.iv;
  const beLow = shortPut.strike - creditPer;
  const beHigh = shortCall.strike + creditPer;
  const pop =
    probAbove(chain.underlyingPrice, beLow, T, popVol(iv)) -
    probAbove(chain.underlyingPrice, beHigh, T, popVol(iv));
  const theta = (-shortPut.theta - shortCall.theta + longPut.theta + longCall.theta) * 100;
  const vega = (-shortPut.vega - shortCall.vega + longPut.vega + longCall.vega) * 100;

  const quote = finalizeLive({
    symbol: chain.symbol,
    strategy: "iron_condor",
    expiration: exp,
    dte: dteOf(exp, now),
    shortPutStrike: shortPut.strike,
    shortCallStrike: shortCall.strike,
    longPutStrike: longPut.strike,
    longCallStrike: longCall.strike,
    credit: creditPer * 100,
    maxProfit: creditPer * 100,
    maxLoss,
    pop,
    theta,
    vega,
    ivRank: chain.ivRank,
    liquidityScore: liquidityScoreFromLegs(legs),
    legs: [
      legToQuoteLeg(shortPut, "sell"),
      legToQuoteLeg(longPut, "buy"),
      legToQuoteLeg(shortCall, "sell"),
      legToQuoteLeg(longCall, "buy"),
    ],
  });
  return { quote, contractsExamined: legs.length, liquidityRejected: 0 };
}

export function buildIronFlyFromChain(
  chain: OptionChainData,
  opts: { dte?: number; strategy?: string } = {},
  now = Date.now(),
): BuildResult {
  const dte = opts.dte ?? 45;
  const strategy = opts.strategy ?? "iron_fly";
  const exp = nearestExpiration(chain, dte);
  if (!exp) return { quote: null, contractsExamined: 0, liquidityRejected: 0 };
  const step = strikeStep(chain.underlyingPrice);
  const k0 = Math.round(chain.underlyingPrice / step) * step;
  const wing = Math.max(2 * step, Math.round((chain.underlyingPrice * 0.05) / step) * step);

  const shortPut = byStrike(chain, "put", exp, k0);
  const shortCall = byStrike(chain, "call", exp, k0);
  const longPut = byStrike(chain, "put", exp, k0 - wing);
  const longCall = byStrike(chain, "call", exp, k0 + wing);
  if (!shortPut || !shortCall || !longPut || !longCall) {
    return { quote: null, contractsExamined: 0, liquidityRejected: 0 };
  }
  const legs = [shortPut, longPut, shortCall, longCall];
  const reject = gateLegs(legs, now);
  if (reject) return { quote: null, contractsExamined: legs.length, liquidityRejected: 1 };

  const creditPer = shortPut.mid + shortCall.mid - longPut.mid - longCall.mid;
  const maxLoss = (wing - creditPer) * 100;
  const T = dteOf(exp, now) / 365;
  const iv = chain.iv30 || shortPut.iv;
  const beLow = k0 - creditPer;
  const beHigh = k0 + creditPer;
  const pop =
    probAbove(chain.underlyingPrice, beLow, T, popVol(iv)) -
    probAbove(chain.underlyingPrice, beHigh, T, popVol(iv));
  const theta = (-shortPut.theta - shortCall.theta + longPut.theta + longCall.theta) * 100;
  const vega = (-shortPut.vega - shortCall.vega + longPut.vega + longCall.vega) * 100;

  const quote = finalizeLive({
    symbol: chain.symbol,
    strategy,
    expiration: exp,
    dte: dteOf(exp, now),
    shortPutStrike: k0,
    shortCallStrike: k0,
    longPutStrike: k0 - wing,
    longCallStrike: k0 + wing,
    credit: creditPer * 100,
    maxProfit: creditPer * 100,
    maxLoss,
    pop,
    theta,
    vega,
    ivRank: chain.ivRank,
    liquidityScore: liquidityScoreFromLegs(legs),
    legs: [
      legToQuoteLeg(shortPut, "sell"),
      legToQuoteLeg(longPut, "buy"),
      legToQuoteLeg(shortCall, "sell"),
      legToQuoteLeg(longCall, "buy"),
    ],
  });
  return { quote, contractsExamined: legs.length, liquidityRejected: 0 };
}

export function buildCalendarFromChain(
  chain: OptionChainData,
  opts: { delta?: number; frontDte?: number; backDte?: number } = {},
  now = Date.now(),
): BuildResult {
  const delta = opts.delta ?? 0.27;
  const frontDte = opts.frontDte ?? 30;
  const backDte = opts.backDte ?? 60;
  const frontExp = nearestExpiration(chain, frontDte);
  const backExp = nearestExpiration(chain, backDte);
  if (!frontExp || !backExp || frontExp === backExp) {
    return { quote: null, contractsExamined: 0, liquidityRejected: 0 };
  }
  const step = strikeStep(chain.underlyingPrice);
  const anchor = byDelta(chain, "call", backExp, delta);
  if (!anchor) return { quote: null, contractsExamined: 0, liquidityRejected: 0 };
  const strike = Math.round(anchor.strike / step) * step;
  const front = byStrike(chain, "call", frontExp, strike);
  const back = byStrike(chain, "call", backExp, strike);
  if (!front || !back) return { quote: null, contractsExamined: 0, liquidityRejected: 0 };

  const legs = [front, back];
  const reject = gateLegs(legs, now);
  if (reject) return { quote: null, contractsExamined: legs.length, liquidityRejected: 1 };

  const debitPer = back.mid - front.mid;
  const maxLoss = debitPer * 100;
  const Tf = dteOf(frontExp, now) / 365;
  const iv = chain.iv30 || front.iv;
  // Approximate value of the back leg when the front expires at-the-money.
  const sqrtTb = Math.sqrt(Math.max(dteOf(backExp, now) - dteOf(frontExp, now), 1) / 365);
  const backAtFront = 0.4 * chain.underlyingPrice * iv * sqrtTb;
  const maxProfit = Math.max(1, (backAtFront - debitPer) * 100);
  const band = 0.9 * chain.underlyingPrice * iv * Math.sqrt(Tf);
  const pop =
    probAbove(chain.underlyingPrice, strike - band, Tf, popVol(iv)) -
    probAbove(chain.underlyingPrice, strike + band, Tf, popVol(iv));
  const theta = (-front.theta + back.theta) * 100;
  const vega = (-front.vega + back.vega) * 100;

  const quote = finalizeLive({
    symbol: chain.symbol,
    strategy: "calendar_spread",
    expiration: frontExp,
    dte: dteOf(frontExp, now),
    shortPutStrike: null,
    shortCallStrike: strike,
    longPutStrike: null,
    longCallStrike: strike,
    credit: -debitPer * 100,
    maxProfit,
    maxLoss,
    pop,
    theta,
    vega,
    ivRank: chain.ivRank,
    liquidityScore: liquidityScoreFromLegs(legs),
    legs: [legToQuoteLeg(front, "sell"), legToQuoteLeg(back, "buy")],
  });
  return { quote, contractsExamined: legs.length, liquidityRejected: 0 };
}

// ─── Scan orchestration ──────────────────────────────────────────────────────
export interface ScanHealth {
  provider: ProviderName;
  requestedProvider: ProviderName;
  mode: "mock" | "live";
  connected: boolean;
  reason: string;
  lastChainUpdate: string | null;
  symbolsScanned: number;
  contractsScanned: number;
  rejectedByLiquidity: number;
  rejectedByRisk: number;
  positiveEvFound: number;
  scannedAt: string;
}

export interface ScanOutcome {
  quotes: StrategyQuote[]; // accepted (positive-EV, non-rejected) strategies
  health: ScanHealth;
}

export async function runScan(
  settings: ProviderSettings & {
    shortDelta?: number;
    defaultDte?: number;
    eventRiskEnabled?: boolean;
  },
  symbols: string[],
  now = Date.now(),
): Promise<ScanOutcome> {
  const selection = selectProvider(settings);
  const shortDelta = settings.shortDelta ?? 0.2;
  const dte = settings.defaultDte ?? 45;
  const eventRiskEnabled = settings.eventRiskEnabled !== false;

  const quotes: StrategyQuote[] = [];
  let contractsScanned = 0;
  let rejectedByLiquidity = 0;
  let rejectedByRisk = 0;
  let symbolsScanned = 0;
  let lastChainUpdate: string | null = null;

  for (const symbol of symbols) {
    const chain = await selection.provider.getChain(symbol, { dteHints: [30, dte, 60] });
    if (!chain) continue;
    symbolsScanned += 1;
    if (!lastChainUpdate || chain.quoteTime > lastChainUpdate) lastChainUpdate = chain.quoteTime;

    const builds: BuildResult[] = [
      buildIronCondorFromChain(chain, { shortDelta, dte }, now),
      buildIronFlyFromChain(chain, { dte }, now),
      buildCalendarFromChain(chain, {}, now),
    ];
    if (chain.earningsDate) {
      const eDte = clamp(dteOf(chain.earningsDate, now) + 3, 7, 60);
      builds.push(buildIronFlyFromChain(chain, { dte: eDte, strategy: "earnings" }, now));
    }

    for (const b of builds) {
      contractsScanned += b.contractsExamined;
      rejectedByLiquidity += b.liquidityRejected;
      if (!b.quote) continue;
      if (b.quote.rejected) {
        rejectedByRisk += 1;
        continue;
      }
      // Event Risk Filter: lower the Ravish Score (and retier) when major events
      // (earnings/FOMC/CPI/jobs/dividends) fall inside the trade's window.
      const er = getEventRiskForSymbol(
        b.quote.symbol,
        b.quote.strategy,
        b.quote.expiration,
        now,
        eventRiskEnabled,
      );
      if (er.penalty > 0) {
        b.quote.ravishScore = Math.max(0, Math.round((b.quote.ravishScore - er.penalty) * 10) / 10);
        b.quote.ravishTier = scoreTier(b.quote.ravishScore);
      }
      b.quote.eventRiskLevel = er.level;
      b.quote.eventRiskPenalty = er.penalty;
      b.quote.eventRiskEvents = er.events;
      quotes.push(b.quote);
    }
  }

  const health: ScanHealth = {
    provider: selection.active,
    requestedProvider: selection.requested,
    mode: selection.mode,
    connected: selection.connected,
    reason: selection.reason,
    lastChainUpdate,
    symbolsScanned,
    contractsScanned,
    rejectedByLiquidity,
    rejectedByRisk,
    positiveEvFound: quotes.length,
    scannedAt: new Date(now).toISOString(),
  };

  return { quotes, health };
}
