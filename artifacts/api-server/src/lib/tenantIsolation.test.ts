// Phase 1, Sprint 7 — tenant-isolation regression suite (approved plan §8.3:
// "for every one of the 13 user-scoped tables, a test that seeds two users
// with data and asserts User A's request never returns User B's rows...
// written once as a shared test helper, not hand-written 13 times").
//
// Unlike most of this codebase's tests, this one deliberately talks to a REAL
// Postgres database (via DATABASE_URL) rather than mocking @workspace/db — the
// thing under test IS the WHERE-clause scoping added by this sprint, so a
// mocked db would test nothing real. This matches the project's existing
// precedent of a subset of tests requiring a live database (see CLAUDE.md §4).
//
// Every route touched by Sprint 7 now resolves `userId` once per request and
// scopes its query with `eq(table.userId, userId)` (list/insert) or
// `and(eq(table.id, id), eq(table.userId, userId))` (fetch-by-id). This suite
// exercises that exact pattern directly against the 13 user-scoped tables
// (§1.2/§4.5), plus the settings-kill-switch independence check §8.3 calls
// out explicitly by name.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import {
  db,
  usersTable,
  aiLessonsTable,
  aiMessagesTable,
  backtestResultsTable,
  dailyReportsTable,
  greeksQuizResultsTable,
  journalEntriesTable,
  scannerResultsTable,
  settingsTable,
  stockAnalysisHistoryTable,
  tradeExplanationsTable,
  tradesTable,
  valueQuizResultsTable,
  valueWatchlistTable,
  investingPortfoliosTable,
  investingHoldingsTable,
  investingRiskSnapshotsTable,
  tradingPositionsTable,
  tradingJournalEntriesTable,
  tradingTradePlansTable,
  tradingWorkspaceNotesTable,
  tradingBacktestResultsTable,
  platformNotificationsTable,
  optionsBacktestResultsTable,
  intelligenceSnapshotsTable,
  learningProgressTable,
  dashboardWorkspacesTable,
  brokerReconciliationReportsTable,
  investingResearchNotesTable,
  investingPortfolioSnapshotsTable,
  investingPortfolioNotesTable,
  investingDecisionSnapshotsTable,
  investingDecisionNotesTable,
  investingSavedScreensTable,
  investingMonitoringStatesTable,
  investingAlertNotesTable,
  investingOptimisationReviewsTable,
  tradingStrategiesTable,
  tradingStrategyChecklistsTable,
  compliancePoliciesTable,
  investingWatchlistsTable,
  investingWatchlistItemsTable,
  portfolioWorkflowInstancesTable,
  workspacePinnedResourcesTable,
  workspaceRecentViewsTable,
  tradingCoachMessagesTable,
  investingOpportunityPipelineItemsTable,
} from "@workspace/db";
import { assertTenantIsolation } from "./tenantIsolationHelper.js";
import { getSettingsRow } from "./serverState.js";

let userA: string;
let userB: string;

beforeAll(async () => {
  const [a] = await db
    .insert(usersTable)
    .values({ email: `tenant-a-${randomUUID()}@example.com`, displayName: "Tenant A" })
    .returning({ id: usersTable.id });
  const [b] = await db
    .insert(usersTable)
    .values({ email: `tenant-b-${randomUUID()}@example.com`, displayName: "Tenant B" })
    .returning({ id: usersTable.id });
  userA = a.id;
  userB = b.id;
});

afterAll(async () => {
  // FKs are ON DELETE RESTRICT for every business table (§2.4), so child rows
  // must go first — delete everything owned by either test user, then the
  // users themselves, leaving the shared test database clean.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const table of [
    aiLessonsTable,
    aiMessagesTable,
    backtestResultsTable,
    dailyReportsTable,
    greeksQuizResultsTable,
    journalEntriesTable,
    scannerResultsTable,
    settingsTable,
    stockAnalysisHistoryTable,
    tradeExplanationsTable,
    tradesTable,
    valueQuizResultsTable,
    valueWatchlistTable,
    // Phase 2, Sprint 28/29 — investing_risk_snapshots and investing_holdings
    // first (both have their own FK to investing_portfolios as ON DELETE
    // CASCADE, so this is defensive/consistent with the rest of this loop,
    // not strictly required).
    investingRiskSnapshotsTable,
    investingHoldingsTable,
    investingPortfoliosTable,
    // Phase 3, Sprint 32 — Institutional Trading Engine's own new tables.
    tradingJournalEntriesTable,
    tradingPositionsTable,
    // Phase 25 — Institutional Trade Workspace's own new tables.
    tradingTradePlansTable,
    tradingWorkspaceNotesTable,
    // Phase 3, Sprint 49 — Backtesting's own new table.
    tradingBacktestResultsTable,
    // Phase 4, Sprint 56 — Alerts & Notifications' own new table.
    platformNotificationsTable,
    // Phase 4, Sprint 58 — Options Engine-Native Backtesting's own new table.
    optionsBacktestResultsTable,
    // Institutional Intelligence Engine sprint — its own new table.
    intelligenceSnapshotsTable,
    // AI Teacher & Learning Centre sprint — its own new table.
    learningProgressTable,
    // Phase 10 — Institutional Platform Polish & Control Center's own new table.
    dashboardWorkspacesTable,
    // Phase 11 — Live Market Operations & Production Validation's own new table.
    brokerReconciliationReportsTable,
    // Phase 12 — Institutional Investing Engine Consolidation & Integration.
    investingResearchNotesTable,
    // Phase 13 — Institutional Portfolio Manager's own new tables (both have
    // their own FK to investing_portfolios as ON DELETE CASCADE, so this is
    // defensive/consistent with the rest of this loop, not strictly required).
    investingPortfolioSnapshotsTable,
    investingPortfolioNotesTable,
    // Phase 14 — Institutional Investment Decision Engine's own new tables,
    // both per-symbol (no FK to a portfolio), unlike Phase 13's own two.
    investingDecisionSnapshotsTable,
    investingDecisionNotesTable,
    // Phase 15 — Institutional Opportunity Discovery Engine's own new table.
    investingSavedScreensTable,
    // Phase 16 — Institutional Monitoring & Alerts Engine's own new tables.
    investingMonitoringStatesTable,
    investingAlertNotesTable,
    // Phase 30 — Institutional Strategy Framework's own two new tables.
    // Checklists first — they have their own FK to trading_strategies as
    // ON DELETE CASCADE, so this is defensive/consistent with the rest of
    // this loop, not strictly required.
    tradingStrategyChecklistsTable,
    tradingStrategiesTable,
    // Phase 42 — Institutional Portfolio Monitoring & Compliance Engine's
    // own new table.
    compliancePoliciesTable,
    // Phase 43 — Institutional Watchlists & Opportunity Dashboard's own
    // two new tables. Items first — they have their own FK to
    // investing_watchlists as ON DELETE CASCADE, so this is defensive/
    // consistent with the rest of this loop, not strictly required.
    investingWatchlistItemsTable,
    investingWatchlistsTable,
    // Phase 44 — Institutional Portfolio Workspace & Workflow Center's own
    // three new tables.
    portfolioWorkflowInstancesTable,
    workspacePinnedResourcesTable,
    workspaceRecentViewsTable,
    // v1.3.0, Sprint 1 — AI Trading Coach's own new table.
    tradingCoachMessagesTable,
    // v1.5.0, Sprint 21 — Institutional Opportunity Discovery Engine's own
    // new table (built and named "Opportunity Pipeline" to avoid colliding
    // with the pre-existing Phase 15 table above).
    investingOpportunityPipelineItemsTable,
  ] as any[]) {
    await db.delete(table).where(eq(table.userId, userA));
    await db.delete(table).where(eq(table.userId, userB));
  }
  await db.delete(usersTable).where(eq(usersTable.id, userA));
  await db.delete(usersTable).where(eq(usersTable.id, userB));
});

describe("tenant isolation — every user-scoped table (Sprint 7, approved plan §8.3)", () => {
  it("ai_lessons: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(aiLessonsTable, userA, userB, (userId) => ({
      userId,
      topic: "delta",
      title: "Delta lesson",
      content: "content",
    }));
  });

  it("ai_messages: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(aiMessagesTable, userA, userB, (userId) => ({
      userId,
      role: "user",
      message: "hello",
    }));
  });

  it("backtest_results: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(backtestResultsTable, userA, userB, (userId) => ({
      userId,
      symbol: "SPY",
      strategy: "iron_condor",
      period: "1y",
    }));
  });

  it("daily_reports: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(dailyReportsTable, userA, userB, (userId) => ({
      userId,
      reportDate: "2026-07-12",
      payload: {},
    }));
  });

  it("greeks_quiz_results: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(greeksQuizResultsTable, userA, userB, (userId) => ({ userId }));
  });

  it("journal_entries: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(journalEntriesTable, userA, userB, (userId) => ({
      userId,
      title: "Trade review",
      content: "content",
    }));
  });

  it("scanner_results: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(scannerResultsTable, userA, userB, (userId) => ({
      userId,
      symbol: "SPY",
      strategy: "iron_condor",
    }));
  });

  it("stock_analysis_history: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(stockAnalysisHistoryTable, userA, userB, (userId) => ({
      userId,
      symbol: "AAPL",
      analysisDate: "2026-07-12",
      valueResearchJson: {},
    }));
  });

  it("trade_explanations: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(tradeExplanationsTable, userA, userB, (userId) => ({
      userId,
      symbol: "SPY",
      strategy: "iron_condor",
      narrative: "narrative",
    }));
  });

  it("trades: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(tradesTable, userA, userB, (userId) => ({
      userId,
      symbol: "SPY",
      strategy: "iron_condor",
    }));
  });

  it("value_quiz_results: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(valueQuizResultsTable, userA, userB, (userId) => ({ userId }));
  });

  it("value_watchlist: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(valueWatchlistTable, userA, userB, (userId) => ({
      userId,
      symbol: "AAPL",
    }));
  });

  // Phase 12 — Institutional Investing Engine Consolidation & Integration.
  it("investing_research_notes: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(investingResearchNotesTable, userA, userB, (userId) => ({
      userId,
      symbol: "AAPL",
      note: "test note",
    }));
  });

  it("settings: two users' rows (including automation kill switches) are fully independent", async () => {
    await assertTenantIsolation(settingsTable, userA, userB, (userId) => ({ userId }));
  });

  // Phase 2, Sprint 28 — Portfolio Construction's two new tables, reusing
  // this exact helper per the roadmap's own Sprint 28 entry.
  it("investing_portfolios: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(investingPortfoliosTable, userA, userB, (userId) => ({
      userId,
      name: "Test Portfolio",
    }));
  });

  it("investing_holdings: a userId-scoped query never crosses accounts", async () => {
    const [portfolioA] = await db
      .insert(investingPortfoliosTable)
      .values({ userId: userA, name: "Tenant A Portfolio" })
      .returning({ id: investingPortfoliosTable.id });
    const [portfolioB] = await db
      .insert(investingPortfoliosTable)
      .values({ userId: userB, name: "Tenant B Portfolio" })
      .returning({ id: investingPortfoliosTable.id });
    await assertTenantIsolation(investingHoldingsTable, userA, userB, (userId) => ({
      userId,
      portfolioId: userId === userA ? portfolioA.id : portfolioB.id,
      symbol: "AAPL",
    }));
  });

  // Phase 2, Sprint 29 — Portfolio Risk Analysis's snapshot-history table,
  // reusing the same shared helper.
  it("investing_risk_snapshots: a userId-scoped query never crosses accounts", async () => {
    const [portfolioA] = await db
      .insert(investingPortfoliosTable)
      .values({ userId: userA, name: "Tenant A Risk Portfolio" })
      .returning({ id: investingPortfoliosTable.id });
    const [portfolioB] = await db
      .insert(investingPortfoliosTable)
      .values({ userId: userB, name: "Tenant B Risk Portfolio" })
      .returning({ id: investingPortfoliosTable.id });
    await assertTenantIsolation(investingRiskSnapshotsTable, userA, userB, (userId) => ({
      userId,
      portfolioId: userId === userA ? portfolioA.id : portfolioB.id,
      overallScore: 72,
      analysisJson: { overall: { score: 72, label: "Strong", detail: "test" } },
    }));
  });

  // Phase 13 — Institutional Portfolio Manager's own new tables, reusing the
  // same shared helper.
  it("investing_portfolio_snapshots: a userId-scoped query never crosses accounts", async () => {
    const [portfolioA] = await db
      .insert(investingPortfoliosTable)
      .values({ userId: userA, name: "Tenant A Intelligence Portfolio" })
      .returning({ id: investingPortfoliosTable.id });
    const [portfolioB] = await db
      .insert(investingPortfoliosTable)
      .values({ userId: userB, name: "Tenant B Intelligence Portfolio" })
      .returning({ id: investingPortfoliosTable.id });
    await assertTenantIsolation(investingPortfolioSnapshotsTable, userA, userB, (userId) => ({
      userId,
      portfolioId: userId === userA ? portfolioA.id : portfolioB.id,
      qualityScore: 65,
      riskScore: 70,
      diversificationScore: 80,
      totalMarketValue: 1000,
      holdingsCount: 1,
      analysisJson: { summary: "test" },
    }));
  });

  it("investing_portfolio_notes: a userId-scoped query never crosses accounts", async () => {
    const [portfolioA] = await db
      .insert(investingPortfoliosTable)
      .values({ userId: userA, name: "Tenant A Notes Portfolio" })
      .returning({ id: investingPortfoliosTable.id });
    const [portfolioB] = await db
      .insert(investingPortfoliosTable)
      .values({ userId: userB, name: "Tenant B Notes Portfolio" })
      .returning({ id: investingPortfoliosTable.id });
    await assertTenantIsolation(investingPortfolioNotesTable, userA, userB, (userId) => ({
      userId,
      portfolioId: userId === userA ? portfolioA.id : portfolioB.id,
      note: "Test note",
    }));
  });

  // Phase 18 — Institutional Portfolio Optimisation Engine's own new table,
  // reusing the same shared helper and portfolio-scoping pattern as
  // investing_portfolio_notes above.
  it("investing_optimisation_reviews: a userId-scoped query never crosses accounts", async () => {
    const [portfolioA] = await db
      .insert(investingPortfoliosTable)
      .values({ userId: userA, name: "Tenant A Optimisation Portfolio" })
      .returning({ id: investingPortfoliosTable.id });
    const [portfolioB] = await db
      .insert(investingPortfoliosTable)
      .values({ userId: userB, name: "Tenant B Optimisation Portfolio" })
      .returning({ id: investingPortfoliosTable.id });
    await assertTenantIsolation(investingOptimisationReviewsTable, userA, userB, (userId) => ({
      userId,
      portfolioId: userId === userA ? portfolioA.id : portfolioB.id,
      action: "trim",
      note: "Test review",
    }));
  });

  // Phase 14 — Institutional Investment Decision Engine's own new tables,
  // reusing the same shared helper. Both are per-symbol (no FK to a
  // portfolio, unlike Phase 13's own two tables above).
  it("investing_decision_snapshots: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(investingDecisionSnapshotsTable, userA, userB, (userId) => ({
      userId,
      symbol: "DECTST",
      recommendation: "Hold",
      confidence: 60,
      analysisJson: { summary: "test" },
    }));
  });

  it("investing_decision_notes: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(investingDecisionNotesTable, userA, userB, (userId) => ({
      userId,
      symbol: "DECTST",
      note: "Test decision note",
    }));
  });

  // Phase 15 — Institutional Opportunity Discovery Engine's own new table,
  // reusing the same shared helper.
  it("investing_saved_screens: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(investingSavedScreensTable, userA, userB, (userId) => ({
      userId,
      name: "Test Screen",
      filtersJson: { sector: "Technology" },
    }));
  });

  // v1.5.0, Sprint 21 — Institutional Opportunity Discovery Engine's own
  // new table (built and named "Opportunity Pipeline" — see
  // lib/opportunityPipeline.ts's header comment for the disclosed
  // naming-collision reasoning against the Phase 15 table above), reusing
  // the same shared helper.
  it("investing_opportunity_pipeline_items: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(investingOpportunityPipelineItemsTable, userA, userB, (userId) => ({
      userId,
      title: "Test Opportunity",
      category: "watchlist_event",
      origin: "Test origin",
      evidenceJson: ["evidence"],
      relatedAssetsJson: ["AAPL"],
      relatedSectorsJson: [],
      priority: "medium",
      stage: "discovered",
    }));
  });

  // Phase 3, Sprint 32 — Institutional Trading Engine's own new tables
  // (Market Data Foundation), reusing the same shared helper.
  it("trading_positions: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(tradingPositionsTable, userA, userB, (userId) => ({
      userId,
      symbol: "AAPL",
    }));
  });

  it("trading_journal_entries: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(tradingJournalEntriesTable, userA, userB, (userId) => ({
      userId,
      title: "Test Entry",
      content: "content",
    }));
  });

  // Phase 25 — Institutional Trade Workspace's own new tables.
  it("trading_trade_plans: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(tradingTradePlansTable, userA, userB, (userId) => ({
      userId,
      symbol: "AAPL",
      direction: "long",
      thesis: "Test thesis",
      accountRiskPct: 1,
      entryPrice: 100,
      stopPrice: 95,
      targetPrice: 115,
    }));
  });

  it("trading_workspace_notes: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(tradingWorkspaceNotesTable, userA, userB, (userId) => ({
      userId,
      symbol: "AAPL",
      note: "Test note",
    }));
  });

  // Phase 3, Sprint 49 — Backtesting's own new table.
  it("trading_backtest_results: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(tradingBacktestResultsTable, userA, userB, (userId) => ({
      userId,
      symbol: "AAPL",
      strategy: "trend-following",
      interval: "1D",
    }));
  });

  // Phase 4, Sprint 56 — Alerts & Notifications' own new table.
  it("platform_notifications: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(platformNotificationsTable, userA, userB, (userId) => ({
      userId,
      type: "watchlist_target_crossed",
      title: "Test alert",
      message: "Test message",
      dataSource: "SIMULATED",
      dedupKey: `test:${userId}`,
    }));
  });

  // Phase 4, Sprint 58 — Options Engine-Native Backtesting's own new table.
  it("options_backtest_results: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(optionsBacktestResultsTable, userA, userB, (userId) => ({
      userId,
      symbol: "AAPL",
      strategy: "iron_condor",
    }));
  });

  // Institutional Intelligence Engine sprint — its own new table (one
  // recorded snapshot per user per calendar day, powering the Timeline
  // Engine's trend comparisons).
  it("intelligence_snapshots: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(intelligenceSnapshotsTable, userA, userB, (userId) => ({
      userId,
      snapshotDate: "2020-01-01",
      healthScore: 100,
      overallRiskRatingCode: "healthy",
      buyingPower: 0,
      totalRiskPct: 0,
      concentrationScore: 100,
      diversificationScore: 100,
      eventRiskScore: 100,
      directionalExposureScore: 100,
      greeksExposureScore: 100,
      thetaMonthly: 0,
      netDelta: 0,
    }));
  });

  // AI Teacher & Learning Centre sprint — its own new table (one row per
  // user per learning item; the only new user-state mutation this
  // sprint introduces).
  it("learning_progress: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(learningProgressTable, userA, userB, (userId) => ({
      userId,
      itemType: "lesson",
      itemKey: "foundations-stocks",
    }));
  });

  // Phase 10 — Institutional Platform Polish & Control Center's own new
  // table (Workspace System + Personal Dashboard's backing layout config).
  it("dashboard_workspaces: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(dashboardWorkspacesTable, userA, userB, (userId) => ({
      userId,
      name: "Default",
      widgetConfig: [],
    }));
  });

  // Phase 11 — Live Market Operations & Production Validation's own new table.
  it("broker_reconciliation_reports: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(brokerReconciliationReportsTable, userA, userB, (userId) => ({
      userId,
      generatedAt: new Date(),
      available: true,
      unavailableReason: null,
      localOrdersConsidered: 0,
      brokerOrdersConsidered: 0,
      issueCount: 0,
      fullyReconciled: true,
      detailJson: {},
    }));
  });

  // Phase 16 — Institutional Monitoring & Alerts Engine's own two new
  // tables, reusing the same shared helper.
  it("investing_monitoring_states: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(investingMonitoringStatesTable, userA, userB, (userId) => ({
      userId,
      entityType: "symbol",
      entityKey: "AAPL",
      stateJson: { symbol: "AAPL" },
    }));
  });

  it("investing_alert_notes: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(investingAlertNotesTable, userA, userB, (userId) => ({
      userId,
      symbol: "AAPL",
      note: "Watching this one closely.",
    }));
  });

  // Phase 30 — Institutional Strategy Framework's own two new tables.
  it("trading_strategies: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(tradingStrategiesTable, userA, userB, (userId) => ({
      userId,
      name: "Test Strategy",
      description: "A personally defined trade setup.",
      category: "trend",
      timeframes: ["1h"],
      markets: ["equities"],
      requiredEvidence: ["structure"],
      checklist: [{ id: "a", label: "A", required: true }],
      references: [],
    }));
  });

  it("trading_strategy_checklists: a userId-scoped query never crosses accounts", async () => {
    // A checklist has a real FK to its own strategy (ON DELETE CASCADE) —
    // seed one real strategy per user first so the checklist insert itself
    // is valid, then prove isolation over the checklists table exactly like
    // every other table above.
    const [strategyA] = await db
      .insert(tradingStrategiesTable)
      .values({
        userId: userA,
        name: "Strategy A",
        description: "d",
        category: "trend",
        timeframes: ["1h"],
        markets: ["equities"],
        requiredEvidence: ["structure"],
        checklist: [{ id: "a", label: "A", required: true }],
        references: [],
      })
      .returning({ id: tradingStrategiesTable.id });
    const [strategyB] = await db
      .insert(tradingStrategiesTable)
      .values({
        userId: userB,
        name: "Strategy B",
        description: "d",
        category: "trend",
        timeframes: ["1h"],
        markets: ["equities"],
        requiredEvidence: ["structure"],
        checklist: [{ id: "a", label: "A", required: true }],
        references: [],
      })
      .returning({ id: tradingStrategiesTable.id });

    await assertTenantIsolation(tradingStrategyChecklistsTable, userA, userB, (userId) => ({
      userId,
      strategyId: userId === userA ? strategyA.id : strategyB.id,
      status: "in_progress",
      items: [{ id: "a", label: "A", required: true, completed: false, notes: "", evidenceLinks: [] }],
    }));
  });

  it("compliance_policies: a userId-scoped query never crosses accounts (Phase 42)", async () => {
    await assertTenantIsolation(compliancePoliciesTable, userA, userB, (userId) => ({
      userId,
      policyType: "portfolio_delta_max",
      label: "Isolation Test Policy",
      direction: "max",
      limitValue: 100,
    }));
  });

  it("investing_watchlists: a userId-scoped query never crosses accounts (Phase 43)", async () => {
    await assertTenantIsolation(investingWatchlistsTable, userA, userB, (userId) => ({
      userId,
      name: "Isolation Test Watchlist",
      kind: "personal",
    }));
  });

  it("investing_watchlist_items: a userId-scoped query never crosses accounts (Phase 43)", async () => {
    const [watchlistA] = await db.insert(investingWatchlistsTable).values({ userId: userA, name: "Isolation Items A" }).returning({ id: investingWatchlistsTable.id });
    const [watchlistB] = await db.insert(investingWatchlistsTable).values({ userId: userB, name: "Isolation Items B" }).returning({ id: investingWatchlistsTable.id });

    await assertTenantIsolation(investingWatchlistItemsTable, userA, userB, (userId) => ({
      userId,
      watchlistId: userId === userA ? watchlistA.id : watchlistB.id,
      symbol: "IBM",
    }));
  });

  it("portfolio_workflow_instances: a userId-scoped query never crosses accounts (Phase 44)", async () => {
    await assertTenantIsolation(portfolioWorkflowInstancesTable, userA, userB, (userId) => ({
      userId,
      workflowKey: "morning_review",
    }));
  });

  it("workspace_pinned_resources: a userId-scoped query never crosses accounts (Phase 44)", async () => {
    await assertTenantIsolation(workspacePinnedResourcesTable, userA, userB, (userId) => ({
      userId,
      resourceType: "dashboard",
      resourceKey: "isolation-test-resource",
      label: "Isolation Test Resource",
      linkPath: "/watchlists-engine",
    }));
  });

  it("workspace_recent_views: a userId-scoped query never crosses accounts (Phase 44)", async () => {
    await assertTenantIsolation(workspaceRecentViewsTable, userA, userB, (userId) => ({
      userId,
      resourceType: "dashboard",
      resourceKey: "isolation-test-resource",
      label: "Isolation Test Resource",
      linkPath: "/watchlists-engine",
    }));
  });

  it("trading_coach_messages: a userId-scoped query never crosses accounts (v1.3.0, Sprint 1)", async () => {
    await assertTenantIsolation(tradingCoachMessagesTable, userA, userB, (userId) => ({
      userId,
      role: "user",
      message: "isolation test message",
    }));
  });
});

describe("IDOR — fetch-by-id must filter by userId in the same query, not fetch-then-check", () => {
  it("trades: User B's and(id, userId) lookup never resolves User A's trade", async () => {
    const [tradeA] = await db
      .insert(tradesTable)
      .values({ userId: userA, symbol: "SPY", strategy: "iron_condor" })
      .returning({ id: tradesTable.id });

    const asOwner = await db
      .select()
      .from(tradesTable)
      .where(and(eq(tradesTable.id, tradeA.id), eq(tradesTable.userId, userA)));
    const asOther = await db
      .select()
      .from(tradesTable)
      .where(and(eq(tradesTable.id, tradeA.id), eq(tradesTable.userId, userB)));

    expect(asOwner).toHaveLength(1);
    expect(asOther).toHaveLength(0);
  });

  it("journal_entries: User B's and(id, userId) lookup never resolves User A's entry", async () => {
    const [entryA] = await db
      .insert(journalEntriesTable)
      .values({ userId: userA, title: "Private", content: "content" })
      .returning({ id: journalEntriesTable.id });

    const asOwner = await db
      .select()
      .from(journalEntriesTable)
      .where(and(eq(journalEntriesTable.id, entryA.id), eq(journalEntriesTable.userId, userA)));
    const asOther = await db
      .select()
      .from(journalEntriesTable)
      .where(and(eq(journalEntriesTable.id, entryA.id), eq(journalEntriesTable.userId, userB)));

    expect(asOwner).toHaveLength(1);
    expect(asOther).toHaveLength(0);
  });

  it("value_watchlist: User B's and(id, userId) lookup never resolves User A's item", async () => {
    const [itemA] = await db
      .insert(valueWatchlistTable)
      .values({ userId: userA, symbol: "AAPL" })
      .returning({ id: valueWatchlistTable.id });

    const asOwner = await db
      .select()
      .from(valueWatchlistTable)
      .where(and(eq(valueWatchlistTable.id, itemA.id), eq(valueWatchlistTable.userId, userA)));
    const asOther = await db
      .select()
      .from(valueWatchlistTable)
      .where(and(eq(valueWatchlistTable.id, itemA.id), eq(valueWatchlistTable.userId, userB)));

    expect(asOwner).toHaveLength(1);
    expect(asOther).toHaveLength(0);
  });

  it("trading_journal_entries: User B's and(id, userId) lookup never resolves User A's entry (Phase 3, Sprint 39)", async () => {
    const [entryA] = await db
      .insert(tradingJournalEntriesTable)
      .values({ userId: userA, title: "Private trade note", content: "content" })
      .returning({ id: tradingJournalEntriesTable.id });

    const asOwner = await db
      .select()
      .from(tradingJournalEntriesTable)
      .where(and(eq(tradingJournalEntriesTable.id, entryA.id), eq(tradingJournalEntriesTable.userId, userA)));
    const asOther = await db
      .select()
      .from(tradingJournalEntriesTable)
      .where(and(eq(tradingJournalEntriesTable.id, entryA.id), eq(tradingJournalEntriesTable.userId, userB)));

    expect(asOwner).toHaveLength(1);
    expect(asOther).toHaveLength(0);
  });

  it("trading_positions: User B's and(id, userId) lookup never resolves User A's position (Phase 3, Sprint 44)", async () => {
    const [positionA] = await db
      .insert(tradingPositionsTable)
      .values({ userId: userA, symbol: "AAPL", quantity: 10, entryPrice: 190 })
      .returning({ id: tradingPositionsTable.id });

    const asOwner = await db
      .select()
      .from(tradingPositionsTable)
      .where(and(eq(tradingPositionsTable.id, positionA.id), eq(tradingPositionsTable.userId, userA)));
    const asOther = await db
      .select()
      .from(tradingPositionsTable)
      .where(and(eq(tradingPositionsTable.id, positionA.id), eq(tradingPositionsTable.userId, userB)));

    expect(asOwner).toHaveLength(1);
    expect(asOther).toHaveLength(0);
  });
});

describe("settings kill switches — independent per user through the real getSettingsRow path", () => {
  it("arming User A's automation switches never affects User B's row", async () => {
    const a = await getSettingsRow(userA);
    const b = await getSettingsRow(userB);
    expect(a.userId).toBe(userA);
    expect(b.userId).toBe(userB);
    expect(a.autoExecuteEnabled).toBe(false);
    expect(b.autoExecuteEnabled).toBe(false);

    await db
      .update(settingsTable)
      .set({ executionMode: "full_auto", autoExecuteEnabled: true, autoAdjustEnabled: true })
      .where(eq(settingsTable.userId, userA));

    const aAfter = await getSettingsRow(userA);
    const bAfter = await getSettingsRow(userB);
    expect(aAfter.executionMode).toBe("full_auto");
    expect(aAfter.autoExecuteEnabled).toBe(true);
    expect(aAfter.autoAdjustEnabled).toBe(true);

    expect(bAfter.executionMode).toBe("manual");
    expect(bAfter.autoExecuteEnabled).toBe(false);
    expect(bAfter.autoAdjustEnabled).toBe(false);
  });
});
