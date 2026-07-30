// v1.5.0, Sprint 12 — Institutional Command Centre. Smoke tests following
// the established mocked-generated-hook pattern (see Home.test.tsx,
// InstitutionalDashboard.test.tsx). useWorkflowSnapshot() calls the
// ai-coach API modules' own plain fetch functions directly (not a
// generated hook), so those 3 modules are mocked separately, mirroring
// how CrossEngineDailyReport.test.tsx already mocks streamCoach.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";

vi.mock("@/lib/ai-coach/notebooksApi", () => ({
  listNotebooks: vi.fn(async () => []),
}));
vi.mock("@/lib/ai-coach/strategiesApi", () => ({
  listStrategies: vi.fn(async () => []),
  getStrategy: vi.fn(async () => null),
  getMissingSections: vi.fn(async () => null),
}));

const listTradePlansMock = vi.hoisted(() => vi.fn(async (_coachId?: string) => [] as unknown[]));
const getTradePlanMock = vi.hoisted(() => vi.fn());
const getMissingTradePlanInformationMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai-coach/tradePlansApi", () => ({
  listTradePlans: listTradePlansMock,
  getTradePlan: getTradePlanMock,
  getMissingTradePlanInformation: getMissingTradePlanInformationMock,
}));

vi.mock("@/lib/auth-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth-client")>("@/lib/auth-client");
  return {
    ...actual,
    useSession: () => ({ data: { user: { name: "Dunni", email: "dunni@example.com" } } }),
  };
});

const mockState = vi.hoisted(() => ({
  dailyReport: undefined as unknown,
  portfolioDashboard: undefined as unknown,
  learningProgress: undefined as unknown,
  marketBriefing: undefined as unknown,
  macroContext: undefined as unknown,
  topOpportunities: undefined as unknown,
  upcomingEvents: undefined as unknown,
  watchlist: undefined as unknown,
  notifications: [] as unknown[],
  journalEntries: [] as unknown[],
  closedTrades: [] as unknown[],
  // v1.5.0, Sprint 15 — Portfolio & Risk Intelligence. Mocked (never left
  // to fall through to the real generated hooks) so the new
  // PortfolioIntelligenceCard never issues a real network fetch in tests.
  portfolioConcentration: undefined as unknown,
  portfolios: [] as unknown[],
  portfolioRisk: undefined as unknown,
  tradingRisk: undefined as unknown,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetCrossEngineDailyReport: () => ({ data: mockState.dailyReport, isLoading: false, isError: false }),
    useGetPortfolioDashboard: () => ({ data: mockState.portfolioDashboard, isLoading: false }),
    useGetLearningProgress: () => ({ data: mockState.learningProgress, isLoading: false }),
    useGetMarketBriefing: () => ({ data: mockState.marketBriefing, isLoading: false }),
    useGetMacroContext: () => ({ data: mockState.macroContext }),
    useGetTopOpportunities: () => ({ data: mockState.topOpportunities }),
    useGetUpcomingEvents: () => ({ data: mockState.upcomingEvents }),
    useGetValueWatchlist: () => ({ data: mockState.watchlist }),
    useListNotifications: () => ({ data: mockState.notifications }),
    useListJournalEntries: () => ({ data: mockState.journalEntries }),
    useListTrades: () => ({ data: mockState.closedTrades }),
    useGetPortfolioConcentration: () => ({ data: mockState.portfolioConcentration, isLoading: false }),
    useGetPortfolios: () => ({ data: mockState.portfolios, isLoading: false }),
    useGetPortfolioRisk: () => ({ data: mockState.portfolioRisk, isLoading: false }),
    useGetTradingRisk: () => ({ data: mockState.tradingRisk, isLoading: false }),
  };
});

import InstitutionalCommandCentre from "./InstitutionalCommandCentre";

function dailyReport() {
  return { date: "2026-07-30", summary: "Quiet day across all 3 engines." };
}

function portfolioDashboard() {
  return {
    portfolioValue: 125000,
    healthScore: 82,
    overallRiskRating: { code: "healthy", label: "Healthy" },
    buyingPower: 45000,
    guidance: [],
    allocationBySector: [{ label: "Technology", weightPct: 40 }],
  };
}

describe("InstitutionalCommandCentre", () => {
  beforeEach(() => {
    mockState.dailyReport = dailyReport();
    mockState.portfolioDashboard = portfolioDashboard();
    mockState.learningProgress = { pathCompletion: [], recentHistory: [] };
    mockState.marketBriefing = undefined;
    mockState.macroContext = undefined;
    mockState.topOpportunities = undefined;
    mockState.upcomingEvents = [];
    mockState.watchlist = [];
    mockState.notifications = [];
    mockState.journalEntries = [];
    mockState.closedTrades = [];
    mockState.portfolioConcentration = undefined;
    mockState.portfolios = [];
    mockState.portfolioRisk = undefined;
    mockState.tradingRisk = undefined;
    listTradePlansMock.mockReset().mockResolvedValue([]);
    getTradePlanMock.mockReset();
    getMissingTradePlanInformationMock.mockReset();
  });

  it("greets the signed-in user by name and shows the Command Centre badge", async () => {
    renderWithClient(<InstitutionalCommandCentre />);
    expect(await screen.findByTestId("command-centre-greeting")).toHaveTextContent(/Dunni/);
    expect(screen.getByTestId("badge-command-centre")).toBeInTheDocument();
  });

  it("renders all 12 workflow stages with real status detail, never a blank stage (9 original + Decision [Sprint 13] + Open Position/Trade Management [Sprint 14])", async () => {
    renderWithClient(<InstitutionalCommandCentre />);
    for (const id of [
      "research",
      "notebook",
      "strategy",
      "trade-plan",
      "decision",
      "execute",
      "open-position",
      "trade-management",
      "trade-journal",
      "performance",
      "portfolio",
      "learning",
    ]) {
      expect(await screen.findByTestId(`workflow-stage-${id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`workflow-stage-detail-${id}`).textContent?.length).toBeGreaterThan(0);
    }
  });

  it("shows an honest 'no open positions' status on the Open Position / Trade Management workflow stages when none exist, per Sprint 14", async () => {
    renderWithClient(<InstitutionalCommandCentre />);
    expect(await screen.findByTestId("workflow-stage-detail-open-position")).toHaveTextContent("No freshly opened positions");
    expect(screen.getByTestId("workflow-stage-detail-trade-management")).toHaveTextContent("No open positions being actively managed");
  });

  it("renders the Execution Pipeline card, reusing the same trade-lifecycle pipeline the Workflow Panel already computed, per Sprint 14", async () => {
    renderWithClient(<InstitutionalCommandCentre />);
    expect(await screen.findByTestId("card-execution-pipeline")).toBeInTheDocument();
    expect(screen.getByTestId("pipeline-requiring-action")).toHaveTextContent("0");
    expect(screen.getByTestId("pipeline-open-positions")).toHaveTextContent("0");
    expect(screen.getByTestId("pipeline-execution-ready")).toHaveTextContent("0");
    expect(screen.getByTestId("pipeline-bottleneck")).toHaveTextContent("None");
    expect(screen.getByTestId("pipeline-recent-completions-none")).toBeInTheDocument();
    expect(screen.getByTestId("pipeline-view-link")).toHaveAttribute("href", "/execution-lifecycle");
  });

  it("shows an honest 'no decision in progress' status on the Decision workflow stage when none exists, per Sprint 13", async () => {
    renderWithClient(<InstitutionalCommandCentre />);
    expect(await screen.findByTestId("workflow-stage-detail-decision")).toHaveTextContent("No decision in progress");
  });

  it("shows the real Decision Score on the Decision workflow stage when a decision is in progress, per Sprint 13", async () => {
    listTradePlansMock.mockImplementation(async (coachId: string) =>
      coachId === "trading"
        ? [{ id: 7, coachId: "trading", title: "AAPL breakout", status: "draft", updatedAt: "2026-07-29T00:00:00Z" }]
        : [],
    );
    getTradePlanMock.mockResolvedValue({
      id: 7,
      coachId: "trading",
      workspaceId: null,
      strategyId: null,
      title: "AAPL breakout",
      plannedAsset: "AAPL",
      assetClass: "equity",
      direction: "long",
      status: "draft",
      pinned: false,
      tags: [],
      currentVersion: 1,
      executedTradeRef: null,
      executedAt: null,
      createdAt: "2026-07-29T00:00:00Z",
      updatedAt: "2026-07-29T00:00:00Z",
      sections: [],
      versions: [],
      checklistItems: [],
      checklistProgress: { totalItems: 4, completedItems: 0, requiredItems: 2, completedRequiredItems: 0, progressPct: 0, readyForEntry: false },
    });
    getMissingTradePlanInformationMock.mockResolvedValue({ missing: [], present: [], completenessPct: 100 });

    renderWithClient(<InstitutionalCommandCentre />);
    expect(await screen.findByTestId("workflow-stage-detail-decision")).toHaveTextContent(/\/100/);
  });

  it("never renders Execute as a clickable link — this platform has no execution feature", async () => {
    renderWithClient(<InstitutionalCommandCentre />);
    await screen.findByTestId("workflow-stage-execute");
    expect(screen.queryByTestId("workflow-stage-link-execute")).not.toBeInTheDocument();
  });

  it("renders the AI Daily Briefing via the shared DailyBriefingCard", async () => {
    renderWithClient(<InstitutionalCommandCentre />);
    expect(await screen.findByTestId("daily-report-summary-text")).toHaveTextContent(/Quiet day/i);
  });

  it("renders the Command Centre quick actions and the Ask AI Coach launcher", async () => {
    renderWithClient(<InstitutionalCommandCentre />);
    const researchAction = await screen.findByTestId("quick-action-continue-research");
    expect(researchAction.closest("a")).toHaveAttribute("href", "/stock-analyst");
    expect(screen.getByTestId("quick-action-open-notebook")).toBeInTheDocument();
    expect(screen.getAllByTestId("button-ask-coach-launcher").length).toBeGreaterThan(0);
  });

  it("shows an honest empty watchlist/no-opportunity state in Market Overview, never a fabricated result", async () => {
    renderWithClient(<InstitutionalCommandCentre />);
    expect(await screen.findByTestId("market-overview-no-opportunity")).toBeInTheDocument();
    expect(screen.getByTestId("market-overview-no-events")).toBeInTheDocument();
  });

  it("renders real Portfolio Snapshot figures from the existing Portfolio Risk Dashboard hook", async () => {
    renderWithClient(<InstitutionalCommandCentre />);
    expect(await screen.findByTestId("portfolio-snapshot-value")).toHaveTextContent("$125,000.00");
    expect(screen.getByText("Healthy")).toBeInTheDocument();
  });

  it("shows an honest 'nothing in progress' Learning Panel when there is no learning progress yet", async () => {
    renderWithClient(<InstitutionalCommandCentre />);
    expect(await screen.findByTestId("learning-panel-none-in-progress")).toBeInTheDocument();
    expect(screen.getByTestId("learning-panel-no-recent")).toBeInTheDocument();
  });

  it("shows the current lesson path and recently completed items when learning progress exists", async () => {
    mockState.learningProgress = {
      pathCompletion: [{ pathKey: "trading-engine", title: "Institutional Trading Engine", topicsTotal: 5, topicsCompleted: 2, percentComplete: 40 }],
      recentHistory: [{ itemType: "lesson", itemKey: "trading-market-structure", viewedAt: "2026-07-29T00:00:00Z", completedAt: "2026-07-29T00:10:00Z" }],
    };
    renderWithClient(<InstitutionalCommandCentre />);
    expect(await screen.findByTestId("learning-panel-current")).toHaveTextContent(/Institutional Trading Engine/);
    expect(screen.getByTestId("learning-panel-recent-list")).toHaveTextContent(/trading-market-structure/);
  });

  it("shows an honest 'nothing needs attention' notifications state when there are no alerts or action items", async () => {
    renderWithClient(<InstitutionalCommandCentre />);
    expect(await screen.findByTestId("notifications-empty")).toBeInTheDocument();
  });

  it("merges real unread notifications with derived workflow action items, never a fabricated second alert system", async () => {
    mockState.notifications = [{ id: 1, title: "AAPL crossed your price target", isRead: false }];
    mockState.closedTrades = [{ id: 1, symbol: "AAPL", strategy: "iron_condor", status: "closed", closeDate: "2026-07-01", openDate: "2026-06-01" }];
    mockState.journalEntries = [];
    renderWithClient(<InstitutionalCommandCentre />);
    await waitFor(() => expect(screen.getByTestId("notification-real-1")).toBeInTheDocument());
    expect(screen.getByTestId("notification-action-journal-outstanding")).toHaveTextContent(/1 recent closed trade/);
  });

  it("links to Personal Dashboard and the Options Command Center, never removing either surface", async () => {
    renderWithClient(<InstitutionalCommandCentre />);
    expect(await screen.findByTestId("link-to-personal-dashboard")).toHaveAttribute("href", "/personal-dashboard");
    expect(screen.getByTestId("link-to-options-command-center")).toHaveAttribute("href", "/command-center");
  });

  it("shows an honest 'no decision in progress' state when no trade plan exists, per Sprint 13", async () => {
    renderWithClient(<InstitutionalCommandCentre />);
    expect(await screen.findByTestId("decision-in-progress-none")).toBeInTheDocument();
  });

  it("surfaces the real most-recently-updated in-progress decision with its score and evidence gap, per Sprint 13", async () => {
    listTradePlansMock.mockImplementation(async (coachId: string) =>
      coachId === "trading"
        ? [{ id: 7, coachId: "trading", title: "AAPL breakout", status: "draft", updatedAt: "2026-07-29T00:00:00Z" }]
        : [],
    );
    getTradePlanMock.mockResolvedValue({
      id: 7,
      coachId: "trading",
      workspaceId: null,
      strategyId: null,
      title: "AAPL breakout",
      plannedAsset: "AAPL",
      assetClass: "equity",
      direction: "long",
      status: "draft",
      pinned: false,
      tags: [],
      currentVersion: 1,
      executedTradeRef: null,
      executedAt: null,
      createdAt: "2026-07-29T00:00:00Z",
      updatedAt: "2026-07-29T00:00:00Z",
      sections: [],
      versions: [],
      checklistItems: [],
      checklistProgress: { totalItems: 4, completedItems: 0, requiredItems: 2, completedRequiredItems: 0, progressPct: 0, readyForEntry: false },
    });
    getMissingTradePlanInformationMock.mockResolvedValue({
      missing: ["market_context"],
      present: [],
      completenessPct: 0,
    });

    renderWithClient(<InstitutionalCommandCentre />);
    expect(await screen.findByTestId("decision-in-progress-title")).toHaveTextContent("AAPL breakout");
    expect(screen.getByTestId("decision-in-progress-score")).toBeInTheDocument();
    expect(screen.getByTestId("decision-in-progress-gap")).toBeInTheDocument();
    expect(screen.getByTestId("decision-in-progress-link")).toHaveAttribute("href", "/decision-workflow?planId=7");
  });

  // v1.5.0, Sprint 15 — Institutional Portfolio & Risk Intelligence Engine.
  it("renders the Portfolio & Risk Intelligence card, reusing usePortfolioRiskIntelligence() directly, per Sprint 15", async () => {
    mockState.portfolioDashboard = portfolioDashboard();
    renderWithClient(<InstitutionalCommandCentre />);
    expect(await screen.findByTestId("card-portfolio-intelligence")).toBeInTheDocument();
    expect(screen.getByTestId("portfolio-intelligence-health-badge")).toHaveTextContent(/\/100/);
    expect(screen.getByTestId("portfolio-intelligence-pending-impact")).toHaveTextContent("None pending");
    expect(screen.getByTestId("portfolio-intelligence-trends")).toHaveTextContent(/Point-in-time reading/);
    expect(screen.getByTestId("portfolio-intelligence-view-link")).toHaveAttribute("href", "/portfolio-risk-intelligence");
  });

  it("shows an honest 'no elevated risk signals' state on the Portfolio & Risk Intelligence card when nothing is resolvable, per Sprint 15", async () => {
    renderWithClient(<InstitutionalCommandCentre />);
    expect(await screen.findByTestId("card-portfolio-intelligence")).toBeInTheDocument();
    expect(screen.getByTestId("portfolio-intelligence-no-alerts")).toBeInTheDocument();
  });
});
