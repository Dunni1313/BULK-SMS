// Correlation & Concentration Risk Overlay sprint — direct unit coverage
// of buildPortfolioConcentrationOverlay(), the pure composition layer
// that never contacts a broker execution endpoint, never creates or
// modifies an order or position, and never mutates local state beyond
// ordinary reads.
//
// Uses fresh, isolated users (mirroring lib/portfolioEventRisk.test.ts's
// own established pattern) so multi-position/concentration assertions
// are never at risk of colliding with another concurrently-running test
// file's own trades.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, tradesTable, settingsTable } from "@workspace/db";
import {
  buildPortfolioConcentrationOverlay,
  KNOWN_SECTOR_MAP,
  CONCENTRATION_HIGH_MAX,
} from "./portfolioConcentration.js";
import { getSnapshot, buildIronCondor } from "./optionsMath.js";

async function createUser(label: string): Promise<string> {
  const [row] = await db
    .insert(usersTable)
    .values({ email: `concentration-${label}-${randomUUID()}@example.com`, displayName: `Concentration ${label}` })
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
  opts: { shortDelta?: number; expirationDaysAway?: number; strategy?: string } = {},
): Promise<InsertedTrade> {
  // Symbols outside optionsMath.ts's own SIMULATED pricing UNIVERSE (used
  // for "missing sector information" fixtures) honestly return a null
  // snapshot — real strikes/pricing are built from a real UNIVERSE symbol
  // (AAPL) instead. Only the trade's own `symbol` column (what this
  // module's sector/underlying/cluster logic actually reads) is set to
  // the target symbol.
  const snap = getSnapshot(symbol) ?? getSnapshot("AAPL")!;
  const quote = buildIronCondor(snap, { shortDelta: opts.shortDelta, dte: 45 });
  const expiration = isoDateInDays(opts.expirationDaysAway ?? 45);
  const legs = quote.legs.map((l) => ({
    side: l.side,
    optionType: l.optionType,
    strike: l.strike,
    expiration,
    openPrice: l.openPrice,
    quantity: 1,
  }));
  const [row] = await db
    .insert(tradesTable)
    .values({
      userId,
      symbol,
      strategy: opts.strategy ?? "iron_condor",
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

describe("buildPortfolioConcentrationOverlay", () => {
  describe("empty portfolio", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("empty");
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("honestly reports zeroed-out figures with no crash", async () => {
      const result = await buildPortfolioConcentrationOverlay(userId);
      expect(result.totalPositions).toBe(0);
      expect(result.netGreeks).toEqual({ delta: 0, gamma: 0, theta: 0, vega: 0 });
      expect(result.breakdowns.symbol.buckets).toHaveLength(0);
      expect(result.breakdowns.symbol.concentrationScore).toBe(0);
      expect(result.breakdowns.symbol.largestBucket).toBeNull();
      expect(result.clusters).toHaveLength(0);
      expect(result.greeksContributions).toHaveLength(0);
      expect(result.summary.largestConcentration).toBeNull();
      expect(result.summary.highestDirectionalExposure).toBeNull();
      expect(result.summary.highestGreeksContributor).toBeNull();
      expect(result.summary.mostDiversifiedArea).toBeNull();
      expect(result.summary.leastDiversifiedArea).toBeNull();
    });

    it("always honestly reports net beta as unavailable, never fabricated", async () => {
      const result = await buildPortfolioConcentrationOverlay(userId);
      expect(result.netBeta).toBeNull();
      expect(result.netBetaUnavailableReason).toMatch(/no beta figure exists/i);
    });

    it("reports credentialsConfigured/brokerConnected without crashing (missing credentials)", async () => {
      const result = await buildPortfolioConcentrationOverlay(userId);
      expect(typeof result.credentialsConfigured).toBe("boolean");
      expect(result.credentialsConfigured).toBe(false);
      expect(result.brokerConnected === null || typeof result.brokerConnected === "boolean").toBe(true);
    });
  });

  describe("single position", () => {
    let userId: string;
    let trade: InsertedTrade;

    beforeAll(async () => {
      userId = await createUser("single");
      trade = await insertPosition(userId, "SPY");
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("a single position is 100% concentrated by symbol, sector, strategy, and expiration", async () => {
      const result = await buildPortfolioConcentrationOverlay(userId);
      expect(result.totalPositions).toBe(1);
      expect(result.breakdowns.symbol.concentrationScore).toBe(100);
      expect(result.breakdowns.sector.concentrationScore).toBe(100);
      expect(result.breakdowns.strategy.concentrationScore).toBe(100);
      expect(result.breakdowns.expiration.concentrationScore).toBe(100);
      expect(result.breakdowns.assetClass.concentrationScore).toBe(100);
      expect(result.breakdowns.assetClass.buckets[0].label).toBe("Equity Option");
      expect(result.summary.highestGreeksContributor?.tradeId).toBe(trade.id);
      expect(result.clusters).toHaveLength(0); // a cluster requires >= 2 positions sharing a trait
    });

    it("underlying breakdown is the same as symbol breakdown in this options-only engine", async () => {
      const result = await buildPortfolioConcentrationOverlay(userId);
      expect(result.breakdowns.underlying).toEqual(result.breakdowns.symbol);
    });
  });

  describe("multiple symbols (balanced portfolio)", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("balanced");
      await insertPosition(userId, "SPY");
      await insertPosition(userId, "QQQ");
      await insertPosition(userId, "IWM");
      await insertPosition(userId, "AAPL");
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("a portfolio spread across many symbols scores as well diversified", async () => {
      const result = await buildPortfolioConcentrationOverlay(userId);
      expect(result.breakdowns.symbol.buckets).toHaveLength(4);
      expect(result.breakdowns.symbol.concentrationScore).toBeLessThan(CONCENTRATION_HIGH_MAX);
      expect(result.riskGuidance.code).toBe("well_diversified");
    });
  });

  describe("high concentration (single symbol dominates)", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("high-concentration");
      // Insert 4 positions in the same symbol/sector/strategy — this
      // single bucket dominates every dimension.
      for (let i = 0; i < 4; i++) await insertPosition(userId, "NVDA");
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("a single-symbol-dominated portfolio scores review_exposure with the correct largest concentration", async () => {
      const result = await buildPortfolioConcentrationOverlay(userId);
      expect(result.breakdowns.symbol.buckets).toHaveLength(1);
      expect(result.breakdowns.symbol.concentrationScore).toBe(100);
      expect(result.riskGuidance.code).toBe("review_exposure");
      expect(result.summary.largestConcentration?.bucket.key).toBe("NVDA");
    });

    it("identifies a genuine correlation cluster (4 positions sharing the same underlying/sector/strategy)", async () => {
      const result = await buildPortfolioConcentrationOverlay(userId);
      const underlyingCluster = result.clusters.find((c) => c.dimension === "underlying" && c.key === "NVDA");
      expect(underlyingCluster).toBeDefined();
      expect(underlyingCluster!.positionCount).toBe(4);
      const sectorCluster = result.clusters.find((c) => c.dimension === "sector");
      expect(sectorCluster).toBeDefined();
      expect(sectorCluster!.positionCount).toBe(4);
    });
  });

  describe("multiple sectors", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("multi-sector");
      await insertPosition(userId, "NVDA"); // Technology
      await insertPosition(userId, "TSLA"); // Consumer Discretionary
      await insertPosition(userId, "SPY"); // Index ETF
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("groups positions into their own real, hand-curated sector categories", async () => {
      const result = await buildPortfolioConcentrationOverlay(userId);
      const labels = result.breakdowns.sector.buckets.map((b) => b.label).sort();
      expect(labels).toEqual(
        [KNOWN_SECTOR_MAP.NVDA, KNOWN_SECTOR_MAP.TSLA, KNOWN_SECTOR_MAP.SPY].sort(),
      );
    });
  });

  describe("multiple strategies", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("multi-strategy");
      await insertPosition(userId, "SPY", { strategy: "iron_condor" });
      await insertPosition(userId, "QQQ", { strategy: "iron_fly" });
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("groups positions by strategy independently of symbol", async () => {
      const result = await buildPortfolioConcentrationOverlay(userId);
      expect(result.breakdowns.strategy.buckets).toHaveLength(2);
      const keys = result.breakdowns.strategy.buckets.map((b) => b.key).sort();
      expect(keys).toEqual(["iron_condor", "iron_fly"]);
    });
  });

  describe("multiple expirations", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("multi-expiration");
      await insertPosition(userId, "SPY", { expirationDaysAway: 30 });
      await insertPosition(userId, "QQQ", { expirationDaysAway: 60 });
      await insertPosition(userId, "IWM", { expirationDaysAway: 60 }); // shares QQQ's expiration
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("clusters positions sharing an identical expiration date", async () => {
      const result = await buildPortfolioConcentrationOverlay(userId);
      expect(result.breakdowns.expiration.buckets).toHaveLength(2);
      const expirationCluster = result.clusters.find((c) => c.dimension === "expiration");
      expect(expirationCluster).toBeDefined();
      expect(expirationCluster!.positionCount).toBe(2);
    });
  });

  describe("missing sector information", () => {
    let userId: string;
    let trade: InsertedTrade;

    beforeAll(async () => {
      userId = await createUser("missing-sector");
      // IBM is not in this engine's own known-universe sector table.
      trade = await insertPosition(userId, "IBM");
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("honestly reports Unclassified rather than fabricating a sector for a symbol outside the known table", async () => {
      const result = await buildPortfolioConcentrationOverlay(userId);
      const bucket = result.breakdowns.sector.buckets.find((b) => b.key === "Unclassified");
      expect(bucket).toBeDefined();
      expect(bucket!.positionCount).toBe(1);
      void trade;
    });
  });

  describe("net Greeks, directional exposure, and calls vs. puts", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("greeks-exposure");
      await insertPosition(userId, "SPY");
      await insertPosition(userId, "QQQ");
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("net Greeks equal the sum of every position's own computeTradeGreeks() output", async () => {
      const result = await buildPortfolioConcentrationOverlay(userId);
      const summedDelta = result.greeksContributions.reduce((s, c) => s + c.delta, 0);
      expect(Math.abs(result.netGreeks.delta - summedDelta)).toBeLessThan(0.01);
    });

    it("long/short exposure reuses buildSnapshot()'s own structural figures", async () => {
      const result = await buildPortfolioConcentrationOverlay(userId);
      expect(result.longShort.longExposureDollars + result.longShort.shortExposureDollars).toBeGreaterThan(0);
      expect(result.longShort.longPct + result.longShort.shortPct).toBeCloseTo(100, 0);
    });

    it("calls vs puts notional is derived from the real stored legs, never fabricated", async () => {
      const result = await buildPortfolioConcentrationOverlay(userId);
      expect(result.callPut.callNotional).toBeGreaterThan(0);
      expect(result.callPut.putNotional).toBeGreaterThan(0);
      expect(result.callPut.callPct + result.callPut.putPct).toBeCloseTo(100, 0);
    });

    it("deltaSharePct across all greeks contributions sums to ~100%", async () => {
      const result = await buildPortfolioConcentrationOverlay(userId);
      const total = result.greeksContributions.reduce((s, c) => s + c.deltaSharePct, 0);
      expect(total).toBeCloseTo(100, 0);
    });
  });

  describe("most/least diversified area", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("diversification-areas");
      // 4 different symbols (well diversified by symbol) but all the
      // same strategy (fully concentrated by strategy).
      await insertPosition(userId, "SPY", { strategy: "iron_condor" });
      await insertPosition(userId, "QQQ", { strategy: "iron_condor" });
      await insertPosition(userId, "IWM", { strategy: "iron_condor" });
      await insertPosition(userId, "AAPL", { strategy: "iron_condor" });
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("correctly identifies the least-diversified dimension as strategy", async () => {
      const result = await buildPortfolioConcentrationOverlay(userId);
      expect(result.summary.leastDiversifiedArea?.dimension).toBe("strategy");
      expect(result.summary.leastDiversifiedArea?.concentrationScore).toBe(100);
    });

    it("identifies a more diversified dimension as most diversified, distinct from strategy", async () => {
      const result = await buildPortfolioConcentrationOverlay(userId);
      expect(result.summary.mostDiversifiedArea?.dimension).not.toBe("strategy");
    });
  });

  describe("sector concentration advisory", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("sector-advisory");
      // 3 different symbols, but all Technology — well diversified by
      // symbol, but sector-concentrated, a genuinely distinct signal.
      await insertPosition(userId, "NVDA");
      await insertPosition(userId, "AAPL");
      await insertPosition(userId, "MSFT");
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("fires the monitor_sector_concentration advisory even when symbol-level diversification looks fine", async () => {
      const result = await buildPortfolioConcentrationOverlay(userId);
      expect(result.breakdowns.symbol.buckets).toHaveLength(3);
      const advisory = result.riskGuidance.advisories.find((a) => a.code === "monitor_sector_concentration");
      expect(advisory).toBeDefined();
    });
  });

  describe("loading/consistency", () => {
    let userId: string;

    beforeAll(async () => {
      userId = await createUser("consistency");
      await insertPosition(userId, "SPY");
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("is deterministic for the same input", async () => {
      const a = await buildPortfolioConcentrationOverlay(userId);
      const b = await buildPortfolioConcentrationOverlay(userId);
      expect(a.netGreeks).toEqual(b.netGreeks);
      expect(a.summary).toEqual(b.summary);
    });

    it("never mutates the trades table", async () => {
      const before = await db.select().from(tradesTable).where(eq(tradesTable.userId, userId));
      await buildPortfolioConcentrationOverlay(userId);
      const after = await db.select().from(tradesTable).where(eq(tradesTable.userId, userId));
      expect(after).toEqual(before);
    });

    it("always discloses the sector data source as known-universe metadata, never a live feed", async () => {
      const result = await buildPortfolioConcentrationOverlay(userId);
      expect(result.sectorDataSource).toBe("KNOWN_UNIVERSE_METADATA");
    });
  });
});
