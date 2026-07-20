// Phase 34 — Cross-Engine Orchestration & Unified Workspace. Frontend smoke
// tests for the Cross-Engine Workspace page, following the established
// mocked-generated-hook pattern (see ExecutiveIntelligence.test.tsx).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  overviewData: undefined as unknown,
  overviewLoading: false,
  overviewError: false,
  searchData: undefined as unknown,
  searchLoading: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetCrossEngineWorkspaceOverview: () => ({
      data: mockState.overviewData,
      isLoading: mockState.overviewLoading,
      isError: mockState.overviewError,
    }),
    useGetCrossEngineWorkspaceSearch: () => ({
      data: mockState.searchData,
      isLoading: mockState.searchLoading,
    }),
  };
});

import CrossEngineWorkspace from "./CrossEngineWorkspace";

function emptyExecutiveOverview(overrides: Record<string, unknown> = {}) {
  return {
    portfoliosCreated: 0,
    holdingsTracked: 0,
    researchNotesWritten: 0,
    watchlistItems: 0,
    committeeSnapshotsSaved: 0,
    tradesReviewed: 0,
    tradePlansCreated: 0,
    journalEntries: 0,
    strategiesRegistered: 0,
    checklistInstances: 0,
    learningTopicsCompleted: 0,
    learningTopicsTotal: 0,
    totalCoachViews: 0,
    reportsGenerated: 0,
    reportCategoriesUsed: 0,
    generatedAt: "2026-07-20T00:00:00.000Z",
    summary: "No activity recorded yet across either engine.",
    ...overrides,
  };
}

function emptyOverviewResponse(overrides: Record<string, unknown> = {}) {
  return {
    intelligence: { overview: emptyExecutiveOverview() },
    recentActivity: [],
    recentItems: [],
    tasks: [],
    generatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

function populatedOverviewResponse() {
  return emptyOverviewResponse({
    intelligence: {
      overview: emptyExecutiveOverview({
        portfoliosCreated: 2,
        tradesReviewed: 6,
        strategiesRegistered: 1,
        reportsGenerated: 3,
        totalCoachViews: 5,
        learningTopicsCompleted: 4,
        learningTopicsTotal: 10,
      }),
    },
    recentActivity: [
      {
        type: "trade-plan-created",
        engine: "trading",
        label: "Trade Plan Created",
        detail: "AAPL (long)",
        occurredAt: "2026-07-19T00:00:00.000Z",
        symbol: "AAPL",
        linkPath: "/trade-planning-studio?symbol=AAPL",
      },
      {
        type: "strategy-registered",
        engine: "trading",
        label: "Strategy Registered",
        detail: "Breakout Momentum (trend)",
        occurredAt: "2026-07-18T00:00:00.000Z",
        symbol: null,
        linkPath: "/strategy-framework",
      },
    ],
    recentItems: [
      { category: "portfolio", label: "Core Holdings", detail: "Most recent portfolio", occurredAt: "2026-07-17T00:00:00.000Z", linkPath: "/stock-analyst/portfolio-construction?portfolioId=1" },
      { category: "trade-plan", label: "AAPL", detail: "Most recent trade plan (draft)", occurredAt: "2026-07-19T00:00:00.000Z", linkPath: "/trade-planning-studio?symbol=AAPL" },
    ],
    tasks: [
      { code: "unread-notifications", label: "Unread notification(s)", count: 2, linkPath: "/notifications" },
      { code: "portfolios-without-holdings", label: "Portfolio(s) with no holdings yet", count: 1, linkPath: "/stock-analyst/portfolio-construction" },
    ],
  });
}

describe("CrossEngineWorkspace page", () => {
  beforeEach(() => {
    mockState.overviewData = undefined;
    mockState.overviewLoading = false;
    mockState.overviewError = false;
    mockState.searchData = undefined;
    mockState.searchLoading = false;
    window.localStorage.clear();
  });

  it("shows a loading state while the overview is fetching", () => {
    mockState.overviewLoading = true;
    renderWithClient(<CrossEngineWorkspace />);
    expect(screen.getByTestId("cross-engine-workspace-loading")).toBeInTheDocument();
  });

  it("shows an honest error state when the overview fails to load", () => {
    mockState.overviewError = true;
    renderWithClient(<CrossEngineWorkspace />);
    expect(screen.getByTestId("cross-engine-workspace-error")).toBeInTheDocument();
  });

  it("renders the honest empty-state KPIs for a brand-new user", () => {
    mockState.overviewData = emptyOverviewResponse();
    renderWithClient(<CrossEngineWorkspace />);
    expect(screen.getByTestId("kpi-workspace-portfolios")).toHaveTextContent("0");
    expect(screen.getByTestId("kpi-workspace-trades")).toHaveTextContent("0");
    expect(screen.getByTestId("cross-engine-tasks-empty")).toBeInTheDocument();
  });

  it("renders real aggregated KPIs, never fabricating a nonzero value", () => {
    mockState.overviewData = populatedOverviewResponse();
    renderWithClient(<CrossEngineWorkspace />);
    expect(screen.getByTestId("kpi-workspace-portfolios")).toHaveTextContent("2");
    expect(screen.getByTestId("kpi-workspace-trades")).toHaveTextContent("6");
    expect(screen.getByTestId("kpi-workspace-strategies")).toHaveTextContent("1");
    expect(screen.getByTestId("kpi-workspace-reports")).toHaveTextContent("3");
  });

  it("Overview tab shows real Cross-Engine Tasks with deep links, only when count > 0", () => {
    mockState.overviewData = populatedOverviewResponse();
    renderWithClient(<CrossEngineWorkspace />);
    expect(screen.getByTestId("task-unread-notifications")).toHaveTextContent("2");
    expect(screen.getByTestId("task-portfolios-without-holdings")).toHaveTextContent("1");
  });

  it("Overview tab shows the Cross-Engine Context navigation chain from Research through Executive Review", () => {
    mockState.overviewData = emptyOverviewResponse();
    renderWithClient(<CrossEngineWorkspace />);
    const chain = screen.getByTestId("cross-engine-context-chain");
    expect(chain).toHaveTextContent("Research");
    expect(chain).toHaveTextContent("Executive Review");
  });

  it("Activity tab shows the extended timeline including trade-plan-created and strategy-registered entries", async () => {
    mockState.overviewData = populatedOverviewResponse();
    renderWithClient(<CrossEngineWorkspace />);
    await userEvent.click(screen.getByTestId("tab-workspace-activity"));
    expect(screen.getByTestId("workspace-activity-entry-0")).toHaveTextContent("AAPL (long)");
    expect(screen.getByTestId("workspace-activity-entry-1")).toHaveTextContent("Breakout Momentum");
  });

  it("Activity tab honestly shows an empty message when no activity exists yet", async () => {
    mockState.overviewData = emptyOverviewResponse();
    renderWithClient(<CrossEngineWorkspace />);
    await userEvent.click(screen.getByTestId("tab-workspace-activity"));
    expect(screen.getByTestId("recent-activity-empty")).toBeInTheDocument();
  });

  it("Recent Items tab shows the most-recently-touched item per category with deep links", async () => {
    mockState.overviewData = populatedOverviewResponse();
    renderWithClient(<CrossEngineWorkspace />);
    await userEvent.click(screen.getByTestId("tab-workspace-recent"));
    expect(screen.getByTestId("recent-item-portfolio")).toHaveTextContent("Core Holdings");
    expect(screen.getByTestId("recent-item-trade-plan")).toHaveTextContent("AAPL");
  });

  it("Recent Items tab honestly shows an empty message for a brand-new user", async () => {
    mockState.overviewData = emptyOverviewResponse();
    renderWithClient(<CrossEngineWorkspace />);
    await userEvent.click(screen.getByTestId("tab-workspace-recent"));
    expect(screen.getByTestId("recent-items-empty")).toBeInTheDocument();
  });

  it("Search tab shows an idle message before typing, never fetching on an empty query", async () => {
    mockState.overviewData = emptyOverviewResponse();
    renderWithClient(<CrossEngineWorkspace />);
    await userEvent.click(screen.getByTestId("tab-workspace-search"));
    expect(screen.getByTestId("global-search-idle")).toBeInTheDocument();
  });

  it("Search tab shows real deterministic search results once a query resolves", async () => {
    mockState.overviewData = emptyOverviewResponse();
    mockState.searchData = {
      query: "aapl",
      totalMatches: 1,
      results: [
        { category: "trade-plan", id: "1", label: "AAPL — long", detail: "Trade Plan (draft)", occurredAt: "2026-07-19T00:00:00.000Z", linkPath: "/trade-planning-studio?symbol=AAPL" },
      ],
    };
    renderWithClient(<CrossEngineWorkspace />);
    await userEvent.click(screen.getByTestId("tab-workspace-search"));
    await userEvent.type(screen.getByTestId("input-global-search"), "aapl");
    expect(screen.getByTestId("global-search-results")).toHaveTextContent("AAPL — long");
  });

  it("Search tab honestly shows a no-results message, never a fabricated match", async () => {
    mockState.overviewData = emptyOverviewResponse();
    mockState.searchData = { query: "zzz", totalMatches: 0, results: [] };
    renderWithClient(<CrossEngineWorkspace />);
    await userEvent.click(screen.getByTestId("tab-workspace-search"));
    await userEvent.type(screen.getByTestId("input-global-search"), "zzz");
    expect(screen.getByTestId("global-search-no-results")).toBeInTheDocument();
  });

  it("Shortcuts tab shows Workspace Shortcuts and reused Cross-Engine Quick Actions", async () => {
    mockState.overviewData = emptyOverviewResponse();
    renderWithClient(<CrossEngineWorkspace />);
    await userEvent.click(screen.getByTestId("tab-workspace-shortcuts"));
    expect(screen.getByTestId("workspace-shortcuts-grid")).toHaveTextContent("Research Terminal");
    expect(screen.getByTestId("cross-engine-quick-actions-grid")).toHaveTextContent("Open Research");
    expect(screen.getByTestId("cross-engine-quick-actions-grid")).toHaveTextContent("Open Executive Dashboard");
  });

  it("persists the active tab to localStorage (Workspace State) and restores it on next render", async () => {
    mockState.overviewData = emptyOverviewResponse();
    const { unmount } = renderWithClient(<CrossEngineWorkspace />);
    await userEvent.click(screen.getByTestId("tab-workspace-recent"));
    expect(window.localStorage.getItem("cross-engine-workspace:last-tab")).toBe("recent");
    unmount();

    renderWithClient(<CrossEngineWorkspace />);
    expect(screen.getByTestId("panel-recent-items")).toBeInTheDocument();
  });
});
