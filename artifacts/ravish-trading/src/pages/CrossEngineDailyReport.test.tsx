// Phase 5, Sprint 68 — Cross-Engine Daily Report smoke test, following the
// established mocked-generated-hook pattern (see InstitutionalDashboard.test.tsx,
// TradingResearch.test.tsx) and the established streamCoach mocking pattern
// for the "Narrate My Day" button (see StockResearch.test.tsx's own
// "Narrate this verdict" button tests, Sprint 61).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const streamCoachMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach-stream", () => ({
  streamCoach: streamCoachMock,
}));

const mockState = vi.hoisted(() => ({
  report: undefined as unknown,
  isLoading: false,
  isError: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetCrossEngineDailyReport: () => ({
      data: mockState.report,
      isLoading: mockState.isLoading,
      isError: mockState.isError,
    }),
  };
});

import CrossEngineDailyReport from "./CrossEngineDailyReport";

function dailyReport(over: Record<string, unknown> = {}) {
  return {
    date: "2026-07-15",
    generatedAt: "2026-07-15T13:00:00.000Z",
    engine1: {
      macro: {
        asOf: "2026-07-15",
        regime: "stable_rates",
        regimeLabel: "Stable-Rate Environment",
        rateTrendPct: 0.0002,
        dataSource: "SIMULATED",
        summary: "SIMULATED macro proxy as of 2026-07-15: stable-rate environment.",
      },
      watchlistTotalItems: 0,
      watchlistCrossings: [],
    },
    engine2: {
      risk: {
        overall: {
          score: 82,
          label: "Excellent",
          detail: "Composite of position sizing, stop/target discipline, and portfolio risk budget.",
        },
        positionSizing: { score: 100, label: "Excellent", detail: "", largestPositionSymbol: null, largestPositionRiskPct: null, capBreached: false, unpricedSymbols: [] },
        stopDiscipline: { score: 100, label: "Excellent", detail: "", openPositionsCount: 0, positionsWithStop: 0, positionsWithTarget: 0, positionsFullyPlanned: 0, missingStopSymbols: [], missingTargetSymbols: [] },
        portfolioBudget: { score: 100, label: "Excellent", detail: "", totalRiskDollars: 0, totalRiskPct: 0, capBreached: false, perPosition: [] },
        openPositionsCount: 0,
        accountValue: null,
        positionContexts: [],
      },
    },
    engine3: {
      healthScore: 78,
      healthLabel: "Good",
      openPositions: 3,
      totalUnrealizedPnl: 425.5,
      attentionCount: 1,
      criticalCount: 0,
      topOpportunitySymbol: "SPY",
      topOpportunityRavishScore: 82,
    },
    summary:
      "Macro regime: Stable-Rate Environment. Watchlist is empty. Trading risk: Excellent. Options income portfolio health: 78 (Good), 3 open positions.",
    disclaimer:
      "Advisory/education only. This report summarises SIMULATED and provider data already computed by Engine 1, Engine 2, and Engine 3 — it never executes, adjusts, or schedules a trade, and it is generated only when you open it, never sent automatically.",
    ...over,
  };
}

describe("CrossEngineDailyReport page", () => {
  beforeEach(() => {
    mockState.report = undefined;
    mockState.isLoading = false;
    mockState.isError = false;
    streamCoachMock.mockReset();
  });

  it("shows a loading skeleton while the report is resolving", () => {
    mockState.isLoading = true;
    renderWithClient(<CrossEngineDailyReport />);
    expect(screen.getByTestId("page-cross-engine-daily-report")).toBeInTheDocument();
    expect(screen.getByTestId("daily-report-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("card-daily-report-summary")).not.toBeInTheDocument();
  });

  it("shows an honest error message when the report fails to load", () => {
    mockState.isError = true;
    renderWithClient(<CrossEngineDailyReport />);
    expect(screen.getByTestId("daily-report-error")).toBeInTheDocument();
    expect(screen.queryByTestId("card-daily-report-summary")).not.toBeInTheDocument();
  });

  it("renders all 3 engine cards plus the deterministic summary once the report resolves", () => {
    mockState.report = dailyReport();
    renderWithClient(<CrossEngineDailyReport />);

    expect(screen.getByTestId("card-daily-report-summary")).toBeInTheDocument();
    expect(screen.getByTestId("daily-report-summary-text")).toHaveTextContent(/Stable-Rate Environment/i);
    expect(screen.getByTestId("card-daily-report-engine1")).toBeInTheDocument();
    expect(screen.getByTestId("card-daily-report-engine2")).toBeInTheDocument();
    expect(screen.getByTestId("card-daily-report-engine3")).toBeInTheDocument();
    expect(screen.getByText("Stable-Rate Environment")).toBeInTheDocument();
    expect(screen.getByText("Excellent")).toBeInTheDocument();
    expect(screen.getByText(/Health 78 \(Good\)/)).toBeInTheDocument();
    const engine3Card = screen.getByTestId("card-daily-report-engine3");
    expect(within(engine3Card).getByText(/3 open positions/)).toBeInTheDocument();
    expect(within(engine3Card).getByText(/SPY/)).toBeInTheDocument();
    // "Narrate My Day" is available, but no narration has happened yet.
    expect(screen.getByTestId("narrate-daily-report-button")).toHaveTextContent(/narrate my day/i);
  });

  it("shows an honest empty-watchlist message when the watchlist has no items", () => {
    mockState.report = dailyReport();
    renderWithClient(<CrossEngineDailyReport />);
    expect(screen.getByTestId("text-daily-report-no-crossings")).toHaveTextContent(/watchlist is empty/i);
  });

  it("shows an honest no-crossings message (distinct from empty) when the watchlist has items but none crossed today", () => {
    mockState.report = dailyReport({
      engine1: {
        macro: dailyReport().engine1.macro,
        watchlistTotalItems: 4,
        watchlistCrossings: [],
      },
    });
    renderWithClient(<CrossEngineDailyReport />);
    expect(screen.getByTestId("text-daily-report-no-crossings")).toHaveTextContent(
      /no watchlist symbols crossed a target today/i,
    );
  });

  it("lists each crossed watchlist symbol when crossings exist, never a fabricated empty list", () => {
    mockState.report = dailyReport({
      engine1: {
        macro: dailyReport().engine1.macro,
        watchlistTotalItems: 2,
        watchlistCrossings: [
          { symbol: "ZCED", currentPrice: 210.5, priceTargetCrossed: true, marginOfSafetyTargetCrossed: null },
        ],
      },
    });
    renderWithClient(<CrossEngineDailyReport />);
    expect(screen.getByTestId("watchlist-crossing-ZCED")).toBeInTheDocument();
    expect(screen.queryByTestId("text-daily-report-no-crossings")).not.toBeInTheDocument();
  });

  it("submits a narration request to the cross-engine-report/narrate/stream endpoint when clicked", async () => {
    streamCoachMock.mockResolvedValue(undefined);
    mockState.report = dailyReport();
    renderWithClient(<CrossEngineDailyReport />);

    await userEvent.click(screen.getByTestId("narrate-daily-report-button"));

    expect(streamCoachMock).toHaveBeenCalledWith(
      "/cross-engine-report/narrate/stream",
      {},
      expect.anything(),
    );
  });

  it("renders the narrated synthesis once the stream completes, without hiding the deterministic summary", async () => {
    streamCoachMock.mockImplementation(async (_path, _body, handlers) => {
      handlers.onDone?.({ narrative: "Your day was quiet across all 3 engines, with one options position needing attention." });
    });
    mockState.report = dailyReport();
    renderWithClient(<CrossEngineDailyReport />);

    await userEvent.click(screen.getByTestId("narrate-daily-report-button"));

    expect(await screen.findByText(/quiet across all 3 engines/i)).toBeInTheDocument();
    // The deterministic summary stays visible — narration is additive, never a replacement.
    expect(screen.getByTestId("daily-report-summary-text")).toHaveTextContent(/Stable-Rate Environment/i);
    // The button is replaced by the narration once it exists, not stacked alongside it.
    expect(screen.queryByTestId("narrate-daily-report-button")).not.toBeInTheDocument();
  });

  it("accumulates streamed delta tokens into the narrative as they arrive", async () => {
    streamCoachMock.mockImplementation(async (_path, _body, handlers) => {
      handlers.onDelta?.("Your day ");
      handlers.onDelta?.("was quiet.");
      handlers.onDone?.({});
    });
    mockState.report = dailyReport();
    renderWithClient(<CrossEngineDailyReport />);

    await userEvent.click(screen.getByTestId("narrate-daily-report-button"));

    expect(await screen.findByText(/Your day was quiet\./i)).toBeInTheDocument();
  });

  it("honestly shows an error message when narration fails, never a fabricated synthesis", async () => {
    streamCoachMock.mockImplementation(async (_path, _body, handlers) => {
      handlers.onError?.("narration failed");
    });
    mockState.report = dailyReport();
    renderWithClient(<CrossEngineDailyReport />);

    await userEvent.click(screen.getByTestId("narrate-daily-report-button"));

    expect(await screen.findByTestId("narrate-daily-report-error")).toHaveTextContent(/failed to narrate/i);
    // The deterministic summary is still there — an LLM failure never blanks the report.
    expect(screen.getByTestId("daily-report-summary-text")).toHaveTextContent(/Stable-Rate Environment/i);
    // The button reappears so the user can retry.
    expect(screen.getByTestId("narrate-daily-report-button")).toBeInTheDocument();
  });
});
