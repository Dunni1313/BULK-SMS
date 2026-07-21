// Phase 38 — Institutional Performance & Attribution Engine.
//
// ANALYTICAL ONLY. This module never predicts, forecasts, recommends a
// trade, optimises a portfolio, auto-rebalances, or generates "alpha." It
// explains performance that has ALREADY HAPPENED, using ONLY already-
// persisted, real data:
//   - Investing — lib/portfolioConstruction.ts's buildPortfolioAllocation()
//     (Phase 2 Sprint 28, the same cheaper-than-buildPortfolioIntelligence()
//     composition riskExposureEngine.ts already uses), applied across ALL of
//     the calling user's own investing portfolios/holdings combined. This
//     module re-derives the identical unrealized-P&L formula
//     portfolioIntelligence.ts's own Performance section already uses
//     (costBasisValue = shares*avgCostBasis; unrealizedPnl = marketValue -
//     costBasisValue) rather than calling the far heavier
//     buildPortfolioIntelligence() (which internally fetches a full
//     ValueResearchReport — Buffett/Graham/DCF/Tom Nash/Committee scoring —
//     per distinct symbol, none of which this module needs).
//   - Trading — trading_positions' own real, persisted entryPrice/exitPrice/
//     quantity/side columns (Phase 3 Sprint 32). No prior module in this
//     codebase aggregates realized P&L from these columns; this is the one
//     genuinely new formula this phase adds for Trading.
//   - Options — lib/optionsIncomeAnalytics.ts's own buildIncomeOverview()/
//     buildStrategyMix() (Phase 35), reused verbatim for income figures;
//     lib/tradeAnalytics.ts's (frontend, ravish-trading) win-rate/avg-win/
//     avg-loss formula is PORTED server-side here, applied to real,
//     already-persisted trades.currentPnl — the same formula shape, not a
//     new one.
//   - Risk-adjusted performance — the ONLY Sharpe-ratio formula precedent
//     anywhere in this codebase (lib/tradingBacktest.ts's/
//     lib/optionsBacktest.ts's mean/stdDev*sqrt(N) over individual trade
//     returns) is reused, applied to REAL closed trades/positions instead
//     of backtest output. This is a TRADE-RETURN-BASED measure, not a
//     time-series measure — no periodic real portfolio-value history
//     exists anywhere in this codebase to support the latter, and none is
//     fabricated here. A companion Sortino ratio (downside-deviation-only,
//     the standard variant) uses the identical shape — new, but a standard,
//     disclosed formula, not a new concept. Investing has no discrete
//     realized-trade-return series at all (holdings are continuously held,
//     not round-tripped) and honestly reports this as unavailable.
//   - Historical Performance Timeline — mirrors Phase 36's Options Exposure
//     Timeline pattern (a real-timestamp reconstruction, not a snapshot
//     table), extended here to sum real P&L per month for Options
//     (trades.closeDate) and Trading (trading_positions.exitDate).
//     Investing has no realized-P&L history at all (only unrealized,
//     continuous holdings), so its own timeline honestly shows real,
//     user-saved market-value-over-time (investing_portfolio_snapshots,
//     Phase 2 Sprint 65-era) instead of P&L-over-time — an explicitly
//     narrower, differently-sourced timeline, never fabricated to look
//     equivalent to the other two engines'.
//
// See docs/Institutional-Performance-Model.md for the full, itemised
// reused-vs-new breakdown.

import { db, investingHoldingsTable, tradingPositionsTable, tradesTable, tradingJournalEntriesTable, investingPortfolioSnapshotsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { getFundamentalsProvider } from "./fundamentals.js";
import { buildPortfolioAllocation, type PortfolioHoldingInput, type PortfolioHoldingAllocation } from "./portfolioConstruction.js";
import { getSettingsRow } from "./serverState.js";
import { buildIncomeOverview, buildStrategyMix, type OptionsIncomeOverview, type StrategyMixEntry } from "./optionsIncomeAnalytics.js";
import { positionGreeks } from "./coach.js";
import type { QuoteLeg } from "./optionsMath.js";
import type { ThetaPosition } from "./thetaIncome.js";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Shared: risk-adjusted performance (trade-return based) ────────────────
//
// The exact formula shape lib/tradingBacktest.ts's/lib/optionsBacktest.ts's
// own sharpeRatio already uses — mean/stdDev of a set of individual TRADE
// returns (not a time series), scaled by sqrt(N) — applied here to real
// closed trades/positions instead of backtest output. Sortino is the
// standard downside-deviation-only variant of the same shape: deviation is
// computed only from returns below zero, against zero (not the mean), the
// simplest, most common Sortino convention when no separate minimum-
// acceptable-return target is configured.

export interface RiskAdjustedPerformance {
  available: boolean;
  reason: string | null;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  tradeCount: number;
  basis: string;
}

const TRADE_RETURN_BASIS =
  "Trade-return-based (per-trade % P&L across real closed trades), not a time-series measure — this platform has no periodic real portfolio-value " +
  "history. Computed with the same mean/standard-deviation formula lib/tradingBacktest.ts's own Sharpe ratio already uses, applied to real trades " +
  "instead of backtest output.";

function computeRiskAdjusted(returnsPct: number[]): RiskAdjustedPerformance {
  const n = returnsPct.length;
  if (n < 2) {
    return {
      available: false,
      reason: n === 0 ? "No closed, decided trades to compute a risk-adjusted return from yet." : "At least 2 closed trades are needed to compute a meaningful standard deviation.",
      sharpeRatio: null,
      sortinoRatio: null,
      tradeCount: n,
      basis: TRADE_RETURN_BASIS,
    };
  }
  const mean = returnsPct.reduce((s, r) => s + r, 0) / n;
  const variance = returnsPct.reduce((s, r) => s + (r - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? round2((mean / stdDev) * Math.sqrt(n)) : null;

  const downsideSquares = returnsPct.map((r) => (r < 0 ? r * r : 0));
  const downsideDeviation = Math.sqrt(downsideSquares.reduce((s, v) => s + v, 0) / n);
  const sortinoRatio = downsideDeviation > 0 ? round2((mean / downsideDeviation) * Math.sqrt(n)) : null;

  return { available: true, reason: null, sharpeRatio, sortinoRatio, tradeCount: n, basis: TRADE_RETURN_BASIS };
}

export interface AttributionEntry {
  key: string;
  label: string;
  pnl: number;
  tradeCount: number;
  weightPct: number | null;
}

function attributeByKey(entries: { key: string; label: string; pnl: number }[]): AttributionEntry[] {
  const byKey = new Map<string, { label: string; pnl: number; tradeCount: number }>();
  for (const e of entries) {
    const existing = byKey.get(e.key);
    if (existing) {
      existing.pnl += e.pnl;
      existing.tradeCount += 1;
    } else {
      byKey.set(e.key, { label: e.label, pnl: e.pnl, tradeCount: 1 });
    }
  }
  const totalAbsPnl = [...byKey.values()].reduce((s, v) => s + Math.abs(v.pnl), 0);
  return [...byKey.entries()]
    .map(([key, v]) => ({
      key,
      label: v.label,
      pnl: round2(v.pnl),
      tradeCount: v.tradeCount,
      weightPct: totalAbsPnl > 0 ? round2((Math.abs(v.pnl) / totalAbsPnl) * 100) : null,
    }))
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
}

function holdingPeriodDays(openDate: Date, closeDate: Date | null): number | null {
  if (!closeDate) return null;
  return Math.max(0, (closeDate.getTime() - openDate.getTime()) / (24 * 60 * 60 * 1000));
}

// ─── 1. Investing performance view ──────────────────────────────────────────

export interface InvestingHoldingPerformance {
  symbol: string;
  sector: string | null;
  shares: number | null;
  avgCostBasis: number | null;
  currentPrice: number | null;
  costBasisValue: number | null;
  marketValue: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPct: number | null;
}

export interface InvestingPerformanceView {
  portfolioCount: number;
  holdingsCount: number;
  totalCostBasisValue: number | null;
  totalMarketValue: number | null;
  totalUnrealizedPnl: number | null;
  totalUnrealizedPnlPct: number | null;
  holdings: InvestingHoldingPerformance[];
  sectorAttribution: AttributionEntry[];
  assetAttribution: AttributionEntry[];
  riskAdjusted: RiskAdjustedPerformance;
  capitalEfficiency: { totalDeployed: number | null; returnOnDeployedCapitalPct: number | null; detail: string };
  unresolvedSymbols: string[];
  summary: string;
}

function holdingPerformance(h: PortfolioHoldingAllocation): InvestingHoldingPerformance {
  const costBasisValue = h.shares != null && h.avgCostBasis != null ? h.shares * h.avgCostBasis : null;
  const unrealizedPnl = h.marketValue != null && costBasisValue != null ? h.marketValue - costBasisValue : null;
  const unrealizedPnlPct = unrealizedPnl != null && costBasisValue != null && costBasisValue !== 0 ? (unrealizedPnl / costBasisValue) * 100 : null;
  return {
    symbol: h.symbol,
    sector: h.sector,
    shares: h.shares,
    avgCostBasis: h.avgCostBasis,
    currentPrice: h.currentPrice,
    costBasisValue: costBasisValue != null ? round2(costBasisValue) : null,
    marketValue: h.marketValue != null ? round2(h.marketValue) : null,
    unrealizedPnl: unrealizedPnl != null ? round2(unrealizedPnl) : null,
    unrealizedPnlPct: unrealizedPnlPct != null ? round2(unrealizedPnlPct) : null,
  };
}

export async function buildInvestingPerformanceView(userId: string): Promise<InvestingPerformanceView> {
  const rows = await db.select().from(investingHoldingsTable).where(eq(investingHoldingsTable.userId, userId));
  const portfolioCount = new Set(rows.map((r) => r.portfolioId)).size;

  const riskAdjusted: RiskAdjustedPerformance = {
    available: false,
    reason: "Investing holdings are continuously held, not discrete round-trip trades — no realized trade-return series exists to compute a trade-return-based Sharpe/Sortino ratio honestly.",
    sharpeRatio: null,
    sortinoRatio: null,
    tradeCount: 0,
    basis: TRADE_RETURN_BASIS,
  };

  if (rows.length === 0) {
    return {
      portfolioCount: 0,
      holdingsCount: 0,
      totalCostBasisValue: null,
      totalMarketValue: null,
      totalUnrealizedPnl: null,
      totalUnrealizedPnlPct: null,
      holdings: [],
      sectorAttribution: [],
      assetAttribution: [],
      riskAdjusted,
      capitalEfficiency: { totalDeployed: null, returnOnDeployedCapitalPct: null, detail: "No holdings on record yet." },
      unresolvedSymbols: [],
      summary: "This user has no Investing holdings on record yet.",
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
  const allocation = await buildPortfolioAllocation(holdingInputs, provider);

  const holdings = allocation.holdings.map(holdingPerformance);
  const totalCostBasisValue = holdings.reduce((s, h) => (h.costBasisValue != null ? s + h.costBasisValue : s), 0);
  const hasCostBasis = holdings.some((h) => h.costBasisValue != null);
  const totalUnrealizedPnl = holdings.reduce((s, h) => (h.unrealizedPnl != null ? s + h.unrealizedPnl : s), 0);
  const hasUnrealized = holdings.some((h) => h.unrealizedPnl != null);
  const totalUnrealizedPnlPct = hasCostBasis && totalCostBasisValue !== 0 ? round2((totalUnrealizedPnl / totalCostBasisValue) * 100) : null;

  const sectorAttribution = attributeByKey(
    holdings.filter((h) => h.unrealizedPnl != null).map((h) => ({ key: h.sector ?? "Unclassified", label: h.sector ?? "Unclassified", pnl: h.unrealizedPnl as number })),
  );
  const assetAttribution = attributeByKey(holdings.filter((h) => h.unrealizedPnl != null).map((h) => ({ key: h.symbol, label: h.symbol, pnl: h.unrealizedPnl as number })));

  return {
    portfolioCount,
    holdingsCount: rows.length,
    totalCostBasisValue: hasCostBasis ? round2(totalCostBasisValue) : null,
    totalMarketValue: allocation.totalMarketValue != null ? round2(allocation.totalMarketValue) : null,
    totalUnrealizedPnl: hasUnrealized ? round2(totalUnrealizedPnl) : null,
    totalUnrealizedPnlPct,
    holdings,
    sectorAttribution,
    assetAttribution,
    riskAdjusted,
    capitalEfficiency: {
      totalDeployed: hasCostBasis ? round2(totalCostBasisValue) : null,
      returnOnDeployedCapitalPct: totalUnrealizedPnlPct,
      detail:
        hasCostBasis && totalUnrealizedPnlPct != null
          ? `Unrealized return on the ${round2(totalCostBasisValue).toLocaleString()} in deployed cost basis: ${totalUnrealizedPnlPct.toFixed(2)}%.`
          : "Capital efficiency is unavailable — one or more holdings has no recorded cost basis (avg cost / shares).",
    },
    unresolvedSymbols: allocation.unresolvedSymbols,
    summary: allocation.summary,
  };
}

// ─── 2. Trading performance view ────────────────────────────────────────────

export interface TradingPositionPerformance {
  id: number;
  symbol: string;
  side: string;
  status: string;
  quantity: number;
  entryPrice: number;
  exitPrice: number | null;
  realizedPnl: number | null;
  realizedPnlPct: number | null;
  holdingDays: number | null;
  setupType: string | null;
}

export interface TradingPerformanceView {
  totalPositions: number;
  openPositionsCount: number;
  closedPositionsCount: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number | null;
  averageWin: number | null;
  averageLoss: number | null;
  totalRealizedPnl: number | null;
  largestWinner: number | null;
  largestLoser: number | null;
  averageHoldingDays: number | null;
  positions: TradingPositionPerformance[];
  strategyAttribution: AttributionEntry[];
  assetAttribution: AttributionEntry[];
  riskAdjusted: RiskAdjustedPerformance;
  capitalEfficiency: { capitalCommitted: number | null; returnOnCapitalPct: number | null; detail: string };
  summary: string;
}

export async function buildTradingPerformanceView(userId: string): Promise<TradingPerformanceView> {
  const rows = await db.select().from(tradingPositionsTable).where(eq(tradingPositionsTable.userId, userId));

  // Best-effort join to trading_journal_entries.setupType via its own loose,
  // unenforced tradingPositionId reference (Phase 3 Sprint 39 precedent —
  // no FK exists). A position with more than one journal entry uses the
  // most recently created entry's own setupType; a position with none, or
  // whose entry has no setupType, buckets under "Unclassified" rather than
  // being silently dropped.
  const journalRows = await db
    .select({ tradingPositionId: tradingJournalEntriesTable.tradingPositionId, setupType: tradingJournalEntriesTable.setupType, createdAt: tradingJournalEntriesTable.createdAt })
    .from(tradingJournalEntriesTable)
    .where(eq(tradingJournalEntriesTable.userId, userId))
    .orderBy(desc(tradingJournalEntriesTable.createdAt));
  const setupTypeByPositionId = new Map<number, string | null>();
  for (const j of journalRows) {
    if (j.tradingPositionId == null) continue;
    if (!setupTypeByPositionId.has(j.tradingPositionId)) setupTypeByPositionId.set(j.tradingPositionId, j.setupType ?? null);
  }

  const positions: TradingPositionPerformance[] = rows.map((r) => {
    const direction = r.side === "short" ? -1 : 1;
    const realizedPnl = r.status === "closed" && r.exitPrice != null ? (r.exitPrice - r.entryPrice) * r.quantity * direction : null;
    const costBasis = r.entryPrice * r.quantity;
    const realizedPnlPct = realizedPnl != null && costBasis !== 0 ? (realizedPnl / costBasis) * 100 : null;
    return {
      id: r.id,
      symbol: r.symbol,
      side: r.side,
      status: r.status,
      quantity: r.quantity,
      entryPrice: r.entryPrice,
      exitPrice: r.exitPrice ?? null,
      realizedPnl: realizedPnl != null ? round2(realizedPnl) : null,
      realizedPnlPct: realizedPnlPct != null ? round2(realizedPnlPct) : null,
      holdingDays: holdingPeriodDays(r.entryDate, r.exitDate ?? null),
      setupType: setupTypeByPositionId.get(r.id) ?? null,
    };
  });

  const openPositionsCount = positions.filter((p) => p.status === "open").length;
  const closed = positions.filter((p) => p.status === "closed" && p.realizedPnl != null);
  const winning = closed.filter((p) => (p.realizedPnl as number) > 0);
  const losing = closed.filter((p) => (p.realizedPnl as number) < 0);
  const decidedCount = winning.length + losing.length;
  const winRate = decidedCount > 0 ? round2((winning.length / decidedCount) * 100) : null;
  const averageWin = winning.length > 0 ? round2(winning.reduce((s, p) => s + (p.realizedPnl as number), 0) / winning.length) : null;
  const averageLoss = losing.length > 0 ? round2(losing.reduce((s, p) => s + (p.realizedPnl as number), 0) / losing.length) : null;
  const totalRealizedPnl = closed.length > 0 ? round2(closed.reduce((s, p) => s + (p.realizedPnl as number), 0)) : null;
  const largestWinner = winning.length > 0 ? round2(Math.max(...winning.map((p) => p.realizedPnl as number))) : null;
  const largestLoser = losing.length > 0 ? round2(Math.min(...losing.map((p) => p.realizedPnl as number))) : null;
  const withHoldingDays = closed.filter((p) => p.holdingDays != null);
  const averageHoldingDays = withHoldingDays.length > 0 ? round2(withHoldingDays.reduce((s, p) => s + (p.holdingDays as number), 0) / withHoldingDays.length) : null;

  const strategyAttribution = attributeByKey(
    closed.map((p) => ({ key: (p.setupType ?? "unclassified").toLowerCase(), label: p.setupType ?? "Unclassified", pnl: p.realizedPnl as number })),
  );
  const assetAttribution = attributeByKey(closed.map((p) => ({ key: p.symbol, label: p.symbol, pnl: p.realizedPnl as number })));

  const riskAdjusted = computeRiskAdjusted(closed.filter((p) => p.realizedPnlPct != null).map((p) => p.realizedPnlPct as number));

  const capitalCommitted = closed.reduce((s, p) => {
    const row = rows.find((r) => r.id === p.id);
    return row ? s + Math.abs(row.entryPrice * row.quantity) : s;
  }, 0);
  const returnOnCapitalPct = totalRealizedPnl != null && capitalCommitted > 0 ? round2((totalRealizedPnl / capitalCommitted) * 100) : null;

  return {
    totalPositions: positions.length,
    openPositionsCount,
    closedPositionsCount: closed.length,
    winningTrades: winning.length,
    losingTrades: losing.length,
    winRate,
    averageWin,
    averageLoss,
    totalRealizedPnl,
    largestWinner,
    largestLoser,
    averageHoldingDays,
    positions,
    strategyAttribution,
    assetAttribution,
    riskAdjusted,
    capitalEfficiency: {
      capitalCommitted: capitalCommitted > 0 ? round2(capitalCommitted) : null,
      returnOnCapitalPct,
      detail:
        returnOnCapitalPct != null
          ? `Realized P&L relative to the entry cost basis of closed positions: ${returnOnCapitalPct.toFixed(2)}%.`
          : "Capital efficiency is unavailable — no closed positions with a resolvable entry cost basis yet.",
    },
    summary:
      positions.length === 0
        ? "This user has no Trading positions on record yet."
        : `${positions.length} position(s) on record (${openPositionsCount} open, ${closed.length} closed). ${winRate != null ? `Win rate ${winRate.toFixed(1)}%.` : "No decided closed trades yet."}`,
  };
}

// ─── 3. Options performance view ────────────────────────────────────────────

export interface OptionsTradePerformance {
  id: number;
  symbol: string;
  strategy: string;
  status: string;
  credit: number;
  currentPnl: number | null;
  currentPnlPercent: number | null;
  holdingDays: number | null;
}

export interface OptionsPerformanceView {
  openPositionsCount: number;
  closedPositionsCount: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number | null;
  averageWin: number | null;
  averageLoss: number | null;
  totalRealizedPnl: number | null;
  income: OptionsIncomeOverview;
  trades: OptionsTradePerformance[];
  strategyAttribution: AttributionEntry[];
  assetAttribution: AttributionEntry[];
  incomeAttribution: StrategyMixEntry[];
  riskAdjusted: RiskAdjustedPerformance;
  capitalEfficiency: { capitalCommitted: number | null; returnOnCapitalPct: number | null; detail: string };
  summary: string;
}

function greeksFor(row: { symbol: string; legs: unknown }) {
  return positionGreeks(row.symbol, row.legs as QuoteLeg[]);
}

export async function buildOptionsPerformanceView(userId: string): Promise<OptionsPerformanceView> {
  const rows = await db.select().from(tradesTable).where(eq(tradesTable.userId, userId));
  const openRows = rows.filter((r) => r.status !== "closed");
  const closedRows = rows.filter((r) => r.status === "closed");

  const thetaPositions: ThetaPosition[] = openRows.map((r) => ({ symbol: r.symbol, strategy: r.strategy, theta: greeksFor(r).theta }));
  const income = buildIncomeOverview(
    openRows.map((r) => ({ credit: r.credit, maxLoss: r.maxLoss })),
    closedRows.map((r) => ({ credit: r.credit })),
    thetaPositions,
  );
  const incomeAttribution = buildStrategyMix(openRows.map((r) => ({ strategy: r.strategy, maxLoss: r.maxLoss })));

  const trades: OptionsTradePerformance[] = rows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    strategy: r.strategy,
    status: r.status,
    credit: r.credit,
    currentPnl: r.status === "closed" ? (r.currentPnl ?? null) : null,
    currentPnlPercent: r.status === "closed" ? (r.currentPnlPercent ?? null) : null,
    holdingDays: holdingPeriodDays(r.openDate, r.closeDate ?? null),
  }));

  const closedDecided = trades.filter((t) => t.status === "closed" && t.currentPnl != null);
  const winning = closedDecided.filter((t) => (t.currentPnl as number) > 0);
  const losing = closedDecided.filter((t) => (t.currentPnl as number) < 0);
  const decidedCount = winning.length + losing.length;
  const winRate = decidedCount > 0 ? round2((winning.length / decidedCount) * 100) : null;
  const averageWin = winning.length > 0 ? round2(winning.reduce((s, t) => s + (t.currentPnl as number), 0) / winning.length) : null;
  const averageLoss = losing.length > 0 ? round2(losing.reduce((s, t) => s + (t.currentPnl as number), 0) / losing.length) : null;
  const totalRealizedPnl = closedDecided.length > 0 ? round2(closedDecided.reduce((s, t) => s + (t.currentPnl as number), 0)) : null;

  const strategyAttribution = attributeByKey(closedDecided.map((t) => ({ key: t.strategy, label: t.strategy, pnl: t.currentPnl as number })));
  const assetAttribution = attributeByKey(closedDecided.map((t) => ({ key: t.symbol, label: t.symbol, pnl: t.currentPnl as number })));

  const riskAdjusted = computeRiskAdjusted(closedDecided.filter((t) => t.currentPnlPercent != null).map((t) => t.currentPnlPercent as number));

  const capitalCommitted = closedRows.reduce((s, r) => s + Math.abs(r.maxLoss), 0);
  const returnOnCapitalPct = totalRealizedPnl != null && capitalCommitted > 0 ? round2((totalRealizedPnl / capitalCommitted) * 100) : null;

  return {
    openPositionsCount: openRows.length,
    closedPositionsCount: closedRows.length,
    winningTrades: winning.length,
    losingTrades: losing.length,
    winRate,
    averageWin,
    averageLoss,
    totalRealizedPnl,
    income,
    trades,
    strategyAttribution,
    assetAttribution,
    incomeAttribution,
    riskAdjusted,
    capitalEfficiency: {
      capitalCommitted: capitalCommitted > 0 ? round2(capitalCommitted) : null,
      returnOnCapitalPct,
      detail:
        returnOnCapitalPct != null
          ? `Realized P&L relative to the max-loss capital committed on closed positions: ${returnOnCapitalPct.toFixed(2)}%.`
          : "Capital efficiency is unavailable — no closed positions with a recorded max-loss figure yet.",
    },
    summary:
      rows.length === 0
        ? "This user has no Options positions on record yet."
        : `${rows.length} position(s) on record (${openRows.length} open, ${closedRows.length} closed). ${winRate != null ? `Win rate ${winRate.toFixed(1)}%.` : "No decided closed trades yet."}`,
  };
}

// ─── 4. Combined (cross-engine) performance view ────────────────────────────

export interface EnginePerformanceSummary {
  engine: "investing" | "trading" | "options";
  label: string;
  totalPnl: number | null;
  pnlLabel: string;
}

export interface CombinedSectorAttributionEntry {
  engine: "investing";
  sector: string;
  pnl: number;
}

export interface CombinedStrategyAttributionEntry {
  engine: "trading" | "options";
  key: string;
  label: string;
  pnl: number;
}

export interface CombinedAssetAttributionEntry {
  engine: "investing" | "trading" | "options";
  symbol: string;
  pnl: number;
}

export interface CombinedCapitalEfficiencyEntry {
  engine: "investing" | "trading" | "options";
  label: string;
  returnPct: number | null;
}

export interface CombinedRiskAdjustedEntry {
  engine: "investing" | "trading" | "options";
  available: boolean;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
}

export interface CombinedPerformanceView {
  byEngine: EnginePerformanceSummary[];
  sectorAttribution: CombinedSectorAttributionEntry[];
  strategyAttribution: CombinedStrategyAttributionEntry[];
  assetAttribution: CombinedAssetAttributionEntry[];
  capitalEfficiency: CombinedCapitalEfficiencyEntry[];
  riskAdjusted: CombinedRiskAdjustedEntry[];
}

export function buildCombinedPerformanceView(investing: InvestingPerformanceView, trading: TradingPerformanceView, options: OptionsPerformanceView): CombinedPerformanceView {
  const byEngine: EnginePerformanceSummary[] = [
    { engine: "investing", label: "Investing (unrealized)", totalPnl: investing.totalUnrealizedPnl, pnlLabel: "Unrealized P&L" },
    { engine: "trading", label: "Trading (realized)", totalPnl: trading.totalRealizedPnl, pnlLabel: "Realized P&L" },
    { engine: "options", label: "Options (realized)", totalPnl: options.totalRealizedPnl, pnlLabel: "Realized P&L" },
  ];

  const sectorAttribution: CombinedSectorAttributionEntry[] = investing.sectorAttribution.map((s) => ({ engine: "investing" as const, sector: s.label, pnl: s.pnl }));

  const strategyAttribution: CombinedStrategyAttributionEntry[] = [
    ...trading.strategyAttribution.map((s) => ({ engine: "trading" as const, key: s.key, label: s.label, pnl: s.pnl })),
    ...options.strategyAttribution.map((s) => ({ engine: "options" as const, key: s.key, label: s.label, pnl: s.pnl })),
  ];

  const assetAttribution: CombinedAssetAttributionEntry[] = [
    ...investing.assetAttribution.map((a) => ({ engine: "investing" as const, symbol: a.key, pnl: a.pnl })),
    ...trading.assetAttribution.map((a) => ({ engine: "trading" as const, symbol: a.key, pnl: a.pnl })),
    ...options.assetAttribution.map((a) => ({ engine: "options" as const, symbol: a.key, pnl: a.pnl })),
  ].sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));

  const capitalEfficiency: CombinedCapitalEfficiencyEntry[] = [
    { engine: "investing", label: "Investing — return on deployed cost basis", returnPct: investing.capitalEfficiency.returnOnDeployedCapitalPct },
    { engine: "trading", label: "Trading — return on capital committed", returnPct: trading.capitalEfficiency.returnOnCapitalPct },
    { engine: "options", label: "Options — return on max-loss capital committed", returnPct: options.capitalEfficiency.returnOnCapitalPct },
  ];

  const riskAdjusted: CombinedRiskAdjustedEntry[] = [
    { engine: "investing", available: investing.riskAdjusted.available, sharpeRatio: investing.riskAdjusted.sharpeRatio, sortinoRatio: investing.riskAdjusted.sortinoRatio },
    { engine: "trading", available: trading.riskAdjusted.available, sharpeRatio: trading.riskAdjusted.sharpeRatio, sortinoRatio: trading.riskAdjusted.sortinoRatio },
    { engine: "options", available: options.riskAdjusted.available, sharpeRatio: options.riskAdjusted.sharpeRatio, sortinoRatio: options.riskAdjusted.sortinoRatio },
  ];

  return { byEngine, sectorAttribution, strategyAttribution, assetAttribution, capitalEfficiency, riskAdjusted };
}

// ─── 5. Historical Performance Timeline ─────────────────────────────────────
//
// Real timestamp reconstruction, mirroring Phase 36's Options Exposure
// Timeline pattern — no snapshot table, no scheduled job. Options/Trading
// sum real realized P&L per real close-month; Investing (which has no
// realized-P&L history at all) instead shows real, user-saved market value
// over time from investing_portfolio_snapshots — an honestly narrower,
// differently-sourced series, never fabricated to look like a P&L series.

export interface PerformanceTimelinePoint {
  monthEnd: string;
  source: "options-realized" | "trading-realized" | "investing-market-value";
  detail: string;
  value: number | null;
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthEndLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${key}-${String(lastDay).padStart(2, "0")}`;
}

function sumPnlByMonth(entries: { closeDate: Date; pnl: number }[], source: "options-realized" | "trading-realized", label: string): PerformanceTimelinePoint[] {
  const byMonth = new Map<string, number>();
  for (const e of entries) {
    const key = monthKey(e.closeDate);
    byMonth.set(key, (byMonth.get(key) ?? 0) + e.pnl);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, pnl]) => ({ monthEnd: monthEndLabel(key), source, detail: `${label}: ${round2(pnl) >= 0 ? "+" : ""}${round2(pnl).toLocaleString()}`, value: round2(pnl) }));
}

export async function buildPerformanceTimeline(userId: string, tradingRows: TradingPositionPerformance[], optionsRows: OptionsTradePerformance[]): Promise<PerformanceTimelinePoint[]> {
  const [tradingPositionRows, optionsTradeRows, snapshotRows] = await Promise.all([
    db.select({ id: tradingPositionsTable.id, exitDate: tradingPositionsTable.exitDate }).from(tradingPositionsTable).where(and(eq(tradingPositionsTable.userId, userId), eq(tradingPositionsTable.status, "closed"))),
    db.select({ id: tradesTable.id, closeDate: tradesTable.closeDate }).from(tradesTable).where(and(eq(tradesTable.userId, userId), eq(tradesTable.status, "closed"))),
    db.select().from(investingPortfolioSnapshotsTable).where(eq(investingPortfolioSnapshotsTable.userId, userId)).orderBy(desc(investingPortfolioSnapshotsTable.createdAt)).limit(24),
  ]);

  const tradingPnlByPositionId = new Map(tradingRows.map((p) => [p.id, p.realizedPnl]));
  const tradingEntries = tradingPositionRows
    .filter((r) => r.exitDate != null)
    .map((r) => ({ closeDate: r.exitDate as Date, pnl: tradingPnlByPositionId.get(r.id) ?? null }))
    .filter((e): e is { closeDate: Date; pnl: number } => e.pnl != null);

  const optionsPnlByTradeId = new Map(optionsRows.map((t) => [t.id, t.currentPnl]));
  const optionsEntries = optionsTradeRows
    .filter((r) => r.closeDate != null)
    .map((r) => ({ closeDate: r.closeDate as Date, pnl: optionsPnlByTradeId.get(r.id) ?? null }))
    .filter((e): e is { closeDate: Date; pnl: number } => e.pnl != null);

  const tradingTimeline = sumPnlByMonth(tradingEntries, "trading-realized", "Trading realized P&L");
  const optionsTimeline = sumPnlByMonth(optionsEntries, "options-realized", "Options realized P&L");

  const investingTimeline: PerformanceTimelinePoint[] = snapshotRows
    .slice()
    .reverse()
    .map((r) => ({
      monthEnd: r.createdAt.toISOString().slice(0, 10),
      source: "investing-market-value" as const,
      detail: `Saved Investing portfolio market value (portfolio #${r.portfolioId})`,
      value: r.totalMarketValue,
    }));

  return [...investingTimeline, ...tradingTimeline, ...optionsTimeline].sort((a, b) => a.monthEnd.localeCompare(b.monthEnd));
}

// ─── Full dashboard orchestration ───────────────────────────────────────────

export interface PerformanceDashboard {
  investing: InvestingPerformanceView;
  trading: TradingPerformanceView;
  options: OptionsPerformanceView;
  combined: CombinedPerformanceView;
  timeline: PerformanceTimelinePoint[];
  generatedAt: string;
}

export async function buildPerformanceDashboard(userId: string): Promise<PerformanceDashboard> {
  // getSettingsRow() (lib/serverState.ts) is a plain check-then-insert with
  // no upsert safety — a known, pre-existing dormant race for a brand-new
  // user whose settings row doesn't exist yet (first documented in
  // lib/riskExposureEngine.ts, Phase 37). This module fans out multiple
  // concurrent settings-touching reads for the same user in one request
  // too (getFundamentalsProvider/getMarketDataProvider both read settings),
  // so the same guard is applied here: resolve the settings row once, up
  // front, before the concurrent fan-out below.
  await getSettingsRow(userId);

  const [investing, trading, options] = await Promise.all([buildInvestingPerformanceView(userId), buildTradingPerformanceView(userId), buildOptionsPerformanceView(userId)]);

  const combined = buildCombinedPerformanceView(investing, trading, options);
  const timeline = await buildPerformanceTimeline(userId, trading.positions, options.trades);

  return { investing, trading, options, combined, timeline, generatedAt: new Date().toISOString() };
}
