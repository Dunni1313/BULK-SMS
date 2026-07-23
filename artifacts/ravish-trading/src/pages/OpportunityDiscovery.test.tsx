// Phase 15 — Institutional Opportunity Discovery Engine. Frontend smoke
// tests, mirroring DecisionEngine.test.tsx's own established
// mocked-generated-hook pattern.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

type HookResult = { data: unknown; isLoading?: boolean; isError?: boolean };

const mockState = vi.hoisted(() => ({
  portfolios: { data: [] as unknown[] } as HookResult,
  savedScreens: { data: [] as unknown[] } as HookResult,
  scan: { data: undefined as unknown, isPending: false, isError: false } as HookResult & { isPending: boolean },
  compare: { data: undefined as unknown, isLoading: false } as HookResult,
}));

const scanMutateMock = vi.hoisted(() => vi.fn());
const createScreenMutateMock = vi.hoisted(() => vi.fn());
const deleteScreenMutateMock = vi.hoisted(() => vi.fn());
const addWatchlistMutateMock = vi.hoisted(() => vi.fn());
const refetchSavedScreensMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQuery: () => mockState.compare,
  };
});

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetPortfolios: () => mockState.portfolios,
    useGetSavedScreens: () => ({ ...mockState.savedScreens, refetch: refetchSavedScreensMock }),
    useScanOpportunities: () => ({ mutate: scanMutateMock, data: mockState.scan.data, isPending: mockState.scan.isPending, isError: mockState.scan.isError }),
    useCreateSavedScreen: () => ({ mutate: createScreenMutateMock, isPending: false }),
    useDeleteSavedScreen: () => ({ mutate: deleteScreenMutateMock, isPending: false }),
    useAddValueWatchlist: () => ({ mutate: addWatchlistMutateMock, isPending: false }),
  };
});

import OpportunityDiscovery from "./OpportunityDiscovery";

function fixtureRow(overrides: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    name: "Apple Inc",
    kind: "stock",
    price: 195,
    sector: "Technology",
    industry: "Consumer Electronics",
    businessQualityScore: 78,
    businessQualityRating: "Wonderful",
    investmentQualityScore: 80,
    moatRating: "Wide",
    moatScore: 82,
    competitiveAdvantageScore: 75,
    financialStrengthRating: "Strong",
    financialStrengthScore: 85,
    valuationRating: "Cheap",
    marginOfSafety: 0.2,
    marketCap: 3e12,
    revenueGrowth5y: 0.1,
    roic: 0.3,
    roe: 0.35,
    debtToEquity: 0.2,
    fcfMargin: 0.25,
    dividendYield: 0.01,
    investmentCommitteeVerdict: "Buy",
    investmentCommitteeConfidence: 80,
    tomNashConvictionScore: 80,
    tomNashVerdict: "Buy",
    decisionRecommendation: "Buy",
    rankScore: 80,
    rankExplanation: "AAPL ranks with a synthesis score of 80/100 (Decision Engine: Buy).",
    dataSource: "SIMULATED",
    fetchedAt: new Date().toISOString(),
    simulated: true,
    ...overrides,
  };
}

function fixtureScanResult(overrides: Record<string, unknown> = {}) {
  const row = fixtureRow();
  return {
    universeSize: 1,
    unresolvedSymbols: [],
    scannedAt: new Date().toISOString(),
    unavailableFilters: [],
    totalBeforeFilter: 1,
    rows: [row],
    buckets: [
      { category: "top-opportunities", label: "Top Opportunities", rule: "Highest synthesis score among Buy/Accumulate.", rows: [row] },
      { category: "undervalued", label: "Undervalued Companies", rule: "Margin of safety >= 15%.", rows: [row] },
      { category: "high-quality", label: "High Quality Companies", rule: "Investment Quality score >= 70.", rows: [row] },
      { category: "wide-moat", label: "Wide Moat Companies", rule: "Moat rating Wide.", rows: [row] },
      { category: "dividend", label: "Dividend Opportunities", rule: "Dividend yield >= 2%.", rows: [] },
      { category: "growth", label: "Growth Opportunities", rule: "Revenue growth >= 15%.", rows: [] },
      { category: "deep-value", label: "Deep Value Opportunities", rule: "Deep margin of safety + non-trivial quality.", rows: [] },
      { category: "turnaround", label: "Turnaround Candidates", rule: "Out of favor but not distressed.", rows: [] },
      { category: "watchlist-candidates", label: "Watchlist Candidates", rule: "Buy/Accumulate not yet on Watchlist.", rows: [row] },
      { category: "portfolio-upgrade-candidates", label: "Portfolio Upgrade Candidates", rule: "Buy not yet held.", rows: [] },
    ],
    ...overrides,
  };
}

describe("OpportunityDiscovery page", () => {
  beforeEach(() => {
    mockState.portfolios = { data: [] };
    mockState.savedScreens = { data: [] };
    mockState.scan = { data: undefined, isPending: false, isError: false };
    mockState.compare = { data: undefined, isLoading: false };
    scanMutateMock.mockReset();
    createScreenMutateMock.mockReset();
    deleteScreenMutateMock.mockReset();
    addWatchlistMutateMock.mockReset();
    refetchSavedScreensMock.mockReset();
  });

  it("shows the permanent labels and the empty state before any scan runs", () => {
    renderWithClient(<OpportunityDiscovery />);
    expect(screen.getByTestId("badge-label-educational")).toBeInTheDocument();
    expect(screen.getByTestId("badge-label-deterministic")).toBeInTheDocument();
    expect(screen.getByTestId("badge-label-evidence-based")).toBeInTheDocument();
  });

  it("Run Scan submits the entered symbols and filters", async () => {
    renderWithClient(<OpportunityDiscovery />);
    await userEvent.type(screen.getByTestId("input-symbols"), "AAPL, MSFT");
    await userEvent.type(screen.getByTestId("input-min-roic"), "15");
    await userEvent.click(screen.getByTestId("button-run-scan"));

    expect(scanMutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          symbols: ["AAPL", "MSFT"],
          filters: expect.objectContaining({ minRoic: 0.15 }),
        }),
      }),
    );
  });

  it("renders opportunity buckets and the ranked table once a scan resolves", async () => {
    mockState.scan = { data: fixtureScanResult(), isPending: false, isError: false };
    renderWithClient(<OpportunityDiscovery />);

    expect(screen.getByTestId("card-bucket-top-opportunities")).toBeInTheDocument();
    expect(screen.getByTestId("card-bucket-wide-moat")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("tab-rankings"));
    expect(screen.getByTestId("row-opportunity-AAPL")).toBeInTheDocument();
  });

  it("never fabricates a filtered result — an unavailable Country filter is disclosed", () => {
    mockState.scan = { data: fixtureScanResult({ unavailableFilters: ["country"] }), isPending: false, isError: false };
    renderWithClient(<OpportunityDiscovery />);
    expect(screen.getByTestId("text-unavailable-filters")).toHaveTextContent("country");
  });

  it("honestly reports unresolved symbols rather than hiding them", async () => {
    mockState.scan = { data: fixtureScanResult({ unresolvedSymbols: ["NOTREAL"] }), isPending: false, isError: false };
    renderWithClient(<OpportunityDiscovery />);
    await userEvent.click(screen.getByTestId("tab-rankings"));
    expect(screen.getByText(/could not be resolved/i)).toBeInTheDocument();
  });

  it("Add to Watchlist one-click action calls the existing watchlist endpoint", async () => {
    mockState.scan = { data: fixtureScanResult(), isPending: false, isError: false };
    renderWithClient(<OpportunityDiscovery />);
    await userEvent.click(screen.getAllByTestId("button-add-watchlist-AAPL")[0]);
    expect(addWatchlistMutateMock).toHaveBeenCalledWith(
      { data: { symbol: "AAPL" } },
      expect.anything(),
    );
  });

  it("Save Screen submits the current filters with a name", async () => {
    renderWithClient(<OpportunityDiscovery />);
    await userEvent.type(screen.getByTestId("input-sector"), "Technology");
    await userEvent.type(screen.getByTestId("input-save-screen-name"), "My Tech Screen");
    await userEvent.click(screen.getByTestId("button-save-screen"));
    expect(createScreenMutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "My Tech Screen", filters: expect.objectContaining({ sector: "Technology" }) }) }),
      expect.anything(),
    );
  });

  it("Saved Screens tab shows the honest empty state when none exist", async () => {
    renderWithClient(<OpportunityDiscovery />);
    await userEvent.click(screen.getByTestId("tab-saved-screens"));
    expect(screen.getByTestId("text-no-saved-screens")).toBeInTheDocument();
  });

  it("Saved Screens tab lists a saved screen with Apply and Delete actions", async () => {
    mockState.savedScreens = { data: [{ id: 1, name: "High ROIC Tech", filters: { sector: "Technology", minRoic: 0.15 }, createdAt: "x", updatedAt: "x" }] };
    renderWithClient(<OpportunityDiscovery />);
    await userEvent.click(screen.getByTestId("tab-saved-screens"));
    expect(screen.getByTestId("row-saved-screen-1")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("button-delete-screen-1"));
    expect(deleteScreenMutateMock).toHaveBeenCalledWith({ id: 1 }, expect.anything());
  });

  it("Comparison View shows instructions until at least 2 symbols are selected", async () => {
    mockState.scan = { data: fixtureScanResult(), isPending: false, isError: false };
    renderWithClient(<OpportunityDiscovery />);
    await userEvent.click(screen.getByTestId("tab-compare"));
    expect(screen.getByTestId("text-compare-instructions")).toBeInTheDocument();
  });
});
