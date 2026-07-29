// Phase 25 — Institutional Trade Workspace. Replaces Phase 24's placeholder
// test file (which asserted only static illustrative JSON cards) with real
// coverage of the interactive workspace. Mocks every generated hook the
// page depends on, following the exact mocked-generated-hook pattern
// TradingResearch.test.tsx / InstitutionalWorkspace.test.tsx already
// established, plus the same wouter useSearch/useLocation deep-link mock
// InstitutionalWorkspace.test.tsx uses.

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
    useLocation: () => ["/trade-workspace", navigateMock],
  };
});

const streamCoachMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach-stream", () => ({
  streamCoach: streamCoachMock,
}));

const createTradePlanMutate = vi.fn();
const updateTradePlanMutate = vi.fn();
const deleteTradePlanMutate = vi.fn();
const createNoteMutate = vi.fn();
const deleteNoteMutate = vi.fn();
const createJournalEntryMutate = vi.fn();

type HookResult = { data: unknown; isLoading?: boolean; isError?: boolean };

const mockState = vi.hoisted(() => ({
  structure: { data: undefined, isLoading: false } as HookResult,
  multiTimeframe: { data: undefined, isLoading: false } as HookResult,
  liquidity: { data: undefined, isLoading: false } as HookResult,
  session: { data: undefined } as HookResult,
  risk: { data: undefined } as HookResult,
  tradePlans: { data: [] as unknown[] } as HookResult,
  workspaceNotes: { data: [] as unknown[] } as HookResult,
  journalEntries: { data: [] as unknown[] } as HookResult,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetTradingStructure: () => mockState.structure,
    useGetTradingMultiTimeframe: () => mockState.multiTimeframe,
    useGetTradingLiquidity: () => mockState.liquidity,
    useGetTradingSession: () => mockState.session,
    useGetTradingRisk: () => mockState.risk,
    useListTradingTradePlansForSymbol: () => mockState.tradePlans,
    useCreateTradingTradePlan: () => ({ mutate: createTradePlanMutate, isPending: false }),
    useUpdateTradingTradePlan: () => ({ mutate: updateTradePlanMutate, isPending: false }),
    useDeleteTradingTradePlan: () => ({ mutate: deleteTradePlanMutate, isPending: false }),
    useListTradingWorkspaceNotesForSymbol: () => mockState.workspaceNotes,
    useCreateTradingWorkspaceNote: () => ({ mutate: createNoteMutate, isPending: false }),
    useDeleteTradingWorkspaceNote: () => ({ mutate: deleteNoteMutate, isPending: false }),
    useListTradingJournalEntries: () => mockState.journalEntries,
    useCreateTradingJournalEntry: () => ({ mutate: createJournalEntryMutate, isPending: false }),
  };
});

import TradeWorkspace from "./TradeWorkspace";

function resetMockState() {
  searchMock.value = "";
  mockState.structure = { data: undefined, isLoading: false };
  mockState.multiTimeframe = { data: undefined, isLoading: false };
  mockState.liquidity = { data: undefined, isLoading: false };
  mockState.session = { data: undefined };
  mockState.risk = { data: undefined };
  mockState.tradePlans = { data: [] };
  mockState.workspaceNotes = { data: [] };
  mockState.journalEntries = { data: [] };
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
    swingPoints: [],
    zones: [],
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
    timeframes: [],
    trendAgreement: "unanimous",
    dominantTrend: "uptrend",
    confluenceScore: 100,
    confidenceLevel: "High",
    confidenceExplanation: "All agree",
    summary: "Unanimous uptrend across timeframes.",
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
    volumeProfile: [],
    avgDollarVolume: 50_000_000,
    liquidityScore: 90,
    liquidityBand: "High",
    buySellPressure: { direction: "buying", buyPct: 60, sellPct: 40 },
    confidenceLevel: "High",
    confidenceExplanation: "Plenty of volume",
    summary: "AAPL is highly liquid.",
    ...over,
  };
}

function riskAnalysis(over: Record<string, unknown> = {}) {
  return {
    overall: { score: 90, label: "Excellent", detail: "Well within limits" },
    positionSizing: { score: 90, label: "Excellent", detail: "ok" },
    stopDiscipline: { score: 90, label: "Excellent", detail: "ok" },
    portfolioBudget: { score: 90, label: "Excellent", detail: "ok", totalRiskDollars: 100, totalRiskUsedPct: 2, capBreached: false, perPosition: [] },
    components: [],
    accountValue: 50000,
    openPositionsCount: 0,
    positionContexts: [],
    ...over,
  };
}

describe("TradeWorkspace", () => {
  beforeEach(() => {
    resetMockState();
    navigateMock.mockClear();
    streamCoachMock.mockReset();
    createTradePlanMutate.mockClear();
    updateTradePlanMutate.mockClear();
    deleteTradePlanMutate.mockClear();
    createNoteMutate.mockClear();
    deleteNoteMutate.mockClear();
    createJournalEntryMutate.mockClear();
  });

  it("renders the header, permanent labels, and an advisory message before an instrument is selected", () => {
    renderWithClient(<TradeWorkspace />);
    expect(screen.getByText("Institutional Trade Workspace")).toBeInTheDocument();
    const labels = screen.getByTestId("trade-workspace-permanent-labels");
    expect(labels).toHaveTextContent("Advisory Only");
    expect(screen.getByText(/Select an instrument above to begin/)).toBeInTheDocument();
  });

  it("selecting an instrument navigates to the workspace's own deep-link URL", async () => {
    renderWithClient(<TradeWorkspace />);
    // react-resizable-panels registers document-level listeners that
    // interfere with userEvent's key-by-key typing simulation whenever a
    // ResizablePanelGroup is mounted (a real, disclosed jsdom/library
    // interaction, not a production bug, per InstitutionalWorkspace.test.tsx's
    // own precedent) — fireEvent.change sets the value directly instead.
    fireEvent.change(screen.getByTestId("workspace-symbol-search"), { target: { value: "AAPL" } });
    await userEvent.click(screen.getByTestId("workspace-symbol-search-submit"));
    expect(navigateMock).toHaveBeenCalledWith("/trade-workspace?symbol=AAPL");
  });

  it("auto-loads an instrument from a ?symbol= deep link and renders Structure/Liquidity/Multi-Timeframe summaries", () => {
    searchMock.value = "symbol=AAPL";
    mockState.structure = { data: structureAnalysis(), isLoading: false };
    mockState.multiTimeframe = { data: multiTimeframeAnalysis(), isLoading: false };
    mockState.liquidity = { data: liquidityAnalysis(), isLoading: false };
    renderWithClient(<TradeWorkspace />);

    expect(screen.getByTestId("panel-market-structure")).toHaveTextContent("uptrend");
    expect(screen.getByTestId("panel-liquidity")).toHaveTextContent("High liquidity");
    expect(screen.getByTestId("panel-multi-timeframe")).toHaveTextContent("unanimous agreement");
  });

  it("renders the Session Summary and Instrument Overview panels once an instrument is selected", () => {
    searchMock.value = "symbol=AAPL";
    mockState.structure = { data: structureAnalysis(), isLoading: false };
    mockState.session = {
      data: { symbol: "AAPL", asOf: "2026-01-01T12:00:00.000Z", activeSessions: ["london", "new_york"], sessionHigh: 200, sessionLow: 190 },
    };
    renderWithClient(<TradeWorkspace />);

    expect(screen.getByTestId("panel-instrument-overview")).toHaveTextContent("AAPL");
    const sessionPanel = screen.getByTestId("panel-session-summary");
    expect(sessionPanel).toHaveTextContent("london");
    expect(sessionPanel).toHaveTextContent("new york");
    expect(sessionPanel).toHaveTextContent("Today's range");
  });

  it("renders the Trade Checklist reflecting already-fetched panel data honestly", () => {
    searchMock.value = "symbol=AAPL";
    mockState.structure = { data: structureAnalysis(), isLoading: false };
    renderWithClient(<TradeWorkspace />);

    expect(screen.getByTestId("checklist-item-structure-reviewed")).toHaveTextContent("High confidence");
    // liquidity/multi-timeframe never fetched in this test -> still honestly "unknown"
    expect(screen.getByTestId("checklist-item-liquidity-checked")).toHaveTextContent("Not yet reviewed");
    expect(screen.getByTestId("checklist-item-plan-created")).toHaveTextContent("No trade plan saved yet");
  });

  it("renders the Evidence Panel from already-computed summary/detail strings", () => {
    searchMock.value = "symbol=AAPL";
    mockState.structure = { data: structureAnalysis({ trendDetail: "A distinctive structure detail." }), isLoading: false };
    renderWithClient(<TradeWorkspace />);

    const evidence = screen.getByTestId("panel-evidence");
    expect(evidence).toHaveTextContent("A distinctive structure detail.");
  });

  it("Trade Plan Panel submits a new plan with the correct payload", async () => {
    searchMock.value = "symbol=AAPL";
    mockState.risk = { data: riskAnalysis({ accountValue: 25000 }) };
    renderWithClient(<TradeWorkspace />);

    fireEvent.change(screen.getByTestId("input-plan-thesis"), { target: { value: "Breakout continuation" } });
    fireEvent.change(screen.getByTestId("input-plan-entry-price"), { target: { value: "100" } });
    fireEvent.change(screen.getByTestId("input-plan-stop-price"), { target: { value: "95" } });
    fireEvent.change(screen.getByTestId("input-plan-target-price"), { target: { value: "115" } });
    await userEvent.click(screen.getByTestId("button-save-plan"));

    expect(createTradePlanMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          symbol: "AAPL",
          direction: "long",
          thesis: "Breakout continuation",
          accountRiskPct: 1,
          entryPrice: 100,
          stopPrice: 95,
          targetPrice: 115,
          accountValue: 25000,
        }),
      }),
      expect.anything(),
    );
  });

  it("renders saved trade plans and lets a draft plan be activated", async () => {
    searchMock.value = "symbol=AAPL";
    mockState.tradePlans = {
      data: [
        {
          id: 7,
          symbol: "AAPL",
          direction: "long",
          status: "draft",
          thesis: "Reclaim of the daily order block.",
          risk: { accountRiskPct: 1, entryPrice: 100, stopPrice: 95, targetPrice: 115, positionSize: 100, riskRewardRatio: 3 },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };
    renderWithClient(<TradeWorkspace />);

    expect(screen.getByTestId("row-trade-plan-7")).toHaveTextContent("Reclaim of the daily order block.");
    await userEvent.click(screen.getByTestId("button-activate-plan-7"));
    expect(updateTradePlanMutate).toHaveBeenCalledWith({ id: 7, data: { status: "active" } }, expect.anything());
  });

  it("Notes Panel submits a new note scoped to the selected instrument", async () => {
    searchMock.value = "symbol=AAPL";
    renderWithClient(<TradeWorkspace />);

    fireEvent.change(screen.getByTestId("input-note-text"), { target: { value: "Watching for a pullback." } });
    await userEvent.click(screen.getByTestId("button-save-note"));

    expect(createNoteMutate).toHaveBeenCalledWith(
      { data: { symbol: "AAPL", note: "Watching for a pullback." } },
      expect.anything(),
    );
  });

  it("Journal Panel quick-add submits a title/content entry and renders recent entries", async () => {
    mockState.journalEntries = {
      data: [{ id: 1, title: "AAPL breakout follow-through", content: "Held through the open." }],
    };
    renderWithClient(<TradeWorkspace />);

    expect(screen.getByTestId("row-journal-1")).toHaveTextContent("AAPL breakout follow-through");

    fireEvent.change(screen.getByTestId("input-journal-quick-title"), { target: { value: "New entry" } });
    fireEvent.change(screen.getByTestId("input-journal-quick-content"), { target: { value: "Some notes" } });
    await userEvent.click(screen.getByTestId("button-add-journal-entry"));

    expect(createJournalEntryMutate).toHaveBeenCalledWith(
      { data: { title: "New entry", content: "Some notes", mood: "neutral" } },
      expect.anything(),
    );
  });

  it("AI Trading Coach Panel streams an answer grounded in the selected instrument", async () => {
    searchMock.value = "symbol=AAPL";
    streamCoachMock.mockImplementation((_url, _body, handlers) => {
      handlers.onDelta("Watch the ");
      handlers.onDelta("session high.");
      handlers.onDone({ answer: "Watch the session high." });
      return Promise.resolve();
    });
    renderWithClient(<TradeWorkspace />);

    fireEvent.change(screen.getByTestId("coach-input"), { target: { value: "What should I watch for?" } });
    await userEvent.click(screen.getByTestId("coach-submit"));

    expect(streamCoachMock).toHaveBeenCalledWith(
      "/trading/coach/ask/stream",
      { symbol: "AAPL", question: "What should I watch for?" },
      expect.anything(),
      expect.anything(),
    );
    expect(await screen.findByText("Watch the session high.")).toBeInTheDocument();
  });

  it("renders the Risk Panel once portfolio risk data resolves", () => {
    mockState.risk = { data: riskAnalysis({ overall: { score: 40, label: "Elevated", detail: "Concentration cap breached" } }) };
    renderWithClient(<TradeWorkspace />);

    const riskPanel = screen.getByTestId("panel-risk");
    expect(riskPanel).toHaveTextContent("Elevated");
    expect(riskPanel).toHaveTextContent("Concentration cap breached");
  });

  it("Save Workspace persists a pending trade plan form and note text together", async () => {
    searchMock.value = "symbol=AAPL";
    renderWithClient(<TradeWorkspace />);

    fireEvent.change(screen.getByTestId("input-plan-thesis"), { target: { value: "Breakout continuation" } });
    fireEvent.change(screen.getByTestId("input-plan-entry-price"), { target: { value: "100" } });
    fireEvent.change(screen.getByTestId("input-plan-stop-price"), { target: { value: "95" } });
    fireEvent.change(screen.getByTestId("input-plan-target-price"), { target: { value: "115" } });
    fireEvent.change(screen.getByTestId("input-note-text"), { target: { value: "Watching for a pullback." } });

    await userEvent.click(screen.getByTestId("button-save-workspace"));

    expect(createTradePlanMutate).toHaveBeenCalled();
    expect(createNoteMutate).toHaveBeenCalled();
  });

  it("toggles the left and right panels via their own collapse buttons", async () => {
    renderWithClient(<TradeWorkspace />);
    expect(screen.getByTestId("workspace-left-panel")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-right-panel")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("toggle-left-panel"));
    expect(screen.queryByTestId("workspace-left-panel")).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("toggle-right-panel"));
    expect(screen.queryByTestId("workspace-right-panel")).not.toBeInTheDocument();
  });
});
