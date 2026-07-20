// Phase 28 — Institutional Trade Planning & Risk Studio.
//
// Scenario Comparison — the one genuinely new composition this phase
// introduces beyond pure UI orchestration, and it is deliberately NOT new
// mathematics: computeScenarioComparison() calls Phase 24's own
// computeRiskParameters() (tradingDomainModel.ts) once per named scenario,
// exactly the same pure arithmetic function routes/tradingTradePlans.ts's
// real POST /trading/trade-plans already calls when a plan is actually
// saved. Comparing scenarios "side by side" here means nothing more than
// running that same function N times over N candidate entry/stop/target
// combinations a human is still deciding between, before committing to
// one as a real, persisted Trade Plan.
//
// "Best" labels (bestRiskRewardName / tightestRiskName) are honest
// max/min identifications over fields computeRiskParameters() already
// produces — never a new composite score, never a recommendation on
// which scenario to take. A scenario missing a computable value (e.g. no
// account value supplied, so positionSize is null) is simply excluded from
// that particular comparison, never coerced to a fabricated number.
//
// Pure and I/O-free — no provider, no database. A route resolves the
// human's own inputs (and, optionally, their own account value) and calls
// this; nothing here is persisted, mirroring the Options Income Engine's
// own established Order Preview / Trade Adjustment Preview precedent
// (Sprints on lib/orderPreview.ts, lib/tradeAdjustmentPreview.ts) — a
// stateless, non-persisting preview endpoint for comparing hypothetical
// inputs before committing to one real action.

import { computeRiskParameters, type TradeDirection, type RiskParameters } from "./tradingDomainModel.js";

export interface ScenarioInput {
  name: string;
  direction: TradeDirection;
  accountRiskPct: number;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
}

export interface ScenarioResult {
  name: string;
  direction: TradeDirection;
  risk: RiskParameters;
}

export interface ScenarioComparisonResult {
  symbol: string | null;
  accountValue: number | null;
  scenarios: ScenarioResult[];
  bestRiskRewardName: string | null;
  tightestRiskName: string | null;
  summary: string;
}

export const MIN_SCENARIOS = 2;
export const MAX_SCENARIOS = 5;

function round(x: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

/**
 * Pure. Runs computeRiskParameters() once per scenario (zero new math),
 * then identifies — never scores — the scenario with the highest
 * risk/reward ratio and the scenario with the smallest computed position
 * size (the "tightest" use of capital), each honestly null when no
 * scenario has a computable value for that field.
 */
export function computeScenarioComparison(
  symbol: string | null,
  scenarios: ScenarioInput[],
  accountValue: number | null,
): ScenarioComparisonResult {
  const results: ScenarioResult[] = scenarios.map((s) => ({
    name: s.name,
    direction: s.direction,
    risk: computeRiskParameters(
      {
        accountRiskPct: s.accountRiskPct,
        entryPrice: s.entryPrice,
        stopPrice: s.stopPrice,
        targetPrice: s.targetPrice,
      },
      accountValue,
    ),
  }));

  const withRiskReward = results.filter((r) => r.risk.riskRewardRatio != null);
  const bestRiskRewardName =
    withRiskReward.length > 0
      ? withRiskReward.reduce((best, r) => ((r.risk.riskRewardRatio as number) > (best.risk.riskRewardRatio as number) ? r : best))
          .name
      : null;

  const withPositionSize = results.filter((r) => r.risk.positionSize != null);
  const tightestRiskName =
    withPositionSize.length > 0
      ? withPositionSize.reduce((tightest, r) => ((r.risk.positionSize as number) < (tightest.risk.positionSize as number) ? r : tightest))
          .name
      : null;

  const summary =
    results.length === 0
      ? "No scenarios were supplied to compare."
      : `Compared ${results.length} scenario(s)${symbol ? ` for ${symbol}` : ""}.` +
        (bestRiskRewardName ? ` Highest risk/reward: ${bestRiskRewardName}.` : " No scenario had a computable risk/reward ratio.") +
        (tightestRiskName ? ` Smallest position size: ${tightestRiskName}.` : "");

  return {
    symbol,
    accountValue: accountValue != null && accountValue > 0 ? round(accountValue) : null,
    scenarios: results,
    bestRiskRewardName,
    tightestRiskName,
    summary,
  };
}
