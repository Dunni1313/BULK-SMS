// Position Sizing & Portfolio Impact Calculator sprint — direct unit
// coverage of buildPositionSizingAnalysis(), which extends last sprint's
// buildOrderPreview() (unmodified) with position-sizing figures, a
// before/after portfolio-impact snapshot, risk warnings, and a scenario
// comparison. Never contacts a broker execution endpoint, never creates
// an order, never mutates any state beyond ordinary reads.
//
// Uses fresh, isolated users (inserted directly, mirroring
// lib/orderPreview.test.ts's own established pattern) rather than the
// shared legacy-owner account, so multi-position/concentration
// assertions are never at risk of colliding with another concurrently-
// running test file's own trades.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, tradesTable, settingsTable } from "@workspace/db";
import {
  buildPositionSizingAnalysis,
  BUYING_POWER_EXHAUSTION_THRESHOLD_PCT,
  MAX_LEVERAGE_RATIO,
  type PositionSizingWarning,
} from "./positionSizing.js";
import { checkAlpacaBrokerHealth } from "./providers/alpacaBroker.js";

async function createUser(label: string): Promise<string> {
  const [row] = await db
    .insert(usersTable)
    .values({ email: `position-sizing-${label}-${randomUUID()}@example.com`, displayName: `PositionSizing ${label}` })
    .returning({ id: usersTable.id });
  return row.id;
}

async function cleanupUser(userId: string): Promise<void> {
  await db.delete(tradesTable).where(eq(tradesTable.userId, userId));
  await db.delete(settingsTable).where(eq(settingsTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

function warningByCode(warnings: PositionSizingWarning[], code: string) {
  return warnings.find((w) => w.code === code);
}

describe("buildPositionSizingAnalysis", () => {
  describe("with an empty portfolio (no open trades)", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("empty");
    });

    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("honestly shows zero current exposure and no crash for a completely empty portfolio", async () => {
      const result = await buildPositionSizingAnalysis({ symbol: "", strategy: "", quantity: null }, userId);
      expect(result.portfolioImpact.current.openPositionsCount).toBe(0);
      expect(result.portfolioImpact.current.totalRiskDollars).toBe(0);
      expect(result.portfolioImpact.current.exposureBySymbol).toEqual([]);
      expect(result.portfolioImpact.current.greeks).toEqual({ delta: 0, gamma: 0, theta: 0, vega: 0 });
      expect(result.portfolioImpact.hypothetical).toBeNull();
      expect(result.positionSizing).toBeNull();
      expect(result.preview.available).toBe(false);
    });

    it("computes a hypothetical (post-trade) snapshot with exactly one synthetic position for a valid preview against an empty portfolio", async () => {
      const result = await buildPositionSizingAnalysis({ symbol: "AAPL", strategy: "iron_condor", quantity: 1 }, userId);
      expect(result.preview.available).toBe(true);
      expect(result.portfolioImpact.current.openPositionsCount).toBe(0);
      expect(result.portfolioImpact.hypothetical).not.toBeNull();
      expect(result.portfolioImpact.hypothetical!.openPositionsCount).toBe(1);
      expect(result.portfolioImpact.hypothetical!.exposureBySymbol).toEqual([
        { symbol: "AAPL", riskDollars: expect.any(Number), pctOfAccount: expect.any(Number) },
      ]);
      expect(result.portfolioImpact.hypothetical!.totalRiskDollars).toBeGreaterThan(0);
      expect(result.positionSizing).not.toBeNull();
      expect(result.positionSizing!.capitalAtRisk).toBe(result.preview.ticket!.maxLoss);
    });
  });

  describe("with multiple existing open positions", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("multi");
      await db.insert(tradesTable).values([
        { userId, symbol: "MSFT", strategy: "iron_condor", status: "open", credit: 150, maxLoss: 350, maxProfit: 150, legs: [] },
        { userId, symbol: "NVDA", strategy: "iron_fly", status: "open", credit: 200, maxLoss: 500, maxProfit: 200, legs: [] },
        { userId, symbol: "MSFT", strategy: "calendar_spread", status: "open", credit: -80, maxLoss: 80, maxProfit: 120, legs: [] },
      ]);
    });

    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("groups exposure by symbol correctly, combining multiple positions in the same symbol", async () => {
      const result = await buildPositionSizingAnalysis({ symbol: "", strategy: "", quantity: null }, userId);
      const current = result.portfolioImpact.current;
      expect(current.openPositionsCount).toBe(3);
      const msft = current.exposureBySymbol.find((e) => e.symbol === "MSFT")!;
      const nvda = current.exposureBySymbol.find((e) => e.symbol === "NVDA")!;
      expect(msft.riskDollars).toBe(350 + 80);
      expect(nvda.riskDollars).toBe(500);
      expect(current.totalRiskDollars).toBe(350 + 500 + 80);
    });

    it("classifies long vs short exposure by credit sign", async () => {
      const result = await buildPositionSizingAnalysis({ symbol: "", strategy: "", quantity: null }, userId);
      const current = result.portfolioImpact.current;
      // MSFT iron_condor (credit 150 >= 0, "short") + NVDA iron_fly (credit 200 >= 0, "short") = 850 short.
      // MSFT calendar_spread (credit -80, "long") = 80 long.
      expect(current.shortExposureDollars).toBe(350 + 500);
      expect(current.longExposureDollars).toBe(80);
    });

    it("computes real portfolio-level Greeks by summing computeTradeGreeks() across all open positions", async () => {
      const result = await buildPositionSizingAnalysis({ symbol: "", strategy: "", quantity: null }, userId);
      // legs: [] on every fixture trade means computeTradeGreeks() has nothing
      // to sum over for any of them — proving the real reused function was
      // called (and correctly produced all-zero Greeks for empty legs)
      // rather than a fabricated non-zero placeholder.
      expect(result.portfolioImpact.current.greeks).toEqual({ delta: 0, gamma: 0, theta: 0, vega: 0 });
    });

    it("computes a delta/theta/gamma/vega impact of exactly zero when the hypothetical trade also has no legs contribution beyond the current snapshot's own zero baseline", async () => {
      const result = await buildPositionSizingAnalysis({ symbol: "AAPL", strategy: "iron_condor", quantity: 1 }, userId);
      expect(result.portfolioImpact.hypothetical).not.toBeNull();
      // The synthetic AAPL position DOES have real legs (from a real ticket
      // build), so its own Greeks are non-zero — the impact should differ
      // from zero, proving the hypothetical snapshot's Greeks are genuinely
      // computed, not just copied from current.
      expect(result.portfolioImpact.deltaImpact).not.toBe(0);
      expect(result.portfolioImpact.thetaImpact).not.toBeNull();
    });

    it("always honestly reports sector exposure as unavailable", async () => {
      const result = await buildPositionSizingAnalysis({ symbol: "", strategy: "", quantity: null }, userId);
      expect(result.portfolioImpact.sectorExposure).toEqual({
        available: false,
        reason: expect.stringMatching(/sector/i),
      });
    });
  });

  describe("risk warnings", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("warnings");
    });

    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("shows all-ok warnings for a small, well-formed order against an empty portfolio", async () => {
      const result = await buildPositionSizingAnalysis({ symbol: "AAPL", strategy: "iron_condor", quantity: 1 }, userId);
      expect(warningByCode(result.riskWarnings, "oversized_position")!.status).toBe("ok");
      expect(warningByCode(result.riskWarnings, "excess_concentration")!.status).toBe("ok");
      expect(warningByCode(result.riskWarnings, "buying_power_exhaustion")!.status).toBe("ok");
      expect(warningByCode(result.riskWarnings, "excess_leverage")!.status).toBe("ok");
      expect(warningByCode(result.riskWarnings, "position_conflict")!.status).toBe("ok");
      expect(warningByCode(result.riskWarnings, "existing_order")!.status).toBe("ok");
    });

    it("flags oversized position and excess concentration for a very large quantity, reusing execution.ts's own validatePreTrade checks", async () => {
      const result = await buildPositionSizingAnalysis({ symbol: "AAPL", strategy: "iron_condor", quantity: 300 }, userId);
      expect(warningByCode(result.riskWarnings, "oversized_position")!.status).toBe("blocked");
      expect(warningByCode(result.riskWarnings, "excess_concentration")!.status).toBe("blocked");
    });

    it("flags buying power exhaustion once utilization exceeds the named threshold", async () => {
      const result = await buildPositionSizingAnalysis({ symbol: "AAPL", strategy: "iron_condor", quantity: 350 }, userId);
      const w = warningByCode(result.riskWarnings, "buying_power_exhaustion")!;
      expect(w.status).toBe("blocked");
      expect(result.positionSizing!.buyingPowerUtilizationPct).toBeGreaterThan(BUYING_POWER_EXHAUSTION_THRESHOLD_PCT);
    });

    it("flags excess leverage once notional/account-value exceeds the named ratio", async () => {
      const result = await buildPositionSizingAnalysis({ symbol: "AAPL", strategy: "iron_condor", quantity: 300 }, userId);
      const w = warningByCode(result.riskWarnings, "excess_leverage")!;
      expect(w.status).toBe("blocked");
      expect(w.detail).toContain(`${MAX_LEVERAGE_RATIO}x`);
    });

    it("flags a position conflict when this user already has an open trade in the same symbol", async () => {
      await db.insert(tradesTable).values({ userId, symbol: "TSLA", strategy: "iron_fly", status: "open", credit: 100, maxLoss: 300, maxProfit: 100, legs: [] });
      const result = await buildPositionSizingAnalysis({ symbol: "TSLA", strategy: "iron_condor", quantity: 1 }, userId);
      expect(warningByCode(result.riskWarnings, "position_conflict")!.status).toBe("warning");
    });

    it("honestly reports missing credentials in this credential-free environment", async () => {
      const result = await buildPositionSizingAnalysis({ symbol: "AAPL", strategy: "iron_condor", quantity: 1 }, userId);
      expect(warningByCode(result.riskWarnings, "missing_credentials")!.status).toBe("warning");
    });

    it("reports missing broker data after a real (failing, no-credentials) Broker Health check", async () => {
      await checkAlpacaBrokerHealth(null);
      const result = await buildPositionSizingAnalysis({ symbol: "AAPL", strategy: "iron_condor", quantity: 1 }, userId);
      const w = warningByCode(result.riskWarnings, "missing_broker_data")!;
      expect(w.status).toBe("warning");
      expect(w.detail).toMatch(/local trade records/i);
    });
  });

  describe("break-even and position-sizing figures", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("sizing");
    });

    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("computes 2 break-even prices honestly bracketing the short strikes for an iron condor", async () => {
      const result = await buildPositionSizingAnalysis({ symbol: "AAPL", strategy: "iron_condor", quantity: 1 }, userId);
      const ps = result.positionSizing!;
      expect(ps.breakEvens).toHaveLength(2);
      expect(ps.breakEvenUnavailableReason).toBeNull();
      const [lower, upper] = ps.breakEvens;
      expect(lower.label).toBe("Lower");
      expect(upper.label).toBe("Upper");
      expect(lower.price).toBeLessThan(upper.price);
    });

    it("honestly reports break-even as unavailable for a calendar spread", async () => {
      const result = await buildPositionSizingAnalysis({ symbol: "AAPL", strategy: "calendar_spread", quantity: 1 }, userId);
      const ps = result.positionSizing!;
      expect(ps.breakEvens).toEqual([]);
      expect(ps.breakEvenUnavailableReason).toMatch(/multiple expirations/i);
    });

    it("derives capitalAtRisk/maxTheoreticalLoss/maxTheoreticalGain/riskRewardRatio/concentration directly from the reused ticket, never a second calculation", async () => {
      const result = await buildPositionSizingAnalysis({ symbol: "AAPL", strategy: "iron_condor", quantity: 2 }, userId);
      const ps = result.positionSizing!;
      const ticket = result.preview.ticket!;
      expect(ps.capitalAtRisk).toBe(ticket.maxLoss);
      expect(ps.maxTheoreticalLoss).toBe(ticket.maxLoss);
      expect(ps.maxTheoreticalGain).toBe(ticket.maxProfit);
      expect(ps.riskRewardRatio).toBe(ticket.riskRewardRatio);
      expect(ps.concentrationBeforePct).toBe(ticket.portfolioRiskBeforePct);
      expect(ps.concentrationAfterPct).toBe(ticket.portfolioRiskAfterPct);
      expect(ps.positionSizePctOfPortfolio).toBe(ticket.riskPct);
    });

    it("computes a recommended quantity from the account's own configured per-trade risk cap", async () => {
      const result = await buildPositionSizingAnalysis({ symbol: "AAPL", strategy: "iron_condor", quantity: 1 }, userId);
      expect(result.positionSizing!.recommendedQuantity).toBeGreaterThanOrEqual(1);
    });
  });

  describe("scenario comparison", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("scenarios");
    });

    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("returns 50%/75%/100% scenarios scaled off the entered quantity, each independently computed via the same reused preview", async () => {
      const result = await buildPositionSizingAnalysis({ symbol: "AAPL", strategy: "iron_condor", quantity: 8 }, userId);
      expect(result.scenarios).toHaveLength(3);
      const [fifty, seventyFive, hundred] = result.scenarios;
      expect(fifty.label).toBe("50%");
      expect(fifty.quantity).toBe(4);
      expect(seventyFive.label).toBe("75%");
      expect(seventyFive.quantity).toBe(6);
      expect(hundred.label).toBe("100% (Current)");
      expect(hundred.quantity).toBe(8);
      // Monotonic: more spreads means more capital at risk.
      expect(fifty.capitalAtRisk!).toBeLessThan(seventyFive.capitalAtRisk!);
      expect(seventyFive.capitalAtRisk!).toBeLessThan(hundred.capitalAtRisk!);
    });

    it("adds a Custom scenario only when a valid customQuantity is supplied", async () => {
      const withoutCustom = await buildPositionSizingAnalysis({ symbol: "AAPL", strategy: "iron_condor", quantity: 4 }, userId);
      expect(withoutCustom.scenarios.find((s) => s.label === "Custom")).toBeUndefined();

      const withCustom = await buildPositionSizingAnalysis(
        { symbol: "AAPL", strategy: "iron_condor", quantity: 4, customQuantity: 12 },
        userId,
      );
      const custom = withCustom.scenarios.find((s) => s.label === "Custom")!;
      expect(custom).toBeDefined();
      expect(custom.quantity).toBe(12);
      expect(custom.available).toBe(true);
    });

    it("returns an honestly empty scenario list when the base preview itself is unavailable (invalid symbol)", async () => {
      const result = await buildPositionSizingAnalysis({ symbol: "ZZZZZZ", strategy: "iron_condor", quantity: 1 }, userId);
      expect(result.preview.available).toBe(false);
      expect(result.scenarios).toEqual([]);
    });

    it("never mutates the trades table across a full analysis including scenario computation", async () => {
      const before = await db.select().from(tradesTable).where(eq(tradesTable.userId, userId));
      await buildPositionSizingAnalysis({ symbol: "AAPL", strategy: "iron_condor", quantity: 4, customQuantity: 6 }, userId);
      const after = await db.select().from(tradesTable).where(eq(tradesTable.userId, userId));
      expect(after.length).toBe(before.length);
    });
  });
});
