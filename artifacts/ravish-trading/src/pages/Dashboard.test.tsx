// Phase 6, Sprint 72 — Frontend Legacy Page Test Coverage, Slice 2.
// Following the established mocked-generated-hook pattern. This page has
// no single loading gate — each section independently reflects its own
// hook's data (undefined = loading/skeleton, per-hook honest empty state,
// or real data) — mirroring the InstitutionalDashboard.test.tsx/
// TradingResearch.test.tsx precedent of many independent hooks on one page.
// TickerTape's internal setInterval(1800ms) is cleaned up on unmount and
// never advanced in these tests, so it needs no special handling.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const setLocationMock = vi.hoisted(() => vi.fn());
const mockState = vi.hoisted(() => ({
  summary: undefined as unknown,
  summaryLoading: false,
  topOpps: undefined as unknown,
  oppsLoading: false,
  scannerData: undefined as unknown,
  risk: undefined as unknown,
  theta: undefined as unknown,
  health: undefined as unknown,
  earnings: undefined as unknown,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetPortfolioSummary: () => ({ data: mockState.summary, isLoading: mockState.summaryLoading }),
    useGetTopOpportunities: () => ({ data: mockState.topOpps, isLoading: mockState.oppsLoading }),
    useGetScannerResults: () => ({ data: mockState.scannerData }),
    useGetRiskStatus: () => ({ data: mockState.risk }),
    useGetThetaIncome: () => ({ data: mockState.theta }),
    useGetMarketDataHealth: () => ({ data: mockState.health }),
    useGetEarningsScan: () => ({ data: mockState.earnings }),
  };
});

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useLocation: () => ["/", setLocationMock],
  };
});

import Dashboard from "./Dashboard";

function opp(over: Record<string, unknown> = {}) {
  return {
    id: 101,
    symbol: "AAPL",
    ravishScore: 88,
    ravishTier: "elite",
    ev: 45,
    pop: 82.5,
    theta: 3.2,
    strategy: "iron_condor",
    eventRiskLevel: "none",
    eventRiskPenalty: null,
    eventRiskEvents: [],
    ...over,
  };
}

describe("Dashboard page", () => {
  beforeEach(() => {
    mockState.summary = undefined;
    mockState.summaryLoading = true;
    mockState.topOpps = undefined;
    mockState.oppsLoading = true;
    mockState.scannerData = undefined;
    mockState.risk = undefined;
    mockState.theta = undefined;
    mockState.health = undefined;
    mockState.earnings = undefined;
    setLocationMock.mockReset();
  });

  it("shows loading skeletons and honest '—' risk fields before any data resolves", () => {
    renderWithClient(<Dashboard />);
    expect(screen.getByText("Symbol Heat Map")).toBeInTheDocument();
    expect(screen.getByText("Theta Income Engine")).toBeInTheDocument();
    expect(screen.getByText("Market Data Health")).toBeInTheDocument();
    // Risk status bar honestly reads "—" for every field when risk is undefined.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(5);
  });

  it("renders real KPI values once the portfolio summary resolves", () => {
    mockState.summary = { accountValue: 25000, dayPnl: 340.5, buyingPower: 12000, openPositions: 3 };
    mockState.summaryLoading = false;
    renderWithClient(<Dashboard />);
    expect(screen.getByText("$25,000.00")).toBeInTheDocument();
    expect(screen.getByText("+$340.50")).toBeInTheDocument();
    expect(screen.getByText("$12,000.00")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders the Top Pick hero for a real top opportunity and navigates on Review", async () => {
    mockState.topOpps = { ironCondors: [opp()], ironFlys: [], calendarSpreads: [], earnings: [] };
    mockState.oppsLoading = false;
    renderWithClient(<Dashboard />);
    expect(screen.getByText("Today's Top Pick")).toBeInTheDocument();
    // "88" legitimately renders 3 times — the hero's own ScoreRing gauge,
    // the hero's large "Ravish Score" figure, and the same opportunity's
    // own ScoreRing in the "Top Iron Condors" panel below (it's the sole
    // ironCondors entry) — all reading off the identical real ravishScore.
    expect(screen.getAllByText("88").length).toBe(3);
    await userEvent.click(screen.getByTestId("button-review-top-pick"));
    expect(setLocationMock).toHaveBeenCalledWith("/ticket/101");
  });

  it("shows an honest empty theta message when there is no open-position income yet", () => {
    mockState.theta = { daily: 0, weekly: 0, monthly: 0, annualized: 0, byStrategy: [] };
    renderWithClient(<Dashboard />);
    expect(screen.getByText("No open positions generating theta yet.")).toBeInTheDocument();
  });

  it("renders real theta figures and the by-strategy breakdown", () => {
    mockState.theta = {
      daily: 42,
      weekly: 294,
      monthly: 1260,
      annualized: 15330,
      byStrategy: [{ key: "iron_condor", theta: 30 }],
    };
    renderWithClient(<Dashboard />);
    expect(screen.getByText("$42")).toBeInTheDocument();
    expect(screen.getByText("$1,260")).toBeInTheDocument();
    expect(screen.getByText("iron condor")).toBeInTheDocument();
  });

  it("renders real market data health, including the fallback-provider warning", () => {
    mockState.health = {
      connected: true,
      provider: "simulated",
      requestedProvider: "alpaca",
      mode: "live",
      reason: "Alpaca unavailable",
      symbolsScanned: 50,
      contractsScanned: 400,
      rejectedByLiquidity: 10,
      rejectedByRisk: 5,
      positiveEvFound: 12,
    };
    renderWithClient(<Dashboard />);
    expect(screen.getByText("SIMULATED · LIVE")).toBeInTheDocument();
    expect(screen.getByText(/Requested ALPACA → fell back to SIMULATED/)).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
  });

  it("renders real risk status bar values when risk data resolves", () => {
    mockState.risk = {
      withinLimits: true,
      portfolioRiskDollars: 1200,
      portfolioRiskUsedPct: 24,
      maxPortfolioRiskPct: 50,
      openTrades: 4,
      stopLossMultiplier: 2,
      profitTargets: [50, 75],
    };
    renderWithClient(<Dashboard />);
    expect(screen.getByText("Risk Within Limits")).toBeInTheDocument();
    expect(screen.getByText("$1,200")).toBeInTheDocument();
    expect(screen.getByText("24.0% / 50%")).toBeInTheDocument();
  });

  it("navigates to the trade ticket from a Top Iron Condors panel Review button", async () => {
    mockState.topOpps = { ironCondors: [opp({ id: 202 })], ironFlys: [], calendarSpreads: [], earnings: [] };
    mockState.oppsLoading = false;
    renderWithClient(<Dashboard />);
    const buttons = screen.getAllByTestId("button-review-202");
    await userEvent.click(buttons[buttons.length - 1]);
    expect(setLocationMock).toHaveBeenCalledWith("/ticket/202");
  });

  it("shows an honest empty message when there are no near-term earnings events", () => {
    mockState.earnings = [];
    renderWithClient(<Dashboard />);
    expect(screen.getByText("No near-term earnings events with tradeable IV.")).toBeInTheDocument();
  });

  it("renders real earnings-engine cards once resolved", () => {
    mockState.earnings = [
      {
        symbol: "NVDA",
        daysToEarnings: 5,
        recommendedStrategy: "iron_condor",
        expectedMovePct: 7.2,
        ivRank: 88,
        ivCrushPotentialPct: 45,
        rationale: "Elevated IV ahead of earnings with strong historical crush.",
      },
    ];
    renderWithClient(<Dashboard />);
    // "NVDA" also appears in the purely-decorative TickerTape's own fake
    // symbol list, so this only asserts fields unique to the real earnings
    // card itself.
    expect(screen.getByText("5d to ER")).toBeInTheDocument();
    expect(screen.getByText("±7.2%")).toBeInTheDocument();
    expect(screen.getByText("Elevated IV ahead of earnings with strong historical crush.")).toBeInTheDocument();
  });
});
