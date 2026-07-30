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
}));
vi.mock("@/lib/ai-coach/tradePlansApi", () => ({
  listTradePlans: vi.fn(async () => []),
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
  });

  it("greets the signed-in user by name and shows the Command Centre badge", async () => {
    renderWithClient(<InstitutionalCommandCentre />);
    expect(await screen.findByTestId("command-centre-greeting")).toHaveTextContent(/Dunni/);
    expect(screen.getByTestId("badge-command-centre")).toBeInTheDocument();
  });

  it("renders all 9 workflow stages with real status detail, never a blank stage", async () => {
    renderWithClient(<InstitutionalCommandCentre />);
    for (const id of [
      "research",
      "notebook",
      "strategy",
      "trade-plan",
      "execute",
      "trade-journal",
      "performance",
      "portfolio",
      "learning",
    ]) {
      expect(await screen.findByTestId(`workflow-stage-${id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`workflow-stage-detail-${id}`).textContent?.length).toBeGreaterThan(0);
    }
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
});
