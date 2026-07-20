// Phase 22 — Institutional Reporting & Client Presentation Engine.
//
// Thin route wrapper, zero business logic of its own beyond composing
// already-shipped engines exactly as their own existing routes already do:
//   - buildValueResearchReport()/buildInstitutionalDecision()/
//     resolveDecisionManagementQuality()/resolveDecisionPortfolioContext()
//     (routes/stockAnalyst.ts, Phase 14/19/21) — company-level reports.
//   - buildInvestmentMemo() (Phase 19) — the Investment Memo section.
//   - explainCoach() (Phase 21) — the optional AI Coach section.
//   - buildPortfolioIntelligence()/buildPortfolioOptimisation() (Phase 13/18)
//     — portfolio-level reports.
//   - scanOpportunities()/bucketOpportunities() (Phase 15) — Opportunity
//     Discovery Report.
//   - computeWatchlistTargets() (Phase 4 Sprint 56 / Phase 2 Sprint 27) —
//     Watchlist Report.
//   - getLearningProgress() (Phase 21 Learning Centre) — AI Coach Learning
//     Summary.
//   - buildCrossEngineDailyReport() (Phase 5 Sprint 68) — Executive Summary.
//
// Every generate route recomputes fresh from these engines — no new
// analysis, no new scoring, no new recommendation. POST /reporting/reports
// re-generates server-side (never trusts a client-supplied report body) and
// persists it, mirroring routes/portfolioAI.ts's own POST /reports pattern
// exactly (Phase 3).

import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  institutionalReportsTable,
  investingHoldingsTable,
  investingPortfoliosTable,
  investingResearchNotesTable,
  platformNotificationsTable,
  valueWatchlistTable,
  tradingTradePlansTable,
  tradingPositionsTable,
  tradingStrategiesTable,
  tradingStrategyChecklistsTable,
  tradingWorkspaceNotesTable,
} from "@workspace/db";
import {
  GetReportTypesResponse,
  GetInvestmentCommitteeReportResponse,
  GetCompanyResearchReportResponse,
  GetPortfolioReviewReportResponse,
  GetPortfolioHealthReportResponse,
  GetWatchlistReportResponse,
  GetOpportunityDiscoveryReportResponse,
  GetMonitoringSummaryReportResponse,
  GetAiCoachLearningSummaryReportResponse,
  GetExecutiveSummaryReportResponse,
  GetTradePlanningSummaryReportResponse,
  GetStrategyFrameworkSummaryReportResponse,
  GetTradingAnalyticsSummaryReportResponse,
  SaveInstitutionalReportBody,
  SaveInstitutionalReportResponse,
  ListInstitutionalReportsResponse,
  GetSavedInstitutionalReportResponse,
  DeleteInstitutionalReportResponse,
} from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";
import { getFundamentalsProvider, resolveFundamentals } from "../lib/fundamentals.js";
import { buildValueResearchReport } from "../lib/valueReport.js";
import { buildInstitutionalDecision } from "../lib/decisionEngine.js";
import { buildInvestmentMemo, type InvestmentMemoResearchNote, type InvestmentMemoMonitoringAlert } from "../lib/investmentMemo.js";
import { explainCoach, COACH_TYPES, type CoachType, type CoachNotification } from "../lib/investingCoach.js";
import { buildPortfolioIntelligence } from "../lib/portfolioIntelligence.js";
import { buildPortfolioOptimisation } from "../lib/portfolioOptimisation.js";
import type { PortfolioHoldingInput } from "../lib/portfolioConstruction.js";
import { scanOpportunities, bucketOpportunities, buildOpportunityRow, type OpportunityRow } from "../lib/opportunityDiscovery.js";
import { computeWatchlistTargets } from "../lib/watchlistTargets.js";
import { getLearningProgress } from "../lib/learningProgress.js";
import { buildCrossEngineDailyReport } from "../lib/crossEngineDailyReport.js";
import { buildTradingRiskAnalysis, type TradingPositionInput } from "../lib/tradingRisk.js";
import { getMarketDataProvider } from "../lib/tradingMarketData.js";
import { getSettingsRow } from "../lib/serverState.js";
import { resolveDecisionManagementQuality, resolveDecisionPortfolioContext } from "./stockAnalyst.js";
import { formatNotification } from "./notifications.js";
import {
  REPORT_TYPE_META,
  buildInvestmentCommitteeReport,
  buildCompanyResearchReport,
  buildPortfolioReviewReport,
  buildPortfolioHealthReport,
  buildWatchlistReport,
  buildOpportunityDiscoveryReport,
  buildMonitoringSummaryReport,
  buildAiCoachLearningSummaryReport,
  buildExecutiveSummaryReport,
  buildTradePlanningSummaryReport,
  buildStrategyFrameworkSummaryReport,
  buildTradingAnalyticsSummaryReport,
  type InstitutionalReport,
  type InstitutionalReportType,
  type WatchlistReportItem,
  type TradePlanSummaryItem,
  type StrategyFrameworkChecklistSummaryItem,
  type StrategyFrameworkLearningCoverageItem,
  type StrategyFrameworkWorkspaceNoteItem,
} from "../lib/institutionalReporting.js";
import {
  isStrategyWorkspaceNoteSymbol,
  parseStrategyIdFromWorkspaceNoteSymbol,
  type StrategyMetadata,
  type StrategyCategory,
  type EvidenceSourceType,
} from "../lib/tradingStrategyFramework.js";
import type { Timeframe } from "../lib/tradingMarketData.js";
import { buildTradingAnalyticsDashboard } from "../lib/tradingAnalytics.js";
import { loadTradingAnalyticsInputs } from "./tradingAnalytics.js";

const router: IRouter = Router();

router.get("/reporting/types", (_req, res): void => {
  res.json(GetReportTypesResponse.parse(REPORT_TYPE_META));
});

// ─── Symbol-scoped generate routes ──────────────────────────────────────────

async function loadCompanyContext(symbol: string, userId: string, portfolioIdRaw: unknown) {
  const report = await buildValueResearchReport(symbol, undefined, undefined, undefined, undefined, userId);
  if (!report) return null;
  const provider = await getFundamentalsProvider(userId);
  const managementQuality = await resolveDecisionManagementQuality(report.symbol, provider, userId);
  const portfolioId = typeof portfolioIdRaw === "string" && Number.isInteger(Number(portfolioIdRaw)) ? Number(portfolioIdRaw) : null;
  const portfolioContext = portfolioId != null ? await resolveDecisionPortfolioContext(report, portfolioId, userId) : null;
  const decision = buildInstitutionalDecision(report, managementQuality, portfolioContext);
  return { report, decision };
}

router.get("/reporting/investment-committee/:symbol", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const ctx = await loadCompanyContext(req.params.symbol, userId, req.query.portfolioId);
  if (!ctx) {
    res.status(404).json({ error: `Unknown symbol: ${req.params.symbol}` });
    return;
  }
  const built = buildInvestmentCommitteeReport(ctx.report, ctx.decision);
  res.json(GetInvestmentCommitteeReportResponse.parse(built));
});

router.get("/reporting/company-research/:symbol", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const ctx = await loadCompanyContext(req.params.symbol, userId, req.query.portfolioId);
  if (!ctx) {
    res.status(404).json({ error: `Unknown symbol: ${req.params.symbol}` });
    return;
  }
  const { report, decision } = ctx;

  const [noteRows, alertRows] = await Promise.all([
    db
      .select()
      .from(investingResearchNotesTable)
      .where(and(eq(investingResearchNotesTable.userId, userId), eq(investingResearchNotesTable.symbol, report.symbol)))
      .orderBy(desc(investingResearchNotesTable.createdAt)),
    db
      .select()
      .from(platformNotificationsTable)
      .where(and(eq(platformNotificationsTable.userId, userId), eq(platformNotificationsTable.relatedSymbol, report.symbol)))
      .orderBy(desc(platformNotificationsTable.createdAt)),
  ]);
  const researchNotes: InvestmentMemoResearchNote[] = noteRows.map((n) => ({ note: n.note, createdAt: n.createdAt.toISOString() }));
  const monitoringAlerts: InvestmentMemoMonitoringAlert[] = alertRows.map(formatNotification);

  const memo = buildInvestmentMemo(report, decision, researchNotes, monitoringAlerts);

  const includeCoachRaw = req.query.includeCoach;
  const coachNotifications: CoachNotification[] = alertRows.map(formatNotification);
  const coachExplanations =
    includeCoachRaw === "true" ? COACH_TYPES.map((c: CoachType) => explainCoach(c, { report, decision, alerts: coachNotifications })) : [];

  const built = buildCompanyResearchReport(report, decision, memo, researchNotes, monitoringAlerts, coachExplanations);
  res.json(GetCompanyResearchReportResponse.parse(built));
});

// ─── Portfolio-scoped generate routes ───────────────────────────────────────

async function resolveOwnedPortfolio(portfolioIdRaw: string, userId: string) {
  const portfolioId = Number(portfolioIdRaw);
  if (!Number.isInteger(portfolioId)) return null;
  const [portfolio] = await db
    .select({ id: investingPortfoliosTable.id, name: investingPortfoliosTable.name })
    .from(investingPortfoliosTable)
    .where(and(eq(investingPortfoliosTable.id, portfolioId), eq(investingPortfoliosTable.userId, userId)));
  if (!portfolio) return null;
  const holdingRows = await db
    .select()
    .from(investingHoldingsTable)
    .where(and(eq(investingHoldingsTable.portfolioId, portfolioId), eq(investingHoldingsTable.userId, userId)));
  const holdingInputs: PortfolioHoldingInput[] = holdingRows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    targetWeightPct: r.targetWeightPct,
    shares: r.shares,
    avgCostBasis: r.avgCostBasis,
    notes: r.notes,
  }));
  return { portfolioId, name: portfolio.name, holdingInputs };
}

router.get("/reporting/portfolio-review/:portfolioId", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const resolved = await resolveOwnedPortfolio(req.params.portfolioId, userId);
  if (!resolved) {
    res.status(404).json({ error: "Portfolio not found" });
    return;
  }
  const provider = await getFundamentalsProvider(userId);
  const [intelligence, universeScan] = await Promise.all([
    buildPortfolioIntelligence(resolved.holdingInputs, provider),
    scanOpportunities(provider, undefined, userId),
  ]);
  const distinctHeldSymbols = [...new Set(resolved.holdingInputs.map((h) => h.symbol.toUpperCase()))];
  const heldRowSettled = await Promise.all(
    distinctHeldSymbols.map(async (symbol): Promise<OpportunityRow | null> => {
      const f = await resolveFundamentals(provider, symbol).catch(() => null);
      if (!f) return null;
      const report = await buildValueResearchReport(symbol, f.asOf, provider, f, undefined, userId).catch(() => null);
      if (!report) return null;
      return buildOpportunityRow(f, report);
    }),
  );
  const heldRows = heldRowSettled.filter((r): r is OpportunityRow => r !== null);
  const optimisation = buildPortfolioOptimisation(resolved.portfolioId, intelligence, heldRows, universeScan.rows);
  const built = buildPortfolioReviewReport(resolved.portfolioId, resolved.name, optimisation);
  res.json(GetPortfolioReviewReportResponse.parse(built));
});

router.get("/reporting/portfolio-health/:portfolioId", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const resolved = await resolveOwnedPortfolio(req.params.portfolioId, userId);
  if (!resolved) {
    res.status(404).json({ error: "Portfolio not found" });
    return;
  }
  const provider = await getFundamentalsProvider(userId);
  const intelligence = await buildPortfolioIntelligence(resolved.holdingInputs, provider);
  const built = buildPortfolioHealthReport(resolved.portfolioId, resolved.name, intelligence);
  res.json(GetPortfolioHealthReportResponse.parse(built));
});

// ─── Global (non-symbol, non-portfolio) generate routes ─────────────────────

router.get("/reporting/watchlist", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const provider = await getFundamentalsProvider(userId);
  const rows = await db.select().from(valueWatchlistTable).where(eq(valueWatchlistTable.userId, userId));
  const items: WatchlistReportItem[] = await Promise.all(
    rows.map(async (row) => ({
      symbol: row.symbol,
      category: row.category,
      reason: row.reason,
      currentDecision: row.currentDecision,
      check: await computeWatchlistTargets(row, provider),
    })),
  );
  const built = buildWatchlistReport(items);
  res.json(GetWatchlistReportResponse.parse(built));
});

router.get("/reporting/opportunity-discovery", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const provider = await getFundamentalsProvider(userId);
  const scan = await scanOpportunities(provider, undefined, userId);
  const buckets = bucketOpportunities(scan.rows, {});
  const built = buildOpportunityDiscoveryReport(scan, buckets);
  res.json(GetOpportunityDiscoveryReportResponse.parse(built));
});

router.get("/reporting/monitoring-summary", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const rows = await db
    .select()
    .from(platformNotificationsTable)
    .where(eq(platformNotificationsTable.userId, userId))
    .orderBy(desc(platformNotificationsTable.createdAt));
  const alerts: InvestmentMemoMonitoringAlert[] = rows.map(formatNotification);
  const built = buildMonitoringSummaryReport(alerts);
  res.json(GetMonitoringSummaryReportResponse.parse(built));
});

router.get("/reporting/ai-coach-summary", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const progress = await getLearningProgress(userId);
  const built = buildAiCoachLearningSummaryReport(progress);
  res.json(GetAiCoachLearningSummaryReportResponse.parse(built));
});

router.get("/reporting/executive-summary", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const cross = await buildCrossEngineDailyReport(userId);
  const built = buildExecutiveSummaryReport(cross);
  res.json(GetExecutiveSummaryReportResponse.parse(built));
});

// ─── Trade Planning Summary Report (Phase 28) — the calling user's own
// trading_trade_plans rows + lib/tradingRisk.ts's own TradingRiskAnalysis,
// resolved the exact same way routes/tradingTradePlans.ts's own
// GET /trading/trade-plans and routes/tradingRisk.ts's own GET /trading/risk
// already do. Zero new queries beyond what those two routes already run. ───

async function loadTradePlanningSummaryInputs(userId: string) {
  const planRows = await db
    .select()
    .from(tradingTradePlansTable)
    .where(eq(tradingTradePlansTable.userId, userId))
    .orderBy(desc(tradingTradePlansTable.createdAt));
  const plans: TradePlanSummaryItem[] = planRows.map((p) => ({
    symbol: p.symbol,
    direction: p.direction,
    status: p.status,
    thesis: p.thesis,
    positionSize: p.positionSize ?? null,
    riskRewardRatio: p.riskRewardRatio ?? null,
  }));

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
  const provider = await getMarketDataProvider(userId);
  const risk = await buildTradingRiskAnalysis(positions, settings.tradingAccountValue ?? null, provider);

  return { plans, risk };
}

router.get("/reporting/trade-planning-summary", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const { plans, risk } = await loadTradePlanningSummaryInputs(userId);
  const built = buildTradePlanningSummaryReport(plans, risk);
  res.json(GetTradePlanningSummaryReportResponse.parse(built));
});

// ─── Strategy Framework Summary Report (Phase 30, extended Phase 31) —
// resolved the exact same way routes/tradingStrategies.ts's own
// GET /trading/strategies and routes/tradingStrategyChecklists.ts's own
// list routes already do. Learning Coverage reuses getLearningProgress()'s
// own viewedStrategyKeys (Phase 31 addition, itself reusing an
// already-computed variable — zero new query there); Workspace Notes
// reuses the existing trading_workspace_notes table (Phase 25), filtered
// to the STRATEGY:<id> pseudo-symbol convention
// (isStrategyWorkspaceNoteSymbol/parseStrategyIdFromWorkspaceNoteSymbol,
// lib/tradingStrategyFramework.ts) — no new table, no new query shape
// beyond the one extra already-established list-by-user select. ─────────

async function loadStrategyFrameworkSummaryInputs(userId: string) {
  const strategyRows = await db.select().from(tradingStrategiesTable).where(eq(tradingStrategiesTable.userId, userId));
  const strategies: StrategyMetadata[] = strategyRows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category as StrategyCategory,
    timeframes: r.timeframes as Timeframe[],
    markets: r.markets as string[],
    requiredEvidence: r.requiredEvidence as EvidenceSourceType[],
    checklist: r.checklist,
    educationalNotes: r.educationalNotes,
    references: r.references as string[],
    version: r.version,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  const strategyNameById = new Map(strategies.map((s) => [s.id, s.name]));
  const checklistRows = await db.select().from(tradingStrategyChecklistsTable).where(eq(tradingStrategyChecklistsTable.userId, userId));
  const checklists: StrategyFrameworkChecklistSummaryItem[] = checklistRows.map((c) => ({
    strategyId: c.strategyId,
    strategyName: strategyNameById.get(c.strategyId) ?? `Strategy #${c.strategyId}`,
    symbol: c.symbol ?? null,
    status: c.status,
  }));

  const progress = await getLearningProgress(userId);
  const viewedKeys = new Set(progress.viewedStrategyKeys);
  const learningCoverage: StrategyFrameworkLearningCoverageItem[] = strategies.map((s) => ({
    strategyId: s.id,
    strategyName: s.name,
    viewed: viewedKeys.has(`strategy-framework:${s.id}`),
  }));

  const noteRows = await db.select().from(tradingWorkspaceNotesTable).where(eq(tradingWorkspaceNotesTable.userId, userId));
  const workspaceNotes: StrategyFrameworkWorkspaceNoteItem[] = noteRows
    .filter((n) => isStrategyWorkspaceNoteSymbol(n.symbol))
    .map((n) => {
      const strategyId = parseStrategyIdFromWorkspaceNoteSymbol(n.symbol);
      return {
        strategyId: strategyId ?? -1,
        strategyName: (strategyId !== null ? strategyNameById.get(strategyId) : undefined) ?? `Strategy #${strategyId ?? "?"}`,
        note: n.note,
        updatedAt: n.updatedAt.toISOString(),
      };
    });

  return { strategies, checklists, learningCoverage, workspaceNotes };
}

router.get("/reporting/strategy-framework-summary", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const { strategies, checklists, learningCoverage, workspaceNotes } = await loadStrategyFrameworkSummaryInputs(userId);
  const built = buildStrategyFrameworkSummaryReport(strategies, checklists, learningCoverage, workspaceNotes);
  res.json(GetStrategyFrameworkSummaryReportResponse.parse(built));
});

// ─── Trading Analytics Summary Report (Phase 32) — reuses
// routes/tradingAnalytics.ts's own loadTradingAnalyticsInputs()/
// buildTradingAnalyticsDashboard() exactly (the same functions
// GET /trading/analytics itself calls), then reformats the already-
// computed dashboard into the generic ReportSection shape. Zero new
// aggregation logic in this file. ──────────────────────────────────────────

router.get("/reporting/trading-analytics-summary", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const inputs = await loadTradingAnalyticsInputs(userId);
  const dashboard = buildTradingAnalyticsDashboard(inputs);
  const built = buildTradingAnalyticsSummaryReport(dashboard);
  res.json(GetTradingAnalyticsSummaryReportResponse.parse(built));
});

// ─── Persistence ─────────────────────────────────────────────────────────────

async function regenerate(
  userId: string,
  reportType: InstitutionalReportType,
  symbol: string | null | undefined,
  portfolioId: number | null | undefined,
): Promise<InstitutionalReport | null> {
  switch (reportType) {
    case "investment-committee": {
      if (!symbol) return null;
      const ctx = await loadCompanyContext(symbol, userId, portfolioId);
      return ctx ? buildInvestmentCommitteeReport(ctx.report, ctx.decision) : null;
    }
    case "company-research": {
      if (!symbol) return null;
      const ctx = await loadCompanyContext(symbol, userId, portfolioId);
      if (!ctx) return null;
      const memo = buildInvestmentMemo(ctx.report, ctx.decision, [], []);
      return buildCompanyResearchReport(ctx.report, ctx.decision, memo, [], [], []);
    }
    case "portfolio-review": {
      if (portfolioId == null) return null;
      const resolved = await resolveOwnedPortfolio(String(portfolioId), userId);
      if (!resolved) return null;
      const provider = await getFundamentalsProvider(userId);
      const [intelligence, universeScan] = await Promise.all([
        buildPortfolioIntelligence(resolved.holdingInputs, provider),
        scanOpportunities(provider, undefined, userId),
      ]);
      const distinctHeldSymbols = [...new Set(resolved.holdingInputs.map((h) => h.symbol.toUpperCase()))];
      const heldRowSettled = await Promise.all(
        distinctHeldSymbols.map(async (sym): Promise<OpportunityRow | null> => {
          const f = await resolveFundamentals(provider, sym).catch(() => null);
          if (!f) return null;
          const report = await buildValueResearchReport(sym, f.asOf, provider, f, undefined, userId).catch(() => null);
          if (!report) return null;
          return buildOpportunityRow(f, report);
        }),
      );
      const heldRows = heldRowSettled.filter((r): r is OpportunityRow => r !== null);
      const optimisation = buildPortfolioOptimisation(resolved.portfolioId, intelligence, heldRows, universeScan.rows);
      return buildPortfolioReviewReport(resolved.portfolioId, resolved.name, optimisation);
    }
    case "portfolio-health": {
      if (portfolioId == null) return null;
      const resolved = await resolveOwnedPortfolio(String(portfolioId), userId);
      if (!resolved) return null;
      const provider = await getFundamentalsProvider(userId);
      const intelligence = await buildPortfolioIntelligence(resolved.holdingInputs, provider);
      return buildPortfolioHealthReport(resolved.portfolioId, resolved.name, intelligence);
    }
    case "watchlist": {
      const provider = await getFundamentalsProvider(userId);
      const rows = await db.select().from(valueWatchlistTable).where(eq(valueWatchlistTable.userId, userId));
      const items: WatchlistReportItem[] = await Promise.all(
        rows.map(async (row) => ({
          symbol: row.symbol,
          category: row.category,
          reason: row.reason,
          currentDecision: row.currentDecision,
          check: await computeWatchlistTargets(row, provider),
        })),
      );
      return buildWatchlistReport(items);
    }
    case "opportunity-discovery": {
      const provider = await getFundamentalsProvider(userId);
      const scan = await scanOpportunities(provider, undefined, userId);
      const buckets = bucketOpportunities(scan.rows, {});
      return buildOpportunityDiscoveryReport(scan, buckets);
    }
    case "monitoring-summary": {
      const rows = await db
        .select()
        .from(platformNotificationsTable)
        .where(eq(platformNotificationsTable.userId, userId))
        .orderBy(desc(platformNotificationsTable.createdAt));
      return buildMonitoringSummaryReport(rows.map(formatNotification));
    }
    case "ai-coach-summary": {
      const progress = await getLearningProgress(userId);
      return buildAiCoachLearningSummaryReport(progress);
    }
    case "executive-summary": {
      const cross = await buildCrossEngineDailyReport(userId);
      return buildExecutiveSummaryReport(cross);
    }
    case "trade-planning-summary": {
      const { plans, risk } = await loadTradePlanningSummaryInputs(userId);
      return buildTradePlanningSummaryReport(plans, risk);
    }
    case "strategy-framework-summary": {
      const { strategies, checklists, learningCoverage, workspaceNotes } = await loadStrategyFrameworkSummaryInputs(userId);
      return buildStrategyFrameworkSummaryReport(strategies, checklists, learningCoverage, workspaceNotes);
    }
    case "trading-analytics-summary": {
      const inputs = await loadTradingAnalyticsInputs(userId);
      const dashboard = buildTradingAnalyticsDashboard(inputs);
      return buildTradingAnalyticsSummaryReport(dashboard);
    }
    default:
      return null;
  }
}

router.post("/reporting/reports", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const parsed = SaveInstitutionalReportBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { reportType, symbol, portfolioId } = parsed.data;
  const built = await regenerate(userId, reportType as InstitutionalReportType, symbol, portfolioId);
  if (!built) {
    res.status(404).json({ error: "Could not generate this report — check the symbol/portfolio and try again." });
    return;
  }

  const [row] = await db
    .insert(institutionalReportsTable)
    .values({
      userId,
      reportType: built.reportType,
      title: built.title,
      symbol: built.symbol,
      portfolioId: built.portfolioId,
      dataSource: built.dataSource,
      payload: built,
    })
    .returning();

  res.json(
    SaveInstitutionalReportResponse.parse({
      id: row.id,
      reportType: row.reportType,
      title: row.title,
      symbol: row.symbol,
      portfolioId: row.portfolioId,
      dataSource: row.dataSource,
      createdAt: row.createdAt.toISOString(),
      report: row.payload as InstitutionalReport,
    }),
  );
});

function reportListItem(r: typeof institutionalReportsTable.$inferSelect) {
  return {
    id: r.id,
    reportType: r.reportType,
    title: r.title,
    symbol: r.symbol,
    portfolioId: r.portfolioId,
    dataSource: r.dataSource,
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/reporting/reports", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const rows = await db
    .select()
    .from(institutionalReportsTable)
    .where(eq(institutionalReportsTable.userId, userId))
    .orderBy(desc(institutionalReportsTable.createdAt))
    .limit(100);
  res.json(ListInstitutionalReportsResponse.parse(rows.map(reportListItem)));
});

router.get("/reporting/reports/:id", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid report id" });
    return;
  }
  const [row] = await db
    .select()
    .from(institutionalReportsTable)
    .where(and(eq(institutionalReportsTable.id, id), eq(institutionalReportsTable.userId, userId)));
  if (!row) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  res.json(
    GetSavedInstitutionalReportResponse.parse({
      id: row.id,
      reportType: row.reportType,
      title: row.title,
      symbol: row.symbol,
      portfolioId: row.portfolioId,
      dataSource: row.dataSource,
      createdAt: row.createdAt.toISOString(),
      report: row.payload as InstitutionalReport,
    }),
  );
});

router.delete("/reporting/reports/:id", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid report id" });
    return;
  }
  const [row] = await db
    .delete(institutionalReportsTable)
    .where(and(eq(institutionalReportsTable.id, id), eq(institutionalReportsTable.userId, userId)))
    .returning({ id: institutionalReportsTable.id });
  if (!row) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  res.json(DeleteInstitutionalReportResponse.parse({ success: true }));
});

export default router;
