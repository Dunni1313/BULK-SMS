// Phase 10 — Institutional Platform Polish & Control Center. Tests for
// the Global Command Palette / Global Search dialog.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  openTrades: undefined as unknown,
  journalEntries: undefined as unknown,
  glossaryTerms: undefined as unknown,
  strategies: undefined as unknown,
  learningPaths: undefined as unknown,
  intelligence: undefined as unknown,
  watchlist: undefined as unknown,
  portfolios: undefined as unknown,
  // v1.4.0, Sprint L1 — Learning Centre Foundation.
  progress: undefined as unknown,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useListTrades: () => ({ data: mockState.openTrades }),
    useListJournalEntries: () => ({ data: mockState.journalEntries }),
    useGetGlossary: () => ({ data: mockState.glossaryTerms }),
    useGetStrategyAcademy: () => ({ data: mockState.strategies }),
    useGetLearningPaths: () => ({ data: mockState.learningPaths }),
    useGetInstitutionalIntelligence: () => ({ data: mockState.intelligence }),
    useGetValueWatchlist: () => ({ data: mockState.watchlist }),
    useGetPortfolios: () => ({ data: mockState.portfolios }),
    // v1.4.0, Sprint L1 — Learning Centre Foundation.
    useGetLearningProgress: () => ({ data: mockState.progress }),
  };
});

vi.mock("@/lib/portfolio-export", () => ({ downloadPortfolioCsv: vi.fn() }));
import { downloadPortfolioCsv } from "@/lib/portfolio-export";

// v1.5.0, Sprint 17 — Institutional Knowledge & Intelligence Graph. Extends
// the existing search — Research/My Strategies/Trade Plans, mirroring
// this file's own established plain-fetch mocking pattern.
const listNotebooksMock = vi.hoisted(() => vi.fn(async (_coachId?: string) => [] as unknown[]));
const listStrategiesApiMock = vi.hoisted(() => vi.fn(async (_coachId?: string) => [] as unknown[]));
const listTradePlansMock = vi.hoisted(() => vi.fn(async (_coachId?: string) => [] as unknown[]));

vi.mock("@/lib/ai-coach/notebooksApi", () => ({ listNotebooks: listNotebooksMock }));
vi.mock("@/lib/ai-coach/strategiesApi", () => ({ listStrategies: listStrategiesApiMock }));
vi.mock("@/lib/ai-coach/tradePlansApi", () => ({ listTradePlans: listTradePlansMock }));

import { CommandPalette } from "./CommandPalette";
import { Toaster } from "@/components/ui/toaster";

beforeEach(() => {
  mockState.openTrades = [];
  mockState.journalEntries = [];
  mockState.glossaryTerms = [];
  mockState.strategies = [];
  mockState.learningPaths = [];
  mockState.intelligence = undefined;
  mockState.watchlist = [];
  mockState.portfolios = [];
  mockState.progress = undefined;
  window.history.pushState(null, "", "/");
  listNotebooksMock.mockReset().mockResolvedValue([]);
  listStrategiesApiMock.mockReset().mockResolvedValue([]);
  listTradePlansMock.mockReset().mockResolvedValue([]);
  vi.clearAllMocks();
});

describe("CommandPalette", () => {
  it("renders nothing (the dialog content) when closed", () => {
    renderWithClient(<CommandPalette open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByTestId("command-palette-input")).not.toBeInTheDocument();
  });

  it("shows the input and every static group when open", () => {
    renderWithClient(<CommandPalette open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByTestId("command-palette-input")).toBeInTheDocument();
    expect(screen.getByText("Quick Actions")).toBeInTheDocument();
    expect(screen.getByText("Navigate")).toBeInTheDocument();
  });

  it("navigating via a nav item calls onOpenChange(false) and updates the location", async () => {
    const onOpenChange = vi.fn();
    renderWithClient(<CommandPalette open={true} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByTestId("command-item-nav-/settings"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(window.location.pathname).toBe("/settings");
  });

  it("typing filters the visible items (cmdk's own fuzzy search)", async () => {
    const user = userEvent.setup();
    renderWithClient(<CommandPalette open={true} onOpenChange={vi.fn()} />);
    await user.type(screen.getByTestId("command-palette-input"), "Settings");
    expect(screen.getByTestId("command-item-nav-/settings")).toBeInTheDocument();
    expect(screen.queryByTestId("command-item-nav-/scanner")).not.toBeInTheDocument();
  });

  it("shows an open position once fetched, and selecting it navigates to its ticket", () => {
    mockState.openTrades = [{ id: 42, symbol: "SPY", strategy: "iron_condor" }];
    const onOpenChange = vi.fn();
    renderWithClient(<CommandPalette open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByTestId("command-item-position-42")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("command-item-position-42"));
    expect(window.location.pathname).toBe("/ticket/adjust/42");
  });

  // Phase 12 — Institutional Investing Engine Consolidation & Integration.
  it("shows a watchlist entry once fetched, and selecting it navigates to Value Research pre-filled with the symbol", () => {
    mockState.watchlist = [{ id: 5, symbol: "AAPL", category: "Researching", currentDecision: "LONG-TERM BUY" }];
    const onOpenChange = vi.fn();
    renderWithClient(<CommandPalette open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByTestId("command-item-watchlist-AAPL")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("command-item-watchlist-AAPL"));
    expect(window.location.pathname + window.location.search).toBe("/stock-analyst?symbol=AAPL");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // Phase 13 — Institutional Portfolio Manager.
  it("shows a portfolio entry once fetched, and selecting it deep-links to the Portfolio Manager pre-selected", () => {
    mockState.portfolios = [{ id: 7, name: "Core Value", description: "", holdingsCount: 3 }];
    const onOpenChange = vi.fn();
    renderWithClient(<CommandPalette open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByTestId("command-item-portfolio-7")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("command-item-portfolio-7"));
    expect(window.location.pathname + window.location.search).toBe(
      "/stock-analyst/portfolio-construction?portfolioId=7",
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // v1.4.0, Sprint L1 — Learning Centre Foundation. Search integration:
  // extends this same palette's existing data sources.
  it("shows a bookmark once fetched, resolves its real href via the owning learning path, and navigates on selection", () => {
    mockState.learningPaths = [
      { key: "platform-basics", title: "Platform Basics", description: "", glossaryCategory: "platform", topics: [{ key: "platform-basics-navigation" }] },
    ];
    mockState.progress = {
      bookmarks: [{ itemType: "lesson", itemKey: "platform-basics-navigation", bookmarkedAt: "2026-07-17T00:00:00.000Z" }],
    };
    const onOpenChange = vi.fn();
    renderWithClient(<CommandPalette open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText("Bookmarks")).toBeInTheDocument();
    const item = screen.getByTestId("command-item-bookmark-lesson-platform-basics-navigation");
    expect(item).toBeInTheDocument();
    fireEvent.click(item);
    expect(window.location.pathname).toBe("/learn/paths/platform-basics/platform-basics-navigation");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("never fabricates a Bookmarks entry for an item whose owning page can't be resolved", () => {
    mockState.learningPaths = [];
    mockState.progress = {
      bookmarks: [{ itemType: "coach", itemKey: "investment:AAPL", bookmarkedAt: "2026-07-17T00:00:00.000Z" }],
    };
    renderWithClient(<CommandPalette open={true} onOpenChange={vi.fn()} />);
    expect(screen.queryByText("Bookmarks")).not.toBeInTheDocument();
  });

  it("Export Portfolio downloads a CSV of open positions and never navigates", () => {
    mockState.openTrades = [{ id: 1, symbol: "AAPL", strategy: "iron_fly" }];
    const onOpenChange = vi.fn();
    renderWithClient(<CommandPalette open={true} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByTestId("command-item-quick-export-portfolio"));
    expect(downloadPortfolioCsv).toHaveBeenCalledWith(mockState.openTrades);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("selecting a workflow navigates to its first step and closes the palette", () => {
    const onOpenChange = vi.fn();
    renderWithClient(<CommandPalette open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText("Workflows")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("command-item-workflow-morning-review"));
    expect(window.location.pathname).toBe("/");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("a workflow's toast 'Next' action advances to the following step", () => {
    renderWithClient(
      <>
        <CommandPalette open={true} onOpenChange={vi.fn()} />
        <Toaster />
      </>,
    );
    fireEvent.click(screen.getByTestId("command-item-workflow-risk-management-check"));
    expect(window.location.pathname).toBe("/portfolio-dashboard");
    const next = screen.getByTestId("workflow-next-risk-management-check");
    fireEvent.click(next);
    expect(window.location.pathname).toBe("/concentration-risk");
  });

  it("shows AI observations once the Intelligence Engine result resolves", () => {
    mockState.intelligence = {
      observations: [{ code: "obs-1", title: "Diversification improving", explanation: "Sector spread widened." }],
    };
    renderWithClient(<CommandPalette open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByTestId("command-item-observation-obs-1")).toBeInTheDocument();
  });

  // v1.5.0, Sprint 17 — Institutional Knowledge & Intelligence Graph.
  it("fetches Research/My Strategies/Trade Plans only once the palette is open, and shows a real result of each once resolved", async () => {
    listNotebooksMock.mockImplementation(async (coachId?: string) => (coachId === "trading" ? [{ id: 1, title: "NVDA momentum research", tags: ["NVDA"] }] : []));
    listStrategiesApiMock.mockImplementation(async (coachId?: string) => (coachId === "trading" ? [{ id: 10, title: "Breakout momentum", tags: [] }] : []));
    listTradePlansMock.mockImplementation(async (coachId?: string) => (coachId === "trading" ? [{ id: 100, title: "NVDA breakout plan", plannedAsset: "NVDA", tags: [] }] : []));

    renderWithClient(<CommandPalette open={false} onOpenChange={vi.fn()} />);
    expect(listNotebooksMock).not.toHaveBeenCalled();

    renderWithClient(<CommandPalette open={true} onOpenChange={vi.fn()} />);
    expect(await screen.findByTestId("command-item-notebook-1")).toHaveTextContent("NVDA momentum research");
    expect(await screen.findByTestId("command-item-my-strategy-10")).toHaveTextContent("Breakout momentum");
    expect(await screen.findByTestId("command-item-trade-plan-100")).toHaveTextContent("NVDA breakout plan (NVDA)");
  });

  it("selecting a real Trade Plan navigates to the Execution & Lifecycle Manager pre-selected", async () => {
    listTradePlansMock.mockImplementation(async (coachId?: string) => (coachId === "trading" ? [{ id: 100, title: "NVDA breakout plan", plannedAsset: "NVDA", tags: [] }] : []));
    const onOpenChange = vi.fn();
    renderWithClient(<CommandPalette open={true} onOpenChange={onOpenChange} />);
    fireEvent.click(await screen.findByTestId("command-item-trade-plan-100"));
    expect(window.location.pathname + window.location.search).toBe("/execution-lifecycle-manager?planId=100");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // v1.5.0, Sprint 18 — Institutional Playbooks & Operating Procedures
  // Engine. Playbooks are pure, static content — always shown, never
  // gated on the palette being opened first.
  it("shows all 12 Playbooks immediately (no fetch needed) and selecting one deep-links to it", async () => {
    const onOpenChange = vi.fn();
    renderWithClient(<CommandPalette open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByTestId("command-item-playbook-trade-planning")).toHaveTextContent("Trade Planning");
    expect(screen.getByTestId("command-item-playbook-quarterly-performance-review")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("command-item-playbook-decision-review"));
    expect(window.location.pathname + window.location.search).toBe("/playbooks?playbookId=decision-review");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("finds a Playbook by one of its own stage titles, never a second search engine", async () => {
    renderWithClient(<CommandPalette open={true} onOpenChange={vi.fn()} />);
    await userEvent.type(screen.getByTestId("command-palette-input"), "Pre-Trade Checklist");
    expect(screen.getByTestId("command-item-playbook-trade-planning")).toBeInTheDocument();
  });
});
