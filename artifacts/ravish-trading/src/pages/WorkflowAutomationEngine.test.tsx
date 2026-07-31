// v1.5.0, Sprint 16 — Institutional Workflow Automation Engine. Smoke
// tests following the established mocked-generated-hook + mocked-plain-
// fetch pattern (see ExecutionLifecycleManager.test.tsx,
// PortfolioRiskIntelligence.test.tsx). useWorkflowAutomation()'s own
// task-derivation logic is already covered directly by
// workflowAutomation.test.ts — these tests only prove the page renders
// the composed result correctly, honestly, and supports dismissal.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const listTradePlansMock = vi.hoisted(() => vi.fn(async (_coachId?: string) => [] as unknown[]));
const getTradePlanMock = vi.hoisted(() => vi.fn());
const getMissingTradePlanInformationMock = vi.hoisted(() => vi.fn(async () => ({ missing: [], present: [], completenessPct: 100 })));
const listNotebooksMock = vi.hoisted(() => vi.fn(async (_coachId?: string) => [] as unknown[]));
const listStrategiesMock = vi.hoisted(() => vi.fn(async (_coachId?: string) => [] as unknown[]));

vi.mock("@/lib/ai-coach/tradePlansApi", () => ({
  listTradePlans: listTradePlansMock,
  getTradePlan: getTradePlanMock,
  getMissingTradePlanInformation: getMissingTradePlanInformationMock,
}));

vi.mock("@/lib/ai-coach/notebooksApi", () => ({
  listNotebooks: listNotebooksMock,
}));

vi.mock("@/lib/ai-coach/strategiesApi", () => ({
  listStrategies: listStrategiesMock,
  getStrategy: vi.fn(async () => null),
  getMissingSections: vi.fn(async () => null),
}));

const mockState = vi.hoisted(() => ({
  portfolioDashboard: undefined as unknown,
  portfolioConcentration: undefined as unknown,
  portfolios: [] as unknown[],
  portfolioRisk: undefined as unknown,
  tradingRisk: undefined as unknown,
  journalEntries: [] as unknown[],
  closedTrades: [] as unknown[],
  learningProgress: undefined as unknown,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetPortfolioDashboard: () => ({ data: mockState.portfolioDashboard, isLoading: false }),
    useGetPortfolioConcentration: () => ({ data: mockState.portfolioConcentration, isLoading: false }),
    useGetPortfolios: () => ({ data: mockState.portfolios, isLoading: false }),
    useGetPortfolioRisk: () => ({ data: mockState.portfolioRisk, isLoading: false }),
    useGetTradingRisk: () => ({ data: mockState.tradingRisk, isLoading: false }),
    useListJournalEntries: () => ({ data: mockState.journalEntries }),
    useListTrades: () => ({ data: mockState.closedTrades }),
    useGetLearningProgress: () => ({ data: mockState.learningProgress }),
  };
});

import WorkflowAutomationEngine from "./WorkflowAutomationEngine";

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
    ],
    versions: [],
    checklistItems: [],
    checklistProgress: { totalItems: 2, completedItems: 2, requiredItems: 2, completedRequiredItems: 2, progressPct: 100, readyForEntry: true },
    ...overrides,
  };
}

describe("WorkflowAutomationEngine", () => {
  beforeEach(() => {
    listTradePlansMock.mockReset().mockResolvedValue([]);
    getTradePlanMock.mockReset();
    getMissingTradePlanInformationMock.mockClear();
    listNotebooksMock.mockReset().mockResolvedValue([]);
    listStrategiesMock.mockReset().mockResolvedValue([]);
    mockState.portfolioDashboard = undefined;
    mockState.portfolioConcentration = undefined;
    mockState.portfolios = [];
    mockState.portfolioRisk = undefined;
    mockState.tradingRisk = undefined;
    mockState.journalEntries = [];
    mockState.closedTrades = [];
    mockState.learningProgress = { pathCompletion: [], recentHistory: [] };
    window.localStorage.clear();
    window.history.pushState({}, "", "/workflow-automation-engine");
  });

  it("recommends starting a Notebook (the one always-derivable task) when nothing exists anywhere", async () => {
    renderWithClient(<WorkflowAutomationEngine />);
    expect(await screen.findByTestId("workflow-tasks-list")).toBeInTheDocument();
    expect(screen.getByTestId("workflow-task-research-to-notebook:starter")).toBeInTheDocument();
  });

  it("removes the starter Notebook task once a real notebook exists, replacing it with the next real recommendation (create a Strategy)", async () => {
    listNotebooksMock.mockImplementation(async (coachId: string) => (coachId === "trading" ? [{ id: 1, coachId: "trading", workspaceId: null, title: "AAPL research", description: null, pinned: false, archived: false, tags: [], version: 1, createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z" }] : []));
    renderWithClient(<WorkflowAutomationEngine />);
    await screen.findByTestId("page-workflow-automation-engine");
    expect(screen.queryByTestId("workflow-task-research-to-notebook:starter")).not.toBeInTheDocument();
    expect(await screen.findByTestId("workflow-task-notebook-to-strategy:trading")).toBeInTheDocument();
  });

  it("renders a Ready-to-Execute plan's task with its action link to the Execution & Lifecycle Manager", async () => {
    const plan = readyToExecutePlan();
    listTradePlansMock.mockImplementation(async (coachId: string) => (coachId === "trading" ? [plan] : []));
    getTradePlanMock.mockResolvedValue(plan);

    renderWithClient(<WorkflowAutomationEngine />);
    const task = await screen.findByTestId("workflow-task-decision-to-execution:42");
    expect(task).toBeInTheDocument();
    expect(screen.getByTestId("workflow-task-action-decision-to-execution:42")).toBeInTheDocument();
  });

  it("dismisses a task, removing it from the active list and showing the honest empty state, and persists the dismissal to localStorage", async () => {
    renderWithClient(<WorkflowAutomationEngine />);
    const dismissBtn = await screen.findByTestId("workflow-task-dismiss-research-to-notebook:starter");
    await userEvent.click(dismissBtn);
    expect(screen.queryByTestId("workflow-task-research-to-notebook:starter")).not.toBeInTheDocument();
    expect(await screen.findByTestId("workflow-tasks-empty")).toBeInTheDocument();
    expect(window.localStorage.getItem("dk-workflow-task-dismissals")).toContain("research-to-notebook:starter");
  });

  it("shows an honest 'nothing completed' state and a 'nothing selected' AI Workflow Coach message by default", async () => {
    renderWithClient(<WorkflowAutomationEngine />);
    await screen.findByTestId("page-workflow-automation-engine");
    expect(await screen.findByTestId("workflow-recent-completions-empty")).toBeInTheDocument();
    expect(screen.getByTestId("ai-workflow-coach-card")).toBeInTheDocument();
    expect(screen.getByTestId("workflow-coach-summary")).toHaveTextContent(/workflow recommendation/);
  });

  it("selecting a task updates the AI Workflow Coach's own explanation", async () => {
    renderWithClient(<WorkflowAutomationEngine />);
    const card = await screen.findByTestId("workflow-task-research-to-notebook:starter");
    await userEvent.click(card);
    expect(screen.getByTestId("workflow-coach-summary")).toHaveTextContent(/Capture your research in a Notebook/);
  });

  it("renders the Automatic Connections card documenting journal->performance and performance->portfolio as automatic, never a fabricated task", async () => {
    renderWithClient(<WorkflowAutomationEngine />);
    expect(await screen.findByTestId("automatic-connections-card")).toBeInTheDocument();
    expect(screen.getByTestId("automatic-connections-list").children.length).toBe(2);
  });
});
