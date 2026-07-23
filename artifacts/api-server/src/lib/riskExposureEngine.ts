// Phase 37 — Institutional Risk & Exposure Intelligence Engine.
//
// PURE COMPOSITION LAYER. ANALYTICS AND VISIBILITY ONLY. Zero new risk
// scoring, zero AI-based scoring, zero probability forecasting, zero
// hedging/rebalancing/trade/position recommendation, zero automated
// alerts. Every figure below is either (a) reused verbatim from an
// already-shipped, already-tested engine, or (b) a thin, pure aggregation
// (sum/group/set-intersection) over those already-computed figures —
// never a new formula for "how risky is this."
//
//   - Investing — lib/investingRisk.ts's computePortfolioRiskFromAllocation()
//     (Phase 2 Sprint 29) and lib/portfolioConstruction.ts's
//     buildPortfolioAllocation() (Phase 2 Sprint 28), applied across ALL of
//     the calling user's own investing portfolios/holdings combined.
//   - Trading — lib/tradingRisk.ts's buildTradingRiskAnalysis() (Phase 3
//     Sprint 38/44), the exact same call GET /trading/risk itself makes.
//   - Options — lib/portfolioDashboard.ts's buildPortfolioDashboard()
//     (Portfolio Risk Dashboard) and lib/optionsPortfolioManagement.ts's
//     buildOptionsPortfolioManagementView() (Phase 36), both unmodified.
//   - Combined — pure aggregation over the 3 views above: sums, unions,
//     and a deterministic cross-engine symbol-overlap "correlation
//     overview" (a real, disclosed proxy — never a fabricated correlation
//     coefficient, since no genuine price-covariance infrastructure exists
//     anywhere in this codebase).

import { db, investingHoldingsTable, tradingPositionsTable, investingRiskSnapshotsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getFundamentalsProvider } from "./fundamentals.js";
import { buildPortfolioAllocation, type PortfolioHoldingInput, type PortfolioHoldingAllocation } from "./portfolioConstruction.js";
import { computePortfolioRiskFromAllocation, type PortfolioRiskAnalysis } from "./investingRisk.js";
import { buildTradingRiskAnalysis, type TradingPositionInput, type TradingRiskAnalysis } from "./tradingRisk.js";
import { getMarketDataProvider } from "./tradingMarketData.js";
import { getSettingsRow } from "./serverState.js";
import { buildPortfolioDashboard, type PortfolioDashboardResult } from "./portfolioDashboard.js";
import { buildOptionsPortfolioManagementView, type OptionsPortfolioManagementView } from "./optionsPortfolioManagement.js";

// ─── Investing risk view ────────────────────────────────────────────────

export interface InvestingSymbolAllocation {
  symbol: string;
  marketValue: number | null;
  weightPct: number | null;
}

export interface InvestingRiskView {
  portfolioCount: number;
  holdingsCount: number;
  risk: PortfolioRiskAnalysis;
  allocationBySymbol: InvestingSymbolAllocation[];
}

export async function buildInvestingRiskView(userId: string): Promise<InvestingRiskView> {
  const rows = await db.select().from(investingHoldingsTable).where(eq(investingHoldingsTable.userId, userId));
  const portfolioCount = new Set(rows.map((r) => r.portfolioId)).size;
  if (rows.length === 0) {
    return {
      portfolioCount: 0,
      holdingsCount: 0,
      risk: computePortfolioRiskFromAllocation([]),
      allocationBySymbol: [],
    };
  }

  const holdingInputs: PortfolioHoldingInput[] = rows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    targetWeightPct: r.targetWeightPct,
    shares: r.shares,
    notes: r.notes,
    avgCostBasis: r.avgCostBasis,
  }));
  const provider = await getFundamentalsProvider(userId);
  // buildPortfolioAllocation() resolves fundamentals/price per DISTINCT
  // symbol, so passing every holding across every portfolio in one call is
  // just as cheap as resolving each portfolio separately, and correctly
  // dedupes provider calls for a symbol held in more than one portfolio.
  const allocation = await buildPortfolioAllocation(holdingInputs, provider);

  const risk = computePortfolioRiskFromAllocation(allocation.holdings);

  const totalMarketValue = allocation.totalMarketValue;
  const allocationBySymbol: InvestingSymbolAllocation[] = mergeBySymbolValue(allocation.holdings).map((h) => ({
    symbol: h.symbol,
    marketValue: h.marketValue,
    weightPct: h.marketValue != null && totalMarketValue != null && totalMarketValue > 0 ? round2((h.marketValue / totalMarketValue) * 100) : null,
  }));

  return { portfolioCount, holdingsCount: rows.length, risk, allocationBySymbol };
}

// A symbol can appear in more than one portfolio — combine into one
// figure per symbol before presenting a cross-portfolio allocation view
// (a portfolio-count merge, not a new valuation).
function mergeBySymbolValue(holdings: PortfolioHoldingAllocation[]): { symbol: string; marketValue: number | null }[] {
  const bySymbol = new Map<string, number | null>();
  for (const h of holdings) {
    const existing = bySymbol.get(h.symbol);
    if (h.marketValue == null) {
      if (!bySymbol.has(h.symbol)) bySymbol.set(h.symbol, null);
      continue;
    }
    bySymbol.set(h.symbol, (existing ?? 0) + h.marketValue);
  }
  return [...bySymbol.entries()].map(([symbol, marketValue]) => ({ symbol, marketValue }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Trading risk view ──────────────────────────────────────────────────

export interface TradingRiskView {
  openPositionsCount: number;
  accountValue: number | null;
  risk: TradingRiskAnalysis;
}

export async function buildTradingRiskView(userId: string): Promise<TradingRiskView> {
  const rows = await db.select().from(tradingPositionsTable).where(eq(tradingPositionsTable.userId, userId));
  const positions: TradingPositionInput[] = rows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    side: r.side === "short" ? "short" : "long",
    status: r.status === "closed" ? "closed" : "open",
    quantity: r.quantity,
    entryPrice: r.entryPrice,
    stopPrice: r.stopPrice ?? null,
    targetPrice: r.targetPrice ?? null,
  }));
  const settings = await getSettingsRow(userId);
  const provider = await getMarketDataProvider(userId);
  const risk = await buildTradingRiskAnalysis(positions, settings.tradingAccountValue ?? null, provider);
  return {
    openPositionsCount: positions.filter((p) => p.status === "open").length,
    accountValue: settings.tradingAccountValue ?? null,
    risk,
  };
}

// ─── Options risk view ──────────────────────────────────────────────────
//
// Deliberately the FULL, unmodified result objects from both existing,
// already-shipped engines — never a hand-picked subset — so the OpenAPI
// contract can $ref those two schemas verbatim with zero new schema
// definitions, and so no field is ever silently dropped between what
// GET /portfolio/dashboard / GET /options-lifecycle/portfolio already
// return and what this dashboard shows.

export interface OptionsRiskView {
  dashboard: PortfolioDashboardResult;
  portfolioManagement: OptionsPortfolioManagementView;
}

export async function buildOptionsRiskView(userId: string): Promise<OptionsRiskView> {
  const [dashboard, portfolioManagement] = await Promise.all([buildPortfolioDashboard(userId), buildOptionsPortfolioManagementView(userId)]);
  return { dashboard, portfolioManagement };
}

// ─── Combined (cross-engine) view ───────────────────────────────────────

export interface CapitalAllocationEntry {
  engine: "investing" | "trading" | "options";
  label: string;
  value: number | null;
}

export interface BuyingPowerEntry {
  engine: "trading" | "options";
  label: string;
  value: number | null;
}

export interface SectorConcentrationEntry {
  engine: "investing" | "options";
  sector: string;
  weightPct: number;
}

export interface StrategyConcentrationEntry {
  key: string;
  label: string | null;
  positionCount: number;
  weightPct: number;
}

export interface AssetAllocationSummary {
  investingHoldingsCount: number;
  investingPortfolioCount: number;
  tradingOpenPositionsCount: number;
  optionsOpenPositionsCount: number;
}

export interface CrossEngineOverlapEntry {
  symbol: string;
  engines: ("investing" | "trading" | "options")[];
}

// Deliberately deterministic and disclosed: a real price-covariance
// correlation matrix needs historical return series this codebase has no
// infrastructure for (see docs/Institutional-Risk-Model.md). Rather than
// fabricate a correlation coefficient, this reports the one honest,
// zero-fabrication cross-engine signal available today: which symbols are
// genuinely held in more than one engine at once, and how much capital
// that overlap represents. A pure set-intersection over each view's own
// already-resolved holdings/positions — no new valuation, no statistics.
export interface CorrelationOverview {
  overlaps: CrossEngineOverlapEntry[];
  overlapSymbolCount: number;
  note: string;
}

export interface ConcentrationTimelinePoint {
  date: string;
  source: "options-exposure" | "investing-risk-snapshot";
  detail: string;
  value: number | null;
}

export interface CombinedRiskView {
  capitalAllocation: CapitalAllocationEntry[];
  buyingPowerOverview: BuyingPowerEntry[];
  sectorConcentration: SectorConcentrationEntry[];
  strategyConcentration: StrategyConcentrationEntry[];
  assetAllocation: AssetAllocationSummary;
  greeksSummary: PortfolioDashboardResult["netGreeks"];
  correlationOverview: CorrelationOverview;
  concentrationTimeline: ConcentrationTimelinePoint[];
}

async function loadInvestingRiskSnapshotTimeline(userId: string, limit = 12): Promise<ConcentrationTimelinePoint[]> {
  const rows = await db
    .select()
    .from(investingRiskSnapshotsTable)
    .where(eq(investingRiskSnapshotsTable.userId, userId))
    .orderBy(desc(investingRiskSnapshotsTable.createdAt))
    .limit(limit);
  // Newest-first from the query, presented oldest-first for a timeline.
  return rows
    .slice()
    .reverse()
    .map((r) => ({
      date: r.createdAt.toISOString(),
      source: "investing-risk-snapshot" as const,
      detail: `Saved Investing portfolio risk snapshot (portfolio #${r.portfolioId})`,
      value: r.overallScore,
    }));
}

export function buildCombinedRiskView(
  investing: InvestingRiskView,
  trading: TradingRiskView,
  options: OptionsRiskView,
  investingHoldingSymbols: string[],
  tradingSymbols: string[],
  optionsSymbols: string[],
  investingSnapshotTimeline: ConcentrationTimelinePoint[],
): CombinedRiskView {
  const capitalAllocation: CapitalAllocationEntry[] = [
    { engine: "investing", label: "Investing (market value)", value: investing.risk.totalMarketValue },
    { engine: "trading", label: "Trading (account value)", value: trading.accountValue },
    { engine: "options", label: "Options (portfolio value)", value: options.dashboard.portfolioValue },
  ];

  const buyingPowerOverview: BuyingPowerEntry[] = [
    { engine: "trading", label: "Trading account value", value: trading.accountValue },
    { engine: "options", label: "Options buying power", value: options.dashboard.buyingPower },
  ];

  const sectorConcentration: SectorConcentrationEntry[] = [
    ...investing.risk.sectorExposure.breakdown.map((s) => ({ engine: "investing" as const, sector: s.sector, weightPct: s.weightPct })),
    ...options.dashboard.allocationBySector.map((s) => ({ engine: "options" as const, sector: s.label, weightPct: s.weightPct })),
  ];

  const strategyConcentration: StrategyConcentrationEntry[] = options.dashboard.allocationByStrategy.map((s) => ({
    key: s.key,
    label: s.label,
    positionCount: s.positionCount,
    weightPct: s.weightPct,
  }));

  const assetAllocation: AssetAllocationSummary = {
    investingHoldingsCount: investing.holdingsCount,
    investingPortfolioCount: investing.portfolioCount,
    tradingOpenPositionsCount: trading.openPositionsCount,
    optionsOpenPositionsCount: options.dashboard.openPositionsCount,
  };

  const overlapMap = new Map<string, Set<"investing" | "trading" | "options">>();
  const record = (symbols: string[], engine: "investing" | "trading" | "options") => {
    for (const raw of symbols) {
      const symbol = raw.toUpperCase();
      if (!overlapMap.has(symbol)) overlapMap.set(symbol, new Set());
      overlapMap.get(symbol)!.add(engine);
    }
  };
  record(investingHoldingSymbols, "investing");
  record(tradingSymbols, "trading");
  record(optionsSymbols, "options");
  const overlaps: CrossEngineOverlapEntry[] = [...overlapMap.entries()]
    .filter(([, engines]) => engines.size > 1)
    .map(([symbol, engines]) => ({ symbol, engines: [...engines].sort() }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  const correlationOverview: CorrelationOverview = {
    overlaps,
    overlapSymbolCount: overlaps.length,
    note:
      "A deterministic cross-engine symbol-overlap read, not a statistical correlation coefficient — this platform has no historical price-covariance " +
      "infrastructure to compute genuine correlation, and none is fabricated here.",
  };

  const optionsExposurePoints: ConcentrationTimelinePoint[] = options.portfolioManagement.exposureTimeline.map((p) => ({
    date: p.monthEnd,
    source: "options-exposure" as const,
    detail: `${p.openPositionsCount} open options position(s)`,
    value: p.openPositionsCount,
  }));

  const concentrationTimeline = [...investingSnapshotTimeline, ...optionsExposurePoints].sort((a, b) => a.date.localeCompare(b.date));

  return {
    capitalAllocation,
    buyingPowerOverview,
    sectorConcentration,
    strategyConcentration,
    assetAllocation,
    greeksSummary: options.dashboard.netGreeks,
    correlationOverview,
    concentrationTimeline,
  };
}

// ─── Full dashboard orchestration ───────────────────────────────────────

export interface RiskExposureDashboard {
  investing: InvestingRiskView;
  trading: TradingRiskView;
  options: OptionsRiskView;
  combined: CombinedRiskView;
  generatedAt: string;
}

export async function buildRiskExposureDashboard(userId: string): Promise<RiskExposureDashboard> {
  // getSettingsRow() (lib/serverState.ts) is a plain check-then-insert with
  // no upsert safety — a known, pre-existing dormant race for a brand-new
  // user whose settings row doesn't exist yet. This dashboard is the first
  // caller anywhere in the codebase to fan out MULTIPLE concurrent
  // settings-touching reads (buildTradingRiskView, buildOptionsRiskView's
  // buildPortfolioDashboard call, and buildOptionsPortfolioManagementView's
  // own nested buildPortfolioDashboard call) for the same user in one
  // request, which reliably reproduces it. Fixing serverState.ts itself is
  // out of scope for this composition layer (a protected-adjacent shared
  // dependency change would need its own explicit approval) — instead, the
  // settings row is resolved once, awaited, up front, so every concurrent
  // sub-view below finds it already created.
  await getSettingsRow(userId);

  const [investingRows, tradingRows, investing, trading, options, investingSnapshotTimeline] = await Promise.all([
    db.select({ symbol: investingHoldingsTable.symbol }).from(investingHoldingsTable).where(eq(investingHoldingsTable.userId, userId)),
    db.select({ symbol: tradingPositionsTable.symbol, status: tradingPositionsTable.status }).from(tradingPositionsTable).where(eq(tradingPositionsTable.userId, userId)),
    buildInvestingRiskView(userId),
    buildTradingRiskView(userId),
    buildOptionsRiskView(userId),
    loadInvestingRiskSnapshotTimeline(userId),
  ]);

  const investingSymbols = investingRows.map((r) => r.symbol);
  const tradingSymbols = tradingRows.filter((r) => r.status === "open").map((r) => r.symbol);
  const optionsSymbols = options.dashboard.allocationBySymbol.map((b) => b.key);

  const combined = buildCombinedRiskView(investing, trading, options, investingSymbols, tradingSymbols, optionsSymbols, investingSnapshotTimeline);

  return { investing, trading, options, combined, generatedAt: new Date().toISOString() };
}
