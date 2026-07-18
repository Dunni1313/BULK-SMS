// Phase 10 — Institutional Platform Polish & Control Center. Smoke tests
// for the new Institutional Home / Personal Dashboard page, following the
// established mocked-generated-hook pattern (see InstitutionalDashboard.test.tsx).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within, fireEvent } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  activeWorkspace: undefined as unknown,
  activeWorkspaceLoading: false,
  workspaces: undefined as unknown,
  dashboard: undefined as unknown,
  summary: undefined as unknown,
  theta: undefined as unknown,
  openTrades: undefined as unknown,
  report: undefined as unknown,
  mentor: undefined as unknown,
  eventRisk: undefined as unknown,
  journalEntries: undefined as unknown,
  closedTrades: undefined as unknown,
  notifications: undefined as unknown,
  watchlist: undefined as unknown,
  updateWorkspaceMutate: vi.fn(),
  activateWorkspaceMutate: vi.fn(),
  createWorkspaceMutate: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetActiveWorkspace: () => ({ data: mockState.activeWorkspace, isLoading: mockState.activeWorkspaceLoading }),
    useListWorkspaces: () => ({ data: mockState.workspaces }),
    useUpdateWorkspace: () => ({ mutate: mockState.updateWorkspaceMutate, isPending: false }),
    useCreateWorkspace: () => ({ mutate: mockState.createWorkspaceMutate, isPending: false }),
    useDuplicateWorkspace: () => ({ mutate: vi.fn(), isPending: false }),
    useDeleteWorkspace: () => ({ mutate: vi.fn(), isPending: false }),
    useActivateWorkspace: () => ({ mutate: mockState.activateWorkspaceMutate, isPending: false }),
    useGetPortfolioDashboard: () => ({ data: mockState.dashboard, isLoading: false }),
    useGetPortfolioSummary: () => ({ data: mockState.summary, isLoading: false }),
    useGetThetaIncome: () => ({ data: mockState.theta, isLoading: false }),
    useListTrades: (params: { status: string }) => ({
      data: params.status === "closed" ? mockState.closedTrades : mockState.openTrades,
    }),
    useGetCrossEngineDailyReport: () => ({ data: mockState.report }),
    useGetInstitutionalMentor: () => ({ data: mockState.mentor, isLoading: false }),
    useGetPortfolioEventRisk: () => ({ data: mockState.eventRisk, isLoading: false }),
    useListJournalEntries: () => ({ data: mockState.journalEntries }),
    useListNotifications: () => ({ data: mockState.notifications }),
    useGetValueWatchlist: () => ({ data: mockState.watchlist, isLoading: false }),
  };
});

import Home from "./Home";

function makeWorkspace(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    name: "Default",
    isDefault: true,
    isActive: true,
    widgetConfig: [
      { id: "portfolio-health", visible: true, size: "normal", order: 0 },
      { id: "todays-pnl", visible: true, size: "normal", order: 1 },
      { id: "theta-income", visible: false, size: "normal", order: 2 },
      { id: "quick-actions", visible: true, size: "normal", order: 3 },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  mockState.activeWorkspace = undefined;
  mockState.activeWorkspaceLoading = false;
  mockState.workspaces = [makeWorkspace()];
  mockState.dashboard = undefined;
  mockState.summary = undefined;
  mockState.theta = undefined;
  mockState.openTrades = undefined;
  mockState.report = undefined;
  mockState.mentor = undefined;
  mockState.eventRisk = undefined;
  mockState.journalEntries = undefined;
  mockState.closedTrades = undefined;
  mockState.notifications = undefined;
  mockState.watchlist = undefined;
  mockState.updateWorkspaceMutate = vi.fn();
  mockState.activateWorkspaceMutate = vi.fn();
  mockState.createWorkspaceMutate = vi.fn();
});

describe("Home (Institutional Home / Personal Dashboard)", () => {
  it("shows a loading skeleton before the active workspace resolves", () => {
    mockState.activeWorkspaceLoading = true;
    renderWithClient(<Home />);
    expect(screen.getByTestId("home-loading")).toBeInTheDocument();
  });

  it("renders only the visible widgets from the active workspace's own config, honoring order", () => {
    mockState.activeWorkspace = makeWorkspace();
    mockState.dashboard = { healthScore: 88, overallRiskRating: { code: "healthy", label: "Healthy" }, guidance: [], buyingPower: 50000 };
    mockState.summary = { dayPnl: 250.5 };
    renderWithClient(<Home />);

    expect(screen.getByTestId("widget-portfolio-health")).toBeInTheDocument();
    expect(screen.getByTestId("widget-todays-pnl")).toBeInTheDocument();
    expect(screen.getByTestId("widget-quick-actions")).toBeInTheDocument();
    // theta-income is visible:false in the fixture and not in edit mode —
    // never rendered at all, not just hidden via CSS.
    expect(screen.queryByTestId("widget-theta-income")).not.toBeInTheDocument();
  });

  it("Edit Layout mode reveals hidden widgets (dimmed) and per-widget controls, and Save Layout persists the config", () => {
    mockState.activeWorkspace = makeWorkspace();
    renderWithClient(<Home />);

    fireEvent.click(screen.getByTestId("button-edit-layout"));
    // Now the hidden theta-income widget is visible in the DOM (edit mode
    // shows every widget so it can be re-enabled), dimmed via opacity.
    expect(screen.getByTestId("widget-theta-income")).toBeInTheDocument();
    expect(screen.getByTestId("button-toggle-visible-theta-income")).toBeInTheDocument();
    expect(screen.getByTestId("button-move-up-todays-pnl")).toBeInTheDocument();
    expect(screen.getByTestId("button-toggle-size-todays-pnl")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-save-layout"));
    expect(mockState.updateWorkspaceMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, data: expect.objectContaining({ widgetConfig: expect.any(Array) }) }),
      expect.anything(),
    );
  });

  it("moving a widget up in Edit Layout mode swaps its order with the previous one", () => {
    mockState.activeWorkspace = makeWorkspace();
    renderWithClient(<Home />);
    fireEvent.click(screen.getByTestId("button-edit-layout"));

    // todays-pnl (order 1) moves above portfolio-health (order 0).
    fireEvent.click(screen.getByTestId("button-move-up-todays-pnl"));
    const grid = screen.getByTestId("widget-grid");
    const titles = within(grid)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(titles.indexOf("Today's P/L")).toBeLessThan(titles.indexOf("Portfolio Health"));
  });

  it("the workspace switcher lists every workspace and can trigger New Workspace", () => {
    mockState.activeWorkspace = makeWorkspace();
    mockState.workspaces = [makeWorkspace(), makeWorkspace({ id: 2, name: "Income Trading", isActive: false })];
    renderWithClient(<Home />);

    expect(screen.getByTestId("select-workspace")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-new-workspace"));
    expect(screen.getByTestId("dialog-workspace-name")).toBeInTheDocument();
  });

  it("the AI Portfolio Briefing widget shows the cross-engine report's own summary and a link to the full report", () => {
    mockState.activeWorkspace = makeWorkspace({
      widgetConfig: [{ id: "ai-briefing", visible: true, size: "normal", order: 0 }],
    });
    mockState.report = {
      date: "2026-07-17",
      summary: "Everything looks stable today.",
      engine1: { macro: { regime: "stable_rates", regimeLabel: "Stable Rates", summary: "Rates holding." } },
    };
    renderWithClient(<Home />);
    expect(screen.getByText("Everything looks stable today.")).toBeInTheDocument();
    expect(screen.getByText(/Open full daily report/)).toBeInTheDocument();
  });

  // Phase 12 — Institutional Investing Engine Consolidation & Integration.
  describe("watchlist-summary widget", () => {
    it("is auto-reconciled into a workspace saved before this widget existed", () => {
      // makeWorkspace()'s own fixture (4 widgets) predates "watchlist-summary".
      mockState.activeWorkspace = makeWorkspace();
      mockState.watchlist = [];
      renderWithClient(<Home />);
      expect(screen.getByTestId("widget-watchlist-summary")).toBeInTheDocument();
    });

    it("shows the honest empty state with no watchlist rows", () => {
      mockState.activeWorkspace = makeWorkspace({
        widgetConfig: [{ id: "watchlist-summary", visible: true, size: "normal", order: 0 }],
      });
      mockState.watchlist = [];
      renderWithClient(<Home />);
      expect(screen.getByText("No names on your Institutional Investing watchlist yet.")).toBeInTheDocument();
    });

    it("shows up to 3 real watchlist rows with their decisions, reusing GET /value-watchlist directly", () => {
      mockState.activeWorkspace = makeWorkspace({
        widgetConfig: [{ id: "watchlist-summary", visible: true, size: "normal", order: 0 }],
      });
      mockState.watchlist = [
        { id: 1, symbol: "AAPL", currentDecision: "LONG-TERM BUY" },
        { id: 2, symbol: "MSFT", currentDecision: "WATCHLIST" },
      ];
      renderWithClient(<Home />);
      const widget = screen.getByTestId("widget-content-watchlist-summary");
      expect(within(widget).getByText("AAPL")).toBeInTheDocument();
      expect(within(widget).getByText("LONG-TERM BUY")).toBeInTheDocument();
      expect(within(widget).getByText("View all 2 →")).toBeInTheDocument();
    });
  });
});
