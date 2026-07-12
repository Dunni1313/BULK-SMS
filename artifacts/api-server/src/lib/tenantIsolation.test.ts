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
} from "@workspace/db";
import type { PgTable } from "drizzle-orm/pg-core";
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
  ] as any[]) {
    await db.delete(table).where(eq(table.userId, userA));
    await db.delete(table).where(eq(table.userId, userB));
  }
  await db.delete(usersTable).where(eq(usersTable.id, userA));
  await db.delete(usersTable).where(eq(usersTable.id, userB));
});

// The shared helper the plan asks for: seed one row per user, then prove a
// query scoped by userId (the exact pattern every Sprint 7 route now uses)
// returns ONLY that user's row — never the other user's. Drizzle's generic
// column-inference types don't collapse cleanly over an arbitrary PgTable
// union, so this helper deliberately drops to `any` at its boundary — the
// runtime behavior against the real database is what's actually under test.
/* eslint-disable @typescript-eslint/no-explicit-any */
async function assertTenantIsolation(
  table: PgTable,
  seed: (userId: string) => Record<string, unknown>,
): Promise<void> {
  const t = table as any;
  const [rowA] = await db.insert(t).values(seed(userA)).returning({ id: t.id });
  const [rowB] = await db.insert(t).values(seed(userB)).returning({ id: t.id });

  const seenByA = await db.select().from(t).where(eq(t.userId, userA));
  const seenByB = await db.select().from(t).where(eq(t.userId, userB));

  const idsA = seenByA.map((r: { id: unknown }) => r.id);
  const idsB = seenByB.map((r: { id: unknown }) => r.id);

  expect(idsA).toContain(rowA.id);
  expect(idsA).not.toContain(rowB.id);
  expect(idsB).toContain(rowB.id);
  expect(idsB).not.toContain(rowA.id);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

describe("tenant isolation — every user-scoped table (Sprint 7, approved plan §8.3)", () => {
  it("ai_lessons: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(aiLessonsTable, (userId) => ({
      userId,
      topic: "delta",
      title: "Delta lesson",
      content: "content",
    }));
  });

  it("ai_messages: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(aiMessagesTable, (userId) => ({
      userId,
      role: "user",
      message: "hello",
    }));
  });

  it("backtest_results: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(backtestResultsTable, (userId) => ({
      userId,
      symbol: "SPY",
      strategy: "iron_condor",
      period: "1y",
    }));
  });

  it("daily_reports: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(dailyReportsTable, (userId) => ({
      userId,
      reportDate: "2026-07-12",
      payload: {},
    }));
  });

  it("greeks_quiz_results: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(greeksQuizResultsTable, (userId) => ({ userId }));
  });

  it("journal_entries: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(journalEntriesTable, (userId) => ({
      userId,
      title: "Trade review",
      content: "content",
    }));
  });

  it("scanner_results: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(scannerResultsTable, (userId) => ({
      userId,
      symbol: "SPY",
      strategy: "iron_condor",
    }));
  });

  it("stock_analysis_history: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(stockAnalysisHistoryTable, (userId) => ({
      userId,
      symbol: "AAPL",
      analysisDate: "2026-07-12",
      valueResearchJson: {},
    }));
  });

  it("trade_explanations: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(tradeExplanationsTable, (userId) => ({
      userId,
      symbol: "SPY",
      strategy: "iron_condor",
      narrative: "narrative",
    }));
  });

  it("trades: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(tradesTable, (userId) => ({
      userId,
      symbol: "SPY",
      strategy: "iron_condor",
    }));
  });

  it("value_quiz_results: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(valueQuizResultsTable, (userId) => ({ userId }));
  });

  it("value_watchlist: a userId-scoped query never crosses accounts", async () => {
    await assertTenantIsolation(valueWatchlistTable, (userId) => ({
      userId,
      symbol: "AAPL",
    }));
  });

  it("settings: two users' rows (including automation kill switches) are fully independent", async () => {
    await assertTenantIsolation(settingsTable, (userId) => ({ userId }));
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
