// Portfolio Stress Test & Scenario Simulator sprint — frontend smoke
// tests for the Portfolio Stress Test page.

import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  mutate: vi.fn(),
  data: undefined as unknown,
  isPending: false,
  isError: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useRunPortfolioStressTest: () => ({
      mutate: mockState.mutate,
      data: mockState.data,
      isPending: mockState.isPending,
      isError: mockState.isError,
    }),
  };
});

import PortfolioStressTest from "./PortfolioStressTest";

function scenarioEvaluationFixture(over: Record<string, unknown> = {}) {
  return {
    portfolioValue: 125300,
    totalUnrealizedPnl: 300,
    greeks: { delta: -1.2, gamma: 0.05, theta: 12, vega: -8 },
    exposureBySymbol: [{ symbol: "SPY", markValue: 400, pctOfAccount: 0.32 }],
    exposureByStrategy: [{ strategy: "iron_condor", markValue: 400, pctOfAccount: 0.32 }],
    totalRiskDollars: 500,
    totalRiskPct: 0.4,
    buyingPower: 249000,
    positions: [
      {
        tradeId: 1,
        symbol: "SPY",
        strategy: "iron_condor",
        greeks: { delta: -1.2, gamma: 0.05, theta: 12, vega: -8 },
        costToClose: 400,
        unrealizedPnl: 300,
        unrealizedPnlPercent: 60,
      },
    ],
    ...over,
  };
}

function scenarioComparisonFixture(over: Record<string, unknown> = {}) {
  return {
    label: "Bullish (+5%)",
    shock: { priceShockPct: 5, ivShockPct: 0, timeDecayDays: 0 },
    after: scenarioEvaluationFixture(),
    portfolioValueImpact: 150,
    unrealizedPnlImpact: 150,
    buyingPowerImpactDollars: 0,
    deltaChange: -0.3,
    gammaChange: 0.01,
    thetaChange: 1,
    vegaChange: -0.5,
    largestLosingPosition: null,
    largestGainingPosition: { tradeId: 1, symbol: "SPY", strategy: "iron_condor", pnlImpact: 150 },
    positionsBreachingThreshold: [],
    concentrationChanges: [{ symbol: "SPY", beforePct: 0.3, afterPct: 0.32, changePts: 0.02 }],
    drawdownPct: 0,
    riskScoreAfter: 88,
    ...over,
  };
}

function resultFixture(over: Record<string, unknown> = {}) {
  return {
    available: true,
    inputIssues: [],
    accountValue: 125000,
    credentialsConfigured: false,
    brokerConnected: null,
    lastBrokerCheckAt: null,
    sectorExposure: {
      available: false,
      reason: "No sector/industry classification is stored on options positions in this engine.",
    },
    base: scenarioEvaluationFixture({ totalUnrealizedPnl: 150, portfolioValue: 125150 }),
    riskScoreBefore: 90,
    scenarios: [scenarioComparisonFixture()],
    generatedAt: "2026-07-16T12:00:00.000Z",
    ...over,
  };
}

describe("PortfolioStressTest page", () => {
  it("shows the Paper Trading Mode and Simulation Only badges", () => {
    renderWithClient(<PortfolioStressTest />);
    expect(screen.getByTestId("badge-paper-trading-mode")).toHaveTextContent("Paper Trading Mode");
    expect(screen.getByTestId("badge-simulation-only")).toHaveTextContent("Simulation Only");
  });

  it("adding a quick scenario queues it in the scenario list", async () => {
    const user = userEvent.setup();
    renderWithClient(<PortfolioStressTest />);
    await user.click(screen.getByTestId("button-quick-scenario-Bullish-5-"));
    const queued = screen.getByTestId("list-queued-scenarios");
    expect(queued).toBeInTheDocument();
    expect(within(queued).getByText(/Bullish \(\+5%\)/)).toBeInTheDocument();
  });

  it("building a custom combined scenario and adding it queues the combined shock", async () => {
    const user = userEvent.setup();
    renderWithClient(<PortfolioStressTest />);
    await user.type(screen.getByTestId("input-scenario-label"), "Earnings gap");

    await user.click(screen.getByTestId("select-price-shock"));
    await user.click(await screen.findByText("-5%"));

    await user.click(screen.getByTestId("select-iv-shock"));
    await user.click(await screen.findByText("+20%"));

    await user.click(screen.getByTestId("select-time-decay"));
    await user.click(await screen.findByText("+7 days"));

    await user.click(screen.getByTestId("button-add-scenario"));

    const queued = screen.getByTestId("list-queued-scenarios");
    expect(queued).toHaveTextContent("Earnings gap");
    expect(queued).toHaveTextContent("Price -5%");
    expect(queued).toHaveTextContent("IV +20%");
    expect(queued).toHaveTextContent("+7d");
  });

  it("removing a queued scenario removes it from the list", async () => {
    const user = userEvent.setup();
    renderWithClient(<PortfolioStressTest />);
    await user.click(screen.getByTestId("button-quick-scenario-Bearish-5-"));
    const removeButtons = screen.getAllByTestId(/^button-remove-scenario-/);
    await user.click(removeButtons[0]);
    expect(screen.queryByTestId("list-queued-scenarios")).not.toBeInTheDocument();
  });

  it("clicking Run Stress Test with no queued scenarios submits an empty scenarios request (server defaults apply)", async () => {
    const user = userEvent.setup();
    renderWithClient(<PortfolioStressTest />);
    await user.click(screen.getByTestId("button-run-stress-test"));
    expect(mockState.mutate).toHaveBeenCalledWith({ data: {} });
  });

  it("clicking Run Stress Test with queued scenarios submits them", async () => {
    const user = userEvent.setup();
    renderWithClient(<PortfolioStressTest />);
    await user.click(screen.getByTestId("button-quick-scenario-Bullish-5-"));
    await user.click(screen.getByTestId("button-run-stress-test"));
    expect(mockState.mutate).toHaveBeenCalledWith({
      data: {
        scenarios: [
          { label: "Bullish (+5%)", priceShockPct: 5, ivShockPct: 0, timeDecayDays: 0 },
        ],
      },
    });
  });

  it("shows a loading state while a stress test is running", () => {
    mockState.isPending = true;
    renderWithClient(<PortfolioStressTest />);
    expect(screen.getByTestId("stress-test-loading")).toBeInTheDocument();
    mockState.isPending = false;
  });

  it("shows an error state when the stress test fails", () => {
    mockState.isError = true;
    renderWithClient(<PortfolioStressTest />);
    expect(screen.getByTestId("text-stress-test-error")).toBeInTheDocument();
    mockState.isError = false;
  });

  it("shows honest input-issue notices when present", () => {
    mockState.data = resultFixture({
      inputIssues: [{ index: 0, field: "scenarios[0]", code: "no_shock_specified", message: "This scenario specifies no shock." }],
    });
    renderWithClient(<PortfolioStressTest />);
    expect(screen.getByTestId("list-stress-test-input-issues")).toHaveTextContent("This scenario specifies no shock.");
    mockState.data = undefined;
  });

  it("renders the base case portfolio value, P/L, buying power, risk score, and Greeks", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioStressTest />);
    expect(screen.getByTestId("text-base-portfolio-value")).toHaveTextContent("$125,150.00");
    expect(screen.getByTestId("text-base-unrealized-pnl")).toHaveTextContent("+$150.00");
    expect(screen.getByTestId("badge-risk-score-before")).toHaveTextContent("90");
    expect(screen.getByTestId("text-base-greeks")).toHaveTextContent("Δ -1.2");
    mockState.data = undefined;
  });

  it("shows the honest empty-portfolio message when there are no open positions", () => {
    mockState.data = resultFixture({
      base: scenarioEvaluationFixture({
        exposureBySymbol: [],
        exposureByStrategy: [],
        positions: [],
        totalUnrealizedPnl: 0,
        portfolioValue: 125000,
      }),
    });
    renderWithClient(<PortfolioStressTest />);
    expect(screen.getByTestId("text-base-exposure-symbol-empty")).toBeInTheDocument();
    expect(screen.getByTestId("text-base-exposure-strategy-empty")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("always shows the honest sector-exposure-unavailable disclosure", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioStressTest />);
    expect(screen.getByTestId("text-sector-exposure-unavailable")).toHaveTextContent(/sector/i);
    mockState.data = undefined;
  });

  it("renders one scenario comparison card per requested scenario with its own shock, P/L impact, and risk score", () => {
    mockState.data = resultFixture({
      scenarios: [
        scenarioComparisonFixture({ label: "Bullish (+5%)" }),
        scenarioComparisonFixture({ label: "Bearish (-5%)", shock: { priceShockPct: -5, ivShockPct: 0, timeDecayDays: 0 }, unrealizedPnlImpact: -200, riskScoreAfter: 55 }),
      ],
    });
    renderWithClient(<PortfolioStressTest />);
    expect(screen.getByTestId("card-scenario-0")).toHaveTextContent("Bullish (+5%)");
    expect(screen.getByTestId("card-scenario-1")).toHaveTextContent("Bearish (-5%)");
    expect(screen.getByTestId("badge-scenario-pnl-impact-1")).toHaveTextContent("-$200.00");
    expect(screen.getByTestId("badge-risk-score-after-1")).toHaveTextContent("55");
    mockState.data = undefined;
  });

  it("shows largest gaining/losing position and threshold breach warnings when present", () => {
    mockState.data = resultFixture({
      scenarios: [
        scenarioComparisonFixture({
          largestGainingPosition: { tradeId: 1, symbol: "SPY", strategy: "iron_condor", pnlImpact: 150 },
          largestLosingPosition: { tradeId: 2, symbol: "QQQ", strategy: "iron_condor", pnlImpact: -80 },
          positionsBreachingThreshold: [
            { tradeId: 2, symbol: "QQQ", lossDollars: 80, lossPctOfAccount: 2.5, thresholdPct: 1 },
          ],
        }),
      ],
    });
    renderWithClient(<PortfolioStressTest />);
    expect(screen.getByTestId("text-scenario-largest-gain-0")).toHaveTextContent("SPY");
    expect(screen.getByTestId("text-scenario-largest-loss-0")).toHaveTextContent("QQQ");
    expect(screen.getByTestId("list-scenario-breaches-0")).toHaveTextContent("QQQ");
    mockState.data = undefined;
  });

  it("shows an honest no-breaches message when a scenario breaches no risk threshold", () => {
    mockState.data = resultFixture({
      scenarios: [scenarioComparisonFixture({ positionsBreachingThreshold: [] })],
    });
    renderWithClient(<PortfolioStressTest />);
    expect(screen.getByTestId("text-scenario-no-breaches-0")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("shows drawdown as None for a net-positive scenario and a percentage for a net-negative one", () => {
    mockState.data = resultFixture({
      scenarios: [
        scenarioComparisonFixture({ drawdownPct: 0 }),
        scenarioComparisonFixture({ label: "Bearish", drawdownPct: 3.2 }),
      ],
    });
    renderWithClient(<PortfolioStressTest />);
    expect(screen.getByTestId("text-scenario-drawdown-0")).toHaveTextContent("None");
    expect(screen.getByTestId("text-scenario-drawdown-1")).toHaveTextContent("3.20%");
    mockState.data = undefined;
  });

  it("shows concentration changes per symbol when present", () => {
    mockState.data = resultFixture({
      scenarios: [
        scenarioComparisonFixture({
          concentrationChanges: [{ symbol: "SPY", beforePct: 20, afterPct: 25, changePts: 5 }],
        }),
      ],
    });
    renderWithClient(<PortfolioStressTest />);
    expect(screen.getByTestId("list-scenario-concentration-0")).toHaveTextContent("SPY");
    expect(screen.getByTestId("scenario-concentration-0-SPY")).toHaveTextContent("20.00%");
    mockState.data = undefined;
  });
});
