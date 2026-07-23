// Phase 37 — Institutional Risk & Exposure Intelligence Engine. Frontend
// smoke tests, following the established mocked-generated-hook pattern
// (OptionsLifecycleManager.test.tsx).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  dashboardData: undefined as unknown,
  dashboardLoading: false,
  coachData: undefined as unknown,
  coachLoading: false,
  learningData: undefined as unknown,
  learningLoading: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetRiskExposureDashboard: () => ({ data: mockState.dashboardData, isLoading: mockState.dashboardLoading }),
    useListRiskExposureCoachTopics: () => ({ data: mockState.coachData, isLoading: mockState.coachLoading }),
    useListRiskExposureLearning: () => ({ data: mockState.learningData, isLoading: mockState.learningLoading }),
  };
});

import RiskExposureEngine from "./RiskExposureEngine";

function emptyDashboard(overrides: Record<string, unknown> = {}) {
  return {
    investing: {
      portfolioCount: 0,
      holdingsCount: 0,
      risk: { overall: { score: null, label: "Insufficient Data", detail: "No holdings on record yet." }, concentration: {}, sectorExposure: { breakdown: [] }, betaEstimate: {}, components: [], totalMarketValue: null, unresolvedSymbols: [] },
      allocationBySymbol: [],
    },
    trading: {
      openPositionsCount: 0,
      accountValue: null,
      risk: {
        overall: { score: null, label: "Insufficient Data", detail: "No open positions." },
        positionSizing: { detail: "No open positions." },
        stopDiscipline: { detail: "No open positions." },
        portfolioBudget: { detail: "No open positions." },
        components: [],
        accountValue: null,
        openPositionsCount: 0,
        positionContexts: [],
      },
    },
    options: {
      dashboard: {
        portfolioValue: 0,
        buyingPower: 0,
        totalRiskDollars: 0,
        totalRiskPct: 0,
        healthScore: 0,
        overallRiskRating: { code: "healthy", label: "Healthy" },
        openPositionsCount: 0,
        netGreeks: { delta: 0, gamma: 0, theta: 0, vega: 0 },
        allocationBySymbol: [],
        allocationBySector: [],
        allocationByStrategy: [],
        expirationDistribution: [],
      },
      portfolioManagement: {
        incomeAllocation: { bySymbol: [], byStrategy: [], strategyMix: [] },
        exposureTimeline: [],
        lifecycleSummary: { totalPositions: 0, byStage: [], positionsAwaitingReview: 0 },
      },
    },
    combined: {
      capitalAllocation: [
        { engine: "investing", label: "Investing (market value)", value: null },
        { engine: "trading", label: "Trading (account value)", value: null },
        { engine: "options", label: "Options (portfolio value)", value: 0 },
      ],
      buyingPowerOverview: [
        { engine: "trading", label: "Trading account value", value: null },
        { engine: "options", label: "Options buying power", value: 0 },
      ],
      sectorConcentration: [],
      strategyConcentration: [],
      assetAllocation: { investingHoldingsCount: 0, investingPortfolioCount: 0, tradingOpenPositionsCount: 0, optionsOpenPositionsCount: 0 },
      greeksSummary: { delta: 0, gamma: 0, theta: 0, vega: 0 },
      correlationOverview: { overlaps: [], overlapSymbolCount: 0, note: "A deterministic cross-engine symbol-overlap read, never a fabricated correlation coefficient." },
      concentrationTimeline: [],
    },
    generatedAt: "2026-07-21T00:00:00.000Z",
    ...overrides,
  };
}

describe("RiskExposureEngine", () => {
  beforeEach(() => {
    mockState.dashboardData = undefined;
    mockState.dashboardLoading = false;
    mockState.coachData = undefined;
    mockState.coachLoading = false;
    mockState.learningData = undefined;
    mockState.learningLoading = false;
  });

  it("renders the page header and disclosure labels", () => {
    mockState.dashboardData = emptyDashboard();
    renderWithClient(<RiskExposureEngine />);
    expect(screen.getByText("Institutional Risk & Exposure Intelligence Engine")).toBeInTheDocument();
    expect(screen.getByTestId("risk-exposure-engine-labels")).toBeInTheDocument();
  });

  it("shows an honest empty Combined view when there is no data across any engine", () => {
    mockState.dashboardData = emptyDashboard();
    renderWithClient(<RiskExposureEngine />);
    expect(screen.getByTestId("panel-ree-combined")).toBeInTheDocument();
    expect(screen.getByTestId("correlation-overview-empty")).toBeInTheDocument();
  });

  it("switches to the Investing view and shows real, non-fabricated holdings", async () => {
    const user = userEvent.setup();
    mockState.dashboardData = emptyDashboard({
      investing: {
        portfolioCount: 1,
        holdingsCount: 2,
        risk: { overall: { score: 62, label: "Moderate", detail: "Real detail text." }, concentration: {}, sectorExposure: { breakdown: [] }, betaEstimate: {}, components: [], totalMarketValue: 15000, unresolvedSymbols: [] },
        allocationBySymbol: [
          { symbol: "AAPL", marketValue: 9000, weightPct: 60 },
          { symbol: "SPY", marketValue: 6000, weightPct: 40 },
        ],
      },
    });
    renderWithClient(<RiskExposureEngine />);
    await user.click(screen.getByTestId("risk-view-select"));
    await user.click(screen.getByTestId("risk-view-option-investing"));
    expect(screen.getByTestId("panel-ree-investing")).toBeInTheDocument();
    expect(screen.getByTestId("investing-symbol-AAPL")).toBeInTheDocument();
    expect(screen.getByTestId("investing-symbol-SPY")).toBeInTheDocument();
    expect(screen.getByText("Moderate")).toBeInTheDocument();
  });

  it("real cross-engine overlap surfaces a symbol held in more than one engine, never fabricated", () => {
    mockState.dashboardData = emptyDashboard({
      combined: {
        ...emptyDashboard().combined,
        correlationOverview: {
          overlaps: [{ symbol: "AAPL", engines: ["investing", "options", "trading"] }],
          overlapSymbolCount: 1,
          note: "A deterministic cross-engine symbol-overlap read, never a fabricated correlation coefficient.",
        },
      },
    });
    renderWithClient(<RiskExposureEngine />);
    expect(screen.getByTestId("correlation-overlap-AAPL")).toBeInTheDocument();
    expect(screen.getByText("investing, options, trading")).toBeInTheDocument();
    expect(screen.queryByTestId("correlation-overview-empty")).not.toBeInTheDocument();
  });

  it("renders the Coach & Learning tab with real topics and Learning Centre links, never a trade recommendation", async () => {
    const user = userEvent.setup();
    mockState.dashboardData = emptyDashboard();
    mockState.coachData = [{ topic: "risk", title: "Risk, Across Every Engine", explanation: ["Real explanation text."], disclaimer: "Educational only." }];
    mockState.learningData = [{ topic: "risk", links: [{ pathKey: "trading-engine", topicKey: "trading-risk-management", category: "risk", title: "Risk Management", summary: "Summary.", href: "/learn/paths/trading-engine/trading-risk-management" }] }];
    renderWithClient(<RiskExposureEngine />);
    await user.click(screen.getByTestId("tab-ree-learning"));
    expect(screen.getByTestId("coach-topic-risk")).toBeInTheDocument();
    expect(screen.getByTestId("learning-topic-risk")).toBeInTheDocument();
    expect(screen.getByTestId("learning-link-trading-engine-trading-risk-management")).toBeInTheDocument();
  });

  it("renders the Reporting tab with deep links to the Institutional Reporting Centre", async () => {
    const user = userEvent.setup();
    mockState.dashboardData = emptyDashboard();
    renderWithClient(<RiskExposureEngine />);
    await user.click(screen.getByTestId("tab-ree-reporting"));
    expect(screen.getByTestId("link-report-risk-exposure-summary")).toHaveAttribute("href", "/reporting-centre?reportType=risk-exposure-summary");
    expect(screen.getByTestId("link-report-portfolio-concentration-report")).toHaveAttribute("href", "/reporting-centre?reportType=portfolio-concentration-report");
  });
});
