// Phase 39 — Institutional Scenario & Stress Testing Engine. Frontend
// smoke tests, following the established mocked-generated-hook pattern
// (PerformanceAttributionEngine.test.tsx, PortfolioStressTest.test.tsx —
// the latter for the POST-mutation-based dashboard hook shape).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  mutate: vi.fn(),
  dashboardData: undefined as unknown,
  isPending: false,
  isError: false,
  coachData: undefined as unknown,
  coachLoading: false,
  learningData: undefined as unknown,
  learningLoading: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useRunScenarioDashboard: () => ({
      mutate: mockState.mutate,
      data: mockState.dashboardData,
      isPending: mockState.isPending,
      isError: mockState.isError,
    }),
    useListScenarioCoachTopics: () => ({ data: mockState.coachData, isLoading: mockState.coachLoading }),
    useListScenarioLearning: () => ({ data: mockState.learningData, isLoading: mockState.learningLoading }),
  };
});

import ScenarioEngine from "./ScenarioEngine";

function scenarioDef(over: Record<string, unknown> = {}) {
  return { key: "market_up_5", label: "Market +5%", category: "price", priceShockPct: 5, ivShockPct: 0, ratePointsShock: 0, ...over };
}

function emptyDashboard(overrides: Record<string, unknown> = {}) {
  return {
    scenarios: [scenarioDef()],
    investing: { portfolioCount: 0, holdingsCount: 0, baseMarketValue: null, results: [], summary: "This user has no Investing holdings on record yet." },
    trading: { openPositionsCount: 0, results: [], summary: "This user has no open Trading positions on record yet." },
    options: {
      stressTest: { available: false, inputIssues: ["No open Options positions on record."], accountValue: null, credentialsConfigured: false, brokerConnected: false, lastBrokerCheckAt: null, sectorExposure: [], base: null, riskScoreBefore: null, scenarios: [], generatedAt: "2026-07-21T00:00:00.000Z" },
      rateScenarios: [],
    },
    combined: { byEngine: [], sectorImpact: [], strategyImpact: [], assetImpact: [] },
    generatedAt: "2026-07-21T00:00:00.000Z",
    ...overrides,
  };
}

describe("ScenarioEngine", () => {
  beforeEach(() => {
    mockState.mutate = vi.fn();
    mockState.dashboardData = undefined;
    mockState.isPending = false;
    mockState.isError = false;
    mockState.coachData = undefined;
    mockState.coachLoading = false;
    mockState.learningData = undefined;
    mockState.learningLoading = false;
  });

  it("renders the page header and disclosure labels", () => {
    renderWithClient(<ScenarioEngine />);
    expect(screen.getByText("Institutional Scenario & Stress Testing Engine")).toBeInTheDocument();
    expect(screen.getByTestId("scenario-engine-labels")).toBeInTheDocument();
  });

  it("shows an honest not-yet-run message before the dashboard has been requested", () => {
    renderWithClient(<ScenarioEngine />);
    expect(screen.getByTestId("scenario-dashboard-not-run")).toBeInTheDocument();
  });

  it("submits the Run Scenario Analysis request with the default (empty) customScenarios array", async () => {
    const user = userEvent.setup();
    renderWithClient(<ScenarioEngine />);
    await user.click(screen.getByTestId("button-run-scenario-dashboard"));
    expect(mockState.mutate).toHaveBeenCalledWith({ data: { customScenarios: [] } });
  });

  it("adds a custom scenario via the Market Move Simulator and includes it in the run request", async () => {
    const user = userEvent.setup();
    renderWithClient(<ScenarioEngine />);
    await user.type(screen.getByTestId("input-custom-scenario-label"), "Flash Crash");
    await user.type(screen.getByTestId("input-custom-scenario-pct"), "-30");
    await user.click(screen.getByTestId("button-add-custom-scenario"));
    expect(screen.getByTestId("custom-scenario-0")).toHaveTextContent("Flash Crash");

    await user.click(screen.getByTestId("button-run-scenario-dashboard"));
    expect(mockState.mutate).toHaveBeenCalledWith({ data: { customScenarios: [{ label: "Flash Crash", priceShockPct: -30 }] }});
  });

  it("removes a custom scenario before running", async () => {
    const user = userEvent.setup();
    renderWithClient(<ScenarioEngine />);
    await user.type(screen.getByTestId("input-custom-scenario-pct"), "10");
    await user.click(screen.getByTestId("button-add-custom-scenario"));
    expect(screen.getByTestId("custom-scenario-0")).toBeInTheDocument();
    await user.click(screen.getByTestId("button-remove-custom-scenario-0"));
    expect(screen.queryByTestId("custom-scenario-0")).not.toBeInTheDocument();
  });

  it("shows a loading state while the dashboard mutation is pending", () => {
    mockState.isPending = true;
    renderWithClient(<ScenarioEngine />);
    expect(screen.getByText("Evaluating…")).toBeInTheDocument();
  });

  it("shows an honest error message if the dashboard mutation fails", () => {
    mockState.isError = true;
    renderWithClient(<ScenarioEngine />);
    expect(screen.getByTestId("scenario-dashboard-error")).toBeInTheDocument();
  });

  it("shows the Combined cross-engine Portfolio Impact Summary, never blended across engines", () => {
    mockState.dashboardData = emptyDashboard({
      combined: {
        byEngine: [
          { engine: "investing", scenarioKey: "market_up_5", scenarioLabel: "Market +5%", available: true, impactDollars: 150 },
          { engine: "trading", scenarioKey: "market_up_5", scenarioLabel: "Market +5%", available: true, impactDollars: 40 },
        ],
        sectorImpact: [{ scenarioKey: "market_up_5", sector: "Technology", impactDollars: 150 }],
        strategyImpact: [{ engine: "trading", scenarioKey: "market_up_5", key: "breakout", label: "breakout", impactDollars: 40 }],
        assetImpact: [{ engine: "investing", scenarioKey: "market_up_5", symbol: "AAPL", impactDollars: 150 }],
      },
    });
    renderWithClient(<ScenarioEngine />);
    expect(screen.getByTestId("panel-se-combined")).toBeInTheDocument();
    expect(screen.getByTestId("combined-by-engine-investing-0")).toHaveTextContent("+$150");
    expect(screen.getByTestId("combined-by-engine-trading-1")).toHaveTextContent("+$40");
    expect(screen.getByTestId("combined-sector-0")).toHaveTextContent("Technology");
    expect(screen.getByTestId("combined-asset-investing-0")).toHaveTextContent("AAPL");
  });

  it("switches to the Investing view and shows real, honestly-labeled scenario results, including an unavailable volatility scenario", async () => {
    const user = userEvent.setup();
    mockState.dashboardData = emptyDashboard({
      investing: {
        portfolioCount: 1,
        holdingsCount: 1,
        baseMarketValue: 1000,
        results: [
          { scenario: scenarioDef(), available: true, reason: null, totalMarketValueBefore: 1000, totalMarketValueAfter: 1050, totalImpactDollars: 50, totalImpactPct: 5, holdings: [], sectorImpact: [], assetImpact: [] },
          { scenario: scenarioDef({ key: "volatility_up", label: "Volatility Increase (+20%)", category: "volatility" }), available: false, reason: "Volatility scenarios apply to options positions via implied volatility.", totalMarketValueBefore: 1000, totalMarketValueAfter: null, totalImpactDollars: null, totalImpactPct: null, holdings: [], sectorImpact: [], assetImpact: [] },
        ],
        summary: "1 holding(s).",
      },
    });
    renderWithClient(<ScenarioEngine />);
    await user.click(screen.getByTestId("scenario-view-select"));
    await user.click(screen.getByTestId("scenario-view-option-investing"));
    expect(screen.getByTestId("panel-se-investing")).toBeInTheDocument();
    expect(screen.getByTestId("investing-scenario-market_up_5")).toHaveTextContent("+$50");
    expect(screen.getByTestId("investing-scenario-volatility_up")).toHaveTextContent(/implied volatility/i);
  });

  it("switches to the Options view and shows the reused What-If Stress Test's own Greeks/Buying Power/Capital Impact, plus interest rate scenarios", async () => {
    const user = userEvent.setup();
    mockState.dashboardData = emptyDashboard({
      options: {
        stressTest: {
          available: true,
          inputIssues: [],
          accountValue: 100000,
          credentialsConfigured: false,
          brokerConnected: false,
          lastBrokerCheckAt: null,
          sectorExposure: [],
          base: { portfolioValue: 100000, totalUnrealizedPnl: 0, greeks: { delta: -1, gamma: 0.1, theta: 5, vega: -2 }, exposureBySymbol: [], exposureByStrategy: [], totalRiskDollars: 500, totalRiskPct: 0.5, buyingPower: 99500, positions: [] },
          riskScoreBefore: 50,
          scenarios: [
            {
              label: "Market +5%",
              shock: { priceShockPct: 5, ivShockPct: 0, timeDecayDays: 0 },
              after: { portfolioValue: 100200, totalUnrealizedPnl: 200, greeks: { delta: -0.8, gamma: 0.09, theta: 4, vega: -1.8 }, exposureBySymbol: [], exposureByStrategy: [], totalRiskDollars: 500, totalRiskPct: 0.5, buyingPower: 99700, positions: [] },
              portfolioValueImpact: 200,
              unrealizedPnlImpact: 200,
              buyingPowerImpactDollars: 200,
              deltaChange: 0.2,
              gammaChange: -0.01,
              thetaChange: -1,
              vegaChange: 0.2,
              largestLosingPosition: null,
              largestGainingPosition: null,
              positionsBreachingThreshold: [],
              concentrationChanges: [],
              drawdownPct: null,
              riskScoreAfter: 48,
            },
          ],
          generatedAt: "2026-07-21T00:00:00.000Z",
        },
        rateScenarios: [{ scenario: scenarioDef({ key: "rate_up", label: "Interest Rate Increase (+100bps)", category: "rate" }), available: true, baseRiskFreeRate: 4.5, shockedRiskFreeRate: 5.5, totalImpactDollars: -10, positions: [] }],
      },
    });
    renderWithClient(<ScenarioEngine />);
    await user.click(screen.getByTestId("scenario-view-select"));
    await user.click(screen.getByTestId("scenario-view-option-options"));
    expect(screen.getByTestId("panel-se-options")).toBeInTheDocument();
    expect(screen.getByTestId("options-price-vol-scenario-0")).toHaveTextContent("+$200");
    expect(screen.getByTestId("options-greeks-0")).toHaveTextContent("-0.8");
    expect(screen.getByTestId("options-buying-power-0")).toHaveTextContent("+$200");
    expect(screen.getByTestId("options-capital-impact-0")).toBeInTheDocument();
    // fmtUsd (mirroring PerformanceAttributionEngine.tsx's own established
    // implementation) places the sign before the "$", so a negative value
    // renders as "$-10", not "-$10".
    expect(screen.getByTestId("options-rate-scenario-rate_up")).toHaveTextContent("$-10");
  });

  it("shows an honest unavailable message for Options when the user has no open positions, never a fabricated scenario result", async () => {
    const user = userEvent.setup();
    mockState.dashboardData = emptyDashboard();
    renderWithClient(<ScenarioEngine />);
    await user.click(screen.getByTestId("scenario-view-select"));
    await user.click(screen.getByTestId("scenario-view-option-options"));
    expect(screen.getByTestId("options-stress-test-unavailable")).toBeInTheDocument();
  });

  it("renders the Coach & Learning tab with real topics and Learning Centre links, never a trade recommendation", async () => {
    const user = userEvent.setup();
    mockState.coachData = [{ topic: "stress_testing", title: "Stress Testing", explanation: ["Real explanation text."], disclaimer: "Educational only." }];
    mockState.learningData = [{ topic: "stress_testing", links: [{ pathKey: "portfolio", topicKey: "portfolio-stress-testing", category: "stress", title: "Stress Testing", summary: "Summary.", href: "/learn/paths/portfolio/portfolio-stress-testing" }] }];
    renderWithClient(<ScenarioEngine />);
    await user.click(screen.getByTestId("tab-se-learning"));
    expect(screen.getByTestId("coach-topic-stress_testing")).toBeInTheDocument();
    expect(screen.getByTestId("learning-topic-stress_testing")).toBeInTheDocument();
    expect(screen.getByTestId("learning-link-portfolio-portfolio-stress-testing")).toBeInTheDocument();
  });

  it("renders the Reporting tab with deep links to the Institutional Reporting Centre", async () => {
    const user = userEvent.setup();
    renderWithClient(<ScenarioEngine />);
    await user.click(screen.getByTestId("tab-se-reporting"));
    expect(screen.getByTestId("link-report-scenario-analysis-report")).toHaveAttribute("href", "/reporting-centre?reportType=scenario-analysis-report");
    expect(screen.getByTestId("link-report-stress-test-report")).toHaveAttribute("href", "/reporting-centre?reportType=stress-test-report");
  });
});
