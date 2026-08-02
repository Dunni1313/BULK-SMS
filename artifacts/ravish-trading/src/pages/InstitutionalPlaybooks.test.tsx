// v1.5.0, Sprint 18 — Institutional Playbooks & Operating Procedures Engine.
// Smoke tests following the established mocked-plain-fetch + mocked-
// generated-hook pattern (see KnowledgeIntelligenceGraph.test.tsx /
// ExecutionLifecycleManager.test.tsx).

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

import InstitutionalPlaybooks from "./InstitutionalPlaybooks";

function tradePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    coachId: "trading",
    workspaceId: null,
    strategyId: null,
    title: "AAPL breakout plan",
    plannedAsset: "AAPL",
    assetClass: "equity",
    direction: "long",
    status: "draft",
    pinned: false,
    tags: ["AAPL"],
    currentVersion: 1,
    executedTradeRef: null,
    executedAt: null,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    sections: [],
    versions: [],
    checklistItems: [],
    checklistProgress: { totalItems: 0, completedItems: 0, requiredItems: 0, completedRequiredItems: 0, progressPct: 0, readyForEntry: false },
    ...overrides,
  };
}

describe("InstitutionalPlaybooks", () => {
  beforeEach(() => {
    listNotebooksMock.mockReset().mockResolvedValue([]);
    listStrategiesMock.mockReset().mockResolvedValue([]);
    listTradePlansMock.mockReset().mockResolvedValue([]);
    getTradePlanMock.mockReset();
    mockState.journalEntries = [];
    mockState.trades = [];
    mockState.positions = [];
    mockState.learningProgress = { pathCompletion: [], recentHistory: [] };
    window.localStorage.clear();
    window.history.pushState({}, "", "/playbooks");
  });

  it("renders all 12 playbooks grouped by category for a brand-new user, all Not Started", async () => {
    renderWithClient(<InstitutionalPlaybooks />);
    expect(await screen.findByTestId("playbook-card-investment-research", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByTestId("playbook-card-quarterly-performance-review")).toBeInTheDocument();
    expect(screen.getByTestId("playbook-status-investment-research")).toHaveTextContent("Not Started");
  });

  it("selecting a playbook shows its overview, stages, AI Playbook Coach, and Related Knowledge panels", async () => {
    renderWithClient(<InstitutionalPlaybooks />);
    await screen.findByTestId("playbook-card-investment-research", {}, { timeout: 5000 });

    await userEvent.click(screen.getByTestId("playbook-card-investment-research"));

    expect(await screen.findByTestId("playbook-overview")).toHaveTextContent("Investment Research");
    expect(screen.getByTestId("playbook-stage-capture-idea")).toBeInTheDocument();
    expect(screen.getByTestId("playbook-ai-coach")).toBeInTheDocument();
    expect(screen.getByTestId("playbook-related-knowledge")).toBeInTheDocument();
  });

  it("honestly shows a stage as Not Started for a brand-new user, then Complete once real data exists", async () => {
    renderWithClient(<InstitutionalPlaybooks />);
    await screen.findByTestId("playbook-card-investment-research", {}, { timeout: 5000 });
    await userEvent.click(screen.getByTestId("playbook-card-investment-research"));
    await screen.findByTestId("playbook-stage-capture-idea");
    expect(screen.getByTestId("playbook-stage-status-capture-idea")).toHaveTextContent("Not Started");
  });

  it("lets the user apply a trade-lifecycle-bound playbook to a real Trade Plan", async () => {
    const plan = tradePlan();
    listTradePlansMock.mockImplementation(async (coachId: string) => (coachId === "trading" ? [plan] : []));
    getTradePlanMock.mockResolvedValue(plan);

    renderWithClient(<InstitutionalPlaybooks />);
    await userEvent.click(await screen.findByTestId("playbook-card-trade-planning", {}, { timeout: 5000 }));

    expect(await screen.findByTestId("playbook-trade-plan-binder")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("playbook-trade-plan-option-42"));

    const stageCard = await screen.findByTestId("playbook-stage-capture-plan-idea");
    expect(within(stageCard).getByTestId("playbook-stage-detail-capture-plan-idea")).toHaveTextContent("AAPL breakout plan");
  });

  it("shows an honest no-trade-plans message for an entity-bound playbook when nothing exists yet", async () => {
    renderWithClient(<InstitutionalPlaybooks />);
    await userEvent.click(await screen.findByTestId("playbook-card-decision-review", {}, { timeout: 5000 }));
    expect(await screen.findByTestId("playbook-no-trade-plans")).toBeInTheDocument();
  });

  it("lets a manual stage be marked done and undone, self-certified — never presented as automatically verified", async () => {
    renderWithClient(<InstitutionalPlaybooks />);
    await userEvent.click(await screen.findByTestId("playbook-card-risk-review", {}, { timeout: 5000 }));

    const stressStage = await screen.findByTestId("playbook-stage-stress-test");
    expect(within(stressStage).getByTestId("playbook-stage-status-stress-test")).toHaveTextContent("Not Started");

    await userEvent.click(within(stressStage).getByTestId("playbook-stage-acknowledge-stress-test"));
    expect(within(stressStage).getByTestId("playbook-stage-status-stress-test")).toHaveTextContent("Complete");

    await userEvent.click(within(stressStage).getByTestId("playbook-stage-acknowledge-stress-test"));
    expect(within(stressStage).getByTestId("playbook-stage-status-stress-test")).toHaveTextContent("Not Started");
  });

  it("honors a ?playbookId= deep link from the Command Palette", async () => {
    window.history.pushState({}, "", "/playbooks?playbookId=risk-review");
    renderWithClient(<InstitutionalPlaybooks />);
    expect(await screen.findByTestId("playbook-overview", {}, { timeout: 5000 })).toHaveTextContent("Risk Review");
  });

  it("the AI Playbook Coach explains the selected stage without inventing a new process step", async () => {
    renderWithClient(<InstitutionalPlaybooks />);
    await userEvent.click(await screen.findByTestId("playbook-card-post-trade-review", {}, { timeout: 5000 }));
    await userEvent.click(await screen.findByTestId("playbook-stage-record-lesson"));

    expect(await screen.findByTestId("playbook-coach-why-exists")).toHaveTextContent(/specific, actionable lesson/i);
    expect(screen.getByTestId("playbook-coach-common-errors")).toBeInTheDocument();
  });
});
