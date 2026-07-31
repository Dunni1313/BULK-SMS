// v1.5.0, Sprint 14 — Institutional Execution & Lifecycle Manager. Smoke
// tests following the established mocked-generated-hook + mocked-plain-
// fetch pattern (see DecisionWorkflow.test.tsx / InstitutionalCommandCentre.test.tsx).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const listTradePlansMock = vi.hoisted(() => vi.fn(async (_coachId?: string) => [] as unknown[]));
const getTradePlanMock = vi.hoisted(() => vi.fn());
const getMissingTradePlanInformationMock = vi.hoisted(() => vi.fn(async () => ({ missing: [], present: [], completenessPct: 100 })));
const updateTradePlanMock = vi.hoisted(() => vi.fn(async (id: number, input: unknown) => ({ id, ...(input as object) })));

vi.mock("@/lib/ai-coach/tradePlansApi", () => ({
  listTradePlans: listTradePlansMock,
  getTradePlan: getTradePlanMock,
  getMissingTradePlanInformation: getMissingTradePlanInformationMock,
  updateTradePlan: updateTradePlanMock,
}));

vi.mock("@/lib/ai-coach/strategiesApi", () => ({
  getStrategy: vi.fn(async () => null),
  getMissingSections: vi.fn(async () => null),
  listStrategies: vi.fn(async () => []),
}));

// v1.5.0, Sprint 17 — Institutional Knowledge & Intelligence Graph.
vi.mock("@/lib/ai-coach/notebooksApi", () => ({
  listNotebooks: vi.fn(async () => []),
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
    // v1.5.0, Sprint 17 — Institutional Knowledge & Intelligence Graph.
    // RelatedKnowledgeCard reuses usePortfolioRiskIntelligence() (Sprint
    // 15) via useKnowledgeGraph() — mocked the same way
    // InstitutionalCommandCentre.test.tsx already established for that
    // exact hook, so it settles immediately instead of hitting real,
    // unmocked network calls in this jsdom test environment.
    useGetPortfolioDashboard: () => ({ data: undefined, isLoading: false }),
    useGetPortfolioConcentration: () => ({ data: undefined, isLoading: false }),
    useGetPortfolios: () => ({ data: [], isLoading: false }),
    useGetPortfolioRisk: () => ({ data: undefined, isLoading: false }),
    useGetTradingRisk: () => ({ data: undefined, isLoading: false }),
  };
});

import ExecutionLifecycleManager from "./ExecutionLifecycleManager";

function readyToExecutePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
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
    sections: [
      { id: 1, tradePlanId: 42, kind: "entry_zone", content: "Above 195", notebook: null, conversation: null, file: null, createdAt: "", updatedAt: "" },
      { id: 2, tradePlanId: 42, kind: "stop_loss", content: "190", notebook: null, conversation: null, file: null, createdAt: "", updatedAt: "" },
    ],
    versions: [],
    checklistItems: [],
    checklistProgress: { totalItems: 2, completedItems: 2, requiredItems: 2, completedRequiredItems: 2, progressPct: 100, readyForEntry: true },
    ...overrides,
  };
}

describe("ExecutionLifecycleManager", () => {
  beforeEach(() => {
    listTradePlansMock.mockReset().mockResolvedValue([]);
    getTradePlanMock.mockReset();
    getMissingTradePlanInformationMock.mockClear();
    updateTradePlanMock.mockClear();
    mockState.journalEntries = [];
    mockState.trades = [];
    mockState.positions = [];
    mockState.learningProgress = { pathCompletion: [], recentHistory: [] };
    window.history.pushState({}, "", "/execution-lifecycle");
  });

  it("shows an honest empty pipeline and a 'no trade plans' prompt when none exist", async () => {
    renderWithClient(<ExecutionLifecycleManager />);
    expect(await screen.findByTestId("lifecycle-no-plans")).toBeInTheDocument();
    for (const stage of ["ideas", "ready-to-execute", "reviewed", "archived"]) {
      expect(screen.getByTestId(`pipeline-column-empty-${stage}`)).toBeInTheDocument();
      expect(screen.getByTestId(`pipeline-column-count-${stage}`)).toHaveTextContent("0");
    }
  });

  it("places a fully-prepared trade plan in the 'ready-to-execute' pipeline column and shows its execution package on selection", async () => {
    const plan = readyToExecutePlan();
    listTradePlansMock.mockImplementation(async (coachId: string) => (coachId === "trading" ? [plan] : []));
    getTradePlanMock.mockResolvedValue(plan);

    renderWithClient(<ExecutionLifecycleManager />);

    expect(await screen.findByTestId("pipeline-card-42")).toBeInTheDocument();
    expect(screen.getByTestId("pipeline-column-count-ready-to-execute")).toHaveTextContent("1");

    await userEvent.click(screen.getByTestId("pipeline-card-42"));

    expect(await screen.findByTestId("lifecycle-current-stage")).toHaveTextContent("Ready to Execute");
    expect(screen.getByTestId("execution-package-card")).toBeInTheDocument();
    expect(screen.getByTestId("package-instrument")).toHaveTextContent("AAPL · equity");
    expect(screen.getByTestId("package-entry")).toHaveTextContent("Above 195");
    expect(screen.getByTestId("package-stop")).toHaveTextContent("190");
    expect(screen.getByTestId("button-open-mark-executed")).toBeInTheDocument();
  });

  it("lets the user mark a ready-to-execute plan executed, calling updateTradePlan with status executed", async () => {
    const plan = readyToExecutePlan();
    listTradePlansMock.mockImplementation(async (coachId: string) => (coachId === "trading" ? [plan] : []));
    getTradePlanMock.mockResolvedValue(plan);

    renderWithClient(<ExecutionLifecycleManager />);
    await userEvent.click(await screen.findByTestId("pipeline-card-42"));
    await userEvent.click(await screen.findByTestId("button-open-mark-executed"));
    await userEvent.click(screen.getByTestId("button-confirm-mark-executed"));

    await waitFor(() => expect(updateTradePlanMock).toHaveBeenCalledWith(42, expect.objectContaining({ status: "executed" })));
  });

  it("shows real Position Management detail — journal and performance status — for an executed, closed, reviewed trade", async () => {
    const plan = readyToExecutePlan({
      coachId: "options",
      status: "executed",
      executedTradeRef: "501",
      executedAt: "2026-07-01T00:00:00Z",
    });
    listTradePlansMock.mockImplementation(async (coachId: string) => (coachId === "options" ? [plan] : []));
    getTradePlanMock.mockResolvedValue(plan);
    mockState.trades = [
      { id: 501, symbol: "AAPL", strategy: "long_call", status: "closed", legs: [], openDate: "2026-07-01T00:00:00Z", closeDate: "2026-07-05T00:00:00Z", credit: 0, maxProfit: 1000, maxLoss: 500, currentPnl: 300, pop: 0.6, ev: 50, theta: 0, ravishScore: 80 },
    ];
    mockState.journalEntries = [{ id: 9, tradeId: 501, title: "Closed AAPL", content: "x", mood: "confident", lessonLearned: "Took profit on schedule — good discipline." }];

    renderWithClient(<ExecutionLifecycleManager />);
    await userEvent.click(await screen.findByTestId("pipeline-card-42"));

    expect(await screen.findByTestId("lifecycle-current-stage")).toHaveTextContent("Reviewed");
    expect(screen.getByTestId("position-journal-status")).toHaveTextContent("Reviewed — lesson learned recorded.");
    expect(screen.getByTestId("position-performance-closed")).toHaveTextContent("$300.00");
    expect(screen.getByTestId("button-archive-trade-plan")).not.toBeDisabled();
  });

  it("disables Archive while a position remains open — never lets portfolio impact be skipped", async () => {
    const plan = readyToExecutePlan({ coachId: "options", status: "executed", executedTradeRef: "501", executedAt: "2026-07-01T00:00:00Z" });
    listTradePlansMock.mockImplementation(async (coachId: string) => (coachId === "options" ? [plan] : []));
    getTradePlanMock.mockResolvedValue(plan);
    mockState.trades = [
      { id: 501, symbol: "AAPL", strategy: "long_call", status: "open", legs: [], openDate: new Date().toISOString(), credit: 0, maxProfit: 1000, maxLoss: 500, currentPnl: 40, pop: 0.6, ev: 50, theta: 0, ravishScore: 80 },
    ];

    renderWithClient(<ExecutionLifecycleManager />);
    await userEvent.click(await screen.findByTestId("pipeline-card-42"));

    expect(await screen.findByTestId("lifecycle-current-stage")).toHaveTextContent("Open Position");
    expect(screen.getByTestId("button-archive-trade-plan")).toBeDisabled();
  });

  it("shows AI Trade Manager guidance and the Continuous Learning card for the selected trade's stage", async () => {
    const plan = readyToExecutePlan();
    listTradePlansMock.mockImplementation(async (coachId: string) => (coachId === "trading" ? [plan] : []));
    getTradePlanMock.mockResolvedValue(plan);

    renderWithClient(<ExecutionLifecycleManager />);
    await userEvent.click(await screen.findByTestId("pipeline-card-42"));

    expect(await screen.findByTestId("ai-trade-manager-card")).toBeInTheDocument();
    expect(screen.getByTestId("guidance-what-now")).toHaveTextContent(/execution package/i);
    expect(screen.getByTestId("lifecycle-learning-card")).toBeInTheDocument();
  });

  // v1.5.0, Sprint 17 — Institutional Knowledge & Intelligence Graph.
  it("shows the Related Knowledge card, reusing useKnowledgeGraph() directly, surfacing the plan's own real plannedAsset connection", async () => {
    const plan = readyToExecutePlan();
    listTradePlansMock.mockImplementation(async (coachId: string) => (coachId === "trading" ? [plan] : []));
    getTradePlanMock.mockResolvedValue(plan);

    renderWithClient(<ExecutionLifecycleManager />);
    await userEvent.click(await screen.findByTestId("pipeline-card-42"));

    expect(await screen.findByTestId("card-related-knowledge", {}, { timeout: 5000 })).toBeInTheDocument();
    // This fixture's own plannedAsset ("AAPL") produces one real,
    // structural connection to a derived company node — never fabricated,
    // the graph engine's own honest behaviour (knowledgeGraph.test.ts
    // covers the fully-isolated-entity case directly).
    expect(await screen.findByTestId("related-knowledge-list", {}, { timeout: 5000 })).toHaveTextContent("AAPL");
    expect(screen.getByTestId("related-knowledge-list")).toHaveTextContent("planned asset");
  });
});
