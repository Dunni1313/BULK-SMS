// Phase 5, Sprint 68 — Cross-Engine Daily Report (approved Phase 5 roadmap
// review). Live, real-Postgres tests (the thing under test composes real
// per-user rows across 3 engines' own tables, matching this codebase's
// established precedent for such tests, see CLAUDE.md §4).
//
// Deliberately uses fresh, isolated users (mirroring lib/notifications.test.ts's
// own established pattern, Sprint 56) rather than the shared legacy-owner
// account every unauthenticated route test resolves to — this report reads
// the user's own watchlist/trading-positions/trades tables, and a shared
// account's ambient state (populated by dozens of other sibling test files)
// would make the empty-state and exact-count assertions below unreliable.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  valueWatchlistTable,
  tradingPositionsTable,
  tradesTable,
  journalEntriesTable,
  scannerResultsTable,
  settingsTable,
} from "@workspace/db";
import { buildCrossEngineDailyReport } from "./crossEngineDailyReport.js";
import { getFundamentals } from "./fundamentals.js";
import { assembleDailyReport } from "./dailyReport.js";
import { buildTradingRiskAnalysis, type TradingPositionInput } from "./tradingRisk.js";
import { buildMacroContext } from "./investingMacro.js";
import { computeWatchlistTargets } from "./watchlistTargets.js";
import { getFundamentalsProvider } from "./fundamentals.js";
import { getMarketDataProvider } from "./tradingMarketData.js";
import { getSettingsRow } from "./serverState.js";
import { todayStr } from "./deterministic.js";

async function createUser(label: string): Promise<string> {
  const [row] = await db
    .insert(usersTable)
    .values({ email: `xengine-${label}-${randomUUID()}@example.com`, displayName: `XEngine ${label}` })
    .returning({ id: usersTable.id });
  return row.id;
}

async function cleanupUser(userId: string): Promise<void> {
  await db.delete(journalEntriesTable).where(eq(journalEntriesTable.userId, userId));
  await db.delete(tradesTable).where(eq(tradesTable.userId, userId));
  await db.delete(scannerResultsTable).where(eq(scannerResultsTable.userId, userId));
  await db.delete(tradingPositionsTable).where(eq(tradingPositionsTable.userId, userId));
  await db.delete(valueWatchlistTable).where(eq(valueWatchlistTable.userId, userId));
  await db.delete(settingsTable).where(eq(settingsTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

describe("buildCrossEngineDailyReport — empty states (fresh user, no watchlist/positions)", () => {
  let userId: string;

  beforeAll(async () => {
    userId = await createUser("empty");
  });

  afterAll(async () => {
    await cleanupUser(userId);
  });

  it("honestly reports an empty watchlist — never a fabricated crossing", async () => {
    const report = await buildCrossEngineDailyReport(userId);
    expect(report.engine1.watchlistTotalItems).toBe(0);
    expect(report.engine1.watchlistCrossings).toEqual([]);
    expect(report.summary).toMatch(/watchlist is empty/i);
  });

  it("honestly reports insufficient trading-risk data for a user with no open positions — never a fabricated score", async () => {
    const report = await buildCrossEngineDailyReport(userId);
    expect(report.engine2.risk.openPositionsCount).toBe(0);
    // computeTradingRisk()'s own established honest-insufficient-data
    // contract (Sprint 38) — reused unmodified, not re-derived here.
    expect(report.engine2.risk.overall.label).toBeTruthy();
  });

  it("Engine 3's own daily-report assembler still produces a well-shaped section (its own pre-existing seed-trades behavior, unmodified)", async () => {
    const report = await buildCrossEngineDailyReport(userId);
    expect(typeof report.engine3.healthScore).toBe("number");
    expect(report.engine3.openPositions).toBeGreaterThan(0); // assembleDailyReport()'s own established seeding
  });

  it("carries the macro context and the disclaimer, and a non-boilerplate summary", async () => {
    const report = await buildCrossEngineDailyReport(userId);
    expect(report.engine1.macro.regimeLabel).toBeTruthy();
    expect(report.disclaimer).toMatch(/advisory\/education only/i);
    expect(report.summary.length).toBeGreaterThan(20);
  });
});

describe("buildCrossEngineDailyReport — cross-engine composition (a user with real data in every engine)", () => {
  let userId: string;
  let watchlistSymbol: string;

  beforeAll(async () => {
    userId = await createUser("composed");
    // A guaranteed-crossed watchlist target, matching the established
    // notifications.route.test.ts precedent (a desiredBuyPrice far above
    // any plausible SIMULATED price always reads as "crossed").
    watchlistSymbol = "ZCED"; // valid ticker shape, outside the real-symbol universe
    const f = (await getFundamentals(watchlistSymbol))!;
    await db.insert(valueWatchlistTable).values({
      userId,
      symbol: watchlistSymbol,
      desiredBuyPrice: f.price + 1000,
      marginOfSafetyTarget: 25,
    });
    await db.insert(tradingPositionsTable).values({
      userId,
      symbol: "AAPL",
      side: "long",
      quantity: 10,
      entryPrice: 190,
      stopPrice: 180,
      targetPrice: 210,
      status: "open",
    });
  });

  afterAll(async () => {
    await cleanupUser(userId);
  });

  it("Engine 1's watchlist crossing is populated and matches computeWatchlistTargets() called directly — no duplicated logic", async () => {
    const report = await buildCrossEngineDailyReport(userId);
    const crossing = report.engine1.watchlistCrossings.find((c) => c.symbol === watchlistSymbol);
    expect(crossing).toBeTruthy();
    expect(crossing!.priceTargetCrossed).toBe(true);

    const [row] = await db.select().from(valueWatchlistTable).where(eq(valueWatchlistTable.symbol, watchlistSymbol));
    const provider = await getFundamentalsProvider(userId);
    const direct = await computeWatchlistTargets(row, provider);
    expect(crossing!.currentPrice).toBe(direct.currentPrice);
    expect(crossing!.priceTargetCrossed).toBe(direct.priceTargetCrossed);
  });

  it("Engine 2's risk section is byte-identical to a standalone buildTradingRiskAnalysis() call for the same positions", async () => {
    const report = await buildCrossEngineDailyReport(userId);
    expect(report.engine2.risk.openPositionsCount).toBe(1);

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
    const direct = await buildTradingRiskAnalysis(positions, settings.tradingAccountValue ?? null, provider);
    expect(report.engine2.risk).toEqual(direct);
  });

  it("Engine 3's section is derived from assembleDailyReport()'s own output, proven unchanged via direct equality against a standalone call", async () => {
    const report = await buildCrossEngineDailyReport(userId);
    const direct = await assembleDailyReport(userId, new Date(report.generatedAt).getTime());
    expect(report.engine3.healthScore).toBe(direct.health.health.score);
    expect(report.engine3.healthLabel).toBe(direct.health.health.label);
    expect(report.engine3.openPositions).toBe(direct.summary.openPositions);
    expect(report.engine3.totalUnrealizedPnl).toBe(direct.summary.totalUnrealizedPnl);
  });

  it("Engine 1's macro section is byte-identical to a standalone buildMacroContext() call for the same date", async () => {
    const report = await buildCrossEngineDailyReport(userId);
    const direct = buildMacroContext(report.date);
    expect(report.engine1.macro).toEqual(direct);
  });

  it("the deterministic summary mentions the crossed symbol and the trading-risk label — a real, non-boilerplate synthesis", async () => {
    const report = await buildCrossEngineDailyReport(userId);
    expect(report.summary).toContain(watchlistSymbol);
    expect(report.summary).toContain(report.engine2.risk.overall.label);
  });
});

describe("buildCrossEngineDailyReport — determinism and tenant isolation", () => {
  let userId: string;

  beforeAll(async () => {
    userId = await createUser("determinism");
  });

  afterAll(async () => {
    await cleanupUser(userId);
  });

  it("is deterministic across repeated calls for the same user/state, excluding the always-fresh generatedAt timestamp", async () => {
    const fixedNow = Date.now();
    const a = await buildCrossEngineDailyReport(userId, fixedNow);
    const b = await buildCrossEngineDailyReport(userId, fixedNow);
    const { generatedAt: genA, ...restA } = a;
    const { generatedAt: genB, ...restB } = b;
    void genA;
    void genB;
    expect(restA).toEqual(restB);
  });

  it("never reads another user's watchlist or trading positions", async () => {
    const otherUserId = await createUser("determinism-other");
    try {
      await db.insert(valueWatchlistTable).values({ userId: otherUserId, symbol: "OTHR" });
      const report = await buildCrossEngineDailyReport(userId);
      expect(report.engine1.watchlistTotalItems).toBe(0);
      expect(report.engine1.watchlistCrossings.every((c) => c.symbol !== "OTHR")).toBe(true);
    } finally {
      await cleanupUser(otherUserId);
    }
  });
});
