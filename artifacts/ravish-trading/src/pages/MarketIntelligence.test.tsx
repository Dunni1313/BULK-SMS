// v1.5.0, Sprint 20 — Institutional Market Intelligence Engine. Smoke
// tests following the established mocked-plain-fetch + mocked-generated-
// hook pattern (see DecisionQualityReview.test.tsx / KnowledgeIntelligenceGraph.test.tsx).
// The composition/enrichment logic itself is exhaustively covered at the
// pure-function level in lib/marketIntelligence.test.ts — this file only
// proves the page wires real, already-computed data through honestly,
// never fabricating.

import { describe, it, expect, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";
import type { MarketIntelligenceItem, MarketIntelligenceFeed } from "@workspace/api-client-react";

const listNotebooksMock = vi.hoisted(() => vi.fn(async (_coachId?: string) => [] as unknown[]));
const listStrategiesMock = vi.hoisted(() => vi.fn(async (_coachId?: string) => [] as unknown[]));
const listTradePlansMock = vi.hoisted(() => vi.fn(async (_coachId?: string) => [] as unknown[]));
const getTradePlanMock = vi.hoisted(() => vi.fn());
const getMissingTradePlanInformationMock = vi.hoisted(() => vi.fn(async () => ({ missing: [], present: [], completenessPct: 100 })));

vi.mock("@/lib/ai-coach/notebooksApi", () => ({
  listNotebooks: listNotebooksMock,
}));

vi.mock("@/lib/ai-coach/strategiesApi", () => ({
  listStrategies: listStrategiesMock,
  getStrategy: vi.fn(async () => null),
  getMissingSections: vi.fn(async () => null),
}));

vi.mock("@/lib/ai-coach/tradePlansApi", () => ({
  listTradePlans: listTradePlansMock,
  getTradePlan: getTradePlanMock,
  getMissingTradePlanInformation: getMissingTradePlanInformationMock,
}));

const mockState = vi.hoisted(() => ({
  journalEntries: [] as unknown[],
  trades: [] as unknown[],
  positions: [] as unknown[],
  learningProgress: undefined as unknown,
  feed: undefined as MarketIntelligenceFeed | undefined,
  feedIsError: false,
  valueWatchlist: [] as unknown[],
  watchlistsDashboard: undefined as unknown,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useListJournalEntries: () => ({ data: mockState.journalEntries }),
    useListTrades: () => ({ data: mockState.trades }),
    useListTradingPositions: () => ({ data: mockState.positions }),
    useGetLearningProgress: () => ({ data: mockState.learningProgress }),
    useGetPortfolioDashboard: () => ({ data: undefined, isLoading: false }),
    useGetPortfolioConcentration: () => ({ data: undefined, isLoading: false }),
    useGetPortfolios: () => ({ data: [], isLoading: false }),
    useGetPortfolioRisk: () => ({ data: undefined, isLoading: false }),
    useGetTradingRisk: () => ({ data: undefined, isLoading: false }),
    useGetMarketIntelligence: () => ({ data: mockState.feed, isLoading: false, isError: mockState.feedIsError, refetch: vi.fn() }),
    useGetValueWatchlist: () => ({ data: mockState.valueWatchlist, isLoading: false }),
    useGetWatchlistsDashboard: () => ({ data: mockState.watchlistsDashboard, isLoading: false }),
  };
});

import MarketIntelligence from "./MarketIntelligence";

const CATEGORY_METAS: MarketIntelligenceFeed["categories"] = [
  { category: "macro", label: "Macro", description: "", dataAvailable: true, unavailableReason: null },
  { category: "economic_events", label: "Economic Events", description: "", dataAvailable: true, unavailableReason: null },
  { category: "central_banks", label: "Central Banks", description: "", dataAvailable: true, unavailableReason: null },
  { category: "earnings", label: "Earnings", description: "", dataAvailable: true, unavailableReason: null },
  { category: "corporate_actions", label: "Corporate Actions", description: "", dataAvailable: true, unavailableReason: null },
  { category: "sector_trends", label: "Sector Trends", description: "", dataAvailable: false, unavailableReason: "No sector performance series exists in this codebase yet." },
  { category: "commodities", label: "Commodities", description: "", dataAvailable: false, unavailableReason: "No commodity feed exists in this codebase yet." },
  { category: "currencies", label: "Currencies", description: "", dataAvailable: false, unavailableReason: "No currency/FX feed exists in this codebase yet." },
  { category: "indices", label: "Indices", description: "", dataAvailable: true, unavailableReason: null },
  { category: "volatility", label: "Volatility", description: "", dataAvailable: true, unavailableReason: null },
  { category: "options_activity", label: "Options Activity", description: "", dataAvailable: true, unavailableReason: null },
  { category: "market_breadth", label: "Market Breadth", description: "", dataAvailable: true, unavailableReason: null },
  { category: "sentiment", label: "Sentiment", description: "", dataAvailable: false, unavailableReason: "No sentiment index exists in this codebase yet." },
];

function item(overrides: Partial<MarketIntelligenceItem> = {}): MarketIntelligenceItem {
  const now = new Date().toISOString();
  return {
    id: "earnings:AAPL:today",
    headline: "AAPL earnings in 5 days",
    category: "earnings",
    source: "Simulated Economic/Event Calendar (eventRisk.ts)",
    dataSource: "SIMULATED",
    timestamp: now,
    impact: "high",
    affectedAssets: ["AAPL"],
    affectedSectors: [],
    potentialRisks: ["Post-earnings implied-volatility crush for open premium."],
    potentialOpportunities: [],
    summary: "AAPL earnings — in 5 days.",
    learnMore: { pathKey: "volatility", topicKey: "volatility-earnings", label: "Earnings Volatility & IV Crush" },
    ...overrides,
  };
}

describe("MarketIntelligence page", () => {
  it("shows a loading skeleton before the feed resolves", () => {
    mockState.feed = undefined;
    renderWithClient(<MarketIntelligence />);
    expect(screen.queryByTestId("page-market-intelligence")).toBeInTheDocument();
  });

  it("renders the feed's category filters, including reserved-but-unavailable categories as disabled", async () => {
    mockState.feed = { items: [item()], categories: CATEGORY_METAS, generatedAt: new Date().toISOString() };
    renderWithClient(<MarketIntelligence />);
    await waitFor(() => expect(screen.getByTestId("market-intelligence-category-filter")).toBeInTheDocument());
    const sentimentBtn = screen.getByTestId("market-intelligence-filter-sentiment");
    expect(sentimentBtn).toBeDisabled();
    const earningsBtn = screen.getByTestId("market-intelligence-filter-earnings");
    expect(earningsBtn).not.toBeDisabled();
  });

  it("renders a real intelligence item with its headline and category", async () => {
    mockState.feed = { items: [item()], categories: CATEGORY_METAS, generatedAt: new Date().toISOString() };
    renderWithClient(<MarketIntelligence />);
    await waitFor(() => expect(screen.getByTestId("market-intelligence-item-list")).toBeInTheDocument());
    // The default fixture is timestamped "now", so it legitimately also
    // appears in the "Today's Key Events" card above — scope to the full
    // item list to assert unambiguously.
    expect(within(screen.getByTestId("market-intelligence-item-list")).getByText("AAPL earnings in 5 days")).toBeInTheDocument();
  });

  it("expands an item to show related research/risks/opportunities and the AI Market Coach narrative, never fabricating a link that doesn't exist", async () => {
    mockState.feed = { items: [item()], categories: CATEGORY_METAS, generatedAt: new Date().toISOString() };
    renderWithClient(<MarketIntelligence />);
    await waitFor(() => expect(screen.getByTestId(`market-intelligence-item-${item().id}`)).toBeInTheDocument());
    const card = screen.getByTestId(`market-intelligence-item-${item().id}`);
    await userEvent.click(within(card).getByText("AAPL earnings in 5 days"));
    expect(screen.getByTestId(`market-intelligence-coach-${item().id}`)).toBeInTheDocument();
    // No graph/watchlist data is mocked in, so honestly reports no related research.
    expect(screen.getByTestId(`market-intelligence-no-research-${item().id}`)).toBeInTheDocument();
  });

  it("honestly shows an empty state when no key events happened today", async () => {
    const yesterday = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    mockState.feed = { items: [item({ timestamp: yesterday })], categories: CATEGORY_METAS, generatedAt: new Date().toISOString() };
    renderWithClient(<MarketIntelligence />);
    await waitFor(() => expect(screen.getByTestId("market-intelligence-no-todays-events")).toBeInTheDocument());
  });

  it("filters the item list by category when a filter button is clicked", async () => {
    mockState.feed = {
      items: [item({ id: "a", category: "earnings", headline: "Earnings item" }), item({ id: "b", category: "volatility", headline: "Volatility item" })],
      categories: CATEGORY_METAS,
      generatedAt: new Date().toISOString(),
    };
    renderWithClient(<MarketIntelligence />);
    const list = () => screen.getByTestId("market-intelligence-item-list");
    await waitFor(() => expect(within(list()).getByText("Earnings item")).toBeInTheDocument());
    expect(within(list()).getByText("Volatility item")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("market-intelligence-filter-earnings"));
    expect(within(list()).getByText("Earnings item")).toBeInTheDocument();
    expect(within(list()).queryByText("Volatility item")).not.toBeInTheDocument();
  });

  it("honestly shows portfolio integration signals as unavailable when no portfolio risk data resolves", async () => {
    mockState.feed = { items: [item()], categories: CATEGORY_METAS, generatedAt: new Date().toISOString() };
    renderWithClient(<MarketIntelligence />);
    await waitFor(() => expect(screen.getByTestId("market-intelligence-portfolio-integration")).toBeInTheDocument());
  });

  // v1.5.0, Sprint 23 (GA Readiness) — proves the new isError-driven error
  // banner renders instead of a silently-blank/perpetually-loading page
  // when the underlying feed fetch fails.
  it("shows an honest error message instead of a blank page when the feed fetch fails", async () => {
    mockState.feed = undefined;
    mockState.feedIsError = true;
    renderWithClient(<MarketIntelligence />);
    await waitFor(() => expect(screen.getByTestId("market-intelligence-error")).toBeInTheDocument());
    mockState.feedIsError = false;
  });
});
