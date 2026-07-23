// Institutional Intelligence Engine sprint — Phase 8, Sprint 1 (AI Coach
// Foundation). Coverage of the Timeline Engine: the pure buildTimeline()
// diffing logic (hand-built literal fixtures, no database), the
// registry-completeness proof the file's own header comment promises,
// and the real, DB-backed getPriorSnapshot()/recordSnapshotIfNeeded()
// upsert behavior (isolated users, mirroring every other overlay test
// file's own established pattern).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, tradesTable, settingsTable, intelligenceSnapshotsTable, type IntelligenceSnapshotRow } from "@workspace/db";
import { buildPortfolioDashboard } from "./portfolioDashboard.js";
import { computeThetaIncome } from "./thetaIncome.js";
import { buildTimeline, labelForCode, getPriorSnapshot, recordSnapshotIfNeeded } from "./intelligenceTimeline.js";
import type { Observation } from "./intelligenceObservations.js";

// Every code intelligenceObservations.ts's own buildObservations() can
// ever emit — kept in sync with that file per its own header comment's
// promise. If a new observation code is ever added there without a
// matching registry entry here failing, this test is the trip-wire.
const ALL_OBSERVATION_CODES = [
  "portfolio_health_improved",
  "portfolio_health_declined",
  "buying_power_increasing",
  "buying_power_decreasing",
  "theta_income_improving",
  "theta_income_slowing",
  "diversification_improving",
  "diversification_declining",
  "concentration_elevated",
  "large_directional_exposure",
  "large_greeks_exposure",
  "event_risk_elevated",
  "broker_disconnected",
  "paper_trading_active",
  "credentials_unavailable",
];

function fixtureObservation(code: string): Observation {
  return {
    code,
    category: "portfolio_health",
    severity: "info",
    title: `Title for ${code}`,
    explanation: "fixture",
    supportingMetrics: [],
    sourceModule: "fixture",
    timestamp: "2026-01-01T00:00:00.000Z",
    confidence: "high",
    confidenceReason: "fixture",
    learningLinks: [],
  };
}

function fixturePrior(overrides: Partial<IntelligenceSnapshotRow> = {}): IntelligenceSnapshotRow {
  return {
    id: 1,
    userId: "00000000-0000-0000-0000-000000000000",
    snapshotDate: "2020-01-01",
    healthScore: 50,
    overallRiskRatingCode: "moderate_risk",
    buyingPower: 100000,
    totalRiskPct: 10,
    concentrationScore: 50,
    diversificationScore: 50,
    eventRiskScore: 50,
    directionalExposureScore: 50,
    greeksExposureScore: 50,
    thetaMonthly: 100,
    netDelta: 0,
    observationCodes: [],
    createdAt: new Date("2020-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("labelForCode registry completeness", () => {
  it("every code buildObservations() can ever emit has a real, disclosed registry entry — never falling back to the raw code string", () => {
    for (const code of ALL_OBSERVATION_CODES) {
      const meta = labelForCode(code);
      expect(meta.label).not.toBe(code);
      expect(meta.category).not.toBe("unknown");
    }
  });

  it("an unrecognized code honestly falls back to itself as the label, never a fabricated description", () => {
    const meta = labelForCode("some_future_code_not_yet_registered");
    expect(meta.label).toBe("some_future_code_not_yet_registered");
    expect(meta.category).toBe("unknown");
  });
});

describe("buildTimeline (pure diffing)", () => {
  it("with no prior snapshot, every current observation is classified 'new' and no change fields are populated", () => {
    const observations = [fixtureObservation("paper_trading_active"), fixtureObservation("credentials_unavailable")];
    const timeline = buildTimeline(observations, null, {} as never, { daily: 0, weekly: 0, monthly: 0, annualized: 0, bySymbol: [], byStrategy: [] }, new Date("2026-01-01T00:00:00.000Z"));
    expect(timeline.entries).toHaveLength(2);
    expect(timeline.entries.every((e) => e.status === "new")).toBe(true);
    expect(timeline.healthChange).toBeNull();
    expect(timeline.riskRatingChange).toBeNull();
    expect(timeline.incomeChange).toBeNull();
    expect(timeline.comparedTo).toBeNull();
  });

  it("a code present both yesterday and today is classified 'persistent'", () => {
    const observations = [fixtureObservation("paper_trading_active")];
    const prior = fixturePrior({ observationCodes: ["paper_trading_active"] });
    const timeline = buildTimeline(observations, prior, { healthScore: 50, overallRiskRating: { code: "moderate_risk", label: "Moderate Risk" } } as never, { daily: 0, weekly: 0, monthly: 0, annualized: 0, bySymbol: [], byStrategy: [] });
    const entry = timeline.entries.find((e) => e.code === "paper_trading_active")!;
    expect(entry.status).toBe("persistent");
  });

  it("a code present yesterday but absent today is classified 'resolved', never silently dropped", () => {
    const observations: Observation[] = [];
    const prior = fixturePrior({ observationCodes: ["concentration_elevated"] });
    const timeline = buildTimeline(observations, prior, { healthScore: 50, overallRiskRating: { code: "moderate_risk", label: "Moderate Risk" } } as never, { daily: 0, weekly: 0, monthly: 0, annualized: 0, bySymbol: [], byStrategy: [] });
    expect(timeline.entries).toHaveLength(1);
    expect(timeline.entries[0]).toEqual({
      code: "concentration_elevated",
      label: "Concentration elevated",
      category: "concentration",
      status: "resolved",
    });
  });

  it("comparedTo is the real prior snapshot's own date, never fabricated", () => {
    const prior = fixturePrior({ snapshotDate: "2025-06-15" });
    const timeline = buildTimeline([], prior, { healthScore: 50, overallRiskRating: { code: "moderate_risk", label: "Moderate Risk" } } as never, { daily: 0, weekly: 0, monthly: 0, annualized: 0, bySymbol: [], byStrategy: [] });
    expect(timeline.comparedTo).toBe("2025-06-15");
  });

  it("healthChange is populated (even as 'stable') whenever a real prior snapshot exists, and stays null only with no prior at all", () => {
    // buildTimeline's own healthChange comparison uses computeTrend()'s
    // default 2% threshold (not the Observation Engine's own 3%-point
    // HEALTH_SCORE_TREND_THRESHOLD_PCT) — 100 -> 101 is a 1% change,
    // genuinely below that default threshold, so it's a real "stable"
    // reading — still surfaced honestly, never suppressed to null just
    // because nothing dramatic happened.
    const stablePrior = fixturePrior({ healthScore: 100 });
    const stable = buildTimeline([], stablePrior, { healthScore: 101, overallRiskRating: { code: "moderate_risk", label: "Moderate Risk" } } as never, { daily: 0, weekly: 0, monthly: 0, annualized: 0, bySymbol: [], byStrategy: [] });
    expect(stable.healthChange).toEqual({ label: "Portfolio Health", direction: "stable", detail: "100/100 → 101/100" });

    const improvedPrior = fixturePrior({ healthScore: 50 });
    const improved = buildTimeline([], improvedPrior, { healthScore: 90, overallRiskRating: { code: "moderate_risk", label: "Moderate Risk" } } as never, { daily: 0, weekly: 0, monthly: 0, annualized: 0, bySymbol: [], byStrategy: [] });
    expect(improved.healthChange).toEqual({ label: "Portfolio Health", direction: "improving", detail: "50/100 → 90/100" });

    const noPrior = buildTimeline([], null, { healthScore: 90, overallRiskRating: { code: "moderate_risk", label: "Moderate Risk" } } as never, { daily: 0, weekly: 0, monthly: 0, annualized: 0, bySymbol: [], byStrategy: [] });
    expect(noPrior.healthChange).toBeNull();
  });

  it("incomeChange compares real theta.monthly against the prior's own recorded thetaMonthly", () => {
    const prior = fixturePrior({ thetaMonthly: 100 });
    const timeline = buildTimeline([], prior, { healthScore: 50, overallRiskRating: { code: "moderate_risk", label: "Moderate Risk" } } as never, { daily: 0, weekly: 0, monthly: 250, annualized: 0, bySymbol: [], byStrategy: [] });
    expect(timeline.incomeChange).toEqual({ label: "Theta Income (Monthly)", direction: "improving", detail: "100.00 → 250.00" });
  });

  it("riskRatingChange only appears when the overall risk-rating code genuinely changed", () => {
    const prior = fixturePrior({ overallRiskRatingCode: "high_risk" });
    const same = buildTimeline([], prior, { healthScore: 50, overallRiskRating: { code: "high_risk", label: "High Risk" } } as never, { daily: 0, weekly: 0, monthly: 0, annualized: 0, bySymbol: [], byStrategy: [] });
    expect(same.riskRatingChange).toBeNull();

    const changed = buildTimeline([], prior, { healthScore: 90, overallRiskRating: { code: "healthy", label: "Healthy" } } as never, { daily: 0, weekly: 0, monthly: 0, annualized: 0, bySymbol: [], byStrategy: [] });
    expect(changed.riskRatingChange).toEqual({ from: "high_risk", to: "healthy" });
  });
});

describe("getPriorSnapshot / recordSnapshotIfNeeded (real DB, isolated user)", () => {
  let userId: string;
  beforeAll(async () => {
    const [row] = await db
      .insert(usersTable)
      .values({ email: `intelligence-timeline-${randomUUID()}@example.com`, displayName: "Timeline DB" })
      .returning({ id: usersTable.id });
    userId = row.id;
  });
  afterAll(async () => {
    await db.delete(intelligenceSnapshotsTable).where(eq(intelligenceSnapshotsTable.userId, userId));
    await db.delete(tradesTable).where(eq(tradesTable.userId, userId));
    await db.delete(settingsTable).where(eq(settingsTable.userId, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
  });

  it("getPriorSnapshot honestly returns null when no prior day has ever been recorded", async () => {
    const prior = await getPriorSnapshot(userId);
    expect(prior).toBeNull();
  });

  it("recordSnapshotIfNeeded persists a real row derived from the dashboard/theta figures, and a same-day repeat never inserts a second row", async () => {
    const dash = await buildPortfolioDashboard(userId);
    const theta = computeThetaIncome([]);
    const observations: Observation[] = [fixtureObservation("paper_trading_active")];

    await recordSnapshotIfNeeded(userId, dash, theta, observations);
    await recordSnapshotIfNeeded(userId, dash, theta, observations);

    const rows = await db.select().from(intelligenceSnapshotsTable).where(eq(intelligenceSnapshotsTable.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0].healthScore).toBe(dash.healthScore);
    expect(rows[0].overallRiskRatingCode).toBe(dash.overallRiskRating.code);
    expect(rows[0].observationCodes).toEqual(["paper_trading_active"]);
  });

  it("getPriorSnapshot never returns today's own just-recorded row (strictly-less-than today only)", async () => {
    // The prior test in this describe block already recorded today's row
    // for this same user — getPriorSnapshot must still honestly report
    // null (no genuine PRIOR day exists yet), never treating today's own
    // row as a "prior" for itself.
    const prior = await getPriorSnapshot(userId);
    expect(prior).toBeNull();
  });
});
