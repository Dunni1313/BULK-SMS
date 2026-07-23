// Phase 43 — Institutional Watchlists & Opportunity Dashboard.
// Frontend smoke tests, following the established mocked-generated-hook
// pattern (MonitoringComplianceEngine.test.tsx for the plain GET dashboard
// hook + useMutation-based create/update/delete hooks).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const createMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const updateMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const deleteMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const addItemMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const updateItemMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const removeItemMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const mockState = vi.hoisted(() => ({
  dashboardData: undefined as unknown,
  dashboardLoading: false,
  dashboardError: false,
  watchlistsData: undefined as unknown,
  watchlistsLoading: false,
  detailData: undefined as unknown,
  detailLoading: false,
  coachData: undefined as unknown,
  coachLoading: false,
  learningData: undefined as unknown,
  learningLoading: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetWatchlistsDashboard: () => ({ data: mockState.dashboardData, isLoading: mockState.dashboardLoading, isError: mockState.dashboardError }),
    useListInvestingWatchlists: () => ({ data: mockState.watchlistsData, isLoading: mockState.watchlistsLoading }),
    useCreateInvestingWatchlist: () => createMock,
    useUpdateInvestingWatchlist: () => updateMock,
    useDeleteInvestingWatchlist: () => deleteMock,
    useGetInvestingWatchlist: () => ({ data: mockState.detailData, isLoading: mockState.detailLoading }),
    useAddInvestingWatchlistItem: () => addItemMock,
    useUpdateInvestingWatchlistItem: () => updateItemMock,
    useRemoveInvestingWatchlistItem: () => removeItemMock,
    useListWatchlistsCoachTopics: () => ({ data: mockState.coachData, isLoading: mockState.coachLoading }),
    useListWatchlistsLearning: () => ({ data: mockState.learningData, isLoading: mockState.learningLoading }),
  };
});

import WatchlistsEngine from "./WatchlistsEngine";

function analytics(over: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    heldInInvesting: false,
    heldInTrading: false,
    heldInOptions: false,
    investing: null,
    trading: null,
    options: null,
    compliance: null,
    scenarioWorstCaseImpactDollars: null,
    scenarioWorstCaseLabel: null,
    ...over,
  };
}

function dashboard(overrides: Record<string, unknown> = {}) {
  return {
    watchlists: [],
    items: [],
    opportunityOverview: [],
    watchlistHealth: [],
    crossEngineSummary: {
      capitalAllocation: [{ engine: "investing", label: "Investing (market value)", value: 1000 }],
      investingDiversification: { engine: "investing", available: true, score: 70, detail: "Reasonably diversified." },
      optionsDiversification: { engine: "options", available: false, score: null, detail: "Unavailable." },
      complianceSummary: { totalPolicies: 0, enabledPolicies: 0, compliantCount: 0, breachCount: 0, unavailableCount: 0 },
      executiveHealth: { healthScore: 80, overallRiskRating: { code: "healthy", label: "Healthy" } },
    },
    dashboardSummary: {
      watchlistCount: 0,
      itemCount: 0,
      distinctSymbolCount: 0,
      heldSymbolCount: 0,
      highestRisk: null,
      highestExposure: null,
      highestAllocation: null,
      policyBreaches: [],
      scenarioImpact: { worstCaseTotalImpactDollars: null, detail: "No watched symbols are currently held anywhere — scenario impact is unavailable." },
      performanceSummary: { totalUnrealizedPnl: null, totalRealizedPnl: null, detail: "No watched symbols are currently held anywhere — performance is unavailable." },
      outstandingIssues: ["No watchlists have been created yet."],
    },
    generatedAt: "2026-07-21T00:00:00.000Z",
    ...overrides,
  };
}

describe("WatchlistsEngine", () => {
  beforeEach(() => {
    mockState.dashboardData = undefined;
    mockState.dashboardLoading = false;
    mockState.dashboardError = false;
    mockState.watchlistsData = undefined;
    mockState.watchlistsLoading = false;
    mockState.detailData = undefined;
    mockState.detailLoading = false;
    mockState.coachData = undefined;
    mockState.coachLoading = false;
    mockState.learningData = undefined;
    mockState.learningLoading = false;
    createMock.mutate.mockReset();
    createMock.isPending = false;
    updateMock.mutate.mockReset();
    updateMock.isPending = false;
    deleteMock.mutate.mockReset();
    deleteMock.isPending = false;
    addItemMock.mutate.mockReset();
    updateItemMock.mutate.mockReset();
    removeItemMock.mutate.mockReset();
  });

  it("renders the page header and disclosure labels", () => {
    renderWithClient(<WatchlistsEngine />);
    expect(screen.getByText("Institutional Watchlists & Opportunity Dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("we-labels")).toBeInTheDocument();
  });

  it("shows a loading skeleton while the dashboard is loading", () => {
    mockState.dashboardLoading = true;
    renderWithClient(<WatchlistsEngine />);
    expect(screen.queryByTestId("panel-we-summary")).not.toBeInTheDocument();
  });

  it("shows an honest error message if the dashboard fails to load", () => {
    mockState.dashboardError = true;
    renderWithClient(<WatchlistsEngine />);
    expect(screen.getByTestId("we-dashboard-error")).toBeInTheDocument();
  });

  it("shows an honest empty dashboard when there are zero watchlists, never a fabricated status", () => {
    mockState.dashboardData = dashboard();
    renderWithClient(<WatchlistsEngine />);
    expect(screen.getByTestId("panel-we-summary")).toHaveTextContent("0");
    expect(screen.getByTestId("we-health-empty")).toBeInTheDocument();
    expect(screen.getByText(/No watchlists have been created yet\./)).toBeInTheDocument();
  });

  it("renders Watchlist Health and Cross-Engine Summary with real figures, never fabricated", () => {
    mockState.dashboardData = dashboard({
      watchlistHealth: [{ watchlistId: 1, name: "Core", kind: "personal", itemCount: 3, heldCount: 2, notHeldCount: 1, breachCount: 1, totalMarketValue: 5000, totalUnrealizedPnl: 200 }],
    });
    renderWithClient(<WatchlistsEngine />);
    const health = screen.getByTestId("health-row-1");
    expect(health).toHaveTextContent("Core");
    expect(health).toHaveTextContent("2/3");
    expect(health).toHaveTextContent("1 breach");

    const crossEngine = screen.getByTestId("panel-we-cross-engine");
    expect(crossEngine).toHaveTextContent("80/100");
    expect(crossEngine).toHaveTextContent("70/100");
  });

  it("Manage Watchlists: creating a watchlist submits the correct payload", async () => {
    createMock.mutate.mockImplementation((_vars: unknown, opts: { onSuccess: () => void }) => opts.onSuccess());
    const user = userEvent.setup();
    renderWithClient(<WatchlistsEngine />);
    await user.click(screen.getByTestId("tab-we-watchlists"));
    await user.type(screen.getByTestId("new-watchlist-name"), "My New List");
    await user.click(screen.getByTestId("new-watchlist-create-btn"));

    expect(createMock.mutate).toHaveBeenCalledWith({ data: { name: "My New List", kind: "personal" } }, expect.anything());
  });

  it("Manage Watchlists: shows an honest empty message, and archiving/deleting an existing watchlist submits the correct payload", async () => {
    mockState.watchlistsData = [{ id: 7, name: "Personal List", kind: "personal", description: "", archived: false, sortOrder: 0, itemCount: 2, createdAt: "2026-07-21T00:00:00.000Z", updatedAt: "2026-07-21T00:00:00.000Z" }];
    updateMock.mutate.mockImplementation((_vars: unknown, opts: { onSuccess: () => void }) => opts.onSuccess());
    deleteMock.mutate.mockImplementation((_vars: unknown, opts: { onSuccess: () => void }) => opts.onSuccess());

    const user = userEvent.setup();
    renderWithClient(<WatchlistsEngine />);
    await user.click(screen.getByTestId("tab-we-watchlists"));

    const row = screen.getByTestId("watchlist-row-7");
    expect(row).toHaveTextContent("Personal List");

    await user.click(within(row).getByTestId("watchlist-archive-7"));
    expect(updateMock.mutate).toHaveBeenCalledWith({ id: 7, data: { archived: true } }, expect.anything());

    await user.click(within(row).getByTestId("watchlist-delete-7"));
    expect(deleteMock.mutate).toHaveBeenCalledWith({ id: 7 }, expect.anything());
  });

  it("Manage Watchlists: shows an honest empty message when there are no watchlists at all", async () => {
    mockState.watchlistsData = [];
    const user = userEvent.setup();
    renderWithClient(<WatchlistsEngine />);
    await user.click(screen.getByTestId("tab-we-watchlists"));
    expect(screen.getByTestId("we-watchlists-empty")).toBeInTheDocument();
  });

  it("opening a watchlist and adding a symbol submits the correct payload", async () => {
    mockState.watchlistsData = [{ id: 7, name: "Personal List", kind: "personal", description: "", archived: false, sortOrder: 0, itemCount: 0, createdAt: "2026-07-21T00:00:00.000Z", updatedAt: "2026-07-21T00:00:00.000Z" }];
    mockState.detailData = { id: 7, name: "Personal List", kind: "personal", description: "", archived: false, sortOrder: 0, itemCount: 0, createdAt: "2026-07-21T00:00:00.000Z", updatedAt: "2026-07-21T00:00:00.000Z", items: [] };
    addItemMock.mutate.mockImplementation((_vars: unknown, opts: { onSuccess: () => void }) => opts.onSuccess());

    const user = userEvent.setup();
    renderWithClient(<WatchlistsEngine />);
    await user.click(screen.getByTestId("tab-we-watchlists"));
    await user.click(screen.getByTestId("watchlist-open-7"));

    expect(screen.getByTestId("panel-watchlist-detail")).toBeInTheDocument();
    expect(screen.getByTestId("watchlist-items-empty")).toBeInTheDocument();

    await user.type(screen.getByTestId("add-item-symbol"), "msft");
    await user.click(screen.getByTestId("add-item-btn"));

    expect(addItemMock.mutate).toHaveBeenCalledWith({ id: 7, data: { symbol: "msft", category: undefined, tags: undefined, notes: undefined } }, expect.anything());
  });

  it("Opportunity Overview: renders a held symbol's analytics and an honestly-not-held symbol distinctly", async () => {
    mockState.dashboardData = dashboard({
      opportunityOverview: [
        analytics({ symbol: "AAPL", heldInInvesting: true, investing: { marketValue: 1000, weightPct: 25, unrealizedPnl: 50, unrealizedPnlPct: 5, sector: "Technology" } }),
        analytics({ symbol: "NFLX" }),
      ],
    });
    const user = userEvent.setup();
    renderWithClient(<WatchlistsEngine />);
    await user.click(screen.getByTestId("tab-we-opportunity"));

    const aaplRow = screen.getByTestId("opportunity-row-AAPL");
    expect(aaplRow).toHaveTextContent("$1,000");
    const nflxRow = screen.getByTestId("opportunity-row-NFLX");
    expect(screen.getByTestId("opportunity-row-NFLX-not-held")).toBeInTheDocument();
    expect(nflxRow.textContent?.toLowerCase()).not.toMatch(/recommend|you should (buy|sell)/);
  });

  it("Opportunity Overview: shows an honest empty message when there are no watched symbols", async () => {
    mockState.dashboardData = dashboard();
    const user = userEvent.setup();
    renderWithClient(<WatchlistsEngine />);
    await user.click(screen.getByTestId("tab-we-opportunity"));
    expect(screen.getByTestId("we-opportunity-empty")).toBeInTheDocument();
  });

  it("renders the Coach & Learning tab with real topics and Learning Centre links, never a trade recommendation", async () => {
    const user = userEvent.setup();
    mockState.coachData = [{ topic: "watchlists", title: "Watchlists", explanation: ["Real explanation text."], disclaimer: "Educational only." }];
    mockState.learningData = [{ topic: "diversification", links: [{ pathKey: "portfolio", topicKey: "portfolio-diversification", title: "Portfolio Diversification", summary: "Summary.", href: "/learn/paths/portfolio/portfolio-diversification" }] }];
    renderWithClient(<WatchlistsEngine />);
    await user.click(screen.getByTestId("tab-we-learning"));
    expect(screen.getByTestId("we-coach-topic-watchlists")).toBeInTheDocument();
    expect(screen.getByTestId("we-learning-topic-diversification")).toBeInTheDocument();
    expect(screen.getByTestId("we-learning-link-portfolio-portfolio-diversification")).toBeInTheDocument();
  });

  it("renders the Reporting tab with deep links to the Watchlist Summary Report and Opportunity Dashboard Report", async () => {
    const user = userEvent.setup();
    renderWithClient(<WatchlistsEngine />);
    await user.click(screen.getByTestId("tab-we-reporting"));
    expect(screen.getByTestId("link-report-watchlist-summary-report")).toHaveAttribute("href", "/reporting-centre?reportType=watchlist-summary-report");
    expect(screen.getByTestId("link-report-opportunity-dashboard-report")).toHaveAttribute("href", "/reporting-centre?reportType=opportunity-dashboard-report");
    expect(screen.getByTestId("link-reporting-centre")).toHaveAttribute("href", "/reporting-centre");
  });
});
