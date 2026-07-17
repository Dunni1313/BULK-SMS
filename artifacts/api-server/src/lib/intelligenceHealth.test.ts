// Institutional Intelligence Engine sprint — Phase 8, Sprint 1 (AI Coach
// Foundation). Direct coverage of the Health Engine (buildHealthOverview())
// — deliberately "aggregate by reference": the Overall Health Score and
// Overall Risk Rating shown here must be the exact same values
// lib/portfolioDashboard.ts already computed, never a second, competing
// score. Uses a real, isolated-user dashboard (so this test proves the
// Health Engine against genuine data, not a hand-typed fixture that
// could silently drift from PortfolioDashboardResult's real shape) plus
// hand-built prior-snapshot literals (a much smaller, simpler shape than
// PortfolioDashboardResult) to exercise every trend branch.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, tradesTable, settingsTable, type IntelligenceSnapshotRow } from "@workspace/db";
import { buildPortfolioDashboard } from "./portfolioDashboard.js";
import { buildHealthOverview } from "./intelligenceHealth.js";

async function createUser(label: string): Promise<string> {
  const [row] = await db
    .insert(usersTable)
    .values({ email: `intelligence-health-${label}-${randomUUID()}@example.com`, displayName: `Health ${label}` })
    .returning({ id: usersTable.id });
  return row.id;
}

async function cleanupUser(userId: string): Promise<void> {
  await db.delete(tradesTable).where(eq(tradesTable.userId, userId));
  await db.delete(settingsTable).where(eq(settingsTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
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

describe("buildHealthOverview", () => {
  let userId: string;
  beforeAll(async () => {
    userId = await createUser("empty");
  });
  afterAll(async () => {
    await cleanupUser(userId);
  });

  it("overallHealthScore and overallRiskRating are the exact same values the dashboard already computed — never a second score", async () => {
    const dash = await buildPortfolioDashboard(userId);
    const health = buildHealthOverview(dash, null);
    expect(health.overallHealthScore).toBe(dash.healthScore);
    expect(health.overallRiskRating).toEqual(dash.overallRiskRating);
  });

  it("healthDrivers is exactly the dashboard's own health factors, re-sorted worst-first — zero new scoring", async () => {
    const dash = await buildPortfolioDashboard(userId);
    const health = buildHealthOverview(dash, null);
    expect(health.healthDrivers).toHaveLength(dash.healthFactors.length);
    const driverCodes = health.healthDrivers.map((d) => d.code).sort();
    const factorCodes = dash.healthFactors.map((f) => f.code).sort();
    expect(driverCodes).toEqual(factorCodes);
    const scores = health.healthDrivers.map((d) => d.score);
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
  });

  it("healthTrend is insufficient_history and says so plainly when there is no prior snapshot", async () => {
    const dash = await buildPortfolioDashboard(userId);
    const health = buildHealthOverview(dash, null);
    expect(health.healthTrend).toBe("insufficient_history");
    expect(health.healthTrendDetail).toMatch(/no prior recorded snapshot/i);
  });

  it("healthTrend reflects a real improving comparison against a genuinely worse prior snapshot", async () => {
    const dash = await buildPortfolioDashboard(userId); // healthScore 100 for an empty portfolio
    const prior = fixturePrior({ healthScore: 10 });
    const health = buildHealthOverview(dash, prior);
    expect(health.healthTrend).toBe("improving");
    expect(health.healthTrendDetail).toMatch(/rose from 10\/100 to 100\/100/);
  });

  it("healthTrend reflects a real declining comparison against a genuinely better prior snapshot", async () => {
    const dash = await buildPortfolioDashboard(userId); // healthScore 100 for an empty portfolio
    const prior = fixturePrior({ healthScore: 100 });
    // Force a worse "current" via a synthetic override — dash itself is
    // real, but this proves the declining branch's own wording without
    // needing a second, differently-shaped real portfolio.
    const health = buildHealthOverview({ ...dash, healthScore: 40 }, prior);
    expect(health.healthTrend).toBe("declining");
    expect(health.healthTrendDetail).toMatch(/fell from 100\/100 to 40\/100/);
  });

  it("brokerHealth honestly reflects credentialsConfigured/connected without ever fabricating a live connection", async () => {
    const dash = await buildPortfolioDashboard(userId);
    const health = buildHealthOverview(dash, null);
    expect(health.brokerHealth.credentialsConfigured).toBe(dash.credentialsConfigured);
    expect(health.brokerHealth.connected).toBe(dash.brokerConnected);
    expect(health.brokerHealth.label).toBe("No credentials configured");
  });

  it("the health summary reads 'healthy' for a genuinely healthy portfolio", async () => {
    const dash = await buildPortfolioDashboard(userId);
    const health = buildHealthOverview(dash, null);
    expect(dash.overallRiskRating.code).toBe("healthy");
    expect(health.healthSummary).toMatch(/^Portfolio Health is healthy at \d+\/100\.$/);
  });

  it("the health summary names the weakest driver by its own real label/score for a non-healthy portfolio", async () => {
    const dash = await buildPortfolioDashboard(userId);
    const degraded = { ...dash, healthScore: 30, overallRiskRating: { code: "high_risk" as const, label: "High Risk" } };
    const health = buildHealthOverview(degraded, null);
    const weakest = health.healthDrivers[0];
    expect(health.healthSummary).toBe(
      `Portfolio Health is high risk at 30/100 — the weakest contributing factor is ${weakest.label} (${weakest.score}/100).`,
    );
  });
});
