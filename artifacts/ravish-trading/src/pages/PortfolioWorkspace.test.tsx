// Phase 44 — Institutional Portfolio Workspace & Workflow Center.
// Frontend smoke tests, following the established mocked-generated-hook
// pattern (WatchlistsEngine.test.tsx, Phase 43).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const startMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const updateInstanceMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const deleteInstanceMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const pinMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const unpinMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const recordViewMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));

const mockState = vi.hoisted(() => ({
  dashboardData: undefined as unknown,
  dashboardLoading: false,
  dashboardError: false,
  catalogData: undefined as unknown,
  instancesData: undefined as unknown,
  pinsData: undefined as unknown,
  recentViewsData: undefined as unknown,
  quickActionsData: undefined as unknown,
  coachData: undefined as unknown,
  learningData: undefined as unknown,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetPortfolioWorkspaceDashboard: () => ({ data: mockState.dashboardData, isLoading: mockState.dashboardLoading, isError: mockState.dashboardError }),
    useListWorkflowDefinitions: () => ({ data: mockState.catalogData, isLoading: false }),
    useListWorkflowInstances: () => ({ data: mockState.instancesData, isLoading: false }),
    useStartWorkflowInstance: () => startMock,
    useUpdateWorkflowInstance: () => updateInstanceMock,
    useDeleteWorkflowInstance: () => deleteInstanceMock,
    useListPinnedResources: () => ({ data: mockState.pinsData, isLoading: false }),
    usePinResource: () => pinMock,
    useUnpinResource: () => unpinMock,
    useListRecentViews: () => ({ data: mockState.recentViewsData, isLoading: false }),
    useRecordRecentView: () => recordViewMock,
    useListQuickActions: () => ({ data: mockState.quickActionsData, isLoading: false }),
    useListWorkspaceCoachTopics: () => ({ data: mockState.coachData, isLoading: false }),
    useListWorkspaceLearning: () => ({ data: mockState.learningData, isLoading: false }),
  };
});

import PortfolioWorkspace from "./PortfolioWorkspace";

function dashboard(overrides: Record<string, unknown> = {}) {
  return {
    executiveHome: { overallHealthScore: 80, alertCount: 0, outstandingIssueCount: 0, investingHoldingsCount: 0, summary: "No Investing holdings on record yet." },
    holdingsOverview: { portfoliosCount: 0, holdingsCount: 0, totalMarketValue: null, totalUnrealizedPnl: null, totalUnrealizedPnlPct: null, topAllocations: [], driftedHoldingsCount: 0, summary: "No Investing holdings on record yet." },
    tradingOverview: { openPositionsCount: 0, accountValue: null, stopTargetDisciplinePct: null, totalRealizedPnl: null, winRate: null, summary: "No open Trading positions on record." },
    optionsOverview: { openPositionsCount: 0, portfolioValue: null, buyingPower: null, totalRealizedPnl: null, winRate: null, summary: "No open Options positions on record." },
    complianceOverview: { complianceSummary: { totalPolicies: 0, enabledPolicies: 0, compliantCount: 0, breachCount: 0, unavailableCount: 0, overallStatus: "no_policies", summary: "No policies configured." }, policyViolations: [], generatedAt: "2026-07-21T00:00:00.000Z" },
    watchlistsOverview: { watchlists: [], watchlistHealth: [], crossEngineSummary: {}, dashboardSummary: {}, generatedAt: "2026-07-21T00:00:00.000Z" },
    recentReports: { totalReports: 0, distinctReportTypesUsed: 0, byType: [], recentReports: [] },
    activeWorkflows: [],
    outstandingIssues: [],
    generatedAt: "2026-07-21T00:00:00.000Z",
    ...overrides,
  };
}

describe("PortfolioWorkspace", () => {
  beforeEach(() => {
    mockState.dashboardData = undefined;
    mockState.dashboardLoading = false;
    mockState.dashboardError = false;
    mockState.catalogData = undefined;
    mockState.instancesData = undefined;
    mockState.pinsData = undefined;
    mockState.recentViewsData = undefined;
    mockState.quickActionsData = undefined;
    mockState.coachData = undefined;
    mockState.learningData = undefined;
    startMock.mutate.mockReset();
    updateInstanceMock.mutate.mockReset();
    deleteInstanceMock.mutate.mockReset();
    pinMock.mutate.mockReset();
    unpinMock.mutate.mockReset();
    recordViewMock.mutate.mockReset();
  });

  it("renders the page header", () => {
    renderWithClient(<PortfolioWorkspace />);
    expect(screen.getByText("Institutional Portfolio Workspace")).toBeInTheDocument();
  });

  it("shows a loading skeleton while the dashboard is loading", () => {
    mockState.dashboardLoading = true;
    renderWithClient(<PortfolioWorkspace />);
    expect(screen.getByTestId("workspace-dashboard-loading")).toBeInTheDocument();
  });

  it("shows an honest error message if the dashboard fails to load", () => {
    mockState.dashboardError = true;
    renderWithClient(<PortfolioWorkspace />);
    expect(screen.getByTestId("workspace-dashboard-error")).toBeInTheDocument();
  });

  it("shows an honest empty dashboard for a brand-new user, never a fabricated status", () => {
    mockState.dashboardData = dashboard();
    renderWithClient(<PortfolioWorkspace />);
    expect(screen.getByTestId("card-holdings-overview")).toHaveTextContent("No Investing holdings on record yet.");
    expect(screen.getByTestId("recent-reports-empty")).toBeInTheDocument();
    expect(screen.getByTestId("outstanding-issues-empty")).toBeInTheDocument();
  });

  it("renders real Holdings Overview and Outstanding Issues figures, never fabricated", () => {
    mockState.dashboardData = dashboard({
      holdingsOverview: { portfoliosCount: 1, holdingsCount: 1, totalMarketValue: 1000, totalUnrealizedPnl: 50, totalUnrealizedPnlPct: 5, topAllocations: [{ symbol: "ORCL", marketValue: 1000, weightPct: 100 }], driftedHoldingsCount: 0, summary: "1 holding(s) across 1 portfolio(s)." },
      outstandingIssues: [{ source: "compliance", code: "policy_breach_1", label: "ORCL Position Cap", detail: "Breach: 100% vs 10% limit.", linkPath: "/monitoring-compliance-engine" }],
    });
    renderWithClient(<PortfolioWorkspace />);
    expect(screen.getByTestId("card-holdings-overview")).toHaveTextContent("$1,000");
    expect(screen.getByTestId("outstanding-issue-0")).toHaveTextContent("ORCL Position Cap");
    expect(screen.getByTestId("outstanding-issue-0")).toHaveTextContent("compliance");
  });

  it("Workflow Center: shows the catalog and starts a workflow with the correct payload", async () => {
    mockState.catalogData = [{ key: "morning_review", title: "Morning Review", description: "A quick daily pass.", cadence: "daily", steps: [{ key: "check_risk", label: "Check Risk", detail: "d", linkPath: "/risk-exposure-engine" }] }];
    mockState.instancesData = [];
    const user = userEvent.setup();
    renderWithClient(<PortfolioWorkspace />);
    await user.click(screen.getByTestId("tab-workflows"));
    expect(screen.getByTestId("active-workflows-empty")).toBeInTheDocument();
    await user.click(screen.getByTestId("button-start-workflow-morning_review"));
    expect(startMock.mutate).toHaveBeenCalledWith({ key: "morning_review" }, expect.anything());
  });

  it("Workflow Center: renders an active instance's progress and toggling a step submits the correct payload", async () => {
    mockState.catalogData = [{ key: "risk_review", title: "Risk Review", description: "d", cadence: "ad_hoc", steps: [{ key: "review_risk_overview", label: "Review Risk Overview", detail: "d", linkPath: "/risk-exposure-engine" }] }];
    mockState.instancesData = [{ id: 5, workflowKey: "risk_review", title: "Risk Review", status: "active", completedStepKeys: [], totalSteps: 1, startedAt: "2026-07-21T00:00:00.000Z", completedAt: null, updatedAt: "2026-07-21T00:00:00.000Z" }];
    const user = userEvent.setup();
    renderWithClient(<PortfolioWorkspace />);
    await user.click(screen.getByTestId("tab-workflows"));
    expect(screen.getByTestId("active-workflow-5")).toHaveTextContent("Risk Review");
    await user.click(screen.getByTestId("checkbox-step-5-review_risk_overview"));
    expect(updateInstanceMock.mutate).toHaveBeenCalledWith({ id: 5, data: { stepKey: "review_risk_overview", completed: true } }, expect.anything());
  });

  it("Workspace tab: shows honest empty Favorites/Recently Viewed and renders Quick Actions", async () => {
    mockState.pinsData = [];
    mockState.recentViewsData = [];
    mockState.quickActionsData = [{ key: "open_watchlists", label: "Open Watchlists & Opportunity Dashboard", linkPath: "/watchlists-engine" }];
    const user = userEvent.setup();
    renderWithClient(<PortfolioWorkspace />);
    await user.click(screen.getByTestId("tab-workspace"));
    expect(screen.getByTestId("favorites-empty")).toBeInTheDocument();
    expect(screen.getByTestId("recently-viewed-empty")).toBeInTheDocument();
    expect(screen.getByTestId("quick-action-open_watchlists")).toBeInTheDocument();
  });

  it("Workspace tab: pinning and unpinning a resource submits the correct payload", async () => {
    mockState.pinsData = [{ id: 3, resourceType: "dashboard", resourceKey: "watchlists-engine", label: "Watchlists & Opportunity Dashboard", linkPath: "/watchlists-engine", sortOrder: 0, createdAt: "2026-07-21T00:00:00.000Z" }];
    mockState.recentViewsData = [];
    mockState.quickActionsData = [];
    const user = userEvent.setup();
    renderWithClient(<PortfolioWorkspace />);
    await user.click(screen.getByTestId("tab-workspace"));
    expect(screen.getByTestId("pin-3")).toHaveTextContent("Watchlists & Opportunity Dashboard");
    await user.click(screen.getByTestId("button-unpin-3"));
    expect(unpinMock.mutate).toHaveBeenCalledWith({ id: 3 });

    await user.click(screen.getByTestId("button-pin-watchlists-engine"));
    expect(pinMock.mutate).toHaveBeenCalledWith({ data: { resourceType: "dashboard", resourceKey: "watchlists-engine", label: "Watchlists & Opportunity Dashboard", linkPath: "/watchlists-engine" } });
  });

  it("renders the Coach & Learning tab with real topics and Learning Centre links, never a trade recommendation", async () => {
    mockState.coachData = [{ topic: "governance", title: "Governance", explanation: ["Real explanation text."], disclaimer: "Educational only." }];
    mockState.learningData = [{ topic: "risk_review", links: [{ pathKey: "institutional", topicKey: "institutional-risk-contribution", title: "Risk Contribution", summary: "Summary.", href: "/learn/paths/institutional/institutional-risk-contribution" }] }];
    const user = userEvent.setup();
    renderWithClient(<PortfolioWorkspace />);
    await user.click(screen.getByTestId("tab-coach-learning"));
    expect(screen.getByTestId("coach-topic-governance")).toBeInTheDocument();
    expect(screen.getByTestId("coach-topic-governance").textContent?.toLowerCase()).not.toMatch(/recommend|you should (buy|sell)/);
    expect(screen.getByTestId("learning-topic-risk_review")).toHaveTextContent("Risk Contribution");
  });

  it("renders the Reporting tab with a link to the Reporting Centre", async () => {
    const user = userEvent.setup();
    renderWithClient(<PortfolioWorkspace />);
    await user.click(screen.getByTestId("tab-reporting"));
    expect(screen.getByTestId("link-open-reporting-centre")).toHaveAttribute("href", "/reporting-centre");
  });
});
