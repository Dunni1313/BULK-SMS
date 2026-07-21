// Phase 41 — Institutional Portfolio Rebalancing & Allocation Planning
// Engine.
//
// PURE COMPOSITION LAYER. PLANNING AND ANALYSIS ONLY. Zero trade
// recommendations, zero buy/sell signals, zero automatic portfolio
// optimisation, zero automatic rebalancing, zero auto execution, zero AI
// predictions, zero forecasting, zero machine learning, zero broker
// integration changes. Every figure below is either (a) reused verbatim
// from an already-shipped, already-tested engine, or (b) deterministic
// arithmetic over already-computed figures — never a new valuation model,
// never a suggested trade, never a share count to execute.
//
//   - lib/portfolioConstruction.ts's computePortfolioAllocation() (Phase 2
//     Sprint 28) is the entire Current Allocation / Target Allocation /
//     Allocation Drift engine — reused verbatim, called twice per
//     comparison (once against each portfolio's own stored target weights,
//     once against a caller-supplied set of proposed target weights) over
//     the SAME resolved prices, via the newly-extracted
//     resolvePricesAndMeta() helper — zero duplicated provider calls.
//   - lib/riskExposureEngine.ts's buildRiskExposureDashboard() (Phase 37)
//     supplies every cross-engine figure this phase needs — Capital
//     Allocation, Buying Power, Sector Allocation, Strategy Allocation,
//     Asset Allocation, and the Allocation Timeline (its own
//     concentrationTimeline) — reused directly, never recomputed.
//
// THE ONLY GENUINELY NEW ARITHMETIC in this file is "capital movement
// required" — the dollar amount that would need to move in or out of a
// holding to close its drift from a target weight
// (-(driftPct / 100) * totalMarketValue). This is a plain unit conversion
// of already-computed weight-drift and market-value figures — never a
// suggested trade, never a share count, never an order.
//
// Honest inapplicability: Trading positions and Options trades carry no
// stored target-weight field anywhere in this codebase (only
// investing_holdings.target_weight_pct exists) — Current vs. Target
// Allocation and the Rebalancing Planner are therefore Investing-only,
// disclosed explicitly via targetAllocationAvailability rather than
// silently omitted or approximated.

import { db, investingPortfoliosTable, investingHoldingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { FundamentalsProvider } from "./fundamentals.js";
import { getFundamentalsProvider } from "./fundamentals.js";
import { getSettingsRow } from "./serverState.js";
import {
  computePortfolioAllocation,
  buildPortfolioAllocation,
  resolvePricesAndMeta,
  type PortfolioHoldingInput,
  type PortfolioAllocationResult,
  type RebalanceAction,
  REBALANCE_DRIFT_THRESHOLD_PCT,
} from "./portfolioConstruction.js";
import {
  buildRiskExposureDashboard,
  type CapitalAllocationEntry,
  type BuyingPowerEntry,
  type SectorConcentrationEntry,
  type StrategyConcentrationEntry,
  type AssetAllocationSummary,
  type ConcentrationTimelinePoint,
} from "./riskExposureEngine.js";

function round(x: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

// ─── Per-portfolio Current/Target/Drift ──────────────────────────────────

export interface PortfolioRebalancingSummary {
  portfolioId: number;
  portfolioName: string;
  allocation: PortfolioAllocationResult;
}

async function loadPortfoliosWithHoldings(
  userId: string,
): Promise<{ portfolio: typeof investingPortfoliosTable.$inferSelect; holdingInputs: PortfolioHoldingInput[] }[]> {
  const [portfolios, holdings] = await Promise.all([
    db.select().from(investingPortfoliosTable).where(eq(investingPortfoliosTable.userId, userId)),
    db.select().from(investingHoldingsTable).where(eq(investingHoldingsTable.userId, userId)),
  ]);
  const holdingsByPortfolio = new Map<number, typeof investingHoldingsTable.$inferSelect[]>();
  for (const h of holdings) {
    const list = holdingsByPortfolio.get(h.portfolioId) ?? [];
    list.push(h);
    holdingsByPortfolio.set(h.portfolioId, list);
  }
  return portfolios.map((portfolio) => ({
    portfolio,
    holdingInputs: (holdingsByPortfolio.get(portfolio.id) ?? []).map(
      (h): PortfolioHoldingInput => ({
        id: h.id,
        symbol: h.symbol,
        targetWeightPct: h.targetWeightPct,
        shares: h.shares,
        notes: h.notes,
        avgCostBasis: h.avgCostBasis,
      }),
    ),
  }));
}

export async function buildPortfolioRebalancingSummaries(userId: string, provider: FundamentalsProvider): Promise<PortfolioRebalancingSummary[]> {
  const withHoldings = await loadPortfoliosWithHoldings(userId);
  return Promise.all(
    withHoldings.map(async ({ portfolio, holdingInputs }) => ({
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
      allocation: await buildPortfolioAllocation(holdingInputs, provider),
    })),
  );
}

// ─── Proposed Allocation Comparison (the Rebalancing Planner) ───────────

export interface ProposedTargetInput {
  symbol: string;
  targetWeightPct: number;
}

export interface AllocationComparisonRow {
  symbol: string;
  currentWeightPct: number | null;
  storedTargetWeightPct: number;
  proposedTargetWeightPct: number;
  driftFromProposedPct: number | null;
  // Positive = capital would need to move IN to this holding to reach the
  // proposed target; negative = capital would need to move OUT. Never a
  // share count, never an order — a dollar figure only.
  capitalMovementDollars: number | null;
  rebalanceActionVsProposed: RebalanceAction;
}

export interface ProposedAllocationComparison {
  portfolioId: number;
  current: PortfolioAllocationResult;
  proposed: PortfolioAllocationResult;
  rows: AllocationComparisonRow[];
  totalCapitalToDeployDollars: number | null;
  totalCapitalToRaiseDollars: number | null;
  summary: string;
}

export function buildProposedAllocationComparison(
  portfolioId: number,
  holdingInputs: PortfolioHoldingInput[],
  prices: Map<string, number | null>,
  meta: Map<string, import("./portfolioConstruction.js").SymbolMeta>,
  proposedTargets: ProposedTargetInput[],
): ProposedAllocationComparison {
  const current = computePortfolioAllocation(holdingInputs, prices, meta);

  const proposedTargetMap = new Map(proposedTargets.map((t) => [t.symbol, t.targetWeightPct]));
  const proposedInputs = holdingInputs.map((h) => ({
    ...h,
    targetWeightPct: proposedTargetMap.has(h.symbol) ? proposedTargetMap.get(h.symbol)! : h.targetWeightPct,
  }));
  const proposed = computePortfolioAllocation(proposedInputs, prices, meta);

  const currentBySymbol = new Map(current.holdings.map((h) => [h.symbol, h]));
  const rows: AllocationComparisonRow[] = proposed.holdings.map((p) => {
    const c = currentBySymbol.get(p.symbol);
    const capitalMovementDollars = p.driftPct != null && proposed.totalMarketValue != null ? round(-(p.driftPct / 100) * proposed.totalMarketValue) : null;
    return {
      symbol: p.symbol,
      currentWeightPct: c?.actualWeightPct ?? null,
      storedTargetWeightPct: c?.targetWeightPct ?? p.targetWeightPct,
      proposedTargetWeightPct: p.targetWeightPct,
      driftFromProposedPct: p.driftPct,
      capitalMovementDollars,
      rebalanceActionVsProposed: p.rebalanceAction,
    };
  });

  const totalCapitalToDeployDollars = round(rows.reduce((s, r) => s + Math.max(0, r.capitalMovementDollars ?? 0), 0));
  const totalCapitalToRaiseDollars = round(rows.reduce((s, r) => s + Math.max(0, -(r.capitalMovementDollars ?? 0)), 0));

  const movedCount = rows.filter((r) => r.rebalanceActionVsProposed === "buy" || r.rebalanceActionVsProposed === "sell").length;
  const summary =
    holdingInputs.length === 0
      ? "This portfolio has no holdings yet — nothing to compare against a proposed allocation."
      : `${movedCount} of ${holdingInputs.length} holding(s) would drift more than ${REBALANCE_DRIFT_THRESHOLD_PCT}pp from the proposed target weights. ` +
        `Approximately $${totalCapitalToDeployDollars.toLocaleString()} would need to move in and $${totalCapitalToRaiseDollars.toLocaleString()} would need to move out to fully close every drift.`;

  return { portfolioId, current, proposed, rows, totalCapitalToDeployDollars, totalCapitalToRaiseDollars, summary };
}

export async function buildProposedAllocationComparisonForPortfolio(
  portfolioId: number,
  holdingInputs: PortfolioHoldingInput[],
  proposedTargets: ProposedTargetInput[],
  provider: FundamentalsProvider,
): Promise<ProposedAllocationComparison> {
  const { prices, meta } = await resolvePricesAndMeta(holdingInputs, provider);
  return buildProposedAllocationComparison(portfolioId, holdingInputs, prices, meta, proposedTargets);
}

// ─── Full dashboard ──────────────────────────────────────────────────────

export interface TargetAllocationAvailabilityEntry {
  engine: "investing" | "trading" | "options";
  available: boolean;
  reason: string;
}

export const TARGET_ALLOCATION_AVAILABILITY: TargetAllocationAvailabilityEntry[] = [
  {
    engine: "investing",
    available: true,
    reason: "Each Investing holding stores its own target weight (Portfolio Construction, Phase 2 Sprint 28) — Current vs. Target vs. Drift is fully available.",
  },
  {
    engine: "trading",
    available: false,
    reason: "Trading positions carry no stored target-weight field anywhere in this codebase — honestly unavailable rather than approximated.",
  },
  {
    engine: "options",
    available: false,
    reason: "Options trades carry no stored target-weight field anywhere in this codebase — honestly unavailable rather than approximated.",
  },
];

export interface RebalancingDashboard {
  portfolios: PortfolioRebalancingSummary[];
  crossEngineCapitalAllocation: CapitalAllocationEntry[];
  crossEngineBuyingPowerOverview: BuyingPowerEntry[];
  crossEngineSectorAllocation: SectorConcentrationEntry[];
  crossEngineStrategyAllocation: StrategyConcentrationEntry[];
  crossEngineAssetAllocation: AssetAllocationSummary;
  allocationTimeline: ConcentrationTimelinePoint[];
  targetAllocationAvailability: TargetAllocationAvailabilityEntry[];
  summary: string;
  generatedAt: string;
}

export async function buildRebalancingDashboard(userId: string): Promise<RebalancingDashboard> {
  // getSettingsRow() (lib/serverState.ts) is a plain check-then-insert with
  // no upsert safety — a known, pre-existing dormant race for a brand-new
  // user, first documented in lib/riskExposureEngine.ts (Phase 37) and
  // repeated in every later composition layer (Phase 39/40). This
  // dashboard fans out the same kind of concurrent settings-touching reads,
  // so the same guard applies: resolve the settings row once, up front.
  await getSettingsRow(userId);

  const provider = await getFundamentalsProvider(userId);
  const [portfolios, risk] = await Promise.all([buildPortfolioRebalancingSummaries(userId, provider), buildRiskExposureDashboard(userId)]);

  const driftedCount = portfolios.reduce((s, p) => s + p.allocation.holdings.filter((h) => h.rebalanceAction === "buy" || h.rebalanceAction === "sell").length, 0);
  const summary =
    portfolios.length === 0
      ? "No Investing portfolios on record yet."
      : `${portfolios.length} Investing portfolio(s) with target weights on record. ${driftedCount} holding(s) across all portfolios have drifted more than ${REBALANCE_DRIFT_THRESHOLD_PCT}pp from their own stored target weight.`;

  return {
    portfolios,
    crossEngineCapitalAllocation: risk.combined.capitalAllocation,
    crossEngineBuyingPowerOverview: risk.combined.buyingPowerOverview,
    crossEngineSectorAllocation: risk.combined.sectorConcentration,
    crossEngineStrategyAllocation: risk.combined.strategyConcentration,
    crossEngineAssetAllocation: risk.combined.assetAllocation,
    allocationTimeline: risk.combined.concentrationTimeline,
    targetAllocationAvailability: TARGET_ALLOCATION_AVAILABILITY,
    summary,
    generatedAt: new Date().toISOString(),
  };
}
