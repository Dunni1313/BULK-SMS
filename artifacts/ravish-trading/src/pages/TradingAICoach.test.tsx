// Phase 29 — Institutional Trading AI Coach. Frontend smoke tests for the
// standalone Trading AI Coach page, mirroring Phase 21's own
// InstitutionalAICoach.test.tsx pattern exactly.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

type HookResult = { data: unknown; isLoading?: boolean; isError?: boolean };

const mockState = vi.hoisted(() => ({
  explanation: { data: undefined as unknown, isLoading: false, isError: false } as HookResult,
  guidedPath: { data: undefined as unknown } as HookResult,
  progress: { data: undefined as unknown } as HookResult,
  scenarioMutate: vi.fn(),
  scenarioResult: { data: undefined as unknown, isPending: false, isError: false },
}));

vi.mock("@/hooks/use-trading-coach-explanation", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/use-trading-coach-explanation")>("@/hooks/use-trading-coach-explanation");
  return {
    ...actual,
    useTradingCoachExplanation: () => mockState.explanation,
  };
});

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetLearningPathByKey: () => mockState.guidedPath,
    useGetLearningProgress: () => mockState.progress,
    useExplainTradingScenario: () => ({ mutate: mockState.scenarioMutate, ...mockState.scenarioResult }),
  };
});

import TradingAICoach from "./TradingAICoach";

function fixtureExplanation(overrides: Record<string, unknown> = {}) {
  return {
    coach: "structure",
    coachLabel: "Structure Coach",
    symbol: "AAPL",
    headline: "AAPL reads uptrend with unanimous agreement across 3 timeframes.",
    whyThisExists: "Market Structure classifies trend from swing highs/lows detected in real candle data.",
    metricsUsed: [{ label: "1D trend", detail: "uptrend (High confidence)", source: "Market Structure Engine" }],
    supportingEvidence: [{ label: "1D support zone", detail: "@ 148 — 3 swing touch(es)", source: "Market Structure Engine" }],
    risksReducingConfidence: [],
    strengthsIncreasingConfidence: ["All 3 reviewed timeframes agree on uptrend trend."],
    howToInterpret: ["A support/resistance zone's strength is how many swing touches clustered near that price."],
    commonMistakes: ["Treating a single timeframe's trend as the whole picture."],
    institutionalPerspective: "Institutional desks routinely require multi-timeframe confluence.",
    relatedGlossaryKeys: ["market-structure"],
    calculationSources: ["Market Structure Engine (Sprint 33)"],
    disclaimer: "Institutional Trading AI Coach — Educational, Deterministic, Evidence Based. Never creates a trading signal.",
    ...overrides,
  };
}

function fixtureGuidedPath() {
  return {
    key: "trading-engine",
    title: "Institutional Trading Engine",
    description: "How to read Engine 2's own modules.",
    glossaryCategory: "trading",
    topics: [
      { key: "trading-market-structure", title: "Market Structure", summary: "Trend classification.", body: [], whyItMatters: "x", externalHref: null, relatedGlossaryKeys: [], estimatedMinutes: 4 },
      { key: "trading-risk-management", title: "Risk Management", summary: "Position sizing.", body: [], whyItMatters: "x", externalHref: null, relatedGlossaryKeys: [], estimatedMinutes: 5 },
    ],
  };
}

function fixtureProgress(overrides: Record<string, unknown> = {}) {
  return {
    lessonsViewed: 0,
    lessonsCompleted: 0,
    glossaryTermsViewed: 0,
    strategiesViewed: 0,
    coachesViewed: 4,
    pathCompletion: [{ pathKey: "trading-engine", title: "Institutional Trading Engine", topicsTotal: 8, topicsCompleted: 1, percentComplete: 12.5 }],
    greeksQuiz: { totalAttempts: 0, averageScore: 0, bestScore: 0, latestScore: null, improvement: 0, firstPercent: 0, latestPercent: 0 },
    valueQuiz: { totalAttempts: 0, averageScore: 0, bestScore: 0, latestScore: null, improvement: 0, firstPercent: 0, latestPercent: 0 },
    recentHistory: [],
    completedLessonKeys: ["trading-market-structure"],
    completedGlossaryKeys: [],
    completedStrategyKeys: [],
    completedCoachKeys: [],
    ...overrides,
  };
}

describe("TradingAICoach page", () => {
  beforeEach(() => {
    mockState.explanation = { data: undefined, isLoading: false, isError: false };
    mockState.guidedPath = { data: fixtureGuidedPath() };
    mockState.progress = { data: fixtureProgress() };
    mockState.scenarioMutate = vi.fn();
    mockState.scenarioResult = { data: undefined, isPending: false, isError: false };
  });

  it("shows the permanent labels and an advisory message before a symbol is searched", () => {
    renderWithClient(<TradingAICoach />);

    expect(screen.getByTestId("badge-trading-coach-page-institutional-ai-coach")).toHaveTextContent("Institutional Trading AI Coach");
    expect(screen.getByTestId("badge-trading-coach-page-educational")).toHaveTextContent("Educational");
    expect(screen.getByTestId("badge-trading-coach-page-deterministic")).toHaveTextContent("Deterministic");
    expect(screen.getByTestId("badge-trading-coach-page-evidence-based")).toHaveTextContent("Evidence Based");
    expect(screen.getByTestId("text-trading-coach-no-symbol")).toBeInTheDocument();
  });

  it("searching a symbol renders the Learning Panel and Evidence Explorer", async () => {
    mockState.explanation = { data: fixtureExplanation(), isLoading: false, isError: false };
    renderWithClient(<TradingAICoach />);

    await userEvent.type(screen.getByTestId("input-trading-coach-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-trading-coach-search"));

    expect(screen.getByTestId("card-trading-coach-learning-panel")).toBeInTheDocument();
    expect(screen.getByTestId("text-trading-coach-page-headline")).toHaveTextContent("AAPL reads uptrend");
    expect(screen.getByTestId("card-trading-coach-evidence-explorer")).toBeInTheDocument();
    expect(screen.getByTestId("list-trading-coach-metrics-used")).toHaveTextContent("1D trend");
    expect(screen.getByTestId("list-trading-coach-supporting-evidence")).toHaveTextContent("1D support zone");
  });

  it("shows an honest error message when the explanation fails to load", async () => {
    mockState.explanation = { data: undefined, isLoading: false, isError: true };
    renderWithClient(<TradingAICoach />);

    await userEvent.type(screen.getByTestId("input-trading-coach-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-trading-coach-search"));

    expect(screen.getByTestId("text-trading-coach-page-error")).toBeInTheDocument();
  });

  it("switching coach tabs updates which coach is requested", async () => {
    mockState.explanation = { data: fixtureExplanation({ coachLabel: "Liquidity Coach", headline: "AAPL liquidity reading" }), isLoading: false, isError: false };
    renderWithClient(<TradingAICoach />);

    await userEvent.type(screen.getByTestId("input-trading-coach-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-trading-coach-search"));
    await userEvent.click(screen.getByTestId("tab-trading-coach-liquidity"));

    expect(screen.getByTestId("card-trading-coach-learning-panel")).toHaveTextContent("Liquidity Coach");
  });

  it("the Journal Coach tab reads account-wide (no symbol required)", async () => {
    mockState.explanation = { data: fixtureExplanation({ coach: "journal", coachLabel: "Journal Coach", symbol: null, headline: "2 journal entries recorded." }), isLoading: false, isError: false };
    renderWithClient(<TradingAICoach />);

    await userEvent.click(screen.getByTestId("tab-trading-coach-journal"));

    expect(screen.getByTestId("card-trading-coach-learning-panel")).toHaveTextContent("2 journal entries recorded.");
  });

  it("the Scenario Coach tab shows a scenario-input form and never auto-fetches a symbol-scoped explanation", async () => {
    renderWithClient(<TradingAICoach />);

    await userEvent.click(screen.getByTestId("tab-trading-coach-scenario"));

    expect(screen.getByTestId("card-trading-scenario-coach")).toBeInTheDocument();
    expect(screen.getByTestId("row-trading-coach-scenario-0")).toBeInTheDocument();
    expect(screen.getByTestId("row-trading-coach-scenario-1")).toBeInTheDocument();
  });

  it("submitting 2 filled-in scenarios calls the scenario mutation with the entered values", async () => {
    renderWithClient(<TradingAICoach />);
    await userEvent.click(screen.getByTestId("tab-trading-coach-scenario"));

    await userEvent.type(screen.getByTestId("input-trading-coach-scenario-entry-0"), "150");
    await userEvent.type(screen.getByTestId("input-trading-coach-scenario-stop-0"), "148");
    await userEvent.type(screen.getByTestId("input-trading-coach-scenario-target-0"), "160");
    await userEvent.type(screen.getByTestId("input-trading-coach-scenario-entry-1"), "150");
    await userEvent.type(screen.getByTestId("input-trading-coach-scenario-stop-1"), "130");
    await userEvent.type(screen.getByTestId("input-trading-coach-scenario-target-1"), "160");
    await userEvent.click(screen.getByTestId("button-trading-coach-explain-scenarios"));

    expect(mockState.scenarioMutate).toHaveBeenCalledTimes(1);
    const call = mockState.scenarioMutate.mock.calls[0][0];
    expect(call.data.scenarios).toHaveLength(2);
    expect(call.data.scenarios[0].entryPrice).toBe(150);
  });

  it("Guided Learning Mode lists the Institutional Trading Engine's own topics with progress checkmarks", () => {
    renderWithClient(<TradingAICoach />);

    const list = screen.getByTestId("list-trading-coach-guided-learning-topics");
    expect(list).toHaveTextContent("Market Structure");
    expect(list).toHaveTextContent("Risk Management");
  });

  it("Progress Tracker shows coaches viewed and the Trading Engine path's completion", () => {
    renderWithClient(<TradingAICoach />);

    expect(screen.getByTestId("text-trading-coach-progress-coaches-viewed")).toHaveTextContent("4");
    expect(screen.getByTestId("text-trading-coach-progress-path-percent")).toHaveTextContent("1/8");
  });

  it("never fabricates content — the disclaimer is always the exact server-provided string", async () => {
    mockState.explanation = { data: fixtureExplanation(), isLoading: false, isError: false };
    renderWithClient(<TradingAICoach />);

    await userEvent.type(screen.getByTestId("input-trading-coach-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-trading-coach-search"));

    expect(screen.getByText(/Never creates a trading signal/)).toBeInTheDocument();
  });
});
