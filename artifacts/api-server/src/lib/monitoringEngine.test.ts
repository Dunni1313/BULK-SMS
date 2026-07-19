// Phase 16 — Institutional Monitoring & Alerts Engine.
//
// Two layers of coverage, matching this module's own two kinds of logic:
//   1. Pure diff/framing functions (diffSymbolState, earningsAlertFor) are
//      unit-tested directly against fully-controlled OpportunityRow
//      fixtures — no DB, no network, exhaustive edge cases.
//   2. The orchestration functions (resolveMonitoredSymbols,
//      evaluateSymbolMonitoringAlerts, evaluatePortfolioMonitoringAlerts,
//      evaluateOpportunityMonitoringAlerts) are tested live against a real
//      Postgres connection with fresh, isolated users — mirroring
//      lib/notifications.test.ts's own established pattern — since the
//      thing being proven (bounded-scope resolution, state read/write
//      round-tripping, honest-empty paths) is genuinely DB-shaped.
//
// Deliberately uses fresh, isolated users (never the shared legacy-owner
// account) so this file's own state writes never race a sibling test file's
// dedup/diff assertions — the same isolation discipline
// lib/notifications.test.ts established.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  valueWatchlistTable,
  investingPortfoliosTable,
  investingHoldingsTable,
  investingSavedScreensTable,
  investingMonitoringStatesTable,
  platformNotificationsTable,
} from "@workspace/db";
import { getFundamentalsProvider, resolveFundamentals } from "./fundamentals.js";
import { buildValueResearchReport } from "./valueReport.js";
import { buildOpportunityRow, type OpportunityRow } from "./opportunityDiscovery.js";
import {
  diffSymbolState,
  earningsAlertFor,
  resolveMonitoredSymbols,
  evaluateSymbolMonitoringAlerts,
  evaluatePortfolioMonitoringAlerts,
  evaluateOpportunityMonitoringAlerts,
} from "./monitoringEngine.js";

// ─── Fixtures ───────────────────────────────────────────────────────────────

function baseRow(overrides: Partial<OpportunityRow> = {}): OpportunityRow {
  return {
    symbol: "ACME",
    name: "Acme Corp",
    kind: "stock",
    price: 100,
    sector: "Technology",
    industry: "Software",
    businessQualityScore: 70,
    businessQualityRating: "Good",
    investmentQualityScore: 70,
    moatRating: "Medium",
    moatScore: 60,
    competitiveAdvantageScore: 60,
    financialStrengthRating: "Acceptable",
    financialStrengthScore: 60,
    valuationRating: "Fair",
    marginOfSafety: 0.1,
    marketCap: 1_000_000_000,
    revenueGrowth5y: 0.1,
    roic: 0.12,
    roe: 0.15,
    debtToEquity: 0.5,
    fcfMargin: 0.1,
    dividendYield: 0.02,
    investmentCommitteeVerdict: "Hold",
    investmentCommitteeConfidence: 60,
    tomNashConvictionScore: 60,
    tomNashVerdict: "Hold",
    decisionRecommendation: "Hold",
    rankScore: 50,
    rankExplanation: "Balanced fundamentals.",
    dataSource: "SIMULATED",
    fetchedAt: new Date().toISOString(),
    simulated: true,
    ...overrides,
  };
}

// ─── diffSymbolState (pure) ─────────────────────────────────────────────────

describe("diffSymbolState", () => {
  it("returns no candidates when nothing changed", () => {
    const row = baseRow();
    expect(diffSymbolState(row, { ...row })).toEqual([]);
  });

  it("detects a Decision Engine recommendation change, with correct severity by recommendation", () => {
    const previous = baseRow({ decisionRecommendation: "Hold" });
    const holdToSell = diffSymbolState(previous, baseRow({ decisionRecommendation: "Sell" }));
    expect(holdToSell).toHaveLength(1);
    expect(holdToSell[0].type).toBe("decision_change");
    expect(holdToSell[0].severity).toBe("critical");
    expect(holdToSell[0].previousValue).toBe("Hold");
    expect(holdToSell[0].currentValue).toBe("Sell");
    expect(holdToSell[0].relatedSymbol).toBe("ACME");
    expect(holdToSell[0].evidence!.length).toBeGreaterThan(0);

    const holdToReduce = diffSymbolState(previous, baseRow({ decisionRecommendation: "Reduce" }));
    expect(holdToReduce[0].severity).toBe("warning");

    const holdToBuy = diffSymbolState(previous, baseRow({ decisionRecommendation: "Buy" }));
    expect(holdToBuy[0].severity).toBe("info");
  });

  it("detects a valuation rating change, flagged warning only at Very Expensive", () => {
    const previous = baseRow({ valuationRating: "Fair", marginOfSafety: 0.1 });
    const toExpensive = diffSymbolState(previous, baseRow({ valuationRating: "Expensive", marginOfSafety: -0.1 }));
    expect(toExpensive).toHaveLength(1);
    expect(toExpensive[0].type).toBe("valuation_change");
    expect(toExpensive[0].severity).toBe("info");

    const toVeryExpensive = diffSymbolState(previous, baseRow({ valuationRating: "Very Expensive", marginOfSafety: -0.3 }));
    expect(toVeryExpensive[0].severity).toBe("warning");
    expect(toVeryExpensive[0].evidence![0]).toMatch(/margin of safety/i);
  });

  it("detects a Business Quality rating change, flagged warning only when it becomes Weak", () => {
    const previous = baseRow({ businessQualityRating: "Good", businessQualityScore: 70 });
    const change = diffSymbolState(previous, baseRow({ businessQualityRating: "Weak", businessQualityScore: 40 }));
    expect(change).toHaveLength(1);
    expect(change[0].type).toBe("quality_change");
    expect(change[0].severity).toBe("warning");
    expect(change[0].previousValue).toBe("Good");
    expect(change[0].currentValue).toBe("Weak");
  });

  it("detects an Investment Committee verdict change, flagged warning only when it becomes Wait", () => {
    const previous = baseRow({ investmentCommitteeVerdict: "Buy", investmentCommitteeConfidence: 80 });
    const toWait = diffSymbolState(previous, baseRow({ investmentCommitteeVerdict: "Wait", investmentCommitteeConfidence: 40 }));
    expect(toWait).toHaveLength(1);
    expect(toWait[0].type).toBe("committee_change");
    expect(toWait[0].severity).toBe("warning");

    const toHold = diffSymbolState(previous, baseRow({ investmentCommitteeVerdict: "Hold" }));
    expect(toHold[0].severity).toBe("info");
  });

  it("detects a Tom Nash verdict change, flagged warning only when it becomes Wait", () => {
    const previous = baseRow({ tomNashVerdict: "Buy", tomNashConvictionScore: 80 });
    const toWait = diffSymbolState(previous, baseRow({ tomNashVerdict: "Wait", tomNashConvictionScore: 30 }));
    expect(toWait).toHaveLength(1);
    expect(toWait[0].type).toBe("tomnash_change");
    expect(toWait[0].severity).toBe("warning");
  });

  it("detects a Financial Strength deterioration, never a false positive on improvement or no change", () => {
    const previous = baseRow({ financialStrengthRating: "Strong", financialStrengthScore: 90 });

    const deteriorated = diffSymbolState(previous, baseRow({ financialStrengthRating: "Acceptable", financialStrengthScore: 55 }));
    expect(deteriorated).toHaveLength(1);
    expect(deteriorated[0].type).toBe("financial_deterioration");
    expect(deteriorated[0].severity).toBe("warning");

    const toRisky = diffSymbolState(previous, baseRow({ financialStrengthRating: "Risky", financialStrengthScore: 20 }));
    expect(toRisky[0].severity).toBe("critical");

    // Improvement (Acceptable -> Strong) never fires financial_deterioration.
    const improved = diffSymbolState(baseRow({ financialStrengthRating: "Acceptable" }), baseRow({ financialStrengthRating: "Strong" }));
    expect(improved.find((c) => c.type === "financial_deterioration")).toBeUndefined();

    // No change never fires.
    const unchanged = diffSymbolState(previous, baseRow({ financialStrengthRating: "Strong", financialStrengthScore: 90 }));
    expect(unchanged.find((c) => c.type === "financial_deterioration")).toBeUndefined();
  });

  it("detects a dividend cut to zero as critical, never fabricating a value when there was never a dividend", () => {
    const previous = baseRow({ dividendYield: 0.04 });
    const cutToZero = diffSymbolState(previous, baseRow({ dividendYield: 0 }));
    expect(cutToZero).toHaveLength(1);
    expect(cutToZero[0].type).toBe("dividend_change");
    expect(cutToZero[0].severity).toBe("critical");
    expect(cutToZero[0].currentValue).toBe("0%");

    // Never a dividend before or after -> no fabricated alert.
    const neverHadOne = diffSymbolState(baseRow({ dividendYield: 0 }), baseRow({ dividendYield: 0 }));
    expect(neverHadOne).toEqual([]);
  });

  it("detects a >=25% relative dividend change (cut and increase), never a trivial <25% change", () => {
    const previous = baseRow({ dividendYield: 0.04 });

    const cut = diffSymbolState(previous, baseRow({ dividendYield: 0.02 })); // -50%
    expect(cut).toHaveLength(1);
    expect(cut[0].severity).toBe("warning");
    expect(cut[0].title).toMatch(/cut/i);

    const increase = diffSymbolState(previous, baseRow({ dividendYield: 0.06 })); // +50%
    expect(increase).toHaveLength(1);
    expect(increase[0].severity).toBe("info");
    expect(increase[0].title).toMatch(/increased/i);

    const trivial = diffSymbolState(previous, baseRow({ dividendYield: 0.045 })); // +12.5%, below threshold
    expect(trivial).toEqual([]);
  });

  it("can raise multiple candidates at once when several dimensions changed together", () => {
    const previous = baseRow({ decisionRecommendation: "Buy", valuationRating: "Cheap" });
    const current = baseRow({ decisionRecommendation: "Sell", valuationRating: "Very Expensive", marginOfSafety: -0.4 });
    const candidates = diffSymbolState(previous, current);
    expect(candidates.map((c) => c.type).sort()).toEqual(["decision_change", "valuation_change"]);
  });
});

// ─── earningsAlertFor (pure) ────────────────────────────────────────────────

describe("earningsAlertFor", () => {
  it("returns null when there is no earnings risk flag", () => {
    expect(earningsAlertFor("ACME", "SIMULATED", [{ text: "Some unrelated risk." }])).toBeNull();
    expect(earningsAlertFor("ACME", "SIMULATED", [])).toBeNull();
  });

  it("reuses the report's own earnings risk flag verbatim, never fabricating new text", () => {
    const alert = earningsAlertFor("ACME", "SIMULATED", [{ text: "Earnings in ~5 days." }, { text: "Other risk." }]);
    expect(alert).not.toBeNull();
    expect(alert!.type).toBe("earnings_alert");
    expect(alert!.severity).toBe("info");
    expect(alert!.message).toBe("Earnings in ~5 days.");
    expect(alert!.evidence).toEqual(["Earnings in ~5 days."]);
    expect(alert!.relatedSymbol).toBe("ACME");
  });

  it("labels dataSource honestly, defaulting to SIMULATED for anything not exactly LIVE", () => {
    const live = earningsAlertFor("ACME", "LIVE", [{ text: "Earnings in ~3 days." }]);
    expect(live!.dataSource).toBe("LIVE");
    const other = earningsAlertFor("ACME", "whatever", [{ text: "Earnings in ~3 days." }]);
    expect(other!.dataSource).toBe("SIMULATED");
  });
});

// ─── Live orchestration tests ───────────────────────────────────────────────

async function createUser(label: string): Promise<string> {
  const [row] = await db
    .insert(usersTable)
    .values({ email: `monitoring-${label}-${randomUUID()}@example.com`, displayName: `Monitoring ${label}` })
    .returning({ id: usersTable.id });
  return row.id;
}

async function cleanupUser(userId: string): Promise<void> {
  await db.delete(platformNotificationsTable).where(eq(platformNotificationsTable.userId, userId));
  await db.delete(investingMonitoringStatesTable).where(eq(investingMonitoringStatesTable.userId, userId));
  await db.delete(investingHoldingsTable).where(eq(investingHoldingsTable.userId, userId));
  await db.delete(investingPortfoliosTable).where(eq(investingPortfoliosTable.userId, userId));
  await db.delete(investingSavedScreensTable).where(eq(investingSavedScreensTable.userId, userId));
  await db.delete(valueWatchlistTable).where(eq(valueWatchlistTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

describe("resolveMonitoredSymbols", () => {
  let userId: string;

  beforeAll(async () => {
    userId = await createUser("symbols");
  });

  afterAll(async () => {
    await cleanupUser(userId);
  });

  it("honestly returns an empty list for a user tracking nothing", async () => {
    expect(await resolveMonitoredSymbols(userId)).toEqual([]);
  });

  it("returns the union of watchlist and holding symbols, deduplicated", async () => {
    await db.insert(valueWatchlistTable).values({ userId, symbol: "AAPL" });
    await db.insert(valueWatchlistTable).values({ userId, symbol: "MSFT" });
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId, name: "P1" }).returning();
    await db.insert(investingHoldingsTable).values({ userId, portfolioId: portfolio.id, symbol: "MSFT", targetWeightPct: 50 });
    await db.insert(investingHoldingsTable).values({ userId, portfolioId: portfolio.id, symbol: "GOOGL", targetWeightPct: 50 });

    const symbols = await resolveMonitoredSymbols(userId);
    expect(new Set(symbols)).toEqual(new Set(["AAPL", "MSFT", "GOOGL"]));
  });
});

describe("evaluateSymbolMonitoringAlerts", () => {
  let userId: string;
  const symbol = "AAPL";

  beforeAll(async () => {
    userId = await createUser("symbol-eval");
  });

  afterAll(async () => {
    await cleanupUser(userId);
  });

  it("honestly returns no candidates when the user monitors nothing", async () => {
    const provider = await getFundamentalsProvider(userId);
    expect(await evaluateSymbolMonitoringAlerts(userId, provider)).toEqual([]);
  });

  it("never fabricates a change candidate on the first evaluation (no prior state exists yet), but does persist state for next time", async () => {
    await db.insert(valueWatchlistTable).values({ userId, symbol });
    const provider = await getFundamentalsProvider(userId);

    const candidates = await evaluateSymbolMonitoringAlerts(userId, provider);
    // With no previous state, diffSymbolState is never invoked — only an
    // earnings_alert (if the report happens to carry one today) can appear.
    expect(candidates.every((c) => c.type === "earnings_alert")).toBe(true);

    const [state] = await db
      .select()
      .from(investingMonitoringStatesTable)
      .where(eq(investingMonitoringStatesTable.userId, userId));
    expect(state).toBeTruthy();
    expect(state.entityType).toBe("symbol");
    expect(state.entityKey).toBe(symbol);
    expect((state.stateJson as OpportunityRow).symbol).toBe(symbol);
  });

  it("detects a genuine diff against a synthetically-seeded prior state, matching the real current row's own fields", async () => {
    const provider = await getFundamentalsProvider(userId);
    const f = (await resolveFundamentals(provider, symbol))!;
    const report = (await buildValueResearchReport(symbol, f.asOf, provider, f))!;
    const actualCurrent = buildOpportunityRow(f, report);

    // Seed a synthetic "previous" that deliberately differs from the real
    // current row in decisionRecommendation — overwriting whatever state the
    // prior test wrote.
    const fakePrevious: OpportunityRow = {
      ...actualCurrent,
      decisionRecommendation: actualCurrent.decisionRecommendation === "Sell" ? "Buy" : "Sell",
    };
    await db
      .update(investingMonitoringStatesTable)
      .set({ stateJson: fakePrevious })
      .where(
        and(
          eq(investingMonitoringStatesTable.userId, userId),
          eq(investingMonitoringStatesTable.entityType, "symbol"),
          eq(investingMonitoringStatesTable.entityKey, symbol),
        ),
      );

    const candidates = await evaluateSymbolMonitoringAlerts(userId, provider);
    const decisionCandidate = candidates.find((c) => c.type === "decision_change");
    expect(decisionCandidate).toBeTruthy();
    expect(decisionCandidate!.previousValue).toBe(fakePrevious.decisionRecommendation);
    expect(decisionCandidate!.currentValue).toBe(actualCurrent.decisionRecommendation);
    expect(decisionCandidate!.relatedSymbol).toBe(symbol);
  });
});

describe("evaluatePortfolioMonitoringAlerts", () => {
  let userId: string;
  let portfolioId: number;

  beforeAll(async () => {
    userId = await createUser("portfolio-eval");
  });

  afterAll(async () => {
    await cleanupUser(userId);
  });

  it("honestly returns no candidates when the user has no portfolios", async () => {
    const provider = await getFundamentalsProvider(userId);
    expect(await evaluatePortfolioMonitoringAlerts(userId, provider)).toEqual([]);
  });

  it("honestly returns no candidates for a portfolio with no holdings", async () => {
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId, name: "Empty" }).returning();
    portfolioId = portfolio.id;
    const provider = await getFundamentalsProvider(userId);
    expect(await evaluatePortfolioMonitoringAlerts(userId, provider)).toEqual([]);
  });

  it("flags a single-symbol concentration breach and a sector concentration breach for a single-holding portfolio, and persists a snapshot", async () => {
    await db.insert(investingHoldingsTable).values({
      userId,
      portfolioId,
      symbol: "AAPL",
      targetWeightPct: 100,
      shares: 10,
    });

    const provider = await getFundamentalsProvider(userId);
    const candidates = await evaluatePortfolioMonitoringAlerts(userId, provider);

    const positionBreach = candidates.find((c) => c.type === "position_sizing_breach");
    expect(positionBreach).toBeTruthy();
    expect(positionBreach!.dataSource).toBe("SIMULATED");
    expect(positionBreach!.relatedSymbol).toBe("AAPL");

    const sectorBreach = candidates.find((c) => c.type === "sector_concentration_breach");
    expect(sectorBreach).toBeTruthy();

    const [state] = await db
      .select()
      .from(investingMonitoringStatesTable)
      .where(eq(investingMonitoringStatesTable.userId, userId));
    expect(state.entityType).toBe("portfolio");
    expect(state.entityKey).toBe(String(portfolioId));
  });

  it("flags portfolio quality drift and diversification drift against a synthetically-seeded prior snapshot", async () => {
    await db
      .update(investingMonitoringStatesTable)
      .set({ stateJson: { qualityScore: 95, riskScore: 50, diversificationScore: 90 } })
      .where(eq(investingMonitoringStatesTable.userId, userId));

    const provider = await getFundamentalsProvider(userId);
    const candidates = await evaluatePortfolioMonitoringAlerts(userId, provider);
    const drifts = candidates.filter((c) => c.type === "portfolio_drift");
    // A single 100%-weighted holding scores far below 95 on quality and far
    // below 90 on diversification (a single holding is maximally
    // undiversified) — both drift checks should fire.
    expect(drifts.length).toBeGreaterThan(0);
    expect(drifts.every((c) => c.severity === "warning")).toBe(true);
  });

  it("never fabricates a drift alert on the very first evaluation with no prior snapshot", async () => {
    // A second, brand-new portfolio has no monitoring state yet.
    const [freshPortfolio] = await db.insert(investingPortfoliosTable).values({ userId, name: "Fresh" }).returning();
    await db.insert(investingHoldingsTable).values({ userId, portfolioId: freshPortfolio.id, symbol: "MSFT", targetWeightPct: 100, shares: 5 });

    const provider = await getFundamentalsProvider(userId);
    const candidates = await evaluatePortfolioMonitoringAlerts(userId, provider);
    const freshDrift = candidates.find((c) => c.type === "portfolio_drift" && c.title.startsWith("Fresh:"));
    expect(freshDrift).toBeUndefined();
  });
});

describe("evaluateOpportunityMonitoringAlerts (on-demand only)", () => {
  let userId: string;

  beforeAll(async () => {
    userId = await createUser("opportunity-eval");
  });

  afterAll(async () => {
    await cleanupUser(userId);
  });

  it("honestly returns no candidates when the user has no saved screens", async () => {
    const provider = await getFundamentalsProvider(userId);
    expect(await evaluateOpportunityMonitoringAlerts(userId, provider)).toEqual([]);
  });

  it("never fabricates a match on the first run (no prior matched-symbol list), but persists one for next time", async () => {
    const [screen] = await db
      .insert(investingSavedScreensTable)
      .values({ userId, name: "My Screen", filtersJson: {} })
      .returning();

    const provider = await getFundamentalsProvider(userId);
    const first = await evaluateOpportunityMonitoringAlerts(userId, provider);
    expect(first).toEqual([]);

    const [state] = await db
      .select()
      .from(investingMonitoringStatesTable)
      .where(eq(investingMonitoringStatesTable.userId, userId));
    expect(state.entityType).toBe("saved_screen");
    expect(state.entityKey).toBe(String(screen.id));
    expect(Array.isArray(state.stateJson)).toBe(true);
    expect((state.stateJson as string[]).length).toBeGreaterThan(0);
  });

  it("detects new matches against a synthetically-emptied prior matched-symbol list", async () => {
    await db
      .update(investingMonitoringStatesTable)
      .set({ stateJson: [] })
      .where(eq(investingMonitoringStatesTable.userId, userId));

    const provider = await getFundamentalsProvider(userId);
    const candidates = await evaluateOpportunityMonitoringAlerts(userId, provider);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((c) => c.type === "opportunity_match")).toBe(true);
    expect(candidates.every((c) => c.relatedSymbol != null)).toBe(true);
  });

  it("never re-reports the same matches once they're the new baseline", async () => {
    const provider = await getFundamentalsProvider(userId);
    const second = await evaluateOpportunityMonitoringAlerts(userId, provider);
    expect(second).toEqual([]);
  });
});
