// v1.5.0, Sprint 21 — Institutional Opportunity Discovery Engine (built and
// named "Opportunity Pipeline" — see src/lib/opportunityPipeline.ts's own
// header comment for the disclosed naming-collision reasoning). Smoke
// tests following the established mocked-plain-fetch + mocked-generated-
// hook pattern (see MarketIntelligence.test.tsx). The composition logic
// itself is exhaustively covered at the pure-function level in
// lib/opportunityPipeline.test.ts — this file only proves the page wires
// real, already-computed data through honestly, never fabricating.

import { describe, it, expect, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";
import type { MarketIntelligenceFeed, OpportunityPipelineItem } from "@workspace/api-client-react";

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
  valueWatchlist: [] as unknown[],
  watchlistsDashboard: undefined as unknown,
  researchNotes: [] as unknown[],
  researchNotesIsError: false,
  captured: [] as OpportunityPipelineItem[],
}));

const captureMock = vi.hoisted(() => vi.fn(async () => undefined));
const updateMock = vi.hoisted(() => vi.fn(async () => undefined));
const deleteMock = vi.hoisted(() => vi.fn(async () => undefined));

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
    useGetMarketIntelligence: () => ({ data: mockState.feed, isLoading: false, refetch: vi.fn() }),
    useGetValueWatchlist: () => ({ data: mockState.valueWatchlist, isLoading: false }),
    useGetWatchlistsDashboard: () => ({ data: mockState.watchlistsDashboard, isLoading: false }),
    useGetAllResearchNotes: () => ({ data: mockState.researchNotes, isLoading: false, isError: mockState.researchNotesIsError }),
    useListOpportunityPipelineItems: () => ({ data: mockState.captured, isLoading: false, refetch: vi.fn() }),
    useCaptureOpportunityPipelineItem: () => ({ mutateAsync: captureMock }),
    useUpdateOpportunityPipelineItem: () => ({ mutateAsync: updateMock }),
    useDeleteOpportunityPipelineItem: () => ({ mutateAsync: deleteMock }),
  };
});

import OpportunityPipeline from "./OpportunityPipeline";

const CATEGORY_METAS: MarketIntelligenceFeed["categories"] = [
  { category: "earnings", label: "Earnings", description: "", dataAvailable: true, unavailableReason: null },
  { category: "central_banks", label: "Central Banks", description: "", dataAvailable: true, unavailableReason: null },
];

// Category is deliberately "central_banks" (a MARKET_WIDE_CATEGORIES entry in
// marketIntelligence.ts), not "earnings" — a market-wide category is always
// isWatched/isPriority (when impact is "high") regardless of the mocked
// watchlist's own contents, which stays empty ([]) throughout this file.
// This mirrors the exact same fixture-design fix already established in
// MarketIntelligence.test.tsx for the identical situation.
function marketIntelItem(overrides: Partial<MarketIntelligenceFeed["items"][number]> = {}): MarketIntelligenceFeed["items"][number] {
  return {
    id: "earnings:AAPL:today",
    headline: "AAPL earnings in 5 days",
    category: "central_banks",
    source: "Simulated Economic/Event Calendar (eventRisk.ts)",
    dataSource: "SIMULATED",
    timestamp: new Date().toISOString(),
    impact: "high",
    affectedAssets: ["AAPL"],
    affectedSectors: [],
    potentialRisks: ["Post-earnings implied-volatility crush."],
    potentialOpportunities: [],
    summary: "AAPL earnings — in 5 days.",
    learnMore: null,
    ...overrides,
  };
}

function capturedItem(overrides: Partial<OpportunityPipelineItem> = {}): OpportunityPipelineItem {
  return {
    id: 1,
    title: "MSFT: watchlist target crossed",
    category: "watchlist_event",
    origin: "Watchlist — target crossing (checkTargets)",
    evidence: ["Price target crossed."],
    relatedAssets: ["MSFT"],
    relatedSectors: [],
    priority: "high",
    stage: "discovered",
    stageLabel: "Discovered",
    nextRecommendedAction: "Review the evidence.",
    linkedNotebookId: null,
    relatedResearchSymbol: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archivedAt: null,
    ...overrides,
  };
}

describe("OpportunityPipeline page", () => {
  it("shows a loading skeleton before data resolves", () => {
    mockState.feed = undefined;
    renderWithClient(<OpportunityPipeline />);
    expect(screen.queryByTestId("page-opportunity-pipeline")).toBeInTheDocument();
  });

  it("honestly shows no discovered opportunities when nothing surfaced", async () => {
    mockState.feed = { items: [], categories: CATEGORY_METAS, generatedAt: new Date().toISOString() };
    renderWithClient(<OpportunityPipeline />);
    await waitFor(() => expect(screen.getByTestId("opportunity-no-discovered")).toBeInTheDocument());
  });

  it("renders a real discovered opportunity from Market Intelligence, with a capture button", async () => {
    mockState.feed = { items: [marketIntelItem()], categories: CATEGORY_METAS, generatedAt: new Date().toISOString() };
    renderWithClient(<OpportunityPipeline />);
    await waitFor(() => expect(screen.getByTestId("opportunity-discovered-list")).toBeInTheDocument());
    expect(screen.getByText("AAPL earnings in 5 days")).toBeInTheDocument();
  });

  it("captures a discovered opportunity with the real evidence/category, never fabricated fields", async () => {
    mockState.feed = { items: [marketIntelItem()], categories: CATEGORY_METAS, generatedAt: new Date().toISOString() };
    renderWithClient(<OpportunityPipeline />);
    await waitFor(() => expect(screen.getByTestId("opportunity-discovered-list")).toBeInTheDocument());
    const captureBtn = screen.getByTestId("opportunity-capture-market-intelligence:earnings:AAPL:today");
    await userEvent.click(captureBtn);
    expect(captureMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "AAPL earnings in 5 days",
        category: "macro_change",
        relatedAssets: ["AAPL"],
      }),
    });
  });

  it("shows the AI Discovery Coach narrative on request, never a fabricated buy/sell recommendation", async () => {
    mockState.feed = { items: [marketIntelItem()], categories: CATEGORY_METAS, generatedAt: new Date().toISOString() };
    renderWithClient(<OpportunityPipeline />);
    await waitFor(() => expect(screen.getByTestId("opportunity-discovered-list")).toBeInTheDocument());
    const card = screen.getByTestId(`opportunity-discovered-market-intelligence:earnings:AAPL:today`);
    await userEvent.click(within(card).getByText("AI Discovery Coach"));
    expect(screen.getByTestId("opportunity-coach-market-intelligence:earnings:AAPL:today")).toBeInTheDocument();
  });

  it("renders a captured pipeline item in the My Pipeline tab with its real stage and next action", async () => {
    mockState.feed = { items: [], categories: CATEGORY_METAS, generatedAt: new Date().toISOString() };
    mockState.captured = [capturedItem()];
    renderWithClient(<OpportunityPipeline />);
    await waitFor(() => expect(screen.getByTestId("opportunity-tab-captured")).toBeInTheDocument());
    await userEvent.click(screen.getByTestId("opportunity-tab-captured"));
    expect(screen.getByTestId("opportunity-captured-list")).toHaveTextContent("MSFT: watchlist target crossed");
    expect(screen.getByTestId("opportunity-next-action-1")).toHaveTextContent("Review the evidence.");
  });

  it("advances a captured item's stage via the real update mutation, never a fabricated stage jump", async () => {
    mockState.feed = { items: [], categories: CATEGORY_METAS, generatedAt: new Date().toISOString() };
    mockState.captured = [capturedItem({ stage: "discovered" })];
    renderWithClient(<OpportunityPipeline />);
    await waitFor(() => expect(screen.getByTestId("opportunity-tab-captured")).toBeInTheDocument());
    await userEvent.click(screen.getByTestId("opportunity-tab-captured"));
    await waitFor(() => expect(screen.getByTestId("opportunity-advance-1")).toBeInTheDocument());
    await userEvent.click(screen.getByTestId("opportunity-advance-1"));
    expect(updateMock).toHaveBeenCalledWith({ id: 1, data: { stage: "screening" } });
  });

  it("archives a captured item via the real update mutation, moving it to the archived section", async () => {
    mockState.feed = { items: [], categories: CATEGORY_METAS, generatedAt: new Date().toISOString() };
    mockState.captured = [capturedItem({ stage: "research-candidate" })];
    renderWithClient(<OpportunityPipeline />);
    await waitFor(() => expect(screen.getByTestId("opportunity-tab-captured")).toBeInTheDocument());
    await userEvent.click(screen.getByTestId("opportunity-tab-captured"));
    await waitFor(() => expect(screen.getByTestId("opportunity-archive-1")).toBeInTheDocument());
    await userEvent.click(screen.getByTestId("opportunity-archive-1"));
    expect(updateMock).toHaveBeenCalledWith({ id: 1, data: { stage: "archived" } });
  });

  it("shows a Research Workspace link only for a research-candidate item with a related asset", async () => {
    mockState.feed = { items: [], categories: CATEGORY_METAS, generatedAt: new Date().toISOString() };
    mockState.captured = [capturedItem({ stage: "research-candidate", relatedAssets: ["MSFT"] })];
    renderWithClient(<OpportunityPipeline />);
    await waitFor(() => expect(screen.getByTestId("opportunity-tab-captured")).toBeInTheDocument());
    await userEvent.click(screen.getByTestId("opportunity-tab-captured"));
    await waitFor(() => expect(screen.getByText("Open Research Workspace →")).toBeInTheDocument());
    expect(screen.getByText("Open Research Workspace →").closest("a")).toHaveAttribute("href", "/stock-analyst?symbol=MSFT");
  });

  // v1.5.0, Sprint 23 (GA Readiness) — proves the new isError-driven error
  // banner renders instead of a silently-blank/perpetually-loading page
  // when an underlying fetch (here, Research Notes) fails.
  it("shows an honest error message instead of a blank page when an underlying fetch fails", async () => {
    mockState.feed = { items: [], categories: CATEGORY_METAS, generatedAt: new Date().toISOString() };
    mockState.researchNotesIsError = true;
    renderWithClient(<OpportunityPipeline />);
    await waitFor(() => expect(screen.getByTestId("opportunity-pipeline-error")).toBeInTheDocument());
    mockState.researchNotesIsError = false;
  });
});
