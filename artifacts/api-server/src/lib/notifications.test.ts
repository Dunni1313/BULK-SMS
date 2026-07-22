// Phase 4, Sprint 56 — Alerts & Notifications (approved Phase 4 plan,
// Sprint 56). Live, real-Postgres tests (the thing under test — dedup
// bookkeeping against the partial unique index, and the alertsEnabled
// settings gate — needs a real database, matching this codebase's existing
// precedent for such tests, see CLAUDE.md §4).
//
// Deliberately uses fresh, isolated users (inserted directly, mirroring
// lib/tenantIsolation.test.ts's own established pattern) rather than the
// shared legacy-owner account every other route test resolves to
// unauthenticated — the risk-cap-breach dedup keys are per-user, not
// per-position, so two test files racing the same legacy-owner account
// could otherwise flake each other's dedup assertions. A fresh user per
// describe block sidesteps that category of flake entirely.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  valueWatchlistTable,
  tradingPositionsTable,
  settingsTable,
  platformNotificationsTable,
  investingMonitoringStatesTable,
} from "@workspace/db";
import { getFundamentals } from "./fundamentals.js";
import { getSettingsRow } from "./serverState.js";
import {
  evaluateWatchlistAlerts,
  evaluateRiskAlerts,
  evaluateAndPersistAlertsForUser,
  evaluateAndPersistAlertsForAllUsers,
} from "./notifications.js";

async function createUser(label: string): Promise<string> {
  const [row] = await db
    .insert(usersTable)
    .values({ email: `notif-${label}-${randomUUID()}@example.com`, displayName: `Notif ${label}` })
    .returning({ id: usersTable.id });
  return row.id;
}

async function cleanupUser(userId: string): Promise<void> {
  await db.delete(platformNotificationsTable).where(eq(platformNotificationsTable.userId, userId));
  await db.delete(valueWatchlistTable).where(eq(valueWatchlistTable.userId, userId));
  await db.delete(tradingPositionsTable).where(eq(tradingPositionsTable.userId, userId));
  // Phase 16's Monitoring Engine (evaluateSymbolMonitoringAlerts /
  // evaluatePortfolioMonitoringAlerts) persists a "last observed signal
  // state" row here as a side effect of evaluation — this table's own FK
  // is ON DELETE RESTRICT (like every other per-user table), so it must
  // be cleaned up before the user row itself, same as every other table
  // this helper already deletes from first. Missing this line was a
  // genuine, previously-disclosed test-file bug (RC1's own Known Issues),
  // not a production defect.
  await db.delete(investingMonitoringStatesTable).where(eq(investingMonitoringStatesTable.userId, userId));
  await db.delete(settingsTable).where(eq(settingsTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

describe("evaluateWatchlistAlerts (Engine 1 trigger source)", () => {
  let userId: string;

  beforeAll(async () => {
    userId = await createUser("watchlist");
  });

  afterAll(async () => {
    await cleanupUser(userId);
  });

  it("honestly returns no candidates for a watchlist with no rows", async () => {
    const candidates = await evaluateWatchlistAlerts(userId);
    expect(candidates).toEqual([]);
  });

  it("produces a candidate, correctly labeled SIMULATED, when the buy-price target is crossed", async () => {
    const f = (await getFundamentals("AAPL"))!;
    const [row] = await db
      .insert(valueWatchlistTable)
      .values({ userId, symbol: "AAPL", desiredBuyPrice: f.price + 1000 })
      .returning();

    const candidates = await evaluateWatchlistAlerts(userId);
    const match = candidates.find((c) => c.dedupKey === `watchlist:${row.id}:price`);
    expect(match).toBeTruthy();
    expect(match!.type).toBe("watchlist_target_crossed");
    expect(match!.dataSource).toBe("SIMULATED");
    expect(match!.relatedSymbol).toBe("AAPL");
    expect(match!.title).toMatch(/buy price target/i);
  });

  it("never fabricates a candidate when no target is set on the row", async () => {
    const [row] = await db.insert(valueWatchlistTable).values({ userId, symbol: "MSFT" }).returning();
    const candidates = await evaluateWatchlistAlerts(userId);
    expect(candidates.find((c) => c.dedupKey.startsWith(`watchlist:${row.id}:`))).toBeUndefined();
  });
});

describe("evaluateRiskAlerts (Engine 2 trigger source)", () => {
  let userId: string;

  beforeAll(async () => {
    userId = await createUser("risk");
    await getSettingsRow(userId); // ensures a settings row exists before the update below
    await db.update(settingsTable).set({ tradingAccountValue: 100_000 }).where(eq(settingsTable.userId, userId));
  });

  afterAll(async () => {
    await cleanupUser(userId);
  });

  it("honestly returns no candidates with no open positions", async () => {
    const candidates = await evaluateRiskAlerts(userId);
    expect(candidates).toEqual([]);
  });

  it("produces a position-sizing-cap-breach candidate, correctly labeled SIMULATED, matching computeTradingRisk()'s own capBreached flag", async () => {
    // entryPrice=100, stopPrice=90 => $10/share risk; quantity=300 =>
    // $3000/$100,000 = 3% > MAX_RISK_PER_POSITION_PCT (2%) — the exact
    // fixture math lib/tradingRisk.test.ts's own cap-breach test uses.
    await db.insert(tradingPositionsTable).values({
      userId,
      symbol: "AAPL",
      side: "long",
      status: "open",
      quantity: 300,
      entryPrice: 100,
      stopPrice: 90,
    });

    const candidates = await evaluateRiskAlerts(userId);
    const match = candidates.find((c) => c.dedupKey === "risk:position-sizing");
    expect(match).toBeTruthy();
    expect(match!.type).toBe("risk_cap_breached");
    expect(match!.dataSource).toBe("SIMULATED");
    expect(match!.title).toMatch(/position sizing/i);
  });
});

describe("evaluateAndPersistAlertsForUser — dedup and the alertsEnabled gate", () => {
  let userId: string;

  beforeAll(async () => {
    userId = await createUser("persist");
  });

  afterAll(async () => {
    await cleanupUser(userId);
  });

  it("persists a new row for a genuinely new candidate", async () => {
    const f = (await getFundamentals("AAPL"))!;
    await db.insert(valueWatchlistTable).values({ userId, symbol: "AAPL", desiredBuyPrice: f.price + 1000 });

    const created = await evaluateAndPersistAlertsForUser(userId);
    expect(created.length).toBeGreaterThan(0);
    expect(created.every((n) => n.userId === userId)).toBe(true);
  });

  it("never creates a duplicate unread notification for the same still-true condition", async () => {
    const secondRun = await evaluateAndPersistAlertsForUser(userId);
    expect(secondRun.length).toBe(0);

    const rows = await db.select().from(platformNotificationsTable).where(eq(platformNotificationsTable.userId, userId));
    const priceAlerts = rows.filter((r) => r.dedupKey.endsWith(":price"));
    expect(priceAlerts.length).toBe(1);
  });

  it("generates a fresh alert for the same still-true condition once the prior one is marked read", async () => {
    const [existing] = await db
      .select()
      .from(platformNotificationsTable)
      .where(eq(platformNotificationsTable.userId, userId));
    await db.update(platformNotificationsTable).set({ isRead: true }).where(eq(platformNotificationsTable.id, existing.id));

    const created = await evaluateAndPersistAlertsForUser(userId);
    expect(created.length).toBeGreaterThan(0);
  });

  it("respects alertsEnabled=false — never persists any alert, even when a condition is genuinely true", async () => {
    await db.update(settingsTable).set({ alertsEnabled: false }).where(eq(settingsTable.userId, userId));
    const created = await evaluateAndPersistAlertsForUser(userId);
    expect(created).toEqual([]);
    await db.update(settingsTable).set({ alertsEnabled: true }).where(eq(settingsTable.userId, userId));
  });
});

describe("evaluateAndPersistAlertsForAllUsers — background scheduler orchestration", () => {
  let enabledUserId: string;
  let disabledUserId: string;

  beforeAll(async () => {
    enabledUserId = await createUser("all-enabled");
    disabledUserId = await createUser("all-disabled");
    await getSettingsRow(enabledUserId); // ensures a settings row exists (alertsEnabled defaults true)
    await getSettingsRow(disabledUserId); // ensures a settings row exists before the update below
    await db.update(settingsTable).set({ alertsEnabled: false }).where(eq(settingsTable.userId, disabledUserId));

    const f = (await getFundamentals("AAPL"))!;
    await db.insert(valueWatchlistTable).values({ userId: enabledUserId, symbol: "AAPL", desiredBuyPrice: f.price + 1000 });
    await db.insert(valueWatchlistTable).values({ userId: disabledUserId, symbol: "AAPL", desiredBuyPrice: f.price + 1000 });
  });

  afterAll(async () => {
    await cleanupUser(enabledUserId);
    await cleanupUser(disabledUserId);
  });

  // evaluateAndPersistAlertsForAllUsers() genuinely iterates every
  // alertsEnabled user in the whole database, by design (it's the same
  // orchestration wrapper the real background scheduler tick calls) — not
  // scoped to just this describe block's own 2 fixture users. Over a long
  // interactive session this shared test database accumulates many
  // alertsEnabled users across all 336 test files' own fixtures, so this
  // one test's real, honest cost genuinely scales with the database's
  // current size. A generous explicit timeout (Version 1.0.0 Finalization
  // hardening pass), not a change to what's being tested — matching the
  // same precedent already established for other heavy all-users
  // orchestration tests in this codebase (e.g. lib/schedulerLoad.test.ts).
  it(
    "generates alerts only for alertsEnabled users, skipping disabled users entirely",
    async () => {
      await evaluateAndPersistAlertsForAllUsers();

      const enabledRows = await db
        .select()
        .from(platformNotificationsTable)
        .where(eq(platformNotificationsTable.userId, enabledUserId));
      const disabledRows = await db
        .select()
        .from(platformNotificationsTable)
        .where(eq(platformNotificationsTable.userId, disabledUserId));

      expect(enabledRows.length).toBeGreaterThan(0);
      expect(disabledRows.length).toBe(0);
    },
    30_000,
  );
});
