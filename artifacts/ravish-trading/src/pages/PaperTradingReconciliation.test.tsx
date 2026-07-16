// Alpaca Paper Order Lifecycle & Reconciliation Foundation sprint —
// frontend smoke tests for the read-only Paper Trading Reconciliation
// panel, following the established mocked-generated-hook pattern (see
// Settings.test.tsx's own Broker Connection block for the closest
// precedent: a "Refresh"/"Check Connection"-style manual-trigger button
// over a mocked react-query hook).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  data: undefined as unknown,
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetBrokerReconciliation: () => ({
      data: mockState.data,
      isLoading: mockState.isLoading,
      isFetching: mockState.isFetching,
      isError: mockState.isError,
      refetch: mockState.refetch,
    }),
  };
});

import PaperTradingReconciliation from "./PaperTradingReconciliation";

function reconciliationFixture(over: Record<string, unknown> = {}) {
  return {
    available: true,
    unavailableReason: null,
    generatedAt: "2026-07-16T10:00:00.000Z",
    localOrdersConsidered: 1,
    brokerOrdersConsidered: 1,
    orders: [],
    positions: [],
    issueCount: 0,
    fullyReconciled: true,
    ...over,
  };
}

describe("PaperTradingReconciliation", () => {
  beforeEach(() => {
    mockState.data = undefined;
    mockState.isLoading = false;
    mockState.isFetching = false;
    mockState.isError = false;
    mockState.refetch.mockReset();
  });

  it("shows loading skeletons before any result has resolved", () => {
    mockState.isLoading = true;
    renderWithClient(<PaperTradingReconciliation />);
    expect(screen.getByTestId("button-refresh-reconciliation")).toBeInTheDocument();
    expect(screen.queryByTestId("badge-reconciliation-status")).not.toBeInTheDocument();
  });

  it("shows a distinct request-level error message on a genuine fetch failure", () => {
    mockState.isError = true;
    renderWithClient(<PaperTradingReconciliation />);
    expect(screen.getByTestId("text-reconciliation-request-error")).toBeInTheDocument();
  });

  it("shows the honest no_credentials state, but keeps the page usable (Refresh still works)", () => {
    mockState.data = reconciliationFixture({
      available: false,
      unavailableReason: "No Alpaca credentials configured",
      fullyReconciled: false,
      localOrdersConsidered: 0,
      brokerOrdersConsidered: 0,
    });
    renderWithClient(<PaperTradingReconciliation />);

    expect(screen.getByTestId("badge-reconciliation-status")).toHaveTextContent(/unavailable/i);
    expect(screen.getByTestId("text-reconciliation-unavailable-reason")).toHaveTextContent(
      /no alpaca credentials configured/i,
    );
    // The page never fabricates broker data — orders/positions honestly empty.
    expect(screen.getByTestId("text-no-order-entries")).toBeInTheDocument();
    expect(screen.getByTestId("text-no-position-entries")).toBeInTheDocument();
    // Still usable: the Refresh button is present and enabled.
    expect(screen.getByTestId("button-refresh-reconciliation")).not.toBeDisabled();
  });

  it("shows an authentication-failure reason distinctly, never presenting it as reconciled", () => {
    mockState.data = reconciliationFixture({
      available: false,
      unavailableReason: "Alpaca rejected the configured credentials (authentication failed)",
      fullyReconciled: false,
    });
    renderWithClient(<PaperTradingReconciliation />);
    expect(screen.getByTestId("text-reconciliation-unavailable-reason")).toHaveTextContent(/authentication failed/i);
  });

  it("shows a network-failure reason distinctly", () => {
    mockState.data = reconciliationFixture({
      available: false,
      unavailableReason: "Could not reach Alpaca: ECONNREFUSED",
      fullyReconciled: false,
    });
    renderWithClient(<PaperTradingReconciliation />);
    expect(screen.getByTestId("text-reconciliation-unavailable-reason")).toHaveTextContent(/could not reach alpaca/i);
  });

  it("shows the Fully Reconciled badge and summary counts when everything genuinely agrees", () => {
    mockState.data = reconciliationFixture();
    renderWithClient(<PaperTradingReconciliation />);
    expect(screen.getByTestId("badge-reconciliation-status")).toHaveTextContent(/fully reconciled/i);
    expect(screen.getByTestId("text-local-orders-considered")).toHaveTextContent("1");
    expect(screen.getByTestId("text-broker-orders-considered")).toHaveTextContent("1");
    expect(screen.getByTestId("text-last-checked")).not.toHaveTextContent("");
  });

  it("shows an Issue count badge and per-row issue badges for a filled order", () => {
    mockState.data = reconciliationFixture({
      fullyReconciled: false,
      issueCount: 1,
      orders: [
        {
          tradeId: 1,
          alpacaOrderId: "order-1",
          localSymbol: "SPY",
          brokerSymbol: "SPY",
          localStatus: "open",
          brokerStatus: "filled",
          brokerRawStatus: "filled",
          localQuantity: 2,
          brokerQuantity: 1,
          filledQuantity: 1,
          averageFillPrice: 2.15,
          issues: ["quantity_mismatch"],
        },
      ],
    });
    renderWithClient(<PaperTradingReconciliation />);
    expect(screen.getByTestId("badge-reconciliation-status")).toHaveTextContent(/1 issue/i);
    expect(screen.getByTestId("text-local-status-0")).toHaveTextContent("open");
    expect(screen.getByTestId("text-broker-status-0")).toHaveTextContent("filled");
    expect(screen.getByTestId("text-issues-0")).toHaveTextContent(/quantity mismatch/i);
  });

  it("shows a partially-filled order honestly, with its real fill quantity and price", () => {
    mockState.data = reconciliationFixture({
      orders: [
        {
          tradeId: 2,
          alpacaOrderId: "order-2",
          localSymbol: "AAPL",
          brokerSymbol: "AAPL",
          localStatus: "open",
          brokerStatus: "partially_filled",
          brokerRawStatus: "partially_filled",
          localQuantity: 2,
          brokerQuantity: 2,
          filledQuantity: 1,
          averageFillPrice: 1.5,
          issues: [],
        },
      ],
    });
    renderWithClient(<PaperTradingReconciliation />);
    const row = screen.getByTestId("row-order-0");
    expect(row).toHaveTextContent("partially_filled");
    expect(row).toHaveTextContent("1");
    expect(row).toHaveTextContent("$1.50");
  });

  it("shows a rejected order with no fabricated fill data", () => {
    mockState.data = reconciliationFixture({
      fullyReconciled: false,
      issueCount: 1,
      orders: [
        {
          tradeId: 3,
          alpacaOrderId: "order-3",
          localSymbol: "MSFT",
          brokerSymbol: "MSFT",
          localStatus: "open",
          brokerStatus: "rejected",
          brokerRawStatus: "rejected",
          localQuantity: 1,
          brokerQuantity: 1,
          filledQuantity: 0,
          averageFillPrice: null,
          issues: ["status_mismatch"],
        },
      ],
    });
    renderWithClient(<PaperTradingReconciliation />);
    expect(screen.getByTestId("text-broker-status-0")).toHaveTextContent("rejected");
    expect(screen.getByTestId("row-order-0")).toHaveTextContent("—"); // honest "—" for the null avg fill price
    expect(screen.getByTestId("text-issues-0")).toHaveTextContent(/status mismatch/i);
  });

  it("shows a cancelled order distinctly", () => {
    mockState.data = reconciliationFixture({
      orders: [
        {
          tradeId: 4,
          alpacaOrderId: "order-4",
          localSymbol: "TSLA",
          brokerSymbol: "TSLA",
          localStatus: "closed",
          brokerStatus: "cancelled",
          brokerRawStatus: "canceled",
          localQuantity: 1,
          brokerQuantity: 1,
          filledQuantity: 0,
          averageFillPrice: null,
          issues: [],
        },
      ],
    });
    renderWithClient(<PaperTradingReconciliation />);
    expect(screen.getByTestId("text-broker-status-0")).toHaveTextContent("cancelled");
  });

  it("shows an unknown broker status honestly, never guessing a known one", () => {
    mockState.data = reconciliationFixture({
      orders: [
        {
          tradeId: 5,
          alpacaOrderId: "order-5",
          localSymbol: "QQQ",
          brokerSymbol: "QQQ",
          localStatus: "pending",
          brokerStatus: "unknown",
          brokerRawStatus: "some_new_status",
          localQuantity: 1,
          brokerQuantity: 1,
          filledQuantity: 0,
          averageFillPrice: null,
          issues: [],
        },
      ],
    });
    renderWithClient(<PaperTradingReconciliation />);
    expect(screen.getByTestId("text-broker-status-0")).toHaveTextContent("unknown");
  });

  it("shows a local order missing at the broker", () => {
    mockState.data = reconciliationFixture({
      fullyReconciled: false,
      issueCount: 1,
      orders: [
        {
          tradeId: 6,
          alpacaOrderId: "order-6",
          localSymbol: "IWM",
          brokerSymbol: null,
          localStatus: "open",
          brokerStatus: null,
          brokerRawStatus: null,
          localQuantity: 1,
          brokerQuantity: null,
          filledQuantity: null,
          averageFillPrice: null,
          issues: ["missing_at_broker"],
        },
      ],
    });
    renderWithClient(<PaperTradingReconciliation />);
    expect(screen.getByTestId("text-issues-0")).toHaveTextContent(/missing at broker/i);
    expect(screen.getByTestId("text-broker-status-0")).toHaveTextContent("—");
  });

  it("shows a broker order missing locally", () => {
    mockState.data = reconciliationFixture({
      fullyReconciled: false,
      issueCount: 1,
      orders: [
        {
          tradeId: null,
          alpacaOrderId: "order-7",
          localSymbol: null,
          brokerSymbol: "GLD",
          localStatus: null,
          brokerStatus: "new",
          brokerRawStatus: "new",
          localQuantity: null,
          brokerQuantity: 1,
          filledQuantity: 0,
          averageFillPrice: null,
          issues: ["missing_locally"],
        },
      ],
    });
    renderWithClient(<PaperTradingReconciliation />);
    expect(screen.getByTestId("text-issues-0")).toHaveTextContent(/missing locally/i);
    expect(screen.getByTestId("text-local-status-0")).toHaveTextContent("—");
  });

  it("shows a position mismatch with a real detail message, never a fabricated match", () => {
    mockState.data = reconciliationFixture({
      fullyReconciled: false,
      issueCount: 1,
      positions: [
        {
          occSymbol: "AAPL261218C00200000",
          tradeId: 1,
          localQuantity: -2,
          brokerQuantity: -1,
          mismatch: true,
          detail: "Quantity mismatch: local -2, broker -1.",
        },
      ],
    });
    renderWithClient(<PaperTradingReconciliation />);
    expect(screen.getByTestId("badge-position-mismatch-0")).toHaveTextContent(/mismatch/i);
    expect(screen.getByTestId("row-position-0")).toHaveTextContent("Quantity mismatch: local -2, broker -1.");
  });

  it("shows a matched (non-mismatched) position", () => {
    mockState.data = reconciliationFixture({
      positions: [
        {
          occSymbol: "VOO261120C00500000",
          tradeId: 1,
          localQuantity: -1,
          brokerQuantity: -1,
          mismatch: false,
          detail: "Local and broker positions agree.",
        },
      ],
    });
    renderWithClient(<PaperTradingReconciliation />);
    expect(screen.getByTestId("badge-position-mismatch-0")).toHaveTextContent(/matched/i);
  });

  it("disables the Refresh button while a refresh is in progress and shows a spinner label", () => {
    mockState.data = reconciliationFixture();
    mockState.isFetching = true;
    renderWithClient(<PaperTradingReconciliation />);
    const button = screen.getByTestId("button-refresh-reconciliation");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/refreshing/i);
  });

  it("clicking Refresh calls refetch", async () => {
    mockState.data = reconciliationFixture();
    const user = userEvent.setup();
    renderWithClient(<PaperTradingReconciliation />);

    await user.click(screen.getByTestId("button-refresh-reconciliation"));
    expect(mockState.refetch).toHaveBeenCalledTimes(1);
  });

  it("the Refresh button is enabled again once a refresh completes", () => {
    mockState.data = reconciliationFixture();
    mockState.isFetching = false;
    renderWithClient(<PaperTradingReconciliation />);
    expect(screen.getByTestId("button-refresh-reconciliation")).not.toBeDisabled();
  });
});
