// Phase 42 — Institutional Portfolio Monitoring & Compliance Engine.
//
// PURE COMPOSITION LAYER. MONITORING ONLY. Zero trade recommendations,
// zero buy/sell signals, zero portfolio optimisation, zero auto
// rebalancing, zero auto execution, zero AI predictions, zero
// forecasting, zero machine learning. Every current value evaluated
// against a user's own policy is reused verbatim from an already-shipped,
// already-tested engine:
//
//   - lib/riskExposureEngine.ts's buildRiskExposureDashboard() (Phase 37)
//     — Sector/Strategy/Capital/Buying-Power concentration, Greeks
//     summary, per-symbol Investing allocation, the Concentration
//     Timeline (reused as this phase's own Compliance Timeline — the
//     closest genuine historical proxy this codebase has; no separate
//     compliance-evaluation history is persisted this phase).
//   - lib/decisionSupportEngine.ts's buildDiversificationSummary()
//     (exported this phase, a one-line, behavior-preserving change) over
//     an already-computed RiskExposureDashboard plus
//     lib/portfolioConcentration.ts's own buildPortfolioConcentrationOverlay()
//     — Investing/Options diversification scores (Trading honestly
//     unavailable, the same disclosed gap Phase 40 already established).
//   - lib/optionsIncomeAnalytics.ts's buildOptionsIncomeDashboard() over
//     routes/optionsIncome.ts's own exported loadOptionsIncomeSummaryInputs()
//     — the real monthly theta income figure.
//
// THE ONLY GENUINELY NEW ARITHMETIC in this file is Income Stability — a
// plain ratio of two already-computed figures (monthly theta income ÷
// Options buying power) — and the policy comparison itself (current value
// vs. a user-chosen limit, in the user-chosen direction), which is a
// generic, reusable comparison, never a new scoring formula.

import type { RiskExposureDashboard } from "./riskExposureEngine.js";
import { buildRiskExposureDashboard } from "./riskExposureEngine.js";
import { buildDiversificationSummary, type DiversificationSummary } from "./decisionSupportEngine.js";
import { buildPortfolioConcentrationOverlay } from "./portfolioConcentration.js";
import { buildOptionsIncomeDashboard } from "./optionsIncomeAnalytics.js";
import { loadOptionsIncomeSummaryInputs } from "../routes/optionsIncome.js";
import { listPolicies, policyTypeMeta, type PolicyType, type PolicyCategory, type PolicyDirection } from "./compliancePolicies.js";
import type { CompliancePolicyRow } from "@workspace/db";
import type { ConcentrationTimelinePoint } from "./riskExposureEngine.js";
import { getSettingsRow } from "./serverState.js";

function round(x: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

export interface PolicyEvaluation {
  policyId: number;
  policyType: PolicyType;
  category: PolicyCategory;
  label: string;
  targetKey: string | null;
  direction: PolicyDirection;
  limitValue: number;
  currentValue: number | null;
  differenceValue: number | null;
  status: "compliant" | "breach" | "unavailable";
  detail: string;
  enabled: boolean;
}

interface EvalContext {
  risk: RiskExposureDashboard;
  diversification: DiversificationSummary;
  optionsThetaMonthly: number | null;
}

function pickEntry<T>(entries: T[], targetKey: string | null, keyOf: (e: T) => string, valueOf: (e: T) => number): { key: string; value: number } | null {
  if (targetKey) {
    const matches = entries.filter((e) => keyOf(e).toLowerCase() === targetKey.toLowerCase());
    if (matches.length === 0) return null;
    const value = round(matches.reduce((s, e) => s + valueOf(e), 0));
    return { key: targetKey, value };
  }
  if (entries.length === 0) return null;
  const top = entries.reduce((best, e) => (valueOf(e) > valueOf(best) ? e : best));
  return { key: keyOf(top), value: round(valueOf(top)) };
}

function resolveCurrentValue(policyType: PolicyType, targetKey: string | null, ctx: EvalContext): number | null {
  const { risk, diversification, optionsThetaMonthly } = ctx;
  switch (policyType) {
    case "sector_allocation_max": {
      const picked = pickEntry(risk.combined.sectorConcentration, targetKey, (e) => e.sector, (e) => e.weightPct);
      return picked?.value ?? null;
    }
    case "position_allocation_max": {
      const priced = risk.investing.allocationBySymbol.filter((h) => h.weightPct != null);
      const picked = pickEntry(priced, targetKey, (h) => h.symbol, (h) => h.weightPct ?? 0);
      return picked?.value ?? null;
    }
    case "strategy_allocation_max": {
      const picked = pickEntry(risk.combined.strategyConcentration, targetKey, (e) => e.label ?? e.key, (e) => e.weightPct);
      return picked?.value ?? null;
    }
    case "investing_capital_allocation_max":
      return risk.investing.risk.totalMarketValue;
    case "trading_capital_allocation_max":
      return risk.trading.accountValue;
    case "options_capital_allocation_max":
      return risk.options.dashboard.portfolioValue;
    case "trading_buying_power_utilization_max":
      return risk.trading.risk.portfolioBudget.totalRiskUsedPct;
    case "options_buying_power_utilization_max":
      return risk.options.dashboard.totalRiskPct;
    case "portfolio_delta_max":
      return round(Math.abs(risk.combined.greeksSummary.delta));
    case "portfolio_gamma_max":
      return round(Math.abs(risk.combined.greeksSummary.gamma));
    case "portfolio_theta_exposure_max":
      return round(Math.abs(risk.combined.greeksSummary.theta));
    case "expiration_concentration_max": {
      const picked = pickEntry(risk.options.dashboard.expirationDistribution, targetKey, (e) => e.label ?? e.key, (e) => e.weightPct);
      return picked?.value ?? null;
    }
    case "investing_diversification_min":
      return diversification.investing.score;
    case "options_diversification_min":
      return diversification.options.score;
    case "options_income_stability_min": {
      const buyingPower = risk.options.dashboard.buyingPower;
      if (optionsThetaMonthly == null || buyingPower == null || buyingPower <= 0) return null;
      return round((optionsThetaMonthly / buyingPower) * 100);
    }
    default:
      return null;
  }
}

export function evaluatePolicy(policy: CompliancePolicyRow, ctx: EvalContext): PolicyEvaluation {
  const meta = policyTypeMeta(policy.policyType);
  const direction = (policy.direction === "min" ? "min" : "max") as PolicyDirection;
  const currentValue = meta ? resolveCurrentValue(meta.policyType, policy.targetKey, ctx) : null;
  const differenceValue = currentValue != null ? round(currentValue - policy.limitValue) : null;

  let status: PolicyEvaluation["status"];
  let detail: string;
  if (!meta || currentValue == null) {
    status = "unavailable";
    detail = `${policy.label}: current value could not be resolved — honestly unavailable, never fabricated.`;
  } else {
    const breached = direction === "max" ? currentValue > policy.limitValue : currentValue < policy.limitValue;
    status = breached ? "breach" : "compliant";
    const unit = meta.unit === "usd" ? "$" : meta.unit === "pct" ? "%" : "";
    const currentStr = meta.unit === "usd" ? `$${currentValue.toLocaleString()}` : `${currentValue}${unit}`;
    const limitStr = meta.unit === "usd" ? `$${policy.limitValue.toLocaleString()}` : `${policy.limitValue}${unit}`;
    detail = breached
      ? `${policy.label}: current ${currentStr} ${direction === "max" ? "exceeds" : "falls below"} the ${limitStr} limit.`
      : `${policy.label}: current ${currentStr} is within the ${limitStr} limit.`;
  }

  return {
    policyId: policy.id,
    policyType: policy.policyType as PolicyType,
    category: meta?.category ?? "allocation",
    label: policy.label,
    targetKey: policy.targetKey,
    direction,
    limitValue: policy.limitValue,
    currentValue,
    differenceValue,
    status,
    detail,
    enabled: policy.enabled,
  };
}

export interface ComplianceSummary {
  totalPolicies: number;
  enabledPolicies: number;
  compliantCount: number;
  breachCount: number;
  unavailableCount: number;
  overallStatus: "compliant" | "breach" | "no_policies";
  summary: string;
}

function buildComplianceSummary(evaluations: PolicyEvaluation[]): ComplianceSummary {
  const enabled = evaluations.filter((e) => e.enabled);
  const compliantCount = enabled.filter((e) => e.status === "compliant").length;
  const breachCount = enabled.filter((e) => e.status === "breach").length;
  const unavailableCount = enabled.filter((e) => e.status === "unavailable").length;
  const overallStatus: ComplianceSummary["overallStatus"] = enabled.length === 0 ? "no_policies" : breachCount > 0 ? "breach" : "compliant";
  const summary =
    enabled.length === 0
      ? "No compliance policies configured yet."
      : `${enabled.length} policy(ies) evaluated — ${compliantCount} compliant, ${breachCount} breach(es)${unavailableCount > 0 ? `, ${unavailableCount} unavailable` : ""}.`;
  return { totalPolicies: evaluations.length, enabledPolicies: enabled.length, compliantCount, breachCount, unavailableCount, overallStatus, summary };
}

export interface MonitoringComplianceDashboard {
  complianceSummary: ComplianceSummary;
  evaluations: PolicyEvaluation[];
  allocationLimits: PolicyEvaluation[];
  sectorLimits: PolicyEvaluation[];
  assetLimits: PolicyEvaluation[];
  positionLimits: PolicyEvaluation[];
  strategyLimits: PolicyEvaluation[];
  greeksLimits: PolicyEvaluation[];
  buyingPowerLimits: PolicyEvaluation[];
  incomeStabilityLimits: PolicyEvaluation[];
  diversificationLimits: PolicyEvaluation[];
  policyViolations: PolicyEvaluation[];
  complianceTimeline: ConcentrationTimelinePoint[];
  complianceTimelineNote: string;
  generatedAt: string;
}

const ALLOCATION_CATEGORIES: PolicyCategory[] = ["sector", "asset", "position", "strategy"];

export async function buildMonitoringComplianceDashboard(userId: string): Promise<MonitoringComplianceDashboard> {
  // getSettingsRow() (lib/serverState.ts) is a plain check-then-insert with
  // no upsert safety — a known, pre-existing dormant race for a brand-new
  // user whose settings row doesn't exist yet (first disclosed at Phase 37's
  // own buildRiskExposureDashboard(), Sprint 70's own E2E disclosure). This
  // dashboard fans out MULTIPLE independent settings-touching branches
  // concurrently (buildRiskExposureDashboard, buildPortfolioConcentrationOverlay,
  // loadOptionsIncomeSummaryInputs), which reliably reproduces it. Fixing
  // serverState.ts itself is out of scope for this composition layer (a
  // shared dependency change would need its own explicit approval) —
  // instead, mirroring buildRiskExposureDashboard()'s own established fix,
  // the settings row is resolved once, awaited, up front, so every
  // concurrent branch below finds it already created.
  await getSettingsRow(userId);

  const [policies, risk, optionsConcentration, optionsIncomeInputs] = await Promise.all([
    listPolicies(userId),
    buildRiskExposureDashboard(userId),
    buildPortfolioConcentrationOverlay(userId),
    loadOptionsIncomeSummaryInputs(userId),
  ]);

  const diversification = buildDiversificationSummary(risk, optionsConcentration);
  const optionsIncome = buildOptionsIncomeDashboard(optionsIncomeInputs);
  const ctx: EvalContext = { risk, diversification, optionsThetaMonthly: optionsIncome.overview.theta.monthly };

  const evaluations = policies.map((p) => evaluatePolicy(p, ctx));
  const byCategory = (cats: PolicyCategory[]) => evaluations.filter((e) => cats.includes(e.category));

  return {
    complianceSummary: buildComplianceSummary(evaluations),
    evaluations,
    allocationLimits: byCategory(ALLOCATION_CATEGORIES),
    sectorLimits: byCategory(["sector"]),
    assetLimits: byCategory(["asset"]),
    positionLimits: byCategory(["position"]),
    strategyLimits: byCategory(["strategy"]),
    greeksLimits: byCategory(["greeks"]),
    buyingPowerLimits: byCategory(["buying_power"]),
    incomeStabilityLimits: byCategory(["income_stability"]),
    diversificationLimits: byCategory(["diversification"]),
    policyViolations: evaluations.filter((e) => e.enabled && e.status === "breach"),
    complianceTimeline: risk.combined.concentrationTimeline,
    complianceTimelineNote:
      "Reused directly from the Risk & Exposure Engine's own Concentration Timeline — the closest genuine historical signal this codebase has. " +
      "No separate compliance-evaluation history is persisted this phase; policy evaluations are always computed fresh.",
    generatedAt: new Date().toISOString(),
  };
}
