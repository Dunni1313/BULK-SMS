// Phase 28 — Institutional Trade Planning & Risk Studio. Follows the exact
// mocked-generated-hook pattern MarketStructureWorkbench.test.tsx /
// LiquidityWorkbench.test.tsx / TradeWorkspace.test.tsx already established.

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
    useLocation: () => ["/trade-planning-studio", navigateMock],
  };
});

const streamCoachMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach-stream", () => ({
  streamCoach: streamCoachMock,
}));

type HookResult = { data: unknown; isLoading?: boolean };

const createTradePlanMutate = vi.fn();
const updateTradePlanMutate = vi.fn();
const deleteTradePlanMutate = vi.fn();
const createNoteMutate = vi.fn();
const deleteNoteMutate = vi.fn();
const compareScenariosMutate = vi.fn();

const mockState = vi.hoisted(() => ({
  structure: { data: undefined } as HookResult,
  liquidity: { data: undefined } as HookResult,
  session: { data: undefined } as HookResult,
  multiTimeframe: { data: undefined } as HookResult,
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
    useGetTradingLiquidity: () => mockState.liquidity,
    useGetTradingSession: () => mockState.session,
    useGetTradingMultiTimeframe: () => mockState.multiTimeframe,
    useGetTradingRisk: () => mockState.risk,
    useListTradingTradePlansForSymbol: () => mockState.tradePlans,
    useCreateTradingTradePlan: () => ({ mutate: createTradePlanMutate, isPending: false }),
    useUpdateTradingTradePlan: () => ({ mutate: updateTradePlanMutate, isPending: false }),
    useDeleteTradingTradePlan: () => ({ mutate: deleteTradePlanMutate, isPending: false }),
    useListTradingWorkspaceNotesForSymbol: () => mockState.workspaceNotes,
    useCreateTradingWorkspaceNote: () => ({ mutate: createNoteMutate, isPending: false }),
    useDeleteTradingWorkspaceNote: () => ({ mutate: deleteNoteMutate, isPending: false }),
    useListTradingJournalEntries: () => mockState.journalEntries,
    useCompareTradingScenarios: () => ({ mutate: compareScenariosMutate, isPending: false }),
  };
});

import TradePlanningStudio from "./TradePlanningStudio";

function resetMockState() {
  searchMock.value = "";
  mockState.structure = { data: undefined };
  mockState.liquidity = { data: undefined };
  mockState.session = { data: undefined };
  mockState.multiTimeframe = { data: undefined };
  mockState.risk = { data: undefined };
  mockState.tradePlans = { data: [] };
  mockState.workspaceNotes = { data: [] };
  mockState.journalEntries = { data: [] };
}

function riskAnalysis(over: Record<string, unknown> = {}) {
  return {
    overall: { score: 70, label: "Strong", detail: "Composite of position sizing, stop/target discipline, and portfolio risk budget." },
    positionSizing: {
      score: 75,
      label: "Strong",
      detail: "Largest single-position risk is AAPL at 1.5%, within the 2% cap.",
      largestPositionSymbol: "AAPL",
      largestPositionRiskPct: 1.5,
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
      score: 80,
      label: "Strong",
      detail: "Aggregate open-position risk is 1.5% of account value, within the 6% portfolio risk-budget cap.",
      accountValue: 10000,
      totalRiskDollars: 150,
      totalRiskUsedPct: 1.5,
      capBreached: false,
      perPosition: [{ id: 1, symbol: "AAPL", riskDollars: 150, riskPct: 1.5, withinLimit: true }],
    },
    components: [],
    accountValue: 10000,
    openPositionsCount: 1,
    positionContexts: [],
    ...over,
  };
}

function tradePlan(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    symbol: "AAPL",
    direction: "long",
    status: "draft",
    thesis: "Breaking out above resistance.",
    risk: { accountRiskPct: 1, entryPrice: 196, stopPrice: 188, targetPrice: 215, positionSize: 12.5, riskRewardRatio: 2.375 },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("TradePlanningStudio", () => {
  beforeEach(() => {
    resetMockState();
    navigateMock.mockClear();
    streamCoachMock.mockReset();
    createTradePlanMutate.mockClear();
    updateTradePlanMutate.mockClear();
    deleteTradePlanMutate.mockClear();
    createNoteMutate.mockClear();
    deleteNoteMutate.mockClear();
    compareScenariosMutate.mockClear();
  });

  it("renders the header, permanent labels, and an advisory message before an instrument is selected", () => {
    renderWithClient(<TradePlanningStudio />);
    expect(screen.getByText("Trade Planning & Risk Studio")).toBeInTheDocument();
    const labels = screen.getByTestId("studio-permanent-labels");
    expect(labels).toHaveTextContent("Advisory Only");
    expect(screen.getByText(/Select an instrument above to begin/)).toBeInTheDocument();
  });

  it("selecting an instrument navigates to the studio's own deep-link URL", async () => {
    renderWithClient(<TradePlanningStudio />);
    fireEvent.change(screen.getByTestId("studio-symbol-search"), { target: { value: "AAPL" } });
    await userEvent.click(screen.getByTestId("studio-symbol-search-submit"));
    expect(navigateMock).toHaveBeenCalledWith("/trade-planning-studio?symbol=AAPL");
  });

  it("auto-loads an instrument from a ?symbol= deep link and renders the Entry/Stop/Target Planning panels", () => {
    searchMock.value = "symbol=AAPL";
    renderWithClient(<TradePlanningStudio />);
    expect(screen.getByTestId("panel-entry-planning")).toBeInTheDocument();
    expect(screen.getByTestId("panel-stop-planning")).toBeInTheDocument();
    expect(screen.getByTestId("panel-target-planning")).toBeInTheDocument();
  });

  it("Trade Plan workflow: filling in Entry/Stop/Target and submitting creates a real trade plan", async () => {
    searchMock.value = "symbol=AAPL";
    mockState.risk = { data: riskAnalysis() };
    renderWithClient(<TradePlanningStudio />);

    fireEvent.change(screen.getByTestId("input-plan-entry-price"), { target: { value: "196" } });
    fireEvent.change(screen.getByTestId("input-plan-stop-price"), { target: { value: "188" } });
    fireEvent.change(screen.getByTestId("input-plan-target-price"), { target: { value: "215" } });
    fireEvent.change(screen.getByTestId("input-plan-thesis"), { target: { value: "Breaking out above resistance." } });
    await userEvent.click(screen.getByTestId("button-save-plan"));

    expect(createTradePlanMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          symbol: "AAPL",
          direction: "long",
          thesis: "Breaking out above resistance.",
          entryPrice: 196,
          stopPrice: 188,
          targetPrice: 215,
          accountValue: 10000,
        }),
      }),
      expect.anything(),
    );
  });

  it("renders the Planning Timeline from already-persisted Trade Plans, newest first in state but oldest-to-newest displayed", () => {
    searchMock.value = "symbol=AAPL";
    mockState.tradePlans = { data: [tradePlan({ id: 2, createdAt: "2026-01-02T00:00:00.000Z" }), tradePlan({ id: 1 })] };
    renderWithClient(<TradePlanningStudio />);
    const timeline = screen.getByTestId("panel-planning-timeline");
    expect(timeline).toBeInTheDocument();
    expect(screen.getByTestId("row-trade-plan-1")).toBeInTheDocument();
    expect(screen.getByTestId("row-trade-plan-2")).toBeInTheDocument();
  });

  it("Risk rendering: Position Size Review and Risk/Reward Review reflect the current trade plan's own computed risk", () => {
    searchMock.value = "symbol=AAPL";
    mockState.tradePlans = { data: [tradePlan()] };
    mockState.risk = { data: riskAnalysis() };
    renderWithClient(<TradePlanningStudio />);
    expect(screen.getByTestId("panel-position-size-review")).toHaveTextContent("12.5 shares/contracts");
    expect(screen.getByTestId("panel-risk-reward-review")).toHaveTextContent("R:R 2.375");
  });

  it("Risk rendering: Capital Allocation Summary and Portfolio Exposure Summary reuse the full TradingRiskAnalysis structure", () => {
    searchMock.value = "symbol=AAPL";
    mockState.risk = { data: riskAnalysis() };
    renderWithClient(<TradePlanningStudio />);

    const allocation = screen.getByTestId("panel-capital-allocation-summary");
    expect(allocation).toHaveTextContent("Strong");
    expect(screen.getByTestId("row-allocation-1")).toHaveTextContent("AAPL");

    const exposure = screen.getByTestId("panel-portfolio-exposure-summary");
    expect(exposure).toHaveTextContent("1 open position(s), 1 fully planned");
    expect(exposure).toHaveTextContent("AAPL at 1.5%");
  });

  it("honestly shows insufficient-data empty states for Risk panels before Risk is reviewed", () => {
    renderWithClient(<TradePlanningStudio />);
    expect(screen.getByTestId("panel-capital-allocation-summary")).toHaveTextContent("Not yet reviewed.");
    expect(screen.getByTestId("panel-portfolio-exposure-summary")).toHaveTextContent("Not yet reviewed.");
    expect(screen.getByTestId("panel-position-size-review")).toHaveTextContent("No trade plan saved yet.");
    expect(screen.getByTestId("panel-risk-reward-review")).toHaveTextContent("No trade plan saved yet.");
  });

  it("Scenario Comparison: comparing 2 scenarios calls the stateless preview endpoint, never persisting a trade plan", async () => {
    searchMock.value = "symbol=AAPL";
    mockState.risk = { data: riskAnalysis() };
    compareScenariosMutate.mockImplementation((_vars, opts) => {
      opts.onSuccess({
        scenarios: [
          { name: "Scenario A", direction: "long", risk: { positionSize: 12.5, riskRewardRatio: 2.4 } },
          { name: "Scenario B", direction: "long", risk: { positionSize: 8, riskRewardRatio: 1.2 } },
        ],
        bestRiskRewardName: "Scenario A",
        tightestRiskName: "Scenario B",
        summary: "Compared 2 scenario(s) for AAPL. Highest risk/reward: Scenario A. Smallest position size: Scenario B.",
      });
    });
    renderWithClient(<TradePlanningStudio />);

    fireEvent.change(screen.getByTestId("input-scenario-entry-0"), { target: { value: "196" } });
    fireEvent.change(screen.getByTestId("input-scenario-stop-0"), { target: { value: "188" } });
    fireEvent.change(screen.getByTestId("input-scenario-target-0"), { target: { value: "220" } });
    fireEvent.change(screen.getByTestId("input-scenario-entry-1"), { target: { value: "196" } });
    fireEvent.change(screen.getByTestId("input-scenario-stop-1"), { target: { value: "190" } });
    fireEvent.change(screen.getByTestId("input-scenario-target-1"), { target: { value: "205" } });
    await userEvent.click(screen.getByTestId("button-compare-scenarios"));

    expect(compareScenariosMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          symbol: "AAPL",
          scenarios: expect.arrayContaining([expect.objectContaining({ name: "Scenario A" }), expect.objectContaining({ name: "Scenario B" })]),
        }),
      }),
      expect.anything(),
    );
    expect(createTradePlanMutate).not.toHaveBeenCalled();
    expect(screen.getByTestId("scenario-comparison-results")).toHaveTextContent("Highest risk/reward: Scenario A");
    expect(screen.getByTestId("row-scenario-result-Scenario A")).toHaveTextContent("Best R:R");
    expect(screen.getByTestId("row-scenario-result-Scenario B")).toHaveTextContent("Tightest Risk");
  });

  it("Checklist: reuses buildTradeChecklist() exactly, rendering every existing checklist item", () => {
    searchMock.value = "symbol=AAPL";
    mockState.structure = { data: { trend: "uptrend", confidenceLevel: "High", trendDetail: "d" } };
    renderWithClient(<TradePlanningStudio />);
    expect(screen.getByTestId("checklist-item-structure-reviewed")).toHaveTextContent("uptrend");
    expect(screen.getByTestId("checklist-item-confluence-reviewed")).toBeInTheDocument();
    expect(screen.getByTestId("checklist-item-liquidity-checked")).toBeInTheDocument();
    expect(screen.getByTestId("checklist-item-plan-created")).toBeInTheDocument();
    expect(screen.getByTestId("checklist-item-position-size-computed")).toBeInTheDocument();
    expect(screen.getByTestId("checklist-item-risk-within-limits")).toBeInTheDocument();
  });

  it("Save workflow: Save Trade Plan persists a pending plan form and a pending note together", async () => {
    searchMock.value = "symbol=AAPL";
    mockState.risk = { data: riskAnalysis() };
    renderWithClient(<TradePlanningStudio />);

    fireEvent.change(screen.getByTestId("input-plan-entry-price"), { target: { value: "196" } });
    fireEvent.change(screen.getByTestId("input-plan-stop-price"), { target: { value: "188" } });
    fireEvent.change(screen.getByTestId("input-plan-target-price"), { target: { value: "215" } });
    fireEvent.change(screen.getByTestId("input-plan-thesis"), { target: { value: "Breaking out." } });
    fireEvent.change(screen.getByTestId("input-review-note-text"), { target: { value: "Watching the breakout." } });

    await userEvent.click(screen.getByTestId("button-save-trade-plan"));

    expect(createTradePlanMutate).toHaveBeenCalled();
    expect(createNoteMutate).toHaveBeenCalledWith(
      { data: { symbol: "AAPL", note: "Watching the breakout." } },
      expect.anything(),
    );
  });

  it("Open Trading Journal: links out to the full Trading Journal page", () => {
    renderWithClient(<TradePlanningStudio />);
    expect(screen.getByTestId("link-open-trading-journal")).toHaveAttribute("href", "/trading-journal");
  });

  it("existing persistence reuse: renders saved Trade Review Notes and lets one be deleted, same trading_workspace_notes table", async () => {
    searchMock.value = "symbol=AAPL";
    mockState.workspaceNotes = { data: [{ id: 7, symbol: "AAPL", note: "Watch for a retest.", createdAt: "2026-01-01T00:00:00.000Z" }] };
    renderWithClient(<TradePlanningStudio />);
    expect(screen.getByTestId("row-review-note-7")).toHaveTextContent("Watch for a retest.");
    await userEvent.click(screen.getByTestId("button-delete-review-note-7"));
    expect(deleteNoteMutate).toHaveBeenCalledWith({ id: 7 }, expect.anything());
  });

  it("AI Trading Coach panel streams an answer explaining existing plan/risk outputs, grounded in the selected instrument", async () => {
    searchMock.value = "symbol=AAPL";
    streamCoachMock.mockImplementation((_url, _body, handlers) => {
      handlers.onDelta("Your planned risk is ");
      handlers.onDelta("within the portfolio's own budget.");
      handlers.onDone({ answer: "Your planned risk is within the portfolio's own budget." });
      return Promise.resolve();
    });
    renderWithClient(<TradePlanningStudio />);

    fireEvent.change(screen.getByTestId("studio-coach-input"), { target: { value: "Is my planned risk within limits?" } });
    await userEvent.click(screen.getByTestId("studio-coach-submit"));

    expect(streamCoachMock).toHaveBeenCalledWith(
      "/trading/coach/ask/stream",
      { symbol: "AAPL", question: "Is my planned risk within limits?" },
      expect.anything(),
    );
    expect(await screen.findByText("Your planned risk is within the portfolio's own budget.")).toBeInTheDocument();
  });

  it("shows an honest empty state for every panel before an instrument is selected", () => {
    renderWithClient(<TradePlanningStudio />);
    expect(screen.getByTestId("panel-structure-summary")).toHaveTextContent("Select an instrument to review structure.");
    expect(screen.getByTestId("panel-liquidity-summary")).toHaveTextContent("Select an instrument to review liquidity.");
    expect(screen.getByTestId("panel-session-summary")).toHaveTextContent("Select an instrument to see session data.");
    expect(screen.getByTestId("panel-evidence")).toHaveTextContent("No supporting evidence gathered yet.");
    expect(screen.queryByTestId("panel-trade-plan-workspace")).not.toBeInTheDocument();
  });

  it("links out to the Market Structure Workbench and Liquidity & Session Workbench, deep-linked to the same instrument", () => {
    searchMock.value = "symbol=AAPL";
    mockState.structure = { data: { trend: "uptrend", confidenceLevel: "High", trendDetail: "d" } };
    mockState.liquidity = { data: { liquidityBand: "High", summary: "d", buySellPressure: { direction: "buying" } } };
    renderWithClient(<TradePlanningStudio />);
    expect(screen.getByTestId("link-open-market-structure-workbench")).toHaveAttribute("href", "/market-structure-workbench?symbol=AAPL");
    expect(screen.getByTestId("link-open-liquidity-workbench")).toHaveAttribute("href", "/liquidity-workbench?symbol=AAPL");
  });

  it("toggles the left and right panels via their own collapse buttons", async () => {
    renderWithClient(<TradePlanningStudio />);
    expect(screen.getByTestId("studio-left-panel")).toBeInTheDocument();
    expect(screen.getByTestId("studio-right-panel")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("toggle-left-panel"));
    expect(screen.queryByTestId("studio-left-panel")).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("toggle-right-panel"));
    expect(screen.queryByTestId("studio-right-panel")).not.toBeInTheDocument();
  });
});
