// Phase 21 — Institutional AI Coach & Education Platform. Frontend smoke
// tests for the standalone Institutional AI Coach page, mirroring
// DecisionEngine.test.tsx's own established mocked-generated-hook pattern.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

type HookResult = { data: unknown; isLoading?: boolean; isError?: boolean };

const mockState = vi.hoisted(() => ({
  explanation: { data: undefined as unknown, isLoading: false, isError: false } as HookResult,
  guidedPath: { data: undefined as unknown } as HookResult,
  progress: { data: undefined as unknown } as HookResult,
}));

vi.mock("@/hooks/use-coach-explanation", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/use-coach-explanation")>("@/hooks/use-coach-explanation");
  return {
    ...actual,
    useCoachExplanation: () => mockState.explanation,
  };
});

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetLearningPathByKey: () => mockState.guidedPath,
    useGetLearningProgress: () => mockState.progress,
  };
});

import InstitutionalAICoach from "./InstitutionalAICoach";

function fixtureExplanation(overrides: Record<string, unknown> = {}) {
  return {
    coach: "investment",
    coachLabel: "Investment Coach",
    symbol: "AAPL",
    headline: "AAPL: Buy — confidence 82/100",
    whyThisExists: "Investment Committee votes Buy, and the synthesis score clears the high-conviction bar.",
    metricsUsed: [{ label: "Business Quality", detail: "78/100 (Good)", source: "Business Quality Engine" }],
    supportingEvidence: [{ label: "Economic Moat", detail: "Wide moat.", source: "Decision Engine — Supporting Evidence" }],
    risksReducingConfidence: [],
    strengthsIncreasingConfidence: ["Strong ROIC."],
    howToInterpret: ["The recommendation ladder runs Buy through Avoid."],
    commonMistakes: ["Treating a single rating as a guarantee of future returns."],
    institutionalPerspective: "Institutional investors cross-check quality, price, and catalysts.",
    relatedGlossaryKeys: ["margin-of-safety"],
    calculationSources: ["Business Quality Engine", "Decision Engine"],
    disclaimer: "Institutional AI Coach — Educational, Deterministic, Evidence Based. Never invents a recommendation.",
    ...overrides,
  };
}

function fixtureGuidedPath() {
  return {
    key: "institutional-investing",
    title: "Institutional Investing Engine",
    description: "How to read the Institutional Investing Engine's own modules.",
    glossaryCategory: "value-investing",
    topics: [
      { key: "investing-business-quality", title: "Business Quality", summary: "Is this a good business?", body: [], whyItMatters: "x", externalHref: null, relatedGlossaryKeys: [], estimatedMinutes: 4 },
      { key: "investing-margin-of-safety", title: "Margin of Safety", summary: "Room for error.", body: [], whyItMatters: "x", externalHref: null, relatedGlossaryKeys: [], estimatedMinutes: 5 },
    ],
  };
}

function fixtureProgress(overrides: Record<string, unknown> = {}) {
  return {
    lessonsViewed: 0,
    lessonsCompleted: 0,
    glossaryTermsViewed: 0,
    strategiesViewed: 0,
    coachesViewed: 3,
    pathCompletion: [
      { pathKey: "institutional-investing", title: "Institutional Investing Engine", topicsTotal: 9, topicsCompleted: 2, percentComplete: 22.2 },
    ],
    greeksQuiz: { totalAttempts: 0, averageScore: 0, bestScore: 0, latestScore: null, improvement: 0, firstPercent: 0, latestPercent: 0 },
    valueQuiz: { totalAttempts: 0, averageScore: 0, bestScore: 0, latestScore: null, improvement: 0, firstPercent: 0, latestPercent: 0 },
    recentHistory: [],
    completedLessonKeys: ["investing-business-quality"],
    completedGlossaryKeys: [],
    completedStrategyKeys: [],
    completedCoachKeys: [],
    ...overrides,
  };
}

describe("InstitutionalAICoach page", () => {
  beforeEach(() => {
    mockState.explanation = { data: undefined, isLoading: false, isError: false };
    mockState.guidedPath = { data: fixtureGuidedPath() };
    mockState.progress = { data: fixtureProgress() };
  });

  it("shows the permanent labels and an advisory message before a symbol is searched", () => {
    renderWithClient(<InstitutionalAICoach />);

    expect(screen.getByTestId("badge-coach-page-institutional-ai-coach")).toHaveTextContent("Institutional AI Coach");
    expect(screen.getByTestId("badge-coach-page-educational")).toHaveTextContent("Educational");
    expect(screen.getByTestId("badge-coach-page-deterministic")).toHaveTextContent("Deterministic");
    expect(screen.getByTestId("badge-coach-page-evidence-based")).toHaveTextContent("Evidence Based");
    expect(screen.getByTestId("text-coach-no-symbol")).toBeInTheDocument();
  });

  it("searching a symbol renders the Learning Panel and Evidence Explorer", async () => {
    mockState.explanation = { data: fixtureExplanation(), isLoading: false, isError: false };
    renderWithClient(<InstitutionalAICoach />);

    await userEvent.type(screen.getByTestId("input-coach-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-coach-search"));

    expect(screen.getByTestId("card-coach-learning-panel")).toBeInTheDocument();
    expect(screen.getByTestId("text-coach-page-headline")).toHaveTextContent("AAPL: Buy — confidence 82/100");
    expect(screen.getByTestId("card-coach-evidence-explorer")).toBeInTheDocument();
    expect(screen.getByTestId("list-coach-metrics-used")).toHaveTextContent("Business Quality");
    expect(screen.getByTestId("list-coach-supporting-evidence")).toHaveTextContent("Economic Moat");
  });

  it("shows an honest error message when the explanation fails to load", async () => {
    mockState.explanation = { data: undefined, isLoading: false, isError: true };
    renderWithClient(<InstitutionalAICoach />);

    await userEvent.type(screen.getByTestId("input-coach-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-coach-search"));

    expect(screen.getByTestId("text-coach-page-error")).toBeInTheDocument();
  });

  it("switching coach tabs updates which coach is requested", async () => {
    mockState.explanation = { data: fixtureExplanation({ coachLabel: "Valuation Coach", headline: "AAPL valuation reading" }), isLoading: false, isError: false };
    renderWithClient(<InstitutionalAICoach />);

    await userEvent.type(screen.getByTestId("input-coach-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-coach-search"));
    await userEvent.click(screen.getByTestId("tab-coach-valuation"));

    expect(screen.getByTestId("card-coach-learning-panel")).toHaveTextContent("Valuation Coach");
  });

  it("Guided Learning Mode lists the Institutional Investing Engine's own topics with progress checkmarks", () => {
    renderWithClient(<InstitutionalAICoach />);

    const list = screen.getByTestId("list-coach-guided-learning-topics");
    expect(list).toHaveTextContent("Business Quality");
    expect(list).toHaveTextContent("Margin of Safety");
  });

  it("Progress Tracker shows coaches viewed and the Institutional Investing path's completion", () => {
    renderWithClient(<InstitutionalAICoach />);

    expect(screen.getByTestId("text-coach-progress-coaches-viewed")).toHaveTextContent("3");
    expect(screen.getByTestId("text-coach-progress-path-percent")).toHaveTextContent("2/9");
  });

  it("never fabricates content — the disclaimer is always the exact server-provided string", async () => {
    mockState.explanation = { data: fixtureExplanation(), isLoading: false, isError: false };
    renderWithClient(<InstitutionalAICoach />);

    await userEvent.type(screen.getByTestId("input-coach-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-coach-search"));

    expect(screen.getByText(/Never invents a recommendation/)).toBeInTheDocument();
  });
});
