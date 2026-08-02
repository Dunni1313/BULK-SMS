// v1.5.0, Sprint 17 — Institutional Knowledge & Intelligence Graph. Smoke
// tests following the established mocked-plain-fetch + mocked-generated-
// hook pattern (see ExecutionLifecycleManager.test.tsx / InstitutionalCommandCentre.test.tsx).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
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

import KnowledgeIntelligenceGraph from "./KnowledgeIntelligenceGraph";

function notebook(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    coachId: "trading",
    workspaceId: null,
    title: "NVDA momentum research",
    description: null,
    pinned: false,
    archived: false,
    tags: ["NVDA", "momentum"],
    version: 1,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

function strategy(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    coachId: "trading",
    workspaceId: null,
    title: "Breakout momentum",
    description: null,
    strategyType: "breakout",
    assetClass: "equity",
    folder: null,
    status: "active",
    pinned: false,
    archived: false,
    tags: ["momentum"],
    currentVersion: 1,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

function tradePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 100,
    coachId: "trading",
    workspaceId: null,
    strategyId: 10,
    title: "NVDA breakout plan",
    plannedAsset: "NVDA",
    assetClass: "equity",
    direction: "long",
    status: "draft",
    pinned: false,
    tags: ["NVDA", "momentum"],
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

describe("KnowledgeIntelligenceGraph", () => {
  beforeEach(() => {
    listNotebooksMock.mockReset().mockResolvedValue([]);
    listStrategiesMock.mockReset().mockResolvedValue([]);
    listTradePlansMock.mockReset().mockResolvedValue([]);
    getTradePlanMock.mockReset();
    mockState.journalEntries = [];
    mockState.trades = [];
    mockState.positions = [];
    mockState.learningProgress = { pathCompletion: [], recentHistory: [] };
    window.history.pushState({}, "", "/knowledge-graph");
  });

  it("shows an honest empty search state for a brand-new user with nothing created anywhere", async () => {
    renderWithClient(<KnowledgeIntelligenceGraph />);
    expect(await screen.findByTestId("knowledge-search-empty", {}, { timeout: 5000 })).toHaveTextContent(
      "No matches. Nothing is fabricated — this graph only shows entities you've already created.",
    );
    expect(screen.getByTestId("knowledge-timeline-empty")).toBeInTheDocument();
    expect(screen.getByTestId("knowledge-patterns-empty")).toBeInTheDocument();
  });

  it("renders a real notebook/strategy connected by a shared tag, and shows their relationship on selection", async () => {
    listNotebooksMock.mockImplementation(async (coachId: string) => (coachId === "trading" ? [notebook()] : []));
    listStrategiesMock.mockImplementation(async (coachId: string) => (coachId === "trading" ? [strategy()] : []));

    renderWithClient(<KnowledgeIntelligenceGraph />);
    expect(await screen.findByTestId("knowledge-node-notebook:1", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByTestId("knowledge-node-strategy:10")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("knowledge-node-notebook:1"));
    expect(await screen.findByTestId("knowledge-detail-panel")).toHaveTextContent("NVDA momentum research");
    // Connected to the strategy via the shared "momentum" tag, and to a
    // derived company node via the shared "NVDA" tag — never a fabricated
    // link, both real, evidence-cited connections.
    expect(screen.getByTestId("knowledge-related-strategy")).toHaveTextContent("Breakout momentum");
    expect(screen.getByTestId("knowledge-related-company")).toHaveTextContent("NVDA");
  });

  it("filters search results by a typed query", async () => {
    listNotebooksMock.mockImplementation(async (coachId: string) => (coachId === "trading" ? [notebook()] : []));

    renderWithClient(<KnowledgeIntelligenceGraph />);
    await screen.findByTestId("knowledge-node-notebook:1", {}, { timeout: 5000 });

    await userEvent.type(screen.getByTestId("knowledge-search-input"), "does-not-exist-anywhere");
    expect(await screen.findByTestId("knowledge-search-empty")).toBeInTheDocument();
  });

  it("lets the user pick a real trade plan and view its Intelligence Timeline", async () => {
    const plan = tradePlan();
    listTradePlansMock.mockImplementation(async (coachId: string) => (coachId === "trading" ? [plan] : []));
    getTradePlanMock.mockResolvedValue(plan);

    renderWithClient(<KnowledgeIntelligenceGraph />);
    await userEvent.click(await screen.findByTestId("knowledge-timeline-select", {}, { timeout: 5000 }));
    await userEvent.click(await screen.findByRole("option", { name: /NVDA breakout plan/i }));

    expect(await screen.findByTestId("knowledge-timeline-list")).toBeInTheDocument();
    expect(screen.getByTestId("knowledge-timeline-event-ideas")).toBeInTheDocument();
  });

  it("answers a Knowledge Coach question honestly asking for a strategy first", async () => {
    renderWithClient(<KnowledgeIntelligenceGraph />);
    await userEvent.click(await screen.findByTestId("knowledge-coach-question-trades-using-strategy", {}, { timeout: 5000 }));
    expect(await screen.findByTestId("knowledge-coach-answer")).toHaveTextContent("Pick a strategy first.");
  });

  it("answers the recurring-mistakes Knowledge Coach question honestly when no journal entries exist", async () => {
    renderWithClient(<KnowledgeIntelligenceGraph />);
    await userEvent.click(await screen.findByTestId("knowledge-coach-question-recurring-mistakes", {}, { timeout: 5000 }));
    expect(await screen.findByTestId("knowledge-coach-answer")).toHaveTextContent(/no pattern|No recurring theme/i);
  });
});
