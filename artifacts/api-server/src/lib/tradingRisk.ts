// Phase 3, Sprint 38 — Institutional Trading Engine, Risk Management Engine
// (Core) (approved Phase 3 plan §15; see
// docs/Phase-3-Trading-Engine-Execution-Plan.md's Sprint 38 as-built note).
//
// Objective (§15): instrument-agnostic position and portfolio risk over
// `trading_positions` rows — per §0 Correction 3, built fresh on
// investingRisk.ts's (Phase 2, Sprint 29) template rather than generalizing
// risk.ts in place. `risk.ts` and `execution.ts` are never modified —
// CLAUDE.md rule 1 stays fully intact; this is a wholly new, additive
// module. `computeTradingRisk()` deliberately reuses investingRisk.ts's own
// ScoreCard/band/gradeLabel/hard-cap-override shape (a proven, already-
// tested pattern), reimplemented instrument-agnostically for single-symbol
// stop/target positions rather than portfolio target-weight holdings — the
// same "reuse the pattern, not the code" discipline applied throughout
// Engine 2. The per-position dollar-risk aggregation shape also mirrors
// risk.ts's own `computePortfolioRisk()` (perTrade/portfolioRiskUsedPct/
// violations) — read for its shape only, never imported, never modified.
//
// `computeTradingRisk()` is pure and I/O-free — the same "pure function
// over already-resolved data" discipline as every prior Engine 2 Core
// module; a future Route+UI sprint is responsible for fetching
// `trading_positions` rows and mapping them to `TradingPositionInput`.
//
// `buildTradingRiskAnalysis()` is the one place this sprint composes the
// rest of Engine 2: for every open position with a defined stop and/or
// target, it resolves Sprint 36's `buildMarketRegimeAnalysis()` once per
// distinct symbol (deduplicated, never redundantly re-resolved) and calls
// Sprint 37's pure `computeLevelProbability()` directly against the
// regime's own already-computed current price/volatility — transitively
// reusing Sprint 34's Multi-Timeframe Engine, Sprint 35's Liquidity Engine,
// Sprint 33's Market Structure Engine, and Sprint 32's MarketDataProvider,
// with zero duplicate candle fetches or probability math.
//
// SAFETY CONTRACT, unbroken from every prior module in this codebase: never
// fabricates. A position with no defined stop has an honestly `null`
// (never a fake 0) riskDollars/riskPct; an unresolvable symbol's
// probability context is honestly `null`, never guessed. Position sizing,
// stop discipline, and portfolio budget each score independently based on
// what data is actually available for that specific component.
//
// Core only this sprint — no route, no UI, no database migration
// (`trading_positions` already exists, Sprint 32). No live broker,
// Level 2, order-flow, or execution data anywhere in this module —
// advisory/analysis only, matching Engine 2's read-only invariant (§19).

import type { MarketDataProvider } from "./tradingMarketData.js";
import { buildMarketRegimeAnalysis, type TradingRegimeAnalysis, type TradingRegimeLabel } from "./tradingRegime.js";
import { computeLevelProbability } from "./tradingProbability.js";

// Approved Sprint 38 defaults, named/adjustable constants — the standard
// "risk 1-2% per trade, cap aggregate open risk around 5-6%" convention
// widely used in discretionary/systematic trading risk management, the
// same precedent as investingRisk.ts's SINGLE_SYMBOL_CONCENTRATION_CAP_PCT
// (25%) / SECTOR_CONCENTRATION_CAP_PCT (40%).
export const MAX_RISK_PER_POSITION_PCT = 2;
export const MAX_PORTFOLIO_RISK_PCT = 6;

export interface TradingPositionInput {
  id: number;
  symbol: string;
  side: "long" | "short";
  status: "open" | "closed";
  quantity: number;
  entryPrice: number;
  stopPrice: number | null;
  targetPrice: number | null;
}

export interface ScoreCard {
  score: number | null; // null only when genuinely insufficient data
  label: string;
  detail: string;
}

export interface TradingRiskComponent {
  key: string;
  label: string;
  score: number | null;
  weight: number;
  detail: string;
}

export interface PositionSizingRisk extends ScoreCard {
  largestPositionSymbol: string | null;
  largestPositionRiskPct: number | null;
  capBreached: boolean;
  unpricedSymbols: string[]; // open positions with no defined stop, so they can't be dollar-sized
}

export interface StopDisciplineRisk extends ScoreCard {
  openPositionsCount: number;
  positionsWithStop: number;
  positionsWithTarget: number;
  positionsFullyPlanned: number; // both a stop AND a target defined
  missingStopSymbols: string[];
  missingTargetSymbols: string[];
}

export interface PerPositionBudget {
  id: number;
  symbol: string;
  riskDollars: number | null;
  riskPct: number | null;
  withinLimit: boolean | null;
}

export interface PortfolioRiskBudget extends ScoreCard {
  accountValue: number | null;
  totalRiskDollars: number | null;
  totalRiskUsedPct: number | null;
  capBreached: boolean;
  perPosition: PerPositionBudget[];
}

export interface TradingRiskAnalysis {
  overall: ScoreCard;
  positionSizing: PositionSizingRisk;
  stopDiscipline: StopDisciplineRisk;
  portfolioBudget: PortfolioRiskBudget;
  components: TradingRiskComponent[];
  accountValue: number | null;
  openPositionsCount: number;
}

function round(x: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

// Banded scorer — same convention as investingRisk.ts's band(): returns the
// score of the first band whose ceiling the value is at or below.
function band(value: number, bands: [ceiling: number, score: number][], fallback: number): number {
  for (const [ceiling, score] of bands) {
    if (value <= ceiling) return score;
  }
  return fallback;
}

function gradeLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Strong";
  if (score >= 50) return "Moderate";
  if (score >= 35) return "Elevated";
  return "Poor";
}

// Dollar risk/reward magnitude — side-agnostic (a long or short position's
// stop distance is a magnitude regardless of direction), never a negative
// "risk" from an inconsistently-ordered stop/entry.
function dollarDistance(entryPrice: number, otherPrice: number, quantity: number): number {
  return Math.abs(entryPrice - otherPrice) * Math.abs(quantity);
}

function computePositionSizing(
  openPositions: TradingPositionInput[],
  accountValue: number | null,
): PositionSizingRisk {
  const unpricedSymbols = openPositions.filter((p) => p.stopPrice == null).map((p) => p.symbol);

  if (accountValue == null || accountValue <= 0) {
    return {
      score: null,
      label: "Insufficient data",
      detail: "No account value provided — position sizing cannot be scored.",
      largestPositionSymbol: null,
      largestPositionRiskPct: null,
      capBreached: false,
      unpricedSymbols,
    };
  }

  const priced = openPositions.filter((p) => p.stopPrice != null);
  if (priced.length === 0) {
    return {
      score: null,
      label: "Insufficient data",
      detail: "No open position has a defined stop — position sizing cannot be scored.",
      largestPositionSymbol: null,
      largestPositionRiskPct: null,
      capBreached: false,
      unpricedSymbols,
    };
  }

  const sized = priced
    .map((p) => ({
      symbol: p.symbol,
      riskPct: round((dollarDistance(p.entryPrice, p.stopPrice as number, p.quantity) / accountValue) * 100),
    }))
    .sort((a, b) => b.riskPct - a.riskPct);

  const top = sized[0];
  const capBreached = top.riskPct > MAX_RISK_PER_POSITION_PCT;
  const score = round(
    band(
      top.riskPct,
      [
        [MAX_RISK_PER_POSITION_PCT * 0.6, 100],
        [MAX_RISK_PER_POSITION_PCT, 75],
        [MAX_RISK_PER_POSITION_PCT * 1.5, 45],
      ],
      20,
    ),
  );

  return {
    score,
    label: gradeLabel(score),
    detail: capBreached
      ? `${top.symbol} risks ${top.riskPct}% of account value if stopped out, above the ${MAX_RISK_PER_POSITION_PCT}% single-position cap.`
      : `Largest single-position risk is ${top.symbol} at ${top.riskPct}%, within the ${MAX_RISK_PER_POSITION_PCT}% cap.`,
    largestPositionSymbol: top.symbol,
    largestPositionRiskPct: top.riskPct,
    capBreached,
    unpricedSymbols,
  };
}

function computeStopDiscipline(openPositions: TradingPositionInput[]): StopDisciplineRisk {
  if (openPositions.length === 0) {
    return {
      score: null,
      label: "Insufficient data",
      detail: "No open positions to assess stop/target discipline for.",
      openPositionsCount: 0,
      positionsWithStop: 0,
      positionsWithTarget: 0,
      positionsFullyPlanned: 0,
      missingStopSymbols: [],
      missingTargetSymbols: [],
    };
  }

  const missingStopSymbols = openPositions.filter((p) => p.stopPrice == null).map((p) => p.symbol);
  const missingTargetSymbols = openPositions.filter((p) => p.targetPrice == null).map((p) => p.symbol);
  const positionsWithStop = openPositions.length - missingStopSymbols.length;
  const positionsWithTarget = openPositions.length - missingTargetSymbols.length;
  const positionsFullyPlanned = openPositions.filter((p) => p.stopPrice != null && p.targetPrice != null).length;

  const score = round((positionsFullyPlanned / openPositions.length) * 100);

  return {
    score,
    label: gradeLabel(score),
    detail:
      positionsFullyPlanned === openPositions.length
        ? `All ${openPositions.length} open position(s) have both a stop and a target defined.`
        : `${positionsFullyPlanned} of ${openPositions.length} open position(s) have both a stop and a target defined.`,
    openPositionsCount: openPositions.length,
    positionsWithStop,
    positionsWithTarget,
    positionsFullyPlanned,
    missingStopSymbols,
    missingTargetSymbols,
  };
}

function computePortfolioBudget(
  openPositions: TradingPositionInput[],
  accountValue: number | null,
): PortfolioRiskBudget {
  const perPosition: PerPositionBudget[] = openPositions.map((p) => {
    if (p.stopPrice == null || accountValue == null || accountValue <= 0) {
      return { id: p.id, symbol: p.symbol, riskDollars: null, riskPct: null, withinLimit: null };
    }
    const riskDollars = round(dollarDistance(p.entryPrice, p.stopPrice, p.quantity));
    const riskPct = round((riskDollars / accountValue) * 100);
    return { id: p.id, symbol: p.symbol, riskDollars, riskPct, withinLimit: riskPct <= MAX_RISK_PER_POSITION_PCT };
  });

  if (accountValue == null || accountValue <= 0) {
    return {
      score: null,
      label: "Insufficient data",
      detail: "No account value provided — portfolio risk budget cannot be scored.",
      accountValue: null,
      totalRiskDollars: null,
      totalRiskUsedPct: null,
      capBreached: false,
      perPosition,
    };
  }

  const priced = perPosition.filter((p) => p.riskDollars != null);
  if (priced.length === 0) {
    return {
      score: null,
      label: "Insufficient data",
      detail: "No open position has a defined stop — portfolio risk budget cannot be scored.",
      accountValue,
      totalRiskDollars: null,
      totalRiskUsedPct: null,
      capBreached: false,
      perPosition,
    };
  }

  const totalRiskDollars = round(priced.reduce((s, p) => s + (p.riskDollars ?? 0), 0));
  const totalRiskUsedPct = round((totalRiskDollars / accountValue) * 100);
  const capBreached = totalRiskUsedPct > MAX_PORTFOLIO_RISK_PCT;

  const score = round(
    band(
      totalRiskUsedPct,
      [
        [MAX_PORTFOLIO_RISK_PCT * 0.6, 100],
        [MAX_PORTFOLIO_RISK_PCT, 75],
        [MAX_PORTFOLIO_RISK_PCT * 1.5, 45],
      ],
      20,
    ),
  );

  return {
    score,
    label: gradeLabel(score),
    detail: capBreached
      ? `Aggregate open-position risk is ${totalRiskUsedPct}% of account value, above the ${MAX_PORTFOLIO_RISK_PCT}% portfolio risk-budget cap.`
      : `Aggregate open-position risk is ${totalRiskUsedPct}% of account value, within the ${MAX_PORTFOLIO_RISK_PCT}% portfolio risk-budget cap.`,
    accountValue,
    totalRiskDollars,
    totalRiskUsedPct,
    capBreached,
    perPosition,
  };
}

// Blend weights, named/adjustable — sum to 1.0.
const POSITION_SIZING_WEIGHT = 0.35;
const STOP_DISCIPLINE_WEIGHT = 0.3;
const PORTFOLIO_BUDGET_WEIGHT = 0.35;

// Pure — never touches a provider or the database. Only "open" positions
// are considered for every component (a closed position is no longer
// carrying live risk); a caller with no accountValue still gets an honest
// stop-discipline read, since that component doesn't need dollar figures.
export function computeTradingRisk(positions: TradingPositionInput[], accountValue: number | null): TradingRiskAnalysis {
  const openPositions = positions.filter((p) => p.status === "open");

  const positionSizing = computePositionSizing(openPositions, accountValue);
  const stopDiscipline = computeStopDiscipline(openPositions);
  const portfolioBudget = computePortfolioBudget(openPositions, accountValue);

  const components: TradingRiskComponent[] = [
    { key: "position_sizing", label: "Position sizing", score: positionSizing.score, weight: POSITION_SIZING_WEIGHT, detail: positionSizing.detail },
    { key: "stop_discipline", label: "Stop/target discipline", score: stopDiscipline.score, weight: STOP_DISCIPLINE_WEIGHT, detail: stopDiscipline.detail },
    { key: "portfolio_budget", label: "Portfolio risk budget", score: portfolioBudget.score, weight: PORTFOLIO_BUDGET_WEIGHT, detail: portfolioBudget.detail },
  ];

  const scored = components.filter((c) => c.score != null);
  let overallScore: number | null = null;
  if (scored.length > 0) {
    const weightSum = scored.reduce((s, c) => s + c.weight, 0);
    overallScore = round(scored.reduce((s, c) => s + (c.score as number) * c.weight, 0) / weightSum);
    // Hard-cap override, same pattern as investingRisk.ts: breaching either
    // dollar-risk cap caps the overall score below the "Strong" band,
    // regardless of how the blend computes.
    if (positionSizing.capBreached || portfolioBudget.capBreached) overallScore = Math.min(overallScore, 60);
  }

  const capNotes: string[] = [];
  if (positionSizing.capBreached) capNotes.push("single-position risk cap breached");
  if (portfolioBudget.capBreached) capNotes.push("portfolio risk-budget cap breached");

  return {
    overall: {
      score: overallScore,
      label: overallScore == null ? "Insufficient data" : gradeLabel(overallScore),
      detail:
        overallScore == null
          ? "Not enough open, stop-defined positions to score trading risk yet."
          : `Composite of position sizing, stop/target discipline, and portfolio risk budget${capNotes.length > 0 ? ` — ${capNotes.join(", ")}` : ""}.`,
    },
    positionSizing,
    stopDiscipline,
    portfolioBudget,
    components,
    accountValue: accountValue != null && accountValue > 0 ? accountValue : null,
    openPositionsCount: openPositions.length,
  };
}

export interface PositionProbabilityContext {
  positionId: number;
  symbol: string;
  daysAhead: number;
  regimeLabel: TradingRegimeLabel | null;
  stopTouchProbability: number | null;
  targetTouchProbability: number | null;
}

export interface TradingRiskAnalysisWithContext extends TradingRiskAnalysis {
  positionContexts: PositionProbabilityContext[];
}

export const DEFAULT_RISK_PROBABILITY_HORIZON_DAYS = 20;

function buildPositionContext(
  position: TradingPositionInput,
  regime: TradingRegimeAnalysis | null,
  daysAhead: number,
): PositionProbabilityContext {
  if (!regime) {
    return {
      positionId: position.id,
      symbol: position.symbol,
      daysAhead,
      regimeLabel: null,
      stopTouchProbability: null,
      targetTouchProbability: null,
    };
  }
  const currentPrice = regime.liquidity.currentPrice;
  const volatilityAnnualizedPct = regime.volatilityAnnualizedPct;
  const stopTouchProbability =
    position.stopPrice != null
      ? (computeLevelProbability(currentPrice, position.stopPrice, daysAhead, volatilityAnnualizedPct)?.probabilityOfTouch ?? null)
      : null;
  const targetTouchProbability =
    position.targetPrice != null
      ? (computeLevelProbability(currentPrice, position.targetPrice, daysAhead, volatilityAnnualizedPct)?.probabilityOfTouch ?? null)
      : null;

  return {
    positionId: position.id,
    symbol: position.symbol,
    daysAhead,
    regimeLabel: regime.regimeLabel,
    stopTouchProbability,
    targetTouchProbability,
  };
}

// Orchestration helper: computeTradingRisk()'s deterministic scoring, plus
// an honest, optional probability context per open position with a defined
// stop/target — resolved via Sprint 36's buildMarketRegimeAnalysis(),
// deduplicated per distinct symbol so two positions in the same symbol
// never trigger two redundant regime resolutions. Never fabricates a
// probability for an unresolvable symbol (context fields honestly null).
export async function buildTradingRiskAnalysis(
  positions: TradingPositionInput[],
  accountValue: number | null,
  provider: MarketDataProvider,
  daysAhead: number = DEFAULT_RISK_PROBABILITY_HORIZON_DAYS,
): Promise<TradingRiskAnalysisWithContext> {
  const analysis = computeTradingRisk(positions, accountValue);
  const openPositions = positions.filter((p) => p.status === "open" && (p.stopPrice != null || p.targetPrice != null));

  const regimeCache = new Map<string, TradingRegimeAnalysis | null>();
  const positionContexts: PositionProbabilityContext[] = [];
  for (const position of openPositions) {
    let regime = regimeCache.get(position.symbol);
    if (regime === undefined) {
      regime = await buildMarketRegimeAnalysis(position.symbol, provider);
      regimeCache.set(position.symbol, regime);
    }
    positionContexts.push(buildPositionContext(position, regime, daysAhead));
  }

  return { ...analysis, positionContexts };
}
