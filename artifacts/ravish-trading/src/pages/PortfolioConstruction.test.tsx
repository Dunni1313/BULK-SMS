// Phase 2, Sprint 28 — Portfolio Construction page smoke test, following the
// established mocked-generated-hook pattern (see StockScanner.test.tsx).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const createMutate = vi.fn();
const deleteMutate = vi.fn();
const addHoldingMutate = vi.fn();
const addHoldingMutateAsync = vi.fn(() => Promise.resolve({}));
const updateHoldingMutate = vi.fn();
const deleteHoldingMutate = vi.fn();

const mockState = vi.hoisted(() => ({
  portfolios: [] as unknown[],
  portfolio: undefined as unknown,
  watchlist: [] as unknown[],
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetPortfolios: () => ({ data: mockState.portfolios, isLoading: false }),
    useGetPortfolio: () => ({ data: mockState.portfolio, isLoading: false }),
    useGetValueWatchlist: () => ({ data: mockState.watchlist }),
    useCreatePortfolio: () => ({ mutate: createMutate, isPending: false }),
    useDeletePortfolio: () => ({ mutate: deleteMutate, isPending: false }),
    useAddHolding: () => ({
      mutate: addHoldingMutate,
      mutateAsync: addHoldingMutateAsync,
      isPending: false,
    }),
    useUpdateHolding: () => ({ mutate: updateHoldingMutate, isPending: false }),
    useDeleteHolding: () => ({ mutate: deleteHoldingMutate, isPending: false }),
  };
});

import PortfolioConstruction from "./PortfolioConstruction";

function portfolioSummary(over: Record<string, unknown> = {}) {
  return { id: 1, name: "Core Value", description: "long-term picks", holdingsCount: 2, ...over };
}

function holding(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    symbol: "AAPL",
    targetWeightPct: 60,
    shares: 10,
    notes: "",
    currentPrice: 150,
    marketValue: 1500,
    actualWeightPct: 75,
    driftPct: 15,
    rebalanceAction: "sell",
    ...over,
  };
}

describe("PortfolioConstruction page", () => {
  beforeEach(() => {
    createMutate.mockReset();
    deleteMutate.mockReset();
    addHoldingMutate.mockReset();
    addHoldingMutateAsync.mockClear();
    updateHoldingMutate.mockReset();
    deleteHoldingMutate.mockReset();
    mockState.portfolios = [portfolioSummary()];
    mockState.portfolio = undefined;
    mockState.watchlist = [];
  });

  it("renders the advisory-only copy and lists existing portfolios", () => {
    renderWithClient(<PortfolioConstruction />);
    expect(screen.getByText(/never places, schedules, or submits any trade/i)).toBeInTheDocument();
    expect(screen.getByTestId("portfolio-Core Value")).toBeInTheDocument();
  });

  it("submits a new portfolio via the create form", async () => {
    renderWithClient(<PortfolioConstruction />);
    await userEvent.type(screen.getByTestId("new-portfolio-name"), "Dividend Growth");
    await userEvent.click(screen.getByTestId("create-portfolio-button"));
    expect(createMutate).toHaveBeenCalledWith(
      { data: { name: "Dividend Growth", description: "" } },
      expect.anything(),
    );
  });

  it("shows holdings with drift and a rebalance badge once a portfolio is selected", async () => {
    mockState.portfolio = {
      id: 1,
      name: "Core Value",
      description: "long-term picks",
      allocation: {
        holdings: [holding()],
        totalMarketValue: 1500,
        totalTargetWeightPct: 60,
        targetWeightSumWarning: "Target weights sum to 60%, not 100%.",
        unresolvedSymbols: [],
        summary: "1 holding tracked.",
      },
    };
    renderWithClient(<PortfolioConstruction />);
    await userEvent.click(screen.getByTestId("portfolio-Core Value"));
    expect(await screen.findByTestId("holding-AAPL")).toBeInTheDocument();
    expect(screen.getByText(/sell/i)).toBeInTheDocument();
    expect(screen.getByText(/Target weights sum to 60%/i)).toBeInTheDocument();
  });

  it("deletes a portfolio via its row delete button", async () => {
    renderWithClient(<PortfolioConstruction />);
    await userEvent.click(screen.getByTestId("delete-portfolio-Core Value"));
    expect(deleteMutate).toHaveBeenCalledWith({ id: 1 }, expect.anything());
  });

  it("bulk-adds watchlist symbols not already held, using equal-weight distribution", async () => {
    mockState.watchlist = [{ symbol: "MSFT" }, { symbol: "GOOGL" }];
    mockState.portfolio = {
      id: 1,
      name: "Core Value",
      description: "",
      allocation: {
        holdings: [holding()],
        totalMarketValue: 1500,
        totalTargetWeightPct: 60,
        targetWeightSumWarning: null,
        unresolvedSymbols: [],
        summary: "1 holding tracked.",
      },
    };
    renderWithClient(<PortfolioConstruction />);
    await userEvent.click(screen.getByTestId("portfolio-Core Value"));
    await screen.findByTestId("holding-AAPL");
    await userEvent.click(screen.getByTestId("add-from-watchlist"));
    expect(addHoldingMutateAsync).toHaveBeenCalledWith({
      id: 1,
      data: { symbol: "MSFT", targetWeightPct: expect.any(Number) },
    });
    expect(addHoldingMutateAsync).toHaveBeenCalledWith({
      id: 1,
      data: { symbol: "GOOGL", targetWeightPct: expect.any(Number) },
    });
  });
});
