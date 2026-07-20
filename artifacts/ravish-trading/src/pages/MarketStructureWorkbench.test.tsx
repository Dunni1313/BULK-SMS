// Phase 26 — Institutional Market Structure Workbench. Follows the exact
// mocked-generated-hook pattern TradeWorkspace.test.tsx / TradingResearch.test.tsx
// already established, plus the same wouter useSearch/useLocation deep-link
// mock. The 3 hooks this page reads from src/lib/structure-query.ts (a thin
// fetch()-based wrapper, not a generated hook) are mocked at that module
// boundary instead of via @workspace/api-client-react.

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
    useLocation: () => ["/market-structure-workbench", navigateMock],
  };
});

const streamCoachMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach-stream", () => ({
  streamCoach: streamCoachMock,
}));

type HookResult = { data: unknown; isLoading?: boolean };

const structureQueryState = vi.hoisted(() => ({
  structure: { data: undefined, isLoading: false } as HookResult,
  multiTimeframe: { data: undefined, isLoading: false } as HookResult,
  timeline: { data: undefined } as HookResult,
}));

vi.mock("@/lib/structure-query", () => ({
  useTradingStructureWithParams: () => structureQueryState.structure,
  useTradingMultiTimeframeWithParams: () => structureQueryState.multiTimeframe,
  useTradingStructureTimeline: () => structureQueryState.timeline,
}));

const createTradePlanMutate = vi.fn();
const createNoteMutate = vi.fn();
const deleteNoteMutate = vi.fn();

const mockState = vi.hoisted(() => ({
  session: { data: undefined } as HookResult,
  liquidity: { data: undefined } as HookResult,
  tradePlans: { data: [] as unknown[] } as HookResult,
  workspaceNotes: { data: [] as unknown[] } as HookResult,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetTradingSession: () => mockState.session,
    useGetTradingLiquidity: () => mockState.liquidity,
    useListTradingTradePlansForSymbol: () => mockState.tradePlans,
    useCreateTradingTradePlan: () => ({ mutate: createTradePlanMutate, isPending: false }),
    useListTradingWorkspaceNotesForSymbol: () => mockState.workspaceNotes,
    useCreateTradingWorkspaceNote: () => ({ mutate: createNoteMutate, isPending: false }),
    useDeleteTradingWorkspaceNote: () => ({ mutate: deleteNoteMutate, isPending: false }),
  };
});

import MarketStructureWorkbench from "./MarketStructureWorkbench";

function resetMockState() {
  searchMock.value = "";
  structureQueryState.structure = { data: undefined, isLoading: false };
  structureQueryState.multiTimeframe = { data: undefined, isLoading: false };
  structureQueryState.timeline = { data: undefined };
  mockState.session = { data: undefined };
  mockState.liquidity = { data: undefined };
  mockState.tradePlans = { data: [] };
  mockState.workspaceNotes = { data: [] };
}

function structureAnalysis(over: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    interval: "1D",
    dataSource: "SIMULATED",
    candleCount: 90,
    currentPrice: 195.5,
    trend: "uptrend",
    trendDetail: "Higher highs and higher lows across the recent swing sequence.",
    swingPoints: [
      { time: "2026-01-01T00:00:00.000Z", kind: "low", price: 180 },
      { time: "2026-01-05T00:00:00.000Z", kind: "high", price: 200 },
    ],
    zones: [
      { kind: "support", price: 185, strength: 3 },
      { kind: "resistance", price: 205, strength: 2 },
    ],
    confidenceLevel: "High",
    confidenceExplanation: "Plenty of candles",
    summary: "AAPL shows an uptrend.",
    ...over,
  };
}

function multiTimeframeAnalysis(over: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    dataSource: "SIMULATED",
    timeframes: [
      {
        interval: "15m",
        structure: structureAnalysis({ interval: "15m", candleCount: 390, confidenceLevel: "Moderate" }),
      },
      {
        interval: "1h",
        structure: structureAnalysis({ interval: "1h", candleCount: 130 }),
      },
      {
        interval: "1D",
        structure: structureAnalysis({ interval: "1D", candleCount: 90 }),
      },
    ],
    trendAgreement: "unanimous",
    dominantTrend: "uptrend",
    confluenceScore: 100,
    confidenceLevel: "High",
    confidenceExplanation: "All agree",
    summary: "Unanimous uptrend across timeframes.",
    ...over,
  };
}

function structureShiftTimeline(over: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    interval: "1D",
    dataSource: "SIMULATED",
    candleCount: 90,
    events: [
      {
        time: "2026-01-05T00:00:00.000Z",
        type: "higher_high",
        label: "New Higher High",
        price: 200,
        detail: "Swing high at $200.00, up from the prior swing high at $190.00.",
      },
      {
        time: "2026-01-10T00:00:00.000Z",
        type: "trend_change",
        label: "Trend Change",
        price: 198,
        detail: "Trend changed from range to uptrend.",
      },
      {
        time: "2026-01-12T00:00:00.000Z",
        type: "support_test",
        label: "Support Test",
        price: 185.4,
        detail: "Price tested the support zone near $185.00.",
      },
    ],
    summary: "AAPL: 3 structure shift event(s) detected. Most recent: Support Test at $185.40.",
    ...over,
  };
}

describe("MarketStructureWorkbench", () => {
  beforeEach(() => {
    resetMockState();
    navigateMock.mockClear();
    streamCoachMock.mockReset();
    createTradePlanMutate.mockClear();
    createNoteMutate.mockClear();
    deleteNoteMutate.mockClear();
  });

  it("renders the header, permanent labels, and an advisory message before an instrument is selected", () => {
    renderWithClient(<MarketStructureWorkbench />);
    expect(screen.getByText("Market Structure Workbench")).toBeInTheDocument();
    const labels = screen.getByTestId("workbench-permanent-labels");
    expect(labels).toHaveTextContent("Advisory Only");
    expect(screen.getByText(/Select an instrument above to begin/)).toBeInTheDocument();
  });

  it("selecting an instrument navigates to the workbench's own deep-link URL", async () => {
    renderWithClient(<MarketStructureWorkbench />);
    // react-resizable-panels registers document-level listeners that
    // interfere with userEvent's key-by-key typing simulation whenever a
    // ResizablePanelGroup is mounted — fireEvent.change sets the value
    // directly instead, per TradeWorkspace.test.tsx's own precedent.
    fireEvent.change(screen.getByTestId("workbench-symbol-search"), { target: { value: "AAPL" } });
    await userEvent.click(screen.getByTestId("workbench-symbol-search-submit"));
    expect(navigateMock).toHaveBeenCalledWith("/market-structure-workbench?symbol=AAPL");
  });

  it("auto-loads an instrument from a ?symbol= deep link and renders Structure Overview with its display state", () => {
    searchMock.value = "symbol=AAPL";
    structureQueryState.structure = { data: structureAnalysis(), isLoading: false };
    renderWithClient(<MarketStructureWorkbench />);

    const overview = screen.getByTestId("panel-structure-overview");
    expect(overview).toHaveTextContent("uptrend");
    expect(screen.getByTestId("badge-structure-display-state")).toHaveTextContent("Bullish");
  });

  it("renders the Multi-Timeframe Structure Matrix composed from the selected timeframe checkboxes", () => {
    searchMock.value = "symbol=AAPL";
    structureQueryState.multiTimeframe = { data: multiTimeframeAnalysis(), isLoading: false };
    renderWithClient(<MarketStructureWorkbench />);

    expect(screen.getByTestId("row-matrix-15m")).toHaveTextContent("uptrend");
    expect(screen.getByTestId("row-matrix-1h")).toBeInTheDocument();
    expect(screen.getByTestId("row-matrix-1D")).toBeInTheDocument();
    expect(screen.getByTestId("text-structural-conflict")).toHaveTextContent("Aligned");

    // The default matrix selection is 15m/1h/1D — 1m/5m checkboxes are
    // present but unchecked.
    expect(screen.getByTestId("checkbox-matrix-1m")).not.toBeChecked();
    expect(screen.getByTestId("checkbox-matrix-1D")).toBeChecked();
  });

  it("toggling a timeframe checkbox updates the matrix timeframe selection composition", async () => {
    searchMock.value = "symbol=AAPL";
    structureQueryState.multiTimeframe = { data: multiTimeframeAnalysis(), isLoading: false };
    renderWithClient(<MarketStructureWorkbench />);

    expect(screen.getByTestId("checkbox-matrix-5m")).not.toBeChecked();
    await userEvent.click(screen.getByTestId("checkbox-matrix-5m"));
    expect(screen.getByTestId("checkbox-matrix-5m")).toBeChecked();

    await userEvent.click(screen.getByTestId("checkbox-matrix-1D"));
    expect(screen.getByTestId("checkbox-matrix-1D")).not.toBeChecked();
  });

  it("honestly shows a structural-conflict message and never fabricates a dominant trend when timeframes split", () => {
    searchMock.value = "symbol=AAPL";
    structureQueryState.multiTimeframe = {
      data: multiTimeframeAnalysis({ trendAgreement: "split", dominantTrend: null, confluenceScore: null }),
      isLoading: false,
    };
    renderWithClient(<MarketStructureWorkbench />);

    expect(screen.getByTestId("text-structural-conflict")).toHaveTextContent("Structural conflict — no dominant trend");
    expect(screen.getByTestId("badge-alignment-display-state")).toHaveTextContent("Transition");
  });

  it("renders the Swing High / Swing Low Explorer and the HH/HL/LH/LL sequence panel", () => {
    searchMock.value = "symbol=AAPL";
    structureQueryState.structure = { data: structureAnalysis(), isLoading: false };
    structureQueryState.timeline = { data: structureShiftTimeline() };
    renderWithClient(<MarketStructureWorkbench />);

    const swingExplorer = screen.getByTestId("panel-swing-explorer");
    expect(swingExplorer).toHaveTextContent("low");
    expect(swingExplorer).toHaveTextContent("high");

    // Only the higher_high/higher_low/lower_high/lower_low event types are
    // shown in the sequence panel — trend_change/support_test are excluded
    // from it (they belong to the Structure Shift Timeline panel instead,
    // scoped via within() since "Trend Change" legitimately appears there).
    const sequencePanel = screen.getByTestId("panel-hh-hl-sequence");
    expect(screen.getByTestId("row-sequence-event-0")).toHaveTextContent("New Higher High");
    expect(sequencePanel).not.toHaveTextContent("Trend Change");
  });

  it("renders the Support and Resistance Zone Explorer from the Structure Engine's own zones", () => {
    searchMock.value = "symbol=AAPL";
    structureQueryState.structure = { data: structureAnalysis(), isLoading: false };
    renderWithClient(<MarketStructureWorkbench />);

    expect(screen.getByTestId("row-zone-0")).toHaveTextContent("support");
    expect(screen.getByTestId("row-zone-1")).toHaveTextContent("resistance");
  });

  it("renders the Structure Shift Timeline showing only trend/range/zone-test events, never swing-sequence events", () => {
    searchMock.value = "symbol=AAPL";
    structureQueryState.timeline = { data: structureShiftTimeline() };
    renderWithClient(<MarketStructureWorkbench />);

    expect(screen.getByTestId("row-timeline-event-0")).toHaveTextContent("Trend Change");
    expect(screen.getByTestId("row-timeline-event-1")).toHaveTextContent("Support Test");
    expect(screen.queryByTestId("row-timeline-event-2")).not.toBeInTheDocument();
  });

  it("renders the Range and Consolidation Summary honestly for a non-ranging structure", () => {
    searchMock.value = "symbol=AAPL";
    structureQueryState.structure = { data: structureAnalysis({ trend: "uptrend" }), isLoading: false };
    renderWithClient(<MarketStructureWorkbench />);

    expect(screen.getByTestId("panel-range-consolidation")).toHaveTextContent("Not currently consolidating — structure reads uptrend.");
  });

  it("renders the Range and Consolidation Summary with support/resistance context when the structure is a genuine range", () => {
    searchMock.value = "symbol=AAPL";
    structureQueryState.structure = { data: structureAnalysis({ trend: "range" }), isLoading: false };
    renderWithClient(<MarketStructureWorkbench />);

    const panel = screen.getByTestId("panel-range-consolidation");
    expect(panel).toHaveTextContent("Consolidating above $185.00 support below $205.00 resistance.");
  });

  it("shows an honest, not-yet-reviewed empty state for every panel before an instrument is selected", () => {
    renderWithClient(<MarketStructureWorkbench />);
    expect(screen.getByTestId("panel-range-consolidation")).toHaveTextContent("Not yet reviewed.");
    expect(screen.getByTestId("panel-trend-alignment")).toHaveTextContent("Not yet reviewed.");
    expect(screen.getByTestId("panel-liquidity-context")).toHaveTextContent("Not yet reviewed.");
    expect(screen.getByTestId("panel-session-structure")).toHaveTextContent("Select an instrument to see session data.");
    expect(screen.queryByTestId("panel-structure-matrix")).not.toBeInTheDocument();
    expect(screen.queryByTestId("panel-swing-explorer")).not.toBeInTheDocument();
  });

  it("shows an honest insufficient-data structure display state under Low confidence, never fabricating a directional read", () => {
    searchMock.value = "symbol=AAPL";
    structureQueryState.structure = { data: structureAnalysis({ confidenceLevel: "Low" }), isLoading: false };
    renderWithClient(<MarketStructureWorkbench />);
    expect(screen.getByTestId("badge-structure-display-state")).toHaveTextContent("Unclear / Insufficient Data");
  });

  it("renders the Session Structure and Liquidity Context panels once their data resolves", () => {
    searchMock.value = "symbol=AAPL";
    mockState.session = {
      data: { symbol: "AAPL", asOf: "2026-01-01T12:00:00.000Z", activeSessions: ["london", "new_york"], sessionHigh: 200, sessionLow: 190 },
    };
    mockState.liquidity = {
      data: {
        symbol: "AAPL",
        interval: "1D",
        dataSource: "SIMULATED",
        candleCount: 90,
        currentPrice: 195.5,
        volumeProfile: [],
        avgDollarVolume: 50_000_000,
        liquidityScore: 90,
        liquidityBand: "High",
        buySellPressure: { direction: "buying", buyPct: 60, sellPct: 40 },
        confidenceLevel: "High",
        confidenceExplanation: "Plenty of volume",
        summary: "AAPL is highly liquid.",
      },
    };
    renderWithClient(<MarketStructureWorkbench />);

    const sessionPanel = screen.getByTestId("panel-session-structure");
    expect(sessionPanel).toHaveTextContent("london");
    expect(sessionPanel).toHaveTextContent("new york");
    expect(sessionPanel).toHaveTextContent("Today's range");

    const liquidityPanel = screen.getByTestId("panel-liquidity-context");
    expect(liquidityPanel).toHaveTextContent("High liquidity");
    expect(liquidityPanel).toHaveTextContent("buying");
  });

  it("renders the Evidence Panel from already-computed summary/detail strings across every reused engine", () => {
    searchMock.value = "symbol=AAPL";
    structureQueryState.structure = { data: structureAnalysis({ trendDetail: "A distinctive structure detail." }), isLoading: false };
    structureQueryState.multiTimeframe = { data: multiTimeframeAnalysis({ summary: "A distinctive matrix summary." }), isLoading: false };
    structureQueryState.timeline = { data: structureShiftTimeline({ summary: "A distinctive timeline summary." }) };
    renderWithClient(<MarketStructureWorkbench />);

    const evidence = screen.getByTestId("panel-evidence");
    expect(evidence).toHaveTextContent("A distinctive structure detail.");
    expect(evidence).toHaveTextContent("A distinctive matrix summary.");
    expect(evidence).toHaveTextContent("A distinctive timeline summary.");
  });

  it("Structure Notes Panel submits a new note scoped to the selected instrument", async () => {
    searchMock.value = "symbol=AAPL";
    renderWithClient(<MarketStructureWorkbench />);

    fireEvent.change(screen.getByTestId("input-structure-note-text"), { target: { value: "Watching the resistance zone." } });
    await userEvent.click(screen.getByTestId("button-save-structure-note"));

    expect(createNoteMutate).toHaveBeenCalledWith(
      { data: { symbol: "AAPL", note: "Watching the resistance zone." } },
      expect.anything(),
    );
  });

  it("renders saved structure notes and lets one be deleted", async () => {
    searchMock.value = "symbol=AAPL";
    mockState.workspaceNotes = { data: [{ id: 3, symbol: "AAPL", note: "Support held on retest.", createdAt: "2026-01-01T00:00:00.000Z" }] };
    renderWithClient(<MarketStructureWorkbench />);

    expect(screen.getByTestId("row-structure-note-3")).toHaveTextContent("Support held on retest.");
    await userEvent.click(screen.getByTestId("button-delete-structure-note-3"));
    expect(deleteNoteMutate).toHaveBeenCalledWith({ id: 3 }, expect.anything());
  });

  it("Trade Plan Integration pre-fills the thesis from Structure Overview's own summary and links a new plan", async () => {
    searchMock.value = "symbol=AAPL";
    structureQueryState.structure = { data: structureAnalysis({ summary: "AAPL shows an uptrend." }), isLoading: false };
    renderWithClient(<MarketStructureWorkbench />);

    expect(screen.getByTestId("input-workbench-plan-thesis")).toHaveValue("AAPL shows an uptrend.");

    fireEvent.change(screen.getByTestId("input-workbench-plan-entry"), { target: { value: "196" } });
    fireEvent.change(screen.getByTestId("input-workbench-plan-stop"), { target: { value: "185" } });
    fireEvent.change(screen.getByTestId("input-workbench-plan-target"), { target: { value: "215" } });
    await userEvent.click(screen.getByTestId("button-link-trade-plan"));

    expect(createTradePlanMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          symbol: "AAPL",
          direction: "long",
          thesis: "AAPL shows an uptrend.",
          entryPrice: 196,
          stopPrice: 185,
          targetPrice: 215,
        }),
      }),
      expect.anything(),
    );
  });

  it("links out to the Trade Workspace for Risk and Journal, deep-linked to the same instrument", () => {
    searchMock.value = "symbol=AAPL";
    renderWithClient(<MarketStructureWorkbench />);
    expect(screen.getByTestId("link-open-trade-workspace")).toHaveAttribute("href", "/trade-workspace?symbol=AAPL");
  });

  it("AI Trading Coach panel streams an answer that explains existing structure, grounded in the selected instrument", async () => {
    searchMock.value = "symbol=AAPL";
    streamCoachMock.mockImplementation((_url, _body, handlers) => {
      handlers.onDelta("The range is holding ");
      handlers.onDelta("between known zones.");
      handlers.onDone({ answer: "The range is holding between known zones." });
      return Promise.resolve();
    });
    renderWithClient(<MarketStructureWorkbench />);

    fireEvent.change(screen.getByTestId("workbench-coach-input"), { target: { value: "Why is AAPL ranging?" } });
    await userEvent.click(screen.getByTestId("workbench-coach-submit"));

    expect(streamCoachMock).toHaveBeenCalledWith(
      "/trading/coach/ask/stream",
      { symbol: "AAPL", question: "Why is AAPL ranging?" },
      expect.anything(),
    );
    expect(await screen.findByText("The range is holding between known zones.")).toBeInTheDocument();
  });

  it("toggles the left and right panels via their own collapse buttons", async () => {
    renderWithClient(<MarketStructureWorkbench />);
    expect(screen.getByTestId("workbench-left-panel")).toBeInTheDocument();
    expect(screen.getByTestId("workbench-right-panel")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("toggle-left-panel"));
    expect(screen.queryByTestId("workbench-left-panel")).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("toggle-right-panel"));
    expect(screen.queryByTestId("workbench-right-panel")).not.toBeInTheDocument();
  });
});
