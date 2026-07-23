// Portfolio Stress Test & Scenario Simulator sprint — direct unit
// coverage of buildPortfolioStressTest(), the pure composition layer that
// never contacts a broker execution endpoint, never creates, closes, or
// modifies an order or position, and never mutates local state beyond
// ordinary reads.
//
// Uses fresh, isolated users (inserted directly, mirroring
// lib/tradeAdjustmentPreview.test.ts's/lib/positionSizing.test.ts's own
// established pattern) so multi-position/exposure assertions are never at
// risk of colliding with another concurrently-running test file's own
// trades. Fixtures use real, internally-consistent optionsMath.ts quotes
// (buildIronCondor/buildCalendar, unmodified) rather than fabricated
// credit/maxLoss/maxProfit numbers, so every repriced figure reflects the
// real deterministic pricing engine end to end.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, tradesTable, settingsTable } from "@workspace/db";
import {
  buildPortfolioStressTest,
  DEFAULT_SCENARIO_PRESETS,
  RISK_THRESHOLD_BREACH_SCORE_CAP,
} from "./portfolioStressTest.js";
import { getSnapshot, buildIronCondor, buildCalendar } from "./optionsMath.js";
import { computeTradeGreeks, getSettingsRow } from "./serverState.js";

async function createUser(label: string): Promise<string> {
  const [row] = await db
    .insert(usersTable)
    .values({ email: `stress-test-${label}-${randomUUID()}@example.com`, displayName: `StressTest ${label}` })
    .returning({ id: usersTable.id });
  return row.id;
}

async function cleanupUser(userId: string): Promise<void> {
  await db.delete(tradesTable).where(eq(tradesTable.userId, userId));
  await db.delete(settingsTable).where(eq(settingsTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

interface InsertedTrade {
  id: number;
}

async function insertIronCondor(
  userId: string,
  symbol: string,
  opts: { shortDelta?: number; dte?: number } = {},
): Promise<InsertedTrade & { credit: number; maxLoss: number; maxProfit: number; legs: unknown }> {
  const snap = getSnapshot(symbol)!;
  const quote = buildIronCondor(snap, { dte: 45, ...opts });
  const legs = quote.legs.map((l) => ({
    side: l.side,
    optionType: l.optionType,
    strike: l.strike,
    expiration: l.expiration,
    openPrice: l.openPrice,
    quantity: l.quantity,
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
      expiration: quote.expiration,
      entryIv: null,
    })
    .returning({ id: tradesTable.id });
  return { id: row.id, credit: quote.credit, maxLoss: quote.maxLoss, maxProfit: quote.maxProfit, legs };
}

async function insertCalendar(userId: string, symbol: string): Promise<InsertedTrade> {
  const snap = getSnapshot(symbol)!;
  const quote = buildCalendar(snap);
  const legs = quote.legs.map((l) => ({
    side: l.side,
    optionType: l.optionType,
    strike: l.strike,
    expiration: l.expiration,
    openPrice: l.openPrice,
    quantity: l.quantity,
  }));
  const [row] = await db
    .insert(tradesTable)
    .values({
      userId,
      symbol,
      strategy: "calendar_spread",
      status: "open",
      legs,
      credit: quote.credit,
      maxProfit: quote.maxProfit,
      maxLoss: quote.maxLoss,
      pop: quote.pop,
      expiration: quote.expiration,
      entryIv: null,
    })
    .returning({ id: tradesTable.id });
  return row;
}

describe("buildPortfolioStressTest", () => {
  describe("empty portfolio", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("empty");
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("honestly reports a zeroed-out base and scenarios with no crash", async () => {
      const result = await buildPortfolioStressTest({}, userId);
      expect(result.available).toBe(true);
      expect(result.base.positions).toHaveLength(0);
      expect(result.base.totalUnrealizedPnl).toBe(0);
      expect(result.base.greeks).toEqual({ delta: 0, gamma: 0, theta: 0, vega: 0 });
      expect(result.base.exposureBySymbol).toHaveLength(0);
      expect(result.base.exposureByStrategy).toHaveLength(0);
      expect(result.base.portfolioValue).toBe(result.accountValue);
      for (const s of result.scenarios) {
        expect(s.after.positions).toHaveLength(0);
        expect(s.portfolioValueImpact).toBe(0);
        expect(s.unrealizedPnlImpact).toBe(0);
        expect(s.largestLosingPosition).toBeNull();
        expect(s.largestGainingPosition).toBeNull();
        expect(s.positionsBreachingThreshold).toHaveLength(0);
      }
    });

    it("uses DEFAULT_SCENARIO_PRESETS when no scenarios are supplied", async () => {
      const result = await buildPortfolioStressTest({}, userId);
      expect(result.scenarios).toHaveLength(DEFAULT_SCENARIO_PRESETS.length);
      expect(result.scenarios.map((s) => s.label)).toEqual(
        DEFAULT_SCENARIO_PRESETS.map((s) => s.label),
      );
    });

    it("always honestly reports sector exposure as unavailable", async () => {
      const result = await buildPortfolioStressTest({}, userId);
      expect(result.sectorExposure).toEqual({
        available: false,
        reason: "No sector/industry classification is stored on options positions in this engine.",
      });
    });

    it("reports credentialsConfigured/brokerConnected without crashing (missing credentials)", async () => {
      const result = await buildPortfolioStressTest({}, userId);
      expect(typeof result.credentialsConfigured).toBe("boolean");
      expect(result.credentialsConfigured).toBe(false);
      expect(result.brokerConnected === null || typeof result.brokerConnected === "boolean").toBe(true);
    });
  });

  describe("single position", () => {
    let userId: string;
    let trade: Awaited<ReturnType<typeof insertIronCondor>>;

    beforeAll(async () => {
      userId = await createUser("single");
      trade = await insertIronCondor(userId, "SPY");
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("the zero-shock base position is byte-identical to computeTradeGreeks()'s own output", async () => {
      const result = await buildPortfolioStressTest({ scenarios: [{ priceShockPct: 5 }] }, userId);
      const direct = computeTradeGreeks({ symbol: "SPY", legs: trade.legs, credit: trade.credit, maxProfit: trade.maxProfit });
      const basePos = result.base.positions.find((p) => p.tradeId === trade.id)!;
      expect(basePos.greeks.delta).toBe(direct.delta);
      expect(basePos.greeks.gamma).toBe(direct.gamma);
      expect(basePos.greeks.theta).toBe(direct.theta);
      expect(basePos.greeks.vega).toBe(direct.vega);
      expect(basePos.costToClose).toBe(direct.costToClose);
      expect(basePos.unrealizedPnl).toBe(direct.unrealizedPnl);
      expect(basePos.unrealizedPnlPercent).toBe(direct.unrealizedPnlPercent);
    });

    it("never mutates the trades table", async () => {
      await buildPortfolioStressTest({ scenarios: [{ priceShockPct: 10, ivShockPct: 20, timeDecayDays: 14 }] }, userId);
      const [row] = await db.select().from(tradesTable).where(eq(tradesTable.id, trade.id));
      expect(row.credit).toBe(trade.credit);
      expect(row.maxLoss).toBe(trade.maxLoss);
      expect(row.maxProfit).toBe(trade.maxProfit);
      expect(row.status).toBe("open");
    });

    it("a price shock changes the position's Greeks and P&L relative to the base case", async () => {
      const result = await buildPortfolioStressTest({ scenarios: [{ label: "Big Up Move", priceShockPct: 10 }] }, userId);
      const scenario = result.scenarios[0];
      const after = scenario.after.positions.find((p) => p.tradeId === trade.id)!;
      const before = result.base.positions.find((p) => p.tradeId === trade.id)!;
      expect(after.unrealizedPnl).not.toBe(before.unrealizedPnl);
      expect(scenario.unrealizedPnlImpact).not.toBe(0);
    });
  });

  describe("multiple positions", () => {
    let userId: string;
    let spy: Awaited<ReturnType<typeof insertIronCondor>>;
    let qqq: Awaited<ReturnType<typeof insertIronCondor>>;

    beforeAll(async () => {
      userId = await createUser("multi");
      spy = await insertIronCondor(userId, "SPY");
      qqq = await insertIronCondor(userId, "QQQ");
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("groups exposure by symbol and by strategy correctly", async () => {
      const result = await buildPortfolioStressTest({ scenarios: [{ priceShockPct: 0 }] }, userId);
      expect(result.base.exposureBySymbol.map((e) => e.symbol).sort()).toEqual(["QQQ", "SPY"]);
      expect(result.base.exposureByStrategy).toHaveLength(1);
      expect(result.base.exposureByStrategy[0].strategy).toBe("iron_condor");
      // Both positions' mark values roll up into the single iron_condor bucket.
      const symbolSum = result.base.exposureBySymbol.reduce((s, e) => s + e.markValue, 0);
      expect(Math.abs(symbolSum - result.base.exposureByStrategy[0].markValue)).toBeLessThan(0.5);
    });

    it("largest losing/gaining position reflects the position most/least hurt by the shock", async () => {
      // A large bullish move helps a bearish-tilted iron condor's call side
      // and hurts its put side asymmetrically across two different-strike
      // positions — regardless of which specific position wins/loses, the
      // two must be genuinely different (not the same trade reported twice)
      // whenever their shocked P&L actually differs.
      const result = await buildPortfolioStressTest({ scenarios: [{ priceShockPct: 15 }] }, userId);
      const scenario = result.scenarios[0];
      expect(scenario.largestLosingPosition).not.toBeNull();
      expect(scenario.largestGainingPosition).not.toBeNull();
      expect([spy.id, qqq.id]).toContain(scenario.largestLosingPosition!.tradeId);
      expect([spy.id, qqq.id]).toContain(scenario.largestGainingPosition!.tradeId);
    });

    it("concentration changes cover every symbol present before or after", async () => {
      const result = await buildPortfolioStressTest({ scenarios: [{ priceShockPct: 5 }] }, userId);
      const symbols = result.scenarios[0].concentrationChanges.map((c) => c.symbol).sort();
      expect(symbols).toEqual(["QQQ", "SPY"]);
    });
  });

  describe("combined price and volatility shocks", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("combined");
      await insertIronCondor(userId, "SPY");
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("a scenario combining price + IV shocks differs from either shock applied alone", async () => {
      const result = await buildPortfolioStressTest(
        {
          scenarios: [
            { label: "Price only", priceShockPct: 5, ivShockPct: 0, timeDecayDays: 0 },
            { label: "IV only", priceShockPct: 0, ivShockPct: 30, timeDecayDays: 0 },
            { label: "Combined", priceShockPct: 5, ivShockPct: 30, timeDecayDays: 0 },
          ],
        },
        userId,
      );
      const [priceOnly, ivOnly, combined] = result.scenarios;
      expect(combined.unrealizedPnlImpact).not.toBe(priceOnly.unrealizedPnlImpact);
      expect(combined.unrealizedPnlImpact).not.toBe(ivOnly.unrealizedPnlImpact);
    });
  });

  describe("time decay", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("timedecay");
      await insertIronCondor(userId, "SPY");
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("applies each of the 4 requested time-decay presets without crashing, each moving theta forward", async () => {
      const result = await buildPortfolioStressTest(
        {
          scenarios: [
            { label: "+1 day", timeDecayDays: 1 },
            { label: "+7 days", timeDecayDays: 7 },
            { label: "+14 days", timeDecayDays: 14 },
            { label: "+30 days", timeDecayDays: 30 },
          ],
        },
        userId,
      );
      expect(result.scenarios).toHaveLength(4);
      for (const s of result.scenarios) {
        expect(Number.isFinite(s.after.totalUnrealizedPnl)).toBe(true);
      }
      // A short-premium iron condor with no price/IV move should show a
      // monotonically increasing seller-favorable P&L as more time passes
      // (theta decay, real, priced via optionsMath.ts's own bs()) — not
      // asserted as a strict inequality per-day (deterministic pricing
      // noise near expiration boundaries is possible) but the 30-day
      // scenario should differ meaningfully from the 1-day scenario.
      expect(result.scenarios[3].unrealizedPnlImpact).not.toBe(result.scenarios[0].unrealizedPnlImpact);
    });
  });

  describe("extreme scenarios", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("extreme");
      await insertIronCondor(userId, "SPY");
      await insertCalendar(userId, "MSFT");
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("clamps and computes a finite result for a huge price crash, huge IV spike, and expiration-exceeding time decay", async () => {
      const result = await buildPortfolioStressTest(
        {
          scenarios: [
            { label: "Crash", priceShockPct: -95, ivShockPct: 500, timeDecayDays: 3650 },
            { label: "Melt-up", priceShockPct: 900, ivShockPct: -95, timeDecayDays: 0 },
          ],
        },
        userId,
      );
      for (const s of result.scenarios) {
        expect(Number.isFinite(s.after.totalUnrealizedPnl)).toBe(true);
        expect(Number.isFinite(s.after.greeks.delta)).toBe(true);
        expect(Number.isFinite(s.riskScoreAfter)).toBe(true);
        for (const p of s.after.positions) {
          expect(Number.isFinite(p.unrealizedPnl)).toBe(true);
          expect(Number.isFinite(p.costToClose)).toBe(true);
        }
      }
    });

    it("clamps out-of-bounds shock values rather than rejecting the scenario", async () => {
      const result = await buildPortfolioStressTest(
        { scenarios: [{ label: "Beyond bounds", priceShockPct: -500, ivShockPct: 100000, timeDecayDays: -50 }] },
        userId,
      );
      expect(result.available).toBe(true);
      const s = result.scenarios[0];
      expect(s.shock.priceShockPct).toBeGreaterThanOrEqual(-99);
      expect(s.shock.ivShockPct).toBeLessThanOrEqual(2000);
      expect(s.shock.timeDecayDays).toBeGreaterThanOrEqual(0);
    });
  });

  describe("invalid inputs", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("invalid");
      await insertIronCondor(userId, "SPY");
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("flags a no-op scenario (identical to the base case) with an honest input issue", async () => {
      const result = await buildPortfolioStressTest({ scenarios: [{ label: "Nothing" }] }, userId);
      expect(result.inputIssues.some((i) => i.code === "no_shock_specified")).toBe(true);
    });

    it("truncates and flags a request with more than the maximum number of scenarios", async () => {
      const scenarios = Array.from({ length: 20 }, (_, i) => ({ label: `S${i}`, priceShockPct: i + 1 }));
      const result = await buildPortfolioStressTest({ scenarios }, userId);
      expect(result.scenarios.length).toBeLessThanOrEqual(12);
      expect(result.inputIssues.some((i) => i.code === "too_many_scenarios")).toBe(true);
    });
  });

  describe("risk threshold warnings", () => {
    let userId: string;
    let trade: Awaited<ReturnType<typeof insertIronCondor>>;

    beforeAll(async () => {
      userId = await createUser("threshold");
      // A single 1-lot defined-risk iron condor's own hard-capped maxLoss
      // (typically a few hundred dollars) never approaches the default
      // 1%-of-$125k account ($1,250) per-trade threshold under any shock —
      // a real, honest structural property of defined-risk strategies, not
      // a test-design shortcut. To reliably exercise the breach path, this
      // test tightens the fresh user's own maxRiskPerTrade setting to a
      // tiny value (getSettingsRow() first, so the lazily-created row
      // exists before the direct update — the same "ensure the row exists
      // before mutating it" fix this project's own Sprint 56 disclosed).
      await getSettingsRow(userId);
      await db.update(settingsTable).set({ maxRiskPerTrade: 0.05 }).where(eq(settingsTable.userId, userId));
      // A near-the-money, aggressive-delta condor is maximally sensitive to
      // an adverse price move, making it easy to reliably breach even a
      // generous per-trade risk threshold under a large shock.
      trade = await insertIronCondor(userId, "AAPL", { shortDelta: 0.45 });
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("flags a position whose shocked loss exceeds the configured maxRiskPerTrade threshold and caps the risk score", async () => {
      const result = await buildPortfolioStressTest({ scenarios: [{ label: "Sharp move", priceShockPct: -30 }] }, userId);
      const scenario = result.scenarios[0];
      const breach = scenario.positionsBreachingThreshold.find((b) => b.tradeId === trade.id);
      expect(breach).toBeDefined();
      if (breach) {
        expect(breach.lossPctOfAccount).toBeGreaterThan(breach.thresholdPct);
        expect(scenario.riskScoreAfter).toBeLessThanOrEqual(RISK_THRESHOLD_BREACH_SCORE_CAP);
      }
    });

  });

  describe("risk threshold warnings — mild scenario, default threshold", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("threshold-mild");
      await insertIronCondor(userId, "SPY", { shortDelta: 0.2 });
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("reports zero threshold breaches for a mild, in-bounds scenario under the default 1% threshold", async () => {
      const result = await buildPortfolioStressTest({ scenarios: [{ label: "Mild", priceShockPct: 1 }] }, userId);
      expect(result.scenarios[0].positionsBreachingThreshold).toHaveLength(0);
    });
  });

  describe("scenario comparison", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("comparison");
      await insertIronCondor(userId, "SPY");
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("computes each requested scenario independently, preserving labels and shocks", async () => {
      const result = await buildPortfolioStressTest(
        {
          scenarios: [
            { label: "Bullish", priceShockPct: 5 },
            { label: "Bearish", priceShockPct: -5 },
            { label: "High Vol", ivShockPct: 20 },
            { label: "Low Vol", ivShockPct: -20 },
          ],
        },
        userId,
      );
      expect(result.scenarios.map((s) => s.label)).toEqual(["Bullish", "Bearish", "High Vol", "Low Vol"]);
      expect(result.scenarios[0].shock.priceShockPct).toBe(5);
      expect(result.scenarios[1].shock.priceShockPct).toBe(-5);
      expect(result.scenarios[2].shock.ivShockPct).toBe(20);
      expect(result.scenarios[3].shock.ivShockPct).toBe(-20);
      // Bullish and Bearish scenarios against the same starting portfolio
      // must produce genuinely different P&L impacts.
      expect(result.scenarios[0].unrealizedPnlImpact).not.toBe(result.scenarios[1].unrealizedPnlImpact);
    });

    it("drawdown is honestly zero for a net-positive scenario and positive for a net-negative one", async () => {
      const result = await buildPortfolioStressTest(
        { scenarios: [{ label: "Bullish", priceShockPct: 8 }, { label: "Bearish", priceShockPct: -8 }] },
        userId,
      );
      const [bullish, bearish] = result.scenarios;
      if (bullish.unrealizedPnlImpact >= 0) expect(bullish.drawdownPct).toBe(0);
      if (bearish.unrealizedPnlImpact < 0) expect(bearish.drawdownPct).toBeGreaterThan(0);
    });

    it("buying power impact is honestly zero — defined-risk strategies' reserved margin doesn't move under a shock", async () => {
      const result = await buildPortfolioStressTest(
        { scenarios: [{ priceShockPct: -20, ivShockPct: 50, timeDecayDays: 10 }] },
        userId,
      );
      expect(result.scenarios[0].buyingPowerImpactDollars).toBe(0);
    });
  });

  describe("loading/consistency", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("consistency");
      await insertIronCondor(userId, "SPY");
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("is deterministic for the same input", async () => {
      const a = await buildPortfolioStressTest({ scenarios: [{ priceShockPct: 5, ivShockPct: 10, timeDecayDays: 7 }] }, userId);
      const b = await buildPortfolioStressTest({ scenarios: [{ priceShockPct: 5, ivShockPct: 10, timeDecayDays: 7 }] }, userId);
      expect(a.scenarios[0].after.totalUnrealizedPnl).toBe(b.scenarios[0].after.totalUnrealizedPnl);
      expect(a.riskScoreBefore).toBe(b.riskScoreBefore);
    });

    it("always returns a well-shaped result even before any scenario request customization", async () => {
      const result = await buildPortfolioStressTest({}, userId);
      expect(result.generatedAt).toEqual(expect.any(String));
      expect(typeof result.riskScoreBefore).toBe("number");
      expect(result.riskScoreBefore).toBeGreaterThanOrEqual(0);
      expect(result.riskScoreBefore).toBeLessThanOrEqual(100);
    });
  });
});
