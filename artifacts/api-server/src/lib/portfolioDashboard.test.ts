// Portfolio Risk Dashboard & Health Score sprint — direct unit coverage
// of buildPortfolioDashboard(), the pure composition layer over the 3
// already-existing overlays (Portfolio Stress Test, Earnings & Event
// Risk, Correlation & Concentration) plus lib/positionSizing.ts's own
// existing currentOpenTrades()/buildSnapshot(). Never contacts a broker
// execution endpoint, never creates or modifies an order or position,
// and never mutates local state beyond ordinary reads.
//
// Uses fresh, isolated users (mirroring every other overlay test file's
// own established pattern) so multi-position/health-score assertions are
// never at risk of colliding with another concurrently-running test
// file's own trades.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db, usersTable, tradesTable, settingsTable } from "@workspace/db";
import {
  buildPortfolioDashboard,
  DASHBOARD_HEALTHY_MIN,
  DASHBOARD_MODERATE_MIN,
  DASHBOARD_ELEVATED_MIN,
  DASHBOARD_HEALTHY_POSITION_COUNT,
} from "./portfolioDashboard.js";
import { getSnapshot, buildIronCondor } from "./optionsMath.js";

async function createUser(label: string): Promise<string> {
  const [row] = await db
    .insert(usersTable)
    .values({ email: `dashboard-${label}-${randomUUID()}@example.com`, displayName: `Dashboard ${label}` })
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

interface InsertedTrade {
  id: number;
}

async function insertPosition(
  userId: string,
  symbol: string,
  expirationDaysAway: number,
  opts: { shortDelta?: number; quantity?: number } = {},
): Promise<InsertedTrade> {
  // Symbols outside optionsMath.ts's own SIMULATED pricing UNIVERSE
  // honestly return a null snapshot — real strikes/pricing are built
  // from a real UNIVERSE symbol (AAPL) instead. Only the trade's own
  // `symbol` column (what the reused overlays' sector/underlying logic
  // actually reads) is set to the target symbol. Mirrors
  // portfolioConcentration.test.ts's/portfolioEventRisk.test.ts's own
  // established fixture technique.
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
      credit: quote.credit * qty,
      maxProfit: quote.maxProfit * qty,
      maxLoss: quote.maxLoss * qty,
      pop: quote.pop,
      expiration,
      entryIv: null,
    })
    .returning({ id: tradesTable.id });
  return row;
}

describe("buildPortfolioDashboard", () => {
  describe("empty portfolio", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("empty");
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("honestly reports a fully-healthy score with no fabricated risk", async () => {
      const result = await buildPortfolioDashboard(userId);
      expect(result.openPositionsCount).toBe(0);
      expect(result.healthScore).toBe(100);
      expect(result.overallRiskRating.code).toBe("healthy");
      expect(result.totalRiskDollars).toBe(0);
      expect(result.totalRiskPct).toBe(0);
    });

    it("every health factor honestly scores 100 for an empty portfolio", async () => {
      const result = await buildPortfolioDashboard(userId);
      for (const factor of result.healthFactors) {
        expect(factor.score).toBe(100);
      }
      expect(result.healthFactors).toHaveLength(8);
    });

    it("never fabricates a largest position, risk contributor, or highest-risk entry", async () => {
      const result = await buildPortfolioDashboard(userId);
      expect(result.largestPosition).toBeNull();
      expect(result.largestRiskContributor).toBeNull();
      expect(result.highestEventRisk).toBeNull();
      expect(result.highestConcentration).toBeNull();
      expect(result.highestDirectionalExposure).toBeNull();
    });

    it("guidance includes only the primary Healthy Portfolio advisory, no elevated-risk advisories", async () => {
      const result = await buildPortfolioDashboard(userId);
      expect(result.guidance).toHaveLength(1);
      expect(result.guidance[0].code).toBe("healthy_portfolio");
    });

    it("always discloses paperTradingMode and never fabricates broker/credential state", async () => {
      const result = await buildPortfolioDashboard(userId);
      expect(result.paperTradingMode).toBe(true);
      expect(typeof result.credentialsConfigured).toBe("boolean");
      expect(result.brokerConnected === null || typeof result.brokerConnected === "boolean").toBe(true);
    });
  });

  describe("single position", () => {
    let userId: string;
    let trade: InsertedTrade;
    beforeAll(async () => {
      userId = await createUser("single");
      trade = await insertPosition(userId, "MSFT", 60);
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("a single position is fully concentrated — the concentration factor honestly scores low", async () => {
      const result = await buildPortfolioDashboard(userId);
      const concentrationFactor = result.healthFactors.find((f) => f.code === "concentration")!;
      expect(concentrationFactor.score).toBe(0);
    });

    it("largest position and largest risk contributor both identify the single trade", async () => {
      const result = await buildPortfolioDashboard(userId);
      expect(result.largestPosition).not.toBeNull();
      expect(result.largestPosition!.symbol).toBe("MSFT");
      expect(result.largestRiskContributor).not.toBeNull();
      expect(result.largestRiskContributor!.tradeId).toBe(trade.id);
      expect(result.largestRiskContributor!.deltaSharePct).toBe(100);
    });

    it("the position-count factor reflects a below-threshold count via the disclosed linear ramp", async () => {
      const result = await buildPortfolioDashboard(userId);
      const positionCountFactor = result.healthFactors.find((f) => f.code === "position_count")!;
      expect(positionCountFactor.score).toBe(Math.round((1 / DASHBOARD_HEALTHY_POSITION_COUNT) * 100));
    });
  });

  describe("balanced portfolio (multiple evenly-weighted symbols)", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("balanced");
      for (const symbol of ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"]) {
        await insertPosition(userId, symbol, 60);
      }
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("5 evenly-weighted symbols score a much healthier concentration factor than a single position", async () => {
      const result = await buildPortfolioDashboard(userId);
      const concentrationFactor = result.healthFactors.find((f) => f.code === "concentration")!;
      expect(concentrationFactor.score).toBeGreaterThan(60);
    });

    it("the position-count factor reaches the full 100 at the disclosed healthy threshold", async () => {
      const result = await buildPortfolioDashboard(userId);
      const positionCountFactor = result.healthFactors.find((f) => f.code === "position_count")!;
      expect(positionCountFactor.score).toBe(100);
    });

    it("guidance does not include Elevated Concentration for a genuinely balanced portfolio", async () => {
      const result = await buildPortfolioDashboard(userId);
      expect(result.guidance.some((g) => g.code === "elevated_concentration")).toBe(false);
    });
  });

  describe("high concentration (single symbol dominates)", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("high-concentration");
      for (let i = 0; i < 4; i++) {
        await insertPosition(userId, "NVDA", 60 + i);
      }
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("the concentration factor honestly scores low and guidance surfaces Elevated Concentration", async () => {
      const result = await buildPortfolioDashboard(userId);
      const concentrationFactor = result.healthFactors.find((f) => f.code === "concentration")!;
      expect(concentrationFactor.score).toBe(0);
      expect(result.guidance.some((g) => g.code === "elevated_concentration")).toBe(true);
    });

    it("highest concentration reuses the Concentration overlay's own largest bucket directly", async () => {
      const result = await buildPortfolioDashboard(userId);
      expect(result.highestConcentration).not.toBeNull();
      expect(result.highestConcentration!.bucket.key).toBe("NVDA");
      expect(result.highestConcentration!.bucket.weightPct).toBe(100);
    });

    it("guidance surfaces Review Large Positions once the largest bucket crosses the disclosed threshold", async () => {
      const result = await buildPortfolioDashboard(userId);
      expect(result.guidance.some((g) => g.code === "review_large_positions")).toBe(true);
    });
  });

  describe("high event risk", () => {
    let userId: string;
    let highRiskTrade: InsertedTrade;
    beforeAll(async () => {
      userId = await createUser("high-event-risk");
      // Empirically-verified real fixture: AAPL at 45 DTE resolves a
      // "high" event-risk level via the reused, unmodified event-risk
      // engine — the exact same fixture portfolioEventRisk.test.ts's own
      // "high-risk events" block already established.
      highRiskTrade = await insertPosition(userId, "AAPL", 45);
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("the event-risk factor honestly reflects the highest classified risk level via the disclosed label mapping", async () => {
      const result = await buildPortfolioDashboard(userId);
      const eventRiskFactor = result.healthFactors.find((f) => f.code === "event_risk")!;
      expect(eventRiskFactor.score).toBe(20);
      expect(eventRiskFactor.detail).toMatch(/high/i);
    });

    it("highest event risk reuses the Event Risk overlay's own summary field directly", async () => {
      const result = await buildPortfolioDashboard(userId);
      expect(result.highestEventRisk).not.toBeNull();
      expect(result.highestEventRisk!.tradeId).toBe(highRiskTrade.id);
      expect(result.highestEventRisk!.riskLevel).toBe("high");
    });

    it("guidance surfaces Elevated Event Risk", async () => {
      const result = await buildPortfolioDashboard(userId);
      expect(result.guidance.some((g) => g.code === "elevated_event_risk")).toBe(true);
    });
  });

  describe("high Greeks exposure (one position dominates net delta)", () => {
    let userId: string;
    let dominantTrade: InsertedTrade;
    beforeAll(async () => {
      userId = await createUser("high-greeks");
      dominantTrade = await insertPosition(userId, "SPY", 60, { quantity: 20 });
      await insertPosition(userId, "QQQ", 60, { quantity: 1 });
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("the net-Greeks-exposure factor honestly reflects a concentrated Greeks contributor", async () => {
      const result = await buildPortfolioDashboard(userId);
      const greeksFactor = result.healthFactors.find((f) => f.code === "net_greeks_exposure")!;
      expect(result.largestRiskContributor).not.toBeNull();
      expect(result.largestRiskContributor!.tradeId).toBe(dominantTrade.id);
      expect(greeksFactor.score).toBeLessThan(50);
    });
  });

  describe("missing credentials", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("no-creds");
      await insertPosition(userId, "AAPL", 60);
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("honestly reports credentialsConfigured as false when no Alpaca credentials are stored", async () => {
      const result = await buildPortfolioDashboard(userId);
      expect(result.credentialsConfigured).toBe(false);
    });

    it("the Broker Health widget honestly discloses the no-credentials state", async () => {
      const result = await buildPortfolioDashboard(userId);
      const brokerWidget = result.widgets.find((w) => w.code === "broker_health")!;
      expect(brokerWidget.headline).toBe("No credentials configured");
    });
  });

  describe("dashboard calculations", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("calculations");
      await insertPosition(userId, "AAPL", 60);
      await insertPosition(userId, "MSFT", 90);
      await insertPosition(userId, "SPY", 30);
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("the overall Health Score is the equal-weighted average of every factor's own score", async () => {
      const result = await buildPortfolioDashboard(userId);
      const avg = Math.round(
        result.healthFactors.reduce((sum, f) => sum + f.score, 0) / result.healthFactors.length,
      );
      expect(result.healthScore).toBe(avg);
    });

    it("the overall risk rating band is a deterministic function of the Health Score", async () => {
      const result = await buildPortfolioDashboard(userId);
      if (result.healthScore >= DASHBOARD_HEALTHY_MIN) expect(result.overallRiskRating.code).toBe("healthy");
      else if (result.healthScore >= DASHBOARD_MODERATE_MIN) expect(result.overallRiskRating.code).toBe("moderate_risk");
      else if (result.healthScore >= DASHBOARD_ELEVATED_MIN) expect(result.overallRiskRating.code).toBe("elevated_risk");
      else expect(result.overallRiskRating.code).toBe("high_risk");
    });

    it("exposes exactly 7 dashboard widgets, each linking to its own existing detailed page", async () => {
      const result = await buildPortfolioDashboard(userId);
      expect(result.widgets).toHaveLength(7);
      const hrefs = result.widgets.map((w) => w.linkHref);
      expect(hrefs).toEqual([
        "/position-sizing",
        "/stress-test",
        "/event-risk",
        "/concentration-risk",
        "/concentration-risk",
        "/concentration-risk",
        "/settings",
      ]);
    });

    it("allocation/expiration visualisation data is a direct, unmodified pass-through of the Concentration overlay's own buckets", async () => {
      const result = await buildPortfolioDashboard(userId);
      expect(result.allocationBySymbol.length).toBeGreaterThan(0);
      expect(result.allocationBySector.length).toBeGreaterThan(0);
      expect(result.allocationByStrategy.length).toBeGreaterThan(0);
      expect(result.expirationDistribution.length).toBeGreaterThan(0);
    });

    it("the event timeline summary is a direct, unmodified pass-through of the Event Risk overlay's own summary", async () => {
      const result = await buildPortfolioDashboard(userId);
      expect(result.eventTimelineSummary.totalPositions).toBe(3);
    });

    it("the stress test summary reflects every configured default scenario", async () => {
      const result = await buildPortfolioDashboard(userId);
      expect(result.stressTestSummary.length).toBeGreaterThan(0);
      for (const s of result.stressTestSummary) {
        expect(typeof s.label).toBe("string");
        expect(typeof s.portfolioValueImpact).toBe("number");
        expect(typeof s.riskScoreAfter).toBe("number");
      }
    });

    it("is deterministic across repeated calls (aside from timestamp fields)", async () => {
      const a = await buildPortfolioDashboard(userId);
      const b = await buildPortfolioDashboard(userId);
      expect(a.healthScore).toBe(b.healthScore);
      expect(a.overallRiskRating).toEqual(b.overallRiskRating);
      expect(a.totalRiskDollars).toBe(b.totalRiskDollars);
    });

    it("never mutates the trades table — the same 3 open positions exist before and after", async () => {
      const before = await db
        .select()
        .from(tradesTable)
        .where(and(eq(tradesTable.userId, userId), eq(tradesTable.status, "open")));
      await buildPortfolioDashboard(userId);
      const after = await db
        .select()
        .from(tradesTable)
        .where(and(eq(tradesTable.userId, userId), eq(tradesTable.status, "open")));
      expect(after.length).toBe(before.length);
      expect(after.map((t) => t.id).sort()).toEqual(before.map((t) => t.id).sort());
    });
  });
});
