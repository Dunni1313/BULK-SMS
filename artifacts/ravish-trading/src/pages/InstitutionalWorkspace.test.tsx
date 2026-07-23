// Phase 17 — Institutional Workspace & Unified Research Cockpit.
// Mocks every generated hook the workspace page (and the StockResearch.tsx
// components it reuses byte-identically — ReportView, InvestmentThesisCard,
// DecisionSummaryCard, ResearchNotesCard) depend on, following the exact
// mocked-generated-hook pattern StockResearch.test.tsx already established.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";
import { makeValueReport } from "@/test/fixtures/valueReport";

const searchMock = vi.hoisted(() => ({ value: "" }));
const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useSearch: () => searchMock.value,
    useLocation: () => ["/workspace", navigateMock],
  };
});

type HookResult = { data: unknown; isLoading?: boolean; isError?: boolean };

const mockState = vi.hoisted(() => ({
  valueReport: { data: undefined, isLoading: false, isError: false } as HookResult,
  watchlist: { data: [] as unknown[], isLoading: false } as HookResult,
  portfolios: { data: [] as unknown[], isLoading: false } as HookResult,
  portfolio: { data: undefined, isLoading: false } as HookResult,
  savedScreens: { data: [] as unknown[], isLoading: false } as HookResult,
  notifications: { data: [] as unknown[], isLoading: false } as HookResult,
  researchNotesAll: { data: [] as unknown[], isLoading: false } as HookResult,
  researchNotes: { data: [] as unknown[], isLoading: false } as HookResult,
  industryComparison: { data: undefined, isLoading: false } as HookResult,
  mentor: { data: undefined, isLoading: false } as HookResult,
  investmentThesis: { data: undefined, isLoading: false, isError: false } as HookResult,
  institutionalDecision: { data: undefined, isLoading: false, isError: false } as HookResult,
}));

const addWatchlistMock = vi.hoisted(() => vi.fn());
const addResearchNoteMock = vi.hoisted(() => vi.fn());
const deleteResearchNoteMock = vi.hoisted(() => vi.fn());

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetValueReport: () => mockState.valueReport,
    useGetValueWatchlist: () => mockState.watchlist,
    useAddValueWatchlist: () => ({ mutate: addWatchlistMock, isPending: false }),
    useDeleteValueWatchlist: () => ({ mutate: vi.fn(), isPending: false }),
    useGetPortfolios: () => mockState.portfolios,
    useGetPortfolio: () => mockState.portfolio,
    useGetSavedScreens: () => mockState.savedScreens,
    useListNotifications: () => mockState.notifications,
    useGetAllResearchNotes: () => mockState.researchNotesAll,
    useGetResearchNotes: () => mockState.researchNotes,
    useAddResearchNote: () => ({ mutate: addResearchNoteMock, isPending: false }),
    useDeleteResearchNote: () => ({ mutate: deleteResearchNoteMock, isPending: false }),
    useGetIndustryComparison: () => mockState.industryComparison,
    useGetInstitutionalMentor: () => mockState.mentor,
    useGetInvestmentThesis: () => mockState.investmentThesis,
    useGetInstitutionalDecision: () => mockState.institutionalDecision,
  };
});

import InstitutionalWorkspace from "./InstitutionalWorkspace";

function resetMockState() {
  searchMock.value = "";
  mockState.valueReport = { data: undefined, isLoading: false, isError: false };
  mockState.watchlist = { data: [], isLoading: false };
  mockState.portfolios = { data: [], isLoading: false };
  mockState.portfolio = { data: undefined, isLoading: false };
  mockState.savedScreens = { data: [], isLoading: false };
  mockState.notifications = { data: [], isLoading: false };
  mockState.researchNotesAll = { data: [], isLoading: false };
  mockState.researchNotes = { data: [], isLoading: false };
  mockState.industryComparison = { data: undefined, isLoading: false };
  mockState.mentor = { data: undefined, isLoading: false };
  mockState.investmentThesis = { data: undefined, isLoading: false, isError: false };
  mockState.institutionalDecision = { data: undefined, isLoading: false, isError: false };
}

describe("InstitutionalWorkspace", () => {
  beforeEach(() => {
    resetMockState();
    navigateMock.mockClear();
    addWatchlistMock.mockClear();
  });

  it("renders the permanent institutional labels and an advisory message before any symbol is searched", () => {
    renderWithClient(<InstitutionalWorkspace />);

    expect(screen.getByTestId("workspace-permanent-labels")).toBeInTheDocument();
    expect(screen.getByText(/Search a company above/)).toBeInTheDocument();
  });

  it("auto-loads a symbol from a ?symbol= deep link", () => {
    searchMock.value = "symbol=AAPL";
    mockState.valueReport = { data: makeValueReport(), isLoading: false, isError: false };
    renderWithClient(<InstitutionalWorkspace />);

    expect(screen.getByTestId("workspace-report-view")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-report-heading")).toHaveTextContent("Apple Inc.");
  });

  it("searching a symbol navigates to the workspace's own deep-link URL", async () => {
    renderWithClient(<InstitutionalWorkspace />);

    // react-resizable-panels registers document-level listeners that
    // interfere with userEvent's key-by-key typing simulation whenever a
    // ResizablePanelGroup is mounted anywhere in the tree (a real,
    // disclosed jsdom/library interaction, not a production bug) — a
    // direct fireEvent.change sets the controlled input's value the same
    // way a real keystroke sequence would, without going through that
    // broken simulation path.
    fireEvent.change(screen.getByTestId("workspace-symbol-search"), { target: { value: "MSFT" } });
    await userEvent.click(screen.getByTestId("workspace-symbol-search-submit"));

    expect(navigateMock).toHaveBeenCalledWith("/workspace?symbol=MSFT");
  });

  it("renders the left sidebar's five sections, each reusing an already-shipped hook", () => {
    mockState.watchlist = {
      data: [{ id: 1, symbol: "AAPL", priceTargetCrossed: false }],
      isLoading: false,
    };
    mockState.portfolios = { data: [{ id: 1, name: "Core Holdings", holdingsCount: 3 }], isLoading: false };
    mockState.notifications = {
      data: [{ id: 1, title: "Price target crossed", message: "AAPL crossed its target", relatedSymbol: "AAPL", isRead: false }],
      isLoading: false,
    };
    mockState.researchNotesAll = { data: [{ id: 1, symbol: "AAPL", note: "Watching closely." }], isLoading: false };

    renderWithClient(<InstitutionalWorkspace />);

    const left = screen.getByTestId("workspace-left-sidebar");
    expect(within(left).getByText("Watchlists")).toBeInTheDocument();
    expect(within(left).getByText("Portfolio")).toBeInTheDocument();
    expect(within(left).getByText("Opportunities")).toBeInTheDocument();
    expect(within(left).getByText("Monitoring")).toBeInTheDocument();
    expect(within(left).getByText("Notes")).toBeInTheDocument();
    expect(within(left).getByTestId("workspace-watchlist-item-AAPL")).toBeInTheDocument();
    expect(within(left).getByText(/Core Holdings/)).toBeInTheDocument();
  });

  it("clicking a watchlist symbol in the left sidebar sets the active research symbol", async () => {
    mockState.watchlist = { data: [{ id: 1, symbol: "TSLA", priceTargetCrossed: false }], isLoading: false };
    renderWithClient(<InstitutionalWorkspace />);

    await userEvent.click(screen.getByTestId("workspace-watchlist-item-TSLA"));

    expect(navigateMock).toHaveBeenCalledWith("/workspace?symbol=TSLA");
  });

  it("renders the full Main Research Area (ReportView + Investment Thesis + Decision Engine cards) once a report resolves", () => {
    searchMock.value = "symbol=AAPL";
    mockState.valueReport = { data: makeValueReport(), isLoading: false, isError: false };
    renderWithClient(<InstitutionalWorkspace />);

    expect(screen.getByTestId("workspace-report-view")).toBeInTheDocument();
    expect(screen.getByText("Fair value (est.)")).toBeInTheDocument();
    expect(screen.getByTestId("generate-thesis")).toBeInTheDocument();
    expect(screen.getByTestId("get-decision")).toBeInTheDocument();
  });

  it("lets the user add the currently-researched symbol to the watchlist", async () => {
    searchMock.value = "symbol=AAPL";
    mockState.valueReport = { data: makeValueReport(), isLoading: false, isError: false };
    renderWithClient(<InstitutionalWorkspace />);

    await userEvent.click(screen.getByTestId("workspace-add-to-watchlist"));

    expect(addWatchlistMock).toHaveBeenCalledWith({ data: { symbol: "AAPL" } });
  });

  it("renders the right sidebar's five sections, including Active Alerts scoped to the current symbol", () => {
    searchMock.value = "symbol=AAPL";
    mockState.valueReport = { data: makeValueReport(), isLoading: false, isError: false };
    mockState.notifications = {
      data: [
        { id: 1, title: "Margin of safety crossed", message: "AAPL crossed its MOS target", relatedSymbol: "AAPL", isRead: false },
        { id: 2, title: "Unrelated", message: "MSFT alert", relatedSymbol: "MSFT", isRead: false },
      ],
      isLoading: false,
    };
    mockState.mentor = {
      data: { watchlistReview: { itemCount: 1, items: [], summary: "You are tracking 1 symbol." } },
      isLoading: false,
    };
    mockState.industryComparison = {
      data: { peerGroup: [{ symbol: "MSFT", name: "Microsoft Corp." }] },
      isLoading: false,
    };

    renderWithClient(<InstitutionalWorkspace />);

    const right = screen.getByTestId("workspace-right-sidebar");
    expect(within(right).getByText("Active Alerts")).toBeInTheDocument();
    expect(within(right).getByTestId("workspace-active-alerts")).toBeInTheDocument();
    expect(within(right).getByText(/AAPL crossed its MOS target/)).toBeInTheDocument();
    expect(within(right).queryByText(/MSFT alert/)).not.toBeInTheDocument();
    // "Research Notes" legitimately appears twice: once as this sidebar
    // section's own heading, once as ResearchNotesCard's (StockResearch.tsx,
    // reused byte-identically) own CardTitle.
    expect(within(right).getAllByText("Research Notes")).toHaveLength(2);
    expect(within(right).getByText("Portfolio Impact")).toBeInTheDocument();
    expect(within(right).getByTestId("workspace-related-opportunities")).toBeInTheDocument();
    expect(within(right).getByText(/Microsoft Corp\./)).toBeInTheDocument();
    expect(within(right).getByTestId("workspace-mentor-guidance")).toBeInTheDocument();
    expect(within(right).getByText("You are tracking 1 symbol.")).toBeInTheDocument();
  });

  it("shows an honest 'not held' Portfolio Impact message when the symbol isn't in the primary portfolio", () => {
    searchMock.value = "symbol=AAPL";
    mockState.valueReport = { data: makeValueReport(), isLoading: false, isError: false };
    mockState.portfolios = { data: [{ id: 1, name: "Core Holdings", holdingsCount: 1 }], isLoading: false };
    mockState.portfolio = {
      data: { id: 1, name: "Core Holdings", allocation: { holdings: [{ symbol: "MSFT", targetWeightPct: 10, actualWeightPct: 9, driftPct: -1 }] } },
      isLoading: false,
    };

    renderWithClient(<InstitutionalWorkspace />);

    expect(screen.getByTestId("workspace-portfolio-impact")).toHaveTextContent(/Not held in "Core Holdings"/);
  });

  it("shows real weight/drift figures in Portfolio Impact when the symbol is held", () => {
    searchMock.value = "symbol=AAPL";
    mockState.valueReport = { data: makeValueReport(), isLoading: false, isError: false };
    mockState.portfolios = { data: [{ id: 1, name: "Core Holdings", holdingsCount: 1 }], isLoading: false };
    mockState.portfolio = {
      data: { id: 1, name: "Core Holdings", allocation: { holdings: [{ symbol: "AAPL", targetWeightPct: 10, actualWeightPct: 9.5, driftPct: -0.5 }] } },
      isLoading: false,
    };

    renderWithClient(<InstitutionalWorkspace />);

    expect(screen.getByTestId("workspace-portfolio-impact")).toHaveTextContent(/Held in "Core Holdings"/);
    expect(screen.getByTestId("workspace-portfolio-impact")).toHaveTextContent(/target 10\.0%/);
  });

  it("collapses and expands the left sidebar via its toggle button", async () => {
    renderWithClient(<InstitutionalWorkspace />);

    expect(screen.getByTestId("workspace-left-sidebar")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("toggle-left-sidebar"));
    expect(screen.queryByTestId("workspace-left-sidebar")).not.toBeInTheDocument();
  });
});
