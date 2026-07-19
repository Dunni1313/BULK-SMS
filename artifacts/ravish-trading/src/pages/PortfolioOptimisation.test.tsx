// Phase 18 — Institutional Portfolio Optimisation Engine. Page smoke test,
// following the established mocked-generated-hook pattern (see
// PortfolioConstruction.test.tsx).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const addReviewMutate = vi.fn();
const addToWatchlistMutate = vi.fn();

const mockState = vi.hoisted(() => ({
  portfolios: [] as unknown[],
  optimisation: undefined as unknown,
  reviews: [] as unknown[],
  notifications: [] as unknown[],
  comparison: undefined as unknown,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetPortfolios: () => ({ data: mockState.portfolios, isLoading: false }),
    useGetPortfolioOptimisation: () => ({ data: mockState.optimisation, isLoading: false }),
    useGetOptimisationReviews: () => ({ data: mockState.reviews, isLoading: false }),
    useAddOptimisationReview: () => ({ mutate: addReviewMutate, isPending: false }),
    useAddValueWatchlist: () => ({ mutate: addToWatchlistMutate, isPending: false }),
    useListNotifications: () => ({ data: mockState.notifications }),
    useCompareOpportunitiesRoute: () => ({ data: mockState.comparison, isLoading: false }),
  };
});

import PortfolioOptimisation from "./PortfolioOptimisation";

function portfolioSummary(over: Record<string, unknown> = {}) {
  return { id: 1, name: "Core Value", holdingsCount: 3, ...over };
}

function candidate(over: Record<string, unknown> = {}) {
  return {
    symbol: "WEAK",
    name: "Weak Corp",
    sector: "Technology",
    weightPct: 12,
    action: "exit",
    reason: "Decision Engine recommends Sell (synthesis score 20/100).",
    evidence: {
      metrics: [{ label: "Business Quality", value: "40/100" }],
      decisionEngineRecommendation: "Sell",
      investmentCommitteeRecommendation: "Wait",
      rankExplanation: "WEAK ranks with a synthesis score of 20/100.",
      portfolioImpact: "Currently 12.0% of the portfolio.",
      riskImpact: "Exiting removes this position entirely.",
      diversificationImpact: "Same sector as held.",
    },
    ...over,
  };
}

function positionRow(over: Record<string, unknown> = {}) {
  return {
    symbol: "WEAK",
    name: "Weak Corp",
    sector: "Technology",
    weightPct: 12,
    qualityScore: 40,
    valuationRating: "Fair",
    investmentCommitteeVerdict: "Wait",
    decisionRecommendation: "Sell",
    rankScore: 20,
    action: "exit",
    actionReason: "Decision Engine recommends Sell (synthesis score 20/100).",
    ...over,
  };
}

function optimisation(over: Record<string, unknown> = {}) {
  return {
    portfolioId: 1,
    health: { qualityScore: 55, qualityLabel: "Average", capitalAllocationScore: 50, diversificationScore: 60, diversificationLabel: "Moderate", overallRiskScore: 55, overallRiskLabel: "Moderate", summary: "Portfolio health summary." },
    concentration: { score: 60, label: "Moderate", detail: "detail", largestSymbol: null, largestSymbolWeightPct: null, capBreached: false },
    diversification: { bySector: [], byIndustry: [], growthValueMix: [], qualityMix: [], largestPositionPct: null, top10ExposurePct: null },
    positionQualityRanking: [positionRow()],
    upgradeCandidates: [],
    trimCandidates: [],
    exitCandidates: [candidate()],
    capitalAllocationSuggestions: [{ action: "Reduce exposure to 1 position(s)", detail: "Exit and Trim candidates together represent approximately 12.0% of current portfolio weight." }],
    replacementOpportunities: [],
    cashDeploymentSuggestions: [],
    summary: "1 Exit, 0 Trim, and 0 Upgrade candidate(s) identified among 1 held position(s).",
    disclaimer: "Educational research only — never a price prediction, never a return forecast.",
    ...over,
  };
}

function resetMockState() {
  mockState.portfolios = [];
  mockState.optimisation = undefined;
  mockState.reviews = [];
  mockState.notifications = [];
  mockState.comparison = undefined;
}

describe("PortfolioOptimisation", () => {
  beforeEach(() => {
    resetMockState();
    addReviewMutate.mockClear();
    addToWatchlistMutate.mockClear();
  });

  it("renders the permanent institutional labels and an advisory message before a portfolio is selected", () => {
    renderWithClient(<PortfolioOptimisation />);
    expect(screen.getByTestId("optimisation-permanent-labels")).toBeInTheDocument();
    expect(screen.getByText(/Select a portfolio above/)).toBeInTheDocument();
  });

  it("selecting a portfolio renders Portfolio Health, Concentration, and Position Quality Ranking", async () => {
    mockState.portfolios = [portfolioSummary()];
    mockState.optimisation = optimisation();
    renderWithClient(<PortfolioOptimisation />);

    await userEvent.click(screen.getByTestId("portfolio-select"));
    await userEvent.click(await screen.findByText("Core Value"));

    expect(screen.getByText(/Quality: 55/)).toBeInTheDocument();
    expect(screen.getByTestId("ranking-row-WEAK")).toBeInTheDocument();
  });

  it("renders Exit Candidates on the Upgrade Analysis tab, with a working Show Evidence toggle and Save Review", async () => {
    mockState.portfolios = [portfolioSummary()];
    mockState.optimisation = optimisation();
    renderWithClient(<PortfolioOptimisation />);

    await userEvent.click(screen.getByTestId("portfolio-select"));
    await userEvent.click(await screen.findByText("Core Value"));
    await userEvent.click(screen.getByTestId("tab-candidates"));

    expect(screen.getByTestId("candidate-WEAK")).toBeInTheDocument();
    expect(screen.queryByTestId("evidence-panel")).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("toggle-evidence-WEAK"));
    expect(screen.getByTestId("evidence-panel")).toBeInTheDocument();
    expect(screen.getByText(/synthesis score of 20\/100/)).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("save-review-WEAK"));
    expect(addReviewMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, data: expect.objectContaining({ symbol: "WEAK", action: "exit" }) }),
      expect.anything(),
    );
  });

  it("lets the user send a candidate straight to the watchlist", async () => {
    mockState.portfolios = [portfolioSummary()];
    mockState.optimisation = optimisation();
    renderWithClient(<PortfolioOptimisation />);

    await userEvent.click(screen.getByTestId("portfolio-select"));
    await userEvent.click(await screen.findByText("Core Value"));
    await userEvent.click(screen.getByTestId("tab-candidates"));
    await userEvent.click(screen.getByTestId("watchlist-WEAK"));

    expect(addToWatchlistMutate).toHaveBeenCalledWith({ data: { symbol: "WEAK" } });
  });

  it("renders Capital Allocation Suggestions on the Allocation Summary tab", async () => {
    mockState.portfolios = [portfolioSummary()];
    mockState.optimisation = optimisation();
    renderWithClient(<PortfolioOptimisation />);

    await userEvent.click(screen.getByTestId("portfolio-select"));
    await userEvent.click(await screen.findByText("Core Value"));
    await userEvent.click(screen.getByTestId("tab-opportunities"));

    expect(screen.getByTestId("allocation-suggestion-0")).toHaveTextContent("Reduce exposure to 1 position(s)");
  });

  it("shows an honest empty message for Replacement Opportunities when none are found", async () => {
    mockState.portfolios = [portfolioSummary()];
    mockState.optimisation = optimisation();
    renderWithClient(<PortfolioOptimisation />);

    await userEvent.click(screen.getByTestId("portfolio-select"));
    await userEvent.click(await screen.findByText("Core Value"));
    await userEvent.click(screen.getByTestId("tab-opportunities"));

    expect(screen.getByText("None identified.")).toBeInTheDocument();
  });

  it("surfaces Active Alerts for held positions, reusing the notifications list, never a new detection rule", async () => {
    mockState.portfolios = [portfolioSummary()];
    mockState.optimisation = optimisation();
    mockState.notifications = [
      { id: 1, title: "Margin of safety crossed", message: "x", relatedSymbol: "WEAK", isRead: false },
      { id: 2, title: "Unrelated", message: "y", relatedSymbol: "OTHERCO", isRead: false },
    ];
    renderWithClient(<PortfolioOptimisation />);

    await userEvent.click(screen.getByTestId("portfolio-select"));
    await userEvent.click(await screen.findByText("Core Value"));

    expect(screen.getByTestId("portfolio-alerts-card")).toBeInTheDocument();
    expect(screen.getByText(/Margin of safety crossed/)).toBeInTheDocument();
    expect(screen.queryByText(/Unrelated/)).not.toBeInTheDocument();
  });

  it("renders Saved Reviews, honestly empty when there are none", async () => {
    mockState.portfolios = [portfolioSummary()];
    mockState.optimisation = optimisation();
    mockState.reviews = [];
    renderWithClient(<PortfolioOptimisation />);

    await userEvent.click(screen.getByTestId("portfolio-select"));
    await userEvent.click(await screen.findByText("Core Value"));
    await userEvent.click(screen.getByTestId("tab-reviews"));

    expect(screen.getByText("No saved reviews yet.")).toBeInTheDocument();
  });

  it("renders a real saved review", async () => {
    mockState.portfolios = [portfolioSummary()];
    mockState.optimisation = optimisation();
    mockState.reviews = [{ id: 9, portfolioId: 1, symbol: "WEAK", action: "exit", note: "Exiting per the flag.", createdAt: new Date().toISOString() }];
    renderWithClient(<PortfolioOptimisation />);

    await userEvent.click(screen.getByTestId("portfolio-select"));
    await userEvent.click(await screen.findByText("Core Value"));
    await userEvent.click(screen.getByTestId("tab-reviews"));

    expect(screen.getByTestId("review-9")).toBeInTheDocument();
    expect(screen.getByText("Exiting per the flag.")).toBeInTheDocument();
  });
});
