// Trade History, Performance Analytics & Trading Journal sprint — frontend
// smoke tests for the Trade Performance dashboard.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  trades: undefined as unknown,
  tradesLoading: false,
  tradesError: false,
  reconciliation: undefined as unknown,
  reconciliationFetching: false,
  refetchReconciliation: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useListTrades: () => ({
      data: mockState.trades,
      isLoading: mockState.tradesLoading,
      isError: mockState.tradesError,
    }),
    useGetBrokerReconciliation: () => ({
      data: mockState.reconciliation,
      isFetching: mockState.reconciliationFetching,
      refetch: mockState.refetchReconciliation,
    }),
  };
});

import TradePerformance from "./TradePerformance";

function tradeFixture(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    symbol: "AAPL",
    strategy: "iron_condor",
    status: "closed",
    legs: [],
    openDate: "2026-06-01T00:00:00.000Z",
    closeDate: "2026-06-05T00:00:00.000Z",
    expiration: null,
    credit: 100,
    maxProfit: 100,
    maxLoss: 400,
    currentPnl: 50,
    currentPnlPercent: 50,
    pop: 0.7,
    ev: 20,
    theta: 5,
    ravishScore: 70,
    exitReason: null,
    notes: null,
    alpacaOrderId: "real-order-1",
    ...over,
  };
}

describe("TradePerformance", () => {
  beforeEach(() => {
    mockState.trades = undefined;
    mockState.tradesLoading = false;
    mockState.tradesError = false;
    mockState.reconciliation = undefined;
    mockState.reconciliationFetching = false;
    mockState.refetchReconciliation.mockReset();
  });

  it("always shows the Paper Trading Mode badge and the local-data-only disclosure", () => {
    renderWithClient(<TradePerformance />);
    expect(screen.getByTestId("badge-paper-trading-mode")).toHaveTextContent(/paper trading mode/i);
    expect(screen.getByTestId("text-local-data-disclosure")).toHaveTextContent(/local trade history only/i);
  });

  it("shows a loading state while trades are being fetched", () => {
    mockState.tradesLoading = true;
    renderWithClient(<TradePerformance />);
    expect(screen.getByTestId("performance-loading")).toBeInTheDocument();
  });

  it("shows an error state when trades fail to load", () => {
    mockState.tradesError = true;
    renderWithClient(<TradePerformance />);
    expect(screen.getByTestId("text-performance-error")).toBeInTheDocument();
  });

  it("shows an honest empty state when there are no trades", () => {
    mockState.trades = [];
    renderWithClient(<TradePerformance />);
    expect(screen.getByTestId("text-no-trades-for-analytics")).toBeInTheDocument();
  });

  it("computes and displays every analytics card from real local trade data", () => {
    mockState.trades = [
      tradeFixture({ id: 1, currentPnl: 100 }),
      tradeFixture({ id: 2, currentPnl: 200 }),
      tradeFixture({ id: 3, currentPnl: -50 }),
      tradeFixture({ id: 4, status: "open", currentPnl: null }),
    ];
    renderWithClient(<TradePerformance />);
    expect(screen.getByTestId("card-total-trades")).toHaveTextContent("4");
    expect(screen.getByTestId("card-winning-trades")).toHaveTextContent("2");
    expect(screen.getByTestId("card-losing-trades")).toHaveTextContent("1");
    expect(screen.getByTestId("card-win-rate")).toHaveTextContent("66.7%");
    expect(screen.getByTestId("card-average-win")).toHaveTextContent("$150.00");
    expect(screen.getByTestId("card-average-loss")).toHaveTextContent("-$50.00");
    expect(screen.getByTestId("card-largest-winner")).toHaveTextContent("$200.00");
    expect(screen.getByTestId("card-largest-loser")).toHaveTextContent("-$50.00");
    expect(screen.getByTestId("card-open-trades")).toHaveTextContent("1");
    expect(screen.getByTestId("card-closed-trades")).toHaveTextContent("3");
  });

  it("shows 'Not yet checked' for reconciliation success before any check has run", () => {
    mockState.trades = [tradeFixture()];
    renderWithClient(<TradePerformance />);
    expect(screen.getByTestId("text-reconciliation-success-percentage")).toHaveTextContent(/not yet checked/i);
  });

  it("shows a real reconciliation success percentage once checked", () => {
    mockState.trades = [tradeFixture()];
    mockState.reconciliation = {
      available: true,
      unavailableReason: null,
      generatedAt: "2026-07-16T10:00:00.000Z",
      localOrdersConsidered: 2,
      brokerOrdersConsidered: 2,
      orders: [
        { tradeId: 1, alpacaOrderId: "o1", localSymbol: "AAPL", brokerSymbol: "AAPL", localStatus: "closed", brokerStatus: "filled", brokerRawStatus: "filled", localQuantity: 1, brokerQuantity: 1, filledQuantity: 1, averageFillPrice: 2, issues: [] },
        { tradeId: 2, alpacaOrderId: "o2", localSymbol: "MSFT", brokerSymbol: "MSFT", localStatus: "closed", brokerStatus: "filled", brokerRawStatus: "filled", localQuantity: 1, brokerQuantity: 2, filledQuantity: 2, averageFillPrice: 2, issues: ["quantity_mismatch"] },
      ],
      positions: [],
      issueCount: 1,
      fullyReconciled: false,
    };
    renderWithClient(<TradePerformance />);
    expect(screen.getByTestId("text-reconciliation-success-percentage")).toHaveTextContent("50.0%");
  });

  it("shows an honest unavailable reason when reconciliation fails (missing credentials)", () => {
    mockState.trades = [tradeFixture()];
    mockState.reconciliation = {
      available: false,
      unavailableReason: "No Alpaca credentials configured",
      generatedAt: "2026-07-16T10:00:00.000Z",
      localOrdersConsidered: 0,
      brokerOrdersConsidered: 0,
      orders: [],
      positions: [],
      issueCount: 0,
      fullyReconciled: false,
    };
    renderWithClient(<TradePerformance />);
    expect(screen.getByTestId("text-reconciliation-unavailable")).toHaveTextContent(/no alpaca credentials configured/i);
  });

  it("disables the Check Reconciliation button while a check is in flight", () => {
    mockState.trades = [tradeFixture()];
    mockState.reconciliationFetching = true;
    renderWithClient(<TradePerformance />);
    expect(screen.getByTestId("button-check-reconciliation")).toBeDisabled();
  });

  it("clicking Check Reconciliation triggers its own refetch", async () => {
    mockState.trades = [tradeFixture()];
    const user = userEvent.setup();
    renderWithClient(<TradePerformance />);
    await user.click(screen.getByTestId("button-check-reconciliation"));
    expect(mockState.refetchReconciliation).toHaveBeenCalledTimes(1);
  });
});
