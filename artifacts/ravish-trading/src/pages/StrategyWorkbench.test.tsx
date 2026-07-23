// Phase 31 — Institutional Strategy Workbench. Frontend smoke tests
// mirroring StrategyFramework.test.tsx's (Phase 30) mocked-generated-hook
// pattern, plus wouter's useSearch mock following learn/LearningCentre
// .test.tsx's own established deep-link testing precedent.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

type HookResult = { data: unknown; isLoading?: boolean };

const searchMock = vi.hoisted(() => ({ current: "" }));

const mockState = vi.hoisted(() => ({
  strategies: { data: undefined as unknown, isLoading: false } as HookResult,
  strategy: { data: undefined as unknown, isLoading: false } as HookResult,
  checklists: { data: undefined as unknown } as HookResult,
  coach: { data: undefined as unknown, isLoading: false } as HookResult,
  progress: { data: undefined as unknown } as HookResult,
  notes: { data: undefined as unknown, isLoading: false } as HookResult,
  report: { data: undefined as unknown, isLoading: false } as HookResult,
  createChecklistMutate: vi.fn(),
  updateChecklistMutate: vi.fn(),
  deleteChecklistMutate: vi.fn(),
  recordViewedMutate: vi.fn(),
  createNoteMutate: vi.fn(),
  deleteNoteMutate: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useListTradingStrategies: () => mockState.strategies,
    useGetTradingStrategy: () => mockState.strategy,
    useListTradingStrategyChecklists: () => mockState.checklists,
    useCreateTradingStrategyChecklist: () => ({ mutate: mockState.createChecklistMutate }),
    useUpdateTradingStrategyChecklist: () => ({ mutate: mockState.updateChecklistMutate }),
    useDeleteTradingStrategyChecklist: () => ({ mutate: mockState.deleteChecklistMutate }),
    useGetTradingCoachStrategyExplanation: () => mockState.coach,
    useGetLearningProgress: () => mockState.progress,
    useRecordLearningItemViewed: () => ({ mutate: mockState.recordViewedMutate }),
    useListTradingWorkspaceNotesForSymbol: () => mockState.notes,
    useCreateTradingWorkspaceNote: () => ({ mutate: mockState.createNoteMutate }),
    useDeleteTradingWorkspaceNote: () => ({ mutate: mockState.deleteNoteMutate }),
    useGetStrategyFrameworkSummaryReport: () => mockState.report,
  };
});

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useSearch: () => searchMock.current,
  };
});

import StrategyWorkbench from "./StrategyWorkbench";

function fixtureStrategy(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "Strategy A",
    description: "A personally defined trade setup.",
    category: "trend",
    timeframes: ["1h", "1D"],
    markets: ["equities"],
    requiredEvidence: ["structure", "liquidity"],
    checklist: [
      { id: "a", label: "Structure reviewed", required: true },
      { id: "b", label: "Optional note", required: false },
    ],
    educationalNotes: "Some notes.",
    references: ["A book"],
    version: "1.0.0",
    validation: { valid: true, issues: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function fixtureCoach(overrides: Record<string, unknown> = {}) {
  return {
    coach: "strategy",
    coachLabel: "Strategy Coach",
    symbol: null,
    headline: '"Strategy A" (trend) — No checklist instance has been started for this strategy yet.',
    whyThisExists: "The Strategy Coach explains your own registered Strategy Framework entry.",
    metricsUsed: [{ label: "Category", detail: "trend", source: "Strategy Metadata" }],
    supportingEvidence: [],
    risksReducingConfidence: [],
    strengthsIncreasingConfidence: [],
    howToInterpret: [],
    commonMistakes: [],
    institutionalPerspective: "Formalizing a personal methodology as named, versioned metadata is a basic institutional-discipline practice.",
    relatedGlossaryKeys: [],
    calculationSources: [],
    disclaimer: "Institutional Trading AI Coach — Educational, Deterministic, Evidence Based. Never creates a trading signal.",
    ...overrides,
  };
}

describe("StrategyWorkbench page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchMock.current = "";
    localStorage.clear();
    mockState.strategies = { data: [], isLoading: false };
    mockState.strategy = { data: undefined, isLoading: false };
    mockState.checklists = { data: undefined };
    mockState.coach = { data: undefined, isLoading: false };
    mockState.progress = { data: undefined };
    mockState.notes = { data: undefined, isLoading: false };
    mockState.report = { data: undefined, isLoading: false };
  });

  it("honestly shows empty states for the registry, workspace, and comparison with nothing registered", () => {
    renderWithClient(<StrategyWorkbench />);
    expect(screen.getByTestId("text-workbench-strategies-empty")).toBeInTheDocument();
    expect(screen.getByTestId("text-no-active-strategy")).toBeInTheDocument();
    expect(screen.getByTestId("text-comparison-empty")).toBeInTheDocument();
  });

  it("selecting a strategy in the Browser opens Review Metadata / Checklist / Evidence in the Workspace", async () => {
    const strategy = fixtureStrategy();
    mockState.strategies = { data: [strategy], isLoading: false };
    mockState.strategy = { data: strategy, isLoading: false };
    mockState.checklists = { data: [] };
    mockState.coach = { data: fixtureCoach(), isLoading: false };
    mockState.notes = { data: [], isLoading: false };

    const user = userEvent.setup();
    renderWithClient(<StrategyWorkbench />);
    await user.click(screen.getByTestId("button-open-strategy-1"));

    expect(screen.getByTestId("text-workbench-active-strategy-name")).toHaveTextContent("Strategy A");
    expect(screen.getByTestId("panel-validation-summary")).toBeInTheDocument();
    expect(screen.getByTestId("panel-evidence-viewer")).toBeInTheDocument();
    expect(screen.getByTestId("badge-evidence-structure")).toBeInTheDocument();
    expect(screen.getByTestId("panel-checklist-viewer")).toBeInTheDocument();
    expect(screen.getByTestId("text-checklists-empty")).toBeInTheDocument();
  });

  it("Learning integration: the Learning Viewer's Mark-as-viewed button records progress with the strategy-framework-prefixed key", async () => {
    const strategy = fixtureStrategy();
    mockState.strategies = { data: [strategy], isLoading: false };
    mockState.strategy = { data: strategy, isLoading: false };
    mockState.checklists = { data: [] };
    mockState.coach = { data: fixtureCoach(), isLoading: false };
    mockState.notes = { data: [], isLoading: false };

    const user = userEvent.setup();
    renderWithClient(<StrategyWorkbench />);
    await user.click(screen.getByTestId("button-open-strategy-1"));
    await user.click(screen.getByTestId("button-mark-strategy-learning-viewed"));

    expect(mockState.recordViewedMutate).toHaveBeenCalledWith({ data: { itemType: "strategy", itemKey: "strategy-framework:1" } });
  });

  it("Coach integration: the Strategy Coach panel renders the coach's own headline and disclaimer", async () => {
    const strategy = fixtureStrategy();
    mockState.strategies = { data: [strategy], isLoading: false };
    mockState.strategy = { data: strategy, isLoading: false };
    mockState.checklists = { data: [] };
    mockState.coach = { data: fixtureCoach(), isLoading: false };
    mockState.notes = { data: [], isLoading: false };

    const user = userEvent.setup();
    renderWithClient(<StrategyWorkbench />);
    await user.click(screen.getByTestId("button-open-strategy-1"));

    expect(screen.getByTestId("text-strategy-coach-headline")).toHaveTextContent("No checklist instance has been started");
    expect(screen.getByTestId("panel-strategy-coach")).toHaveTextContent("Never creates a trading signal.");
  });

  it("Strategy Notes: reuses the trading_workspace_notes system under a STRATEGY:<id> pseudo-symbol", async () => {
    const strategy = fixtureStrategy();
    mockState.strategies = { data: [strategy], isLoading: false };
    mockState.strategy = { data: strategy, isLoading: false };
    mockState.checklists = { data: [] };
    mockState.coach = { data: fixtureCoach(), isLoading: false };
    mockState.notes = { data: [], isLoading: false };

    const user = userEvent.setup();
    renderWithClient(<StrategyWorkbench />);
    await user.click(screen.getByTestId("button-open-strategy-1"));
    expect(screen.getByTestId("text-strategy-notes-empty")).toBeInTheDocument();

    await user.type(screen.getByTestId("input-strategy-note-draft"), "Reviewed the checklist before entry.");
    await user.click(screen.getByTestId("button-add-strategy-note"));

    expect(mockState.createNoteMutate).toHaveBeenCalledWith({ data: { symbol: "STRATEGY:1", note: "Reviewed the checklist before entry." } });
  });

  it("Comparison view: two checked strategies render a metadata-only comparison table, never a performance/ranking column", async () => {
    const a = fixtureStrategy({ id: 1, name: "Strategy A", category: "trend" });
    const b = fixtureStrategy({ id: 2, name: "Strategy B", category: "breakout" });
    mockState.strategies = { data: [a, b], isLoading: false };
    mockState.progress = { data: { viewedStrategyKeys: ["strategy-framework:1"] } };

    const user = userEvent.setup();
    renderWithClient(<StrategyWorkbench />);
    await user.click(screen.getByTestId("checkbox-compare-strategy-1"));
    await user.click(screen.getByTestId("checkbox-compare-strategy-2"));

    const table = screen.getByTestId("table-strategy-comparison");
    expect(within(table).getByText("Strategy A")).toBeInTheDocument();
    expect(within(table).getByText("Strategy B")).toBeInTheDocument();
    expect(table.textContent).not.toMatch(/win rate|expectancy|p&l|rank/i);
    expect(within(screen.getByTestId("comparison-row-1")).getByText("viewed")).toBeInTheDocument();
    expect(within(screen.getByTestId("comparison-row-2")).getByText("not yet viewed")).toBeInTheDocument();
  });

  it("Strategy Report Viewer renders the Reporting Centre's own report sections and links out to the full Reporting Centre", () => {
    mockState.report = {
      data: {
        reportType: "strategy-framework-summary",
        sections: [{ id: "executive-summary", title: "Executive Summary", body: "1 strategy definition(s) on record." }],
      },
      isLoading: false,
    };
    renderWithClient(<StrategyWorkbench />);
    expect(screen.getByTestId("report-section-executive-summary")).toHaveTextContent("1 strategy definition(s) on record.");
    expect(screen.getByTestId("link-open-reporting-centre")).toBeInTheDocument();
  });

  it("Save Workspace: saving persists locally (no server call) and the saved workspace can be reloaded", async () => {
    const strategy = fixtureStrategy();
    mockState.strategies = { data: [strategy], isLoading: false };
    mockState.strategy = { data: strategy, isLoading: false };
    mockState.checklists = { data: [] };
    mockState.coach = { data: fixtureCoach(), isLoading: false };
    mockState.notes = { data: [], isLoading: false };

    const user = userEvent.setup();
    renderWithClient(<StrategyWorkbench />);
    await user.click(screen.getByTestId("button-open-strategy-1"));
    await user.type(screen.getByTestId("input-workspace-layout-name"), "My Review");
    await user.click(screen.getByTestId("button-save-workspace"));

    expect(screen.getByTestId("button-load-workspace-My Review")).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem("strategy-workbench-layouts") ?? "[]");
    expect(stored).toEqual([{ name: "My Review", activeStrategyId: 1, comparisonIds: [] }]);
  });

  it("Deep linking: a ?strategyId= query param opens that strategy's Workspace on load", () => {
    searchMock.current = "strategyId=1";
    const strategy = fixtureStrategy();
    mockState.strategies = { data: [strategy], isLoading: false };
    mockState.strategy = { data: strategy, isLoading: false };
    mockState.checklists = { data: [] };
    mockState.coach = { data: fixtureCoach(), isLoading: false };
    mockState.notes = { data: [], isLoading: false };

    renderWithClient(<StrategyWorkbench />);
    expect(screen.getByTestId("text-workbench-active-strategy-name")).toHaveTextContent("Strategy A");
  });
});
