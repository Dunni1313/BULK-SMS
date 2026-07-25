// v1.3.0, Sprint 1 — AI Trading Coach, Backend Foundation (approved design
// doc: docs/v1.3.0-AI-Trading-Coach-Design.md). A pure COMPOSITION layer,
// introducing zero new trading/scoring/risk calculations — every fact in
// the returned context is a direct read of an already-computed,
// already-tested value from an existing module. This is the "genuinely
// new work" the design doc's §1c identified: Sprint 47/Phase 29's
// existing coach infrastructure (routes/tradingCoach.ts,
// lib/tradingCoach.ts) has zero visibility into Scanner, the Trade
// Execution Center's candidates, or the options-income Portfolio/
// Dashboard side of the platform. This module closes exactly that gap by
// composing:
//
//   - Market Structure Engine / Multi-Timeframe / Liquidity / Regime /
//     Probability (Engine 2) — buildProbabilityAnalysis(), unmodified,
//     the exact same single call Sprint 47's own buildTradeCoachContext()
//     already uses.
//   - The user's own Engine 2 trading_positions risk analysis —
//     buildTradingRiskAnalysis(), unmodified, same Sprint 47 precedent.
//   - The options-income Portfolio + Options Dashboard + Scanner + AI
//     Opportunity Score (Engine 3) — assembleDailyReport(), unmodified.
//     This ONE call already returns portfolio health, risk/greeks
//     summary, market regime, open position threats, and the top-5
//     scanner opportunities (ravishScore/ravishTier/pop/ev/theta) — see
//     lib/dailyReport.ts's own ReportOpportunity type — so no separate
//     scanner query or portfolio computation is needed here at all.
//   - A specific scanner candidate (Trade Execution Center's own
//     "candidate in focus"), when the caller supplies one — a single-row
//     lookup, mirroring scanner.ts's own established query shape.
//   - The user's 5 most recent Trading Journal reflections — the exact
//     query shape routes/tradingCoach.ts's own gatherUserContext() uses.
//
// Never touches execution.ts/optionsMath.ts/risk.ts/autoExecution.ts/
// autoAdjustment.ts, and never will — every value here is a READ of
// already-computed output from those systems via existing exported
// functions, never a new computation and never a write.

import { db, tradingJournalEntriesTable, tradingPositionsTable, scannerResultsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { buildProbabilityAnalysis, type ProbabilityAnalysis } from "./tradingProbability.js";
import {
  buildTradingRiskAnalysis,
  type TradingPositionInput,
  type TradingRiskAnalysisWithContext,
} from "./tradingRisk.js";
import { getMarketDataProvider, type MarketDataProvider } from "./tradingMarketData.js";
import { assembleDailyReport, type DailyReport } from "./dailyReport.js";
import { getSettingsRow } from "./serverState.js";

type TradingJournalEntryRow = typeof tradingJournalEntriesTable.$inferSelect;

// How many of the user's own most recent journal entries to surface —
// bounded, matching Sprint 47's own RECENT_JOURNAL_ENTRIES_LIMIT exactly.
const RECENT_JOURNAL_ENTRIES_LIMIT = 5;

export interface UnifiedCoachRequestOptions {
  /** A specific symbol in focus (e.g. from a Workbench page or Scanner row). */
  symbol?: string;
  /** A specific trading_positions row id already scoped to this user, for
   * a portfolio-risk-context question about one particular position. Not
   * used to filter the overall portfolio risk read below — that already
   * covers every open position — only surfaced for narration convenience
   * if a future sprint wants to highlight one position by id. */
  tradingPositionId?: number;
  /** A specific scanner_results row id (Scanner / Trade Execution Center
   * "candidate in focus"). Resolved as a single-row, ownership-scoped
   * lookup — never a second scan, never a fabricated candidate. */
  scannerCandidateId?: number;
}

export interface FocusScannerCandidateContext {
  symbol: string;
  strategy: string;
  ravishScore: number;
  ravishTier: string;
  pop: number;
  ev: number;
  credit: number | null;
  maxProfit: number;
  maxLoss: number;
  expiration: string | null;
  eventRiskLevel: string;
}

export interface MarketStructureContext {
  dataSource: "SIMULATED" | "LIVE";
  currentPrice: number;
  regimeLabel: string;
  volatilityRegime: string;
  liquidityRegime: string;
  dominantTrend: string | null;
  trendAgreement: string;
  confluenceScore: number | null;
  liquidityBand: string;
  probabilityAvailable: boolean;
  probabilitySummary: string;
  summary: string;
}

export interface TradingPortfolioRiskContext {
  overall: TradingRiskAnalysisWithContext["overall"];
  positionSizing: {
    label: TradingRiskAnalysisWithContext["positionSizing"]["label"];
    detail: TradingRiskAnalysisWithContext["positionSizing"]["detail"];
    capBreached: TradingRiskAnalysisWithContext["positionSizing"]["capBreached"];
  };
  stopDiscipline: {
    label: TradingRiskAnalysisWithContext["stopDiscipline"]["label"];
    detail: TradingRiskAnalysisWithContext["stopDiscipline"]["detail"];
  };
  portfolioBudget: {
    label: TradingRiskAnalysisWithContext["portfolioBudget"]["label"];
    detail: TradingRiskAnalysisWithContext["portfolioBudget"]["detail"];
    capBreached: TradingRiskAnalysisWithContext["portfolioBudget"]["capBreached"];
  };
  openPositionsCount: number;
  accountValue: number | null;
}

export interface OptionsPortfolioContext {
  health: DailyReport["health"];
  summary: DailyReport["summary"];
  marketRegime: DailyReport["market"];
  openPositions: DailyReport["positions"];
  topOpportunities: DailyReport["opportunities"];
  tradesToAvoid: DailyReport["tradesToAvoid"];
}

export interface RecentJournalReflection {
  title: string;
  mood: string;
  lessonLearned: string | null;
  createdAt: string;
}

export interface UnifiedCoachContext {
  focusSymbol: string | null;
  focusScannerCandidate: FocusScannerCandidateContext | null;
  marketStructure: MarketStructureContext | null;
  tradingPositionsRisk: TradingPortfolioRiskContext;
  optionsPortfolio: OptionsPortfolioContext;
  recentJournalReflections: RecentJournalReflection[];
}

function toJournalReflection(row: TradingJournalEntryRow): RecentJournalReflection {
  return {
    title: row.title,
    mood: row.mood,
    lessonLearned: row.lessonLearned ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toMarketStructureContext(probability: ProbabilityAnalysis): MarketStructureContext {
  const regime = probability.regime;
  return {
    dataSource: probability.dataSource,
    currentPrice: probability.currentPrice,
    regimeLabel: regime.regimeLabel,
    volatilityRegime: regime.volatilityRegime,
    liquidityRegime: regime.liquidityRegime,
    dominantTrend: regime.multiTimeframe.dominantTrend,
    trendAgreement: regime.multiTimeframe.trendAgreement,
    confluenceScore: regime.multiTimeframe.confluenceScore,
    liquidityBand: regime.liquidity.liquidityBand,
    probabilityAvailable: probability.available,
    probabilitySummary: probability.summary,
    summary: regime.summary,
  };
}

function toTradingRiskContext(risk: TradingRiskAnalysisWithContext): TradingPortfolioRiskContext {
  return {
    overall: risk.overall,
    positionSizing: {
      label: risk.positionSizing.label,
      detail: risk.positionSizing.detail,
      capBreached: risk.positionSizing.capBreached,
    },
    stopDiscipline: { label: risk.stopDiscipline.label, detail: risk.stopDiscipline.detail },
    portfolioBudget: {
      label: risk.portfolioBudget.label,
      detail: risk.portfolioBudget.detail,
      capBreached: risk.portfolioBudget.capBreached,
    },
    openPositionsCount: risk.openPositionsCount,
    accountValue: risk.accountValue,
  };
}

async function resolveFocusScannerCandidate(
  userId: string,
  scannerCandidateId: number,
): Promise<FocusScannerCandidateContext | null> {
  const [row] = await db
    .select()
    .from(scannerResultsTable)
    .where(eq(scannerResultsTable.id, scannerCandidateId));
  // Ownership-scoped: a candidate belonging to a different user is treated
  // exactly like "not found" — never leaked, matching every other
  // per-resource lookup's established 404-for-both-cases discipline.
  if (!row || row.userId !== userId) return null;
  return {
    symbol: row.symbol,
    strategy: row.strategy,
    ravishScore: row.ravishScore,
    ravishTier: row.ravishTier,
    pop: row.pop,
    ev: row.ev,
    credit: row.credit,
    maxProfit: row.maxProfit,
    maxLoss: row.maxLoss,
    expiration: row.expiration,
    eventRiskLevel: row.eventRiskLevel,
  };
}

async function resolveTradingPositionsRisk(
  userId: string,
  provider: MarketDataProvider,
): Promise<TradingPortfolioRiskContext> {
  // Mirrors routes/tradingCoach.ts's own gatherUserContext() exactly: a
  // direct, userId-scoped read of the user's own trading_positions, mapped
  // to TradingPositionInput, then handed to the unmodified, already-tested
  // buildTradingRiskAnalysis(). No new positions/risk logic here.
  const positionRows = await db.select().from(tradingPositionsTable).where(eq(tradingPositionsTable.userId, userId));
  const positions: TradingPositionInput[] = positionRows.map((r) => ({
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
  const risk = await buildTradingRiskAnalysis(positions, settings.tradingAccountValue ?? null, provider);
  return toTradingRiskContext(risk);
}

function toOptionsPortfolioContext(report: DailyReport): OptionsPortfolioContext {
  return {
    health: report.health,
    summary: report.summary,
    marketRegime: report.market,
    openPositions: report.positions,
    topOpportunities: report.opportunities,
    tradesToAvoid: report.tradesToAvoid,
  };
}

/**
 * Assembles the one grounding object the AI Trading Coach's free-form
 * narration is built from. Every field is sourced from an already-tested
 * engine's own exported function — see the file header for the exact
 * composition map. Concurrent where independent, per this codebase's own
 * established Promise.all discipline (e.g. buildPortfolioDashboard()).
 *
 * getSettingsRow() is resolved once, up front, before the concurrent
 * branches below — both assembleDailyReport() and
 * resolveTradingPositionsRisk() independently call it, and its own
 * check-then-insert (lib/serverState.ts, a pre-existing, already-disclosed
 * characteristic — see CLAUDE.md's Sprint 70/73 notes) is not safe to race
 * for a brand-new user with no settings row yet. Resolving it first, once,
 * means both branches' own later calls are simple SELECT hits against an
 * already-existing row — never a genuine INSERT race. serverState.ts
 * itself is untouched; this is a call-ordering fix scoped entirely to this
 * new function.
 */
export async function buildUnifiedCoachContext(
  userId: string,
  opts: UnifiedCoachRequestOptions = {},
): Promise<UnifiedCoachContext> {
  const provider = await getMarketDataProvider(userId);
  await getSettingsRow(userId);

  const [optionsReport, tradingPositionsRisk, journalRows, marketStructureRaw, focusScannerCandidate] =
    await Promise.all([
      assembleDailyReport(userId),
      resolveTradingPositionsRisk(userId, provider),
      db
        .select()
        .from(tradingJournalEntriesTable)
        .where(eq(tradingJournalEntriesTable.userId, userId))
        .orderBy(desc(tradingJournalEntriesTable.createdAt))
        .limit(RECENT_JOURNAL_ENTRIES_LIMIT),
      opts.symbol ? buildProbabilityAnalysis(opts.symbol.toUpperCase(), provider) : Promise.resolve(null),
      opts.scannerCandidateId != null
        ? resolveFocusScannerCandidate(userId, opts.scannerCandidateId)
        : Promise.resolve(null),
    ]);

  return {
    focusSymbol: opts.symbol ? opts.symbol.toUpperCase() : null,
    focusScannerCandidate,
    marketStructure: marketStructureRaw ? toMarketStructureContext(marketStructureRaw) : null,
    tradingPositionsRisk,
    optionsPortfolio: toOptionsPortfolioContext(optionsReport),
    recentJournalReflections: journalRows.map(toJournalReflection),
  };
}

/**
 * Deterministic, non-LLM fallback text — mirrors routes/tradingCoach.ts's
 * own tradeCoachFallback() shape exactly: honest about AI being
 * unavailable, then states the real deterministic facts the context
 * already contains. Never fabricates an answer to the actual question.
 */
export function unifiedCoachFallback(context: UnifiedCoachContext, question: string): string {
  const parts: string[] = [
    `AI narration is not available right now, so I can't directly answer "${question}". Here is what the deterministic data shows:`,
  ];

  if (context.marketStructure) {
    const ms = context.marketStructure;
    parts.push(
      `${context.focusSymbol} is in a ${ms.regimeLabel} regime (${ms.volatilityRegime} volatility, ${ms.liquidityRegime} liquidity), ` +
        `with multi-timeframe trend agreement ${ms.trendAgreement}${ms.dominantTrend ? ` (${ms.dominantTrend})` : ""}.`,
    );
  }

  if (context.focusScannerCandidate) {
    const c = context.focusScannerCandidate;
    parts.push(
      `The scanner candidate in focus (${c.symbol} ${c.strategy}) has a Ravish Score of ${c.ravishScore.toFixed(1)} (${c.ravishTier}), ` +
        `${(c.pop * 100).toFixed(0)}% probability of profit, and an expected value of ${c.ev.toFixed(2)}.`,
    );
  }

  const risk = context.tradingPositionsRisk;
  parts.push(
    `Your Engine 2 trading-position risk reads "${risk.overall.label}"` +
      `${risk.openPositionsCount > 0 ? ` across ${risk.openPositionsCount} open position(s)` : ", with no open positions"}.`,
  );

  const portfolio = context.optionsPortfolio;
  parts.push(
    `Your options-income portfolio health reads "${portfolio.health.health.label}" (${portfolio.health.health.score}/100), ` +
      `with ${portfolio.summary.openPositions} open position(s) and ${portfolio.topOpportunities.length} scanner opportunit${portfolio.topOpportunities.length === 1 ? "y" : "ies"} currently tracked.`,
  );

  return parts.join(" ");
}
