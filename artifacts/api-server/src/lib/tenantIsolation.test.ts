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
  tradingBacktestResultsTable,
  platformNotificationsTable,
  optionsBacktestResultsTable,
  intelligenceSnapshotsTable,
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
    // Phase 3, Sprint 49 — Backtesting's own new table.
    tradingBacktestResultsTable,
    // Phase 4, Sprint 56 — Alerts & Notifications' own new table.
    platformNotificationsTable,
    // Phase 4, Sprint 58 — Options Engine-Native Backtesting's own new table.
    optionsBacktestResultsTable,
    // Institutional Intelligence Engine sprint — its own new table.
    intelligenceSnapshotsTable,
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
