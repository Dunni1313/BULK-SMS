import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

type HookResult = { data: unknown; isLoading?: boolean };

const addMutate = vi.fn();

const mockState = vi.hoisted(() => ({
  valueUniverse: { data: [] as unknown[], isLoading: false } as HookResult,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<
    typeof import("@workspace/api-client-react")
  >("@workspace/api-client-react");
  return {
    ...actual,
    useGetValueUniverse: () => mockState.valueUniverse,
    useGetValueWatchlist: () => ({ data: [] }),
    useGetSettings: () => ({ data: { fundamentalsConnected: false } }),
    useAddValueWatchlist: () => ({ mutate: addMutate, isPending: false }),
  };
});

import StockScanner from "./StockScanner";

function row(over: Record<string, unknown>) {
  return {
    symbol: "AAA",
    name: "Aaa Inc",
    kind: "stock",
    price: 100,
    businessQualityScore: 80,
    businessQualityRating: "Wonderful",
    moatRating: "Wide",
    financialStrength: "Strong",
    valuationRating: "Fair",
    marginOfSafety: 0.1,
    decision: "HOLD",
    stockInvestmentScore: 78,
    optionsSuitabilityScore: 55,
    useCase: "Stock",
    suggestedAction: "Hold",
    dataSource: "Simulated",
    fetchedAt: new Date().toISOString(),
    simulated: true,
    ...over,
  };
}

describe("StockScanner page", () => {
  beforeEach(() => {
    addMutate.mockReset();
    mockState.valueUniverse = {
      data: [
        row({ symbol: "META", name: "Meta Platforms Inc", useCase: "Stock", stockInvestmentScore: 91 }),
        row({ symbol: "AAPL", name: "Apple Inc", useCase: "Options", optionsSuitabilityScore: 75 }),
      ],
      isLoading: false,
    };
  });

  it("renders ranked rows with the SIMULATED label and advisory copy", async () => {
    renderWithClient(<StockScanner />);
    expect(await screen.findByTestId("scanner-row-META")).toBeInTheDocument();
    expect(screen.getByTestId("scanner-row-AAPL")).toBeInTheDocument();
    expect(screen.getByText(/never executes, sizes, or recommends/i)).toBeInTheDocument();
  });

  it("filters to options-suitable names only", async () => {
    renderWithClient(<StockScanner />);
    await screen.findByTestId("scanner-row-META");
    await userEvent.click(screen.getByTestId("filter-options"));
    expect(screen.queryByTestId("scanner-row-META")).not.toBeInTheDocument();
    expect(screen.getByTestId("scanner-row-AAPL")).toBeInTheDocument();
  });

  it("enables Compare only after selecting two and opens a comparison dialog", async () => {
    renderWithClient(<StockScanner />);
    await screen.findByTestId("scanner-row-META");
    const compare = screen.getByTestId("compare-button");
    expect(compare).toBeDisabled();
    await userEvent.click(screen.getByTestId("select-META"));
    expect(compare).toBeDisabled();
    await userEvent.click(screen.getByTestId("select-AAPL"));
    expect(compare).toBeEnabled();
    await userEvent.click(compare);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Compare 2 stocks/i)).toBeInTheDocument();
  });

  it("adds a symbol to the watchlist", async () => {
    renderWithClient(<StockScanner />);
    await screen.findByTestId("scanner-row-META");
    await userEvent.click(screen.getByTestId("watchlist-META"));
    expect(addMutate).toHaveBeenCalledWith(
      { data: { symbol: "META" } },
      expect.anything(),
    );
  });
});
