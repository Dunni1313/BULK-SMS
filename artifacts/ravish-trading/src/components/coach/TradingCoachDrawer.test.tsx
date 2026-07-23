// Phase 29 — Institutional Trading AI Coach. Frontend smoke tests for the
// reusable Evidence Explorer drawer, mirroring Phase 21's own
// CoachDrawer.test.tsx pattern exactly.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

type HookResult = { data: unknown; isLoading?: boolean; isError?: boolean };

const mockState = vi.hoisted(() => ({
  explanation: { data: undefined as unknown, isLoading: false, isError: false } as HookResult,
}));

const recordViewedMock = vi.hoisted(() => vi.fn());

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
    useRecordLearningItemViewed: () => ({ mutate: recordViewedMock }),
  };
});

import { TradingCoachDrawer } from "./TradingCoachDrawer";

function fixtureExplanation(overrides: Record<string, unknown> = {}) {
  return {
    coach: "structure",
    coachLabel: "Structure Coach",
    symbol: "AAPL",
    headline: "AAPL reads uptrend with unanimous agreement across 3 timeframes.",
    whyThisExists: "Market Structure classifies trend from swing highs/lows detected in real candle data.",
    metricsUsed: [{ label: "1D trend", detail: "uptrend (High confidence)", source: "Market Structure Engine" }],
    supportingEvidence: [{ label: "1D support zone", detail: "@ 148 — 3 swing touch(es)", source: "Market Structure Engine" }],
    risksReducingConfidence: ["Some risk factor."],
    strengthsIncreasingConfidence: ["All 3 reviewed timeframes agree on uptrend trend."],
    howToInterpret: ["A support/resistance zone's strength is how many separate swing touches clustered near that price."],
    commonMistakes: ["Treating a single timeframe's trend as the whole picture."],
    institutionalPerspective: "Institutional desks routinely require multi-timeframe confluence.",
    relatedGlossaryKeys: ["market-structure"],
    calculationSources: ["Market Structure Engine (Sprint 33)"],
    disclaimer: "Institutional Trading AI Coach — Educational, Deterministic, Evidence Based. Never creates a trading signal.",
    ...overrides,
  };
}

describe("TradingCoachDrawer", () => {
  beforeEach(() => {
    mockState.explanation = { data: undefined, isLoading: false, isError: false };
    recordViewedMock.mockReset();
  });

  it("renders the default trigger and opens the drawer with permanent labels on click", async () => {
    mockState.explanation = { data: fixtureExplanation(), isLoading: false, isError: false };
    renderWithClient(<TradingCoachDrawer symbol="AAPL" coach="structure" />);

    const trigger = screen.getByTestId("button-open-trading-coach-drawer-structure");
    await userEvent.click(trigger);

    expect(screen.getByTestId("sheet-trading-coach-drawer")).toBeInTheDocument();
    expect(screen.getByTestId("badge-trading-coach-permanent-label")).toHaveTextContent("Institutional Trading AI Coach");
    expect(screen.getByTestId("text-trading-coach-drawer-title")).toHaveTextContent("Structure Coach — AAPL");
  });

  it("records the view when opened, keyed by coach:symbol", async () => {
    mockState.explanation = { data: fixtureExplanation(), isLoading: false, isError: false };
    renderWithClient(<TradingCoachDrawer symbol="AAPL" coach="structure" />);
    await userEvent.click(screen.getByTestId("button-open-trading-coach-drawer-structure"));

    expect(recordViewedMock).toHaveBeenCalledWith({ data: { itemType: "coach", itemKey: "structure:AAPL" } });
  });

  it("records the view keyed by coach:account for an account-scoped coach, never fabricating a symbol", async () => {
    mockState.explanation = { data: fixtureExplanation({ coach: "journal", coachLabel: "Journal Coach", symbol: null }), isLoading: false, isError: false };
    renderWithClient(<TradingCoachDrawer symbol="AAPL" coach="journal" />);
    await userEvent.click(screen.getByTestId("button-open-trading-coach-drawer-journal"));

    expect(recordViewedMock).toHaveBeenCalledWith({ data: { itemType: "coach", itemKey: "journal:account" } });
    expect(screen.getByTestId("text-trading-coach-drawer-title")).toHaveTextContent("Journal Coach");
    expect(screen.getByTestId("text-trading-coach-drawer-title")).not.toHaveTextContent("AAPL");
  });

  it("shows a loading skeleton while the explanation is loading", async () => {
    mockState.explanation = { data: undefined, isLoading: true, isError: false };
    renderWithClient(<TradingCoachDrawer symbol="AAPL" coach="structure" />);
    await userEvent.click(screen.getByTestId("button-open-trading-coach-drawer-structure"));

    expect(screen.getByTestId("text-trading-coach-loading")).toBeInTheDocument();
  });

  it("shows an honest error message when the explanation fails to load", async () => {
    mockState.explanation = { data: undefined, isLoading: false, isError: true };
    renderWithClient(<TradingCoachDrawer symbol="AAPL" coach="structure" />);
    await userEvent.click(screen.getByTestId("button-open-trading-coach-drawer-structure"));

    expect(screen.getByTestId("text-trading-coach-error")).toBeInTheDocument();
  });

  it("defaults to the 'What does this mean?' view, showing why this exists", async () => {
    mockState.explanation = { data: fixtureExplanation(), isLoading: false, isError: false };
    renderWithClient(<TradingCoachDrawer symbol="AAPL" coach="structure" />);
    await userEvent.click(screen.getByTestId("button-open-trading-coach-drawer-structure"));

    expect(screen.getByTestId("text-trading-coach-headline")).toHaveTextContent("AAPL reads uptrend");
    expect(screen.getByTestId("section-trading-coach-why")).toHaveTextContent("Market Structure classifies trend");
  });

  it("'Show the evidence' reveals metrics used, supporting evidence, risks, and strengths", async () => {
    mockState.explanation = { data: fixtureExplanation(), isLoading: false, isError: false };
    renderWithClient(<TradingCoachDrawer symbol="AAPL" coach="structure" />);
    await userEvent.click(screen.getByTestId("button-open-trading-coach-drawer-structure"));
    await userEvent.click(screen.getByTestId("button-trading-coach-quick-action-evidence"));

    expect(within(screen.getByTestId("section-trading-coach-metrics")).getAllByText(/1D trend/).length).toBeGreaterThan(0);
    expect(within(screen.getByTestId("section-trading-coach-supporting-evidence")).getByText(/1D support zone/)).toBeInTheDocument();
    expect(screen.getByTestId("section-trading-coach-risks")).toHaveTextContent("Some risk factor.");
    expect(screen.getByTestId("section-trading-coach-strengths")).toHaveTextContent("All 3 reviewed timeframes agree");
  });

  it("'Teach me' reveals how-to-interpret, common mistakes, and the institutional perspective", async () => {
    mockState.explanation = { data: fixtureExplanation(), isLoading: false, isError: false };
    renderWithClient(<TradingCoachDrawer symbol="AAPL" coach="structure" />);
    await userEvent.click(screen.getByTestId("button-open-trading-coach-drawer-structure"));
    await userEvent.click(screen.getByTestId("button-trading-coach-quick-action-teach"));

    expect(screen.getByTestId("section-trading-coach-how-to-interpret")).toHaveTextContent("swing touches clustered");
    expect(screen.getByTestId("section-trading-coach-mistakes")).toHaveTextContent("Treating a single timeframe's trend");
    expect(screen.getByTestId("section-trading-coach-institutional-perspective")).toHaveTextContent("multi-timeframe confluence");
  });

  it("'Show calculation sources' reveals the named source modules", async () => {
    mockState.explanation = { data: fixtureExplanation(), isLoading: false, isError: false };
    renderWithClient(<TradingCoachDrawer symbol="AAPL" coach="structure" />);
    await userEvent.click(screen.getByTestId("button-open-trading-coach-drawer-structure"));
    await userEvent.click(screen.getByTestId("button-trading-coach-quick-action-sources"));

    expect(screen.getByTestId("section-trading-coach-sources")).toHaveTextContent("Market Structure Engine");
  });

  it("switching the coach type via the selector updates the drawer title", async () => {
    mockState.explanation = { data: fixtureExplanation(), isLoading: false, isError: false };
    renderWithClient(<TradingCoachDrawer symbol="AAPL" coach="structure" />);
    await userEvent.click(screen.getByTestId("button-open-trading-coach-drawer-structure"));

    await userEvent.click(screen.getByTestId("select-trading-coach-type"));
    await userEvent.click(await screen.findByText("Liquidity Coach"));

    expect(screen.getByTestId("text-trading-coach-drawer-title")).toHaveTextContent("Liquidity Coach — AAPL");
  });

  it("never fabricates content — the disclaimer is always the exact server-provided string", async () => {
    mockState.explanation = { data: fixtureExplanation(), isLoading: false, isError: false };
    renderWithClient(<TradingCoachDrawer symbol="AAPL" coach="structure" />);
    await userEvent.click(screen.getByTestId("button-open-trading-coach-drawer-structure"));

    expect(screen.getByText(/Never creates a trading signal/)).toBeInTheDocument();
  });
});
