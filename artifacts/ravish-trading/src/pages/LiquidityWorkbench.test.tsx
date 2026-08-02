// Phase 27 — Institutional Liquidity & Session Workbench. Follows the exact
// mocked-generated-hook pattern MarketStructureWorkbench.test.tsx /
// TradeWorkspace.test.tsx already established, plus the same wouter
// useSearch/useLocation deep-link mock.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const searchMock = vi.hoisted(() => ({ value: "" }));
const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useSearch: () => searchMock.value,
    useLocation: () => ["/liquidity-workbench", navigateMock],
  };
});

const streamCoachMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach-stream", () => ({
  streamCoach: streamCoachMock,
}));

type HookResult = { data: unknown; isLoading?: boolean };

const createTradePlanMutate = vi.fn();
const createNoteMutate = vi.fn();
const deleteNoteMutate = vi.fn();

const mockState = vi.hoisted(() => ({
  structure: { data: undefined } as HookResult,
  session: { data: undefined } as HookResult,
  sessionWindows: { data: undefined, isLoading: false } as HookResult,
  liquidity: { data: undefined, isLoading: false } as HookResult,
  liquidityTimeline: { data: undefined } as HookResult,
  tradePlans: { data: [] as unknown[] } as HookResult,
  workspaceNotes: { data: [] as unknown[] } as HookResult,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetTradingStructure: () => mockState.structure,
    useGetTradingSession: () => mockState.session,
    useGetTradingSessionWindows: () => mockState.sessionWindows,
    useGetTradingLiquidity: () => mockState.liquidity,
    useGetTradingLiquidityTimeline: () => mockState.liquidityTimeline,
    useListTradingTradePlansForSymbol: () => mockState.tradePlans,
    useCreateTradingTradePlan: () => ({ mutate: createTradePlanMutate, isPending: false }),
    useListTradingWorkspaceNotesForSymbol: () => mockState.workspaceNotes,
    useCreateTradingWorkspaceNote: () => ({ mutate: createNoteMutate, isPending: false }),
    useDeleteTradingWorkspaceNote: () => ({ mutate: deleteNoteMutate, isPending: false }),
  };
});

import LiquidityWorkbench from "./LiquidityWorkbench";

function resetMockState() {
  searchMock.value = "";
  mockState.structure = { data: undefined };
  mockState.session = { data: undefined };
  mockState.sessionWindows = { data: undefined, isLoading: false };
  mockState.liquidity = { data: undefined, isLoading: false };
  mockState.liquidityTimeline = { data: undefined };
  mockState.tradePlans = { data: [] };
  mockState.workspaceNotes = { data: [] };
}

function liquidityAnalysis(over: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    interval: "1D",
    dataSource: "SIMULATED",
    candleCount: 90,
    currentPrice: 195.5,
    volumeProfile: [
      { price: 190, volumeAtPrice: 500000, pctOfTotal: 22.5 },
      { price: 200, volumeAtPrice: 300000, pctOfTotal: 13.5 },
    ],
    avgDollarVolume: 50_000_000,
    liquidityScore: 90,
    liquidityBand: "High",
    buySellPressure: { direction: "buying", buyPct: 62, sellPct: 38 },
    confidenceLevel: "High",
    confidenceExplanation: "Plenty of volume",
    summary: "AAPL is highly liquid with buying pressure.",
    ...over,
  };
}

function sessionWindowsOverview(over: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    asOf: "2026-01-01T14:00:00.000Z",
    dataSource: "SIMULATED",
    activeSessionNames: ["london", "new_york"],
    overlap: true,
    sessions: [
      {
        name: "sydney",
        label: "Sydney",
        role: "other",
        isActive: false,
        startIso: "2025-12-31T21:00:00.000Z",
        endIso: "2026-01-01T06:00:00.000Z",
        nextStartIso: "2026-01-01T21:00:00.000Z",
        durationHours: 9,
        high: null,
        low: null,
        range: null,
        candleCount: 0,
        freshnessMinutes: null,
      },
      {
        name: "tokyo",
        label: "Tokyo",
        role: "other",
        isActive: false,
        startIso: "2026-01-01T00:00:00.000Z",
        endIso: "2026-01-01T09:00:00.000Z",
        nextStartIso: "2026-01-02T00:00:00.000Z",
        durationHours: 9,
        high: null,
        low: null,
        range: null,
        candleCount: 0,
        freshnessMinutes: null,
      },
      {
        name: "london",
        label: "London",
        role: "active",
        isActive: true,
        startIso: "2026-01-01T07:00:00.000Z",
        endIso: "2026-01-01T16:00:00.000Z",
        nextStartIso: "2026-01-02T07:00:00.000Z",
        durationHours: 9,
        high: 201.2,
        low: 193.4,
        range: 7.8,
        candleCount: 7,
        freshnessMinutes: 0,
      },
      {
        name: "new_york",
        label: "New York",
        role: "previous",
        isActive: false,
        startIso: "2025-12-31T12:00:00.000Z",
        endIso: "2025-12-31T21:00:00.000Z",
        nextStartIso: "2026-01-01T12:00:00.000Z",
        durationHours: 9,
        high: 199.0,
        low: 192.0,
        range: 7.0,
        candleCount: 4,
        freshnessMinutes: 300,
      },
    ],
    activeSession: null as unknown,
    previousSession: null as unknown,
    upcomingSession: null as unknown,
    summary: "AAPL: London session is active, overlapping with New York.",
    ...over,
  };
}
// Wire activeSession/previousSession/upcomingSession from the sessions array
// for realism, mirroring the real engine's own selection.
function withSelections(overview: ReturnType<typeof sessionWindowsOverview>) {
  const sessions = overview.sessions as Array<Record<string, unknown>>;
  return {
    ...overview,
    activeSession: sessions.find((s) => s.role === "active") ?? null,
    previousSession: sessions.find((s) => s.role === "previous") ?? null,
    upcomingSession: sessions.find((s) => s.role === "upcoming") ?? sessions.find((s) => s.name === "tokyo") ?? null,
  };
}

function liquidityTimeline(over: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    interval: "1D",
    dataSource: "SIMULATED",
    candleCount: 90,
    points: [
      {
        periodStart: "2025-12-20T00:00:00.000Z",
        periodEnd: "2025-12-25T00:00:00.000Z",
        liquidityBand: "Moderate",
        liquidityScore: 55,
        avgDollarVolume: 20_000_000,
        buySellDirection: "neutral",
        candleCount: 5,
      },
      {
        periodStart: "2025-12-25T00:00:00.000Z",
        periodEnd: "2025-12-30T00:00:00.000Z",
        liquidityBand: "High",
        liquidityScore: 88,
        avgDollarVolume: 48_000_000,
        buySellDirection: "buying",
        candleCount: 5,
      },
    ],
    relativeLiquidity: "Above Average",
    averageLiquidityScore: 71.5,
    keyLiquidityZones: [{ price: 190, volumeAtPrice: 500000, pctOfTotal: 22.5 }],
    summary: "AAPL's liquidity is Above Average relative to its own recent history.",
    ...over,
  };
}

describe("LiquidityWorkbench", () => {
  beforeEach(() => {
    resetMockState();
    navigateMock.mockClear();
    streamCoachMock.mockReset();
    createTradePlanMutate.mockClear();
    createNoteMutate.mockClear();
    deleteNoteMutate.mockClear();
  });

  it("renders the header, permanent labels, and an advisory message before an instrument is selected", () => {
    renderWithClient(<LiquidityWorkbench />);
    expect(screen.getByText("Liquidity & Session Workbench")).toBeInTheDocument();
    const labels = screen.getByTestId("workbench-permanent-labels");
    expect(labels).toHaveTextContent("Advisory Only");
    expect(screen.getByText(/Select an instrument above to begin/)).toBeInTheDocument();
  });

  it("selecting an instrument navigates to the workbench's own deep-link URL", async () => {
    renderWithClient(<LiquidityWorkbench />);
    // ResizablePanelGroup registers document-level listeners that interfere
    // with userEvent's key-by-key typing simulation — fireEvent.change sets
    // the value directly instead, per the established precedent.
    fireEvent.change(screen.getByTestId("workbench-symbol-search"), { target: { value: "AAPL" } });
    await userEvent.click(screen.getByTestId("workbench-symbol-search-submit"));
    expect(navigateMock).toHaveBeenCalledWith("/liquidity-workbench?symbol=AAPL");
  });

  it("auto-loads an instrument from a ?symbol= deep link and renders the Liquidity Overview", () => {
    searchMock.value = "symbol=AAPL";
    mockState.liquidity = { data: liquidityAnalysis(), isLoading: false };
    renderWithClient(<LiquidityWorkbench />);

    const overview = screen.getByTestId("panel-liquidity-overview");
    expect(overview).toHaveTextContent("High liquidity");
    expect(overview).toHaveTextContent("buying");
    expect(screen.getByTestId("link-open-trading-research")).toHaveAttribute(
      "href",
      "/trading-research?symbol=AAPL",
    );
  });

  it("renders the Session Overview from the existing Session Service, reused unmodified", () => {
    searchMock.value = "symbol=AAPL";
    mockState.session = {
      data: { symbol: "AAPL", asOf: "2026-01-01T14:00:00.000Z", activeSessions: ["london", "new_york"], sessionHigh: 201, sessionLow: 193 },
    };
    mockState.sessionWindows = { data: sessionWindowsOverview({ overlap: true }), isLoading: false };
    renderWithClient(<LiquidityWorkbench />);

    const panel = screen.getByTestId("panel-session-overview");
    expect(panel).toHaveTextContent("london");
    expect(panel).toHaveTextContent("new york");
    expect(panel).toHaveTextContent("overlap");
    expect(panel).toHaveTextContent("Today's range");
  });

  it("renders the Active Session Summary and Previous Session Summary from Session Windows", () => {
    searchMock.value = "symbol=AAPL";
    mockState.sessionWindows = { data: withSelections(sessionWindowsOverview()), isLoading: false };
    renderWithClient(<LiquidityWorkbench />);

    const active = screen.getByTestId("panel-active-session-summary");
    expect(active).toHaveTextContent("London");
    expect(active).toHaveTextContent("Duration: 9h");

    const previous = screen.getByTestId("panel-previous-session-summary");
    expect(previous).toHaveTextContent("New York");
    expect(previous).toHaveTextContent("300 min ago");
  });

  it("honestly shows no-candle-data for Sydney/Tokyo sessions with a disclosed reason, never fabricating a range", () => {
    searchMock.value = "symbol=AAPL";
    mockState.sessionWindows = { data: withSelections(sessionWindowsOverview()), isLoading: false };
    renderWithClient(<LiquidityWorkbench />);

    expect(screen.getByTestId("row-session-sydney")).toHaveTextContent("no candle data");
    expect(screen.getByTestId("row-session-tokyo")).toHaveTextContent("no candle data");
    expect(screen.getByTestId("row-session-london")).toHaveTextContent("193.40");
  });

  it("renders the Buy / Sell Pressure Summary from the existing Liquidity Engine", () => {
    searchMock.value = "symbol=AAPL";
    mockState.liquidity = { data: liquidityAnalysis({ buySellPressure: { direction: "selling", buyPct: 30, sellPct: 70 } }), isLoading: false };
    renderWithClient(<LiquidityWorkbench />);

    const panel = screen.getByTestId("panel-buy-sell-pressure");
    expect(panel).toHaveTextContent("selling");
    expect(panel).toHaveTextContent("30% buy");
    expect(panel).toHaveTextContent("70% sell");
  });

  it("renders the Liquidity Band Explorer with the Relative Liquidity comparison, never a new score", () => {
    searchMock.value = "symbol=AAPL";
    mockState.liquidity = { data: liquidityAnalysis(), isLoading: false };
    mockState.liquidityTimeline = { data: liquidityTimeline({ relativeLiquidity: "Above Average" }) };
    renderWithClient(<LiquidityWorkbench />);

    const panel = screen.getByTestId("panel-liquidity-band-explorer");
    expect(panel).toHaveTextContent("Current: High");
    expect(screen.getByTestId("badge-relative-liquidity")).toHaveTextContent("Above Average");
  });

  it("renders the Volume Profile Summary from the Liquidity Engine's own volume profile", () => {
    searchMock.value = "symbol=AAPL";
    mockState.liquidity = { data: liquidityAnalysis(), isLoading: false };
    renderWithClient(<LiquidityWorkbench />);

    expect(screen.getByTestId("row-volume-level-0")).toHaveTextContent("22.5% of volume");
    expect(screen.getByTestId("row-volume-level-1")).toHaveTextContent("13.5% of volume");
  });

  it("shows an honest empty message when the volume profile has no repeated level", () => {
    searchMock.value = "symbol=AAPL";
    mockState.liquidity = { data: liquidityAnalysis({ volumeProfile: [] }), isLoading: false };
    renderWithClient(<LiquidityWorkbench />);

    expect(screen.getByTestId("panel-volume-profile-summary")).toHaveTextContent(
      "No repeated volume level detected in this sample.",
    );
  });

  it("renders the Session Comparison table across all 4 named sessions", () => {
    searchMock.value = "symbol=AAPL";
    mockState.sessionWindows = { data: withSelections(sessionWindowsOverview()), isLoading: false };
    renderWithClient(<LiquidityWorkbench />);

    expect(screen.getByTestId("row-comparison-sydney")).toHaveTextContent("other");
    expect(screen.getByTestId("row-comparison-london")).toHaveTextContent("active");
    expect(screen.getByTestId("row-comparison-new_york")).toHaveTextContent("previous");
    // Sydney has no candle data (candleCount 0, range null) — the table
    // honestly shows an em-dash for range, never a fabricated number.
    expect(screen.getByTestId("row-comparison-sydney")).toHaveTextContent("—");
  });

  it("renders the Liquidity Timeline with its own points and never fabricates when empty", () => {
    searchMock.value = "symbol=AAPL";
    mockState.liquidityTimeline = { data: liquidityTimeline() };
    renderWithClient(<LiquidityWorkbench />);

    expect(screen.getByTestId("row-timeline-point-0")).toHaveTextContent("neutral");
    expect(screen.getByTestId("row-timeline-point-1")).toHaveTextContent("buying");
  });

  it("shows an honest empty message when the Liquidity Timeline has no points", () => {
    searchMock.value = "symbol=AAPL";
    mockState.liquidityTimeline = { data: liquidityTimeline({ points: [] }) };
    renderWithClient(<LiquidityWorkbench />);

    expect(screen.getByTestId("panel-liquidity-timeline")).toHaveTextContent(
      "No liquidity timeline points detected in this sample.",
    );
  });

  it("renders the Evidence Panel from already-computed summary/detail strings across every reused engine", () => {
    searchMock.value = "symbol=AAPL";
    mockState.structure = { data: { trendDetail: "A distinctive structure detail." } };
    mockState.sessionWindows = { data: sessionWindowsOverview({ summary: "A distinctive session windows summary." }), isLoading: false };
    mockState.liquidity = { data: liquidityAnalysis({ summary: "A distinctive liquidity summary." }), isLoading: false };
    mockState.liquidityTimeline = { data: liquidityTimeline({ summary: "A distinctive timeline summary." }) };
    renderWithClient(<LiquidityWorkbench />);

    const evidence = screen.getByTestId("panel-evidence");
    expect(evidence).toHaveTextContent("A distinctive structure detail.");
    expect(evidence).toHaveTextContent("A distinctive session windows summary.");
    expect(evidence).toHaveTextContent("A distinctive liquidity summary.");
    expect(evidence).toHaveTextContent("A distinctive timeline summary.");
  });

  it("Session Notes panel submits a new note scoped to the selected instrument", async () => {
    searchMock.value = "symbol=AAPL";
    renderWithClient(<LiquidityWorkbench />);

    fireEvent.change(screen.getByTestId("input-session-note-text"), { target: { value: "Watching the London/NY overlap." } });
    await userEvent.click(screen.getByTestId("button-save-session-note"));

    expect(createNoteMutate).toHaveBeenCalledWith(
      { data: { symbol: "AAPL", note: "Watching the London/NY overlap." } },
      expect.anything(),
    );
  });

  it("renders saved session notes and lets one be deleted", async () => {
    searchMock.value = "symbol=AAPL";
    mockState.workspaceNotes = { data: [{ id: 5, symbol: "AAPL", note: "Liquidity thinning near the close.", createdAt: "2026-01-01T00:00:00.000Z" }] };
    renderWithClient(<LiquidityWorkbench />);

    expect(screen.getByTestId("row-session-note-5")).toHaveTextContent("Liquidity thinning near the close.");
    await userEvent.click(screen.getByTestId("button-delete-session-note-5"));
    expect(deleteNoteMutate).toHaveBeenCalledWith({ id: 5 }, expect.anything());
  });

  it("Trade Plan Integration pre-fills the thesis from the Liquidity Overview's own summary and links a new plan", async () => {
    searchMock.value = "symbol=AAPL";
    mockState.liquidity = { data: liquidityAnalysis({ summary: "AAPL is highly liquid with buying pressure." }), isLoading: false };
    renderWithClient(<LiquidityWorkbench />);

    expect(screen.getByTestId("input-workbench-plan-thesis")).toHaveValue("AAPL is highly liquid with buying pressure.");

    fireEvent.change(screen.getByTestId("input-workbench-plan-entry"), { target: { value: "196" } });
    fireEvent.change(screen.getByTestId("input-workbench-plan-stop"), { target: { value: "188" } });
    fireEvent.change(screen.getByTestId("input-workbench-plan-target"), { target: { value: "210" } });
    await userEvent.click(screen.getByTestId("button-link-trade-plan"));

    expect(createTradePlanMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          symbol: "AAPL",
          direction: "long",
          thesis: "AAPL is highly liquid with buying pressure.",
          entryPrice: 196,
          stopPrice: 188,
          targetPrice: 210,
        }),
      }),
      expect.anything(),
    );
  });

  it("links out to the Trade Workspace for Risk and Journal, deep-linked to the same instrument", () => {
    searchMock.value = "symbol=AAPL";
    renderWithClient(<LiquidityWorkbench />);
    expect(screen.getByTestId("link-open-trade-workspace")).toHaveAttribute("href", "/trade-workspace?symbol=AAPL");
  });

  it("AI Trading Coach panel streams an answer that explains existing liquidity/session outputs, grounded in the selected instrument", async () => {
    searchMock.value = "symbol=AAPL";
    streamCoachMock.mockImplementation((_url, _body, handlers) => {
      handlers.onDelta("London has the deepest ");
      handlers.onDelta("liquidity right now.");
      handlers.onDone({ answer: "London has the deepest liquidity right now." });
      return Promise.resolve();
    });
    renderWithClient(<LiquidityWorkbench />);

    fireEvent.change(screen.getByTestId("workbench-coach-input"), { target: { value: "Which session has the deepest liquidity?" } });
    await userEvent.click(screen.getByTestId("workbench-coach-submit"));

    expect(streamCoachMock).toHaveBeenCalledWith(
      "/trading/coach/ask/stream",
      { symbol: "AAPL", question: "Which session has the deepest liquidity?" },
      expect.anything(),
      expect.anything(),
    );
    expect(await screen.findByText("London has the deepest liquidity right now.")).toBeInTheDocument();
  });

  it("Save Workspace button saves a pending note and a filled-in trade plan together", async () => {
    searchMock.value = "symbol=AAPL";
    mockState.liquidity = { data: liquidityAnalysis(), isLoading: false };
    renderWithClient(<LiquidityWorkbench />);

    fireEvent.change(screen.getByTestId("input-session-note-text"), { target: { value: "Noting the overlap window." } });
    fireEvent.change(screen.getByTestId("input-workbench-plan-entry"), { target: { value: "196" } });
    fireEvent.change(screen.getByTestId("input-workbench-plan-stop"), { target: { value: "188" } });
    fireEvent.change(screen.getByTestId("input-workbench-plan-target"), { target: { value: "210" } });

    await userEvent.click(screen.getByTestId("button-save-workspace"));

    expect(createNoteMutate).toHaveBeenCalled();
    expect(createTradePlanMutate).toHaveBeenCalled();
  });

  it("shows an honest, not-yet-reviewed empty state for every panel before an instrument is selected", () => {
    renderWithClient(<LiquidityWorkbench />);
    expect(screen.getByTestId("panel-liquidity-overview")).toHaveTextContent("Select an instrument to view its liquidity.");
    expect(screen.getByTestId("panel-session-overview")).toHaveTextContent("Select an instrument to see session data.");
    expect(screen.getByTestId("panel-active-session-summary")).toHaveTextContent("Not yet reviewed.");
    expect(screen.getByTestId("panel-previous-session-summary")).toHaveTextContent("Not yet reviewed.");
    expect(screen.getByTestId("panel-buy-sell-pressure")).toHaveTextContent("Not yet reviewed.");
    expect(screen.getByTestId("panel-evidence")).toHaveTextContent("No supporting evidence gathered yet.");
    expect(screen.queryByTestId("panel-session-high-low-explorer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("panel-liquidity-band-explorer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("panel-volume-profile-summary")).not.toBeInTheDocument();
  });

  it("toggles the left and right panels via their own collapse buttons", async () => {
    renderWithClient(<LiquidityWorkbench />);
    expect(screen.getByTestId("workbench-left-panel")).toBeInTheDocument();
    expect(screen.getByTestId("workbench-right-panel")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("toggle-left-panel"));
    expect(screen.queryByTestId("workbench-left-panel")).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("toggle-right-panel"));
    expect(screen.queryByTestId("workbench-right-panel")).not.toBeInTheDocument();
  });
});
