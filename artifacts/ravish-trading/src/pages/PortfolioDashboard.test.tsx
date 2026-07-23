// Portfolio Risk Dashboard & Health Score sprint — frontend smoke tests
// for the Portfolio Dashboard page.

import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  data: undefined as unknown,
  isLoading: false,
  isError: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetPortfolioDashboard: () => ({
      data: mockState.data,
      isLoading: mockState.isLoading,
      isError: mockState.isError,
    }),
  };
});

import PortfolioDashboard from "./PortfolioDashboard";

function bucket(key: string, label: string, positionCount: number, weightPct: number) {
  return { key, label, positionCount, weightPct };
}

function resultFixture(over: Record<string, unknown> = {}) {
  return {
    portfolioValue: 125400,
    buyingPower: 248200,
    totalRiskDollars: 800,
    totalRiskPct: 0.64,
    healthScore: 72,
    overallRiskRating: { code: "moderate_risk", label: "Moderate Risk" },
    paperTradingMode: true,
    credentialsConfigured: false,
    brokerConnected: null,
    lastBrokerCheckAt: null,
    lastPortfolioUpdate: "2026-07-16T12:00:00.000Z",
    openPositionsCount: 2,
    healthFactors: [
      { code: "concentration", label: "Concentration", score: 48, sourceModule: "portfolioConcentration.ts — breakdowns.symbol.concentrationScore", detail: "Symbol-level concentration score of 52/100." },
      { code: "diversification", label: "Diversification", score: 80, sourceModule: "portfolioConcentration.ts — breakdowns.sector.concentrationScore", detail: "Sector-level concentration score of 20/100." },
      { code: "event_risk", label: "Event Risk", score: 100, sourceModule: "portfolioEventRisk.ts — summary.highestRiskPosition.riskLevel", detail: 'Highest portfolio event-risk level is "none".' },
      { code: "net_greeks_exposure", label: "Net Greeks Exposure", score: 37, sourceModule: "portfolioConcentration.ts — greeksContributions[0].deltaSharePct", detail: "The single largest position accounts for 62.5% of total portfolio delta exposure." },
      { code: "directional_exposure", label: "Directional Exposure", score: 0, sourceModule: "portfolioConcentration.ts — longShort.longPct / shortPct", detail: "Long/short exposure split is 0% long / 100% short." },
      { code: "position_sizing_quality", label: "Position Sizing Quality", score: 90, sourceModule: "portfolioStressTest.ts — riskScoreBefore", detail: "Base-case risk score of 90/100." },
      { code: "position_count", label: "Number of Positions", score: 40, sourceModule: "positionSizing.ts — currentOpenTrades() count", detail: "2 open positions (5+ treated as adequately diversified by count)." },
      { code: "expiration_distribution", label: "Expiration Distribution", score: 80, sourceModule: "portfolioConcentration.ts — breakdowns.expiration.concentrationScore", detail: "Expiration-date concentration score of 20/100." },
    ],
    netGreeks: { delta: -2.4, gamma: 0.08, theta: 24, vega: -12 },
    largestPosition: { symbol: "AAPL", riskDollars: 500, pctOfAccount: 0.4 },
    largestRiskContributor: { tradeId: 1, symbol: "AAPL", delta: -1.5, deltaSharePct: 62.5 },
    highestEventRisk: null,
    highestConcentration: { dimension: "symbol", bucket: bucket("AAPL", "AAPL", 1, 60) },
    highestDirectionalExposure: { direction: "short", exposureDollars: 700, pct: 100 },
    widgets: [
      { code: "position_sizing", label: "Position Sizing", headline: "2 open positions", detail: "Largest exposure: AAPL (0.40% of account).", linkHref: "/position-sizing" },
      { code: "stress_test", label: "Stress Test", headline: "Base risk score 90/100", detail: "Base-case portfolio value 125400.00 across 4 scenarios.", linkHref: "/stress-test" },
      { code: "event_risk", label: "Event Risk", headline: "0 high-risk positions", detail: "0 of 2 positions carry a tracked upcoming event.", linkHref: "/event-risk" },
      { code: "concentration", label: "Concentration", headline: "52/100 concentration score", detail: "Moderate Concentration", linkHref: "/concentration-risk" },
      { code: "diversification", label: "Diversification", headline: "48/100 diversification score", detail: "Least diversified area: Strategy.", linkHref: "/concentration-risk" },
      { code: "greeks", label: "Greeks", headline: "Net delta -2.4", detail: "Net theta 24, net vega -12.", linkHref: "/concentration-risk" },
      { code: "broker_health", label: "Broker Health", headline: "No credentials configured", detail: "Configure Alpaca Paper credentials in Settings to enable broker health checks.", linkHref: "/settings" },
    ],
    allocationBySymbol: [bucket("AAPL", "AAPL", 1, 60), bucket("SPY", "SPY", 1, 40)],
    allocationBySector: [bucket("Technology", "Technology", 1, 60), bucket("Index ETF (S&P 500)", "Index ETF (S&P 500)", 1, 40)],
    allocationByStrategy: [bucket("iron_condor", "iron condor", 2, 100)],
    expirationDistribution: [bucket("2026-08-21", "2026-08-21", 2, 100)],
    eventTimelineSummary: {
      totalPositions: 2,
      positionsWithEvents: 0,
      positionsWithoutEvents: 2,
      highRiskCount: 0,
      within1Day: 0,
      within3Days: 0,
      within7Days: 0,
      within14Days: 0,
      aggregateExposurePct: 0,
      highestRiskPosition: null,
    },
    stressTestSummary: [
      { label: "Bullish (+5%)", portfolioValueImpact: 120, riskScoreAfter: 88 },
      { label: "Bearish (-5%)", portfolioValueImpact: -140, riskScoreAfter: 70 },
    ],
    guidance: [
      { code: "moderate_risk", label: "Moderate Risk", detail: "This portfolio's blended Health Score indicates moderate risk — review the factor breakdown below." },
    ],
    generatedAt: "2026-07-16T12:00:00.000Z",
    ...over,
  };
}

describe("PortfolioDashboard page", () => {
  it("shows the Paper Trading Mode and Read-Only Portfolio Dashboard badges", () => {
    renderWithClient(<PortfolioDashboard />);
    expect(screen.getByTestId("badge-paper-trading-mode")).toHaveTextContent("Paper Trading Mode");
    expect(screen.getByTestId("badge-read-only-portfolio-dashboard")).toHaveTextContent("Read-Only Portfolio Dashboard");
  });

  it("shows a loading state while the dashboard resolves", () => {
    mockState.isLoading = true;
    renderWithClient(<PortfolioDashboard />);
    expect(screen.getByTestId("dashboard-loading")).toBeInTheDocument();
    mockState.isLoading = false;
  });

  it("shows an error state when the dashboard fails to load", () => {
    mockState.isError = true;
    renderWithClient(<PortfolioDashboard />);
    expect(screen.getByTestId("text-dashboard-error")).toBeInTheDocument();
    mockState.isError = false;
  });

  it("shows the honest empty-portfolio state with a healthy score and no fabricated highlights", () => {
    mockState.data = resultFixture({
      openPositionsCount: 0,
      healthScore: 100,
      overallRiskRating: { code: "healthy", label: "Healthy" },
      healthFactors: resultFixture().healthFactors.map((f: Record<string, unknown>) => ({ ...f, score: 100 })),
      largestPosition: null,
      largestRiskContributor: null,
      highestEventRisk: null,
      highestConcentration: null,
      highestDirectionalExposure: null,
      allocationBySymbol: [],
      allocationBySector: [],
      guidance: [{ code: "healthy_portfolio", label: "Healthy Portfolio", detail: "This portfolio's blended Health Score is in the healthy range." }],
    });
    renderWithClient(<PortfolioDashboard />);
    expect(screen.getByTestId("badge-overall-risk-rating")).toHaveTextContent("Healthy");
    expect(screen.getByTestId("text-largest-position-none")).toBeInTheDocument();
    expect(screen.getByTestId("text-largest-risk-contributor-none")).toBeInTheDocument();
    expect(screen.getByTestId("text-highest-event-risk-none")).toBeInTheDocument();
    expect(screen.getByTestId("text-highest-concentration-none")).toBeInTheDocument();
    expect(screen.getByTestId("text-highest-directional-exposure-none")).toBeInTheDocument();
    expect(screen.getByTestId("text-no-allocation")).toBeInTheDocument();
    expect(screen.getByTestId("text-no-sector-allocation")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("renders the Executive Summary fields", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioDashboard />);
    expect(screen.getByTestId("text-portfolio-value")).toHaveTextContent("$125,400.00");
    expect(screen.getByTestId("text-buying-power")).toHaveTextContent("$248,200.00");
    expect(screen.getByTestId("text-total-risk")).toHaveTextContent("$800.00");
    expect(screen.getByTestId("gauge-health-score")).toHaveTextContent("72");
    expect(screen.getByTestId("badge-overall-risk-rating")).toHaveTextContent("Moderate Risk");
    expect(screen.getByTestId("text-paper-trading-status")).toBeInTheDocument();
    expect(screen.getByTestId("text-broker-status")).toHaveTextContent("No credentials configured");
    expect(screen.getByTestId("text-last-portfolio-update")).toBeInTheDocument();
  });

  it("renders all 8 Health Score factors by default", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioDashboard />);
    const list = screen.getByTestId("list-health-factors");
    expect(within(list).getAllByRole("listitem")).toHaveLength(8);
    expect(within(list).getByTestId("factor-concentration")).toHaveTextContent("48/100");
  });

  it("sorting factors by Score (Worst First) re-orders the list to the lowest score first", async () => {
    const user = userEvent.setup();
    mockState.data = resultFixture();
    renderWithClient(<PortfolioDashboard />);
    await user.click(screen.getByTestId("select-factor-sort-mode"));
    await user.click(await screen.findByText("Score (Worst First)"));
    const list = screen.getByTestId("list-health-factors");
    const items = within(list).getAllByRole("listitem");
    // "directional_exposure" scores 0, the lowest in the fixture.
    expect(items[0]).toHaveAttribute("data-testid", "factor-directional_exposure");
  });

  it("filtering by minimum factor score hides factors below the threshold", async () => {
    const user = userEvent.setup();
    mockState.data = resultFixture();
    renderWithClient(<PortfolioDashboard />);
    await user.click(screen.getByTestId("select-min-factor-score"));
    await user.click(await screen.findByText("80+"));
    const list = screen.getByTestId("list-health-factors");
    // Only diversification (80), event_risk (100), position_sizing_quality
    // (90), and expiration_distribution (80) clear the 80+ threshold.
    expect(within(list).queryByTestId("factor-concentration")).not.toBeInTheDocument();
    expect(within(list).getByTestId("factor-event_risk")).toBeInTheDocument();
  });

  it("an overly strict minimum score shows the honest no-factors-match message", async () => {
    const user = userEvent.setup();
    mockState.data = resultFixture({
      healthFactors: resultFixture().healthFactors.map((f: Record<string, unknown>) => ({ ...f, score: 10 })),
    });
    renderWithClient(<PortfolioDashboard />);
    await user.click(screen.getByTestId("select-min-factor-score"));
    await user.click(await screen.findByText("80+"));
    expect(screen.getByTestId("text-no-health-factors")).toBeInTheDocument();
  });

  it("renders all 9 Risk Panel fields", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioDashboard />);
    expect(screen.getByTestId("text-net-delta")).toHaveTextContent("-2.4");
    expect(screen.getByTestId("text-net-gamma")).toHaveTextContent("0.08");
    expect(screen.getByTestId("text-net-theta")).toHaveTextContent("24");
    expect(screen.getByTestId("text-net-vega")).toHaveTextContent("-12");
    expect(screen.getByTestId("text-largest-position")).toHaveTextContent("AAPL");
    expect(screen.getByTestId("text-largest-risk-contributor")).toHaveTextContent("AAPL");
    expect(screen.getByTestId("text-highest-event-risk-none")).toBeInTheDocument();
    expect(screen.getByTestId("text-highest-concentration")).toHaveTextContent("AAPL");
    expect(screen.getByTestId("text-highest-directional-exposure")).toHaveTextContent("short");
  });

  it("renders exactly 7 dashboard widgets, each linking to its own existing detailed page", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioDashboard />);
    const grid = screen.getByTestId("grid-widgets");
    const links = within(grid).getAllByRole("link");
    expect(links).toHaveLength(7);
    expect(screen.getByTestId("widget-link-position_sizing")).toHaveAttribute("href", "/position-sizing");
    expect(screen.getByTestId("widget-link-broker_health")).toHaveAttribute("href", "/settings");
    expect(screen.getByTestId("widget-headline-concentration")).toHaveTextContent("52/100 concentration score");
  });

  it("renders the Portfolio Allocation and Concentration Snapshot charts", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioDashboard />);
    expect(screen.getByTestId("chart-allocation-by-symbol")).toBeInTheDocument();
    expect(screen.getByTestId("chart-allocation-by-sector")).toBeInTheDocument();
  });

  it("renders the Event Timeline Summary", () => {
    mockState.data = resultFixture({
      eventTimelineSummary: {
        totalPositions: 2,
        positionsWithEvents: 1,
        positionsWithoutEvents: 1,
        highRiskCount: 1,
        within1Day: 1,
        within3Days: 1,
        within7Days: 2,
        within14Days: 2,
        aggregateExposurePct: 0.4,
        highestRiskPosition: { tradeId: 1, symbol: "AAPL", riskLevel: "high" },
      },
    });
    renderWithClient(<PortfolioDashboard />);
    expect(screen.getByTestId("text-events-within-1-day")).toHaveTextContent("1");
    expect(screen.getByTestId("text-events-within-7-days")).toHaveTextContent("2");
  });

  it("renders the Stress Test Summary scenarios", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioDashboard />);
    const list = screen.getByTestId("list-stress-test-summary");
    expect(within(list).getByText("Bullish (+5%)")).toBeInTheDocument();
    expect(within(list).getByText("Bearish (-5%)")).toBeInTheDocument();
  });

  it("renders informational-only guidance, never an execution action", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioDashboard />);
    expect(screen.getByTestId("guidance-moderate_risk")).toHaveTextContent("Moderate Risk");
    expect(screen.queryByText(/place order|submit order|execute trade/i)).not.toBeInTheDocument();
  });
});
