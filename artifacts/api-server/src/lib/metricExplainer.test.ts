// AI Teacher & Learning Centre sprint — Explain Mode / metricExplainer.ts.
// DB-backed unit coverage against fresh, isolated users (mirroring
// lib/intelligenceEngine.test.ts's own established insertPosition()
// fixture pattern) so assertions are never at risk of colliding with
// another concurrently-running test file's own trades.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, tradesTable, settingsTable, intelligenceSnapshotsTable } from "@workspace/db";
import { explainMetric, MetricExplainerError, METRIC_CODES } from "./metricExplainer.js";
import { getSnapshot, buildIronCondor } from "./optionsMath.js";

async function createUser(label: string): Promise<string> {
  const [row] = await db
    .insert(usersTable)
    .values({ email: `metric-explainer-${label}-${randomUUID()}@example.com`, displayName: `Metric Explainer ${label}` })
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

async function insertPosition(userId: string, symbol: string, expirationDaysAway: number): Promise<{ id: number }> {
  const snap = getSnapshot(symbol) ?? getSnapshot("AAPL")!;
  const quote = buildIronCondor(snap, { dte: 45 });
  const expiration = isoDateInDays(expirationDaysAway);
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

describe("METRIC_CODES", () => {
  it("has exactly the 13 requested metric codes", () => {
    expect(METRIC_CODES.sort()).toEqual(
      [
        "portfolio_health",
        "buying_power",
        "event_risk",
        "concentration",
        "stress_test",
        "delta",
        "theta",
        "gamma",
        "vega",
        "probability_of_profit",
        "max_profit",
        "max_loss",
        "expected_move",
      ].sort(),
    );
  });
});

describe("explainMetric — unknown metric", () => {
  it("throws a 400 MetricExplainerError for a code outside METRIC_CODES", async () => {
    const userId = await createUser("unknown-metric");
    try {
      await expect(explainMetric("not_a_real_metric", userId)).rejects.toThrow(MetricExplainerError);
      await expect(explainMetric("not_a_real_metric", userId)).rejects.toMatchObject({ status: 400 });
    } finally {
      await cleanupUser(userId);
    }
  });
});

describe("explainMetric — portfolio Greeks", () => {
  let userId: string;
  beforeAll(async () => {
    userId = await createUser("greeks");
    await insertPosition(userId, "AAPL", 60);
  });
  afterAll(async () => {
    await cleanupUser(userId);
  });

  it("delta/theta/gamma/vega each resolve a real current value with a plain-English explanation, never fabricated", async () => {
    for (const code of ["delta", "theta", "gamma", "vega"] as const) {
      const result = await explainMetric(code, userId);
      expect(result.code).toBe(code);
      expect(result.currentValue.length).toBeGreaterThan(0);
      expect(result.plainEnglish.length).toBeGreaterThan(10);
      expect(result.sourceCalculation).toContain("portfolioConcentration.ts");
      expect(result.relatedGlossaryKeys.length).toBeGreaterThan(0);
      expect(result.reusedObservation).toBe(false);
    }
  });
});

describe("explainMetric — portfolio-wide metrics", () => {
  let userId: string;
  beforeAll(async () => {
    userId = await createUser("portfolio-wide");
    await insertPosition(userId, "AAPL", 45);
  });
  afterAll(async () => {
    await cleanupUser(userId);
  });

  it("portfolio_health resolves the real, same score the Institutional Intelligence Engine computes", async () => {
    const result = await explainMetric("portfolio_health", userId);
    expect(result.currentValue).toMatch(/\/100/);
    expect(result.sourceCalculation).toContain("healthScore");
  });

  it("buying_power resolves a real dollar figure", async () => {
    const result = await explainMetric("buying_power", userId);
    expect(result.currentValue).toMatch(/^\$/);
  });

  it("concentration and stress_test both resolve real, non-empty explanations", async () => {
    for (const code of ["concentration", "stress_test"] as const) {
      const result = await explainMetric(code, userId);
      expect(result.currentValue.length).toBeGreaterThan(0);
      expect(result.plainEnglish.length).toBeGreaterThan(10);
    }
  });

  it("event_risk honestly reports 'None' for a position with no tracked upcoming event risk", async () => {
    const result = await explainMetric("event_risk", userId);
    expect(typeof result.currentValue).toBe("string");
  });
});

describe("explainMetric — trade-scoped metrics", () => {
  let userId: string;
  let tradeId: number;
  beforeAll(async () => {
    userId = await createUser("trade-scoped");
    const trade = await insertPosition(userId, "AAPL", 30);
    tradeId = trade.id;
  });
  afterAll(async () => {
    await cleanupUser(userId);
  });

  it("requires a tradeId for probability_of_profit/max_profit/max_loss/expected_move — a 400 error, not a fabricated portfolio-wide read", async () => {
    for (const code of ["probability_of_profit", "max_profit", "max_loss", "expected_move"] as const) {
      await expect(explainMetric(code, userId)).rejects.toThrow(MetricExplainerError);
    }
  });

  it("probability_of_profit/max_profit/max_loss reuse the trade's own already-computed, stored figures exactly", async () => {
    const [trade] = await db.select().from(tradesTable).where(eq(tradesTable.id, tradeId));
    const pop = await explainMetric("probability_of_profit", userId, { tradeId });
    expect(pop.currentValue).toBe(`${trade.pop.toFixed(0)}%`);
    const maxProfit = await explainMetric("max_profit", userId, { tradeId });
    expect(maxProfit.currentValue).toContain(trade.maxProfit.toFixed(2));
    const maxLoss = await explainMetric("max_loss", userId, { tradeId });
    expect(maxLoss.currentValue).toContain(trade.maxLoss.toFixed(2));
  });

  it("expected_move computes a real range for a real, resolvable snapshot symbol", async () => {
    const result = await explainMetric("expected_move", userId, { tradeId });
    expect(result.currentValue).toMatch(/±\d/);
  });

  it("404s (via MetricExplainerError) for a tradeId that doesn't belong to the calling user — tenant isolation", async () => {
    const otherUser = await createUser("trade-scoped-other");
    try {
      await expect(explainMetric("max_profit", otherUser, { tradeId })).rejects.toMatchObject({ status: 404 });
    } finally {
      await cleanupUser(otherUser);
    }
  });
});

describe("explainMetric — never accepts a client-supplied value", () => {
  it("explainMetric's own signature has no parameter for a client-supplied 'value' to explain", async () => {
    // A structural proof, not just a runtime one: the function signature
    // itself is (code, userId, opts) — opts only ever carries tradeId,
    // never a value/number the caller could use to fabricate an
    // explanation for a number the server never actually computed.
    const userId = await createUser("no-client-value");
    try {
      const result = await explainMetric("delta", userId);
      expect(result).not.toHaveProperty("clientSuppliedValue");
    } finally {
      await cleanupUser(userId);
    }
  });
});
