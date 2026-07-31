// v1.5.0, Sprint 19 — Institutional Decision Quality & Review Engine.
// Smoke tests following the established mocked-plain-fetch + mocked-
// generated-hook pattern (see InstitutionalPlaybooks.test.tsx /
// ExecutionLifecycleManager.test.tsx). Field-by-field scoring logic is
// exhaustively covered at the pure-function level in decisionReview.test.ts
// and decisionReviewTrends.test.ts — this file only proves the page wires
// real, already-computed data through honestly, never fabricating.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const listNotebooksMock = vi.hoisted(() => vi.fn(async (_coachId?: string) => [] as unknown[]));
const listStrategiesMock = vi.hoisted(() => vi.fn(async (_coachId?: string) => [] as unknown[]));
const listTradePlansMock = vi.hoisted(() => vi.fn(async (_coachId?: string) => [] as unknown[]));
const getTradePlanMock = vi.hoisted(() => vi.fn());
const getMissingTradePlanInformationMock = vi.hoisted(() => vi.fn(async () => ({ missing: [], present: [], completenessPct: 100 })));

vi.mock("@/lib/ai-coach/notebooksApi", () => ({
  listNotebooks: listNotebooksMock,
}));

vi.mock("@/lib/ai-coach/strategiesApi", () => ({
  listStrategies: listStrategiesMock,
  getStrategy: vi.fn(async () => null),
  getMissingSections: vi.fn(async () => null),
}));

vi.mock("@/lib/ai-coach/tradePlansApi", () => ({
  listTradePlans: listTradePlansMock,
  getTradePlan: getTradePlanMock,
  getMissingTradePlanInformation: getMissingTradePlanInformationMock,
}));

const mockState = vi.hoisted(() => ({
  journalEntries: [] as unknown[],
  trades: [] as unknown[],
  positions: [] as unknown[],
  learningProgress: undefined as unknown,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useListJournalEntries: () => ({ data: mockState.journalEntries }),
    useListTrades: () => ({ data: mockState.trades }),
    useListTradingPositions: () => ({ data: mockState.positions }),
    useGetLearningProgress: () => ({ data: mockState.learningProgress }),
    useGetPortfolioDashboard: () => ({ data: undefined, isLoading: false }),
    useGetPortfolioConcentration: () => ({ data: undefined, isLoading: false }),
    useGetPortfolios: () => ({ data: [], isLoading: false }),
    useGetPortfolioRisk: () => ({ data: undefined, isLoading: false }),
    useGetTradingRisk: () => ({ data: undefined, isLoading: false }),
  };
});

import DecisionQualityReview from "./DecisionQualityReview";

function reviewedPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 501,
    coachId: "options",
    workspaceId: null,
    strategyId: null,
    title: "AAPL Iron Condor",
    plannedAsset: "AAPL",
    assetClass: "equity",
    direction: "long",
    status: "executed",
    pinned: false,
    tags: ["AAPL"],
    currentVersion: 1,
    executedTradeRef: "501",
    executedAt: "2026-07-01T00:00:00Z",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-05T00:00:00Z",
    sections: [
      { id: 1, tradePlanId: 501, kind: "confirmation_rules", content: "Close below 190 invalidates the thesis.", notebook: null, conversation: null, file: null, createdAt: "", updatedAt: "" },
      { id: 2, tradePlanId: 501, kind: "position_size_notes", content: "Sized at 1% account risk per share stop distance.", notebook: null, conversation: null, file: null, createdAt: "", updatedAt: "" },
    ],
    versions: [],
    checklistItems: [],
    checklistProgress: { totalItems: 2, completedItems: 2, requiredItems: 2, completedRequiredItems: 2, progressPct: 100, readyForEntry: true },
    ...overrides,
  };
}

describe("DecisionQualityReview", () => {
  beforeEach(() => {
    listNotebooksMock.mockReset().mockResolvedValue([]);
    listStrategiesMock.mockReset().mockResolvedValue([]);
    listTradePlansMock.mockReset().mockResolvedValue([]);
    getTradePlanMock.mockReset();
    getMissingTradePlanInformationMock.mockReset().mockResolvedValue({ missing: [], present: [], completenessPct: 100 });
    mockState.journalEntries = [];
    mockState.trades = [];
    mockState.positions = [];
    mockState.learningProgress = { pathCompletion: [], recentHistory: [] };
    window.localStorage.clear();
    window.history.pushState({}, "", "/decision-quality-review");
  });

  it("shows an honest 'no completed decisions' message and never fabricates a review when nothing has been executed yet", async () => {
    renderWithClient(<DecisionQualityReview />);
    expect(await screen.findByTestId("decision-quality-no-reviews", {}, { timeout: 5000 })).toBeInTheDocument();
    // The always-present Trend Analysis section still renders honestly —
    // insufficient data, never a fabricated pattern from zero decisions.
    expect(screen.getAllByText(/Not enough data/i).length).toBeGreaterThan(0);
  });

  it("selecting a reviewed decision shows its process-quality score, all 11 fields, Playbook Adherence, AI Coach, and Related Knowledge — never the trade outcome as a score", async () => {
    const plan = reviewedPlan();
    listTradePlansMock.mockImplementation(async (coachId: string) => (coachId === "options" ? [plan] : []));
    getTradePlanMock.mockResolvedValue(plan);
    mockState.trades = [
      { id: 501, symbol: "AAPL", strategy: "iron_condor", status: "closed", legs: [], openDate: "2026-07-01T00:00:00Z", closeDate: "2026-07-05T00:00:00Z", credit: 0, maxProfit: 1000, maxLoss: 500, currentPnl: 300, pop: 0.6, ev: 50, theta: 0, ravishScore: 80 },
    ];
    mockState.journalEntries = [
      { id: 9, tradeId: 501, title: "Closed AAPL", content: "x", mood: "confident", thesis: "Breakout on strong volume confirmation.", entryReasoning: "Entered on the reclaim of the 195 level.", lessonLearned: "Took profit on schedule — good discipline.", tags: [], createdAt: "2026-07-05T00:00:00Z" },
    ];

    renderWithClient(<DecisionQualityReview />);
    await userEvent.click(await screen.findByTestId("decision-quality-card-501", {}, { timeout: 5000 }));

    const header = await screen.findByTestId("decision-quality-detail-header");
    expect(header).toHaveTextContent("AAPL Iron Condor");
    // Real, non-fabricated realized P&L shown for CONTEXT — but the field
    // itself is honestly marked not-applicable/never scored (see below).
    expect(header).toHaveTextContent("Shown for context only");

    // All 11 fields render, every one traceable to real evidence text.
    const fieldList = screen.getByTestId("decision-quality-field-list");
    for (const id of [
      "research-quality",
      "evidence-completeness",
      "alternative-scenarios",
      "strategy-alignment",
      "risk-planning",
      "position-sizing",
      "decision-rationale",
      "execution-discipline",
      "journal-completeness",
      "post-trade-reflection",
      "portfolio-impact",
    ]) {
      expect(within(fieldList).getByTestId(`decision-quality-field-${id}`)).toBeInTheDocument();
    }

    // Portfolio Impact is honestly excluded from scoring — never "strong"
    // or "weak" purely because the trade made money.
    expect(screen.getByTestId("decision-quality-field-status-portfolio-impact")).toHaveTextContent("N/A");

    // Decision rationale reads "strong" — both pre-trade thesis (thesis
    // stage confidence, driven by an empty missingInfo.missing) and
    // post-trade journal rationale exist.
    expect(screen.getByTestId("decision-quality-field-status-decision-rationale")).toHaveTextContent(/strong/i);

    expect(screen.getByTestId("decision-quality-playbook-adherence")).toBeInTheDocument();
    expect(screen.getByTestId("decision-quality-ai-coach")).toBeInTheDocument();
    expect(screen.getByTestId("decision-quality-coach-best-practice")).toHaveTextContent(/process from outcome/i);
    expect(screen.getByTestId("decision-quality-related-knowledge")).toBeInTheDocument();
  });

  it("the AI Decision Review Coach never describes an actual process field using outcome/P&L language — only the meta coaching philosophy is allowed to mention it", async () => {
    const plan = reviewedPlan();
    listTradePlansMock.mockImplementation(async (coachId: string) => (coachId === "options" ? [plan] : []));
    getTradePlanMock.mockResolvedValue(plan);
    mockState.trades = [
      { id: 501, symbol: "AAPL", strategy: "iron_condor", status: "closed", legs: [], openDate: "2026-07-01T00:00:00Z", closeDate: "2026-07-05T00:00:00Z", credit: 0, maxProfit: 1000, maxLoss: 500, currentPnl: -300, pop: 0.6, ev: 50, theta: 0, ravishScore: 80 },
    ];
    mockState.journalEntries = [
      { id: 9, tradeId: 501, title: "Closed AAPL", content: "x", mood: "disciplined", thesis: "Breakout on strong volume confirmation.", entryReasoning: "Entered on the reclaim of the 195 level.", lessonLearned: "Stopped out per plan — followed the process exactly.", tags: [], createdAt: "2026-07-05T00:00:00Z" },
    ];

    renderWithClient(<DecisionQualityReview />);
    await userEvent.click(await screen.findByTestId("decision-quality-card-501", {}, { timeout: 5000 }));

    const strong = await screen.findByTestId("decision-quality-coach-strong");
    const weak = screen.getByTestId("decision-quality-coach-weak");
    const missed = screen.getByTestId("decision-quality-coach-missed");
    for (const el of [strong, weak, missed]) {
      expect(el.textContent).not.toMatch(/\bwon\b|\blost\b|good trade|bad trade/i);
    }
  });

  it("shows the honest 'pick a decision' prompt once a reviewed decision exists but none is selected yet", async () => {
    const plan = reviewedPlan();
    listTradePlansMock.mockImplementation(async (coachId: string) => (coachId === "options" ? [plan] : []));
    getTradePlanMock.mockResolvedValue(plan);
    mockState.trades = [{ id: 501, symbol: "AAPL", strategy: "iron_condor", status: "closed", legs: [], openDate: "2026-07-01T00:00:00Z", closeDate: "2026-07-05T00:00:00Z", credit: 0, maxProfit: 1000, maxLoss: 500, currentPnl: 300, pop: 0.6, ev: 50, theta: 0, ravishScore: 80 }];

    renderWithClient(<DecisionQualityReview />);
    expect(await screen.findByTestId("decision-quality-none-selected", {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it("always renders the Trend Analysis section, honestly reporting insufficient data with fewer than 4 reviewed decisions", async () => {
    const plan = reviewedPlan();
    listTradePlansMock.mockImplementation(async (coachId: string) => (coachId === "options" ? [plan] : []));
    getTradePlanMock.mockResolvedValue(plan);
    mockState.trades = [{ id: 501, symbol: "AAPL", strategy: "iron_condor", status: "closed", legs: [], openDate: "2026-07-01T00:00:00Z", closeDate: "2026-07-05T00:00:00Z", credit: 0, maxProfit: 1000, maxLoss: 500, currentPnl: 300, pop: 0.6, ev: 50, theta: 0, ravishScore: 80 }];

    renderWithClient(<DecisionQualityReview />);
    expect(await screen.findByTestId("decision-quality-trends", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByTestId("decision-quality-no-recurring-deviations")).toBeInTheDocument();
  });
});
