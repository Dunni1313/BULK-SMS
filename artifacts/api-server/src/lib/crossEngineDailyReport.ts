// Phase 5, Sprint 68 — Cross-Engine Daily Report (approved Phase 5 roadmap
// review; on-demand only — the user opens the report, nothing is scheduled,
// emailed, pushed, or run on a cron/background job).
//
// Pure COMPOSITION layer, zero new engine calculations of any kind — every
// figure here comes from a module already shipped and already covered by its
// own dedicated tests:
//   - Engine 1 (Investing): buildMacroContext() (Phase 2 Sprint 26, routed
//     since Phase 4 Sprint 55) for today's macro/rate regime, and
//     computeWatchlistTargets() (lib/watchlistTargets.ts, extracted Phase 4
//     Sprint 56 from Phase 2 Sprint 27's own "Check Targets" logic) run over
//     the user's own Value Watchlist to report which symbols crossed a
//     price/margin-of-safety target today.
//   - Engine 2 (Trading): buildTradingRiskAnalysis() (Phase 3 Sprint 38/44,
//     the same call GET /trading/risk and the Institutional Dashboard's own
//     Portfolio Risk card already make) for the user's own open trading
//     positions' risk status.
//   - Engine 3 (Options Income): assembleDailyReport() (the existing,
//     unmodified Portfolio AI Daily Report assembler) for the user's own
//     options-income portfolio health, unrealized P&L, and top scanner
//     opportunity.
//
// Deliberately bounded: Engine 1's section does NOT run a full Investment
// Committee/valuation pass per watchlist symbol (that would mean N extra
// buildValueResearchReport() calls, each itself composing 20+ analyzers —
// too expensive for an on-demand cross-engine summary) — only the already-
// cheap watchlist-target-crossing check, matching the same on-demand cost-
// control discipline every heavier Engine-1 module has followed since
// Sprint 19 (Statements/Peers/Filings/Earnings all stayed off the eager
// report path for the identical reason).
//
// Never fabricates: a user with no watchlist items gets an honest empty
// crossings list; buildTradingRiskAnalysis() itself already reports
// "insufficient data" honestly for a user with no positions/no account
// value set (Sprint 38's own established contract, reused unmodified here);
// assembleDailyReport() itself already handles a user with no open options
// trades (its own pre-existing, unmodified seeding/empty-state behavior).

import { db, valueWatchlistTable, tradingPositionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { buildMacroContext, type MacroContext } from "./investingMacro.js";
import { computeWatchlistTargets } from "./watchlistTargets.js";
import { getFundamentalsProvider } from "./fundamentals.js";
import { buildTradingRiskAnalysis, type TradingPositionInput, type TradingRiskAnalysisWithContext } from "./tradingRisk.js";
import { getMarketDataProvider } from "./tradingMarketData.js";
import { assembleDailyReport } from "./dailyReport.js";
import { getSettingsRow } from "./serverState.js";
import { todayStr } from "./deterministic.js";

export const CROSS_ENGINE_DAILY_REPORT_DISCLAIMER =
  "Advisory/education only. This report summarises SIMULATED and provider data already computed by " +
  "Engine 1, Engine 2, and Engine 3 — it never executes, adjusts, or schedules a trade, and it is generated " +
  "only when you open it, never sent automatically.";

export interface WatchlistCrossing {
  symbol: string;
  currentPrice: number | null;
  priceTargetCrossed: boolean | null;
  marginOfSafetyTargetCrossed: boolean | null;
}

export interface CrossEngineDailyReportEngine1 {
  macro: MacroContext;
  watchlistTotalItems: number;
  // Only items where at least one target genuinely crossed today — never a
  // fabricated "no change" entry for every watchlist row.
  watchlistCrossings: WatchlistCrossing[];
}

export interface CrossEngineDailyReportEngine2 {
  risk: TradingRiskAnalysisWithContext;
}

export interface CrossEngineDailyReportEngine3 {
  healthScore: number;
  healthLabel: string;
  openPositions: number;
  totalUnrealizedPnl: number;
  attentionCount: number;
  criticalCount: number;
  topOpportunitySymbol: string | null;
  topOpportunityRavishScore: number | null;
}

export interface CrossEngineDailyReport {
  date: string;
  generatedAt: string;
  engine1: CrossEngineDailyReportEngine1;
  engine2: CrossEngineDailyReportEngine2;
  engine3: CrossEngineDailyReportEngine3;
  // Deterministic, rule-based, never LLM-generated — mirrors dailyReport.ts's
  // own comparisonFallback() precedent: a summary sentence that reads well
  // with zero AI narration, so the report is never blank without an LLM key.
  summary: string;
  disclaimer: string;
}

function buildSummary(
  engine1: CrossEngineDailyReportEngine1,
  engine2: CrossEngineDailyReportEngine2,
  engine3: CrossEngineDailyReportEngine3,
): string {
  const parts: string[] = [];
  parts.push(`Macro regime: ${engine1.macro.regimeLabel}.`);
  if (engine1.watchlistCrossings.length > 0) {
    parts.push(
      `${engine1.watchlistCrossings.length} watchlist symbol${engine1.watchlistCrossings.length === 1 ? "" : "s"} crossed a target today: ${engine1.watchlistCrossings.map((c) => c.symbol).join(", ")}.`,
    );
  } else if (engine1.watchlistTotalItems > 0) {
    parts.push(`No watchlist symbols crossed a target today.`);
  } else {
    parts.push(`Watchlist is empty.`);
  }
  parts.push(`Trading risk: ${engine2.risk.overall.label}.`);
  parts.push(
    `Options income portfolio health: ${engine3.healthScore} (${engine3.healthLabel}), ${engine3.openPositions} open position${engine3.openPositions === 1 ? "" : "s"}.`,
  );
  if (engine3.criticalCount > 0) {
    parts.push(`${engine3.criticalCount} position${engine3.criticalCount === 1 ? "" : "s"} need${engine3.criticalCount === 1 ? "s" : ""} attention.`);
  }
  return parts.join(" ");
}

export async function buildCrossEngineDailyReport(userId: string, now: number = Date.now()): Promise<CrossEngineDailyReport> {
  const asOf = todayStr(new Date(now));

  // ── Engine 1 ──────────────────────────────────────────────────────────
  const macro = buildMacroContext(asOf);
  const watchlistRows = await db.select().from(valueWatchlistTable).where(eq(valueWatchlistTable.userId, userId));
  const fundamentalsProvider = await getFundamentalsProvider(userId);
  const watchlistCrossings: WatchlistCrossing[] = [];
  for (const row of watchlistRows) {
    const check = await computeWatchlistTargets(row, fundamentalsProvider);
    if (check.priceTargetCrossed === true || check.marginOfSafetyTargetCrossed === true) {
      watchlistCrossings.push({ symbol: row.symbol, ...check });
    }
  }
  const engine1: CrossEngineDailyReportEngine1 = {
    macro,
    watchlistTotalItems: watchlistRows.length,
    watchlistCrossings,
  };

  // ── Engine 2 ──────────────────────────────────────────────────────────
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
  const marketDataProvider = await getMarketDataProvider(userId);
  const risk = await buildTradingRiskAnalysis(positions, settings.tradingAccountValue ?? null, marketDataProvider);
  const engine2: CrossEngineDailyReportEngine2 = { risk };

  // ── Engine 3 ──────────────────────────────────────────────────────────
  const daily = await assembleDailyReport(userId, now);
  const topOpportunity = daily.opportunities[0] ?? null;
  const engine3: CrossEngineDailyReportEngine3 = {
    healthScore: daily.health.health.score,
    healthLabel: daily.health.health.label,
    openPositions: daily.summary.openPositions,
    totalUnrealizedPnl: daily.summary.totalUnrealizedPnl,
    attentionCount: daily.positions.filter((p) => p.threatLevel !== "green").length,
    criticalCount: daily.positions.filter((p) => p.threatLevel === "red").length,
    topOpportunitySymbol: topOpportunity?.symbol ?? null,
    topOpportunityRavishScore: topOpportunity?.ravishScore ?? null,
  };

  return {
    date: asOf,
    generatedAt: new Date(now).toISOString(),
    engine1,
    engine2,
    engine3,
    summary: buildSummary(engine1, engine2, engine3),
    disclaimer: CROSS_ENGINE_DAILY_REPORT_DISCLAIMER,
  };
}
