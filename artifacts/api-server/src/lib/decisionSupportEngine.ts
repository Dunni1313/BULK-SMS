// Phase 40 — Institutional Decision Support & Executive Insights Engine.
//
// PURE COMPOSITION LAYER. INTERPRETATION ONLY. Zero AI predictions, zero
// trade recommendations, zero buy/sell signals, zero portfolio
// optimisation, zero auto execution/hedging/rebalancing, zero market
// forecasting, zero machine learning, zero generative investment advice.
// Every figure below is either (a) reused verbatim from an already-
// shipped, already-tested engine, or (b) a thin, deterministic threshold/
// aggregation rule over those already-computed figures — never a new
// scoring model, never a probability, never a suggested action.
//
//   - lib/riskExposureEngine.ts's buildRiskExposureDashboard() (Phase 37)
//     — the Risk Summary, Capital Allocation Summary, and most of the
//     Exposure Summary are direct reads of its already-computed
//     CombinedRiskView.
//   - lib/performanceAttribution.ts's buildPerformanceDashboard() (Phase 38)
//     — the Performance Summary is a direct read of its already-computed
//     CombinedPerformanceView.
//   - lib/scenarioEngine.ts's buildScenarioDashboard() (Phase 39) — the
//     Scenario Summary is a direct read of its already-computed
//     CombinedScenarioView, and Options' own Scenario Resilience figure
//     reuses the reused What-If Stress Test engine's own already-computed
//     riskScoreAfter for the Market -10% scenario.
//   - lib/portfolioConcentration.ts's buildPortfolioConcentrationOverlay()
//     — Options' own diversificationScore, reused directly for the
//     Diversification Summary.
//   - lib/tradingLiquidity.ts's analyzeLiquidity() and
//     lib/optionsMath.ts's getSnapshot().liquidityScore (read-only, never
//     modified) — Trading's and Options' own Liquidity health dimension.
//
// Never blended across engines — see docs/Institutional-Decision-Model.md
// for the full disclosure of why every summary below keeps Investing/
// Trading/Options figures side by side rather than summing them into one
// fabricated blended net-worth or blended score, the same discipline
// every one of Phases 37-39's own Combined views already established.

import { buildRiskExposureDashboard, type RiskExposureDashboard } from "./riskExposureEngine.js";
import { buildPerformanceDashboard, type PerformanceDashboard } from "./performanceAttribution.js";
import { buildScenarioDashboard, type ScenarioDashboard } from "./scenarioEngine.js";
import { buildPortfolioConcentrationOverlay, type PortfolioConcentrationResult } from "./portfolioConcentration.js";
import { getMarketDataProvider } from "./tradingMarketData.js";
import { buildLiquidityAnalysis } from "./tradingLiquidity.js";
import { getSnapshot } from "./optionsMath.js";
import { getSettingsRow } from "./serverState.js";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function avg(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v != null);
  if (present.length === 0) return null;
  return round2(present.reduce((s, v) => s + v, 0) / present.length);
}

// ─── Named, disclosed alert thresholds ──────────────────────────────────
const SECTOR_ALLOCATION_ALERT_PCT = 30;
const STRATEGY_CONCENTRATION_ALERT_PCT = 50;
const EXPIRATION_CONCENTRATION_ALERT_PCT = 40;
const TRADING_RISK_UTILIZATION_ALERT_PCT = 70;
const OPTIONS_RISK_UTILIZATION_ALERT_PCT = 70;
const DIVERSIFICATION_CHANGE_NOTABLE_POINTS = 5;

// ─── Executive Summary ───────────────────────────────────────────────────

export interface ExecutiveSummary {
  investingPortfolioCount: number;
  investingHoldingsCount: number;
  investingMarketValue: number | null;
  tradingOpenPositionsCount: number;
  tradingAccountValue: number | null;
  optionsOpenPositionsCount: number;
  optionsPortfolioValue: number | null;
  optionsBuyingPower: number | null;
  overallHealthScore: number | null;
  alertCount: number;
  outstandingIssueCount: number;
  generatedAt: string;
  summary: string;
}

// ─── Portfolio Health Overview ──────────────────────────────────────────

export interface EnginePortfolioHealth {
  engine: "investing" | "trading" | "options";
  available: boolean;
  score: number | null;
  label: string;
  detail: string;
}

export interface PortfolioHealthOverview {
  investing: EnginePortfolioHealth;
  trading: EnginePortfolioHealth;
  options: EnginePortfolioHealth;
  overallScore: number | null;
}

function buildPortfolioHealthOverview(risk: RiskExposureDashboard): PortfolioHealthOverview {
  const investing: EnginePortfolioHealth = {
    engine: "investing",
    available: risk.investing.risk.overall.score != null,
    score: risk.investing.risk.overall.score,
    label: risk.investing.risk.overall.label,
    detail: risk.investing.risk.overall.detail,
  };
  const trading: EnginePortfolioHealth = {
    engine: "trading",
    available: risk.trading.risk.overall.score != null,
    score: risk.trading.risk.overall.score,
    label: risk.trading.risk.overall.label,
    detail: risk.trading.risk.overall.detail,
  };
  const options: EnginePortfolioHealth = {
    engine: "options",
    available: true,
    score: risk.options.dashboard.healthScore,
    label: risk.options.dashboard.overallRiskRating.label,
    detail: `Options Portfolio Health Score: ${risk.options.dashboard.healthScore}/100 (${risk.options.dashboard.overallRiskRating.label}).`,
  };
  return { investing, trading, options, overallScore: avg([investing.score, trading.score, options.score]) };
}

// ─── Risk Summary ────────────────────────────────────────────────────────
// A thin re-export of riskExposureEngine.ts's own already-computed
// CombinedRiskView, plus the 3 per-engine risk scores side by side —
// zero new risk math.

export interface RiskSummary {
  combined: RiskExposureDashboard["combined"];
  investingRiskScore: number | null;
  tradingRiskScore: number | null;
  optionsRiskScoreBaseline: number | null; // reused from the Scenario Engine's own What-If Stress Test base case
}

// ─── Performance Summary ────────────────────────────────────────────────
// A thin re-export of performanceAttribution.ts's own already-computed
// CombinedPerformanceView. Deliberately no invented 0-100 "performance
// score" — no such scoring formula exists anywhere in this codebase, so
// raw Sharpe/Sortino/return figures are shown honestly rather than
// approximated into a fabricated composite.

export type PerformanceSummary = PerformanceDashboard["combined"];

// ─── Scenario Summary ────────────────────────────────────────────────────

export interface ScenarioSummary {
  combined: ScenarioDashboard["combined"];
  worstCaseByEngine: { engine: "investing" | "trading" | "options"; scenarioLabel: string; impactDollars: number | null; impactPctOfValue: number | null }[];
}

function buildScenarioSummary(scenario: ScenarioDashboard, risk: RiskExposureDashboard): ScenarioSummary {
  const worstCaseByEngine: ScenarioSummary["worstCaseByEngine"] = [];
  const marketDown10 = scenario.combined.byEngine.filter((e) => e.scenarioKey === "market_down_10");
  const baseValueByEngine: Record<"investing" | "trading" | "options", number | null> = {
    investing: risk.investing.risk.totalMarketValue,
    trading: risk.trading.accountValue,
    options: risk.options.dashboard.portfolioValue,
  };
  for (const e of marketDown10) {
    const baseValue = baseValueByEngine[e.engine];
    const impactPctOfValue = e.available && e.impactDollars != null && baseValue != null && baseValue > 0 ? round2((e.impactDollars / baseValue) * 100) : null;
    worstCaseByEngine.push({ engine: e.engine, scenarioLabel: e.scenarioLabel, impactDollars: e.impactDollars, impactPctOfValue });
  }
  return { combined: scenario.combined, worstCaseByEngine };
}

// ─── Capital Allocation Summary / Exposure Summary ──────────────────────
// Direct reuse of riskExposureEngine.ts's own already-computed fields —
// zero new aggregation.

export interface CapitalAllocationSummary {
  capitalAllocation: RiskExposureDashboard["combined"]["capitalAllocation"];
  buyingPowerOverview: RiskExposureDashboard["combined"]["buyingPowerOverview"];
}

export interface ExposureSummary {
  sectorConcentration: RiskExposureDashboard["combined"]["sectorConcentration"];
  strategyConcentration: RiskExposureDashboard["combined"]["strategyConcentration"];
  assetAllocation: RiskExposureDashboard["combined"]["assetAllocation"];
  greeksSummary: RiskExposureDashboard["combined"]["greeksSummary"];
}

// ─── Diversification Summary ────────────────────────────────────────────

export interface EngineDiversification {
  engine: "investing" | "trading" | "options";
  available: boolean;
  score: number | null;
  detail: string;
}

export interface DiversificationSummary {
  investing: EngineDiversification;
  trading: EngineDiversification;
  options: EngineDiversification;
  correlationOverview: RiskExposureDashboard["combined"]["correlationOverview"];
  concentrationTimeline: RiskExposureDashboard["combined"]["concentrationTimeline"];
}

function buildDiversificationSummary(risk: RiskExposureDashboard, optionsConcentration: PortfolioConcentrationResult): DiversificationSummary {
  return {
    investing: {
      engine: "investing",
      available: risk.investing.risk.concentration.score != null,
      score: risk.investing.risk.concentration.score,
      detail: risk.investing.risk.concentration.detail,
    },
    trading: {
      engine: "trading",
      available: false,
      score: null,
      detail: "No concentration/diversification scoring exists for the Trading Engine in this codebase — honestly unavailable rather than approximated.",
    },
    options: {
      engine: "options",
      available: true,
      score: optionsConcentration.summary.diversificationScore,
      detail: `Options diversification score: ${optionsConcentration.summary.diversificationScore}/100 (${optionsConcentration.summary.portfolioHealthLabel}).`,
    },
    correlationOverview: risk.combined.correlationOverview,
    concentrationTimeline: risk.combined.concentrationTimeline,
  };
}

// ─── Executive Alerts (deterministic only) ──────────────────────────────
// Every alert below is a named, disclosed threshold applied to an
// already-computed figure. Never a probability, never a forecast, never a
// suggested action — purely an observation of a real, current condition.

export interface ExecutiveAlert {
  code: string;
  engine: "investing" | "trading" | "options" | "cross-engine";
  severity: "info" | "moderate" | "elevated";
  label: string;
  detail: string;
}

function buildExecutiveAlerts(risk: RiskExposureDashboard, scenario: ScenarioDashboard): ExecutiveAlert[] {
  const alerts: ExecutiveAlert[] = [];

  // Sector allocation exceeds a named threshold — Investing and Options
  // both carry sector data via riskExposureEngine's own already-tagged
  // combined.sectorConcentration.
  for (const s of risk.combined.sectorConcentration) {
    if (s.weightPct > SECTOR_ALLOCATION_ALERT_PCT) {
      alerts.push({
        code: "sector_allocation_exceeds_target",
        engine: s.engine,
        severity: s.weightPct > SECTOR_ALLOCATION_ALERT_PCT * 1.5 ? "elevated" : "moderate",
        label: `${s.sector} allocation exceeds target`,
        detail: `${s.sector} accounts for ${s.weightPct}% of ${s.engine === "investing" ? "Investing" : "Options"} allocation, above the ${SECTOR_ALLOCATION_ALERT_PCT}% threshold.`,
      });
    }
  }

  // Strategy concentration (Options) exceeds a named threshold.
  for (const s of risk.combined.strategyConcentration) {
    if (s.weightPct > STRATEGY_CONCENTRATION_ALERT_PCT) {
      alerts.push({
        code: "strategy_concentration_high",
        engine: "options",
        severity: "moderate",
        label: `Options strategy mix concentrated in ${s.label ?? s.key}`,
        detail: `${s.label ?? s.key} accounts for ${s.weightPct}% of open Options capital, above the ${STRATEGY_CONCENTRATION_ALERT_PCT}% threshold.`,
      });
    }
  }

  // Expiration concentration (Options) — the kickoff's own named example.
  const expirationBreakdown = risk.options.dashboard.expirationDistribution;
  const largestExpiration = [...expirationBreakdown].sort((a, b) => b.weightPct - a.weightPct)[0];
  if (largestExpiration && largestExpiration.weightPct > EXPIRATION_CONCENTRATION_ALERT_PCT) {
    alerts.push({
      code: "expiration_concentration_high",
      engine: "options",
      severity: "moderate",
      label: "Options exposure concentrated in one expiration",
      detail: `${largestExpiration.weightPct}% of Options capital shares the ${largestExpiration.label} expiration, above the ${EXPIRATION_CONCENTRATION_ALERT_PCT}% threshold.`,
    });
  }

  // Buying power / risk utilisation is high — the kickoff's own named
  // example. Trading via portfolioBudget.totalRiskUsedPct, Options via
  // the Portfolio Dashboard's own already-computed totalRiskPct.
  const tradingUtilization = risk.trading.risk.portfolioBudget.totalRiskUsedPct;
  if (tradingUtilization != null && tradingUtilization > TRADING_RISK_UTILIZATION_ALERT_PCT) {
    alerts.push({
      code: "buying_power_utilisation_high",
      engine: "trading",
      severity: "moderate",
      label: "Trading risk-budget utilisation is high",
      detail: `${tradingUtilization}% of the Trading risk budget is committed, above the ${TRADING_RISK_UTILIZATION_ALERT_PCT}% threshold.`,
    });
  }
  if (risk.options.dashboard.totalRiskPct > OPTIONS_RISK_UTILIZATION_ALERT_PCT) {
    alerts.push({
      code: "buying_power_utilisation_high",
      engine: "options",
      severity: "moderate",
      label: "Options buying power utilisation is high",
      detail: `${round2(risk.options.dashboard.totalRiskPct)}% of the Options account is at risk, above the ${OPTIONS_RISK_UTILIZATION_ALERT_PCT}% threshold.`,
    });
  }

  // Diversification improved/declined — the kickoff's own named example.
  // Resolved honestly from riskExposureEngine's own already-real
  // concentrationTimeline (investing risk snapshots) — never fabricated,
  // and honestly silent when fewer than 2 data points exist.
  const investingPoints = risk.combined.concentrationTimeline.filter((p) => p.source === "investing-risk-snapshot" && p.value != null);
  if (investingPoints.length >= 2) {
    const sorted = [...investingPoints].sort((a, b) => a.date.localeCompare(b.date));
    const previous = sorted[sorted.length - 2].value as number;
    const latest = sorted[sorted.length - 1].value as number;
    const delta = latest - previous;
    if (Math.abs(delta) >= DIVERSIFICATION_CHANGE_NOTABLE_POINTS) {
      alerts.push({
        code: delta > 0 ? "diversification_improved" : "diversification_declined",
        engine: "investing",
        severity: "info",
        label: delta > 0 ? "Portfolio diversification improved" : "Portfolio diversification declined",
        detail: `Investing risk score moved from ${previous} to ${latest} (${delta > 0 ? "+" : ""}${round2(delta)}) across the two most recent saved risk snapshots.`,
      });
    }
  }

  // Scenario resilience concern — a real, already-computed Market -10%
  // impact against each engine's own base value.
  for (const e of scenario.combined.byEngine) {
    if (e.scenarioKey !== "market_down_10" || !e.available || e.impactDollars == null) continue;
    const baseValue = e.engine === "investing" ? scenario.investing.baseMarketValue : e.engine === "trading" ? null : scenario.options.stressTest.base?.portfolioValue ?? null;
    if (baseValue == null || baseValue <= 0) continue;
    const impactPct = Math.abs((e.impactDollars / baseValue) * 100);
    if (impactPct > 15) {
      alerts.push({
        code: "scenario_resilience_concern",
        engine: e.engine,
        severity: impactPct > 25 ? "elevated" : "moderate",
        label: `${e.engine === "investing" ? "Investing" : e.engine === "trading" ? "Trading" : "Options"} shows elevated impact under Market -10%`,
        detail: `A Market -10% scenario would move ${e.engine} value by ${round2(impactPct)}%, based on the Scenario & Stress Testing Engine's own already-computed repricing.`,
      });
    }
  }

  return alerts;
}

// ─── Outstanding Issues ──────────────────────────────────────────────────
// A direct surfacing of already-flagged problems from existing engines —
// never a newly invented issue, never a suggested fix.

export interface OutstandingIssue {
  code: string;
  engine: "investing" | "trading" | "options";
  label: string;
  detail: string;
}

function buildOutstandingIssues(risk: RiskExposureDashboard): OutstandingIssue[] {
  const issues: OutstandingIssue[] = [];

  if (risk.investing.risk.unresolvedSymbols.length > 0) {
    issues.push({
      code: "unresolved_symbols",
      engine: "investing",
      label: "Unresolved Investing symbols",
      detail: `${risk.investing.risk.unresolvedSymbols.length} symbol(s) could not be resolved for risk scoring: ${risk.investing.risk.unresolvedSymbols.join(", ")}.`,
    });
  }
  if (risk.investing.risk.concentration.capBreached) {
    issues.push({
      code: "concentration_cap_breached",
      engine: "investing",
      label: "Investing single-symbol concentration cap breached",
      detail: risk.investing.risk.concentration.detail,
    });
  }

  if (risk.trading.risk.positionSizing.unpricedSymbols.length > 0) {
    issues.push({
      code: "unpriced_positions",
      engine: "trading",
      label: "Trading positions with no defined stop",
      detail: `${risk.trading.risk.positionSizing.unpricedSymbols.length} open position(s) have no stop price, so they cannot be dollar-sized: ${risk.trading.risk.positionSizing.unpricedSymbols.join(", ")}.`,
    });
  }
  if (risk.trading.risk.stopDiscipline.missingStopSymbols.length > 0) {
    issues.push({
      code: "missing_stop",
      engine: "trading",
      label: "Trading positions missing a stop",
      detail: `${risk.trading.risk.stopDiscipline.missingStopSymbols.length} open position(s) have no stop defined: ${risk.trading.risk.stopDiscipline.missingStopSymbols.join(", ")}.`,
    });
  }
  if (risk.trading.risk.stopDiscipline.missingTargetSymbols.length > 0) {
    issues.push({
      code: "missing_target",
      engine: "trading",
      label: "Trading positions missing a target",
      detail: `${risk.trading.risk.stopDiscipline.missingTargetSymbols.length} open position(s) have no target defined: ${risk.trading.risk.stopDiscipline.missingTargetSymbols.join(", ")}.`,
    });
  }
  if (risk.trading.risk.portfolioBudget.capBreached) {
    issues.push({
      code: "portfolio_risk_budget_breached",
      engine: "trading",
      label: "Trading portfolio risk budget breached",
      detail: risk.trading.risk.portfolioBudget.detail,
    });
  }

  for (const g of risk.options.dashboard.guidance) {
    issues.push({
      code: g.code,
      engine: "options",
      label: g.label,
      detail: g.detail,
    });
  }

  return issues;
}

// ─── Key Metrics Dashboard ───────────────────────────────────────────────
// A flat re-presentation of already-computed headline figures — zero new
// computation.

export interface KeyMetric {
  code: string;
  engine: "investing" | "trading" | "options" | "cross-engine";
  label: string;
  value: number | null;
  unit: "usd" | "pct" | "score" | "count";
}

function buildKeyMetrics(risk: RiskExposureDashboard, performance: PerformanceDashboard, health: PortfolioHealthOverview): KeyMetric[] {
  return [
    { code: "investing_market_value", engine: "investing", label: "Investing Market Value", value: risk.investing.risk.totalMarketValue, unit: "usd" },
    { code: "investing_health_score", engine: "investing", label: "Investing Portfolio Health", value: health.investing.score, unit: "score" },
    { code: "investing_unrealized_pnl", engine: "investing", label: "Investing Unrealized P&L", value: performance.investing.totalUnrealizedPnl, unit: "usd" },
    { code: "trading_account_value", engine: "trading", label: "Trading Account Value", value: risk.trading.accountValue, unit: "usd" },
    { code: "trading_health_score", engine: "trading", label: "Trading Portfolio Health", value: health.trading.score, unit: "score" },
    { code: "trading_realized_pnl", engine: "trading", label: "Trading Realized P&L", value: performance.trading.totalRealizedPnl, unit: "usd" },
    { code: "options_portfolio_value", engine: "options", label: "Options Portfolio Value", value: risk.options.dashboard.portfolioValue, unit: "usd" },
    { code: "options_health_score", engine: "options", label: "Options Portfolio Health", value: health.options.score, unit: "score" },
    { code: "options_realized_pnl", engine: "options", label: "Options Realized P&L", value: performance.options.totalRealizedPnl, unit: "usd" },
    { code: "options_buying_power", engine: "options", label: "Options Buying Power", value: risk.options.dashboard.buyingPower, unit: "usd" },
    { code: "cross_engine_overall_health", engine: "cross-engine", label: "Overall Portfolio Health", value: health.overallScore, unit: "score" },
    { code: "cross_engine_overlap_symbols", engine: "cross-engine", label: "Symbols Held Across Multiple Engines", value: risk.combined.correlationOverview.overlapSymbolCount, unit: "count" },
  ];
}

// ─── Executive Health (11-dimension scorecard) ──────────────────────────

export interface ExecutiveHealthDimension {
  code: string;
  label: string;
  available: boolean;
  score: number | null; // 0-100, ONLY when a genuine, already-existing 0-100 score is reused — null otherwise
  detail: string;
  sourceModule: string;
  includedInComposite: boolean;
}

export interface ExecutiveHealth {
  dimensions: ExecutiveHealthDimension[];
  compositeScore: number | null;
}

async function symbolLiquidityScores(symbols: string[]): Promise<number[]> {
  if (symbols.length === 0) return [];
  const provider = await getMarketDataProvider();
  const scores: number[] = [];
  for (const symbol of [...new Set(symbols)]) {
    const analysis = await buildLiquidityAnalysis(symbol, "1D", 90, provider).catch(() => null);
    if (analysis) scores.push(analysis.liquidityScore);
  }
  return scores;
}

function optionsUnderlyingLiquidityScores(symbols: string[]): number[] {
  const scores: number[] = [];
  for (const symbol of [...new Set(symbols)]) {
    const snap = getSnapshot(symbol);
    if (snap) scores.push(snap.liquidityScore);
  }
  return scores;
}

async function buildExecutiveHealth(
  risk: RiskExposureDashboard,
  performance: PerformanceDashboard,
  scenario: ScenarioDashboard,
  optionsConcentration: PortfolioConcentrationResult,
  portfolioHealth: PortfolioHealthOverview,
  tradingSymbols: string[],
  optionsSymbols: string[],
): Promise<ExecutiveHealth> {
  const [tradingLiquidity, optionsLiquidity] = await Promise.all([symbolLiquidityScores(tradingSymbols), Promise.resolve(optionsUnderlyingLiquidityScores(optionsSymbols))]);

  const marketDown10Options = scenario.options.stressTest.scenarios.find((s) => s.label === "Market -10%");

  const dimensions: ExecutiveHealthDimension[] = [
    {
      code: "portfolio_health",
      label: "Portfolio Health",
      available: portfolioHealth.overallScore != null,
      score: portfolioHealth.overallScore,
      detail: `Renormalized average of each engine's own overall health/risk score: Investing ${portfolioHealth.investing.score ?? "n/a"}, Trading ${portfolioHealth.trading.score ?? "n/a"}, Options ${portfolioHealth.options.score}.`,
      sourceModule: "investingRisk.ts / tradingRisk.ts / portfolioDashboard.ts",
      includedInComposite: true,
    },
    {
      code: "capital_utilisation",
      label: "Capital Utilisation",
      available: risk.trading.risk.portfolioBudget.totalRiskUsedPct != null || risk.options.dashboard.totalRiskPct != null,
      score: null,
      detail: `Trading risk-budget utilisation ${risk.trading.risk.portfolioBudget.totalRiskUsedPct ?? "n/a"}%, Options account-value-at-risk ${round2(risk.options.dashboard.totalRiskPct)}%. Shown as raw utilisation, not scored — high utilisation is not inherently unhealthy.`,
      sourceModule: "tradingRisk.ts — portfolioBudget.totalRiskUsedPct / portfolioDashboard.ts — totalRiskPct",
      includedInComposite: false,
    },
    {
      code: "risk_score",
      label: "Risk Score",
      available: true,
      score: avg([risk.investing.risk.overall.score, risk.trading.risk.overall.score, scenario.options.stressTest.riskScoreBefore]),
      detail: `Investing ${risk.investing.risk.overall.score ?? "n/a"}, Trading ${risk.trading.risk.overall.score ?? "n/a"}, Options (base-case stress-test safety score) ${scenario.options.stressTest.riskScoreBefore}.`,
      sourceModule: "investingRisk.ts / tradingRisk.ts — overall.score; portfolioStressTest.ts — riskScoreBefore",
      includedInComposite: true,
    },
    {
      code: "performance",
      label: "Performance",
      available: performance.trading.riskAdjusted.available || performance.options.riskAdjusted.available,
      score: null,
      detail: `No 0-100 performance-scoring formula exists in this codebase — raw figures shown honestly instead of an approximated composite. Trading Sharpe ${performance.trading.riskAdjusted.sharpeRatio ?? "n/a"}, Options Sharpe ${performance.options.riskAdjusted.sharpeRatio ?? "n/a"}.`,
      sourceModule: "performanceAttribution.ts — riskAdjusted.sharpeRatio",
      includedInComposite: false,
    },
    {
      code: "diversification",
      label: "Diversification",
      available: risk.investing.risk.concentration.score != null || true,
      score: avg([risk.investing.risk.concentration.score, optionsConcentration.summary.diversificationScore]),
      detail: `Investing ${risk.investing.risk.concentration.score ?? "n/a"}, Options ${optionsConcentration.summary.diversificationScore}. No diversification scoring exists for Trading.`,
      sourceModule: "investingRisk.ts — concentration.score; portfolioConcentration.ts — summary.diversificationScore",
      includedInComposite: true,
    },
    {
      code: "exposure",
      label: "Exposure",
      available: true,
      score: null,
      detail: `Net Greeks (Options): delta ${risk.combined.greeksSummary.delta}, gamma ${risk.combined.greeksSummary.gamma}, theta ${risk.combined.greeksSummary.theta}, vega ${risk.combined.greeksSummary.vega}. Shown as raw exposure, not scored.`,
      sourceModule: "riskExposureEngine.ts — combined.greeksSummary",
      includedInComposite: false,
    },
    {
      code: "liquidity",
      label: "Liquidity",
      available: tradingLiquidity.length > 0 || optionsLiquidity.length > 0,
      score: avg([avg(tradingLiquidity), avg(optionsLiquidity)]),
      detail: `Trading (${tradingLiquidity.length} symbol(s) scored via the Order Flow & Liquidity Engine): ${avg(tradingLiquidity) ?? "n/a"}. Options underlyings (${optionsLiquidity.length} scored): ${avg(optionsLiquidity) ?? "n/a"}. No liquidity scoring exists for Investing.`,
      sourceModule: "tradingLiquidity.ts — liquidityScore; optionsMath.ts — getSnapshot().liquidityScore",
      includedInComposite: true,
    },
    {
      code: "buying_power",
      label: "Buying Power",
      available: true,
      score: null,
      detail: `Trading account value $${risk.trading.accountValue ?? "n/a"}, Options buying power $${risk.options.dashboard.buyingPower}. Shown as raw dollar figures, not scored.`,
      sourceModule: "riskExposureEngine.ts — combined.buyingPowerOverview",
      includedInComposite: false,
    },
    {
      code: "greeks",
      label: "Greeks",
      available: true,
      score: null,
      detail: `Options net Greeks: delta ${risk.combined.greeksSummary.delta}, gamma ${risk.combined.greeksSummary.gamma}, theta ${risk.combined.greeksSummary.theta}, vega ${risk.combined.greeksSummary.vega}. No Greeks concept exists for Investing/Trading.`,
      sourceModule: "portfolioDashboard.ts — netGreeks",
      includedInComposite: false,
    },
    {
      code: "income_stability",
      label: "Income Stability",
      available: true,
      score: null,
      detail: `Options theta income — daily $${round2(performance.options.income?.theta?.daily ?? 0)}, weekly $${round2(performance.options.income?.theta?.weekly ?? 0)}, monthly $${round2(performance.options.income?.theta?.monthly ?? 0)}. Shown as raw income figures, not scored.`,
      sourceModule: "optionsIncomeAnalytics.ts — computeThetaIncome()",
      includedInComposite: false,
    },
    {
      code: "scenario_resilience",
      label: "Scenario Resilience",
      available: marketDown10Options != null,
      score: marketDown10Options ? marketDown10Options.riskScoreAfter : null,
      detail: marketDown10Options
        ? `Options portfolio safety score after a Market -10% scenario shock: ${marketDown10Options.riskScoreAfter}/100 (reused directly from the Scenario Engine's own already-computed Stress Test comparison).`
        : "Insufficient data to compute a post-shock safety score for Options.",
      sourceModule: "portfolioStressTest.ts — riskScoreAfter (via scenarioEngine.ts's own reuse)",
      includedInComposite: true,
    },
  ];

  const compositeScore = avg(dimensions.filter((d) => d.includedInComposite).map((d) => d.score));

  return { dimensions, compositeScore };
}

// ─── Full dashboard orchestration ───────────────────────────────────────

export interface DecisionSupportDashboard {
  executiveSummary: ExecutiveSummary;
  portfolioHealthOverview: PortfolioHealthOverview;
  riskSummary: RiskSummary;
  performanceSummary: PerformanceSummary;
  scenarioSummary: ScenarioSummary;
  capitalAllocationSummary: CapitalAllocationSummary;
  exposureSummary: ExposureSummary;
  diversificationSummary: DiversificationSummary;
  executiveAlerts: ExecutiveAlert[];
  outstandingIssues: OutstandingIssue[];
  keyMetrics: KeyMetric[];
  executiveHealth: ExecutiveHealth;
  generatedAt: string;
}

export async function buildDecisionSupportDashboard(userId: string): Promise<DecisionSupportDashboard> {
  // getSettingsRow() (lib/serverState.ts) is a plain check-then-insert
  // with no upsert safety — a known, pre-existing dormant race for a
  // brand-new user, first documented in lib/riskExposureEngine.ts (Phase
  // 37) and repeated in lib/scenarioEngine.ts (Phase 39). This dashboard
  // fans out even more concurrent settings-touching reads than either of
  // those, so the same guard applies: resolve the settings row once, up
  // front.
  await getSettingsRow(userId);

  const [risk, performance, scenario, optionsConcentration] = await Promise.all([
    buildRiskExposureDashboard(userId),
    buildPerformanceDashboard(userId),
    buildScenarioDashboard(userId, {}),
    buildPortfolioConcentrationOverlay(userId),
  ]);

  const portfolioHealthOverview = buildPortfolioHealthOverview(risk);
  const diversificationSummary = buildDiversificationSummary(risk, optionsConcentration);
  const scenarioSummary = buildScenarioSummary(scenario, risk);
  const executiveAlerts = buildExecutiveAlerts(risk, scenario);
  const outstandingIssues = buildOutstandingIssues(risk);
  const keyMetrics = buildKeyMetrics(risk, performance, portfolioHealthOverview);

  // Reuses the Scenario Engine's own already-resolved Trading positions
  // list (any scenario's own `.positions` carries the same full set) —
  // zero new query, zero new provider call beyond what buildScenarioDashboard()
  // already made.
  const tradingSymbols = scenario.trading.results.find((r) => r.scenario.key === "market_up_5")?.positions.map((p) => p.symbol) ?? [];
  const optionsSymbols = risk.options.dashboard.allocationBySymbol.map((s) => s.key);

  const executiveHealth = await buildExecutiveHealth(risk, performance, scenario, optionsConcentration, portfolioHealthOverview, tradingSymbols, optionsSymbols);

  const generatedAt = new Date().toISOString();

  const executiveSummary: ExecutiveSummary = {
    investingPortfolioCount: risk.investing.portfolioCount,
    investingHoldingsCount: risk.investing.holdingsCount,
    investingMarketValue: risk.investing.risk.totalMarketValue,
    tradingOpenPositionsCount: risk.trading.openPositionsCount,
    tradingAccountValue: risk.trading.accountValue,
    optionsOpenPositionsCount: risk.options.dashboard.openPositionsCount,
    optionsPortfolioValue: risk.options.dashboard.portfolioValue,
    optionsBuyingPower: risk.options.dashboard.buyingPower,
    overallHealthScore: portfolioHealthOverview.overallScore,
    alertCount: executiveAlerts.length,
    outstandingIssueCount: outstandingIssues.length,
    generatedAt,
    summary:
      `${risk.investing.holdingsCount} Investing holding(s), ${risk.trading.openPositionsCount} open Trading position(s), ${risk.options.dashboard.openPositionsCount} open Options position(s). ` +
      `Overall portfolio health ${portfolioHealthOverview.overallScore ?? "n/a"}/100. ${executiveAlerts.length} executive alert(s), ${outstandingIssues.length} outstanding issue(s).`,
  };

  const riskSummary: RiskSummary = {
    combined: risk.combined,
    investingRiskScore: risk.investing.risk.overall.score,
    tradingRiskScore: risk.trading.risk.overall.score,
    optionsRiskScoreBaseline: scenario.options.stressTest.riskScoreBefore,
  };

  return {
    executiveSummary,
    portfolioHealthOverview,
    riskSummary,
    performanceSummary: performance.combined,
    scenarioSummary,
    capitalAllocationSummary: { capitalAllocation: risk.combined.capitalAllocation, buyingPowerOverview: risk.combined.buyingPowerOverview },
    exposureSummary: {
      sectorConcentration: risk.combined.sectorConcentration,
      strategyConcentration: risk.combined.strategyConcentration,
      assetAllocation: risk.combined.assetAllocation,
      greeksSummary: risk.combined.greeksSummary,
    },
    diversificationSummary,
    executiveAlerts,
    outstandingIssues,
    keyMetrics,
    executiveHealth,
    generatedAt,
  };
}
