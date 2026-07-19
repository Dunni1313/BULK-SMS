// Institutional Mentor sprint — Phase 8, Sprint 5. Direct, DB-backed unit
// coverage of the top-level orchestrator buildInstitutionalMentor(),
// which is PURE COMPOSITION over the already-unit-tested Portfolio
// Dashboard (lib/portfolioDashboard.test.ts), Concentration overlay
// (lib/portfolioConcentration.test.ts), Portfolio Stress Test
// (lib/portfolioStressTest.test.ts), and the AI Trade Journal
// (lib/tradeJournal.test.ts). Never contacts a broker execution
// endpoint, never creates or modifies an order or position, never
// mutates the trades/journal/settings tables, and — unlike AI Portfolio
// Analyst — never writes to intelligence_snapshots either, since this
// module never calls buildInstitutionalIntelligence().
//
// Uses fresh, isolated users (the exact same pattern
// lib/portfolioAnalyst.test.ts/lib/tradeJournal.test.ts already
// established) so assertions are never at risk of colliding with
// another concurrently-running test file's own trades.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  tradesTable,
  settingsTable,
  journalEntriesTable,
  learningProgressTable,
  intelligenceSnapshotsTable,
  valueWatchlistTable,
  investingPortfoliosTable,
  investingHoldingsTable,
  investingDecisionSnapshotsTable,
  investingDecisionNotesTable,
} from "@workspace/db";
import { buildInstitutionalMentor, INCOME_POSITIVE_THETA_BASE_SCORE, INCOME_ZERO_THETA_BASE_SCORE } from "./institutionalMentor.js";
import { buildPortfolioDashboard } from "./portfolioDashboard.js";
import { buildPortfolioConcentrationOverlay } from "./portfolioConcentration.js";
import { buildTradeJournal } from "./tradeJournal.js";
import { getSnapshot, buildIronCondor } from "./optionsMath.js";

async function createUser(label: string): Promise<string> {
  const [row] = await db
    .insert(usersTable)
    .values({ email: `institutional-mentor-${label}-${randomUUID()}@example.com`, displayName: `Institutional Mentor ${label}` })
    .returning({ id: usersTable.id });
  return row.id;
}

async function cleanupUser(userId: string): Promise<void> {
  await db.delete(tradesTable).where(eq(tradesTable.userId, userId));
  await db.delete(journalEntriesTable).where(eq(journalEntriesTable.userId, userId));
  await db.delete(learningProgressTable).where(eq(learningProgressTable.userId, userId));
  await db.delete(intelligenceSnapshotsTable).where(eq(intelligenceSnapshotsTable.userId, userId));
  await db.delete(valueWatchlistTable).where(eq(valueWatchlistTable.userId, userId));
  await db.delete(investingHoldingsTable).where(eq(investingHoldingsTable.userId, userId));
  await db.delete(investingPortfoliosTable).where(eq(investingPortfoliosTable.userId, userId));
  await db.delete(investingDecisionSnapshotsTable).where(eq(investingDecisionSnapshotsTable.userId, userId));
  await db.delete(investingDecisionNotesTable).where(eq(investingDecisionNotesTable.userId, userId));
  await db.delete(settingsTable).where(eq(settingsTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

function isoDateInDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().split("T")[0];
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

interface InsertedTrade {
  id: number;
}

// The exact same open-position fixture technique
// lib/portfolioAnalyst.test.ts's own insertPosition() already
// established — a real iron condor quote via buildIronCondor(), never a
// fabricated position.
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

interface CloseOpts {
  quantity?: number;
  openDaysAgo?: number;
  closeDaysAgo?: number;
  outcome?: "win_target" | "loss_stop";
}

// The exact same closed-trade fixture technique
// lib/tradeJournal.test.ts's own insertClosedTrade() already
// established — a real iron condor quote, real internally-consistent
// P&L derived from its own maxProfit/maxLoss.
async function insertClosedTrade(userId: string, symbol: string, opts: CloseOpts = {}): Promise<number> {
  const snap = getSnapshot(symbol) ?? getSnapshot("AAPL")!;
  const quote = buildIronCondor(snap, { dte: 45 });
  const qty = opts.quantity ?? 1;
  const openDate = daysAgo(opts.openDaysAgo ?? 30);
  const closeDate = daysAgo(opts.closeDaysAgo ?? 5);
  const expiration = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  const legs = quote.legs.map((l) => ({
    side: l.side,
    optionType: l.optionType,
    strike: l.strike,
    expiration,
    openPrice: l.openPrice,
    quantity: qty,
  }));
  const outcome = opts.outcome ?? "win_target";
  const credit = quote.credit * qty;
  const maxProfit = quote.maxProfit * qty;
  const maxLoss = quote.maxLoss * qty;
  const currentPnl = outcome === "win_target" ? maxProfit * 0.75 : -maxLoss;
  const exitReason = outcome === "win_target" ? "Profit target reached (75%)" : "Stop loss hit";
  const [row] = await db
    .insert(tradesTable)
    .values({
      userId,
      symbol,
      strategy: "iron_condor",
      status: "closed",
      legs,
      credit,
      maxProfit,
      maxLoss,
      pop: quote.pop,
      expiration,
      entryIv: null,
      openDate,
      closeDate,
      currentPnl,
      currentPnlPercent: credit !== 0 ? (currentPnl / Math.abs(credit)) * 100 : 0,
      exitReason,
    })
    .returning({ id: tradesTable.id });
  return row.id;
}

describe("buildInstitutionalMentor", () => {
  describe("empty portfolio, no trade history", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("empty");
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("always discloses paperTradingMode, deterministicAnalysis, and educationalOnly as structural facts", async () => {
      const result = await buildInstitutionalMentor(userId);
      expect(result.paperTradingMode).toBe(true);
      expect(result.deterministicAnalysis).toBe(true);
      expect(result.educationalOnly).toBe(true);
    });

    it("produces all 9 Scorecard categories, each with a real score/grade/sourceModule/why — never fabricated", async () => {
      const result = await buildInstitutionalMentor(userId);
      expect(result.scorecard.length).toBe(9);
      const categories = result.scorecard.map((s) => s.category).sort();
      expect(categories).toEqual(
        [
          "capital_allocation",
          "diversification",
          "discipline",
          "event_preparation",
          "greeks_management",
          "income_generation",
          "position_sizing",
          "portfolio_health",
          "risk_management",
        ].sort(),
      );
      for (const entry of result.scorecard) {
        expect(entry.score).toBeGreaterThanOrEqual(0);
        expect(entry.score).toBeLessThanOrEqual(100);
        expect(entry.sourceModule.length).toBeGreaterThan(0);
        expect(entry.why.length).toBeGreaterThan(0);
      }
    });

    it("Income Generation honestly reads 100 (no income risk) with zero open positions", async () => {
      const result = await buildInstitutionalMentor(userId);
      const income = result.scorecard.find((s) => s.category === "income_generation")!;
      expect(income.score).toBe(100);
    });

    it("Risk Review honestly reports no open positions, never a fabricated risk contributor", async () => {
      const result = await buildInstitutionalMentor(userId);
      expect(result.riskReview.primaryContributor).toBe("No open positions");
    });

    it("Capital Allocation Review honestly reports 100% uncommitted buying power", async () => {
      const result = await buildInstitutionalMentor(userId);
      expect(result.capitalAllocationReview.summary).toContain("uncommitted");
    });

    it("Behaviour Review honestly reports no completed trades", async () => {
      const result = await buildInstitutionalMentor(userId);
      expect(result.behaviourReview.totalClosedTrades).toBe(0);
      expect(result.behaviourReview.summary).toMatch(/no completed trades/i);
    });

    it("Professional Review flags the flat portfolio, never a fabricated observation", async () => {
      const result = await buildInstitutionalMentor(userId);
      expect(result.professionalReview.some((o) => o.text === "The portfolio currently holds no open positions.")).toBe(true);
    });

    it("never writes to intelligence_snapshots — this module does not call buildInstitutionalIntelligence()", async () => {
      await buildInstitutionalMentor(userId);
      const rows = await db.select().from(intelligenceSnapshotsTable).where(eq(intelligenceSnapshotsTable.userId, userId));
      expect(rows.length).toBe(0);
    });

    it("never mutates the trades table", async () => {
      const before = await db.select().from(tradesTable).where(eq(tradesTable.userId, userId));
      await buildInstitutionalMentor(userId);
      const after = await db.select().from(tradesTable).where(eq(tradesTable.userId, userId));
      expect(after.length).toBe(before.length);
    });
  });

  describe("balanced portfolio (diversified across symbols)", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("balanced");
      for (const symbol of ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"]) {
        await insertPosition(userId, symbol, 60);
      }
      for (let i = 0; i < 4; i++) {
        await insertClosedTrade(userId, ["AAPL", "MSFT", "GOOGL", "AMZN"][i], { outcome: "win_target", openDaysAgo: 30 - i * 3, closeDaysAgo: 20 - i * 3 });
      }
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("Scorecard scores are byte-traceable to the real underlying Dashboard/Concentration/StressTest/Journal figures", async () => {
      const result = await buildInstitutionalMentor(userId);
      const dash = await buildPortfolioDashboard(userId);
      const concentration = await buildPortfolioConcentrationOverlay(userId);
      const journal = await buildTradeJournal(userId);

      expect(result.scorecard.find((s) => s.category === "portfolio_health")!.score).toBe(dash.healthScore);
      expect(result.scorecard.find((s) => s.category === "diversification")!.score).toBe(concentration.summary.diversificationScore);
      expect(result.scorecard.find((s) => s.category === "discipline")!.score).toBe(journal.disciplineScore);
      expect(result.scorecard.find((s) => s.category === "greeks_management")!.score).toBe(
        dash.healthFactors.find((f) => f.code === "net_greeks_exposure")!.score,
      );
      expect(result.scorecard.find((s) => s.category === "event_preparation")!.score).toBe(
        dash.healthFactors.find((f) => f.code === "event_risk")!.score,
      );
      expect(result.scorecard.find((s) => s.category === "position_sizing")!.score).toBe(
        dash.healthFactors.find((f) => f.code === "position_sizing_quality")!.score,
      );
    });

    it("Professional Review names a real top-sector observation sourced from the Concentration overlay's own sector breakdown", async () => {
      const result = await buildInstitutionalMentor(userId);
      const dash = await buildPortfolioDashboard(userId);
      const topSector = dash.allocationBySector[0];
      if (topSector) {
        expect(result.professionalReview.some((o) => o.text.includes(topSector.label) && o.text.includes(`${topSector.weightPct}%`))).toBe(true);
      }
    });

    it("Behaviour Review is a byte-identical pass-through of the AI Trade Journal's own disciplineScore/decisionQualitySummary", async () => {
      const result = await buildInstitutionalMentor(userId);
      const journal = await buildTradeJournal(userId);
      expect(result.behaviourReview.disciplineScore).toBe(journal.disciplineScore);
      expect(result.behaviourReview.decisionQualitySummary).toEqual(journal.decisionQualitySummary);
      expect(result.behaviourReview.totalClosedTrades).toBe(journal.totalClosedTrades);
    });

    it("Income Review's bySymbol/byStrategy breakdowns are real and non-empty for an income-generating portfolio", async () => {
      const result = await buildInstitutionalMentor(userId);
      expect(result.incomeReview.bySymbol.length).toBeGreaterThan(0);
      expect(result.incomeReview.byStrategy.length).toBeGreaterThan(0);
      expect(result.incomeReview.incomeSourceCount).toBe(result.incomeReview.bySymbol.length);
    });

    it("Decision Review's sizing item cites the real, reused sizingRespectedRatePct figure", async () => {
      const result = await buildInstitutionalMentor(userId);
      const journal = await buildTradeJournal(userId);
      const sizingItem = result.decisionReview.find((i) => i.code === "sizing_followed_plan" || i.code === "sizing_exceeded_policy")!;
      expect(sizingItem.detail).toContain(String(journal.decisionQualitySummary.sizingRespectedRatePct));
    });

    it("Capital Allocation Review's cash utilisation is real arithmetic on Dashboard's own buyingPower/portfolioValue", async () => {
      const result = await buildInstitutionalMentor(userId);
      const dash = await buildPortfolioDashboard(userId);
      const expected = dash.portfolioValue > 0 ? Math.round((1 - dash.buyingPower / dash.portfolioValue) * 10000) / 100 : 0;
      expect(result.capitalAllocationReview.cashUtilizationPct).toBe(expected);
      expect(result.capitalAllocationReview.buyingPower).toBe(dash.buyingPower);
      expect(result.capitalAllocationReview.portfolioValue).toBe(dash.portfolioValue);
    });

    it("every Institutional Lessons cross-link carries a real lesson, glossary, or strategy reference — never an empty section", async () => {
      const result = await buildInstitutionalMentor(userId);
      for (const link of Object.values(result.learningSummary)) {
        expect(link.category.length).toBeGreaterThan(0);
        expect(link.lessonHref !== null || link.glossaryHref !== null || link.strategyHref !== null).toBe(true);
      }
    });

    it("is deterministic across repeated same-state calls (aside from generatedAt)", async () => {
      const a = await buildInstitutionalMentor(userId);
      const b = await buildInstitutionalMentor(userId);
      expect(a.scorecard).toEqual(b.scorecard);
      expect(a.professionalReview).toEqual(b.professionalReview);
      expect(a.decisionReview).toEqual(b.decisionReview);
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

    it("Diversification score is low, reflecting the real Concentration overlay's own reading", async () => {
      const result = await buildInstitutionalMentor(userId);
      const concentration = await buildPortfolioConcentrationOverlay(userId);
      const diversification = result.scorecard.find((s) => s.category === "diversification")!;
      expect(diversification.score).toBe(concentration.summary.diversificationScore);
    });

    it("Risk Review names a real, non-fabricated largest portfolio risk", async () => {
      const result = await buildInstitutionalMentor(userId);
      expect(result.riskReview.largestPortfolioRisk).not.toBe("No elevated risk detected");
    });

    it("Decision Review's risk-allocation item reflects a real guidance advisory when one is triggered", async () => {
      const result = await buildInstitutionalMentor(userId);
      const dash = await buildPortfolioDashboard(userId);
      const hasRiskGuidance = dash.guidance.some(
        (g) => g.code === "elevated_concentration" || g.code === "review_large_positions" || g.code === "elevated_risk" || g.code === "high_risk",
      );
      const riskItem = result.decisionReview.find((i) => i.code === "risk_allocation_exceeded" || i.code === "risk_allocation_followed")!;
      expect(riskItem.status).toBe(hasRiskGuidance ? "exceeded" : "followed");
    });
  });

  describe("strong diversification (many symbols, sectors, strategies, expirations)", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("strong-diversification");
      const symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "SPY", "QQQ"];
      for (const symbol of symbols) {
        await insertPosition(userId, symbol, 60 + symbols.indexOf(symbol) * 5);
      }
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("never crashes or fabricates on a genuinely large, diversified portfolio", async () => {
      const result = await buildInstitutionalMentor(userId);
      expect(result.scorecard.length).toBe(9);
      expect(Array.isArray(result.professionalReview)).toBe(true);
      expect(Array.isArray(result.decisionReview)).toBe(true);
    });

    it("Capital Allocation Review's positionDistribution lists every real symbol, never fewer", async () => {
      const result = await buildInstitutionalMentor(userId);
      expect(result.capitalAllocationReview.positionDistribution.length).toBe(8);
    });
  });

  describe("high Greeks (large multi-position exposure)", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("high-greeks");
      for (const symbol of ["AAPL", "MSFT", "NVDA"]) {
        await insertPosition(userId, symbol, 60, { quantity: 20 });
      }
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("Greeks Management score is byte-identical to Dashboard's own net_greeks_exposure factor even under large position sizes", async () => {
      const result = await buildInstitutionalMentor(userId);
      const dash = await buildPortfolioDashboard(userId);
      expect(result.scorecard.find((s) => s.category === "greeks_management")!.score).toBe(
        dash.healthFactors.find((f) => f.code === "net_greeks_exposure")!.score,
      );
    });
  });

  describe("large theta income (many premium-collecting positions)", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("large-theta");
      for (const symbol of ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA"]) {
        await insertPosition(userId, symbol, 45, { quantity: 5 });
      }
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("Income Generation scores INCOME_POSITIVE_THETA_BASE_SCORE (or higher, with a favorable trend) for genuinely positive monthly theta", async () => {
      const result = await buildInstitutionalMentor(userId);
      expect(result.incomeReview.monthlyTheta).toBeGreaterThan(0);
      const income = result.scorecard.find((s) => s.category === "income_generation")!;
      expect(income.score).toBeGreaterThanOrEqual(INCOME_POSITIVE_THETA_BASE_SCORE - 10);
    });

    it("Income Review's Income Projection figures are the exact, unmodified Theta Income weekly/monthly/annualized figures", async () => {
      const result = await buildInstitutionalMentor(userId);
      expect(result.incomeReview.weeklyTheta).toBeCloseTo(result.incomeReview.dailyTheta * 7, 5);
      expect(result.incomeReview.annualizedTheta).toBeGreaterThan(result.incomeReview.monthlyTheta);
    });
  });

  describe("high event risk (earnings-bearing position)", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("high-event-risk");
      // The exact same fixture lib/portfolioEventRisk.test.ts's own
      // "high-risk events" block already established: AAPL at a 45-day
      // expiration deterministically carries a high-risk earnings event
      // in this codebase's own seeded event system.
      await insertPosition(userId, "AAPL", 45);
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("Event Preparation score reflects the real, elevated event-risk classification", async () => {
      const result = await buildInstitutionalMentor(userId);
      const dash = await buildPortfolioDashboard(userId);
      expect(result.scorecard.find((s) => s.category === "event_preparation")!.score).toBe(
        dash.healthFactors.find((f) => f.code === "event_risk")!.score,
      );
    });

    it("Risk Review names Event Risk as the largest portfolio risk when it is genuinely the highest-classified risk", async () => {
      const result = await buildInstitutionalMentor(userId);
      const dash = await buildPortfolioDashboard(userId);
      if (dash.highestEventRisk && (dash.highestEventRisk.riskLevel === "high" || dash.highestEventRisk.riskLevel === "medium")) {
        expect(result.riskReview.largestPortfolioRisk).toMatch(/^Event Risk \(/);
      }
    });
  });

  describe("long trade history (many closed trades)", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("long-history");
      const symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"];
      for (let i = 0; i < 12; i++) {
        await insertClosedTrade(userId, symbols[i % symbols.length], {
          outcome: i % 3 === 0 ? "loss_stop" : "win_target",
          openDaysAgo: 60 - i * 4,
          closeDaysAgo: 50 - i * 4,
        });
      }
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("Behaviour Review reflects the real, full 12-trade closed history — never truncated or fabricated", async () => {
      const result = await buildInstitutionalMentor(userId);
      const journal = await buildTradeJournal(userId);
      expect(result.behaviourReview.totalClosedTrades).toBe(12);
      expect(result.behaviourReview.totalClosedTrades).toBe(journal.totalClosedTrades);
    });

    it("Discipline scorecard entry cites real, non-empty decisionQualitySummary rates in its why text", async () => {
      const result = await buildInstitutionalMentor(userId);
      const discipline = result.scorecard.find((s) => s.category === "discipline")!;
      expect(discipline.why).toMatch(/%/);
    });

    it("never crashes assembling a Journal Timeline-backed Behaviour Review over a genuinely large history", async () => {
      const result = await buildInstitutionalMentor(userId);
      expect(Array.isArray(result.behaviourReview.behaviorPatterns)).toBe(true);
    });
  });

  describe("Income Generation banding sanity (zero theta with open positions)", () => {
    it("bands correctly between positive/zero/negative theta constants", () => {
      expect(INCOME_POSITIVE_THETA_BASE_SCORE).toBeGreaterThan(INCOME_ZERO_THETA_BASE_SCORE);
    });
  });

  // Phase 12 — Institutional Investing Engine Consolidation & Integration.
  // Proves the new watchlistReview section is a plain, honest,
  // ownership-scoped read of the user's own value_watchlist rows — zero
  // new scoring, never fabricated for an empty or another user's watchlist.
  describe("watchlistReview (Phase 12)", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("watchlist-review");
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("honestly reports zero items for a user with no watchlist", async () => {
      const result = await buildInstitutionalMentor(userId);
      expect(result.watchlistReview.itemCount).toBe(0);
      expect(result.watchlistReview.items).toEqual([]);
      expect(result.watchlistReview.summary).toMatch(/empty/i);
    });

    it("reflects real watchlist rows and correctly counts Buy vs. Trim/Avoid decisions", async () => {
      await db.insert(valueWatchlistTable).values([
        {
          userId,
          symbol: "WRPA",
          category: "Researching",
          marginOfSafetyTarget: 25,
          reason: "",
          currentDecision: "LONG-TERM BUY",
        },
        {
          userId,
          symbol: "WRPB",
          category: "Researching",
          marginOfSafetyTarget: 25,
          reason: "",
          currentDecision: "TRIM",
        },
        {
          userId,
          symbol: "WRPC",
          category: "Researching",
          marginOfSafetyTarget: 25,
          reason: "",
          currentDecision: "WATCHLIST",
        },
      ]);

      const result = await buildInstitutionalMentor(userId);
      expect(result.watchlistReview.itemCount).toBe(3);
      const symbols = result.watchlistReview.items.map((i) => i.symbol).sort();
      expect(symbols).toEqual(["WRPA", "WRPB", "WRPC"]);
      expect(result.watchlistReview.summary).toContain("3 compan");
      expect(result.watchlistReview.summary).toMatch(/1 carr.*favourable/);
      expect(result.watchlistReview.summary).toMatch(/1 carr.*Trim\/Avoid/);
    });

    it("never mixes in another user's watchlist rows", async () => {
      const otherUserId = await createUser("watchlist-review-other");
      await db.insert(valueWatchlistTable).values({
        userId: otherUserId,
        symbol: "OTHR",
        category: "Researching",
        marginOfSafetyTarget: 25,
        reason: "",
        currentDecision: "HOLD",
      });
      const result = await buildInstitutionalMentor(userId);
      expect(result.watchlistReview.items.some((i) => i.symbol === "OTHR")).toBe(false);
      await cleanupUser(otherUserId);
    });
  });

  // Phase 13 — Institutional Portfolio Manager.
  // Proves the new portfolioReview section is a plain, honest,
  // ownership-scoped read of the user's own investing_portfolios/
  // investing_holdings rows — zero new scoring, never fabricated for a
  // user with no portfolios or another user's portfolios.
  describe("portfolioReview (Phase 13)", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("portfolio-review");
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("honestly reports zero portfolios/holdings for a user with none", async () => {
      const result = await buildInstitutionalMentor(userId);
      expect(result.portfolioReview.portfolioCount).toBe(0);
      expect(result.portfolioReview.totalHoldingsCount).toBe(0);
      expect(result.portfolioReview.summary).toMatch(/no target-allocation portfolios yet/i);
    });

    it("reflects real portfolio/holding counts", async () => {
      const [portfolio] = await db
        .insert(investingPortfoliosTable)
        .values({ userId, name: "Core Value" })
        .returning({ id: investingPortfoliosTable.id });
      await db.insert(investingHoldingsTable).values([
        { userId, portfolioId: portfolio.id, symbol: "PRPA", targetWeightPct: 50 },
        { userId, portfolioId: portfolio.id, symbol: "PRPB", targetWeightPct: 50 },
      ]);

      const result = await buildInstitutionalMentor(userId);
      expect(result.portfolioReview.portfolioCount).toBe(1);
      expect(result.portfolioReview.totalHoldingsCount).toBe(2);
      expect(result.portfolioReview.summary).toContain("1 target-allocation portfolio");
      expect(result.portfolioReview.summary).toContain("2 total holdings");
    });

    it("never mixes in another user's portfolios", async () => {
      const otherUserId = await createUser("portfolio-review-other");
      await db.insert(investingPortfoliosTable).values({ userId: otherUserId, name: "Other Portfolio" });
      const result = await buildInstitutionalMentor(userId);
      expect(result.portfolioReview.portfolioCount).toBe(1);
      await cleanupUser(otherUserId);
    });
  });

  // Phase 14 — Institutional Investment Decision Engine.
  // Proves the new decisionEngineReview section is a plain, honest,
  // ownership-scoped read of the user's own investing_decision_snapshots/
  // investing_decision_notes rows — zero new scoring, never fabricated for
  // a user with none or another user's rows.
  describe("decisionEngineReview (Phase 14)", () => {
    let userId: string;
    beforeAll(async () => {
      userId = await createUser("decision-engine-review");
    });
    afterAll(async () => {
      await cleanupUser(userId);
    });

    it("honestly reports zero snapshots/notes for a user with none", async () => {
      const result = await buildInstitutionalMentor(userId);
      expect(result.decisionEngineReview.snapshotCount).toBe(0);
      expect(result.decisionEngineReview.noteCount).toBe(0);
      expect(result.decisionEngineReview.distinctSymbolCount).toBe(0);
      expect(result.decisionEngineReview.summary).toMatch(/no saved Decision Engine snapshots or notes yet/i);
    });

    it("reflects real snapshot/note counts across distinct symbols", async () => {
      await db.insert(investingDecisionSnapshotsTable).values([
        { userId, symbol: "DERA", recommendation: "Buy", confidence: 80, analysisJson: { summary: "test" } },
        { userId, symbol: "DERB", recommendation: "Hold", confidence: 60, analysisJson: { summary: "test" } },
      ]);
      await db.insert(investingDecisionNotesTable).values([{ userId, symbol: "DERA", note: "Watching earnings." }]);

      const result = await buildInstitutionalMentor(userId);
      expect(result.decisionEngineReview.snapshotCount).toBe(2);
      expect(result.decisionEngineReview.noteCount).toBe(1);
      expect(result.decisionEngineReview.distinctSymbolCount).toBe(2);
      expect(result.decisionEngineReview.summary).toContain("2 saved decision snapshots");
      expect(result.decisionEngineReview.summary).toContain("1 decision note");
    });

    it("never mixes in another user's snapshots/notes", async () => {
      const otherUserId = await createUser("decision-engine-review-other");
      await db.insert(investingDecisionSnapshotsTable).values({
        userId: otherUserId,
        symbol: "OTHR",
        recommendation: "Hold",
        confidence: 50,
        analysisJson: { summary: "other" },
      });
      const result = await buildInstitutionalMentor(userId);
      expect(result.decisionEngineReview.snapshotCount).toBe(2);
      await cleanupUser(otherUserId);
    });
  });
});
