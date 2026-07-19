// Phase 2, Sprint 28 — Portfolio Construction page smoke test, following the
// established mocked-generated-hook pattern (see StockScanner.test.tsx).
//
// Phase 13 — Institutional Portfolio Manager. Extended for the new tabbed UI
// (Overview/Holdings/Allocation/Quality/Risk/Performance/Income/Snapshots/
// Timeline/Notes) — Radix Tabs unmounts inactive TabsContent by default, so
// tests that assert on a non-default tab's content click its trigger first.

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
const savePortfolioSnapshotMutate = vi.fn();
const addNoteMutate = vi.fn();
const updateNoteMutate = vi.fn();
const deleteNoteMutate = vi.fn();

const mockState = vi.hoisted(() => ({
  portfolios: [] as unknown[],
  portfolio: undefined as unknown,
  watchlist: [] as unknown[],
  risk: undefined as unknown,
  snapshots: [] as unknown[],
  intelligence: undefined as unknown,
  watchlistComparison: undefined as unknown,
  portfolioSnapshots: [] as unknown[],
  notes: [] as unknown[],
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
    useGetPortfolioIntelligence: () => ({ data: mockState.intelligence, isLoading: false }),
    useGetPortfolioWatchlistComparison: () => ({ data: mockState.watchlistComparison }),
    useGetPortfolioSnapshots: () => ({ data: mockState.portfolioSnapshots }),
    useGetPortfolioNotes: () => ({ data: mockState.notes }),
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
    useSavePortfolioSnapshot: () => ({ mutate: savePortfolioSnapshotMutate, isPending: false }),
    useAddPortfolioNote: () => ({ mutate: addNoteMutate, isPending: false }),
    useUpdatePortfolioNote: () => ({ mutate: updateNoteMutate, isPending: false }),
    useDeletePortfolioNote: () => ({ mutate: deleteNoteMutate, isPending: false }),
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
    avgCostBasis: null,
    notes: "",
    currentPrice: 150,
    marketValue: 1500,
    actualWeightPct: 75,
    driftPct: 15,
    rebalanceAction: "sell",
    sector: "Technology",
    industry: "Consumer Electronics",
    beta: 1.2,
    marketCap: 3e12,
    ...over,
  };
}

function scoreCard(over: Record<string, unknown> = {}) {
  return { score: 70, label: "Strong", detail: "detail text", ...over };
}

function intelligenceFixture(over: Record<string, unknown> = {}) {
  return {
    qualityScore: scoreCard({ score: 78 }),
    capitalAllocationScore: scoreCard({ score: 65 }),
    diversificationScore: scoreCard({ score: 55 }),
    weightedMetrics: { roic: 0.18, roe: 0.22, grossMargin: 0.45, operatingMargin: 0.25, fcfYield: 0.05, dividendYield: 0.01, debtToEquity: 0.4 },
    allocation: {
      bySector: [{ label: "Technology", weightPct: 100 }],
      byIndustry: [{ label: "Consumer Electronics", weightPct: 100 }],
      byMarketCapBand: [{ label: "Mega Cap", weightPct: 100 }],
      byCountry: { available: false, reason: "No provider reports country of domicile." },
      byCurrency: { available: false, reason: "No provider reports reporting currency." },
      growthValueMix: [{ label: "Growth", weightPct: 100 }],
      qualityMix: [{ label: "High Quality", weightPct: 100 }],
      largestPositionPct: 100,
      top10ExposurePct: 100,
      cashAllocationPct: 0,
      cashAllocationNote: "Defined as unallocated target weight — not a claim about brokerage cash.",
    },
    risk: {
      overall: scoreCard({ score: 60 }),
      concentration: { score: 45, label: "Elevated", detail: "d", largestSymbol: "AAPL", largestSymbolWeightPct: 100, capBreached: true },
      sectorExposure: { score: null, label: "Insufficient data", detail: "d", largestSector: null, largestSectorWeightPct: null, capBreached: false, breakdown: [], unclassifiedWeightPct: null },
      cyclicality: { score: 80, label: "Low", detail: "d", portfolioBeta: 0.7, coveragePct: 100 },
      cashRisk: scoreCard({ score: 90, detail: "0% unallocated — within a normal range." }),
      dividendDependence: scoreCard({ score: 85, detail: "Dividend income is a modest share of this portfolio's expected return." }),
      leverageExposure: scoreCard({ score: 70, detail: "Leverage detail" }),
      qualityDrift: scoreCard({ score: null, label: "Insufficient data", detail: "No prior saved snapshot to compare against yet." }),
      portfolioStability: scoreCard({ score: 60 }),
    },
    income: { portfolioDividendYield: 0.01, estAnnualDividendIncome: 150 },
    performance: {
      totalCostBasisValue: 1000,
      totalMarketValue: 1500,
      totalUnrealizedPnl: 500,
      totalUnrealizedPnlPct: 50,
      holdingsWithoutCostBasis: [],
    },
    holdings: [
      {
        symbol: "AAPL",
        weightPct: 100,
        qualityScore: 78,
        capitalAllocationScore: 65,
        growthScore: 70,
        valuationRating: "Fair",
        committeeVerdict: "Hold",
        marketCapBand: "Mega Cap",
        shares: 10,
        avgCostBasis: 100,
        currentPrice: 150,
        costBasisValue: 1000,
        marketValue: 1500,
        unrealizedPnl: 500,
        unrealizedPnlPct: 50,
        dividendYield: 0.01,
        dividendPerShare: 1,
        estAnnualDividendIncome: 10,
        suggestedShareDelta: 2.5,
      },
    ],
    unresolvedSymbols: [],
    summary: "1 holding analyzed. Quality: 78/100 (Strong).",
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
    savePortfolioSnapshotMutate.mockReset();
    addNoteMutate.mockReset();
    updateNoteMutate.mockReset();
    deleteNoteMutate.mockReset();
    mockState.portfolios = [portfolioSummary()];
    mockState.portfolio = undefined;
    mockState.watchlist = [];
    mockState.risk = undefined;
    mockState.snapshots = [];
    mockState.intelligence = undefined;
    mockState.watchlistComparison = undefined;
    mockState.portfolioSnapshots = [];
    mockState.notes = [];
  });

  it("renders the advisory-only copy, permanent labels, and lists existing portfolios", () => {
    renderWithClient(<PortfolioConstruction />);
    expect(screen.getByText(/never places, schedules, or submits any trade/i)).toBeInTheDocument();
    expect(screen.getByTestId("portfolio-Core Value")).toBeInTheDocument();
    const labels = screen.getByTestId("portfolio-manager-labels");
    expect(labels).toHaveTextContent("Institutional Portfolio Manager");
    expect(labels).toHaveTextContent("Educational");
    expect(labels).toHaveTextContent("Deterministic");
    expect(labels).toHaveTextContent("Data Driven");
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

  it("deletes a portfolio via its row delete button", async () => {
    renderWithClient(<PortfolioConstruction />);
    await userEvent.click(screen.getByTestId("delete-portfolio-Core Value"));
    expect(deleteMutate).toHaveBeenCalledWith({ id: 1 }, expect.anything());
  });

  function selectPortfolio() {
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
  }

  it("Overview tab shows headline scores, summary, and the watchlist comparison", async () => {
    selectPortfolio();
    mockState.intelligence = intelligenceFixture();
    mockState.watchlistComparison = { inBoth: ["AAPL"], onlyInWatchlist: [], onlyInPortfolio: [], summary: "1 symbol(s) tracked on both." };
    renderWithClient(<PortfolioConstruction />);
    await userEvent.click(screen.getByTestId("portfolio-Core Value"));
    // "Quality: 78" legitimately appears twice — once in the headline badge,
    // once inside the deterministic summary sentence.
    expect(await screen.findAllByText(/Quality: 78/)).toHaveLength(2);
    expect(screen.getByText(/Capital Allocation: 65/)).toBeInTheDocument();
    expect(screen.getByText(/Diversification: 55/)).toBeInTheDocument();
    expect(screen.getByText(/1 symbol\(s\) tracked on both/)).toBeInTheDocument();
  });

  it("Holdings tab shows the drift/rebalance table, a cost-basis input, and the rebalance-assistant badges", async () => {
    selectPortfolio();
    mockState.intelligence = intelligenceFixture();
    renderWithClient(<PortfolioConstruction />);
    await userEvent.click(screen.getByTestId("portfolio-Core Value"));
    await userEvent.click(screen.getByTestId("tab-holdings"));
    expect(await screen.findByTestId("holding-AAPL")).toBeInTheDocument();
    expect(screen.getByText(/sell/i)).toBeInTheDocument();
    expect(screen.getByText(/Target weights sum to 60%/i)).toBeInTheDocument();
    expect(screen.getByTestId("cost-basis-input-AAPL")).toBeInTheDocument();
    expect(screen.getByText(/AAPL: \+2.5 shares/)).toBeInTheDocument();
  });

  it("updates a holding's cost basis via the Holdings tab input", async () => {
    selectPortfolio();
    mockState.intelligence = intelligenceFixture();
    renderWithClient(<PortfolioConstruction />);
    await userEvent.click(screen.getByTestId("portfolio-Core Value"));
    await userEvent.click(screen.getByTestId("tab-holdings"));
    const input = await screen.findByTestId("cost-basis-input-AAPL");
    await userEvent.type(input, "150");
    await userEvent.tab();
    expect(updateHoldingMutate).toHaveBeenCalledWith(
      { id: 1, holdingId: 1, data: { avgCostBasis: 150 } },
      expect.anything(),
    );
  });

  it("bulk-adds watchlist symbols not already held, using equal-weight distribution", async () => {
    mockState.watchlist = [{ symbol: "MSFT" }, { symbol: "GOOGL" }];
    selectPortfolio();
    mockState.intelligence = intelligenceFixture();
    renderWithClient(<PortfolioConstruction />);
    await userEvent.click(screen.getByTestId("portfolio-Core Value"));
    await userEvent.click(screen.getByTestId("tab-holdings"));
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

  it("Allocation tab shows sector/industry/market-cap/growth-value/quality slices and honest country/currency unavailability", async () => {
    selectPortfolio();
    mockState.intelligence = intelligenceFixture();
    renderWithClient(<PortfolioConstruction />);
    await userEvent.click(screen.getByTestId("portfolio-Core Value"));
    await userEvent.click(screen.getByTestId("tab-allocation"));
    expect(await screen.findByTestId("allocation-content")).toBeInTheDocument();
    expect(screen.getByText("Technology")).toBeInTheDocument();
    expect(screen.getByText("Consumer Electronics")).toBeInTheDocument();
    expect(screen.getByText("Mega Cap")).toBeInTheDocument();
    expect(screen.getByTestId("country-unavailable")).toHaveTextContent(/No provider reports country/);
    expect(screen.getByTestId("currency-unavailable")).toHaveTextContent(/No provider reports reporting currency/);
  });

  it("Quality tab shows portfolio scores and a per-holding quality/valuation table", async () => {
    selectPortfolio();
    mockState.intelligence = intelligenceFixture();
    renderWithClient(<PortfolioConstruction />);
    await userEvent.click(screen.getByTestId("portfolio-Core Value"));
    await userEvent.click(screen.getByTestId("tab-quality"));
    expect(await screen.findByText("Fair")).toBeInTheDocument();
    expect(screen.getByText("Hold")).toBeInTheDocument();
  });

  it("Risk tab shows the original risk panel plus the new extended risk dimensions", async () => {
    selectPortfolio();
    mockState.risk = {
      overall: { score: 42, label: "Elevated", detail: "single-symbol concentration cap breached" },
      concentration: { score: 45, label: "Elevated", detail: "detail", largestSymbol: "AAPL", largestSymbolWeightPct: 100, capBreached: true },
      sectorExposure: { score: null, label: "Insufficient data", detail: "detail", largestSector: null, largestSectorWeightPct: null, capBreached: false, breakdown: [], unclassifiedWeightPct: null },
      betaEstimate: { score: 80, label: "Low", detail: "detail", portfolioBeta: 0.7, coveragePct: 100 },
      components: [],
      totalMarketValue: 1500,
      unresolvedSymbols: [],
    };
    mockState.intelligence = intelligenceFixture();
    renderWithClient(<PortfolioConstruction />);
    await userEvent.click(screen.getByTestId("portfolio-Core Value"));
    await userEvent.click(screen.getByTestId("tab-risk"));
    expect(await screen.findByTestId("risk-panel")).toBeInTheDocument();
    expect(screen.getByTestId("risk-overall-badge")).toHaveTextContent("42");
    expect(screen.getByText(/single-symbol concentration cap breached/i)).toBeInTheDocument();

    const extended = screen.getByTestId("extended-risk");
    expect(extended).toHaveTextContent("Cash Risk");
    expect(extended).toHaveTextContent("Dividend Dependence");
    expect(extended).toHaveTextContent("Leverage Exposure");
    expect(extended).toHaveTextContent("Quality Drift");
    expect(extended).toHaveTextContent("Portfolio Stability");
    expect(extended).toHaveTextContent("No prior saved snapshot to compare against yet.");

    await userEvent.click(screen.getByTestId("save-snapshot-button"));
    expect(saveRiskSnapshotMutate).toHaveBeenCalledWith({ id: 1 }, expect.anything());
  });

  it("disables Save Risk Snapshot when risk could not be scored", async () => {
    selectPortfolio();
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
    await userEvent.click(screen.getByTestId("tab-risk"));
    expect(await screen.findByTestId("risk-panel")).toBeInTheDocument();
    expect(screen.getByTestId("save-snapshot-button")).toBeDisabled();
  });

  it("Performance tab shows real cost-basis-driven unrealized P&L", async () => {
    selectPortfolio();
    mockState.intelligence = intelligenceFixture();
    renderWithClient(<PortfolioConstruction />);
    await userEvent.click(screen.getByTestId("portfolio-Core Value"));
    await userEvent.click(screen.getByTestId("tab-performance"));
    expect(await screen.findByText(/Unrealized P&L: \$500\.00 \(50%\)/)).toBeInTheDocument();
  });

  it("Income tab shows portfolio dividend yield and a per-holding income table", async () => {
    selectPortfolio();
    mockState.intelligence = intelligenceFixture();
    renderWithClient(<PortfolioConstruction />);
    await userEvent.click(screen.getByTestId("portfolio-Core Value"));
    await userEvent.click(screen.getByTestId("tab-income"));
    expect(await screen.findByText(/Portfolio dividend yield: 1.00%/)).toBeInTheDocument();
    expect(screen.getByText(/Est. annual income: \$150\.00/)).toBeInTheDocument();
  });

  it("Snapshots tab saves a composite snapshot and lists risk-only snapshots too", async () => {
    selectPortfolio();
    mockState.intelligence = intelligenceFixture();
    mockState.snapshots = [{ id: 9, portfolioId: 1, overallScore: 60, analysis: {}, createdAt: new Date().toISOString() }];
    renderWithClient(<PortfolioConstruction />);
    await userEvent.click(screen.getByTestId("portfolio-Core Value"));
    await userEvent.click(screen.getByTestId("tab-snapshots"));
    expect(await screen.findByTestId("snapshot-history")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("save-portfolio-snapshot-button"));
    expect(savePortfolioSnapshotMutate).toHaveBeenCalledWith({ id: 1 }, expect.anything());
  });

  it("Timeline tab shows an honest empty state with no saved portfolio snapshots", async () => {
    selectPortfolio();
    mockState.intelligence = intelligenceFixture();
    renderWithClient(<PortfolioConstruction />);
    await userEvent.click(screen.getByTestId("portfolio-Core Value"));
    await userEvent.click(screen.getByTestId("tab-timeline"));
    expect(await screen.findByText(/No saved snapshots yet/)).toBeInTheDocument();
  });

  it("Timeline tab lists real saved portfolio snapshots newest-first", async () => {
    selectPortfolio();
    mockState.intelligence = intelligenceFixture();
    mockState.portfolioSnapshots = [
      { id: 1, portfolioId: 1, qualityScore: 50, riskScore: 50, diversificationScore: 50, totalMarketValue: 1000, holdingsCount: 1, analysis: {}, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: 2, portfolioId: 1, qualityScore: 78, riskScore: 60, diversificationScore: 55, totalMarketValue: 1500, holdingsCount: 1, analysis: {}, createdAt: "2026-02-01T00:00:00.000Z" },
    ];
    renderWithClient(<PortfolioConstruction />);
    await userEvent.click(screen.getByTestId("portfolio-Core Value"));
    await userEvent.click(screen.getByTestId("tab-timeline"));
    const timeline = await screen.findByTestId("timeline-content");
    expect(timeline).toHaveTextContent("Quality 78");
    expect(timeline).toHaveTextContent("Quality 50");
  });

  it("Notes tab supports adding, editing, and deleting a note", async () => {
    selectPortfolio();
    mockState.intelligence = intelligenceFixture();
    mockState.notes = [{ id: 5, portfolioId: 1, note: "Watching for a pullback.", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }];
    renderWithClient(<PortfolioConstruction />);
    await userEvent.click(screen.getByTestId("portfolio-Core Value"));
    await userEvent.click(screen.getByTestId("tab-notes"));
    expect(await screen.findByTestId("note-5")).toHaveTextContent("Watching for a pullback.");

    await userEvent.type(screen.getByTestId("new-note-textarea"), "New thesis note");
    await userEvent.click(screen.getByTestId("add-note-button"));
    expect(addNoteMutate).toHaveBeenCalledWith({ id: 1, data: { note: "New thesis note" } }, expect.anything());

    await userEvent.click(screen.getByTestId("edit-note-5"));
    expect(screen.getByDisplayValue("Watching for a pullback.")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Cancel"));

    await userEvent.click(screen.getByTestId("delete-note-5"));
    expect(deleteNoteMutate).toHaveBeenCalledWith({ id: 1, noteId: 5 }, expect.anything());
  });
});
