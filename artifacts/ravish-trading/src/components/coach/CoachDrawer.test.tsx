// Phase 21 — Institutional AI Coach & Education Platform. Frontend smoke
// tests for the reusable Explanation Drawer, mirroring
// InstitutionalMentor.test.tsx's/DecisionEngine.test.tsx's own established
// mocked-generated-hook pattern.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

type HookResult = { data: unknown; isLoading?: boolean; isError?: boolean };

const mockState = vi.hoisted(() => ({
  explanation: { data: undefined as unknown, isLoading: false, isError: false } as HookResult,
}));

const recordViewedMock = vi.hoisted(() => vi.fn());

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
    useRecordLearningItemViewed: () => ({ mutate: recordViewedMock }),
  };
});

import { CoachDrawer } from "./CoachDrawer";

function fixtureExplanation(overrides: Record<string, unknown> = {}) {
  return {
    coach: "investment",
    coachLabel: "Investment Coach",
    symbol: "AAPL",
    headline: "AAPL: Buy — confidence 82/100",
    whyThisExists: "Investment Committee votes Buy, and the synthesis score clears the high-conviction bar.",
    metricsUsed: [{ label: "Business Quality", detail: "78/100 (Good)", source: "Business Quality Engine" }],
    supportingEvidence: [{ label: "Economic Moat", detail: "Wide moat.", source: "Decision Engine — Supporting Evidence" }],
    risksReducingConfidence: ["Some risk factor."],
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

describe("CoachDrawer", () => {
  beforeEach(() => {
    mockState.explanation = { data: undefined, isLoading: false, isError: false };
    recordViewedMock.mockReset();
  });

  it("renders the default trigger and opens the drawer with permanent labels on click", async () => {
    mockState.explanation = { data: fixtureExplanation(), isLoading: false, isError: false };
    renderWithClient(<CoachDrawer symbol="AAPL" coach="investment" />);

    const trigger = screen.getByTestId("button-open-coach-drawer-investment");
    await userEvent.click(trigger);

    expect(screen.getByTestId("sheet-coach-drawer")).toBeInTheDocument();
    expect(screen.getByTestId("badge-coach-permanent-label")).toHaveTextContent("Institutional AI Coach");
    expect(screen.getByTestId("text-coach-drawer-title")).toHaveTextContent("Investment Coach — AAPL");
  });

  it("records the view when opened", async () => {
    mockState.explanation = { data: fixtureExplanation(), isLoading: false, isError: false };
    renderWithClient(<CoachDrawer symbol="AAPL" coach="investment" />);
    await userEvent.click(screen.getByTestId("button-open-coach-drawer-investment"));

    expect(recordViewedMock).toHaveBeenCalledWith({ data: { itemType: "coach", itemKey: "investment:AAPL" } });
  });

  it("shows a loading skeleton while the explanation is loading", async () => {
    mockState.explanation = { data: undefined, isLoading: true, isError: false };
    renderWithClient(<CoachDrawer symbol="AAPL" coach="investment" />);
    await userEvent.click(screen.getByTestId("button-open-coach-drawer-investment"));

    expect(screen.getByTestId("text-coach-loading")).toBeInTheDocument();
  });

  it("shows an honest error message when the explanation fails to load", async () => {
    mockState.explanation = { data: undefined, isLoading: false, isError: true };
    renderWithClient(<CoachDrawer symbol="AAPL" coach="investment" />);
    await userEvent.click(screen.getByTestId("button-open-coach-drawer-investment"));

    expect(screen.getByTestId("text-coach-error")).toBeInTheDocument();
  });

  it("defaults to the 'What does this mean?' view, showing why this exists", async () => {
    mockState.explanation = { data: fixtureExplanation(), isLoading: false, isError: false };
    renderWithClient(<CoachDrawer symbol="AAPL" coach="investment" />);
    await userEvent.click(screen.getByTestId("button-open-coach-drawer-investment"));

    expect(screen.getByTestId("text-coach-headline")).toHaveTextContent("AAPL: Buy — confidence 82/100");
    expect(screen.getByTestId("section-coach-why")).toHaveTextContent("Investment Committee votes Buy");
  });

  it("'Show the evidence' reveals metrics used, supporting evidence, risks, and strengths", async () => {
    mockState.explanation = { data: fixtureExplanation(), isLoading: false, isError: false };
    renderWithClient(<CoachDrawer symbol="AAPL" coach="investment" />);
    await userEvent.click(screen.getByTestId("button-open-coach-drawer-investment"));
    await userEvent.click(screen.getByTestId("button-coach-quick-action-evidence"));

    expect(within(screen.getByTestId("section-coach-metrics")).getAllByText(/Business Quality/).length).toBeGreaterThan(0);
    expect(within(screen.getByTestId("section-coach-supporting-evidence")).getByText(/Economic Moat/)).toBeInTheDocument();
    expect(screen.getByTestId("section-coach-risks")).toHaveTextContent("Some risk factor.");
    expect(screen.getByTestId("section-coach-strengths")).toHaveTextContent("Strong ROIC.");
  });

  it("'Teach me' reveals how-to-interpret, common mistakes, and the institutional perspective", async () => {
    mockState.explanation = { data: fixtureExplanation(), isLoading: false, isError: false };
    renderWithClient(<CoachDrawer symbol="AAPL" coach="investment" />);
    await userEvent.click(screen.getByTestId("button-open-coach-drawer-investment"));
    await userEvent.click(screen.getByTestId("button-coach-quick-action-teach"));

    expect(screen.getByTestId("section-coach-how-to-interpret")).toHaveTextContent("recommendation ladder");
    expect(screen.getByTestId("section-coach-mistakes")).toHaveTextContent("Treating a single rating");
    expect(screen.getByTestId("section-coach-institutional-perspective")).toHaveTextContent("cross-check quality");
  });

  it("'Show calculation sources' reveals the named source modules", async () => {
    mockState.explanation = { data: fixtureExplanation(), isLoading: false, isError: false };
    renderWithClient(<CoachDrawer symbol="AAPL" coach="investment" />);
    await userEvent.click(screen.getByTestId("button-open-coach-drawer-investment"));
    await userEvent.click(screen.getByTestId("button-coach-quick-action-sources"));

    expect(screen.getByTestId("section-coach-sources")).toHaveTextContent("Business Quality Engine");
    expect(screen.getByTestId("section-coach-sources")).toHaveTextContent("Decision Engine");
  });

  it("switching the coach type via the selector updates the drawer title", async () => {
    mockState.explanation = { data: fixtureExplanation(), isLoading: false, isError: false };
    renderWithClient(<CoachDrawer symbol="AAPL" coach="investment" />);
    await userEvent.click(screen.getByTestId("button-open-coach-drawer-investment"));

    await userEvent.click(screen.getByTestId("select-coach-type"));
    await userEvent.click(await screen.findByText("Valuation Coach"));

    expect(screen.getByTestId("text-coach-drawer-title")).toHaveTextContent("Valuation Coach — AAPL");
  });

  it("never fabricates content — the disclaimer is always the exact server-provided string", async () => {
    mockState.explanation = { data: fixtureExplanation(), isLoading: false, isError: false };
    renderWithClient(<CoachDrawer symbol="AAPL" coach="investment" />);
    await userEvent.click(screen.getByTestId("button-open-coach-drawer-investment"));

    expect(screen.getByText(/Never invents a recommendation/)).toBeInTheDocument();
  });
});
