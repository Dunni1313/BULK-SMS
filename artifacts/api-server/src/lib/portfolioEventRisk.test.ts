// Earnings & Event Risk Portfolio Overlay sprint — direct unit coverage
// of buildPortfolioEventRiskOverlay(), the pure composition layer that
// never contacts a broker execution endpoint, never creates or modifies
// an order or position, and never mutates local state beyond ordinary
// reads.
//
// Uses fresh, isolated users (inserted directly, mirroring
// lib/portfolioStressTest.test.ts's own established pattern) so
// multi-position/event assertions are never at risk of colliding with
// another concurrently-running test file's own trades.
//
// Fixture note: event windows below were empirically verified against
// the real, unmodified eventRisk.ts before being hardcoded here (never
// guessed) — a short (+3/+5 day) expiration on a non-dividend-paying
// symbol reliably has zero events; a long (+45 day) expiration on a
// symbol with a simulated earnings date reliably trips "high" risk with
// multiple distinct event categories (earnings + economic + jobs + cpi);
// a long expiration on a non-dividend symbol with no near-term earnings
// reliably trips "medium" risk from macro events alone.

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, tradesTable, settingsTable } from "@workspace/db";
import {
  buildPortfolioEventRiskOverlay,
  UNSUPPORTED_EVENT_CATEGORIES,
} from "./portfolioEventRisk.js";
import { getSnapshot, buildIronCondor } from "./optionsMath.js";

async function createUser(label: string): Promise<string> {
  const [row] = await db
    .insert(usersTable)
    .values({ email: `event-risk-${label}-${randomUUID()}@example.com`, displayName: `EventRisk ${label}` })
    .returning({ id: usersTable.id });
  return row.id;
}

async function cleanupUser(userId: string): Promise<void> {
  await db.delete(tradesTable).where(eq(tradesTable.userId, userId));
  await db.delete(settingsTable).where(eq(settingsTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

function isoDateInDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().split("T")[0];
}

// Version 1.0.0 Finalization hardening. lib/eventRisk.ts's own macro
// calendar (Nonfarm Payrolls/CPI/PCE/FOMC) is deterministically generated
// from REAL calendar dates, not random — so a fixture like "TSLA at a
// short expiration reliably has zero events" is only true on days that
// happen to fall in a genuine gap between monthly macro-release dates.
// The 3 describe blocks below rely on such gaps and drifted out of true
// as real time passed since they were first "empirically verified" (their
// own prior comments already disclosed this verification methodology).
// Fixed by freezing the clock to 2026-10-15T00:00:00Z — a date verified,
// via direct probing of the real, unmodified getEventRiskForSymbol(),
// to reproduce every one of these 3 blocks' own original fixture
// intentions permanently, regardless of which real date this suite is
// actually run on. The other 2 describe blocks in this file ("portfolio
// with multiple events...", "medium-risk macro-only events") are left on
// the real clock since they were not failing and do not need this fix.
const FROZEN_EVENT_CLOCK = new Date("2026-10-15T00:00:00.000Z");

interface InsertedTrade {
  id: number;
}

async function insertPosition(
  userId: string,
  symbol: string,
  expirationDaysAway: number,
  opts: { shortDelta?: number; quantity?: number } = {},
): Promise<InsertedTrade> {
  // IBM/GLD (used for "no known snapshot"/macro-only fixtures) are not
  // in this engine's own SIMULATED pricing UNIVERSE — getSnapshot()
  // honestly returns null for them, so real strikes/pricing are built
  // from a real UNIVERSE symbol (AAPL) instead. Only the trade's own
  // `symbol` column (what getEventRiskForSymbol() actually reads) is
  // set to the target symbol — this test suite never asserts on the
  // legs' own strikes for these fixtures, only on event-risk behavior.
  const snap = getSnapshot(symbol) ?? getSnapshot("AAPL")!;
  const quote = buildIronCondor(snap, { shortDelta: opts.shortDelta, dte: 45 });
  const expiration = isoDateInDays(expirationDaysAway);
  const qty = opts.quantity ?? 1;
  const legs = quote.legs.map((l) => ({
    side: l.side,
    optionType: l.optionType,
    strike: l.strike,
    expiration,
    openPrice: l.openPrice,
    quantity: qty,
  }));
  const [row] = await db
    .insert(tradesTable)
    .values({
      userId,
      symbol,
      strategy: "iron_condor",
      status: "open",
      legs,
      credit: quote.credit,
      maxProfit: quote.maxProfit,
      maxLoss: quote.maxLoss,
      pop: quote.pop,
      expiration,
      entryIv: null,
    })
    .returning({ id: tradesTable.id });
  return row;
}

describe("buildPortfolioEventRiskOverlay", () => {
  describe("empty portfolio", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("empty");
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("honestly reports a zeroed-out summary with no crash", async () => {
      const result = await buildPortfolioEventRiskOverlay(userId);
      expect(result.positions).toHaveLength(0);
      expect(result.summary).toEqual({
        totalPositions: 0,
        positionsWithEvents: 0,
        positionsWithoutEvents: 0,
        highRiskCount: 0,
        within1Day: 0,
        within3Days: 0,
        within7Days: 0,
        within14Days: 0,
        aggregateExposurePct: 0,
        highestRiskPosition: null,
      });
    });

    it("always honestly discloses the unsupported event categories, never fabricated", async () => {
      const result = await buildPortfolioEventRiskOverlay(userId);
      expect(result.unsupportedEventCategories).toEqual(UNSUPPORTED_EVENT_CATEGORIES);
      const categories = result.unsupportedEventCategories.map((c) => c.category);
      expect(categories).toContain("fda_decision");
      expect(categories).toContain("product_launch");
    });

    it("reports credentialsConfigured/brokerConnected without crashing (missing credentials)", async () => {
      const result = await buildPortfolioEventRiskOverlay(userId);
      expect(typeof result.credentialsConfigured).toBe("boolean");
      expect(result.credentialsConfigured).toBe(false);
      expect(result.brokerConnected === null || typeof result.brokerConnected === "boolean").toBe(true);
    });
  });

  describe("portfolio without events", () => {
    let userId: string;
    let trade: InsertedTrade;

    beforeAll(async () => {
      // toFake: ["Date"] only — never fake setTimeout/setInterval/etc,
      // which would risk hanging the real async Postgres driver calls
      // this same beforeAll/it block makes.
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(FROZEN_EVENT_CLOCK);
      userId = await createUser("no-events");
      // TSLA, a short 3-day expiration, no dividend — empirically
      // verified (at the frozen clock above) to produce zero events.
      trade = await insertPosition(userId, "TSLA", 3);
    });
    afterAll(async () => {
      vi.useRealTimers();
      await cleanupUser(userId);
    });

    it("honestly reports no_events and a none risk level, never a fabricated event", async () => {
      const result = await buildPortfolioEventRiskOverlay(userId);
      const pos = result.positions.find((p) => p.tradeId === trade.id)!;
      expect(pos.eventStatus).toBe("no_events");
      expect(pos.events).toHaveLength(0);
      expect(pos.primaryEvent).toBeNull();
      expect(pos.riskLevel).toBe("none");
      expect(pos.riskGuidance).toBe("no_immediate_event_risk");
      expect(pos.riskGuidanceLabel).toBe("No Immediate Event Risk");
      expect(pos.confidence).toBeNull();
      expect(result.summary.positionsWithoutEvents).toBe(1);
      expect(result.summary.positionsWithEvents).toBe(0);
    });
  });

  describe("portfolio with multiple events and multiple event categories", () => {
    let userId: string;
    let trade: InsertedTrade;

    beforeAll(async () => {
      userId = await createUser("multi-events");
      // TSLA at 45 DTE — empirically verified: earnings + economic +
      // jobs + cpi, level "high".
      trade = await insertPosition(userId, "TSLA", 45);
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("surfaces every distinct event category before this position's own expiration", async () => {
      const result = await buildPortfolioEventRiskOverlay(userId);
      const pos = result.positions.find((p) => p.tradeId === trade.id)!;
      expect(pos.eventStatus).toBe("has_events");
      expect(pos.events.length).toBeGreaterThanOrEqual(4);
      const types = new Set(pos.events.map((e) => e.type));
      expect(types.has("earnings")).toBe(true);
      expect(types.size).toBeGreaterThanOrEqual(3);
    });

    it("events are sorted soonest-first, and every event is honestly non-past (daysAway >= 0)", async () => {
      const result = await buildPortfolioEventRiskOverlay(userId);
      const pos = result.positions.find((p) => p.tradeId === trade.id)!;
      for (const e of pos.events) expect(e.daysAway).toBeGreaterThanOrEqual(0);
      const sorted = [...pos.events].sort((a, b) => a.daysAway - b.daysAway);
      expect(pos.events.map((e) => e.date)).toEqual(sorted.map((e) => e.date));
    });

    it("the primary event is the soonest one", async () => {
      const result = await buildPortfolioEventRiskOverlay(userId);
      const pos = result.positions.find((p) => p.tradeId === trade.id)!;
      const minDaysAway = Math.min(...pos.events.map((e) => e.daysAway));
      expect(pos.primaryEvent!.daysAway).toBe(minDaysAway);
    });
  });

  describe("high-risk events", () => {
    let userId: string;
    let highRiskTrade: InsertedTrade;
    let noEventsTrade: InsertedTrade;

    beforeAll(async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(FROZEN_EVENT_CLOCK);
      userId = await createUser("high-risk");
      highRiskTrade = await insertPosition(userId, "AAPL", 45);
      noEventsTrade = await insertPosition(userId, "IBM", 3);
    });
    afterAll(async () => {
      vi.useRealTimers();
      await cleanupUser(userId);
    });

    it("flags the earnings-bearing position as high risk with Consider Adjustment guidance", async () => {
      const result = await buildPortfolioEventRiskOverlay(userId);
      const pos = result.positions.find((p) => p.tradeId === highRiskTrade.id)!;
      expect(pos.riskLevel).toBe("high");
      expect(pos.riskGuidance).toBe("consider_adjustment");
      expect(pos.riskGuidanceLabel).toBe("Consider Adjustment");
      // Confidence reflects the PRIMARY (soonest) event's own source
      // shape — for this fixture the soonest event is a macro release,
      // not the later earnings date, so "scheduled" is the honest label
      // here even though the position overall carries earnings risk.
      expect(["scheduled", "simulated_estimate"]).toContain(pos.confidence);
      expect(pos.events.some((e) => e.type === "earnings")).toBe(true);
    });

    it("identifies the highest-risk position across the whole portfolio", async () => {
      const result = await buildPortfolioEventRiskOverlay(userId);
      expect(result.summary.highestRiskPosition).not.toBeNull();
      expect(result.summary.highestRiskPosition!.tradeId).toBe(highRiskTrade.id);
      expect(result.summary.highestRiskPosition!.riskLevel).toBe("high");
      expect(result.summary.highRiskCount).toBe(1);
      void noEventsTrade;
    });

    it("aggregate portfolio event exposure only counts positions that actually carry event risk", async () => {
      const result = await buildPortfolioEventRiskOverlay(userId);
      const highRiskPos = result.positions.find((p) => p.tradeId === highRiskTrade.id)!;
      expect(result.summary.aggregateExposurePct).toBeCloseTo(highRiskPos.portfolioWeightPct, 5);
    });
  });

  describe("medium-risk macro-only events", () => {
    let userId: string;
    let trade: InsertedTrade;

    beforeAll(async () => {
      userId = await createUser("medium-risk");
      // IBM, 45 DTE, no dividend/earnings — empirically verified to be
      // macro-events-only, level "medium".
      trade = await insertPosition(userId, "IBM", 45);
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("reports Consider Review guidance for a medium-risk, macro-only position", async () => {
      const result = await buildPortfolioEventRiskOverlay(userId);
      const pos = result.positions.find((p) => p.tradeId === trade.id)!;
      expect(pos.riskLevel).toBe("medium");
      expect(pos.riskGuidance).toBe("consider_review");
      expect(pos.riskGuidanceLabel).toBe("Consider Review");
      expect(pos.events.every((e) => e.type !== "earnings")).toBe(true);
      // Market-wide macro events are labeled "scheduled" confidence.
      expect(pos.confidence).toBe("scheduled");
    });
  });

  describe("dividend events (low risk)", () => {
    let userId: string;
    let trade: InsertedTrade;

    beforeAll(async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(FROZEN_EVENT_CLOCK);
      userId = await createUser("dividend");
      // SPY, 3 DTE — empirically verified (at the frozen clock above) to
      // carry only a dividend event, level "low".
      trade = await insertPosition(userId, "SPY", 3);
    });
    afterAll(async () => {
      vi.useRealTimers();
      await cleanupUser(userId);
    });

    it("reports Monitor guidance for a low-risk dividend-only position", async () => {
      const result = await buildPortfolioEventRiskOverlay(userId);
      const pos = result.positions.find((p) => p.tradeId === trade.id)!;
      expect(pos.riskLevel).toBe("low");
      expect(pos.riskGuidance).toBe("monitor");
      expect(pos.riskGuidanceLabel).toBe("Monitor");
      expect(pos.events[0].type).toBe("dividend");
      expect(pos.confidence).toBe("simulated_estimate");
    });
  });

  describe("event countdown buckets (1/3/7/14 days)", () => {
    let userId: string;

    beforeAll(async () => {
      // Freezes the clock, matching the "dividend events" block above —
      // the "SPY dividend within 3 days" / "IBM macro soonest ~7 days out"
      // assumptions below were empirically verified at this exact frozen
      // clock and drift with the passage of real time otherwise (a
      // pre-existing bug caught during v1.3.0 Sprint 1 CI validation,
      // unrelated to that sprint's own changes).
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(FROZEN_EVENT_CLOCK);
      userId = await createUser("buckets");
      await insertPosition(userId, "SPY", 3); // dividend within 3 days
      await insertPosition(userId, "IBM", 45); // macro events, soonest ~7 days out
    });
    afterAll(async () => {
      vi.useRealTimers();
      await cleanupUser(userId);
    });

    it("counts positions (not raw events) within each countdown window", async () => {
      const result = await buildPortfolioEventRiskOverlay(userId);
      expect(result.summary.within7Days).toBeGreaterThanOrEqual(1);
      expect(result.summary.within14Days).toBeGreaterThanOrEqual(result.summary.within7Days);
      expect(result.summary.within3Days).toBeLessThanOrEqual(result.summary.within7Days);
      expect(result.summary.within1Day).toBeLessThanOrEqual(result.summary.within3Days);
    });
  });

  describe("past events — never fabricated, honestly filtered", () => {
    let userId: string;
    let expiredTrade: InsertedTrade;

    beforeAll(async () => {
      userId = await createUser("past");
      expiredTrade = await insertPosition(userId, "AAPL", -2); // expiration already in the past
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("never crashes and never returns a past-dated event for an already-expired position", async () => {
      const result = await buildPortfolioEventRiskOverlay(userId);
      const pos = result.positions.find((p) => p.tradeId === expiredTrade.id)!;
      expect(pos).toBeDefined();
      for (const e of pos.events) expect(e.daysAway).toBeGreaterThanOrEqual(0);
    });
  });

  describe("missing event data (symbol with no known snapshot)", () => {
    let userId: string;
    let trade: InsertedTrade;

    beforeAll(async () => {
      userId = await createUser("missing-data");
      // GLD is not in this engine's own deterministic UNIVERSE and is
      // not a dividend payer — getSnapshot() returns null for it, so
      // no earnings signal exists; only macro events can apply.
      trade = await insertPosition(userId, "GLD", 45);
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("degrades honestly for a symbol this engine has no earnings data for, never fabricating an earnings event", async () => {
      const result = await buildPortfolioEventRiskOverlay(userId);
      const pos = result.positions.find((p) => p.tradeId === trade.id)!;
      expect(pos.events.every((e) => e.type !== "earnings")).toBe(true);
    });
  });

  describe("expiration_unknown (defensive, missing expiration on an open trade)", () => {
    let userId: string;
    let tradeId: number;

    beforeAll(async () => {
      userId = await createUser("no-expiration");
      const [row] = await db
        .insert(tradesTable)
        .values({
          userId,
          symbol: "AAPL",
          strategy: "iron_condor",
          status: "open",
          legs: [],
          credit: 100,
          maxProfit: 100,
          maxLoss: 300,
          pop: 65,
          expiration: null,
          entryIv: null,
        })
        .returning({ id: tradesTable.id });
      tradeId = row.id;
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("honestly reports expiration_unknown rather than crashing or fabricating an assessment window", async () => {
      const result = await buildPortfolioEventRiskOverlay(userId);
      const pos = result.positions.find((p) => p.tradeId === tradeId)!;
      expect(pos.eventStatus).toBe("expiration_unknown");
      expect(pos.events).toHaveLength(0);
      expect(pos.riskLevel).toBe("none");
    });
  });

  describe("quantity and portfolio weight derivation", () => {
    let userId: string;
    let trade: InsertedTrade;

    beforeAll(async () => {
      userId = await createUser("weight");
      trade = await insertPosition(userId, "TSLA", 3, { quantity: 3 });
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("derives quantity from the position's own stored legs, matching Trade Adjustment's own established technique", async () => {
      const result = await buildPortfolioEventRiskOverlay(userId);
      const pos = result.positions.find((p) => p.tradeId === trade.id)!;
      expect(pos.quantity).toBe(3);
    });

    it("computes portfolio weight as a genuine % of account value, never a raw dollar figure", async () => {
      const result = await buildPortfolioEventRiskOverlay(userId);
      const pos = result.positions.find((p) => p.tradeId === trade.id)!;
      expect(pos.portfolioWeightPct).toBeGreaterThan(0);
      expect(pos.portfolioWeightPct).toBeLessThan(100);
    });
  });

  describe("event source and confidence disclosure", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("disclosure");
      await insertPosition(userId, "TSLA", 45);
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("always honestly labels every event source as SIMULATED — never a fabricated live feed", async () => {
      const result = await buildPortfolioEventRiskOverlay(userId);
      for (const pos of result.positions) {
        expect(pos.eventSource).toBe("SIMULATED");
      }
    });

    it("reports the global eventRiskEnabled setting distinctly from this page's own always-on event visibility", async () => {
      const result = await buildPortfolioEventRiskOverlay(userId);
      expect(typeof result.eventRiskEnabled).toBe("boolean");
    });
  });

  describe("loading/consistency", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("consistency");
      await insertPosition(userId, "TSLA", 45);
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("is deterministic for the same input", async () => {
      const now = Date.now();
      const a = await buildPortfolioEventRiskOverlay(userId, now);
      const b = await buildPortfolioEventRiskOverlay(userId, now);
      expect(a.positions[0].events).toEqual(b.positions[0].events);
      expect(a.summary).toEqual(b.summary);
    });

    it("never mutates the trades table", async () => {
      const before = await db.select().from(tradesTable).where(eq(tradesTable.userId, userId));
      await buildPortfolioEventRiskOverlay(userId);
      const after = await db.select().from(tradesTable).where(eq(tradesTable.userId, userId));
      expect(after).toEqual(before);
    });
  });
});
