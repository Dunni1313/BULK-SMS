import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";

type TradesHookResult = { data: unknown; isLoading: boolean };

const mockState = vi.hoisted(() => ({
  trades: { data: undefined, isLoading: true } as TradesHookResult,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<
    typeof import("@workspace/api-client-react")
  >("@workspace/api-client-react");
  return {
    ...actual,
    useListTrades: () => mockState.trades,
    useListTradeAdjustments: () => ({ data: [] }),
    useCloseTrade: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

import Trades from "./Trades";

describe("Trades page (mocked hooks)", () => {
  beforeEach(() => {
    mockState.trades = { data: undefined, isLoading: true };
  });

  it("shows the empty-state copy when there are no trades", async () => {
    mockState.trades = { data: [], isLoading: false };

    renderWithClient(<Trades />);

    expect(await screen.findByText("No trades found.")).toBeInTheDocument();
  });

  it("shows loading skeletons (not the empty state) while trades load", async () => {
    mockState.trades = { data: undefined, isLoading: true };

    const { container } = renderWithClient(<Trades />);

    await screen.findByText("Trade Log");

    expect(
      container.querySelectorAll(".animate-pulse").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("No trades found.")).not.toBeInTheDocument();
  });
});
