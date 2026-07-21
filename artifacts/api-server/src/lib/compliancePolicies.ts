// Phase 42 — Institutional Portfolio Monitoring & Compliance Engine.
//
// User-defined policy CRUD + the fixed, documented set of policy types
// this phase implements. A policy is never a scoring formula — it is a
// user-chosen limit paired with a policyType that tells
// lib/complianceEngine.ts which already-computed figure to compare it
// against. This file introduces zero valuation/scoring logic of its own.
//
// Suggested default VALUES (POLICY_TYPE_META's own defaultLimitValue) are
// deliberately the SAME named caps already used elsewhere in this codebase
// (investingRisk.ts's SINGLE_SYMBOL_CONCENTRATION_CAP_PCT/
// SECTOR_CONCENTRATION_CAP_PCT, tradingRisk.ts's
// MAX_RISK_PER_POSITION_PCT/MAX_PORTFOLIO_RISK_PCT, decisionSupportEngine.ts's
// own alert thresholds) — reused, not invented — presented only as a
// starting suggestion a user can accept or edit; nothing is ever
// auto-created without an explicit user action.

import { db, compliancePoliciesTable, type CompliancePolicyRow, type InsertCompliancePolicy } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";

export const POLICY_TYPES = [
  "sector_allocation_max",
  "position_allocation_max",
  "strategy_allocation_max",
  "investing_capital_allocation_max",
  "trading_capital_allocation_max",
  "options_capital_allocation_max",
  "trading_buying_power_utilization_max",
  "options_buying_power_utilization_max",
  "portfolio_delta_max",
  "portfolio_gamma_max",
  "portfolio_theta_exposure_max",
  "expiration_concentration_max",
  "investing_diversification_min",
  "options_diversification_min",
  "options_income_stability_min",
] as const;
export type PolicyType = (typeof POLICY_TYPES)[number];

export type PolicyCategory = "allocation" | "sector" | "asset" | "position" | "strategy" | "greeks" | "buying_power" | "income_stability" | "diversification";
export type PolicyDirection = "max" | "min";

export interface PolicyTypeMeta {
  policyType: PolicyType;
  category: PolicyCategory;
  label: string;
  description: string;
  unit: "pct" | "usd" | "score" | "delta" | "gamma" | "theta";
  direction: PolicyDirection;
  requiresTargetKey: boolean;
  defaultLimitValue: number;
  engine: "investing" | "trading" | "options" | "cross-engine";
}

export const POLICY_TYPE_META: PolicyTypeMeta[] = [
  {
    policyType: "sector_allocation_max",
    category: "sector",
    label: "Maximum Sector Allocation",
    description: "A single sector's allocation must not exceed this percentage. Leave the target sector blank to apply the limit to whichever sector is currently largest.",
    unit: "pct",
    direction: "max",
    requiresTargetKey: false,
    defaultLimitValue: 40, // matches investingRisk.ts's SECTOR_CONCENTRATION_CAP_PCT
    engine: "cross-engine",
  },
  {
    policyType: "position_allocation_max",
    category: "position",
    label: "Maximum Single Position Allocation",
    description: "A single Investing holding's allocation must not exceed this percentage. Leave the target symbol blank to apply the limit to whichever holding is currently largest.",
    unit: "pct",
    direction: "max",
    requiresTargetKey: false,
    defaultLimitValue: 25, // matches investingRisk.ts's SINGLE_SYMBOL_CONCENTRATION_CAP_PCT
    engine: "investing",
  },
  {
    policyType: "strategy_allocation_max",
    category: "strategy",
    label: "Maximum Strategy Allocation",
    description: "A single Options strategy's allocation must not exceed this percentage. Leave the target strategy blank to apply the limit to whichever strategy is currently largest.",
    unit: "pct",
    direction: "max",
    requiresTargetKey: false,
    defaultLimitValue: 50, // matches decisionSupportEngine.ts's STRATEGY_CONCENTRATION_ALERT_PCT
    engine: "options",
  },
  {
    policyType: "investing_capital_allocation_max",
    category: "asset",
    label: "Maximum Investing Capital Allocation",
    description: "A dollar ceiling on total Investing market value.",
    unit: "usd",
    direction: "max",
    requiresTargetKey: false,
    defaultLimitValue: 100000,
    engine: "investing",
  },
  {
    policyType: "trading_capital_allocation_max",
    category: "asset",
    label: "Maximum Trading Capital Allocation",
    description: "A dollar ceiling on total Trading account value.",
    unit: "usd",
    direction: "max",
    requiresTargetKey: false,
    defaultLimitValue: 100000,
    engine: "trading",
  },
  {
    policyType: "options_capital_allocation_max",
    category: "asset",
    label: "Maximum Options Capital Allocation",
    description: "A dollar ceiling on total Options portfolio value.",
    unit: "usd",
    direction: "max",
    requiresTargetKey: false,
    defaultLimitValue: 100000,
    engine: "options",
  },
  {
    policyType: "trading_buying_power_utilization_max",
    category: "buying_power",
    label: "Maximum Trading Risk-Budget Utilisation",
    description: "The percentage of Trading account value at risk across open positions must not exceed this limit.",
    unit: "pct",
    direction: "max",
    requiresTargetKey: false,
    defaultLimitValue: 6, // matches tradingRisk.ts's MAX_PORTFOLIO_RISK_PCT
    engine: "trading",
  },
  {
    policyType: "options_buying_power_utilization_max",
    category: "buying_power",
    label: "Maximum Options Buying-Power Utilisation",
    description: "The percentage of Options buying power currently committed to open risk must not exceed this limit.",
    unit: "pct",
    direction: "max",
    requiresTargetKey: false,
    defaultLimitValue: 70, // matches decisionSupportEngine.ts's OPTIONS_RISK_UTILIZATION_ALERT_PCT
    engine: "options",
  },
  {
    policyType: "portfolio_delta_max",
    category: "greeks",
    label: "Maximum Portfolio Delta",
    description: "The absolute value of the Options book's net delta must not exceed this limit.",
    unit: "delta",
    direction: "max",
    requiresTargetKey: false,
    defaultLimitValue: 100,
    engine: "options",
  },
  {
    policyType: "portfolio_gamma_max",
    category: "greeks",
    label: "Maximum Portfolio Gamma",
    description: "The absolute value of the Options book's net gamma must not exceed this limit.",
    unit: "gamma",
    direction: "max",
    requiresTargetKey: false,
    defaultLimitValue: 10,
    engine: "options",
  },
  {
    policyType: "portfolio_theta_exposure_max",
    category: "greeks",
    label: "Maximum Theta Exposure",
    description: "The absolute value of the Options book's net theta must not exceed this limit.",
    unit: "theta",
    direction: "max",
    requiresTargetKey: false,
    defaultLimitValue: 500,
    engine: "options",
  },
  {
    policyType: "expiration_concentration_max",
    category: "strategy",
    label: "Maximum Expiration Concentration",
    description: "The percentage of open Options risk in a single expiration bucket must not exceed this limit. Leave the target expiration blank to apply the limit to whichever bucket is currently largest.",
    unit: "pct",
    direction: "max",
    requiresTargetKey: false,
    defaultLimitValue: 40, // matches decisionSupportEngine.ts's EXPIRATION_CONCENTRATION_ALERT_PCT
    engine: "options",
  },
  {
    policyType: "investing_diversification_min",
    category: "diversification",
    label: "Minimum Investing Diversification Score",
    description: "The Investing Engine's own concentration-derived diversification score must not fall below this value.",
    unit: "score",
    direction: "min",
    requiresTargetKey: false,
    defaultLimitValue: 60,
    engine: "investing",
  },
  {
    policyType: "options_diversification_min",
    category: "diversification",
    label: "Minimum Options Diversification Score",
    description: "The Options Engine's own diversification score must not fall below this value.",
    unit: "score",
    direction: "min",
    requiresTargetKey: false,
    defaultLimitValue: 60,
    engine: "options",
  },
  {
    policyType: "options_income_stability_min",
    category: "income_stability",
    label: "Minimum Income Stability",
    description: "Projected monthly theta income as a percentage of Options buying power must not fall below this value — the one genuinely new ratio this phase introduces, a plain division of two already-computed figures.",
    unit: "pct",
    direction: "min",
    requiresTargetKey: false,
    defaultLimitValue: 1,
    engine: "options",
  },
];

export function policyTypeMeta(policyType: string): PolicyTypeMeta | null {
  return POLICY_TYPE_META.find((m) => m.policyType === policyType) ?? null;
}

export async function listPolicies(userId: string): Promise<CompliancePolicyRow[]> {
  return db.select().from(compliancePoliciesTable).where(eq(compliancePoliciesTable.userId, userId)).orderBy(desc(compliancePoliciesTable.createdAt));
}

export async function getPolicy(userId: string, id: number): Promise<CompliancePolicyRow | null> {
  const [row] = await db
    .select()
    .from(compliancePoliciesTable)
    .where(and(eq(compliancePoliciesTable.id, id), eq(compliancePoliciesTable.userId, userId)));
  return row ?? null;
}

export async function createPolicy(userId: string, input: Omit<InsertCompliancePolicy, "userId">): Promise<CompliancePolicyRow> {
  const [row] = await db
    .insert(compliancePoliciesTable)
    .values({ ...input, userId })
    .returning();
  return row;
}

export async function updatePolicy(userId: string, id: number, input: Partial<Omit<InsertCompliancePolicy, "userId">>): Promise<CompliancePolicyRow | null> {
  const [row] = await db
    .update(compliancePoliciesTable)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(compliancePoliciesTable.id, id), eq(compliancePoliciesTable.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deletePolicy(userId: string, id: number): Promise<boolean> {
  const [row] = await db
    .delete(compliancePoliciesTable)
    .where(and(eq(compliancePoliciesTable.id, id), eq(compliancePoliciesTable.userId, userId)))
    .returning({ id: compliancePoliciesTable.id });
  return !!row;
}
