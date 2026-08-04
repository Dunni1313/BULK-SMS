// v1.5.0, Sprint 13 — Institutional Decision Engine. Smoke tests following
// the established mocked-generated-hook + mocked-plain-fetch pattern (see
// InstitutionalCommandCentre.test.tsx). renderWithClient() already wraps
// with TradingCoachProvider (test-utils.tsx), so AskCoachLauncher needs no
// extra mocking.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const listTradePlansMock = vi.hoisted(() => vi.fn(async (_coachId?: string) => [] as unknown[]));
const getTradePlanMock = vi.hoisted(() => vi.fn());
const getMissingTradePlanInformationMock = vi.hoisted(() => vi.fn());
const reviewTradePlanMock = vi.hoisted(() => vi.fn(async () => ({ text: "Reviewed.", source: "template" })));
const summarizeTradePlanMock = vi.hoisted(() => vi.fn(async () => ({ text: "Summary.", source: "template" })));
const riskHighlightsMock = vi.hoisted(() => vi.fn(async () => ({ text: "Risk highlights.", source: "template" })));

vi.mock("@/lib/ai-coach/tradePlansApi", () => ({
  listTradePlans: listTradePlansMock,
  getTradePlan: getTradePlanMock,
  getMissingTradePlanInformation: getMissingTradePlanInformationMock,
  reviewTradePlan: reviewTradePlanMock,
  summarizeTradePlan: summarizeTradePlanMock,
  generateTradePlanRiskHighlights: riskHighlightsMock,
}));

vi.mock("@/lib/ai-coach/strategiesApi", () => ({
  getStrategy: vi.fn(async () => null),
  getMissingSections: vi.fn(async () => null),
}));

const mockState = vi.hoisted(() => ({
  journalEntries: [] as unknown[],
  watchlist: [] as unknown[],
  positions: [] as unknown[],
  openTrades: [] as unknown[],
  learningProgress: undefined as unknown,
  investingDecision: undefined as unknown,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useListJournalEntries: () => ({ data: mockState.journalEntries }),
    useGetValueWatchlist: () => ({ data: mockState.watchlist }),
    useListTradingPositions: () => ({ data: mockState.positions }),
    useListTrades: () => ({ data: mockState.openTrades }),
    useGetLearningProgress: () => ({ data: mockState.learningProgress }),
    useGetInstitutionalDecision: () => ({ data: mockState.investingDecision }),
  };
});

import DecisionWorkflow from "./DecisionWorkflow";

function tradePlanFixture(overrides: Record<string, unknown> = {}) {
  return {
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
    checklistItems: [
      { id: 1, tradePlanId: 7, label: "Define stop loss", required: true, completed: false, sortOrder: 0, createdAt: "", updatedAt: "" },
    ],
    checklistProgress: { totalItems: 4, completedItems: 1, requiredItems: 2, completedRequiredItems: 0, progressPct: 25, readyForEntry: false },
    ...overrides,
  };
}

describe("DecisionWorkflow", () => {
  beforeEach(() => {
    listTradePlansMock.mockReset().mockResolvedValue([]);
    getTradePlanMock.mockReset();
    getMissingTradePlanInformationMock.mockReset();
    reviewTradePlanMock.mockClear();
    summarizeTradePlanMock.mockClear();
    riskHighlightsMock.mockClear();
    mockState.journalEntries = [];
    mockState.watchlist = [];
    mockState.positions = [];
    mockState.openTrades = [];
    mockState.learningProgress = { pathCompletion: [], recentHistory: [] };
    mockState.investingDecision = undefined;
    window.history.pushState({}, "", "/decision-workflow");
  });

  it("shows the picker with an honest 'no trade plans' message when none exist", async () => {
    renderWithClient(<DecisionWorkflow />);
    expect(await screen.findByTestId("decision-workflow-no-plans")).toBeInTheDocument();
    expect(screen.getByTestId("decision-workflow-create-plan-link")).toHaveAttribute("href", "/assistant");
  });

  it("v1.6.0 UX Polish Phase 1 — disambiguates this AI Assistant Trade Plan from Trade Planning & Risk Studio's own, separate trade setups", async () => {
    renderWithClient(<DecisionWorkflow />);
    const note = await screen.findByTestId("decision-workflow-plan-disambiguation");
    expect(note).toHaveTextContent(/ai assistant/i);
    expect(within(note).getByText("Open the Trade Planning & Risk Studio.")).toHaveAttribute(
      "href",
      "/trade-planning-studio",
    );
  });

  it("lists real trade plans across all 3 coaches and lets the user pick one", async () => {
    listTradePlansMock.mockImplementation(async (coachId: string) =>
      coachId === "trading" ? [{ id: 7, coachId: "trading", title: "AAPL breakout", status: "draft", plannedAsset: "AAPL", updatedAt: "2026-07-29T00:00:00Z" }] : [],
    );
    getTradePlanMock.mockResolvedValue(tradePlanFixture());
    getMissingTradePlanInformationMock.mockResolvedValue({ missing: [], present: [], completenessPct: 100 });

    renderWithClient(<DecisionWorkflow />);
    const planButton = await screen.findByTestId("decision-workflow-plan-7");
    expect(planButton).toHaveTextContent("AAPL breakout");

    await userEvent.click(planButton);
    expect(await screen.findByTestId("decision-score-card")).toBeInTheDocument();
  });

  it("renders all 10 decision stages with real status/action text once a decision is loaded", async () => {
    getTradePlanMock.mockResolvedValue(tradePlanFixture());
    getMissingTradePlanInformationMock.mockResolvedValue({ missing: ["market_context"], present: [], completenessPct: 80 });

    // Deep-link directly via ?planId= to skip the picker.
    window.history.pushState({}, "", "/decision-workflow?planId=7");
    renderWithClient(<DecisionWorkflow />);

    for (const id of ["research", "evidence", "thesis", "risk", "strategy", "tradePlan", "execution", "review", "portfolio", "learning"]) {
      expect(await screen.findAllByTestId(`decision-stage-${id}`)).not.toHaveLength(0);
    }
  });

  it("renders the Decision Trace panel with one entry per stage, each naming a real source module — the Decision Score is never shown without it", async () => {
    getTradePlanMock.mockResolvedValue(tradePlanFixture());
    getMissingTradePlanInformationMock.mockResolvedValue({ missing: ["market_context"], present: [], completenessPct: 80 });

    window.history.pushState({}, "", "/decision-workflow?planId=7");
    renderWithClient(<DecisionWorkflow />);

    await screen.findByTestId("decision-score-card");
    expect(screen.getByTestId("decision-trace-panel")).toBeInTheDocument();
    for (const id of ["research", "evidence", "thesis", "risk", "strategy", "tradePlan", "execution", "review", "portfolio", "learning"]) {
      expect(screen.getByTestId(`decision-trace-${id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`decision-trace-source-${id}`)).toHaveTextContent("Source:");
    }
  });

  it("shows a real, honest gap (never a bare 'incomplete') in the Decision Trace for a stage with missing information", async () => {
    getTradePlanMock.mockResolvedValue(tradePlanFixture());
    getMissingTradePlanInformationMock.mockResolvedValue({ missing: ["market_context"], present: [], completenessPct: 80 });

    window.history.pushState({}, "", "/decision-workflow?planId=7");
    renderWithClient(<DecisionWorkflow />);

    expect(await screen.findByTestId("decision-trace-status-research")).toHaveTextContent("Market Context");
  });

  it("carries a real, non-fabricated assumption for the Risk Assessment trace entry when risk data is missing", async () => {
    getTradePlanMock.mockResolvedValue(tradePlanFixture());
    getMissingTradePlanInformationMock.mockResolvedValue({ missing: ["stop_loss"], present: [], completenessPct: 80 });

    window.history.pushState({}, "", "/decision-workflow?planId=7");
    renderWithClient(<DecisionWorkflow />);

    expect(await screen.findByTestId("decision-trace-assumption-risk")).toHaveTextContent("Stop Loss");
  });

  it("lists real positive and negative factors in the AI Decision Coach, explaining exactly how the score was derived", async () => {
    getTradePlanMock.mockResolvedValue(
      tradePlanFixture({ checklistProgress: { totalItems: 4, completedItems: 4, requiredItems: 2, completedRequiredItems: 2, progressPct: 100, readyForEntry: true } }),
    );
    getMissingTradePlanInformationMock.mockResolvedValue({ missing: ["market_context"], present: [], completenessPct: 80 });

    window.history.pushState({}, "", "/decision-workflow?planId=7");
    renderWithClient(<DecisionWorkflow />);

    expect(await screen.findByTestId("coach-negative-factors-list")).toHaveTextContent("Research");
    expect(screen.getByTestId("coach-positive-factors-list")).toBeInTheDocument();
  });

  it("computes and displays a real Decision Score, never a fabricated number", async () => {
    getTradePlanMock.mockResolvedValue(
      tradePlanFixture({ checklistProgress: { totalItems: 4, completedItems: 4, requiredItems: 2, completedRequiredItems: 2, progressPct: 100, readyForEntry: true } }),
    );
    getMissingTradePlanInformationMock.mockResolvedValue({ missing: [], present: [], completenessPct: 100 });

    window.history.pushState({}, "", "/decision-workflow?planId=7");
    renderWithClient(<DecisionWorkflow />);

    await waitFor(() => expect(screen.getByTestId("decision-score-value")).toHaveTextContent("100"));
    expect(screen.getByTestId("decision-score-label")).toHaveTextContent("Well-Prepared");
  });

  it("shows the Evidence Panel sourced from the real trade plan and journal data, never fabricated", async () => {
    getTradePlanMock.mockResolvedValue(tradePlanFixture());
    getMissingTradePlanInformationMock.mockResolvedValue({ missing: [], present: [], completenessPct: 100 });

    window.history.pushState({}, "", "/decision-workflow?planId=7");
    renderWithClient(<DecisionWorkflow />);

    expect(await screen.findByTestId("evidence-strategy-summary-none")).toBeInTheDocument();
    expect(screen.getByTestId("evidence-journal-none")).toBeInTheDocument();
  });

  it("shows the AI Decision Coach's deterministic explanation and the Ask AI Coach launcher", async () => {
    getTradePlanMock.mockResolvedValue(tradePlanFixture());
    getMissingTradePlanInformationMock.mockResolvedValue({ missing: ["market_context"], present: [], completenessPct: 80 });

    window.history.pushState({}, "", "/decision-workflow?planId=7");
    renderWithClient(<DecisionWorkflow />);

    expect(await screen.findByTestId("coach-score-explanation")).toBeInTheDocument();
    expect(screen.getByTestId("coach-next-review")).toBeInTheDocument();
    expect(screen.getAllByTestId("button-ask-coach-launcher").length).toBeGreaterThan(0);
  });

  it("runs the trade plan's existing AI review action and shows its real result, never a fabricated narration", async () => {
    getTradePlanMock.mockResolvedValue(tradePlanFixture());
    getMissingTradePlanInformationMock.mockResolvedValue({ missing: [], present: [], completenessPct: 100 });

    window.history.pushState({}, "", "/decision-workflow?planId=7");
    renderWithClient(<DecisionWorkflow />);

    const reviewButton = await screen.findByTestId("coach-action-review");
    await userEvent.click(reviewButton);

    await waitFor(() => expect(reviewTradePlanMock).toHaveBeenCalledWith(7));
    expect(await screen.findByTestId("coach-narration-result")).toHaveTextContent("Reviewed.");
  });

  it("recommends a real, registered lesson for the weakest stage and opens it via ModuleLearnTrigger", async () => {
    getTradePlanMock.mockResolvedValue(
      tradePlanFixture({ checklistProgress: { totalItems: 4, completedItems: 4, requiredItems: 2, completedRequiredItems: 2, progressPct: 100, readyForEntry: true } }),
    );
    getMissingTradePlanInformationMock.mockResolvedValue({ missing: ["stop_loss", "maximum_risk"], present: [], completenessPct: 50 });

    window.history.pushState({}, "", "/decision-workflow?planId=7");
    renderWithClient(<DecisionWorkflow />);

    await screen.findByTestId("decision-score-card");
    // Risk (50%) is the lowest-confidence scored stage here (tradePlan is
    // pinned to 100%), and trading/risk is a real registered recommendation
    // -> button-learn-trading-engine-trading-risk-management.
    expect(await screen.findByTestId("button-learn-trading-engine-trading-risk-management")).toBeInTheDocument();
  });

  it("honestly shows no recommended lesson when the weakest stage has no registered lesson for this coachId", async () => {
    // "options" has no registered lesson for a "research" weakest stage
    // (DECISION_LEARNING_RECOMMENDATIONS.research only covers
    // investing/trading) — with every stage fully complete, research ties
    // for lowest confidence and is picked first by weakestScoredStage's
    // stable sort, so this proves the honest, real "no match" path.
    getTradePlanMock.mockResolvedValue(
      tradePlanFixture({
        coachId: "options",
        checklistProgress: { totalItems: 4, completedItems: 4, requiredItems: 2, completedRequiredItems: 2, progressPct: 100, readyForEntry: true },
      }),
    );
    getMissingTradePlanInformationMock.mockResolvedValue({ missing: [], present: [], completenessPct: 100 });

    window.history.pushState({}, "", "/decision-workflow?planId=7");
    renderWithClient(<DecisionWorkflow />);

    await screen.findByTestId("decision-score-card");
    expect(await screen.findByTestId("decision-learning-none")).toBeInTheDocument();
  });

  it("shows the existing Institutional Decision Engine's own verdict as an Evidence Panel reference for investing decisions", async () => {
    getTradePlanMock.mockResolvedValue(tradePlanFixture({ coachId: "investing" }));
    getMissingTradePlanInformationMock.mockResolvedValue({ missing: [], present: [], completenessPct: 100 });
    mockState.investingDecision = { recommendation: "Accumulate" };

    window.history.pushState({}, "", "/decision-workflow?planId=7");
    renderWithClient(<DecisionWorkflow />);

    const evidence = await screen.findByTestId("evidence-investing-decision");
    expect(within(evidence).getByText("Accumulate")).toBeInTheDocument();
  });

  it("links to the pre-existing Decision Engine, never renaming or removing it", async () => {
    renderWithClient(<DecisionWorkflow />);
    expect(await screen.findByTestId("link-to-decision-engine")).toHaveAttribute("href", "/decision-engine");
  });

  it("links forward to the new Execution & Lifecycle Manager (Sprint 14)", async () => {
    renderWithClient(<DecisionWorkflow />);
    expect(await screen.findByTestId("link-to-execution-lifecycle")).toHaveAttribute("href", "/execution-lifecycle");
  });

  it("shows an honest error state and lets the user choose another decision when loading fails", async () => {
    getTradePlanMock.mockRejectedValue(new Error("network error"));
    getMissingTradePlanInformationMock.mockResolvedValue({ missing: [], present: [], completenessPct: 100 });

    window.history.pushState({}, "", "/decision-workflow?planId=7");
    renderWithClient(<DecisionWorkflow />);

    expect(await screen.findByTestId("decision-workflow-error")).toBeInTheDocument();
  });
});
