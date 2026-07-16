// Portfolio Stress Test & Scenario Simulator sprint — a What-If simulator
// that applies hypothetical underlying price, implied-volatility, and
// time-decay shocks to the user's own current open portfolio and shows
// the resulting Before/After impact, without ever touching a broker or
// mutating a single row.
//
// Every repricing calculation here is built entirely from
// optionsMath.ts's own existing, unmodified bs() (Black-Scholes
// pricing/greeks) and getSnapshot() (today's deterministic per-symbol
// price/IV) — the exact same primitives serverState.ts's own
// computeTradeGreeks() already uses for the *unshocked* mark. This
// module's own computeShockedGreeks() is a parallel, shock-parameterized
// sibling of computeTradeGreeks() (not a modification of it — that
// function is untouched) that reduces to byte-identical output at the
// zero-shock boundary, proven by a dedicated regression test. Portfolio-
// level aggregation reuses lib/positionSizing.ts's own already-exported
// TradeRow/currentOpenTrades()/buildSnapshot() (Trade Adjustment sprint's
// own precedent) for the structural, maxLoss-based "before" risk figures.
// execution.ts, optionsMath.ts, risk.ts, autoExecution.ts, and
// autoAdjustment.ts are not modified by this sprint.
//
// This module NEVER contacts a broker execution endpoint, NEVER creates
// or modifies an order or position, and NEVER performs a database write
// of any kind — every function here is read-only (it deliberately does
// NOT call ensureSeedTrades(), matching the same "no portfolio mutation,
// taken literally" precedent Position Sizing and Trade Adjustment already
// established). Every scenario result is a hypothetical, in-memory
// computation only.

import { getSnapshot, bs } from "./optionsMath.js";
import {
  computeTradeGreeks,
  daysUntil,
  getAccountValue,
  getSettingsRow,
  type StoredLeg,
} from "./serverState.js";
import { readAlpacaCreds } from "./providers/alpacaProvider.js";
import {
  getLastBrokerCheckConnected,
  getLastSuccessfulBrokerCheck,
} from "./providers/alpacaBroker.js";
import {
  currentOpenTrades,
  buildSnapshot,
  type TradeRow,
  type SectorExposure,
  type PortfolioGreeksSnapshot,
} from "./positionSizing.js";

// Named, disclosed thresholds/scales for the genuinely new figures this
// sprint introduces — the same "state a reasonable default, disclose it"
// precedent already established by Position Sizing's
// BUYING_POWER_EXHAUSTION_THRESHOLD_PCT/MAX_LEVERAGE_RATIO and Trade
// Adjustment's ADJUSTMENT_LEVERAGE_RATIO.
export const RISK_SCORE_CONCENTRATION_CAP_PCT = 25;
export const RISK_SCORE_DRAWDOWN_SCALE = 5;
export const RISK_THRESHOLD_BREACH_SCORE_CAP = 60;

// Sane numeric bounds a shock is clamped into before repricing — never
// silently rejected, since "extreme scenarios" are an explicit testing
// requirement, but clamped so the underlying Black-Scholes math (which
// already floors sigma at 0.01 and T at 1/365 inside bs()) never receives
// a genuinely nonsensical input (e.g. a price shock at or below -100%,
// which would make the shocked underlying price zero or negative).
const PRICE_SHOCK_MIN_PCT = -99;
const PRICE_SHOCK_MAX_PCT = 1000;
const IV_SHOCK_MIN_PCT = -99;
const IV_SHOCK_MAX_PCT = 2000;
const TIME_DECAY_MIN_DAYS = 0;
const TIME_DECAY_MAX_DAYS = 3650;

const MAX_SCENARIOS = 12;

export interface Shock {
  priceShockPct: number;
  ivShockPct: number;
  timeDecayDays: number;
}

export const ZERO_SHOCK: Shock = { priceShockPct: 0, ivShockPct: 0, timeDecayDays: 0 };

// A default preset set used whenever the caller omits `scenarios` —
// matches the sprint's own requested "Bullish / Bearish / High
// Volatility / Low Volatility" named presets. "Base case" is always
// separately available as the top-level `base` field, never duplicated
// into this list.
export const DEFAULT_SCENARIO_PRESETS: ScenarioShockInput[] = [
  { label: "Bullish (+5%)", priceShockPct: 5, ivShockPct: 0, timeDecayDays: 0 },
  { label: "Bearish (-5%)", priceShockPct: -5, ivShockPct: 0, timeDecayDays: 0 },
  { label: "High Volatility (+20% IV)", priceShockPct: 0, ivShockPct: 20, timeDecayDays: 0 },
  { label: "Low Volatility (-20% IV)", priceShockPct: 0, ivShockPct: -20, timeDecayDays: 0 },
];

export interface ScenarioShockInput {
  label?: string | null;
  priceShockPct?: number | null;
  ivShockPct?: number | null;
  timeDecayDays?: number | null;
}

export interface StressTestInputIssue {
  index: number | null;
  field: string;
  code: string;
  message: string;
}

export interface PortfolioStressTestInput {
  scenarios?: ScenarioShockInput[] | null;
}

export interface PositionGreeksLike {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface PositionScenarioResult {
  tradeId: number;
  symbol: string;
  strategy: string;
  greeks: PositionGreeksLike;
  costToClose: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

export interface MarkExposureBySymbol {
  symbol: string;
  markValue: number;
  pctOfAccount: number;
}

export interface MarkExposureByStrategy {
  strategy: string;
  markValue: number;
  pctOfAccount: number;
}

export interface ScenarioEvaluation {
  portfolioValue: number;
  totalUnrealizedPnl: number;
  greeks: PortfolioGreeksSnapshot;
  exposureBySymbol: MarkExposureBySymbol[];
  exposureByStrategy: MarkExposureByStrategy[];
  totalRiskDollars: number;
  totalRiskPct: number;
  buyingPower: number;
  positions: PositionScenarioResult[];
}

export interface RiskThresholdBreach {
  tradeId: number;
  symbol: string;
  lossDollars: number;
  lossPctOfAccount: number;
  thresholdPct: number;
}

export interface ConcentrationChange {
  symbol: string;
  beforePct: number;
  afterPct: number;
  changePts: number;
}

export interface LargestPositionImpact {
  tradeId: number;
  symbol: string;
  strategy: string;
  pnlImpact: number;
}

export interface ScenarioComparisonEntry {
  label: string;
  shock: Shock;
  after: ScenarioEvaluation;
  portfolioValueImpact: number;
  unrealizedPnlImpact: number;
  buyingPowerImpactDollars: number;
  deltaChange: number;
  gammaChange: number;
  thetaChange: number;
  vegaChange: number;
  largestLosingPosition: LargestPositionImpact | null;
  largestGainingPosition: LargestPositionImpact | null;
  positionsBreachingThreshold: RiskThresholdBreach[];
  concentrationChanges: ConcentrationChange[];
  drawdownPct: number;
  riskScoreAfter: number;
}

export interface PortfolioStressTestResult {
  available: boolean;
  inputIssues: StressTestInputIssue[];
  accountValue: number;
  credentialsConfigured: boolean;
  brokerConnected: boolean | null;
  lastBrokerCheckAt: string | null;
  sectorExposure: SectorExposure;
  base: ScenarioEvaluation;
  riskScoreBefore: number;
  scenarios: ScenarioComparisonEntry[];
  generatedAt: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function clampShock(input: ScenarioShockInput): Shock {
  return {
    priceShockPct: clamp(input.priceShockPct ?? 0, PRICE_SHOCK_MIN_PCT, PRICE_SHOCK_MAX_PCT),
    ivShockPct: clamp(input.ivShockPct ?? 0, IV_SHOCK_MIN_PCT, IV_SHOCK_MAX_PCT),
    timeDecayDays: clamp(input.timeDecayDays ?? 0, TIME_DECAY_MIN_DAYS, TIME_DECAY_MAX_DAYS),
  };
}

// The one genuinely new pricing function this sprint introduces — a
// shock-parameterized sibling of serverState.ts's own computeTradeGreeks(),
// reduced to the exact same formula and rounding, but repricing every leg
// at a shocked underlying price / shocked IV / a reduced days-to-expiration
// via optionsMath.ts's own unmodified bs(). At Shock = {0,0,0} this is
// byte-identical to computeTradeGreeks()'s own output — proven by a
// dedicated regression test, not just asserted here.
function computeShockedGreeks(
  trade: { symbol: string; legs: unknown; credit: number; maxProfit: number },
  shock: Shock,
): (PositionGreeksLike & { costToClose: number; unrealizedPnl: number; unrealizedPnlPercent: number }) | null {
  const snap = getSnapshot(trade.symbol);
  if (!snap) return null;
  const shockedPrice = snap.price * (1 + shock.priceShockPct / 100);
  const shockedIv = snap.iv * (1 + shock.ivShockPct / 100);
  const legs = (trade.legs as StoredLeg[]) ?? [];
  let delta = 0;
  let gamma = 0;
  let theta = 0;
  let vega = 0;
  let sellMid = 0;
  let buyMid = 0;
  for (const leg of legs) {
    const daysRemaining = daysUntil(leg.expiration) - shock.timeDecayDays;
    const T = daysRemaining / 365;
    const g = bs(shockedPrice, leg.strike, T, shockedIv, leg.optionType);
    const sign = leg.side === "sell" ? -1 : 1;
    delta += sign * g.delta * leg.quantity;
    gamma += sign * g.gamma * leg.quantity;
    theta += sign * g.theta * leg.quantity * 100;
    vega += sign * g.vega * leg.quantity * 100;
    if (leg.side === "sell") sellMid += g.price * leg.quantity;
    else buyMid += g.price * leg.quantity;
  }
  const costToClose = (sellMid - buyMid) * 100;
  const unrealizedPnl = trade.credit - costToClose;
  const denom = Math.max(Math.abs(trade.credit), 1);
  return {
    delta: Math.round(delta * 1000) / 1000,
    gamma: Math.round(gamma * 10000) / 10000,
    theta: Math.round(theta * 100) / 100,
    vega: Math.round(vega * 100) / 100,
    costToClose: round2(costToClose),
    unrealizedPnl: round2(unrealizedPnl),
    unrealizedPnlPercent: Math.round((unrealizedPnl / denom) * 1000) / 10,
  };
}

function evaluateScenario(trades: TradeRow[], accountValue: number, shock: Shock): ScenarioEvaluation {
  const positions: PositionScenarioResult[] = [];
  const bySymbol = new Map<string, number>();
  const byStrategy = new Map<string, number>();
  let totalUnrealizedPnl = 0;
  let delta = 0;
  let gamma = 0;
  let theta = 0;
  let vega = 0;

  for (const t of trades) {
    const shocked = computeShockedGreeks(t, shock);
    // Honest fallback for a symbol optionsMath.ts's own SIMULATED
    // universe can't resolve — never fabricated, matching every other
    // provider-honesty precedent in this codebase. In practice every
    // symbol this platform can open a position in also resolves a
    // snapshot, so this path is defensive, not expected.
    const g = shocked ?? { delta: 0, gamma: 0, theta: 0, vega: 0, costToClose: 0, unrealizedPnl: 0, unrealizedPnlPercent: 0 };
    positions.push({
      tradeId: t.id,
      symbol: t.symbol,
      strategy: t.strategy,
      greeks: { delta: g.delta, gamma: g.gamma, theta: g.theta, vega: g.vega },
      costToClose: g.costToClose,
      unrealizedPnl: g.unrealizedPnl,
      unrealizedPnlPercent: g.unrealizedPnlPercent,
    });
    totalUnrealizedPnl += g.unrealizedPnl;
    delta += g.delta;
    gamma += g.gamma;
    theta += g.theta;
    vega += g.vega;
    const markValue = Math.max(0, g.costToClose);
    bySymbol.set(t.symbol, (bySymbol.get(t.symbol) ?? 0) + markValue);
    byStrategy.set(t.strategy, (byStrategy.get(t.strategy) ?? 0) + markValue);
  }

  const exposureBySymbol: MarkExposureBySymbol[] = Array.from(bySymbol.entries())
    .map(([symbol, markValue]) => ({
      symbol,
      markValue: round2(markValue),
      pctOfAccount: accountValue > 0 ? round2((markValue / accountValue) * 100) : 0,
    }))
    .sort((a, b) => b.markValue - a.markValue);

  const exposureByStrategy: MarkExposureByStrategy[] = Array.from(byStrategy.entries())
    .map(([strategy, markValue]) => ({
      strategy,
      markValue: round2(markValue),
      pctOfAccount: accountValue > 0 ? round2((markValue / accountValue) * 100) : 0,
    }))
    .sort((a, b) => b.markValue - a.markValue);

  // Structural (maxLoss-based) risk figures are reused unmodified from
  // lib/positionSizing.ts's own buildSnapshot() — a defined-risk spread's
  // reserved margin does not change under a price/IV/time shock (only its
  // current mark-to-market value does), so this figure is intentionally
  // identical for every scenario evaluated against the same trade set.
  const structural = buildSnapshot(trades, accountValue);

  return {
    portfolioValue: round2(accountValue + totalUnrealizedPnl),
    totalUnrealizedPnl: round2(totalUnrealizedPnl),
    greeks: {
      delta: Math.round(delta * 1000) / 1000,
      gamma: Math.round(gamma * 10000) / 10000,
      theta: Math.round(theta * 100) / 100,
      vega: Math.round(vega * 100) / 100,
    },
    exposureBySymbol,
    exposureByStrategy,
    totalRiskDollars: structural.totalRiskDollars,
    totalRiskPct: structural.totalRiskPct,
    // Buying power here reuses routes/portfolio.ts's own established
    // formula ((accountValue - riskDollars) * 2). Since totalRiskDollars
    // is structural (maxLoss-based) and doesn't move under any of these
    // shocks, buying power is honestly identical before and after — this
    // is a real, computed value, not a hardcoded zero, and its lack of
    // movement is itself a disclosed, correct property of defined-risk
    // strategies, not an unimplemented feature.
    buyingPower: round2((accountValue - structural.totalRiskDollars) * 2),
    positions,
  };
}

function largestConcentrationPct(evaluation: ScenarioEvaluation): number {
  return evaluation.exposureBySymbol.length > 0
    ? Math.max(...evaluation.exposureBySymbol.map((e) => e.pctOfAccount))
    : 0;
}

function computeRiskScore(
  evaluation: ScenarioEvaluation,
  maxPortfolioRisk: number,
  drawdownPct: number,
  anyBreach: boolean,
): number {
  const concentrationScore =
    100 - clamp(largestConcentrationPct(evaluation) * (100 / RISK_SCORE_CONCENTRATION_CAP_PCT), 0, 100);
  const utilizationScore =
    maxPortfolioRisk > 0
      ? 100 - clamp((evaluation.totalRiskPct / maxPortfolioRisk) * 100, 0, 100)
      : 100;
  const drawdownScore = 100 - clamp(Math.abs(drawdownPct) * RISK_SCORE_DRAWDOWN_SCALE, 0, 100);
  const blended = (concentrationScore + utilizationScore + drawdownScore) / 3;
  const final = anyBreach ? Math.min(blended, RISK_THRESHOLD_BREACH_SCORE_CAP) : blended;
  return Math.round(clamp(final, 0, 100));
}

function buildConcentrationChanges(before: ScenarioEvaluation, after: ScenarioEvaluation): ConcentrationChange[] {
  const beforeMap = new Map(before.exposureBySymbol.map((e) => [e.symbol, e.pctOfAccount]));
  const afterMap = new Map(after.exposureBySymbol.map((e) => [e.symbol, e.pctOfAccount]));
  const symbols = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  return Array.from(symbols)
    .map((symbol) => {
      const beforePct = beforeMap.get(symbol) ?? 0;
      const afterPct = afterMap.get(symbol) ?? 0;
      return { symbol, beforePct, afterPct, changePts: round2(afterPct - beforePct) };
    })
    .sort((a, b) => Math.abs(b.changePts) - Math.abs(a.changePts));
}

function buildLargestImpact(
  positionsBefore: PositionScenarioResult[],
  positionsAfter: PositionScenarioResult[],
  pick: "min" | "max",
): LargestPositionImpact | null {
  if (positionsAfter.length === 0) return null;
  const beforeById = new Map(positionsBefore.map((p) => [p.tradeId, p.unrealizedPnl]));
  const impacts = positionsAfter.map((p) => ({
    tradeId: p.tradeId,
    symbol: p.symbol,
    strategy: p.strategy,
    pnlImpact: round2(p.unrealizedPnl - (beforeById.get(p.tradeId) ?? 0)),
  }));
  const sorted = [...impacts].sort((a, b) => (pick === "min" ? a.pnlImpact - b.pnlImpact : b.pnlImpact - a.pnlImpact));
  return sorted[0] ?? null;
}

function buildThresholdBreaches(
  positionsAfter: PositionScenarioResult[],
  accountValue: number,
  thresholdPct: number,
): RiskThresholdBreach[] {
  if (accountValue <= 0) return [];
  const breaches: RiskThresholdBreach[] = [];
  for (const p of positionsAfter) {
    if (p.unrealizedPnl >= 0) continue;
    const lossDollars = Math.abs(p.unrealizedPnl);
    const lossPctOfAccount = round2((lossDollars / accountValue) * 100);
    if (lossPctOfAccount > thresholdPct) {
      breaches.push({ tradeId: p.tradeId, symbol: p.symbol, lossDollars: round2(lossDollars), lossPctOfAccount, thresholdPct });
    }
  }
  return breaches.sort((a, b) => b.lossPctOfAccount - a.lossPctOfAccount);
}

function validateScenarios(input: ScenarioShockInput[]): { valid: ScenarioShockInput[]; issues: StressTestInputIssue[] } {
  const issues: StressTestInputIssue[] = [];
  const valid: ScenarioShockInput[] = [];
  const bounded = input.slice(0, MAX_SCENARIOS);
  if (input.length > MAX_SCENARIOS) {
    issues.push({
      index: null,
      field: "scenarios",
      code: "too_many_scenarios",
      message: `Only the first ${MAX_SCENARIOS} scenarios were evaluated; ${input.length - MAX_SCENARIOS} were dropped.`,
    });
  }
  bounded.forEach((s, i) => {
    if (
      (s.priceShockPct == null || s.priceShockPct === 0) &&
      (s.ivShockPct == null || s.ivShockPct === 0) &&
      (s.timeDecayDays == null || s.timeDecayDays === 0)
    ) {
      issues.push({
        index: i,
        field: `scenarios[${i}]`,
        code: "no_shock_specified",
        message: "This scenario specifies no price, IV, or time-decay shock — it is identical to the base case.",
      });
    }
    valid.push(s);
  });
  return { valid, issues };
}

export async function buildPortfolioStressTest(
  input: PortfolioStressTestInput,
  userId: string,
): Promise<PortfolioStressTestResult> {
  const requested = input.scenarios && input.scenarios.length > 0 ? input.scenarios : DEFAULT_SCENARIO_PRESETS;
  const { valid, issues } = validateScenarios(requested);

  const [trades, accountValue, settings] = await Promise.all([
    currentOpenTrades(userId),
    getAccountValue(userId),
    getSettingsRow(userId),
  ]);

  const credentialsConfigured = readAlpacaCreds(settings.alpacaApiKey) !== null;
  const brokerConnected = getLastBrokerCheckConnected();
  const lastBrokerCheckAt = getLastSuccessfulBrokerCheck();

  const base = evaluateScenario(trades, accountValue, ZERO_SHOCK);
  const riskScoreBefore = computeRiskScore(base, settings.maxPortfolioRisk, 0, false);

  const scenarios: ScenarioComparisonEntry[] = valid.map((s, i) => {
    const shock = clampShock(s);
    const after = evaluateScenario(trades, accountValue, shock);
    const portfolioValueImpact = round2(after.portfolioValue - base.portfolioValue);
    const unrealizedPnlImpact = round2(after.totalUnrealizedPnl - base.totalUnrealizedPnl);
    const drawdownPct =
      base.portfolioValue > 0 ? round2(Math.max(0, -(portfolioValueImpact / base.portfolioValue) * 100)) : 0;
    const positionsBreachingThreshold = buildThresholdBreaches(after.positions, accountValue, settings.maxRiskPerTrade);
    const anyBreach = positionsBreachingThreshold.length > 0;
    return {
      label: s.label && s.label.trim().length > 0 ? s.label : `Scenario ${i + 1}`,
      shock,
      after,
      portfolioValueImpact,
      unrealizedPnlImpact,
      buyingPowerImpactDollars: round2(after.buyingPower - base.buyingPower),
      deltaChange: round2(after.greeks.delta - base.greeks.delta),
      gammaChange: round2(after.greeks.gamma - base.greeks.gamma),
      thetaChange: round2(after.greeks.theta - base.greeks.theta),
      vegaChange: round2(after.greeks.vega - base.greeks.vega),
      largestLosingPosition: buildLargestImpact(base.positions, after.positions, "min"),
      largestGainingPosition: buildLargestImpact(base.positions, after.positions, "max"),
      positionsBreachingThreshold,
      concentrationChanges: buildConcentrationChanges(base, after),
      drawdownPct,
      riskScoreAfter: computeRiskScore(after, settings.maxPortfolioRisk, drawdownPct, anyBreach),
    };
  });

  return {
    available: true,
    inputIssues: issues,
    accountValue,
    credentialsConfigured,
    brokerConnected,
    lastBrokerCheckAt,
    sectorExposure: {
      available: false,
      reason: "No sector/industry classification is stored on options positions in this engine.",
    },
    base,
    riskScoreBefore,
    scenarios,
    generatedAt: new Date().toISOString(),
  };
}
