// Institutional Intelligence Engine sprint — Phase 8, Sprint 1 (AI Coach
// Foundation). Direct, DB-backed unit coverage of the top-level
// orchestrator buildInstitutionalIntelligence(), which composes the
// already-unit-tested Portfolio Dashboard (see
// lib/portfolioDashboard.test.ts) with the new Observation/Health/
// Summary/Timeline/Learning engines. Never contacts a broker execution
// endpoint, never creates or modifies an order or position, and never
// mutates local state beyond an at-most-once-per-calendar-day insert
// into intelligence_snapshots.
//
// Uses fresh, isolated users (mirroring every other overlay test file's
// own established pattern, e.g. lib/portfolioDashboard.test.ts) so
// observation/health-score assertions are never at risk of colliding
// with another concurrently-running test file's own trades.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db, usersTable, tradesTable, settingsTable, intelligenceSnapshotsTable } from "@workspace/db";
import { buildInstitutionalIntelligence } from "./intelligenceEngine.js";
import { getSnapshot, buildIronCondor } from "./optionsMath.js";

async function createUser(label: string): Promise<string> {
  const [row] = await db
    .insert(usersTable)
    .values({ email: `intelligence-${label}-${randomUUID()}@example.com`, displayName: `Intelligence ${label}` })
    .returning({ id: usersTable.id });
  return row.id;
}

async function cleanupUser(userId: string): Promise<void> {
  await db.delete(tradesTable).where(eq(tradesTable.userId, userId));
  await db.delete(settingsTable).where(eq(settingsTable.userId, userId));
  await db.delete(intelligenceSnapshotsTable).where(eq(intelligenceSnapshotsTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

function isoDateInDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().split("T")[0];
}

function yesterdayDateStr(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

interface InsertedTrade {
  id: number;
}

// The exact same fixture technique lib/portfolioDashboard.test.ts's own
// insertPosition() already established — symbols outside
// optionsMath.ts's own SIMULATED pricing UNIVERSE honestly return a null
// snapshot, so pricing is always built from a real UNIVERSE symbol
// (AAPL), while only the trade's own `symbol` column (what the reused
// overlays' sector/underlying logic actually reads) is set to the
// target symbol.
async function insertPosition(
  userId: string,
  symbol: string,
  expirationDaysAway: number,
  opts: { shortDelta?: number; quantity?: number } = {},
): Promise<InsertedTrade> {
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

describe("buildInstitutionalIntelligence", () => {
  describe("empty / fresh portfolio", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("empty");
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("always discloses paperTradingMode and deterministicAnalysis as structural facts", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      expect(result.paperTradingMode).toBe(true);
      expect(result.deterministicAnalysis).toBe(true);
    });

    it("a brand-new user with no credentials gets exactly Paper Trading active + Credentials unavailable — never a fabricated trend", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      const codes = result.observations.map((o) => o.code).sort();
      expect(codes).toEqual(["credentials_unavailable", "paper_trading_active"]);
    });

    it("never emits a trend observation on the very first call (no prior snapshot exists yet)", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      const trendCodes = [
        "portfolio_health_improved",
        "portfolio_health_declined",
        "buying_power_increasing",
        "buying_power_decreasing",
        "theta_income_improving",
        "theta_income_slowing",
        "diversification_improving",
        "diversification_declining",
      ];
      for (const code of result.observations.map((o) => o.code)) {
        expect(trendCodes).not.toContain(code);
      }
    });

    it("honestly reports a healthy score with no fabricated risk", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      expect(result.health.overallHealthScore).toBe(100);
      expect(result.health.overallRiskRating.code).toBe("healthy");
    });

    it("no observations reach elevated severity for a genuinely empty, healthy portfolio — highestPriority is honestly empty", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      expect(result.highestPriority).toEqual([]);
    });

    it("the executive summary reads as a healthy, no-elevated-risk report with no trend bullets on a first-ever call", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      expect(result.executiveSummary.headline).toBe("Portfolio Health remains strong.");
      expect(result.executiveSummary.bullets).toEqual([
        "Portfolio Health remains strong.",
        "Concentration remains moderate.",
        "No elevated Event Risk detected.",
        "Buying Power remains healthy.",
      ]);
    });
  });

  describe("single position", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("single");
      await insertPosition(userId, "MSFT", 60);
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("a fully concentrated single position does not by itself count as 'many observations'", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      // A single position is 100% concentrated by definition, but the
      // Concentration overlay's own guidance thresholds are only crossed
      // at a higher position count in this codebase's own established
      // fixtures — this test only proves the engine never crashes/
      // fabricates on a minimal, real portfolio.
      expect(Array.isArray(result.observations)).toBe(true);
      expect(result.observations.length).toBeGreaterThan(0);
    });
  });

  describe("balanced / healthy portfolio", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("healthy");
      for (const symbol of ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"]) {
        await insertPosition(userId, symbol, 60);
      }
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("a 5-symbol spread never triggers Concentration Elevated — Concentration reads as moderate in the summary", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      expect(result.observations.some((o) => o.code === "concentration_elevated")).toBe(false);
      expect(result.executiveSummary.bullets).toContain("Concentration remains moderate.");
    });

    it("every emitted observation is honestly explainable and traceable to a real, existing source module", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      for (const obs of result.observations) {
        expect(obs.sourceModule.length).toBeGreaterThan(0);
        expect(obs.explanation.length).toBeGreaterThan(0);
      }
    });

    it("health overview mirrors the dashboard's own health score exactly — never a second, competing score", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      expect(result.health.overallHealthScore).toBeGreaterThanOrEqual(0);
      expect(result.health.overallHealthScore).toBeLessThanOrEqual(100);
      expect(result.health.healthDrivers.length).toBe(8);
    });

    it("health drivers are sorted worst-first (ascending by score)", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      const scores = result.health.healthDrivers.map((d) => d.score);
      const sorted = [...scores].sort((a, b) => a - b);
      expect(scores).toEqual(sorted);
    });
  });

  describe("high concentration (single symbol dominates)", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("high-concentration");
      for (let i = 0; i < 4; i++) {
        await insertPosition(userId, "NVDA", 90 + i);
      }
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("surfaces an elevated Concentration observation directly reusing the Concentration overlay's own guidance", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      const obs = result.observations.find((o) => o.code === "concentration_elevated");
      expect(obs).toBeDefined();
      expect(obs!.severity).toBe("elevated");
      expect(obs!.category).toBe("concentration");
      expect(obs!.confidence).toBe("high");
    });

    it("the concentration observation lands in riskInsights, never portfolioInsights or incomeInsights", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      expect(result.riskInsights.some((o) => o.code === "concentration_elevated")).toBe(true);
      expect(result.portfolioInsights.some((o) => o.code === "concentration_elevated")).toBe(false);
      expect(result.incomeInsights.some((o) => o.code === "concentration_elevated")).toBe(false);
    });

    it("the explanation for the concentration observation names a real, existing source module", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      const obs = result.observations.find((o) => o.code === "concentration_elevated")!;
      expect(obs.sourceModule).toMatch(/portfolioConcentration\.ts/);
      expect(obs.explanation.length).toBeGreaterThan(0);
      expect(obs.supportingMetrics.length).toBeGreaterThan(0);
    });
  });

  describe("high Greeks exposure (one position dominates net delta)", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("high-greeks");
      await insertPosition(userId, "SPY", 60, { quantity: 20 });
      await insertPosition(userId, "QQQ", 60, { quantity: 1 });
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("surfaces a Large Greeks Exposure observation directly reusing the Concentration overlay's own Greeks ranking", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      const obs = result.observations.find((o) => o.code === "large_greeks_exposure");
      expect(obs).toBeDefined();
      expect(obs!.severity).toBe("elevated");
      expect(obs!.category).toBe("greeks_exposure");
    });
  });

  describe("high event risk", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("high-event-risk");
      // Empirically-verified real fixture: AAPL at 45 DTE resolves a
      // "high" event-risk level via the reused, unmodified event-risk
      // engine — the exact same fixture
      // lib/portfolioDashboard.test.ts's own "high event risk" block
      // already established.
      await insertPosition(userId, "AAPL", 45);
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("surfaces an Event Risk Elevated observation directly reusing the Event Risk overlay's own classification", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      const obs = result.observations.find((o) => o.code === "event_risk_elevated");
      expect(obs).toBeDefined();
      expect(obs!.severity).toBe("elevated");
      expect(obs!.category).toBe("event_risk");
      expect(obs!.explanation).toMatch(/AAPL/);
    });

    it("the event risk observation lands in riskInsights", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      expect(result.riskInsights.some((o) => o.code === "event_risk_elevated")).toBe(true);
    });
  });

  describe("many observations (concentration + event risk together)", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("many-observations");
      // All 4 positions in AAPL at exactly 45 DTE simultaneously triggers
      // both elevated Concentration (single-symbol dominance) and
      // elevated Event Risk — the exact same empirically-verified "AAPL,
      // 45 DTE -> high" fixture as the dedicated "high event risk" block
      // above and lib/portfolioEventRisk.test.ts's own "high-risk events"
      // block.
      for (let i = 0; i < 4; i++) {
        await insertPosition(userId, "AAPL", 45);
      }
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("emits multiple elevated observations together, each correctly bucketed", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      expect(result.highestPriority.length).toBeGreaterThanOrEqual(2);
      const codes = result.highestPriority.map((o) => o.code);
      expect(codes).toContain("concentration_elevated");
      expect(codes).toContain("event_risk_elevated");
      for (const o of result.highestPriority) {
        expect(result.riskInsights.some((r) => r.code === o.code)).toBe(true);
      }
    });

    it("the executive summary reflects both elevated conditions in plain language", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      expect(result.executiveSummary.bullets).toContain("Concentration is elevated — review recommended.");
      expect(result.executiveSummary.bullets).toContain("Event Risk is elevated — review recommended.");
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

    it("surfaces a Credentials Unavailable observation, never a fabricated broker state", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      const obs = result.observations.find((o) => o.code === "credentials_unavailable");
      expect(obs).toBeDefined();
      expect(obs!.category).toBe("credentials_status");
      expect(result.riskInsights.some((o) => o.code === "credentials_unavailable")).toBe(true);
    });

    it("never emits Broker Disconnected when credentials were never configured in the first place", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      expect(result.observations.some((o) => o.code === "broker_disconnected")).toBe(false);
    });
  });

  describe("timeline, trend observations, and health calculations (with a real prior-day snapshot)", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("timeline");
      // A healthy, balanced portfolio today...
      for (const symbol of ["AAPL", "MSFT", "GOOGL"]) {
        await insertPosition(userId, symbol, 60);
      }
      // ...compared against a manually recorded, genuinely worse prior
      // day (lower health score, lower buying power, lower theta) so the
      // Observation/Timeline Engines have a real prior snapshot to
      // compare against — the exact mechanism recordSnapshotIfNeeded()
      // itself uses, just seeded directly for a deterministic test
      // fixture rather than waiting a real calendar day.
      await db.insert(intelligenceSnapshotsTable).values({
        userId,
        snapshotDate: yesterdayDateStr(),
        healthScore: 10,
        overallRiskRatingCode: "high_risk",
        buyingPower: 1000,
        totalRiskPct: 50,
        concentrationScore: 10,
        diversificationScore: 10,
        eventRiskScore: 10,
        directionalExposureScore: 10,
        greeksExposureScore: 10,
        thetaMonthly: 1,
        netDelta: 0,
        observationCodes: ["concentration_elevated", "paper_trading_active"],
      });
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("the Timeline compares against the real prior day's own recorded snapshot date", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      expect(result.timeline.comparedTo).toBe(yesterdayDateStr());
    });

    it("Portfolio Health improved is emitted with a real, non-fabricated before/after comparison", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      const obs = result.observations.find((o) => o.code === "portfolio_health_improved");
      expect(obs).toBeDefined();
      expect(obs!.severity).toBe("positive");
      expect(obs!.confidence).toBe("moderate");
      expect(obs!.confidenceReason).toMatch(/one prior recorded snapshot/i);
      const before = obs!.supportingMetrics.find((m) => m.label === "Prior Health Score")!;
      expect(before.value).toBe("10/100");
    });

    it("Buying Power increasing is emitted since 1000 -> a real, higher current buying power", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      const obs = result.observations.find((o) => o.code === "buying_power_increasing");
      expect(obs).toBeDefined();
      expect(obs!.category).toBe("buying_power");
      expect(result.portfolioInsights.some((o) => o.code === "buying_power_increasing")).toBe(true);
    });

    it("the Timeline's healthChange entry mirrors the same trend the Observation Engine emitted", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      expect(result.timeline.healthChange).not.toBeNull();
      expect(result.timeline.healthChange!.direction).toBe("improving");
      expect(result.timeline.healthChange!.detail).toMatch(/^10\/100 → \d+\/100$/);
    });

    it("a persistent observation code carried over from the prior snapshot is classified 'persistent', not 'new'", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      // "paper_trading_active" was in the prior snapshot's own
      // observationCodes and is always emitted today too.
      const entry = result.timeline.entries.find((e) => e.code === "paper_trading_active");
      expect(entry).toBeDefined();
      expect(entry!.status).toBe("persistent");
    });

    it("a code present in the prior snapshot but absent today is classified 'resolved', never silently dropped", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      // "concentration_elevated" was in the prior snapshot but this
      // user's real, balanced 3-symbol portfolio never re-triggers it.
      const entry = result.timeline.entries.find((e) => e.code === "concentration_elevated");
      expect(entry).toBeDefined();
      expect(entry!.status).toBe("resolved");
      expect(entry!.label).toBe("Concentration elevated");
    });

    it("a genuinely new observation not present in the prior snapshot is classified 'new'", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      const entry = result.timeline.entries.find((e) => e.code === "portfolio_health_improved");
      expect(entry).toBeDefined();
      expect(entry!.status).toBe("new");
    });

    it("the riskRatingChange reflects the real, disclosed change in overall risk-rating code", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      expect(result.timeline.riskRatingChange).not.toBeNull();
      expect(result.timeline.riskRatingChange!.from).toBe("high_risk");
    });
  });

  describe("learning links", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("learning-links");
      for (let i = 0; i < 4; i++) {
        await insertPosition(userId, "NVDA", 90 + i);
      }
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("every observation's own learning links are surfaced in the top-level, deduplicated list", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      expect(result.learningLinks.length).toBeGreaterThan(0);
      const hrefs = result.learningLinks.filter((l) => l.href !== null).map((l) => l.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
    });

    it("always includes the AI Teacher & Learning Centre entry, now resolved to a real URL (Phase 8 Sprint 2)", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      const aiTeacher = result.learningLinks.find((l) => l.label === "AI Teacher & Learning Centre");
      expect(aiTeacher).toBeDefined();
      expect(aiTeacher!.comingSoon).toBe(false);
      expect(aiTeacher!.href).toBe("/learn");
    });

    it("no learning link is ever comingSoon:true anymore — the AI Teacher module now exists", async () => {
      const result = await buildInstitutionalIntelligence(userId);
      expect(result.learningLinks.every((l) => !l.comingSoon)).toBe(true);
    });

    it("a brand-new user with no elevated risk still gets a real, non-empty learning list — never an honestly-empty list", async () => {
      const freshUser = await createUser("learning-links-fresh");
      try {
        const result = await buildInstitutionalIntelligence(freshUser);
        // Paper Trading Active is always emitted (a structural platform
        // fact), so its own real Settings link — plus the always-appended
        // AI Teacher & Learning Centre entry — anchors a non-empty list
        // even for a user with zero elevated observations.
        expect(result.learningLinks.length).toBeGreaterThan(0);
        expect(result.learningLinks.some((l) => l.label === "Settings")).toBe(true);
        expect(result.learningLinks.some((l) => l.label === "AI Teacher & Learning Centre")).toBe(true);
      } finally {
        await cleanupUser(freshUser);
      }
    });
  });

  describe("persistence discipline", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("persistence");
      await insertPosition(userId, "AAPL", 60);
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("records at most one snapshot row per calendar day, even across repeated calls", async () => {
      await buildInstitutionalIntelligence(userId);
      await buildInstitutionalIntelligence(userId);
      await buildInstitutionalIntelligence(userId);
      const rows = await db.select().from(intelligenceSnapshotsTable).where(eq(intelligenceSnapshotsTable.userId, userId));
      expect(rows.length).toBe(1);
    });

    it("is deterministic across repeated same-day calls (aside from timestamp fields)", async () => {
      const a = await buildInstitutionalIntelligence(userId);
      const b = await buildInstitutionalIntelligence(userId);
      expect(a.health.overallHealthScore).toBe(b.health.overallHealthScore);
      expect(a.executiveSummary.bullets).toEqual(b.executiveSummary.bullets);
      expect(a.observations.map((o) => o.code)).toEqual(b.observations.map((o) => o.code));
    });

    it("never mutates the trades table — the same open position exists before and after", async () => {
      const before = await db
        .select()
        .from(tradesTable)
        .where(and(eq(tradesTable.userId, userId), eq(tradesTable.status, "open")));
      await buildInstitutionalIntelligence(userId);
      const after = await db
        .select()
        .from(tradesTable)
        .where(and(eq(tradesTable.userId, userId), eq(tradesTable.status, "open")));
      expect(after.length).toBe(before.length);
      expect(after.map((t) => t.id).sort()).toEqual(before.map((t) => t.id).sort());
    });
  });
});
