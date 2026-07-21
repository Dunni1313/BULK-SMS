// Phase 41 — Institutional Portfolio Rebalancing & Allocation Planning
// Engine. Frontend smoke tests, following the established mocked-
// generated-hook pattern (DecisionSupportEngine.test.tsx for the plain
// GET dashboard hook; Backtest.test.tsx for the useMutation-based Planner
// hook).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const proposeMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false, isError: false }));
const mockState = vi.hoisted(() => ({
  dashboardData: undefined as unknown,
  dashboardLoading: false,
  dashboardError: false,
  coachData: undefined as unknown,
  coachLoading: false,
  learningData: undefined as unknown,
  learningLoading: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetRebalancingDashboard: () => ({ data: mockState.dashboardData, isLoading: mockState.dashboardLoading, isError: mockState.dashboardError }),
    useProposeAllocation: () => proposeMock,
    useListRebalancingCoachTopics: () => ({ data: mockState.coachData, isLoading: mockState.coachLoading }),
    useListRebalancingLearning: () => ({ data: mockState.learningData, isLoading: mockState.learningLoading }),
  };
});

import RebalancingEngine from "./RebalancingEngine";

function holding(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    symbol: "AAPL",
    targetWeightPct: 60,
    shares: 10,
    avgCostBasis: 100,
    notes: "",
    currentPrice: 150,
    marketValue: 1500,
    actualWeightPct: 65,
    driftPct: 5,
    rebalanceAction: "hold",
    sector: "Technology",
    beta: 1.1,
    industry: "Consumer Electronics",
    marketCap: 3000000000000,
    ...over,
  };
}

function dashboard(overrides: Record<string, unknown> = {}) {
  return {
    portfolios: [
      {
        portfolioId: 1,
        portfolioName: "Core Holdings",
        allocation: {
          holdings: [holding()],
          totalMarketValue: 1500,
          totalTargetWeightPct: 60,
          targetWeightSumWarning: null,
          unresolvedSymbols: [],
          summary: "1 holding, total market value 1500.00. 0 holdings drifted more than 5pp from target.",
        },
      },
    ],
    crossEngineCapitalAllocation: [{ label: "Investing Market Value", value: 1500 }],
    crossEngineBuyingPowerOverview: [],
    crossEngineSectorAllocation: [{ engine: "investing", sector: "Technology", weightPct: 65 }],
    crossEngineStrategyAllocation: [],
    crossEngineAssetAllocation: { investingHoldingsCount: 1, investingPortfolioCount: 1, tradingOpenPositionsCount: 0, optionsOpenPositionsCount: 0 },
    allocationTimeline: [],
    targetAllocationAvailability: [
      { engine: "investing", available: true, reason: "Each Investing holding stores its own target weight." },
      { engine: "trading", available: false, reason: "Trading positions carry no stored target-weight field." },
      { engine: "options", available: false, reason: "Options trades carry no stored target-weight field." },
    ],
    summary: "1 Investing portfolio(s) with target weights on record. 0 holding(s) drifted more than 5pp.",
    generatedAt: "2026-07-21T00:00:00.000Z",
    ...overrides,
  };
}

describe("RebalancingEngine", () => {
  beforeEach(() => {
    mockState.dashboardData = undefined;
    mockState.dashboardLoading = false;
    mockState.dashboardError = false;
    mockState.coachData = undefined;
    mockState.coachLoading = false;
    mockState.learningData = undefined;
    mockState.learningLoading = false;
    proposeMock.mutate.mockReset();
    proposeMock.isPending = false;
    proposeMock.isError = false;
  });

  it("renders the page header and disclosure labels", () => {
    renderWithClient(<RebalancingEngine />);
    expect(screen.getByText("Institutional Portfolio Rebalancing & Allocation Planning Engine")).toBeInTheDocument();
    expect(screen.getByTestId("rebalancing-labels")).toBeInTheDocument();
  });

  it("shows a loading skeleton while the dashboard is loading", () => {
    mockState.dashboardLoading = true;
    renderWithClient(<RebalancingEngine />);
    expect(screen.queryByTestId("panel-re-portfolios")).not.toBeInTheDocument();
  });

  it("shows an honest error message if the dashboard fails to load", () => {
    mockState.dashboardError = true;
    renderWithClient(<RebalancingEngine />);
    expect(screen.getByTestId("rebalancing-dashboard-error")).toBeInTheDocument();
  });

  it("shows an honest empty-portfolios message when there are no Investing portfolios", () => {
    mockState.dashboardData = dashboard({ portfolios: [] });
    renderWithClient(<RebalancingEngine />);
    expect(screen.getByTestId("rebalancing-portfolios-empty")).toBeInTheDocument();
  });

  it("renders Current vs. Target Allocation with real current/target/drift and a rebalance-action badge, never fabricated", () => {
    mockState.dashboardData = dashboard();
    renderWithClient(<RebalancingEngine />);
    const row = screen.getByTestId("holding-1-AAPL");
    expect(row).toHaveTextContent("current 65%");
    expect(row).toHaveTextContent("target 60%");
    expect(row).toHaveTextContent("+5pp");
    expect(row).toHaveTextContent("hold");
  });

  it("renders Sector Allocation reused from the Risk & Exposure Engine", () => {
    mockState.dashboardData = dashboard();
    renderWithClient(<RebalancingEngine />);
    expect(screen.getByTestId("panel-re-sector-allocation")).toHaveTextContent("Technology");
    expect(screen.getByTestId("panel-re-sector-allocation")).toHaveTextContent("65.0%");
  });

  it("honestly discloses Trading/Options target-allocation unavailability, never approximated", () => {
    mockState.dashboardData = dashboard();
    renderWithClient(<RebalancingEngine />);
    expect(screen.getByTestId("availability-investing")).toHaveTextContent("available");
    expect(screen.getByTestId("availability-trading")).toHaveTextContent("unavailable");
    expect(screen.getByTestId("availability-options")).toHaveTextContent("unavailable");
  });

  it("Rebalancing Planner: selecting a portfolio, editing a target weight, and comparing submits the correct payload and renders the result, never a suggested trade", async () => {
    mockState.dashboardData = dashboard();
    const comparisonResult = {
      portfolioId: 1,
      current: { holdings: [], totalMarketValue: 1500, totalTargetWeightPct: 60, targetWeightSumWarning: null, unresolvedSymbols: [], summary: "" },
      proposed: { holdings: [], totalMarketValue: 1500, totalTargetWeightPct: 50, targetWeightSumWarning: null, unresolvedSymbols: [], summary: "" },
      rows: [
        {
          symbol: "AAPL",
          currentWeightPct: 65,
          storedTargetWeightPct: 60,
          proposedTargetWeightPct: 50,
          driftFromProposedPct: 15,
          capitalMovementDollars: -225,
          rebalanceActionVsProposed: "sell",
        },
      ],
      totalCapitalToDeployDollars: 0,
      totalCapitalToRaiseDollars: 225,
      summary: "1 of 1 holding(s) would drift more than 5pp from the proposed target weights.",
    };
    proposeMock.mutate.mockImplementation((_vars: unknown, opts: { onSuccess: (r: unknown) => void }) => opts.onSuccess(comparisonResult));

    const user = userEvent.setup();
    renderWithClient(<RebalancingEngine />);
    await user.click(screen.getByTestId("tab-re-planner"));
    await user.click(screen.getByTestId("planner-portfolio-select"));
    await user.click(await screen.findByText("Core Holdings"));

    const targetInput = screen.getByTestId("planner-target-AAPL");
    await user.clear(targetInput);
    await user.type(targetInput, "50");
    await user.click(screen.getByTestId("planner-compare-btn"));

    expect(proposeMock.mutate).toHaveBeenCalledWith({ id: 1, data: { targets: [{ symbol: "AAPL", targetWeightPct: 50 }] } }, expect.anything());

    const result = screen.getByTestId("planner-comparison-result");
    expect(result).toHaveTextContent("would drift more than 5pp");
    expect(screen.getByTestId("comparison-row-AAPL")).toHaveTextContent("sell");
    expect(screen.getByTestId("comparison-row-AAPL")).toHaveTextContent("$-225");
    // Never a suggested share count or execution language anywhere in the
    // rendered comparison.
    expect(result.textContent?.toLowerCase()).not.toMatch(/buy \d+ shares|sell \d+ shares|place an order/);
  });

  it("renders the Coach & Learning tab with real topics and Learning Centre links, never a trade recommendation", async () => {
    const user = userEvent.setup();
    mockState.coachData = [{ topic: "rebalancing_concepts", title: "Rebalancing Concepts", explanation: ["Real explanation text."], disclaimer: "Educational only." }];
    mockState.learningData = [{ topic: "diversification", links: [{ pathKey: "portfolio", topicKey: "portfolio-diversification", title: "Portfolio Diversification", summary: "Summary.", href: "/learn/paths/portfolio/portfolio-diversification" }] }];
    renderWithClient(<RebalancingEngine />);
    await user.click(screen.getByTestId("tab-re-learning"));
    expect(screen.getByTestId("re-coach-topic-rebalancing_concepts")).toBeInTheDocument();
    expect(screen.getByTestId("re-learning-topic-diversification")).toBeInTheDocument();
    expect(screen.getByTestId("re-learning-link-portfolio-portfolio-diversification")).toBeInTheDocument();
  });

  it("renders the Reporting tab with a deep link to the Portfolio Allocation Report", async () => {
    const user = userEvent.setup();
    mockState.dashboardData = dashboard();
    renderWithClient(<RebalancingEngine />);
    await user.click(screen.getByTestId("tab-re-reporting"));
    expect(screen.getByTestId("link-report-portfolio-allocation-report")).toHaveAttribute("href", "/reporting-centre?reportType=portfolio-allocation-report");
    expect(screen.getByTestId("link-reporting-centre")).toHaveAttribute("href", "/reporting-centre");
  });
});
