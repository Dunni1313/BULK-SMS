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
const saveRiskSnapshotMutate = vi.fn();

const mockState = vi.hoisted(() => ({
  portfolios: [] as unknown[],
  portfolio: undefined as unknown,
  watchlist: [] as unknown[],
  risk: undefined as unknown,
  snapshots: [] as unknown[],
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
    useGetPortfolioRisk: () => ({ data: mockState.risk, isLoading: false }),
    useGetPortfolioRiskSnapshots: () => ({ data: mockState.snapshots }),
    useCreatePortfolio: () => ({ mutate: createMutate, isPending: false }),
    useDeletePortfolio: () => ({ mutate: deleteMutate, isPending: false }),
    useAddHolding: () => ({
      mutate: addHoldingMutate,
      mutateAsync: addHoldingMutateAsync,
      isPending: false,
    }),
    useUpdateHolding: () => ({ mutate: updateHoldingMutate, isPending: false }),
    useDeleteHolding: () => ({ mutate: deleteHoldingMutate, isPending: false }),
    useSaveRiskSnapshot: () => ({ mutate: saveRiskSnapshotMutate, isPending: false }),
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
    saveRiskSnapshotMutate.mockReset();
    mockState.portfolios = [portfolioSummary()];
    mockState.portfolio = undefined;
    mockState.watchlist = [];
    mockState.risk = undefined;
    mockState.snapshots = [];
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

  // Phase 2, Sprint 29 — Portfolio Risk Analysis panel.
  it("shows the risk panel with concentration/sector/beta badges and saves a snapshot", async () => {
    mockState.portfolio = {
      id: 1,
      name: "Core Value",
      description: "",
      allocation: {
        holdings: [holding()],
        totalMarketValue: 1500,
        totalTargetWeightPct: 100,
        targetWeightSumWarning: null,
        unresolvedSymbols: [],
        summary: "1 holding tracked.",
      },
    };
    mockState.risk = {
      overall: { score: 42, label: "Elevated", detail: "single-symbol concentration cap breached" },
      concentration: { score: 45, label: "Elevated", detail: "detail", largestSymbol: "AAPL", largestSymbolWeightPct: 100, capBreached: true },
      sectorExposure: { score: null, label: "Insufficient data", detail: "detail", largestSector: null, largestSectorWeightPct: null, capBreached: false, breakdown: [], unclassifiedWeightPct: null },
      betaEstimate: { score: 80, label: "Low", detail: "detail", portfolioBeta: 0.7, coveragePct: 100 },
      components: [],
      totalMarketValue: 1500,
      unresolvedSymbols: [],
    };
    renderWithClient(<PortfolioConstruction />);
    await userEvent.click(screen.getByTestId("portfolio-Core Value"));
    expect(await screen.findByTestId("risk-panel")).toBeInTheDocument();
    expect(screen.getByTestId("risk-overall-badge")).toHaveTextContent("42");
    expect(screen.getByText(/single-symbol concentration cap breached/i)).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("save-snapshot-button"));
    expect(saveRiskSnapshotMutate).toHaveBeenCalledWith({ id: 1 }, expect.anything());
  });

  it("disables Save Snapshot when risk could not be scored", async () => {
    mockState.portfolio = {
      id: 1,
      name: "Core Value",
      description: "",
      allocation: { holdings: [], totalMarketValue: null, totalTargetWeightPct: 0, targetWeightSumWarning: null, unresolvedSymbols: [], summary: "No holdings yet." },
    };
    mockState.risk = {
      overall: { score: null, label: "Insufficient data", detail: "detail" },
      concentration: { score: null, label: "Insufficient data", detail: "detail", largestSymbol: null, largestSymbolWeightPct: null, capBreached: false },
      sectorExposure: { score: null, label: "Insufficient data", detail: "detail", largestSector: null, largestSectorWeightPct: null, capBreached: false, breakdown: [], unclassifiedWeightPct: null },
      betaEstimate: { score: null, label: "Insufficient data", detail: "detail", portfolioBeta: null, coveragePct: null },
      components: [],
      totalMarketValue: null,
      unresolvedSymbols: [],
    };
    renderWithClient(<PortfolioConstruction />);
    await userEvent.click(screen.getByTestId("portfolio-Core Value"));
    expect(await screen.findByTestId("risk-panel")).toBeInTheDocument();
    expect(screen.getByTestId("save-snapshot-button")).toBeDisabled();
  });
});
