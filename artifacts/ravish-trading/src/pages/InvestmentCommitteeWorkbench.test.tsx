// Phase 19 — Institutional Investment Committee Workbench. Frontend smoke
// tests, mirroring DecisionEngine.test.tsx's own established
// mocked-generated-hook pattern (this page's own useInstitutionalDecision/
// useInvestmentMemo hooks are the same "plain useQuery around the generated
// fetch function" trick DecisionEngine.tsx already uses).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

type HookResult = { data: unknown; isLoading?: boolean; isError?: boolean };

const mockState = vi.hoisted(() => ({
  portfolios: { data: [] as unknown[] } as HookResult,
  decision: { data: undefined as unknown, isLoading: false, isError: false } as HookResult,
  memo: { data: undefined as unknown, isLoading: false, isError: false } as HookResult,
  snapshots: { data: [] as unknown[] } as HookResult,
  activeReviews: { data: [] as unknown[], isLoading: false } as HookResult,
}));

const getInstitutionalDecisionMock = vi.hoisted(() => vi.fn());
const getInvestmentMemoMock = vi.hoisted(() => vi.fn());
const saveSnapshotMock = vi.hoisted(() => vi.fn());

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
    useGetPortfolios: () => mockState.portfolios,
    useGetDecisionSnapshots: () => mockState.snapshots,
    useGetRecentDecisionSnapshots: () => mockState.activeReviews,
    useSaveDecisionSnapshot: () => ({ mutate: saveSnapshotMock, isPending: false }),
    getInstitutionalDecision: getInstitutionalDecisionMock,
    getInvestmentMemo: getInvestmentMemoMock,
  };
});

// StockResearch.tsx pulls in a large surface (streaming coach, etc.) this
// page only needs <ResearchNotesCard> from — stub the module to that one
// export, matching the established "reuse the export, stub the rest" pattern.
vi.mock("./StockResearch", () => ({
  ResearchNotesCard: ({ symbol }: { symbol: string }) => <div data-testid="research-notes-card-stub">Notes for {symbol}</div>,
}));

import InvestmentCommitteeWorkbench from "./InvestmentCommitteeWorkbench";

function fixtureDecision(overrides: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    asOf: "2026-01-15",
    kind: "stock",
    price: 150,
    recommendation: "Buy",
    confidence: 82,
    summary: "AAPL: Buy (confidence 82/100).",
    explanation: "Investment Committee votes Buy.",
    drivers: ["Wide moat."],
    risks: ["Regulatory risk."],
    supportingEvidence: [{ label: "Economic Moat", detail: "Wide moat." }],
    contradictingEvidence: [],
    checklist: Array.from({ length: 15 }, (_, i) => ({ id: `item-${i}`, label: `Item ${i}`, status: "pass", explanation: `Detail ${i}` })),
    strengths: ["Strong ROIC."],
    weaknesses: [],
    catalysts: ["A re-rating catalyst."],
    thingsToMonitor: ["Watch earnings."],
    whyBuy: ["Strong moat."],
    whyWait: [],
    whySell: [],
    managementQuality: { available: false, score: null, reason: "unavailable" },
    portfolioFit: { available: false, reason: "No portfolio was supplied." },
    riskChecklistItem: { id: "risk", label: "Risk", status: "unavailable", explanation: "No portfolio selected." },
    diversificationChecklistItem: { id: "diversification", label: "Diversification", status: "unavailable", explanation: "No portfolio selected." },
    disclaimer: "Educational research only — not investment advice.",
    ...overrides,
  };
}

function fixtureMemo(overrides: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    name: "Apple Inc.",
    asOf: "2026-01-15",
    dataSource: "SIMULATED",
    generatedAt: "2026-01-15T00:00:00.000Z",
    recommendation: "Buy",
    confidence: 82,
    overview: "A deterministic Investment Committee memo for Apple Inc. (AAPL).",
    sections: [
      { heading: "Business Summary", paragraphs: ["Apple Inc. (AAPL) operates in the Technology sector."] },
      { heading: "Business Quality", paragraphs: ["Scores 80/100, rated \"Excellent.\""] },
      { heading: "Conclusion", paragraphs: ["Bottom line: Buy."] },
    ],
    disclaimer: "Educational value-investing research only — not investment advice.",
    ...overrides,
  };
}

describe("InvestmentCommitteeWorkbench page", () => {
  beforeEach(() => {
    mockState.portfolios = { data: [] };
    mockState.decision = { data: undefined, isLoading: false, isError: false };
    mockState.memo = { data: undefined, isLoading: false, isError: false };
    mockState.snapshots = { data: [] };
    mockState.activeReviews = { data: [], isLoading: false };
    getInstitutionalDecisionMock.mockReset();
    getInvestmentMemoMock.mockReset();
    saveSnapshotMock.mockReset();
  });

  it("renders permanent labels and the honest empty state before a symbol is selected", () => {
    renderWithClient(<InvestmentCommitteeWorkbench />);
    expect(screen.getByTestId("committee-labels")).toHaveTextContent("Institutional Investment Committee");
    expect(screen.getByTestId("committee-labels")).toHaveTextContent("Evidence Based");
    expect(screen.getByTestId("committee-empty")).toBeInTheDocument();
    expect(screen.getByTestId("active-reviews-empty")).toBeInTheDocument();
  });

  it("Committee Dashboard's Active Reviews lists a real recent decision snapshot, clickable to reopen it", async () => {
    mockState.activeReviews = {
      data: [{ id: 5, symbol: "MSFT", recommendation: "Hold", confidence: 60, analysis: {}, createdAt: "2026-01-10T00:00:00.000Z" }],
      isLoading: false,
    };
    mockState.decision = { data: fixtureDecision({ symbol: "MSFT", recommendation: "Hold" }), isLoading: false, isError: false };
    mockState.memo = { data: fixtureMemo({ symbol: "MSFT" }), isLoading: false, isError: false };
    renderWithClient(<InvestmentCommitteeWorkbench />);

    expect(screen.getByTestId("active-review-5")).toHaveTextContent("MSFT");
    await userEvent.click(screen.getByTestId("active-review-5"));

    expect(await screen.findByTestId("committee-recommendation")).toHaveTextContent("Hold");
  });

  it("selecting a symbol renders the Memo Viewer, Decision Timeline, Evidence Panel, Portfolio Impact, Risks & Catalysts, and Research Notes tabs", async () => {
    mockState.decision = { data: fixtureDecision(), isLoading: false, isError: false };
    mockState.memo = { data: fixtureMemo(), isLoading: false, isError: false };
    renderWithClient(<InvestmentCommitteeWorkbench />);

    await userEvent.type(screen.getByTestId("input-committee-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-analyze-committee"));

    expect(await screen.findByTestId("committee-recommendation")).toHaveTextContent("Buy");
    expect(screen.getByTestId("memo-content")).toHaveTextContent("Business Summary");
    expect(screen.getByTestId("memo-content")).toHaveTextContent("Conclusion");

    await userEvent.click(screen.getByTestId("tab-timeline"));
    expect(screen.getByTestId("timeline-empty")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("tab-evidence"));
    expect(screen.getByText("Wide moat.")).toBeInTheDocument();
    expect(screen.getByTestId("evidence-checklist")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("tab-portfolio-impact"));
    expect(screen.getByTestId("portfolio-impact-content")).toHaveTextContent("No portfolio was supplied.");

    await userEvent.click(screen.getByTestId("tab-risks-catalysts"));
    expect(screen.getByText("Regulatory risk.")).toBeInTheDocument();
    expect(screen.getByText("A re-rating catalyst.")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("tab-research-notes"));
    expect(screen.getByTestId("research-notes-card-stub")).toHaveTextContent("Notes for AAPL");
  });

  it("Record Committee Decision calls the same saveDecisionSnapshot mutation Decision Timeline reuses", async () => {
    mockState.decision = { data: fixtureDecision(), isLoading: false, isError: false };
    mockState.memo = { data: fixtureMemo(), isLoading: false, isError: false };
    renderWithClient(<InvestmentCommitteeWorkbench />);

    await userEvent.type(screen.getByTestId("input-committee-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-analyze-committee"));
    await screen.findByTestId("committee-recommendation");

    await userEvent.click(screen.getByTestId("button-record-decision"));
    expect(saveSnapshotMock).toHaveBeenCalledWith({ symbol: "AAPL" }, expect.anything());
  });

  it("shows an honest error message for an unresolvable symbol", async () => {
    mockState.decision = { data: undefined, isLoading: false, isError: true };
    mockState.memo = { data: undefined, isLoading: false, isError: true };
    renderWithClient(<InvestmentCommitteeWorkbench />);

    await userEvent.type(screen.getByTestId("input-committee-symbol"), "ZZZZ");
    await userEvent.click(screen.getByTestId("button-analyze-committee"));

    expect(await screen.findByTestId("committee-error")).toBeInTheDocument();
  });
});
