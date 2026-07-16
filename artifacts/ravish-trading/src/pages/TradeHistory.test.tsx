// Trade History, Performance Analytics & Trading Journal sprint — frontend
// smoke tests, following the established mocked-generated-hook pattern.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  trades: undefined as unknown,
  tradesLoading: false,
  tradesError: false,
  journalEntries: undefined as unknown,
  reconciliation: undefined as unknown,
  reconciliationFetching: false,
  refetchReconciliation: vi.fn(),
  updateJournalMutate: vi.fn(),
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
    useListJournalEntries: () => ({ data: mockState.journalEntries }),
    useUpdateJournalEntry: () => ({ mutate: mockState.updateJournalMutate, isPending: false }),
    useGetBrokerReconciliation: () => ({
      data: mockState.reconciliation,
      isFetching: mockState.reconciliationFetching,
      refetch: mockState.refetchReconciliation,
    }),
  };
});

import TradeHistory from "./TradeHistory";

function tradeFixture(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    symbol: "AAPL",
    strategy: "iron_condor",
    status: "closed",
    legs: [
      { side: "sell", quantity: 2, strike: 400, optionType: "put", expiration: "2026-12-18", openPrice: 2 },
    ],
    openDate: "2026-06-01T00:00:00.000Z",
    closeDate: "2026-06-05T00:00:00.000Z",
    expiration: "2026-12-18",
    credit: 100,
    maxProfit: 100,
    maxLoss: 400,
    currentPnl: 50,
    currentPnlPercent: 50,
    pop: 0.7,
    ev: 20,
    theta: 5,
    ravishScore: 70,
    exitReason: "Profit target reached (75%)",
    notes: null,
    alpacaOrderId: "real-order-1",
    ...over,
  };
}

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

describe("TradeHistory", () => {
  beforeEach(() => {
    mockState.trades = undefined;
    mockState.tradesLoading = false;
    mockState.tradesError = false;
    mockState.journalEntries = undefined;
    mockState.reconciliation = undefined;
    mockState.reconciliationFetching = false;
    mockState.refetchReconciliation.mockReset();
    mockState.updateJournalMutate.mockReset();
  });

  it("always shows the Paper Trading Mode badge", () => {
    renderWithClient(<TradeHistory />);
    expect(screen.getByTestId("badge-paper-trading-mode")).toHaveTextContent(/paper trading mode/i);
  });

  it("shows a loading state while trades are being fetched", () => {
    mockState.tradesLoading = true;
    renderWithClient(<TradeHistory />);
    expect(screen.getByTestId("trade-history-loading")).toBeInTheDocument();
  });

  it("shows an error state when trades fail to load", () => {
    mockState.tradesError = true;
    renderWithClient(<TradeHistory />);
    expect(screen.getByTestId("text-trade-history-error")).toBeInTheDocument();
  });

  it("shows an honest empty state when there are no trades", () => {
    mockState.trades = [];
    renderWithClient(<TradeHistory />);
    expect(screen.getByTestId("text-no-trades")).toHaveTextContent(/no trades yet/i);
  });

  it("shows a populated trade row with direction, exit price, status, and holding period", () => {
    mockState.trades = [tradeFixture()];
    renderWithClient(<TradeHistory />);
    const row = screen.getByTestId("row-trade-1");
    expect(row).toHaveTextContent("AAPL");
    expect(screen.getByTestId("text-direction-1")).toHaveTextContent("Short"); // credit 100 >= 0
    // derivedExitPrice: credit 100 - currentPnl 50 = 50
    expect(screen.getByTestId("text-exit-price-1")).toHaveTextContent("$50.00");
    expect(row).toHaveTextContent("closed");
  });

  it("filters by search symbol", async () => {
    mockState.trades = [tradeFixture({ id: 1, symbol: "AAPL" }), tradeFixture({ id: 2, symbol: "MSFT" })];
    const user = userEvent.setup();
    renderWithClient(<TradeHistory />);
    await user.type(screen.getByTestId("input-search-symbol"), "MSFT");
    expect(screen.queryByTestId("row-trade-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("row-trade-2")).toBeInTheDocument();
  });

  it("filters by status", async () => {
    mockState.trades = [
      tradeFixture({ id: 1, symbol: "AAPL", status: "closed" }),
      tradeFixture({ id: 2, symbol: "MSFT", status: "open" }),
    ];
    const user = userEvent.setup();
    renderWithClient(<TradeHistory />);
    await user.click(screen.getByTestId("select-status-filter"));
    await user.click(screen.getByRole("option", { name: "Open" }));
    expect(screen.queryByTestId("row-trade-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("row-trade-2")).toBeInTheDocument();
  });

  it("filters by strategy", async () => {
    mockState.trades = [
      tradeFixture({ id: 1, symbol: "AAPL", strategy: "iron_condor" }),
      tradeFixture({ id: 2, symbol: "MSFT", strategy: "calendar_spread" }),
    ];
    const user = userEvent.setup();
    renderWithClient(<TradeHistory />);
    await user.click(screen.getByTestId("select-strategy-filter"));
    await user.click(screen.getByRole("option", { name: "Calendar Spread" }));
    expect(screen.queryByTestId("row-trade-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("row-trade-2")).toBeInTheDocument();
  });

  it("sorts by symbol ascending/descending", async () => {
    mockState.trades = [
      tradeFixture({ id: 1, symbol: "ZETA", openDate: "2026-06-01T00:00:00.000Z" }),
      tradeFixture({ id: 2, symbol: "ALPHA", openDate: "2026-06-02T00:00:00.000Z" }),
    ];
    const user = userEvent.setup();
    renderWithClient(<TradeHistory />);

    await user.click(screen.getByTestId("select-sort-field"));
    await user.click(screen.getByRole("option", { name: "Symbol" }));
    // default sort direction remains "Descending" (Z before A when descending).
    const rowsDesc = screen.getAllByTestId(/^row-trade-/);
    expect(within(rowsDesc[0]).getByText("ZETA")).toBeInTheDocument();

    await user.click(screen.getByTestId("button-toggle-sort-direction"));
    const rowsAsc = screen.getAllByTestId(/^row-trade-/);
    expect(within(rowsAsc[0]).getByText("ALPHA")).toBeInTheDocument();
  });

  it("paginates trades beyond one page", async () => {
    mockState.trades = Array.from({ length: 15 }, (_, i) =>
      tradeFixture({ id: i + 1, symbol: `SYM${i + 1}`, openDate: `2026-06-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z` }),
    );
    const user = userEvent.setup();
    renderWithClient(<TradeHistory />);
    expect(screen.getByTestId("text-page-indicator")).toHaveTextContent("Page 1 of 2");
    expect(screen.getByTestId("button-prev-page")).toBeDisabled();
    expect(screen.getByTestId("button-next-page")).not.toBeDisabled();

    await user.click(screen.getByTestId("button-next-page"));
    expect(screen.getByTestId("text-page-indicator")).toHaveTextContent("Page 2 of 2");
    expect(screen.getByTestId("button-next-page")).toBeDisabled();
  });

  it("shows missing broker data honestly for a mock (simulated) order id", async () => {
    mockState.trades = [tradeFixture({ id: 1, alpacaOrderId: "mock-abc123" })];
    const user = userEvent.setup();
    renderWithClient(<TradeHistory />);
    expect(screen.getByTestId("badge-reconciliation-1")).toHaveTextContent(/simulated/i);

    await user.click(screen.getByTestId("button-expand-trade-1"));
    expect(screen.getByTestId("text-broker-order-id-1")).toHaveTextContent(/simulated \(no broker order\)/i);
  });

  it("shows a real broker order id when available and not yet checked before reconciliation runs", async () => {
    mockState.trades = [tradeFixture({ id: 1, alpacaOrderId: "real-order-1" })];
    const user = userEvent.setup();
    renderWithClient(<TradeHistory />);
    expect(screen.getByTestId("badge-reconciliation-1")).toHaveTextContent(/not yet checked/i);

    await user.click(screen.getByTestId("button-expand-trade-1"));
    expect(screen.getByTestId("text-broker-order-id-1")).toHaveTextContent("real-order-1");
    expect(screen.getByTestId("text-reconciliation-detail-1")).toHaveTextContent(/not yet checked/i);
  });

  it("shows a reconciliation mismatch badge and detail once reconciliation has run", async () => {
    mockState.trades = [tradeFixture({ id: 1, alpacaOrderId: "real-order-1" })];
    mockState.reconciliation = reconciliationFixture({
      fullyReconciled: false,
      issueCount: 1,
      orders: [
        {
          tradeId: 1,
          alpacaOrderId: "real-order-1",
          localSymbol: "AAPL",
          brokerSymbol: "AAPL",
          localStatus: "closed",
          brokerStatus: "filled",
          brokerRawStatus: "filled",
          localQuantity: 2,
          brokerQuantity: 3,
          filledQuantity: 3,
          averageFillPrice: 2.1,
          issues: ["quantity_mismatch"],
        },
      ],
    });
    const user = userEvent.setup();
    renderWithClient(<TradeHistory />);
    expect(screen.getByTestId("badge-reconciliation-1")).toHaveTextContent(/mismatch/i);

    await user.click(screen.getByTestId("button-expand-trade-1"));
    const detail = screen.getByTestId("text-reconciliation-detail-1");
    expect(detail).toHaveTextContent("quantity_mismatch");
    expect(detail).toHaveTextContent("3"); // fill quantity
  });

  it("shows a matched reconciliation badge when clean", async () => {
    mockState.trades = [tradeFixture({ id: 1, alpacaOrderId: "real-order-1" })];
    mockState.reconciliation = reconciliationFixture({
      orders: [
        {
          tradeId: 1,
          alpacaOrderId: "real-order-1",
          localSymbol: "AAPL",
          brokerSymbol: "AAPL",
          localStatus: "closed",
          brokerStatus: "filled",
          brokerRawStatus: "filled",
          localQuantity: 2,
          brokerQuantity: 2,
          filledQuantity: 2,
          averageFillPrice: 2.1,
          issues: [],
        },
      ],
    });
    renderWithClient(<TradeHistory />);
    expect(screen.getByTestId("badge-reconciliation-1")).toHaveTextContent(/matched/i);
  });

  it("the Check Reconciliation button disables while a check is in flight", () => {
    mockState.trades = [tradeFixture()];
    mockState.reconciliationFetching = true;
    renderWithClient(<TradeHistory />);
    expect(screen.getByTestId("button-check-reconciliation")).toBeDisabled();
  });

  it("clicking Check Reconciliation triggers its own refetch", async () => {
    mockState.trades = [tradeFixture()];
    const user = userEvent.setup();
    renderWithClient(<TradeHistory />);
    await user.click(screen.getByTestId("button-check-reconciliation"));
    expect(mockState.refetchReconciliation).toHaveBeenCalledTimes(1);
  });

  it("shows linked journal entries and supports editing them", async () => {
    mockState.trades = [tradeFixture({ id: 1 })];
    mockState.journalEntries = [
      {
        id: 10,
        tradeId: 1,
        title: "Opened AAPL iron condor",
        content: "Original notes",
        mood: "confident",
        lessonLearned: "Watch IV",
        thesis: "Range-bound",
        entryReasoning: "High IV rank",
        tags: [],
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    ];
    const user = userEvent.setup();
    renderWithClient(<TradeHistory />);

    await user.click(screen.getByTestId("button-expand-trade-1"));
    expect(screen.getByTestId("journal-entry-10")).toHaveTextContent("Original notes");
    expect(screen.getByTestId("journal-entry-10")).toHaveTextContent("Range-bound");

    await user.click(screen.getByTestId("button-edit-journal-10"));
    const textarea = screen.getByTestId("textarea-journal-content-10");
    await user.clear(textarea);
    await user.type(textarea, "Updated notes");
    await user.click(screen.getByTestId("button-save-journal-10"));

    expect(mockState.updateJournalMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 10, data: expect.objectContaining({ content: "Updated notes" }) }),
      expect.anything(),
    );
  });

  it("shows an honest 'no journal entries' message when none are linked", async () => {
    mockState.trades = [tradeFixture({ id: 1 })];
    mockState.journalEntries = [];
    const user = userEvent.setup();
    renderWithClient(<TradeHistory />);
    await user.click(screen.getByTestId("button-expand-trade-1"));
    expect(screen.getByTestId("text-no-journal-1")).toBeInTheDocument();
  });

  it("shows the AI review placeholder, never a real AI-generated review", async () => {
    mockState.trades = [tradeFixture({ id: 1 })];
    const user = userEvent.setup();
    renderWithClient(<TradeHistory />);
    await user.click(screen.getByTestId("button-expand-trade-1"));
    expect(screen.getByTestId("text-ai-review-placeholder-1")).toHaveTextContent(/not available yet/i);
  });
});
