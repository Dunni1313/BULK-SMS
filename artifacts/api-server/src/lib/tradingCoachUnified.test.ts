// v1.3.0, Sprint 1 — AI Trading Coach, Backend Foundation. Direct,
// DB-backed unit coverage of buildUnifiedCoachContext() and
// unifiedCoachFallback() — a pure composition layer over already-tested
// engines (see the file header of tradingCoachUnified.ts for the full
// reuse map). Uses fresh, isolated users (mirroring
// lib/tradeAdjustmentPreview.test.ts's own established pattern) so
// assertions are never at risk of colliding with another concurrently-
// running test file's own rows.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  tradesTable,
  settingsTable,
  tradingJournalEntriesTable,
  tradingPositionsTable,
  scannerResultsTable,
} from "@workspace/db";
import { buildUnifiedCoachContext, unifiedCoachFallback } from "./tradingCoachUnified.js";

async function createUser(label: string): Promise<string> {
  const [row] = await db
    .insert(usersTable)
    .values({ email: `unified-coach-${label}-${randomUUID()}@example.com`, displayName: `UnifiedCoach ${label}` })
    .returning({ id: usersTable.id });
  return row.id;
}

async function cleanupUser(userId: string): Promise<void> {
  await db.delete(tradesTable).where(eq(tradesTable.userId, userId));
  await db.delete(settingsTable).where(eq(settingsTable.userId, userId));
  await db.delete(tradingJournalEntriesTable).where(eq(tradingJournalEntriesTable.userId, userId));
  await db.delete(tradingPositionsTable).where(eq(tradingPositionsTable.userId, userId));
  await db.delete(scannerResultsTable).where(eq(scannerResultsTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

describe("buildUnifiedCoachContext — a freshly-created user with no data", () => {
  let userId: string;
  beforeAll(async () => {
    userId = await createUser("empty");
  });
  afterAll(async () => {
    await cleanupUser(userId);
  });

  it("honestly reports no focus symbol, no focus candidate, and zero open positions when none were given/exist", async () => {
    const ctx = await buildUnifiedCoachContext(userId);
    expect(ctx.focusSymbol).toBeNull();
    expect(ctx.focusScannerCandidate).toBeNull();
    expect(ctx.marketStructure).toBeNull();
    expect(ctx.tradingPositionsRisk.openPositionsCount).toBe(0);
    expect(ctx.recentJournalReflections).toEqual([]);
  });

  it("still resolves the options-income portfolio (Engine 3) via assembleDailyReport() even with no trading_positions rows at all — ensureSeedTrades auto-seeds the trades table", async () => {
    const ctx = await buildUnifiedCoachContext(userId);
    expect(ctx.optionsPortfolio.health).toBeDefined();
    expect(ctx.optionsPortfolio.summary).toBeDefined();
    expect(ctx.optionsPortfolio.marketRegime).toBeDefined();
    expect(Array.isArray(ctx.optionsPortfolio.topOpportunities)).toBe(true);
  });

  it("resolves Market Structure/Multi-Timeframe/Liquidity/Regime/Probability (Engine 2) when a symbol is given", async () => {
    const ctx = await buildUnifiedCoachContext(userId, { symbol: "aapl" });
    expect(ctx.focusSymbol).toBe("AAPL");
    expect(ctx.marketStructure).not.toBeNull();
    expect(ctx.marketStructure!.dataSource).toBe("SIMULATED");
    expect(ctx.marketStructure!.regimeLabel).toEqual(expect.any(String));
    expect(ctx.marketStructure!.volatilityRegime).toEqual(expect.any(String));
    expect(ctx.marketStructure!.liquidityBand).toEqual(expect.any(String));
    expect(ctx.marketStructure!.probabilityAvailable).toEqual(expect.any(Boolean));
  });

  it("honestly reports no focus scanner candidate for an unresolvable/nonexistent scannerCandidateId", async () => {
    const ctx = await buildUnifiedCoachContext(userId, { scannerCandidateId: 999_999_999 });
    expect(ctx.focusScannerCandidate).toBeNull();
  });

  it("never fabricates an answer to the actual question in the deterministic fallback — states it plainly instead", () => {
    const ctx = {
      focusSymbol: null,
      focusScannerCandidate: null,
      marketStructure: null,
      tradingPositionsRisk: { overall: { score: null, label: "Insufficient data", detail: "" }, positionSizing: { label: "", detail: "", capBreached: false }, stopDiscipline: { label: "", detail: "" }, portfolioBudget: { label: "", detail: "", capBreached: false }, openPositionsCount: 0, accountValue: null },
      optionsPortfolio: {
        health: { health: { score: 80, label: "Healthy", detail: "" }, exposure: { score: 80, label: "", detail: "" }, riskConcentration: { score: 80, label: "", detail: "" }, components: [], netDelta: 0, netTheta: 0, netVega: 0, netGamma: 0, largestSymbol: null, largestSymbolPct: 0, threatCounts: { green: 0, yellow: 0, red: 0 } },
        summary: { accountValue: 100_000, openPositions: 0 } as any,
        marketRegime: {} as any,
        openPositions: [],
        topOpportunities: [],
        tradesToAvoid: [],
      },
      recentJournalReflections: [],
    } as Parameters<typeof unifiedCoachFallback>[0];
    const fallback = unifiedCoachFallback(ctx, "Will AAPL hit $300 tomorrow?");
    // Echoing the user's own question verbatim (mirrors tradeCoachFallback()'s
    // own Sprint 47 precedent) is expected — the never-fabricate guarantee is
    // that the fallback never INVENTS a price target of its own; it must
    // never state a specific number as if it were real data the coach
    // computed. No such invented figure (e.g. any dollar amount not already
    // present in the question or the real deterministic context) appears.
    expect(fallback).toContain('AI narration is not available right now, so I can\'t directly answer "Will AAPL hit $300 tomorrow?"');
    expect(fallback).toContain("Healthy");
    expect(fallback).not.toMatch(/will (reach|hit|close at)/i);
  });
});

describe("buildUnifiedCoachContext — a user with real Engine 2 trading_positions, journal entries, and a scanner candidate", () => {
  let userId: string;
  let scannerCandidateId: number;

  beforeAll(async () => {
    userId = await createUser("populated");

    await db.insert(tradingPositionsTable).values({
      userId,
      symbol: "MSFT",
      side: "long",
      status: "open",
      quantity: 100,
      entryPrice: 300,
      stopPrice: 285,
      targetPrice: 330,
    });

    await db.insert(tradingJournalEntriesTable).values({
      userId,
      title: "Solid breakout trade",
      content: "Entered on a clean breakout above resistance.",
      mood: "confident",
      lessonLearned: "Wait for volume confirmation next time.",
    });

    const [row] = await db
      .insert(scannerResultsTable)
      .values({
        userId,
        symbol: "SPY",
        strategy: "iron_condor",
        credit: 1.5,
        maxProfit: 150,
        maxLoss: 350,
        pop: 0.72,
        ev: 25,
        theta: 4.2,
        ravishScore: 82,
        ravishTier: "strong",
        eventRiskLevel: "none",
      })
      .returning({ id: scannerResultsTable.id });
    scannerCandidateId = row.id;
  });

  afterAll(async () => {
    await cleanupUser(userId);
  });

  it("surfaces the user's own open Engine 2 trading position in the trading-positions risk context", async () => {
    const ctx = await buildUnifiedCoachContext(userId);
    expect(ctx.tradingPositionsRisk.openPositionsCount).toBe(1);
  });

  it("surfaces the user's own recent journal reflection", async () => {
    const ctx = await buildUnifiedCoachContext(userId);
    expect(ctx.recentJournalReflections).toHaveLength(1);
    expect(ctx.recentJournalReflections[0]).toMatchObject({
      title: "Solid breakout trade",
      mood: "confident",
      lessonLearned: "Wait for volume confirmation next time.",
    });
  });

  it("resolves a specific scanner candidate by id, ownership-scoped, surfacing its real AI Opportunity Score fields", async () => {
    const ctx = await buildUnifiedCoachContext(userId, { scannerCandidateId });
    expect(ctx.focusScannerCandidate).toMatchObject({
      symbol: "SPY",
      strategy: "iron_condor",
      ravishScore: 82,
      ravishTier: "strong",
      pop: 0.72,
      ev: 25,
    });
  });

  it("never resolves another user's scanner candidate — ownership-scoped, treated the same as not-found", async () => {
    const otherUserId = await createUser("other-owner");
    try {
      const ctx = await buildUnifiedCoachContext(otherUserId, { scannerCandidateId });
      expect(ctx.focusScannerCandidate).toBeNull();
    } finally {
      await cleanupUser(otherUserId);
    }
  });

  it("the deterministic fallback honestly states the real open-position count and includes the focus candidate's real Ravish Score", async () => {
    const ctx = await buildUnifiedCoachContext(userId, { scannerCandidateId });
    const fallback = unifiedCoachFallback(ctx, "What should I do?");
    expect(fallback).toContain("1 open position");
    expect(fallback).toContain("82.0");
    expect(fallback).toContain("strong");
  });
});
