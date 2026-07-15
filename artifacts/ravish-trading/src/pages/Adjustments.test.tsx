// Phase 6, Sprint 72 — Frontend Legacy Page Test Coverage, Slice 2 (final page).
// Following the established mocked-generated-hook pattern. wouter's
// useLocation is mocked because the embedded (untested-elsewhere, out of
// this sprint's page-list scope) TradeAdjustmentSheet component calls it
// unconditionally on every render even while closed; the sheet itself is
// never opened by these tests, so streamCoach needs no mock here.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const setLocationMock = vi.hoisted(() => vi.fn());
const updateSettingsMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const runCycleMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const closeTradeMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const mockState = vi.hoisted(() => ({
  settings: undefined as unknown,
  settingsLoading: false,
  status: undefined as unknown,
  adjustments: undefined as unknown,
  adjLoading: false,
  log: undefined as unknown,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetSettings: () => ({ data: mockState.settings, isLoading: mockState.settingsLoading }),
    useGetAutoExecutionStatus: () => ({ data: mockState.status }),
    useListTradeAdjustments: () => ({ data: mockState.adjustments, isLoading: mockState.adjLoading }),
    useGetAutoAdjustmentLog: () => ({ data: mockState.log }),
    useUpdateSettings: () => updateSettingsMock,
    useRunAutoAdjustmentCycle: () => runCycleMock,
    useCloseTrade: () => closeTradeMock,
  };
});

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useLocation: () => ["/adjustments", setLocationMock],
  };
});

import Adjustments from "./Adjustments";

function settings(over: Record<string, unknown> = {}) {
  return {
    autoAdjustEnabled: false,
    adjDeltaDriftTrigger: 0.3,
    adjShortStrikeProximityPct: 2.0,
    adjPopDropTrigger: 15.0,
    stopLossMultiplier: 2.0,
    profitTarget50: 0.5,
    adjIvExpansionTrigger: 25.0,
    adjDteTrigger: 21,
    ...over,
  };
}

function status(over: Record<string, unknown> = {}) {
  return { executionMode: "semi_auto", autoExecuteEnabled: false, ...over };
}

function adjustment(over: Record<string, unknown> = {}) {
  return {
    tradeId: 501,
    symbol: "SPY",
    strategyLabel: "iron condor",
    action: "close_for_profit",
    actionLabel: "Close for profit — 55% captured",
    severity: "warning",
    currentPnl: 100,
    currentPop: 81,
    daysToExpiry: 12,
    autoActionable: true,
    ...over,
  };
}

function logRow(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    runId: "run-abc123456",
    createdAt: "2026-07-15T10:00:00.000Z",
    decision: "executed",
    symbol: "SPY",
    strategy: "iron_condor",
    reason: "Delta drift exceeded threshold.",
    ...over,
  };
}

describe("Adjustments page", () => {
  beforeEach(() => {
    mockState.settings = undefined;
    mockState.settingsLoading = true;
    mockState.status = undefined;
    mockState.adjustments = undefined;
    mockState.adjLoading = false;
    mockState.log = undefined;
    setLocationMock.mockReset();
    updateSettingsMock.mutate.mockReset();
    updateSettingsMock.isPending = false;
    runCycleMock.mutate.mockReset();
    runCycleMock.isPending = false;
    closeTradeMock.mutate.mockReset();
    closeTradeMock.isPending = false;
  });

  it("shows a loading skeleton while settings resolve", () => {
    renderWithClient(<Adjustments />);
    expect(screen.queryByText("Adjustments")).not.toBeInTheDocument();
  });

  it("shows an honest all-clear message when no positions need attention", () => {
    mockState.settings = settings();
    mockState.settingsLoading = false;
    mockState.status = status();
    mockState.adjustments = [];
    mockState.log = [];
    renderWithClient(<Adjustments />);
    expect(screen.getByText("Adjustments")).toBeInTheDocument();
    expect(screen.getByText("○ All clear")).toBeInTheDocument();
    expect(
      screen.getByText("No open positions need attention right now. Every position is inside its thresholds."),
    ).toBeInTheDocument();
  });

  it("renders a real attention-queue row with its severity, recommendation, and de-risk badge", () => {
    mockState.settings = settings();
    mockState.settingsLoading = false;
    mockState.status = status();
    mockState.adjustments = [adjustment()];
    mockState.log = [];
    renderWithClient(<Adjustments />);
    expect(screen.getByText("● 1 need attention")).toBeInTheDocument();
    expect(screen.getByText("warning")).toBeInTheDocument();
    expect(screen.getByText("SPY")).toBeInTheDocument();
    expect(screen.getByText("Close for profit — 55% captured")).toBeInTheDocument();
    expect(screen.getByText("$100")).toBeInTheDocument();
    expect(screen.getByText("de-risk")).toBeInTheDocument();
  });

  it("closes a de-risk-eligible position after confirmation", async () => {
    mockState.settings = settings();
    mockState.settingsLoading = false;
    mockState.status = status();
    mockState.adjustments = [adjustment()];
    mockState.log = [];
    renderWithClient(<Adjustments />);

    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.getByText("Close SPY iron condor?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /close position/i }));

    expect(closeTradeMock.mutate).toHaveBeenCalledWith({ id: 501 }, expect.anything());
  });

  it("arms auto-adjust by flipping the master switch", async () => {
    mockState.settings = settings();
    mockState.settingsLoading = false;
    mockState.status = status();
    mockState.adjustments = [];
    mockState.log = [];
    renderWithClient(<Adjustments />);

    await userEvent.click(screen.getByRole("switch"));
    expect(updateSettingsMock.mutate).toHaveBeenCalledWith(
      { data: { autoAdjustEnabled: true } },
      expect.anything(),
    );
  });

  it("saves the current trigger thresholds", async () => {
    mockState.settings = settings();
    mockState.settingsLoading = false;
    mockState.status = status();
    mockState.adjustments = [];
    mockState.log = [];
    renderWithClient(<Adjustments />);

    await userEvent.click(screen.getByRole("button", { name: "Save Triggers" }));
    expect(updateSettingsMock.mutate).toHaveBeenCalledWith(
      {
        data: {
          adjDeltaDriftTrigger: 0.3,
          adjShortStrikeProximityPct: 2.0,
          adjPopDropTrigger: 15.0,
          stopLossMultiplier: 2.0,
          profitTarget50: 0.5,
          adjIvExpansionTrigger: 25.0,
          adjDteTrigger: 21,
        },
      },
      expect.anything(),
    );
  });

  it("triggers a manual adjustment cycle run", async () => {
    mockState.settings = settings();
    mockState.settingsLoading = false;
    mockState.status = status();
    mockState.adjustments = [];
    mockState.log = [];
    renderWithClient(<Adjustments />);
    await userEvent.click(screen.getByRole("button", { name: /run cycle now/i }));
    expect(runCycleMock.mutate).toHaveBeenCalledWith(undefined, expect.anything());
  });

  it("shows an honest empty decision-log message when no auto-adjustment activity has occurred", () => {
    mockState.settings = settings();
    mockState.settingsLoading = false;
    mockState.status = status();
    mockState.adjustments = [];
    mockState.log = [];
    renderWithClient(<Adjustments />);
    expect(
      screen.getByText("No auto-adjustment activity yet. Arm auto-adjust or run a cycle to see decisions here."),
    ).toBeInTheDocument();
  });

  it("renders real decision-log rows grouped by cycle", () => {
    mockState.settings = settings();
    mockState.settingsLoading = false;
    mockState.status = status();
    mockState.adjustments = [];
    mockState.log = [logRow()];
    renderWithClient(<Adjustments />);
    expect(screen.getByText("executed")).toBeInTheDocument();
    expect(screen.getByText("iron condor")).toBeInTheDocument(); // label() replaces underscores with spaces
    expect(screen.getByText("Delta drift exceeded threshold.")).toBeInTheDocument();
    expect(screen.getByText("1 decision")).toBeInTheDocument();
  });
});
