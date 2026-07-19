// Phase 20 — Institutional Research Terminal. Frontend smoke tests,
// mirroring InvestmentCommitteeWorkbench.test.tsx's own established
// mocked-generated-hook pattern (this page's own useInstitutionalDecision/
// useInvestmentMemo hooks are the same "plain useQuery around the
// generated fetch function" trick used elsewhere in this codebase).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

type HookResult = { data: unknown; isLoading?: boolean; isError?: boolean };

const mockState = vi.hoisted(() => ({
  report: { data: undefined as unknown, isLoading: false, isError: false } as HookResult,
  decision: { data: undefined as unknown, isLoading: false, isError: false } as HookResult,
  memo: { data: undefined as unknown, isLoading: false, isError: false } as HookResult,
  statements: { data: undefined as unknown, isLoading: false, isError: false } as HookResult,
  portfolios: { data: [] as unknown[] } as HookResult,
  notifications: { data: [] as unknown[] } as HookResult,
  compare: { data: undefined as unknown, isLoading: false, isError: false } as HookResult,
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (opts: { queryKey?: readonly unknown[] }) => {
      const key = String(opts.queryKey?.[0] ?? "");
      if (key.includes("investment-memo")) return mockState.memo;
      return mockState.decision;
    },
  };
});

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetValueReport: () => mockState.report,
    useGetFinancialStatements: () => mockState.statements,
    useGetPortfolios: () => mockState.portfolios,
    useListNotifications: () => mockState.notifications,
    useCompareOpportunitiesRoute: () => mockState.compare,
  };
});

vi.mock("./StockResearch", () => ({
  ReportView: ({ report }: { report: { symbol: string } }) => <div data-testid="report-view-stub">Report for {report.symbol}</div>,
  DecisionSummaryCard: ({ symbol }: { symbol: string }) => <div data-testid="decision-summary-stub">Decision summary for {symbol}</div>,
  ResearchNotesCard: ({ symbol }: { symbol: string }) => <div data-testid="research-notes-card-stub">Notes for {symbol}</div>,
}));

import ResearchTerminal from "./ResearchTerminal";

function fixtureReport(overrides: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    name: "Apple Inc.",
    asOf: "2026-01-15",
    dataSource: "SIMULATED",
    investmentCommittee: { consolidatedVerdict: "Buy", confidenceScore: 82, agreement: "unanimous", summary: "All models agree." },
    ...overrides,
  };
}

function fixtureDecision(overrides: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    recommendation: "Buy",
    confidence: 82,
    summary: "AAPL: Buy.",
    supportingEvidence: [{ label: "Economic Moat", detail: "Wide moat." }],
    contradictingEvidence: [],
    checklist: [{ id: "item-0", label: "Item 0", status: "pass", explanation: "Detail" }],
    portfolioFit: { available: false, reason: "No portfolio was supplied." },
    ...overrides,
  };
}

function fixtureMemo(overrides: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    recommendation: "Buy",
    confidence: 82,
    overview: "A deterministic Investment Committee memo for Apple Inc. (AAPL).",
    sections: [{ heading: "Business Summary", paragraphs: ["Apple Inc. (AAPL) operates in the Technology sector."] }],
    ...overrides,
  };
}

describe("ResearchTerminal page", () => {
  beforeEach(() => {
    localStorage.clear();
    // This page actively calls navigate() as the user interacts (adding a
    // symbol, switching modes) — unlike pages that only read an initial
    // deep-link once, that mutates jsdom's shared window.history across
    // tests in this file, so each test must reset the URL explicitly.
    window.history.pushState({}, "", "/research-terminal");
    mockState.report = { data: undefined, isLoading: false, isError: false };
    mockState.decision = { data: undefined, isLoading: false, isError: false };
    mockState.memo = { data: undefined, isLoading: false, isError: false };
    mockState.statements = { data: undefined, isLoading: false, isError: false };
    mockState.portfolios = { data: [] };
    mockState.notifications = { data: [] };
    mockState.compare = { data: undefined, isLoading: false, isError: false };
  });

  it("renders permanent labels and the honest empty state before any symbol is added", () => {
    renderWithClient(<ResearchTerminal />);
    expect(screen.getByTestId("terminal-permanent-labels")).toHaveTextContent("Institutional Research Terminal");
    expect(screen.getByTestId("terminal-permanent-labels")).toHaveTextContent("Evidence Based");
    expect(screen.getByTestId("terminal-empty")).toBeInTheDocument();
  });

  it("adding a symbol via search renders the Analyse panel with all 9 tabs", async () => {
    mockState.report = { data: fixtureReport(), isLoading: false, isError: false };
    mockState.decision = { data: fixtureDecision(), isLoading: false, isError: false };
    mockState.memo = { data: fixtureMemo(), isLoading: false, isError: false };
    renderWithClient(<ResearchTerminal />);

    await userEvent.type(screen.getByTestId("terminal-symbol-search"), "AAPL");
    await userEvent.click(screen.getByTestId("terminal-symbol-search-submit"));

    expect(await screen.findByTestId("terminal-panel-AAPL")).toBeInTheDocument();
    const tabs = screen.getByTestId("terminal-tabs-AAPL");
    for (const label of ["Overview", "Statements", "Decision Engine", "Investment Committee", "Investment Memo", "Portfolio Impact", "Monitoring", "Evidence", "Notes"]) {
      expect(tabs).toHaveTextContent(label);
    }
    expect(screen.getByTestId("report-view-stub")).toHaveTextContent("Report for AAPL");
    expect(screen.getByTestId("open-symbol-AAPL")).toBeInTheDocument();
  });

  it("switching to the Investment Memo tab renders the Memo's own sections", async () => {
    mockState.report = { data: fixtureReport(), isLoading: false, isError: false };
    mockState.decision = { data: fixtureDecision(), isLoading: false, isError: false };
    mockState.memo = { data: fixtureMemo(), isLoading: false, isError: false };
    renderWithClient(<ResearchTerminal />);

    await userEvent.type(screen.getByTestId("terminal-symbol-search"), "AAPL");
    await userEvent.click(screen.getByTestId("terminal-symbol-search-submit"));
    await screen.findByTestId("terminal-panel-AAPL");

    await userEvent.click(screen.getByRole("tab", { name: "Investment Memo" }));
    expect(screen.getByTestId("terminal-memo-content")).toHaveTextContent("Business Summary");
    expect(screen.getByTestId("terminal-memo-content")).toHaveTextContent("Apple Inc. (AAPL) operates in the Technology sector.");
  });

  it("switching to Compare mode with 2 symbols renders a full side-by-side table", async () => {
    mockState.report = { data: fixtureReport(), isLoading: false, isError: false };
    mockState.decision = { data: fixtureDecision(), isLoading: false, isError: false };
    mockState.memo = { data: fixtureMemo(), isLoading: false, isError: false };
    mockState.compare = {
      data: {
        rows: [
          { symbol: "AAPL", rankScore: 80, decisionRecommendation: "Buy", businessQualityScore: 85, investmentQualityScore: 70, marginOfSafety: 0.2, investmentCommitteeVerdict: "Buy", investmentCommitteeConfidence: 82, tomNashConvictionScore: 75, revenueGrowth5y: 0.1, roic: 0.18, roe: 0.2, debtToEquity: 0.3, dividendYield: 0.01 },
          { symbol: "MSFT", rankScore: 70, decisionRecommendation: "Hold", businessQualityScore: 80, investmentQualityScore: 65, marginOfSafety: 0.1, investmentCommitteeVerdict: "Hold", investmentCommitteeConfidence: 60, tomNashConvictionScore: 65, revenueGrowth5y: 0.09, roic: 0.15, roe: 0.18, debtToEquity: 0.4, dividendYield: 0.02 },
        ],
        bestBy: { "Decision Engine Synthesis Score": "AAPL", "Business Quality": "AAPL" },
      },
      isLoading: false,
      isError: false,
    };
    renderWithClient(<ResearchTerminal />);

    await userEvent.type(screen.getByTestId("terminal-symbol-search"), "AAPL");
    await userEvent.click(screen.getByTestId("terminal-symbol-search-submit"));
    await userEvent.type(screen.getByTestId("terminal-symbol-search"), "MSFT");
    await userEvent.click(screen.getByTestId("terminal-symbol-search-submit"));

    await userEvent.click(screen.getByTestId("mode-compare"));
    const table = await screen.findByTestId("terminal-compare-table");
    expect(table).toHaveTextContent("AAPL");
    expect(table).toHaveTextContent("MSFT");
    expect(screen.getByTestId("compare-cell-Decision Engine Synthesis Score-AAPL")).toHaveTextContent("★");
  });

  it("shows an honest empty-compare message with fewer than 2 symbols", async () => {
    mockState.report = { data: fixtureReport(), isLoading: false, isError: false };
    mockState.decision = { data: fixtureDecision(), isLoading: false, isError: false };
    mockState.memo = { data: fixtureMemo(), isLoading: false, isError: false };
    renderWithClient(<ResearchTerminal />);

    await userEvent.type(screen.getByTestId("terminal-symbol-search"), "AAPL");
    await userEvent.click(screen.getByTestId("terminal-symbol-search-submit"));
    await userEvent.click(screen.getByTestId("mode-compare"));

    expect(await screen.findByTestId("compare-empty")).toBeInTheDocument();
  });

  it("switching to Split-screen mode renders two independent panels", async () => {
    mockState.report = { data: fixtureReport(), isLoading: false, isError: false };
    mockState.decision = { data: fixtureDecision(), isLoading: false, isError: false };
    mockState.memo = { data: fixtureMemo(), isLoading: false, isError: false };
    renderWithClient(<ResearchTerminal />);

    await userEvent.type(screen.getByTestId("terminal-symbol-search"), "AAPL");
    await userEvent.click(screen.getByTestId("terminal-symbol-search-submit"));
    await userEvent.type(screen.getByTestId("terminal-symbol-search"), "MSFT");
    await userEvent.click(screen.getByTestId("terminal-symbol-search-submit"));

    await userEvent.click(screen.getByTestId("mode-split"));
    expect(await screen.findByTestId("terminal-panel-MSFT")).toBeInTheDocument();
    expect(screen.getByTestId("terminal-panel-AAPL")).toBeInTheDocument();
  });

  it("saves and reloads a named layout via localStorage, with no new backend persistence", async () => {
    mockState.report = { data: fixtureReport(), isLoading: false, isError: false };
    mockState.decision = { data: fixtureDecision(), isLoading: false, isError: false };
    mockState.memo = { data: fixtureMemo(), isLoading: false, isError: false };
    renderWithClient(<ResearchTerminal />);

    await userEvent.type(screen.getByTestId("terminal-symbol-search"), "AAPL");
    await userEvent.click(screen.getByTestId("terminal-symbol-search-submit"));
    await userEvent.click(screen.getByTestId("mode-compare"));

    await userEvent.type(screen.getByTestId("layout-name-input"), "My Layout");
    await userEvent.click(screen.getByTestId("save-layout"));

    expect(screen.getByTestId("load-layout-My Layout")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("research-terminal-layouts") ?? "[]")).toEqual([
      { name: "My Layout", mode: "compare", symbols: ["AAPL"], portfolioId: null, activeTab: "overview" },
    ]);

    await userEvent.click(screen.getByTestId("mode-single"));
    await userEvent.click(screen.getByTestId("load-layout-My Layout"));
    // The loaded layout's own mode ("compare") is restored; only 1 symbol
    // was saved, so the honest fewer-than-2-symbols empty state shows.
    expect(await screen.findByTestId("compare-empty")).toBeInTheDocument();
  });

  it("Open Workspace link deep-links with the current symbol", async () => {
    mockState.report = { data: fixtureReport(), isLoading: false, isError: false };
    mockState.decision = { data: fixtureDecision(), isLoading: false, isError: false };
    mockState.memo = { data: fixtureMemo(), isLoading: false, isError: false };
    renderWithClient(<ResearchTerminal />);

    await userEvent.type(screen.getByTestId("terminal-symbol-search"), "AAPL");
    await userEvent.click(screen.getByTestId("terminal-symbol-search-submit"));
    const link = await screen.findByTestId("open-workspace-AAPL");
    expect(link).toHaveAttribute("href", "/workspace?symbol=AAPL");
  });
});
