// Phase 3, Sprint 40 — Trading Research page smoke test, following the
// established mocked-generated-hook pattern (see PortfolioConstruction.test.tsx).
// Phase 3, Sprint 41 extended this file with the Multi-Timeframe confluence
// card's own cases, mocking useGetTradingMultiTimeframe alongside the
// existing useGetTradingStructure mock. Phase 3, Sprint 42 extended it
// again with the Market Regime card's own cases. Phase 3, Sprint 43
// extended it again with the Probability card's own cases. Phase 3,
// Sprint 44 extended it again with the Portfolio Risk section's own cases
// (positions list/add/delete, account value, risk analysis). Phase 3,
// Sprint 45 extended it again with the on-demand Liquidity tab's own cases.
// Phase 3, Sprint 48 extended it again with the AI Trade Coach chat panel's
// own cases, mocking streamCoach() the same way StockResearch.test.tsx
// already does for its own Ask panel (Phase 2, Sprint 30).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const streamCoachMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach-stream", () => ({
  streamCoach: streamCoachMock,
}));

// v1.5.0 Sprint 6 — AI Coach Memory. A small, realistic in-memory fake of
// the new conversation-persistence API (rather than hardcoding call
// assertions), so this file's own tests exercise the real
// create-conversation -> persist-turn -> re-fetch-messages round trip the
// hook actually performs, without a real network/database.
const coachConversationsState = vi.hoisted(() => ({
  messagesByConversation: {} as Record<number, unknown[]>,
  nextConversationId: 1,
  nextMessageId: 1,
}));
vi.mock("@/lib/ai-coach/coachConversationsApi", () => ({
  listConversations: vi.fn(async () => []),
  createConversation: vi.fn(async (coachId: string, _title?: string, workspaceId?: number) => {
    const id = coachConversationsState.nextConversationId++;
    coachConversationsState.messagesByConversation[id] = [];
    return {
      id,
      coachId,
      title: "New conversation",
      archived: false,
      workspaceId: workspaceId ?? null,
      favourite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }),
  renameConversation: vi.fn(),
  deleteConversation: vi.fn(),
  listMessages: vi.fn(async (id: number) => coachConversationsState.messagesByConversation[id] ?? []),
  addMessage: vi.fn(async (id: number, role: "user" | "assistant", content: string) => {
    const message = {
      id: coachConversationsState.nextMessageId++,
      conversationId: id,
      role,
      content,
      createdAt: new Date().toISOString(),
    };
    coachConversationsState.messagesByConversation[id] = [
      ...(coachConversationsState.messagesByConversation[id] ?? []),
      message,
    ];
    return message;
  }),
  setConversationFavourite: vi.fn(),
  assignConversationToWorkspace: vi.fn(),
}));

// v1.5.0 Sprint 7 — AI Workspaces. Mirrors the coachConversationsApi mock
// above exactly.
const workspacesState = vi.hoisted(() => ({
  workspaces: [] as any[],
  nextWorkspaceId: 1,
}));
vi.mock("@/lib/ai-coach/workspacesApi", () => ({
  listWorkspaces: vi.fn(async () => workspacesState.workspaces),
  createWorkspace: vi.fn(async (coachId: string, input: { name: string; description?: string; tags?: string[] }) => {
    const id = workspacesState.nextWorkspaceId++;
    const workspace = {
      id,
      coachId,
      name: input.name,
      description: input.description ?? null,
      pinned: false,
      archived: false,
      tags: input.tags ?? [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    workspacesState.workspaces = [workspace, ...workspacesState.workspaces];
    return workspace;
  }),
  getWorkspace: vi.fn(async (id: number) => {
    const workspace = workspacesState.workspaces.find((w) => w.id === id);
    return { ...workspace, conversations: [], files: [], notes: [] };
  }),
  updateWorkspace: vi.fn(async (id: number, input: Record<string, unknown>) => {
    const workspace = workspacesState.workspaces.find((w) => w.id === id);
    Object.assign(workspace, input);
    return workspace;
  }),
  deleteWorkspace: vi.fn(),
  addWorkspaceNote: vi.fn(),
  deleteWorkspaceNote: vi.fn(),
  addWorkspaceFile: vi.fn(),
  deleteWorkspaceFile: vi.fn(),
}));

// v1.5.0 Sprint 8 — AI Research Notebooks. Mirrors the workspacesApi mock
// above exactly.
const notebooksState = vi.hoisted(() => ({
  notebooks: [] as any[],
  notesByNotebook: {} as Record<number, any[]>,
  nextNotebookId: 1,
  nextNoteId: 1,
}));
vi.mock("@/lib/ai-coach/notebooksApi", () => ({
  listNotebooks: vi.fn(async () => notebooksState.notebooks),
  createNotebook: vi.fn(async (coachId: string, input: { title: string; description?: string; tags?: string[]; workspaceId?: number | null }) => {
    const id = notebooksState.nextNotebookId++;
    const notebook = {
      id,
      coachId,
      workspaceId: input.workspaceId ?? null,
      title: input.title,
      description: input.description ?? null,
      pinned: false,
      archived: false,
      tags: input.tags ?? [],
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    notebooksState.notebooks = [notebook, ...notebooksState.notebooks];
    notebooksState.notesByNotebook[id] = [];
    return notebook;
  }),
  getNotebook: vi.fn(async (id: number) => {
    const notebook = notebooksState.notebooks.find((n) => n.id === id);
    return { ...notebook, notes: notebooksState.notesByNotebook[id] ?? [], links: [] };
  }),
  updateNotebook: vi.fn(async (id: number, input: Record<string, unknown>) => {
    const notebook = notebooksState.notebooks.find((n) => n.id === id);
    Object.assign(notebook, input);
    return notebook;
  }),
  deleteNotebook: vi.fn(),
  searchNotebookContents: vi.fn(async () => []),
  addNotebookNote: vi.fn(async (notebookId: number, kind: string, content: string) => {
    const note = { id: notebooksState.nextNoteId++, notebookId, kind, content, createdAt: new Date().toISOString() };
    notebooksState.notesByNotebook[notebookId] = [...(notebooksState.notesByNotebook[notebookId] ?? []), note];
    return note;
  }),
  deleteNotebookNote: vi.fn(),
  addNotebookConversationLink: vi.fn(),
  addNotebookFileLink: vi.fn(),
  deleteNotebookLink: vi.fn(),
  summarizeNotebook: vi.fn(),
  mergeNotebookNotes: vi.fn(),
  generateNotebookTakeaways: vi.fn(),
  generateNotebookActionItems: vi.fn(),
}));

// v1.5.0 Sprint 9 — AI Strategy Builder. Mirrors the notebooksApi mock
// above exactly. Real constants are spread from the actual module via
// importActual — StrategyEditor.tsx/StrategySidebar.tsx import them
// directly and need real, non-fabricated values.
const strategiesState = vi.hoisted(() => ({
  strategies: [] as any[],
  sectionsByStrategy: {} as Record<number, any[]>,
  versionsByStrategy: {} as Record<number, any[]>,
  nextStrategyId: 1,
  nextSectionId: 1,
  nextVersionId: 1,
}));
vi.mock("@/lib/ai-coach/strategiesApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai-coach/strategiesApi")>("@/lib/ai-coach/strategiesApi");
  return {
    ...actual,
    listStrategyTemplates: vi.fn(async () => []),
    listStrategies: vi.fn(async () => strategiesState.strategies),
    createStrategy: vi.fn(async (coachId: string, input: Record<string, unknown>) => {
      const id = strategiesState.nextStrategyId++;
      const strategy = {
        id,
        coachId,
        workspaceId: (input.workspaceId as number | null | undefined) ?? null,
        title: input.title,
        description: (input.description as string | undefined) ?? null,
        strategyType: (input.strategyType as string | undefined) ?? "Custom",
        assetClass: (input.assetClass as string | undefined) ?? null,
        folder: (input.folder as string | undefined) ?? null,
        status: "draft",
        pinned: false,
        archived: false,
        tags: (input.tags as string[] | undefined) ?? [],
        currentVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      strategiesState.strategies = [strategy, ...strategiesState.strategies];
      strategiesState.sectionsByStrategy[id] = [];
      strategiesState.versionsByStrategy[id] = [{ id: strategiesState.nextVersionId++, strategyId: id, version: 1, changeSummary: "Created", authorUserId: "u1", createdAt: new Date().toISOString() }];
      return strategy;
    }),
    getStrategy: vi.fn(async (id: number) => {
      const strategy = strategiesState.strategies.find((s) => s.id === id);
      return {
        ...strategy,
        sections: strategiesState.sectionsByStrategy[id] ?? [],
        versions: strategiesState.versionsByStrategy[id] ?? [],
      };
    }),
    updateStrategy: vi.fn(async (id: number, input: Record<string, unknown>) => {
      const strategy = strategiesState.strategies.find((s) => s.id === id);
      Object.assign(strategy, input);
      return strategy;
    }),
    deleteStrategy: vi.fn(),
    getMissingSections: vi.fn(async () => ({ missing: [], present: [], completenessPct: 100 })),
    getSimilarStrategies: vi.fn(async () => []),
    listStrategySections: vi.fn(async (id: number) => strategiesState.sectionsByStrategy[id] ?? []),
    upsertStrategySection: vi.fn(async (strategyId: number, input: Record<string, unknown>) => {
      const section = {
        id: strategiesState.nextSectionId++,
        strategyId,
        kind: input.kind,
        content: (input.content as string | undefined) ?? null,
        notebook: null,
        conversation: null,
        file: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      strategiesState.sectionsByStrategy[strategyId] = [...(strategiesState.sectionsByStrategy[strategyId] ?? []), section];
      return section;
    }),
    deleteStrategySection: vi.fn(),
    listStrategyVersions: vi.fn(async (id: number) => strategiesState.versionsByStrategy[id] ?? []),
    getStrategyVersion: vi.fn(),
    restoreStrategyVersion: vi.fn(),
    compareStrategies: vi.fn(),
    compareStrategiesWithAi: vi.fn(),
    summarizeStrategy: vi.fn(),
    suggestStrategyImprovements: vi.fn(),
    generateStrategyExecutiveSummary: vi.fn(),
    generateStrategyLearningNotes: vi.fn(),
    generateStrategyRiskHighlights: vi.fn(),
    generateStrategySetupChecklist: vi.fn(),
    generateStrategyTradePrepChecklist: vi.fn(),
    generateStrategyReviewQuestions: vi.fn(),
  };
});

// v1.5.0 Sprint 10 — Institutional Trade Planner. Mirrors the
// strategiesApi mock above exactly. Real constants are spread from the
// actual module via importActual — TradePlanEditor.tsx/
// TradePlannerSidebar.tsx import them directly and need real,
// non-fabricated values.
const tradePlansState = vi.hoisted(() => ({
  plans: [] as any[],
  sectionsByPlan: {} as Record<number, any[]>,
  versionsByPlan: {} as Record<number, any[]>,
  checklistItemsByPlan: {} as Record<number, any[]>,
  nextPlanId: 1,
  nextSectionId: 1,
  nextVersionId: 1,
  nextChecklistItemId: 1,
}));
vi.mock("@/lib/ai-coach/tradePlansApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai-coach/tradePlansApi")>("@/lib/ai-coach/tradePlansApi");
  return {
    ...actual,
    listTradePlanChecklistTemplates: vi.fn(async () => []),
    listTradePlans: vi.fn(async () => tradePlansState.plans),
    createTradePlan: vi.fn(async (coachId: string, input: Record<string, unknown>) => {
      const id = tradePlansState.nextPlanId++;
      const plan = {
        id,
        coachId,
        workspaceId: (input.workspaceId as number | null | undefined) ?? null,
        strategyId: (input.strategyId as number | null | undefined) ?? null,
        title: input.title,
        plannedAsset: (input.plannedAsset as string | undefined) ?? null,
        assetClass: (input.assetClass as string | undefined) ?? null,
        direction: (input.direction as string | undefined) ?? null,
        status: "draft",
        pinned: false,
        tags: (input.tags as string[] | undefined) ?? [],
        currentVersion: 1,
        executedTradeRef: null,
        executedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      tradePlansState.plans = [plan, ...tradePlansState.plans];
      tradePlansState.sectionsByPlan[id] = [];
      tradePlansState.versionsByPlan[id] = [{ id: tradePlansState.nextVersionId++, tradePlanId: id, version: 1, changeSummary: "Created", authorUserId: "u1", createdAt: new Date().toISOString() }];
      tradePlansState.checklistItemsByPlan[id] = [];
      return plan;
    }),
    getTradePlan: vi.fn(async (id: number) => {
      const plan = tradePlansState.plans.find((p) => p.id === id);
      const items = tradePlansState.checklistItemsByPlan[id] ?? [];
      return {
        ...plan,
        sections: tradePlansState.sectionsByPlan[id] ?? [],
        versions: tradePlansState.versionsByPlan[id] ?? [],
        checklistItems: items,
        checklistProgress: {
          totalItems: items.length,
          completedItems: items.filter((i: any) => i.completed).length,
          requiredItems: items.filter((i: any) => i.required).length,
          completedRequiredItems: items.filter((i: any) => i.required && i.completed).length,
          progressPct: items.length === 0 ? 0 : Math.round((items.filter((i: any) => i.completed).length / items.length) * 100),
          readyForEntry: items.filter((i: any) => i.required).length > 0 && items.filter((i: any) => i.required && i.completed).length === items.filter((i: any) => i.required).length,
        },
      };
    }),
    updateTradePlan: vi.fn(async (id: number, input: Record<string, unknown>) => {
      const plan = tradePlansState.plans.find((p) => p.id === id);
      Object.assign(plan, input);
      return plan;
    }),
    deleteTradePlan: vi.fn(),
    getMissingTradePlanInformation: vi.fn(async () => ({ missing: [], present: [], completenessPct: 100 })),
    getSimilarTradePlans: vi.fn(async () => []),
    listTradePlanSections: vi.fn(async (id: number) => tradePlansState.sectionsByPlan[id] ?? []),
    upsertTradePlanSection: vi.fn(async (planId: number, input: Record<string, unknown>) => {
      const section = {
        id: tradePlansState.nextSectionId++,
        tradePlanId: planId,
        kind: input.kind,
        content: (input.content as string | undefined) ?? null,
        notebook: null,
        conversation: null,
        file: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      tradePlansState.sectionsByPlan[planId] = [...(tradePlansState.sectionsByPlan[planId] ?? []), section];
      return section;
    }),
    deleteTradePlanSection: vi.fn(),
    listTradePlanChecklistItems: vi.fn(async (id: number) => ({ items: tradePlansState.checklistItemsByPlan[id] ?? [], progress: { totalItems: 0, completedItems: 0, requiredItems: 0, completedRequiredItems: 0, progressPct: 0, readyForEntry: false } })),
    addTradePlanChecklistItem: vi.fn(async (planId: number, input: Record<string, unknown>) => {
      const item = {
        id: tradePlansState.nextChecklistItemId++,
        tradePlanId: planId,
        label: input.label,
        required: (input.required as boolean | undefined) ?? true,
        completed: false,
        sortOrder: (tradePlansState.checklistItemsByPlan[planId] ?? []).length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      tradePlansState.checklistItemsByPlan[planId] = [...(tradePlansState.checklistItemsByPlan[planId] ?? []), item];
      return item;
    }),
    applyTradePlanChecklistTemplate: vi.fn(async () => []),
    updateTradePlanChecklistItem: vi.fn(async (planId: number, itemId: number, input: Record<string, unknown>) => {
      const item = (tradePlansState.checklistItemsByPlan[planId] ?? []).find((i: any) => i.id === itemId);
      Object.assign(item, input);
      return item;
    }),
    deleteTradePlanChecklistItem: vi.fn(),
    listTradePlanVersions: vi.fn(async (id: number) => tradePlansState.versionsByPlan[id] ?? []),
    getTradePlanVersion: vi.fn(),
    restoreTradePlanVersion: vi.fn(),
    compareTradePlans: vi.fn(),
    compareTradePlansWithAi: vi.fn(),
    reviewTradePlan: vi.fn(),
    summarizeTradePlan: vi.fn(),
    generateTradePlanRiskHighlights: vi.fn(),
    reviewTradePlanRiskReward: vi.fn(),
    generateTradePlanExecutiveSummary: vi.fn(),
    generateTradePlanPreparationNotes: vi.fn(),
    generateTradePlanPreTradeChecklist: vi.fn(),
    generateTradePlanVerificationQuestions: vi.fn(),
  };
});

const createPositionMutate = vi.fn();
const deletePositionMutate = vi.fn();
const updateSettingsMutate = vi.fn();

const mockState = vi.hoisted(() => ({
  structure: undefined as unknown,
  isLoading: false,
  isError: false,
  multiTimeframe: undefined as unknown,
  isMultiTimeframeLoading: false,
  isMultiTimeframeError: false,
  regime: undefined as unknown,
  isRegimeLoading: false,
  isRegimeError: false,
  probability: undefined as unknown,
  isProbabilityLoading: false,
  isProbabilityError: false,
  positions: [] as unknown[],
  risk: undefined as unknown,
  settings: undefined as unknown,
  liquidity: undefined as unknown,
  isLiquidityLoading: false,
  isLiquidityError: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetTradingStructure: () => ({
      data: mockState.structure,
      isLoading: mockState.isLoading,
      isError: mockState.isError,
    }),
    useGetTradingMultiTimeframe: () => ({
      data: mockState.multiTimeframe,
      isLoading: mockState.isMultiTimeframeLoading,
      isError: mockState.isMultiTimeframeError,
    }),
    useGetTradingRegime: () => ({
      data: mockState.regime,
      isLoading: mockState.isRegimeLoading,
      isError: mockState.isRegimeError,
    }),
    useListTradingPositions: () => ({ data: mockState.positions }),
    useGetTradingRisk: () => ({ data: mockState.risk }),
    useGetSettings: () => ({ data: mockState.settings }),
    useCreateTradingPosition: () => ({ mutate: createPositionMutate, isPending: false }),
    useDeleteTradingPosition: () => ({ mutate: deletePositionMutate, isPending: false }),
    useUpdateSettings: () => ({ mutate: updateSettingsMutate, isPending: false }),
    useGetTradingProbability: () => ({
      data: mockState.probability,
      isLoading: mockState.isProbabilityLoading,
      isError: mockState.isProbabilityError,
    }),
    useGetTradingLiquidity: () => ({
      data: mockState.liquidity,
      isLoading: mockState.isLiquidityLoading,
      isError: mockState.isLiquidityError,
    }),
  };
});

import TradingResearch from "./TradingResearch";

function structureAnalysis(over: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    interval: "1D",
    dataSource: "SIMULATED",
    candleCount: 90,
    currentPrice: 195.5,
    trend: "uptrend",
    trendDetail: "Higher highs and higher lows across the recent swing sequence.",
    swingPoints: [],
    zones: [{ price: 180.25, kind: "support", strength: 3 }],
    confidenceLevel: "High",
    confidenceExplanation: "90 candles available — a strong sample for swing/zone detection.",
    summary: "AAPL shows a uptrend structure. Confidence: High.",
    ...over,
  };
}

function multiTimeframeAnalysis(over: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    dataSource: "SIMULATED",
    timeframes: [
      { interval: "15m", structure: { trend: "uptrend" } },
      { interval: "1h", structure: { trend: "uptrend" } },
      { interval: "1D", structure: { trend: "range" } },
    ],
    trendAgreement: "majority",
    dominantTrend: "uptrend",
    confluenceScore: 67,
    confidenceLevel: "Moderate",
    confidenceExplanation: "Reasonable data coverage with partial trend agreement.",
    summary: "AAPL shows a uptrend trend across 15m/1h/1D (majority agreement, 67% confluence). Confidence: Moderate.",
    ...over,
  };
}

function regimeAnalysis(over: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    dataSource: "SIMULATED",
    regimeLabel: "trending-bullish",
    trendRegime: "uptrend",
    trendAgreement: "unanimous",
    volatilityRegime: "normal",
    volatilityAnnualizedPct: 24.5,
    volatilityExplanation: "24.5% annualized realized volatility — typical range.",
    liquidityRegime: "High",
    confidenceLevel: "High",
    confidenceExplanation: "Trend confluence, liquidity, and realized volatility all have strong data support.",
    summary: "AAPL is in a trending-bullish regime — 24.5% annualized volatility (normal), High liquidity. Confidence: High.",
    ...over,
  };
}

function probabilityAnalysis(over: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    dataSource: "SIMULATED",
    currentPrice: 195.5,
    volatilityAnnualizedPct: 24.5,
    available: true,
    unavailableReason: null,
    cone: [
      { daysAhead: 5, low1Sigma: 190.1, high1Sigma: 201.2, low2Sigma: 184.9, high2Sigma: 206.8 },
      { daysAhead: 30, low1Sigma: 175.4, high1Sigma: 218.9, low2Sigma: 158.2, high2Sigma: 240.1 },
    ],
    confidenceLevel: "High",
    confidenceExplanation: "Trend confluence, liquidity, and realized volatility all have strong data support.",
    summary: "AAPL probability cone at 24.5% annualized volatility. Confidence: High.",
    ...over,
  };
}

function tradingPosition(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    symbol: "AAPL",
    instrumentType: "stock",
    side: "long",
    status: "open",
    quantity: 10,
    entryPrice: 190,
    entryDate: "2026-07-01T00:00:00.000Z",
    exitPrice: null,
    exitDate: null,
    stopPrice: 180,
    targetPrice: 210,
    notes: "",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...over,
  };
}

function tradingRiskAnalysis(over: Record<string, unknown> = {}) {
  return {
    overall: { score: 82, label: "Excellent", detail: "Composite of position sizing, stop/target discipline, and portfolio risk budget." },
    positionSizing: {
      score: 100,
      label: "Excellent",
      detail: "Largest single-position risk is AAPL at 0.1%, within the 2% cap.",
      largestPositionSymbol: "AAPL",
      largestPositionRiskPct: 0.1,
      capBreached: false,
      unpricedSymbols: [],
    },
    stopDiscipline: {
      score: 100,
      label: "Excellent",
      detail: "All 1 open position(s) have both a stop and a target defined.",
      openPositionsCount: 1,
      positionsWithStop: 1,
      positionsWithTarget: 1,
      positionsFullyPlanned: 1,
      missingStopSymbols: [],
      missingTargetSymbols: [],
    },
    portfolioBudget: {
      score: 100,
      label: "Excellent",
      detail: "Aggregate open-position risk is 0.1% of account value, within the 6% portfolio risk-budget cap.",
      accountValue: 100000,
      totalRiskDollars: 100,
      totalRiskUsedPct: 0.1,
      capBreached: false,
      perPosition: [{ id: 1, symbol: "AAPL", riskDollars: 100, riskPct: 0.1, withinLimit: true }],
    },
    components: [],
    accountValue: 100000,
    openPositionsCount: 1,
    positionContexts: [
      { positionId: 1, symbol: "AAPL", daysAhead: 20, regimeLabel: "trending-bullish", stopTouchProbability: 0.12, targetTouchProbability: 0.34 },
    ],
    ...over,
  };
}

function liquidityAnalysis(over: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    interval: "1D",
    dataSource: "SIMULATED",
    candleCount: 90,
    currentPrice: 195.5,
    volumeProfile: [
      { price: 194.2, volume: 1200000, pctOfTotal: 25.4 },
      { price: 196.8, volume: 900000, pctOfTotal: 19.1 },
    ],
    avgDollarVolume: 32_500_000,
    liquidityScore: 92,
    liquidityBand: "High",
    buySellPressure: { buyPct: 62, sellPct: 38, direction: "buying" },
    confidenceLevel: "High",
    confidenceExplanation: "90 candles available — a strong sample for liquidity/volume-profile analysis.",
    summary: "AAPL shows High liquidity (avg $32.5M daily dollar volume) with buying pressure. Confidence: High.",
    ...over,
  };
}

describe("TradingResearch page", () => {
  beforeEach(() => {
    mockState.structure = undefined;
    mockState.isLoading = false;
    mockState.isError = false;
    mockState.multiTimeframe = undefined;
    mockState.isMultiTimeframeLoading = false;
    mockState.isMultiTimeframeError = false;
    mockState.regime = undefined;
    mockState.isRegimeLoading = false;
    mockState.isRegimeError = false;
    mockState.probability = undefined;
    mockState.isProbabilityLoading = false;
    mockState.isProbabilityError = false;
    mockState.positions = [];
    mockState.risk = undefined;
    mockState.settings = undefined;
    mockState.liquidity = undefined;
    mockState.isLiquidityLoading = false;
    mockState.isLiquidityError = false;
    createPositionMutate.mockReset();
    deletePositionMutate.mockReset();
    updateSettingsMutate.mockReset();
    streamCoachMock.mockReset();
    streamCoachMock.mockResolvedValue(undefined);
    coachConversationsState.messagesByConversation = {};
    coachConversationsState.nextConversationId = 1;
    coachConversationsState.nextMessageId = 1;
    workspacesState.workspaces = [];
    workspacesState.nextWorkspaceId = 1;
    notebooksState.notebooks = [];
    notebooksState.notesByNotebook = {};
    notebooksState.nextNotebookId = 1;
    notebooksState.nextNoteId = 1;
    strategiesState.strategies = [];
    strategiesState.sectionsByStrategy = {};
    strategiesState.versionsByStrategy = {};
    strategiesState.nextStrategyId = 1;
    strategiesState.nextSectionId = 1;
    strategiesState.nextVersionId = 1;
    tradePlansState.plans = [];
    tradePlansState.sectionsByPlan = {};
    tradePlansState.versionsByPlan = {};
    tradePlansState.checklistItemsByPlan = {};
    tradePlansState.nextPlanId = 1;
    tradePlansState.nextSectionId = 1;
    tradePlansState.nextVersionId = 1;
    tradePlansState.nextChecklistItemId = 1;
  });

  it("renders the advisory-only copy and a prompt before any symbol is searched", () => {
    renderWithClient(<TradingResearch />);
    expect(screen.getByText(/SIMULATED market analysis, advisory only/i)).toBeInTheDocument();
    expect(screen.getByText(/Enter a symbol above/i)).toBeInTheDocument();
  });

  it("submits a symbol search and renders the Market Structure card once data resolves", async () => {
    mockState.structure = structureAnalysis();
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "aapl");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));

    expect(await screen.findByTestId("card-market-structure")).toBeInTheDocument();
    expect(screen.getByText(/Market Structure — AAPL/i)).toBeInTheDocument();
    expect(screen.getByText("uptrend")).toBeInTheDocument();
    expect(screen.getByText(/High confidence/i)).toBeInTheDocument();
    expect(screen.getByText(/Support — \$180\.25/i)).toBeInTheDocument();
    expect(screen.getByText("3 touches")).toBeInTheDocument();
  });

  // v1.3.1 — AI Trading Coach.
  it("shows an Ask AI Trading Coach trigger only once a symbol has been searched", async () => {
    mockState.structure = structureAnalysis();
    renderWithClient(<TradingResearch />);
    expect(screen.queryByTestId("button-ask-trading-coach-research")).not.toBeInTheDocument();

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "aapl");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));

    expect(await screen.findByTestId("button-ask-trading-coach-research")).toBeInTheDocument();
  });

  it("shows an honest empty-zones message when no support/resistance zone was detected", async () => {
    mockState.structure = structureAnalysis({ zones: [] });
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));

    expect(await screen.findByTestId("card-market-structure")).toBeInTheDocument();
    expect(screen.getByText(/No repeated support\/resistance zone detected/i)).toBeInTheDocument();
  });

  it("shows a not-found message when the symbol can't be resolved", async () => {
    mockState.isError = true;
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "NOTATICKER");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));

    expect(await screen.findByText(/Could not resolve "NOTATICKER"/i)).toBeInTheDocument();
  });

  it("renders the Multi-Timeframe confluence card once data resolves, alongside the Market Structure card", async () => {
    mockState.structure = structureAnalysis();
    mockState.multiTimeframe = multiTimeframeAnalysis();
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));

    expect(await screen.findByTestId("card-multi-timeframe")).toBeInTheDocument();
    expect(screen.getByText(/Multi-Timeframe Confluence — AAPL/i)).toBeInTheDocument();
    expect(screen.getByText("majority")).toBeInTheDocument();
    expect(screen.getByText("67% confluence")).toBeInTheDocument();
    expect(screen.getByText(/Moderate confidence/i)).toBeInTheDocument();
    // Per-timeframe rows.
    expect(screen.getByText("15m")).toBeInTheDocument();
    expect(screen.getByText("1h")).toBeInTheDocument();
    expect(screen.getByText("1D")).toBeInTheDocument();
  });

  it("honestly shows 'No dominant trend' with no confluence badge when the timeframes split, never fabricating a winner", async () => {
    mockState.multiTimeframe = multiTimeframeAnalysis({
      trendAgreement: "split",
      dominantTrend: null,
      confluenceScore: null,
      summary: "AAPL shows split trend structure across 15m/1h/1D — no dominant trend, agreement: split. Confidence: Low.",
    });
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));

    expect(await screen.findByTestId("card-multi-timeframe")).toBeInTheDocument();
    expect(screen.getByText("No dominant trend")).toBeInTheDocument();
    expect(screen.queryByText(/% confluence/i)).not.toBeInTheDocument();
  });

  it("renders the Market Regime card once data resolves", async () => {
    mockState.regime = regimeAnalysis();
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));

    expect(await screen.findByTestId("card-market-regime")).toBeInTheDocument();
    expect(screen.getByText(/Market Regime — AAPL/i)).toBeInTheDocument();
    expect(screen.getByText("trending-bullish")).toBeInTheDocument();
    expect(screen.getByText("normal volatility (24.5%)")).toBeInTheDocument();
    expect(screen.getByText("High liquidity")).toBeInTheDocument();
  });

  it("honestly omits a volatility percentage when it could not be computed, never fabricating a number", async () => {
    mockState.regime = regimeAnalysis({
      volatilityAnnualizedPct: null,
      volatilityExplanation: "Only 1 daily candle(s) available — not enough to compute realized volatility; defaulting to a neutral \"normal\" read.",
    });
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));

    expect(await screen.findByTestId("card-market-regime")).toBeInTheDocument();
    expect(screen.getByText("normal volatility")).toBeInTheDocument();
    expect(screen.queryByText(/normal volatility \(/i)).not.toBeInTheDocument();
  });

  it("renders the Probability card's cone once data resolves", async () => {
    mockState.probability = probabilityAnalysis();
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));

    expect(await screen.findByTestId("card-probability")).toBeInTheDocument();
    expect(screen.getByText(/Probability — AAPL/i)).toBeInTheDocument();
    expect(screen.getByText("24.5% annualized volatility")).toBeInTheDocument();
    expect(screen.getByText(/High confidence/i)).toBeInTheDocument();
    expect(screen.getByText("5d")).toBeInTheDocument();
    expect(screen.getByText("30d")).toBeInTheDocument();
  });

  it("honestly shows the unavailable reason instead of a fabricated cone when probability can't be computed", async () => {
    mockState.probability = probabilityAnalysis({
      available: false,
      unavailableReason: "Volatility could not be computed for this symbol.",
      volatilityAnnualizedPct: null,
      cone: [],
      confidenceLevel: "Low",
      summary: "AAPL probability cone unavailable — insufficient data. Confidence: Low.",
    });
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));

    expect(await screen.findByTestId("card-probability")).toBeInTheDocument();
    expect(screen.getByText("Volatility could not be computed for this symbol.")).toBeInTheDocument();
    expect(screen.queryByText(/annualized volatility/i)).not.toBeInTheDocument();
  });

  it("renders the Portfolio Risk section without requiring a symbol search, listing positions and the risk analysis", () => {
    mockState.positions = [tradingPosition()];
    mockState.risk = tradingRiskAnalysis();
    mockState.settings = { tradingAccountValue: 100000 };
    renderWithClient(<TradingResearch />);

    expect(screen.getByTestId("card-portfolio-risk")).toBeInTheDocument();
    expect(screen.getByTestId("row-position-1")).toBeInTheDocument();
    expect(screen.getByText(/AAPL . long . 10/)).toBeInTheDocument();
    expect(screen.getByText("Overall: Excellent")).toBeInTheDocument();
    expect(screen.getByTestId("section-risk-analysis")).toBeInTheDocument();
  });

  it("shows an honest empty-positions message when no positions exist yet", () => {
    renderWithClient(<TradingResearch />);
    expect(screen.getByText("No trading positions yet — add one above.")).toBeInTheDocument();
  });

  it("submits the add-position form with the entered values", async () => {
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-position-symbol"), "msft");
    await userEvent.type(screen.getByTestId("input-position-quantity"), "5");
    await userEvent.type(screen.getByTestId("input-position-entry-price"), "400");
    await userEvent.type(screen.getByTestId("input-position-stop-price"), "380");
    await userEvent.click(screen.getByTestId("button-add-position"));

    expect(createPositionMutate).toHaveBeenCalledWith(
      {
        data: {
          symbol: "MSFT",
          side: "long",
          quantity: 5,
          entryPrice: 400,
          stopPrice: 380,
          targetPrice: undefined,
        },
      },
      expect.anything(),
    );
  });

  it("submits a delete for the clicked position", async () => {
    mockState.positions = [tradingPosition()];
    renderWithClient(<TradingResearch />);

    await userEvent.click(screen.getByTestId("button-delete-position-1"));

    expect(deletePositionMutate).toHaveBeenCalledWith({ id: 1 }, expect.anything());
  });

  // v1.3.1 — AI Trading Coach.
  it("shows an Ask AI Trading Coach trigger on each position row", () => {
    mockState.positions = [tradingPosition()];
    renderWithClient(<TradingResearch />);
    expect(screen.getByTestId("button-ask-trading-coach-position-1")).toBeInTheDocument();
  });

  it("submits the account value form with the entered value", async () => {
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-account-value"), "50000");
    await userEvent.click(screen.getByTestId("button-save-account-value"));

    expect(updateSettingsMutate).toHaveBeenCalledWith(
      { data: { tradingAccountValue: 50000 } },
      expect.anything(),
    );
  });

  it("shows the per-position touch probability context when risk data resolves", () => {
    mockState.positions = [tradingPosition()];
    mockState.risk = tradingRiskAnalysis();
    renderWithClient(<TradingResearch />);

    expect(screen.getByText(/trending-bullish/)).toBeInTheDocument();
    expect(screen.getByText(/stop touch 12%/)).toBeInTheDocument();
    expect(screen.getByText(/target touch 34%/)).toBeInTheDocument();
  });

  it("disables the Liquidity tab until a symbol is searched, never fetching liquidity data eagerly", () => {
    renderWithClient(<TradingResearch />);
    expect(screen.getByTestId("tab-liquidity")).toBeDisabled();
  });

  it("enables the Liquidity tab once a symbol is searched, and renders liquidity data once the tab is opened", async () => {
    mockState.liquidity = liquidityAnalysis();
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));

    expect(screen.getByTestId("tab-liquidity")).not.toBeDisabled();
    expect(screen.queryByTestId("card-liquidity")).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("tab-liquidity"));

    expect(await screen.findByTestId("card-liquidity")).toBeInTheDocument();
    expect(screen.getByText(/Liquidity — AAPL/i)).toBeInTheDocument();
    expect(screen.getByText("High liquidity")).toBeInTheDocument();
    expect(screen.getByText("$32.5M avg daily dollar volume")).toBeInTheDocument();
    expect(screen.getByText(/buying pressure \(62% buy \/ 38% sell\)/)).toBeInTheDocument();
    expect(screen.getByText("25.4% of volume")).toBeInTheDocument();
  });

  it("honestly shows an empty-volume-profile message rather than a fabricated profile", async () => {
    mockState.liquidity = liquidityAnalysis({ volumeProfile: [] });
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));
    await userEvent.click(screen.getByTestId("tab-liquidity"));

    expect(await screen.findByTestId("card-liquidity")).toBeInTheDocument();
    expect(screen.getByText("No volume data available to build a profile for this sample.")).toBeInTheDocument();
  });

  it("shows a not-found message on the Liquidity tab when the symbol can't be resolved", async () => {
    mockState.isLiquidityError = true;
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "NOTATICKER");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));
    await userEvent.click(screen.getByTestId("tab-liquidity"));

    expect(await screen.findByText(/Could not resolve liquidity data for "NOTATICKER"/i)).toBeInTheDocument();
  });

  it("renders the legacy inline assistant collapsed by default, with an honest empty-state once opened", async () => {
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));

    expect(await screen.findByTestId("card-trade-coach")).toBeInTheDocument();
    // v1.3.2 — collapsed by default; the chat body isn't in the DOM yet.
    expect(screen.queryByTestId("trade-coach-empty")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-toggle-legacy-trade-coach")).toHaveTextContent(
      "Show legacy inline assistant",
    );

    await userEvent.click(screen.getByTestId("button-toggle-legacy-trade-coach"));

    expect(screen.getByTestId("trade-coach-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("trade-coach-history")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-toggle-legacy-trade-coach")).toHaveTextContent(
      "Hide legacy inline assistant",
    );
  });

  it("does not render the legacy inline assistant card before any symbol is searched", () => {
    renderWithClient(<TradingResearch />);
    expect(screen.queryByTestId("card-trade-coach")).not.toBeInTheDocument();
  });

  // v1.3.2 — Version 1 Polish Sprint: the legacy card's own description now
  // points users at the unified AI Trading Coach via a second trigger of
  // the same openWithFocus() call the header button already uses.
  it("guides the user toward the unified AI Trading Coach from the legacy card's own description", async () => {
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));

    expect(await screen.findByTestId("button-ask-trading-coach-from-legacy-panel")).toBeInTheDocument();
    expect(screen.getByText(/kept for continuity and still fully works/i)).toBeInTheDocument();
  });

  it("submits a free-form question to the trade coach ask/stream endpoint once the legacy panel is opened", async () => {
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));
    await userEvent.click(await screen.findByTestId("button-toggle-legacy-trade-coach"));

    await userEvent.type(
      screen.getByTestId("trade-coach-input"),
      "Is now a good time to look at AAPL given my risk profile?",
    );
    await userEvent.click(screen.getByTestId("trade-coach-submit"));

    expect(streamCoachMock).toHaveBeenCalledWith(
      "/trading/coach/ask/stream",
      { symbol: "AAPL", question: "Is now a good time to look at AAPL given my risk profile?" },
      expect.anything(),
      expect.anything(),
    );
  });

  it("renders a streamed answer as a Q&A turn once the stream completes", async () => {
    streamCoachMock.mockImplementation(async (_path, _body, handlers) => {
      handlers.onDone?.({ answer: "AAPL is in a trending-bullish regime with High liquidity." });
    });
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));
    await userEvent.click(await screen.findByTestId("button-toggle-legacy-trade-coach"));
    await userEvent.type(screen.getByTestId("trade-coach-input"), "What is the regime?");
    await userEvent.click(screen.getByTestId("trade-coach-submit"));

    expect(await screen.findByText(/trending-bullish regime with High liquidity/i)).toBeInTheDocument();
    expect(screen.getByText("Q: What is the regime?")).toBeInTheDocument();
  });

  it("shows an honest error message in the conversation when the stream fails, never fabricating an answer", async () => {
    streamCoachMock.mockImplementation(async (_path, _body, handlers) => {
      handlers.onError?.("network error");
    });
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));
    await userEvent.click(await screen.findByTestId("button-toggle-legacy-trade-coach"));
    await userEvent.type(screen.getByTestId("trade-coach-input"), "What is the regime?");
    await userEvent.click(screen.getByTestId("trade-coach-submit"));

    expect(await screen.findByText(/Failed to get an answer/i)).toBeInTheDocument();
  });

  // v1.5.0 Sprint 7 — AI Workspaces. The legacy inline coach panel (and its
  // workspace sidebar/header) only renders once a symbol has been searched
  // — matching every pre-existing test above, which searches a symbol
  // before finding "button-toggle-legacy-trade-coach".
  describe("v1.5.0 Sprint 7 — AI Workspaces", () => {
    async function openLegacyCoachPanel() {
      mockState.structure = structureAnalysis();
      renderWithClient(<TradingResearch />);
      await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "AAPL");
      await userEvent.click(screen.getByTestId("button-trading-research-search"));
      await userEvent.click(await screen.findByTestId("button-toggle-legacy-trade-coach"));
    }

    it("shows an honest empty state when there are no workspaces yet", async () => {
      await openLegacyCoachPanel();
      expect(await screen.findByTestId("trade-coach-workspace-sidebar-empty")).toBeInTheDocument();
    });

    it("creating a workspace adds it to the sidebar", async () => {
      await openLegacyCoachPanel();

      await userEvent.click(await screen.findByTestId("trade-coach-workspace-sidebar-new-workspace"));
      await userEvent.type(screen.getByTestId("trade-coach-workspace-sidebar-create-name"), "Structure research");
      await userEvent.click(screen.getByTestId("trade-coach-workspace-sidebar-create-save"));

      expect(await screen.findByText("Structure research")).toBeInTheDocument();
    });

    it("selecting a workspace shows its WorkspaceHeader", async () => {
      workspacesState.workspaces = [
        {
          id: 4,
          coachId: "trading",
          name: "Regime tracking",
          description: null,
          pinned: false,
          archived: false,
          tags: [],
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z",
        },
      ];
      await openLegacyCoachPanel();

      await userEvent.click(await screen.findByTestId("trade-coach-workspace-sidebar-card-4-select"));

      expect(await screen.findByTestId("trade-coach-workspace-header")).toBeInTheDocument();
      expect(screen.getByTestId("trade-coach-workspace-header-name")).toHaveTextContent("Regime tracking");
    });
  });

  describe("v1.5.0 Sprint 8 — AI Research Notebooks", () => {
    async function openLegacyCoachPanel() {
      mockState.structure = structureAnalysis();
      renderWithClient(<TradingResearch />);
      await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "AAPL");
      await userEvent.click(screen.getByTestId("button-trading-research-search"));
      await userEvent.click(await screen.findByTestId("button-toggle-legacy-trade-coach"));
    }

    it("notebooks are collapsed by default; the toggle reveals the notebook sidebar", async () => {
      await openLegacyCoachPanel();
      expect(screen.queryByTestId("trade-notebook-sidebar")).not.toBeInTheDocument();

      await userEvent.click(await screen.findByTestId("button-toggle-trade-notebooks"));
      expect(await screen.findByTestId("trade-notebook-sidebar")).toBeInTheDocument();
    });

    it("creating a notebook adds it to the sidebar, and selecting it shows the header/editor/summary panel", async () => {
      await openLegacyCoachPanel();
      await userEvent.click(await screen.findByTestId("button-toggle-trade-notebooks"));

      await userEvent.click(await screen.findByTestId("trade-notebook-sidebar-new-notebook"));
      await userEvent.type(screen.getByTestId("trade-notebook-sidebar-create-title"), "Structure notes");
      await userEvent.click(screen.getByTestId("trade-notebook-sidebar-create-save"));

      const card = await screen.findByTestId(/trade-notebook-sidebar-list-card-\d+-select/);
      await userEvent.click(card);

      expect(await screen.findByTestId("trade-notebook-header")).toHaveTextContent("Structure notes");
      expect(screen.getByTestId("trade-notebook-editor")).toBeInTheDocument();
      expect(screen.getByTestId("trade-notebook-summary-panel")).toBeInTheDocument();
    });
  });

  describe("v1.5.0 Sprint 9 — AI Strategy Builder", () => {
    async function openLegacyCoachPanel() {
      mockState.structure = structureAnalysis();
      renderWithClient(<TradingResearch />);
      await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "AAPL");
      await userEvent.click(screen.getByTestId("button-trading-research-search"));
      await userEvent.click(await screen.findByTestId("button-toggle-legacy-trade-coach"));
    }

    it("strategies are collapsed by default; the toggle reveals the strategy sidebar", async () => {
      await openLegacyCoachPanel();
      expect(screen.queryByTestId("trade-strategy-sidebar")).not.toBeInTheDocument();

      await userEvent.click(await screen.findByTestId("button-toggle-trade-strategies"));
      expect(await screen.findByTestId("trade-strategy-sidebar")).toBeInTheDocument();
    });

    it("creating a strategy adds it to the sidebar, and selecting it shows the header/editor/summary panel", async () => {
      await openLegacyCoachPanel();
      await userEvent.click(await screen.findByTestId("button-toggle-trade-strategies"));

      await userEvent.click(await screen.findByTestId("trade-strategy-sidebar-new-strategy"));
      await userEvent.type(screen.getByTestId("trade-strategy-sidebar-create-title"), "Breakout plan");
      await userEvent.type(screen.getByTestId("trade-strategy-sidebar-create-strategy-type"), "Breakout");
      await userEvent.click(screen.getByTestId("trade-strategy-sidebar-create-save"));

      const card = await screen.findByTestId(/trade-strategy-sidebar-list-card-\d+-select/);
      await userEvent.click(card);

      expect(await screen.findByTestId("trade-strategy-header")).toHaveTextContent("Breakout plan");
      expect(screen.getByTestId("trade-strategy-editor")).toBeInTheDocument();
      expect(screen.getByTestId("trade-strategy-summary-panel")).toBeInTheDocument();
    });
  });

  describe("v1.5.0 Sprint 10 — Institutional Trade Planner", () => {
    async function openLegacyCoachPanel() {
      mockState.structure = structureAnalysis();
      renderWithClient(<TradingResearch />);
      await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "AAPL");
      await userEvent.click(screen.getByTestId("button-trading-research-search"));
      await userEvent.click(await screen.findByTestId("button-toggle-legacy-trade-coach"));
    }

    it("trade plans are collapsed by default; the toggle reveals the trade plan sidebar", async () => {
      await openLegacyCoachPanel();
      expect(screen.queryByTestId("trade-trade-plan-sidebar")).not.toBeInTheDocument();

      await userEvent.click(await screen.findByTestId("button-toggle-trade-trade-plans"));
      expect(await screen.findByTestId("trade-trade-plan-sidebar")).toBeInTheDocument();
    });

    it("creating a trade plan adds it to the sidebar, and selecting it shows the header/editor/checklist/summary panel", async () => {
      await openLegacyCoachPanel();
      await userEvent.click(await screen.findByTestId("button-toggle-trade-trade-plans"));

      await userEvent.click(await screen.findByTestId("trade-trade-plan-sidebar-new-plan"));
      await userEvent.type(screen.getByTestId("trade-trade-plan-sidebar-create-title"), "Breakout trade plan");
      await userEvent.click(screen.getByTestId("trade-trade-plan-sidebar-create-save"));

      const card = await screen.findByTestId(/trade-trade-plan-sidebar-list-card-\d+-select/);
      await userEvent.click(card);

      expect(await screen.findByTestId("trade-trade-plan-header")).toHaveTextContent("Breakout trade plan");
      expect(screen.getByTestId("trade-trade-plan-editor")).toBeInTheDocument();
      expect(screen.getByTestId("trade-trade-plan-checklist")).toBeInTheDocument();
      expect(screen.getByTestId("trade-trade-plan-summary-panel")).toBeInTheDocument();
    });
  });
});
