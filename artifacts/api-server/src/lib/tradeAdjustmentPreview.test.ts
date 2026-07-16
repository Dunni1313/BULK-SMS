// Trade Adjustment & Roll/Convert Preview Simulator sprint — direct unit
// coverage of buildTradeAdjustmentPreview(), the pure composition layer
// that never contacts a broker execution endpoint, never creates or
// closes an order, and never mutates local state beyond ordinary reads.
//
// Uses fresh, isolated users (inserted directly, mirroring
// lib/orderPreview.test.ts's/lib/positionSizing.test.ts's own established
// pattern) so multi-position/conflict assertions are never at risk of
// colliding with another concurrently-running test file's own trades.
//
// Fixture construction note: to reliably trigger the real deterministic
// adjustment engine's own "roll_threatened"/"convert" recommendations
// (lib/adjustment.ts's evaluateTradeAdjustment(), unmodified, reused
// as-is), each fixture below uses a REAL, internally-consistent quote
// from optionsMath.ts's own buildIronCondor() (never fabricated/made-up
// financials, which would trigger the wrong branch of the engine's own
// precedence ladder via a spurious stop-loss breach) with an empirically-
// tuned shortDelta:
//   - roll_threatened: shortDelta 0.45 (near-the-money shorts) reliably
//     trips the "short strike proximity" signal (within the default 2%
//     band) with no other signal firing first.
//   - convert: shortDelta 0.20 (a normal, safely-OTM condor) plus an
//     artificially inflated STATED entry POP (quote.pop + 25, capped at
//     99 — simulating "POP has eroded since entry," a legitimate
//     same-day-quote limitation of the SIMULATED single-snapshot model,
//     not a production behavior) reliably trips the POP-drop signal on a
//     high-ivRank symbol (AMZN) without breaching a stop-loss.
// Both were verified empirically against the real, unmodified engine
// before being hardcoded here — not guessed.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, tradesTable, settingsTable } from "@workspace/db";
import { buildTradeAdjustmentPreview, ADJUSTMENT_LEVERAGE_RATIO } from "./tradeAdjustmentPreview.js";
import { getSnapshot, buildIronCondor } from "./optionsMath.js";
import { checkAlpacaBrokerHealth } from "./providers/alpacaBroker.js";

async function createUser(label: string): Promise<string> {
  const [row] = await db
    .insert(usersTable)
    .values({ email: `adj-preview-${label}-${randomUUID()}@example.com`, displayName: `AdjPreview ${label}` })
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

async function insertRollThreatenedPosition(userId: string, symbol = "AAPL"): Promise<InsertedTrade> {
  const snap = getSnapshot(symbol)!;
  const quote = buildIronCondor(snap, { shortDelta: 0.45, dte: 45 });
  const legs = quote.legs.map((l) => ({ side: l.side, optionType: l.optionType, strike: l.strike, expiration: l.expiration, openPrice: l.openPrice, quantity: l.quantity }));
  const [row] = await db
    .insert(tradesTable)
    .values({ userId, symbol, strategy: "iron_condor", status: "open", legs, credit: quote.credit, maxProfit: quote.maxProfit, maxLoss: quote.maxLoss, pop: quote.pop, expiration: quote.expiration, entryIv: null })
    .returning({ id: tradesTable.id });
  return row;
}

async function insertConvertEligiblePosition(userId: string, symbol = "AMZN"): Promise<InsertedTrade> {
  const snap = getSnapshot(symbol)!;
  const quote = buildIronCondor(snap, { shortDelta: 0.2, dte: 45 });
  const legs = quote.legs.map((l) => ({ side: l.side, optionType: l.optionType, strike: l.strike, expiration: l.expiration, openPrice: l.openPrice, quantity: l.quantity }));
  const [row] = await db
    .insert(tradesTable)
    .values({ userId, symbol, strategy: "iron_condor", status: "open", legs, credit: quote.credit, maxProfit: quote.maxProfit, maxLoss: quote.maxLoss, pop: Math.min(99, quote.pop + 25), expiration: quote.expiration, entryIv: null })
    .returning({ id: tradesTable.id });
  return row;
}

// A fresh, untouched, real quote with no artificial perturbation — the
// deterministic engine has nothing to flag (same-day, no drift), so this
// reliably produces a "hold" recommendation, ineligible for roll_forward
// or convert but still eligible for close_replace (which works for ANY
// open position).
async function insertHealthyPosition(userId: string, symbol = "SPY"): Promise<InsertedTrade> {
  const snap = getSnapshot(symbol)!;
  const quote = buildIronCondor(snap, { dte: 45 });
  const legs = quote.legs.map((l) => ({ side: l.side, optionType: l.optionType, strike: l.strike, expiration: l.expiration, openPrice: l.openPrice, quantity: l.quantity }));
  const [row] = await db
    .insert(tradesTable)
    .values({ userId, symbol, strategy: "iron_condor", status: "open", legs, credit: quote.credit, maxProfit: quote.maxProfit, maxLoss: quote.maxLoss, pop: quote.pop, expiration: quote.expiration, entryIv: null })
    .returning({ id: tradesTable.id });
  return row;
}

async function insertHealthyCalendarPosition(userId: string, symbol = "MSFT"): Promise<InsertedTrade> {
  const { buildCalendar } = await import("./optionsMath.js");
  const snap = getSnapshot(symbol)!;
  const quote = buildCalendar(snap);
  const legs = quote.legs.map((l) => ({ side: l.side, optionType: l.optionType, strike: l.strike, expiration: l.expiration, openPrice: l.openPrice, quantity: l.quantity }));
  const [row] = await db
    .insert(tradesTable)
    .values({ userId, symbol, strategy: "calendar_spread", status: "open", legs, credit: quote.credit, maxProfit: quote.maxProfit, maxLoss: quote.maxLoss, pop: quote.pop, expiration: quote.expiration, entryIv: null })
    .returning({ id: tradesTable.id });
  return row;
}

function warningByCode(warnings: { code: string; status: string; detail: string }[], code: string) {
  return warnings.find((w) => w.code === code)!;
}

describe("buildTradeAdjustmentPreview", () => {
  describe("input validation", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("input");
    });

    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("honestly reports missing required fields for a completely empty preview", async () => {
      const result = await buildTradeAdjustmentPreview({}, userId);
      expect(result.available).toBe(false);
      expect(result.inputIssues.length).toBeGreaterThan(0);
      expect(result.existingPosition).toBeNull();
      expect(result.proposedPosition).toBeNull();
      expect(result.riskWarnings).toHaveLength(9);
    });

    it("flags a missing/nonexistent position", async () => {
      const result = await buildTradeAdjustmentPreview({ tradeId: 999999999, intent: "roll_forward" }, userId);
      expect(result.available).toBe(false);
      const w = warningByCode(result.riskWarnings, "missing_position");
      expect(w.status).toBe("blocked");
    });

    it("flags an invalid quantity", async () => {
      const trade = await insertHealthyPosition(userId);
      const result = await buildTradeAdjustmentPreview({ tradeId: trade.id, intent: "close_replace", quantity: -1 }, userId);
      expect(result.available).toBe(false);
      expect(result.inputIssues.some((i) => i.field === "quantity")).toBe(true);
    });
  });

  describe("Roll Forward scenario", () => {
    let userId: string;
    let tradeId: number;

    beforeAll(async () => {
      userId = await createUser("roll");
      const t = await insertRollThreatenedPosition(userId);
      tradeId = t.id;
    });

    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("computes a full, available preview reusing buildAdjustmentTicket() for a position the real engine flags as roll-eligible", async () => {
      const result = await buildTradeAdjustmentPreview({ tradeId, intent: "roll_forward" }, userId);
      expect(result.available).toBe(true);
      expect(result.intentAvailable).toBe(true);
      expect(result.intent).toBe("roll_forward");
      expect(result.existingPosition).not.toBeNull();
      expect(result.existingPosition!.tradeId).toBe(tradeId);
      expect(result.proposedPosition).not.toBeNull();
      expect(result.proposedPosition!.symbol).toBe("AAPL");
      expect(typeof result.netCashflow).toBe("number");
    });

    it("computes Greeks before and after via the reused computeTradeGreeks()", async () => {
      const result = await buildTradeAdjustmentPreview({ tradeId, intent: "roll_forward" }, userId);
      expect(result.greeksBefore).not.toBeNull();
      expect(result.greeksAfter).not.toBeNull();
      expect(typeof result.greeksBefore!.delta).toBe("number");
      expect(typeof result.greeksAfter!.delta).toBe("number");
    });

    it("computes break-even prices for both the existing and proposed iron condor positions", async () => {
      const result = await buildTradeAdjustmentPreview({ tradeId, intent: "roll_forward" }, userId);
      expect(result.breakEvenBefore).toHaveLength(2);
      expect(result.breakEvenAfter).toHaveLength(2);
      expect(result.breakEvenBeforeUnavailableReason).toBeNull();
      expect(result.breakEvenAfterUnavailableReason).toBeNull();
    });

    it("computes all 6 before/after metric comparisons with a direction", async () => {
      const result = await buildTradeAdjustmentPreview({ tradeId, intent: "roll_forward" }, userId);
      const codes = result.comparisons.map((c) => c.code).sort();
      expect(codes).toEqual(["buying_power_impact", "concentration", "margin_impact", "max_reward", "max_risk", "risk_reward_ratio"].sort());
      for (const c of result.comparisons) {
        expect(["improved", "worse", "neutral", "unknown"]).toContain(c.direction);
      }
    });

    it("computes portfolio exposure before/after, excluding the source position and including the new structure", async () => {
      const result = await buildTradeAdjustmentPreview({ tradeId, intent: "roll_forward" }, userId);
      expect(result.portfolioExposureBefore.openPositionsCount).toBe(1);
      expect(result.portfolioExposureAfter).not.toBeNull();
      // The source is replaced, not added to — still exactly 1 open
      // position in the hypothetical "after" snapshot.
      expect(result.portfolioExposureAfter!.openPositionsCount).toBe(1);
    });

    it("is deterministic across repeated calls", async () => {
      const a = await buildTradeAdjustmentPreview({ tradeId, intent: "roll_forward" }, userId);
      const b = await buildTradeAdjustmentPreview({ tradeId, intent: "roll_forward" }, userId);
      expect(a.proposedPosition!.maxLoss).toBe(b.proposedPosition!.maxLoss);
      expect(a.netCashflow).toBe(b.netCashflow);
    });

    it("never mutates the trades table", async () => {
      const before = await db.select().from(tradesTable).where(eq(tradesTable.userId, userId));
      await buildTradeAdjustmentPreview({ tradeId, intent: "roll_forward" }, userId);
      const after = await db.select().from(tradesTable).where(eq(tradesTable.userId, userId));
      expect(after.length).toBe(before.length);
      expect(after[0].status).toBe("open");
    });
  });

  describe("Convert Position scenario", () => {
    let userId: string;
    let tradeId: number;

    beforeAll(async () => {
      userId = await createUser("convert");
      const t = await insertConvertEligiblePosition(userId);
      tradeId = t.id;
    });

    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("computes a full, available preview for a position the real engine flags as convert-eligible", async () => {
      const result = await buildTradeAdjustmentPreview({ tradeId, intent: "convert" }, userId);
      expect(result.available).toBe(true);
      expect(result.intentAvailable).toBe(true);
      // Iron Condor converts into an Iron Fly.
      expect(result.proposedPosition!.strategy).toBe("iron_fly");
    });
  });

  describe("Close & Replace scenario", () => {
    let userId: string;
    let tradeId: number;

    beforeAll(async () => {
      userId = await createUser("close-replace");
      const t = await insertHealthyPosition(userId);
      tradeId = t.id;
    });

    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("works for a healthy position with no roll/convert recommendation, unlike roll_forward/convert", async () => {
      const result = await buildTradeAdjustmentPreview({ tradeId, intent: "close_replace" }, userId);
      expect(result.available).toBe(true);
      expect(result.intentAvailable).toBe(true);
      expect(result.proposedPosition).not.toBeNull();
      expect(result.proposedPosition!.symbol).toBe("SPY");
      expect(result.proposedPosition!.strategy).toBe("iron_condor");
    });

    it("is composed entirely from previewOptionOrder(), not buildAdjustmentTicket() — proposedPosition carries no adjustment context", async () => {
      const result = await buildTradeAdjustmentPreview({ tradeId, intent: "close_replace" }, userId);
      expect(result.proposedPosition!.adjustment).toBeNull();
    });
  });

  describe("Invalid adjustment", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("invalid");
    });

    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("honestly reports roll_forward as unavailable when the position's real recommendation is not a roll", async () => {
      const t = await insertHealthyPosition(userId, "QQQ");
      const result = await buildTradeAdjustmentPreview({ tradeId: t.id, intent: "roll_forward" }, userId);
      expect(result.available).toBe(false);
      expect(result.intentAvailable).toBe(false);
      expect(result.intentUnavailableReason).toMatch(/not a roll or convert/i);
      const w = warningByCode(result.riskWarnings, "invalid_adjustment");
      expect(w.status).toBe("blocked");
    });

    it.each(["roll_out", "roll_up", "roll_down", "roll_out_up", "roll_out_down"] as const)(
      "always honestly reports %s as unavailable, regardless of the position's own eligibility",
      async (intent) => {
        const t = await insertRollThreatenedPosition(userId, "IWM");
        const result = await buildTradeAdjustmentPreview({ tradeId: t.id, intent }, userId);
        expect(result.available).toBe(false);
        expect(result.intentAvailable).toBe(false);
        expect(result.intentUnavailableReason).toMatch(/re-centers every strike/i);
      },
    );

    it("honestly reports break-even as unavailable for a calendar spread", async () => {
      const t = await insertHealthyCalendarPosition(userId, "META");
      const result = await buildTradeAdjustmentPreview({ tradeId: t.id, intent: "close_replace" }, userId);
      expect(result.available).toBe(true);
      expect(result.breakEvenBefore).toEqual([]);
      expect(result.breakEvenBeforeUnavailableReason).toMatch(/multiple expirations/i);
    });
  });

  describe("credentials and broker warnings", () => {
    let userId: string;
    let tradeId: number;

    beforeAll(async () => {
      userId = await createUser("broker");
      const t = await insertHealthyPosition(userId, "NVDA");
      tradeId = t.id;
    });

    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("honestly reports no configured Alpaca credentials in this environment", async () => {
      const result = await buildTradeAdjustmentPreview({ tradeId, intent: "close_replace" }, userId);
      expect(result.credentialsConfigured).toBe(false);
      expect(warningByCode(result.riskWarnings, "missing_credentials").status).toBe("warning");
    });

    it("reports a disconnected broker after a real (failing, no-credentials) Broker Health check", async () => {
      await checkAlpacaBrokerHealth(null);
      const result = await buildTradeAdjustmentPreview({ tradeId, intent: "close_replace" }, userId);
      expect(result.brokerConnected).toBe(false);
      expect(warningByCode(result.riskWarnings, "broker_disconnected").status).toBe("warning");
      expect(warningByCode(result.riskWarnings, "buying_power_unavailable").status).toBe("warning");
    });
  });

  describe("concentration and leverage warnings", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("concentration");
    });

    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("shows ok concentration/leverage for a small, well-formed close & replace", async () => {
      const t = await insertHealthyPosition(userId, "GOOGL");
      const result = await buildTradeAdjustmentPreview({ tradeId: t.id, intent: "close_replace", quantity: 1 }, userId);
      expect(warningByCode(result.riskWarnings, "excess_concentration").status).toBe("ok");
      expect(warningByCode(result.riskWarnings, "excess_leverage").status).toBe("ok");
    });

    it("flags excess concentration and excess leverage for a very large replacement quantity", async () => {
      const t = await insertHealthyPosition(userId, "TSLA");
      const result = await buildTradeAdjustmentPreview({ tradeId: t.id, intent: "close_replace", quantity: 300 }, userId);
      expect(result.available).toBe(true);
      expect(warningByCode(result.riskWarnings, "excess_concentration").status).toBe("blocked");
      const leverage = warningByCode(result.riskWarnings, "excess_leverage");
      expect(leverage.status).toBe("blocked");
      expect(leverage.detail).toContain(`${ADJUSTMENT_LEVERAGE_RATIO}x`);
    });
  });

  describe("existing conflicting order / adjustment", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("conflicts");
    });

    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("reports no conflicts for a symbol with no sibling positions", async () => {
      const t = await insertHealthyPosition(userId, "MSFT");
      const result = await buildTradeAdjustmentPreview({ tradeId: t.id, intent: "close_replace" }, userId);
      expect(warningByCode(result.riskWarnings, "existing_conflicting_order").status).toBe("ok");
      expect(warningByCode(result.riskWarnings, "existing_conflicting_adjustment").status).toBe("ok");
    });

    it("flags a conflicting pending order in the same symbol", async () => {
      const t = await insertHealthyPosition(userId, "AAPL");
      await db.insert(tradesTable).values({ userId, symbol: "AAPL", strategy: "iron_fly", status: "pending", credit: 50, maxProfit: 50, maxLoss: 150, pop: 60, legs: [] });
      const result = await buildTradeAdjustmentPreview({ tradeId: t.id, intent: "close_replace" }, userId);
      expect(warningByCode(result.riskWarnings, "existing_conflicting_order").status).toBe("warning");
    });

    it("flags a conflicting adjustment when another open position in the same symbol also has a roll/convert recommendation", async () => {
      const healthy = await insertHealthyPosition(userId, "AMZN");
      await insertConvertEligiblePosition(userId, "AMZN");
      const result = await buildTradeAdjustmentPreview({ tradeId: healthy.id, intent: "close_replace" }, userId);
      expect(warningByCode(result.riskWarnings, "existing_conflicting_adjustment").status).toBe("warning");
    });
  });
});
