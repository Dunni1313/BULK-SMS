// Earnings & Event Risk Portfolio Overlay sprint — frontend smoke tests
// for the Portfolio Event Risk page.

import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ReactElement } from "react";

// The Risk Level column reuses the shared EventRiskBadge component
// (components/ui/event-risk-badge.tsx), which renders a real Radix
// Tooltip for any non-"none" risk level and therefore requires a
// TooltipProvider ancestor — the same one App.tsx's own real render
// tree already supplies; a bare page-component render needs its own.
function renderPage(ui: ReactElement) {
  return renderWithClient(<TooltipProvider>{ui}</TooltipProvider>);
}

const mockState = vi.hoisted(() => ({
  data: undefined as unknown,
  isLoading: false,
  isError: false,
  brokerHealth: undefined as unknown,
  brokerHealthFetching: false,
  refetchBrokerHealth: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetPortfolioEventRisk: () => ({
      data: mockState.data,
      isLoading: mockState.isLoading,
      isError: mockState.isError,
    }),
    useGetBrokerHealth: () => ({
      data: mockState.brokerHealth,
      isFetching: mockState.brokerHealthFetching,
      refetch: mockState.refetchBrokerHealth,
    }),
  };
});

import PortfolioEventRisk from "./PortfolioEventRisk";

function eventFixture(over: Record<string, unknown> = {}) {
  return {
    type: "earnings",
    label: "AAPL earnings",
    date: "2026-08-01",
    daysAway: 5,
    impact: "high",
    scope: "symbol",
    symbol: "AAPL",
    ...over,
  };
}

function positionFixture(over: Record<string, unknown> = {}) {
  return {
    tradeId: 1,
    symbol: "AAPL",
    strategy: "iron_condor",
    quantity: 1,
    portfolioWeightPct: 0.4,
    expiration: "2026-08-21",
    eventStatus: "has_events",
    primaryEvent: eventFixture(),
    events: [eventFixture()],
    riskLevel: "high",
    riskGuidance: "consider_adjustment",
    riskGuidanceLabel: "Consider Adjustment",
    confidence: "simulated_estimate",
    eventSource: "SIMULATED",
    lastUpdated: "2026-07-16T12:00:00.000Z",
    ...over,
  };
}

function summaryFixture(over: Record<string, unknown> = {}) {
  return {
    totalPositions: 1,
    positionsWithEvents: 1,
    positionsWithoutEvents: 0,
    highRiskCount: 1,
    within1Day: 0,
    within3Days: 0,
    within7Days: 1,
    within14Days: 1,
    aggregateExposurePct: 0.4,
    highestRiskPosition: { tradeId: 1, symbol: "AAPL", riskLevel: "high" },
    ...over,
  };
}

function resultFixture(over: Record<string, unknown> = {}) {
  return {
    positions: [positionFixture()],
    summary: summaryFixture(),
    accountValue: 125000,
    credentialsConfigured: false,
    brokerConnected: null,
    lastBrokerCheckAt: null,
    eventRiskEnabled: true,
    unsupportedEventCategories: [
      { category: "fda_decision", label: "FDA Decisions", reason: "No FDA-calendar data source exists anywhere in this codebase." },
      { category: "product_launch", label: "Product Launches", reason: "No product-launch calendar data source exists anywhere in this codebase." },
    ],
    generatedAt: "2026-07-16T12:00:00.000Z",
    ...over,
  };
}

describe("PortfolioEventRisk page", () => {
  it("shows the Paper Trading Mode and Read-Only Event Risk Analysis badges", () => {
    renderPage(<PortfolioEventRisk />);
    expect(screen.getByTestId("badge-paper-trading-mode")).toHaveTextContent("Paper Trading Mode");
    expect(screen.getByTestId("badge-read-only-event-risk")).toHaveTextContent("Read-Only Event Risk Analysis");
  });

  it("shows a loading state while the overlay resolves", () => {
    mockState.isLoading = true;
    renderPage(<PortfolioEventRisk />);
    expect(screen.getByTestId("event-risk-loading")).toBeInTheDocument();
    mockState.isLoading = false;
  });

  it("shows an error state when the overlay fails to load", () => {
    mockState.isError = true;
    renderPage(<PortfolioEventRisk />);
    expect(screen.getByTestId("text-event-risk-error")).toBeInTheDocument();
    mockState.isError = false;
  });

  it("shows the honest empty-portfolio message when there are no open positions", () => {
    mockState.data = resultFixture({
      positions: [],
      summary: summaryFixture({
        totalPositions: 0,
        positionsWithEvents: 0,
        positionsWithoutEvents: 0,
        highRiskCount: 0,
        aggregateExposurePct: 0,
        highestRiskPosition: null,
      }),
    });
    renderPage(<PortfolioEventRisk />);
    expect(screen.getByTestId("text-no-open-positions")).toBeInTheDocument();
    expect(screen.getByTestId("text-summary-no-highest-risk")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("shows the honest no-events message for a portfolio without any upcoming events", () => {
    mockState.data = resultFixture({
      positions: [
        positionFixture({
          tradeId: 2,
          symbol: "TSLA",
          eventStatus: "no_events",
          primaryEvent: null,
          events: [],
          riskLevel: "none",
          riskGuidance: "no_immediate_event_risk",
          riskGuidanceLabel: "No Immediate Event Risk",
          confidence: null,
        }),
      ],
      summary: summaryFixture({
        positionsWithEvents: 0,
        positionsWithoutEvents: 1,
        highRiskCount: 0,
        highestRiskPosition: null,
      }),
    });
    renderPage(<PortfolioEventRisk />);
    const row = screen.getByTestId("row-position-2");
    expect(within(row).getByTestId("text-no-primary-event-2")).toBeInTheDocument();
    expect(within(row).getByTestId("badge-guidance-2")).toHaveTextContent("No Immediate Event Risk");
  });

  it("renders multiple positions with multiple event categories", () => {
    mockState.data = resultFixture({
      positions: [
        positionFixture({ tradeId: 1, symbol: "AAPL" }),
        positionFixture({
          tradeId: 2,
          symbol: "IBM",
          riskLevel: "medium",
          riskGuidance: "consider_review",
          riskGuidanceLabel: "Consider Review",
          primaryEvent: eventFixture({ type: "economic", label: "PCE / retail sales", symbol: null, scope: "market", daysAway: 7 }),
          events: [
            eventFixture({ type: "economic", label: "PCE / retail sales", symbol: null, scope: "market", daysAway: 7 }),
            eventFixture({ type: "jobs", label: "Nonfarm payrolls", symbol: null, scope: "market", daysAway: 22 }),
            eventFixture({ type: "cpi", label: "CPI inflation report", symbol: null, scope: "market", daysAway: 27 }),
          ],
          confidence: "scheduled",
        }),
      ],
      summary: summaryFixture({ totalPositions: 2, positionsWithEvents: 2 }),
    });
    renderPage(<PortfolioEventRisk />);
    expect(screen.getByTestId("row-position-1")).toBeInTheDocument();
    expect(screen.getByTestId("row-position-2")).toBeInTheDocument();
    const ibmEvents = screen.getByTestId("list-position-events-2");
    expect(within(ibmEvents).getByText(/PCE \/ retail sales/)).toBeInTheDocument();
    expect(within(ibmEvents).getByText(/Nonfarm payrolls/)).toBeInTheDocument();
    expect(within(ibmEvents).getByText(/CPI inflation report/)).toBeInTheDocument();
  });

  it("renders high-risk events with the Consider Adjustment guidance and highest-risk summary", () => {
    mockState.data = resultFixture();
    renderPage(<PortfolioEventRisk />);
    expect(screen.getByTestId("badge-guidance-1")).toHaveTextContent("Consider Adjustment");
    expect(screen.getByTestId("text-summary-highest-risk")).toHaveTextContent("AAPL");
    expect(screen.getByTestId("text-summary-high-risk")).toHaveTextContent("1");
  });

  it("shows the portfolio summary countdown buckets and aggregate exposure", () => {
    mockState.data = resultFixture();
    renderPage(<PortfolioEventRisk />);
    expect(screen.getByTestId("text-summary-within-7")).toHaveTextContent("1");
    expect(screen.getByTestId("text-summary-within-14")).toHaveTextContent("1");
    expect(screen.getByTestId("text-summary-aggregate-exposure")).toHaveTextContent("0.40%");
  });

  it("always shows the honest unsupported-event-category disclosure (FDA decisions, product launches)", () => {
    mockState.data = resultFixture();
    renderPage(<PortfolioEventRisk />);
    expect(screen.getByTestId("text-unsupported-fda_decision")).toHaveTextContent("FDA Decisions");
    expect(screen.getByTestId("text-unsupported-product_launch")).toHaveTextContent("Product Launches");
  });

  it("filters positions by event status", async () => {
    const user = userEvent.setup();
    mockState.data = resultFixture({
      positions: [
        positionFixture({ tradeId: 1, symbol: "AAPL", eventStatus: "has_events" }),
        positionFixture({
          tradeId: 2,
          symbol: "TSLA",
          eventStatus: "no_events",
          primaryEvent: null,
          events: [],
          riskLevel: "none",
        }),
      ],
      summary: summaryFixture({ totalPositions: 2 }),
    });
    renderPage(<PortfolioEventRisk />);
    expect(screen.getByTestId("row-position-1")).toBeInTheDocument();
    expect(screen.getByTestId("row-position-2")).toBeInTheDocument();

    await user.click(screen.getByTestId("select-status-filter"));
    await user.click(await screen.findByText("No Events"));

    expect(screen.queryByTestId("row-position-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("row-position-2")).toBeInTheDocument();
  });

  it("filters positions by risk level", async () => {
    const user = userEvent.setup();
    mockState.data = resultFixture({
      positions: [
        positionFixture({ tradeId: 1, symbol: "AAPL", riskLevel: "high" }),
        positionFixture({ tradeId: 2, symbol: "IBM", riskLevel: "medium" }),
      ],
      summary: summaryFixture({ totalPositions: 2 }),
    });
    renderPage(<PortfolioEventRisk />);

    await user.click(screen.getByTestId("select-risk-filter"));
    await user.click(await screen.findByText("High"));

    expect(screen.getByTestId("row-position-1")).toBeInTheDocument();
    expect(screen.queryByTestId("row-position-2")).not.toBeInTheDocument();
  });

  it("shows an honest no-matches message when filters exclude every position", async () => {
    const user = userEvent.setup();
    mockState.data = resultFixture({
      positions: [positionFixture({ tradeId: 1, symbol: "AAPL", riskLevel: "high" })],
      summary: summaryFixture({ totalPositions: 1 }),
    });
    renderPage(<PortfolioEventRisk />);

    await user.click(screen.getByTestId("select-risk-filter"));
    await user.click(await screen.findByText("None"));

    expect(screen.getByTestId("text-no-filtered-positions")).toBeInTheDocument();
  });

  it("sorts positions by portfolio weight", async () => {
    const user = userEvent.setup();
    mockState.data = resultFixture({
      positions: [
        positionFixture({ tradeId: 1, symbol: "AAPL", portfolioWeightPct: 0.2 }),
        positionFixture({ tradeId: 2, symbol: "TSLA", portfolioWeightPct: 0.9 }),
      ],
      summary: summaryFixture({ totalPositions: 2 }),
    });
    renderPage(<PortfolioEventRisk />);

    await user.click(screen.getByTestId("select-sort-key"));
    await user.click(await screen.findByText("Portfolio Weight"));

    const list = screen.getByTestId("list-event-risk-positions");
    const rows = within(list).getAllByTestId(/^row-position-/);
    expect(rows[0]).toHaveAttribute("data-testid", "row-position-2");
    expect(rows[1]).toHaveAttribute("data-testid", "row-position-1");
  });

  it("Broker Connection Status shows a not-yet-checked state before any manual refresh", () => {
    mockState.data = resultFixture();
    renderPage(<PortfolioEventRisk />);
    expect(screen.getByTestId("text-broker-health-not-checked")).toBeInTheDocument();
  });

  it("clicking Refresh Broker Health triggers a manual refetch independent of the event-risk data", async () => {
    const user = userEvent.setup();
    mockState.data = resultFixture();
    renderPage(<PortfolioEventRisk />);
    await user.click(screen.getByTestId("button-refresh-broker-health"));
    expect(mockState.refetchBrokerHealth).toHaveBeenCalled();
  });
});
