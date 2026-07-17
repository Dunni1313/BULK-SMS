// AI Trade Journal sprint — Phase 8, Sprint 4. Direct, DB-backed unit
// coverage of the top-level orchestrator buildTradeJournal() and the
// single-trade lookup buildSingleTradeReview(), both PURE COMPOSITION
// over already-existing, unmodified modules (see lib/tradeJournal.ts's
// own header). Never contacts a broker execution endpoint, never
// creates or modifies an order or position, never mutates the trades
// table.
//
// Uses fresh, isolated users (the same established pattern
// lib/intelligenceEngine.test.ts/lib/portfolioAnalyst.test.ts already
// use) so assertions are never at risk of colliding with another
// concurrently-running test file's own trades.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, tradesTable, settingsTable, journalEntriesTable, learningProgressTable } from "@workspace/db";
import { buildTradeJournal, buildSingleTradeReview } from "./tradeJournal.js";
import { getSnapshot, buildIronCondor } from "./optionsMath.js";

async function createUser(label: string): Promise<string> {
  const [row] = await db
    .insert(usersTable)
    .values({ email: `trade-journal-${label}-${randomUUID()}@example.com`, displayName: `Trade Journal ${label}` })
    .returning({ id: usersTable.id });
  return row.id;
}

async function cleanupUser(userId: string): Promise<void> {
  await db.delete(tradesTable).where(eq(tradesTable.userId, userId));
  await db.delete(journalEntriesTable).where(eq(journalEntriesTable.userId, userId));
  await db.delete(learningProgressTable).where(eq(learningProgressTable.userId, userId));
  await db.delete(settingsTable).where(eq(settingsTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

interface CloseOpts {
  quantity?: number;
  openDaysAgo?: number;
  closeDaysAgo?: number;
  outcome?: "win_target" | "win_early" | "loss_stop" | "loss_beyond_stop" | "manual_flat";
  shortDelta?: number;
}

// Real, empirically-grounded fixture: builds a genuine iron condor quote
// via buildIronCondor() (the same real pricing this whole codebase
// already uses everywhere else) and inserts it directly as a CLOSED
// trade with a real, internally-consistent P&L derived from the quote's
// own maxProfit/maxLoss — never a fabricated, disconnected number.
async function insertClosedTrade(userId: string, symbol: string, opts: CloseOpts = {}): Promise<number> {
  const snap = getSnapshot(symbol) ?? getSnapshot("AAPL")!;
  const quote = buildIronCondor(snap, { shortDelta: opts.shortDelta, dte: 45 });
  const qty = opts.quantity ?? 1;
  const openDate = daysAgo(opts.openDaysAgo ?? 30);
  const closeDate = daysAgo(opts.closeDaysAgo ?? 5);
  const expiration = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  const legs = quote.legs.map((l) => ({
    side: l.side,
    optionType: l.optionType,
    strike: l.strike,
    expiration,
    openPrice: l.openPrice,
    quantity: qty,
  }));
  const credit = quote.credit * qty;
  const maxProfit = quote.maxProfit * qty;
  const maxLoss = quote.maxLoss * qty;

  let currentPnl: number;
  let exitReason: string;
  switch (opts.outcome ?? "win_target") {
    case "win_target":
      currentPnl = maxProfit * 0.8;
      exitReason = "Profit target reached (75%)";
      break;
    case "win_early":
      currentPnl = maxProfit * 0.3;
      exitReason = "Manual exit";
      break;
    case "loss_stop":
      currentPnl = -Math.abs(credit) * 2;
      exitReason = "Stop loss hit";
      break;
    case "loss_beyond_stop":
      currentPnl = -maxLoss;
      exitReason = "Manual exit";
      break;
    case "manual_flat":
    default:
      currentPnl = 0;
      exitReason = "Manual exit";
      break;
  }
  const currentPnlPercent = maxProfit > 0 ? (currentPnl / maxProfit) * 100 : 0;

  const [row] = await db
    .insert(tradesTable)
    .values({
      userId,
      symbol,
      strategy: "iron_condor",
      status: "closed",
      legs,
      openDate,
      closeDate,
      expiration,
      credit,
      maxProfit,
      maxLoss,
      currentPnl,
      currentPnlPercent,
      pop: quote.pop,
      exitReason,
      entryIv: null,
    })
    .returning({ id: tradesTable.id });
  return row.id;
}

describe("buildTradeJournal", () => {
  describe("no trade history", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("empty");
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("honestly reports zero closed trades — never a fabricated review", async () => {
      const result = await buildTradeJournal(userId);
      expect(result.totalClosedTrades).toBe(0);
      expect(result.recentTrades).toEqual([]);
      expect(result.behaviorPatterns).toEqual([]);
      expect(result.behaviorTrend).toBeNull();
      expect(result.disciplineScore).toBe(0);
      expect(result.timeline).toEqual([]);
    });

    it("always discloses paperTradingMode/deterministicAnalysis/educationalOnly as structural facts", async () => {
      const result = await buildTradeJournal(userId);
      expect(result.paperTradingMode).toBe(true);
      expect(result.deterministicAnalysis).toBe(true);
      expect(result.educationalOnly).toBe(true);
    });
  });

  describe("a single winning trade", () => {
    let userId: string;
    let tradeId: number;
    beforeAll(async () => {
      userId = await createUser("winner");
      tradeId = await insertClosedTrade(userId, "AAPL", { outcome: "win_target" });
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("Trade Review carries real Strategy/Holding Period/P&L/Greeks/Position Size fields", async () => {
      const result = await buildTradeJournal(userId);
      expect(result.totalClosedTrades).toBe(1);
      const review = result.recentTrades[0];
      expect(review.tradeId).toBe(tradeId);
      expect(review.strategy).toBe("iron_condor");
      expect(review.holdingPeriodDays).toBeGreaterThan(0);
      expect(review.realizedPnl).toBeGreaterThan(0);
      expect(review.positionSizeContracts).toBe(1);
      expect(typeof review.greeksAtEntry.delta).toBe("number");
      expect(review.greeksAtExit).not.toBeNull();
    });

    it("Decision Quality tags the trade as having let the winner run, reusing the real profitTarget75 rule", async () => {
      const result = await buildTradeJournal(userId);
      const review = result.recentTrades[0];
      const codes = review.decisionQuality.map((t) => t.code);
      expect(codes).toContain("winner_let_run");
      expect(codes).toContain("exit_profit_target_rule");
    });

    it("Decision Quality never scores subjectively — every tag carries a real ruleReference", async () => {
      const result = await buildTradeJournal(userId);
      for (const tag of result.recentTrades[0].decisionQuality) {
        expect(tag.ruleReference.length).toBeGreaterThan(0);
      }
    });
  });

  describe("a single losing trade closed manually beyond the stop-loss bound", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("loser");
      await insertClosedTrade(userId, "MSFT", { outcome: "loss_beyond_stop" });
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("Decision Quality tags the trade as having held a loser too long", async () => {
      const result = await buildTradeJournal(userId);
      const codes = result.recentTrades[0].decisionQuality.map((t) => t.code);
      expect(codes).toContain("loss_ran_beyond_plan");
      expect(result.recentTrades[0].realizedPnl).toBeLessThan(0);
    });
  });

  describe("a loss capped exactly at the stop-loss rule", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("stopped");
      await insertClosedTrade(userId, "GOOGL", { outcome: "loss_stop" });
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("Decision Quality tags the trade as having cut losses appropriately, per the real stop-loss rule", async () => {
      const result = await buildTradeJournal(userId);
      const codes = result.recentTrades[0].decisionQuality.map((t) => t.code);
      expect(codes).toContain("loss_capped_appropriately");
      expect(codes).toContain("exit_stop_loss_rule");
    });
  });

  describe("small position (1 contract)", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("small-position");
      await insertClosedTrade(userId, "AAPL", { quantity: 1, outcome: "win_target" });
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("a small, low-risk position is tagged sizing_respected", async () => {
      const result = await buildTradeJournal(userId);
      const codes = result.recentTrades[0].decisionQuality.map((t) => t.code);
      expect(codes).toContain("sizing_respected");
      expect(result.recentTrades[0].positionSizeContracts).toBe(1);
    });
  });

  describe("large position (many contracts)", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("large-position");
      await insertClosedTrade(userId, "AAPL", { quantity: 50, outcome: "win_target" });
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("a large position is honestly reflected in positionSizeContracts and positionSizePctOfAccount", async () => {
      const result = await buildTradeJournal(userId);
      const review = result.recentTrades[0];
      expect(review.positionSizeContracts).toBe(50);
      expect(review.positionSizePctOfAccount).toBeGreaterThan(0);
    });

    it("an oversized position is honestly tagged sizing_exceeded when it exceeds the max-risk-per-trade limit", async () => {
      const result = await buildTradeJournal(userId);
      const codes = result.recentTrades[0].decisionQuality.map((t) => t.code);
      // 50 contracts' maxLoss is virtually certain to exceed a 1%-of-account default limit.
      expect(codes).toContain("sizing_exceeded");
    });
  });

  describe("diversified trade history (many distinct symbols)", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("diversified");
      for (const symbol of ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"]) {
        await insertClosedTrade(userId, symbol, { outcome: "win_target", openDaysAgo: 40, closeDaysAgo: 20 });
      }
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("Behaviour Analysis surfaces Strong Diversification, referencing real historical trade data", async () => {
      const result = await buildTradeJournal(userId);
      const pattern = result.behaviorPatterns.find((p) => p.code === "strong_diversification");
      expect(pattern).toBeDefined();
      expect(pattern!.tradeCount).toBe(5);
      expect(result.strengths.some((p) => p.code === "strong_diversification")).toBe(true);
    });

    it("never surfaces Excessive Concentration for a genuinely diversified history", async () => {
      const result = await buildTradeJournal(userId);
      expect(result.behaviorPatterns.some((p) => p.code === "excessive_concentration")).toBe(false);
    });
  });

  describe("concentrated trade history (single symbol dominates)", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("concentrated");
      for (let i = 0; i < 4; i++) {
        await insertClosedTrade(userId, "NVDA", { outcome: "win_target", openDaysAgo: 40 - i, closeDaysAgo: 20 - i });
      }
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("Behaviour Analysis surfaces Excessive Concentration, referencing the real dominant symbol", async () => {
      const result = await buildTradeJournal(userId);
      const pattern = result.behaviorPatterns.find((p) => p.code === "excessive_concentration");
      expect(pattern).toBeDefined();
      expect(pattern!.detail).toMatch(/NVDA/);
      expect(result.areasToImprove.some((p) => p.code === "excessive_concentration")).toBe(true);
    });
  });

  describe("high Greeks (large multi-leg position)", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("high-greeks");
      await insertClosedTrade(userId, "SPY", { quantity: 20, outcome: "win_target" });
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("Greeks at Entry and Greeks at Exit are both real, non-trivial figures for a large position", async () => {
      const result = await buildTradeJournal(userId);
      const review = result.recentTrades[0];
      expect(Math.abs(review.greeksAtEntry.delta) + Math.abs(review.greeksAtEntry.theta)).toBeGreaterThan(0);
      expect(review.greeksAtExit).not.toBeNull();
    });
  });

  describe("high event risk (real earnings event during the holding window)", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("high-event-risk");
      // Empirically-verified real fixture already established by
      // lib/intelligenceEngine.test.ts/lib/portfolioDashboard.test.ts:
      // AAPL resolves real event data via the reused, unmodified
      // event-risk engine.
      await insertClosedTrade(userId, "AAPL", { outcome: "win_target", openDaysAgo: 60, closeDaysAgo: 5 });
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("Event Risk at Entry is a real, well-shaped assessment, never fabricated", async () => {
      const result = await buildTradeJournal(userId);
      const review = result.recentTrades[0];
      expect(["none", "low", "medium", "high"]).toContain(review.eventRiskAtEntry.level);
      expect(Array.isArray(review.eventRiskAtEntry.events)).toBe(true);
    });
  });

  describe("large trade history", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("large-history");
      const symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "SPY", "QQQ"];
      for (let i = 0; i < 15; i++) {
        const symbol = symbols[i % symbols.length];
        const outcome = i % 3 === 0 ? "loss_stop" : "win_target";
        await insertClosedTrade(userId, symbol, { outcome, openDaysAgo: 100 - i * 2, closeDaysAgo: 90 - i * 2 });
      }
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("never crashes on a genuinely large trade history and honestly reports the real total count", async () => {
      const result = await buildTradeJournal(userId);
      expect(result.totalClosedTrades).toBe(15);
      expect(result.recentTrades.length).toBeLessThanOrEqual(15);
    });

    it("Discipline Score and decisionQualitySummary are real, well-formed aggregates over the full history", async () => {
      const result = await buildTradeJournal(userId);
      expect(result.disciplineScore).toBeGreaterThanOrEqual(0);
      expect(result.disciplineScore).toBeLessThanOrEqual(100);
      expect(result.decisionQualitySummary.ruleBasedExitRatePct).toBeGreaterThan(0);
    });

    it("computes a real Behaviour Trend once enough history exists, reusing the shared computeTrend() primitive", async () => {
      const result = await buildTradeJournal(userId);
      expect(result.behaviorTrend).not.toBeNull();
      expect(["improving", "declining", "stable"]).toContain(result.behaviorTrend!.direction);
    });
  });

  describe("timeline generation", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("timeline");
      await insertClosedTrade(userId, "AAPL", { outcome: "win_target", openDaysAgo: 20, closeDaysAgo: 10 });
      await insertClosedTrade(userId, "MSFT", { outcome: "loss_stop", openDaysAgo: 15, closeDaysAgo: 3 });
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("Journal Timeline includes real trade_opened and trade_closed events with real timestamps", async () => {
      const result = await buildTradeJournal(userId);
      const opened = result.timeline.filter((e) => e.type === "trade_opened");
      const closed = result.timeline.filter((e) => e.type === "trade_closed");
      expect(opened.length).toBe(2);
      expect(closed.length).toBe(2);
      for (const e of result.timeline) {
        expect(typeof e.timestamp).toBe("string");
        expect(new Date(e.timestamp).getTime()).not.toBeNaN();
      }
    });

    it("Journal Timeline is sorted newest-first", async () => {
      const result = await buildTradeJournal(userId);
      const timestamps = result.timeline.map((e) => new Date(e.timestamp).getTime());
      const sorted = [...timestamps].sort((a, b) => b - a);
      expect(timestamps).toEqual(sorted);
    });
  });

  describe("learning integration", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("learning-integration");
      for (let i = 0; i < 4; i++) {
        await insertClosedTrade(userId, "NVDA", { outcome: "win_early", openDaysAgo: 40 - i, closeDaysAgo: 20 - i });
      }
      await db.insert(learningProgressTable).values({
        userId,
        itemType: "lesson",
        itemKey: "institutional-decision-quality",
        viewedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      });
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("Learning Recommendations link real areas-to-improve to a real lesson/glossary/strategy — never a fabricated resource", async () => {
      const result = await buildTradeJournal(userId);
      expect(result.areasToImprove.length).toBeGreaterThan(0);
      expect(result.learningRecommendations.length).toBeGreaterThan(0);
      for (const link of result.learningRecommendations) {
        expect(link.lessonHref !== null || link.glossaryHref !== null).toBe(true);
      }
    });

    it("Learning Recommendations never recommend a trade — only education", async () => {
      const result = await buildTradeJournal(userId);
      const text = JSON.stringify(result.learningRecommendations);
      expect(text).not.toMatch(/buy now|sell now|place order|submit order/i);
    });

    it("Journal Timeline includes the real learning_completed event", async () => {
      const result = await buildTradeJournal(userId);
      const learningEvents = result.timeline.filter((e) => e.type === "learning_completed");
      expect(learningEvents.length).toBeGreaterThan(0);
      expect(learningEvents[0].label).toMatch(/institutional-decision-quality/);
    });
  });

  describe("linked journal entry reuse (existing journal functionality)", () => {
    let userId: string;
    let tradeId: number;
    beforeAll(async () => {
      userId = await createUser("linked-journal");
      tradeId = await insertClosedTrade(userId, "AAPL", { outcome: "win_target" });
      await db.insert(journalEntriesTable).values({
        userId,
        tradeId,
        title: "Closed AAPL iron condor",
        content: "Profit target reached.",
        mood: "confident",
        tags: ["iron_condor", "win"],
      });
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("Trade Review surfaces the real, already-existing linked journal entry — never a duplicate write", async () => {
      const before = await db.select().from(journalEntriesTable).where(eq(journalEntriesTable.userId, userId));
      const result = await buildTradeJournal(userId);
      const after = await db.select().from(journalEntriesTable).where(eq(journalEntriesTable.userId, userId));
      expect(after.length).toBe(before.length);
      const review = result.recentTrades.find((r) => r.tradeId === tradeId)!;
      expect(review.linkedJournalEntry).not.toBeNull();
      expect(review.linkedJournalEntry!.title).toBe("Closed AAPL iron condor");
    });
  });

  describe("persistence discipline (never mutates trades)", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("persistence");
      await insertClosedTrade(userId, "AAPL", { outcome: "win_target" });
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("never mutates the trades table — the same closed trade exists before and after", async () => {
      const before = await db.select().from(tradesTable).where(eq(tradesTable.userId, userId));
      await buildTradeJournal(userId);
      const after = await db.select().from(tradesTable).where(eq(tradesTable.userId, userId));
      expect(after.length).toBe(before.length);
      expect(after[0]).toEqual(before[0]);
    });

    it("is deterministic across repeated same-day calls (aside from generatedAt)", async () => {
      const a = await buildTradeJournal(userId);
      const b = await buildTradeJournal(userId);
      expect(a.disciplineScore).toBe(b.disciplineScore);
      expect(a.recentTrades.map((r) => r.tradeId)).toEqual(b.recentTrades.map((r) => r.tradeId));
      expect(a.behaviorPatterns).toEqual(b.behaviorPatterns);
    });
  });
});

describe("buildSingleTradeReview", () => {
  let userId: string;
  let closedTradeId: number;
  let openTradeId: number;

  beforeAll(async () => {
    userId = await createUser("single-review");
    closedTradeId = await insertClosedTrade(userId, "AAPL", { outcome: "win_target" });
    const snap = getSnapshot("MSFT")!;
    const quote = buildIronCondor(snap, { dte: 45 });
    const [row] = await db
      .insert(tradesTable)
      .values({
        userId,
        symbol: "MSFT",
        strategy: "iron_condor",
        status: "open",
        legs: quote.legs.map((l) => ({ side: l.side, optionType: l.optionType, strike: l.strike, expiration: "2099-01-01", openPrice: l.openPrice, quantity: 1 })),
        credit: quote.credit,
        maxProfit: quote.maxProfit,
        maxLoss: quote.maxLoss,
        pop: quote.pop,
      })
      .returning({ id: tradesTable.id });
    openTradeId = row.id;
  });
  afterAll(async () => {
    await cleanupUser(userId);
  });

  it("resolves a real, well-shaped review for a genuinely closed trade owned by the caller", async () => {
    const review = await buildSingleTradeReview(userId, closedTradeId);
    expect(review).not.toBeNull();
    expect(review!.tradeId).toBe(closedTradeId);
    expect(review!.symbol).toBe("AAPL");
  });

  it("honestly returns null for an open (not-yet-closed) trade — a review only exists for a completed trade", async () => {
    const review = await buildSingleTradeReview(userId, openTradeId);
    expect(review).toBeNull();
  });

  it("honestly returns null for a nonexistent trade id", async () => {
    const review = await buildSingleTradeReview(userId, 999999999);
    expect(review).toBeNull();
  });

  it("honestly returns null for another user's own closed trade — never leaks across tenants", async () => {
    const otherUserId = await createUser("single-review-other");
    try {
      const review = await buildSingleTradeReview(otherUserId, closedTradeId);
      expect(review).toBeNull();
    } finally {
      await cleanupUser(otherUserId);
    }
  });
});
