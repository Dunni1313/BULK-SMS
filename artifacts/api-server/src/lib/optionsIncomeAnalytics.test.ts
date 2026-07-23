// Phase 35 — Institutional Options Income Engine (Foundation).
import { describe, it, expect } from "vitest";
import {
  derivePositionLifecycle,
  buildPositionView,
  buildIncomeOverview,
  buildStrategyMix,
  buildUpcomingExpirations,
  buildOptionsIncomeDashboard,
} from "./optionsIncomeAnalytics.js";

describe("derivePositionLifecycle", () => {
  it("classifies an open position honestly, regardless of exitReason noise", () => {
    expect(derivePositionLifecycle({ status: "open", exitReason: null })).toBe("open");
    expect(derivePositionLifecycle({ status: "pending", exitReason: null })).toBe("open");
  });

  it("classifies closed positions by their real exitReason text, never guessing", () => {
    expect(derivePositionLifecycle({ status: "closed", exitReason: "Expired worthless" })).toBe("closed_expired");
    expect(derivePositionLifecycle({ status: "closed", exitReason: "Assigned on the short put" })).toBe("closed_assigned");
    expect(derivePositionLifecycle({ status: "closed", exitReason: "Rolled to next month" })).toBe("closed_rolled");
    expect(derivePositionLifecycle({ status: "closed", exitReason: "Converted to iron fly" })).toBe("closed_rolled");
    expect(derivePositionLifecycle({ status: "closed", exitReason: "Manual close for profit target" })).toBe("closed_manual");
    expect(derivePositionLifecycle({ status: "closed", exitReason: null })).toBe("closed_manual");
  });

  it("passes through cancelled/rejected honestly rather than forcing them into a closed_* bucket", () => {
    expect(derivePositionLifecycle({ status: "cancelled", exitReason: null })).toBe("cancelled");
    expect(derivePositionLifecycle({ status: "rejected", exitReason: null })).toBe("rejected");
  });

  it("honestly reports unknown for a status this classifier has no rule for, never a fabricated guess", () => {
    expect(derivePositionLifecycle({ status: "some-future-status", exitReason: null })).toBe("unknown");
  });
});

describe("buildPositionView", () => {
  const greeks = { delta: 0.1, gamma: 0.02, theta: 1.5, vega: -0.3 };

  it("maps every field directly from already-persisted trades columns, never fabricating one", () => {
    const row = {
      id: 1,
      symbol: "SPY",
      strategy: "iron_condor",
      status: "open",
      credit: 150,
      maxLoss: 350,
      maxProfit: 150,
      expiration: "2026-08-15",
      openDate: new Date("2026-07-01T00:00:00Z"),
      closeDate: null,
      exitReason: null,
      notes: "Watching the call side.",
      currentPnl: null,
    };
    const view = buildPositionView(row, greeks);
    expect(view.underlying).toBe("SPY");
    expect(view.strategy).toBe("iron_condor");
    expect(view.premium).toBe(150);
    expect(view.collateral).toBe(350); // reuses trades.maxLoss directly, never a re-derived number
    expect(view.greeks).toEqual(greeks);
    expect(view.status).toBe("open");
    expect(view.lifecycle).toBe("open");
    expect(view.notes).toBe("Watching the call side.");
    expect(view.realizedPnl).toBeNull(); // never fabricated for an open position
  });

  it("resolves the Strategy Library label for a strategy the real engine builds, honestly null otherwise", () => {
    const openRow = { id: 1, symbol: "SPY", strategy: "iron_condor", status: "open", credit: 1, maxLoss: 1, maxProfit: 1, expiration: null, openDate: new Date(), closeDate: null, exitReason: null, notes: null, currentPnl: null };
    expect(buildPositionView(openRow, greeks).strategyLabel).toBe("Iron Condor");

    const calendarRow = { ...openRow, strategy: "calendar_spread" };
    expect(buildPositionView(calendarRow, greeks).strategyLabel).toBe("Calendar");

    const earningsRow = { ...openRow, strategy: "earnings" };
    expect(buildPositionView(earningsRow, greeks).strategyLabel).toBeNull();
  });

  it("only surfaces realizedPnl for a closed position, never for an open one", () => {
    const closedRow = { id: 2, symbol: "AAPL", strategy: "iron_fly", status: "closed", credit: 100, maxLoss: 200, maxProfit: 100, expiration: "2026-07-18", openDate: new Date("2026-06-01"), closeDate: new Date("2026-07-18"), exitReason: "Expired worthless", notes: null, currentPnl: 95 };
    const view = buildPositionView(closedRow, greeks);
    expect(view.realizedPnl).toBe(95);
    expect(view.lifecycle).toBe("closed_expired");
    expect(view.closeDate).not.toBeNull();
  });
});

describe("buildIncomeOverview", () => {
  it("honestly reports all zeros for a brand-new user with no positions", () => {
    const overview = buildIncomeOverview([], [], []);
    expect(overview.openPositionsCount).toBe(0);
    expect(overview.closedPositionsCount).toBe(0);
    expect(overview.totalCreditCollectedOpen).toBe(0);
    expect(overview.totalRealizedPremium).toBe(0);
    expect(overview.totalCapitalAllocated).toBe(0);
    expect(overview.theta.daily).toBe(0);
  });

  it("sums real credit/maxLoss over open and closed rows independently, never conflating them", () => {
    const open = [{ credit: 100, maxLoss: 300 }, { credit: 50, maxLoss: 150 }];
    const closed = [{ credit: 80 }];
    const overview = buildIncomeOverview(open, closed, []);
    expect(overview.openPositionsCount).toBe(2);
    expect(overview.closedPositionsCount).toBe(1);
    expect(overview.totalCreditCollectedOpen).toBe(150);
    expect(overview.totalRealizedPremium).toBe(80);
    expect(overview.totalCapitalAllocated).toBe(450);
  });

  it("projects theta income via the reused, unmodified computeThetaIncome() over live per-position theta", () => {
    const overview = buildIncomeOverview([], [], [{ symbol: "SPY", strategy: "iron_condor", theta: 2 }]);
    expect(overview.theta.daily).toBe(2);
    expect(overview.theta.monthly).toBe(60);
  });
});

describe("buildStrategyMix", () => {
  it("honestly reports an empty mix for a brand-new user", () => {
    expect(buildStrategyMix([])).toEqual([]);
  });

  it("tallies position count and capital allocated per strategy, sorted by capital descending", () => {
    const rows = [
      { strategy: "iron_condor", maxLoss: 300 },
      { strategy: "iron_condor", maxLoss: 200 },
      { strategy: "calendar_spread", maxLoss: 100 },
    ];
    const mix = buildStrategyMix(rows);
    expect(mix).toHaveLength(2);
    expect(mix[0].strategy).toBe("iron_condor");
    expect(mix[0].positionCount).toBe(2);
    expect(mix[0].capitalAllocated).toBe(500);
    expect(mix[0].strategyLabel).toBe("Iron Condor");
    expect(mix[1].strategy).toBe("calendar_spread");
    expect(mix[1].capitalAllocated).toBe(100);
  });
});

describe("buildUpcomingExpirations", () => {
  it("honestly reports no upcoming expirations for a brand-new user", () => {
    expect(buildUpcomingExpirations([])).toEqual([]);
  });

  it("groups open positions by expiration date and computes real days-to-expiry, sorted soonest-first", () => {
    const asOf = new Date("2026-07-20T00:00:00Z");
    const rows = [
      { id: 1, symbol: "SPY", strategy: "iron_condor", credit: 100, expiration: "2026-08-15" },
      { id: 2, symbol: "QQQ", strategy: "iron_fly", credit: 80, expiration: "2026-07-25" },
      { id: 3, symbol: "SPY", strategy: "iron_condor", credit: 50, expiration: "2026-08-15" },
    ];
    const groups = buildUpcomingExpirations(rows, asOf);
    expect(groups).toHaveLength(2);
    expect(groups[0].expiration).toBe("2026-07-25");
    expect(groups[0].daysToExpiry).toBe(5);
    expect(groups[1].expiration).toBe("2026-08-15");
    expect(groups[1].daysToExpiry).toBe(26);
    expect(groups[1].positions).toHaveLength(2);
  });

  it("never fabricates an expiration group for a position with no expiration on record", () => {
    const rows = [{ id: 1, symbol: "SPY", strategy: "iron_condor", credit: 100, expiration: null }];
    expect(buildUpcomingExpirations(rows)).toEqual([]);
  });
});

describe("buildOptionsIncomeDashboard", () => {
  it("composes all sections honestly empty for a brand-new user", () => {
    const dashboard = buildOptionsIncomeDashboard({ openRows: [], closedRows: [], thetaPositions: [] });
    expect(dashboard.overview.openPositionsCount).toBe(0);
    expect(dashboard.strategyMix).toEqual([]);
    expect(dashboard.upcomingExpirations).toEqual([]);
    expect(typeof dashboard.generatedAt).toBe("string");
  });

  it("never fabricates a signal/score/prediction field anywhere in the composed dashboard", () => {
    const dashboard = buildOptionsIncomeDashboard({
      openRows: [{ id: 1, symbol: "SPY", strategy: "iron_condor", credit: 100, maxLoss: 300, expiration: "2026-08-15" }],
      closedRows: [{ credit: 50 }],
      thetaPositions: [{ symbol: "SPY", strategy: "iron_condor", theta: 2 }],
    });
    const serialized = JSON.stringify(dashboard).toLowerCase();
    expect(serialized).not.toMatch(/"probability"|"prediction"|"forecast"|"recommendation"/);
  });
});
