// Phase 30 — Institutional Strategy Framework. Frontend smoke tests for the
// Strategy Registry / Detail / Checklist / Evidence / Learning Viewer page,
// mirroring Phase 29's own TradingAICoach.test.tsx mocked-generated-hook
// pattern.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

type HookResult = { data: unknown; isLoading?: boolean; isError?: boolean };

const mockState = vi.hoisted(() => ({
  strategies: { data: undefined as unknown, isLoading: false } as HookResult,
  strategy: { data: undefined as unknown, isLoading: false } as HookResult,
  checklists: { data: undefined as unknown } as HookResult,
  coach: { data: undefined as unknown, isLoading: false } as HookResult,
  guidedPath: { data: undefined as unknown } as HookResult,
  progress: { data: undefined as unknown } as HookResult,
  createStrategyMutate: vi.fn(),
  deleteStrategyMutate: vi.fn(),
  createChecklistMutate: vi.fn(),
  updateChecklistMutate: vi.fn(),
  deleteChecklistMutate: vi.fn(),
  recordViewedMutate: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useListTradingStrategies: () => mockState.strategies,
    useGetTradingStrategy: () => mockState.strategy,
    useCreateTradingStrategy: () => ({ mutate: mockState.createStrategyMutate, isPending: false, isError: false }),
    useDeleteTradingStrategy: () => ({ mutate: mockState.deleteStrategyMutate }),
    useListTradingStrategyChecklists: () => mockState.checklists,
    useCreateTradingStrategyChecklist: () => ({ mutate: mockState.createChecklistMutate }),
    useUpdateTradingStrategyChecklist: () => ({ mutate: mockState.updateChecklistMutate }),
    useDeleteTradingStrategyChecklist: () => ({ mutate: mockState.deleteChecklistMutate }),
    useGetTradingCoachStrategyExplanation: () => mockState.coach,
    useGetLearningPathByKey: () => mockState.guidedPath,
    useGetLearningProgress: () => mockState.progress,
    useRecordLearningItemViewed: () => ({ mutate: mockState.recordViewedMutate }),
  };
});

import StrategyFramework from "./StrategyFramework";

function fixtureStrategy(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "My Setup",
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
    headline: '"My Setup" (trend) — No checklist instance has been started for this strategy yet.',
    whyThisExists: "The Strategy Coach explains your own registered Strategy Framework entry.",
    metricsUsed: [{ label: "Category", detail: "trend", source: "Strategy Metadata" }],
    supportingEvidence: [],
    risksReducingConfidence: ["No checklist instance exists yet for this strategy."],
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

describe("StrategyFramework page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.strategies = { data: [], isLoading: false };
    mockState.strategy = { data: undefined, isLoading: false };
    mockState.checklists = { data: undefined };
    mockState.coach = { data: undefined, isLoading: false };
    mockState.guidedPath = { data: undefined };
    mockState.progress = { data: undefined };
  });

  it("honestly shows an empty registry with no strategy selected", () => {
    renderWithClient(<StrategyFramework />);
    expect(screen.getByTestId("text-strategies-empty")).toBeInTheDocument();
    expect(screen.getByTestId("text-no-strategy-selected")).toBeInTheDocument();
  });

  it("never names a real trading methodology anywhere in the page's own static copy", () => {
    renderWithClient(<StrategyFramework />);
    const page = screen.getByTestId("page-strategy-framework").textContent?.toLowerCase() ?? "";
    expect(page).not.toContain("ict");
    expect(page).not.toContain("smc");
    expect(page).not.toContain("tom nash");
  });

  it("submitting the new-strategy form calls create with the entered fields", async () => {
    const user = userEvent.setup();
    renderWithClient(<StrategyFramework />);
    await user.click(screen.getByTestId("button-toggle-new-strategy"));
    await user.type(screen.getByTestId("input-strategy-name"), "My Setup");
    await user.type(screen.getByTestId("input-strategy-description"), "A description.");
    await user.click(screen.getByTestId("button-create-strategy"));
    expect(mockState.createStrategyMutate).toHaveBeenCalledTimes(1);
    const args = mockState.createStrategyMutate.mock.calls[0][0];
    expect(args.data.name).toBe("My Setup");
    expect(args.data.description).toBe("A description.");
  });

  it("lists a registered strategy and selecting it renders its detail/evidence/learning viewers", async () => {
    const strategy = fixtureStrategy();
    mockState.strategies = { data: [strategy], isLoading: false };
    mockState.strategy = { data: strategy, isLoading: false };
    mockState.checklists = { data: [] };
    mockState.coach = { data: fixtureCoach(), isLoading: false };

    const user = userEvent.setup();
    renderWithClient(<StrategyFramework />);
    await user.click(screen.getByTestId("button-select-strategy-1"));

    expect(screen.getByTestId("text-strategy-detail-name")).toHaveTextContent("My Setup");
    expect(screen.getByTestId("panel-validation-summary")).toBeInTheDocument();
    expect(screen.getByTestId("badge-validation-status")).toHaveTextContent("Structurally valid");
    expect(screen.getByTestId("panel-evidence-viewer")).toBeInTheDocument();
    expect(screen.getByTestId("badge-evidence-structure")).toBeInTheDocument();
    expect(screen.getByTestId("badge-evidence-liquidity")).toBeInTheDocument();
    expect(screen.getByTestId("text-strategy-educational-notes")).toHaveTextContent("Some notes.");
    expect(screen.getByTestId("text-checklists-empty")).toBeInTheDocument();
    expect(screen.getByTestId("text-strategy-coach-headline")).toHaveTextContent("No checklist instance has been started");
  });

  it("toggling a checklist item calls update with the item marked complete", async () => {
    const strategy = fixtureStrategy();
    const checklist = {
      id: 10,
      strategyId: 1,
      symbol: "AAPL",
      status: "in_progress",
      items: [{ id: "a", label: "Structure reviewed", required: true, completed: false, notes: "", evidenceLinks: [] }],
      notes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockState.strategies = { data: [strategy], isLoading: false };
    mockState.strategy = { data: strategy, isLoading: false };
    mockState.checklists = { data: [checklist] };
    mockState.coach = { data: fixtureCoach(), isLoading: false };

    const user = userEvent.setup();
    renderWithClient(<StrategyFramework />);
    await user.click(screen.getByTestId("button-select-strategy-1"));
    await user.click(screen.getByTestId("button-select-checklist-10"));
    await user.click(screen.getByTestId("checkbox-checklist-item-a"));

    expect(mockState.updateChecklistMutate).toHaveBeenCalledTimes(1);
    const args = mockState.updateChecklistMutate.mock.calls[0][0];
    expect(args.id).toBe(10);
    expect(args.data.items[0].completed).toBe(true);
  });

  it("marking the learning viewer as viewed records progress with a strategy-framework-prefixed key", async () => {
    const strategy = fixtureStrategy();
    mockState.strategies = { data: [strategy], isLoading: false };
    mockState.strategy = { data: strategy, isLoading: false };
    mockState.checklists = { data: [] };
    mockState.coach = { data: fixtureCoach(), isLoading: false };

    const user = userEvent.setup();
    renderWithClient(<StrategyFramework />);
    await user.click(screen.getByTestId("button-select-strategy-1"));
    await user.click(screen.getByTestId("button-mark-strategy-learning-viewed"));

    expect(mockState.recordViewedMutate).toHaveBeenCalledWith({ data: { itemType: "strategy", itemKey: "strategy-framework:1" } });
  });

  it("renders the Guided Learning Mode topic list from the strategy-framework path", () => {
    mockState.guidedPath = {
      data: {
        key: "strategy-framework",
        title: "Institutional Strategy Framework",
        topics: [{ key: "strategy-framework-overview", title: "What Is a Strategy?", summary: "Metadata only.", estimatedMinutes: 3 }],
      },
    };
    renderWithClient(<StrategyFramework />);
    const list = screen.getByTestId("list-strategy-framework-guided-topics");
    expect(within(list).getByText("What Is a Strategy?")).toBeInTheDocument();
  });
});
