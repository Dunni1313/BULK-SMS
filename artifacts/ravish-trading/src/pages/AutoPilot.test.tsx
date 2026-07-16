// Phase 6, Sprint 72 — Frontend Legacy Page Test Coverage, Slice 2.
// Following the established mocked-generated-hook pattern. Read-only with
// respect to the actual kill-switch/guardrail logic (CLAUDE.md rule 2) —
// every hook here is mocked, so no real backend execution/guardrail code
// path is exercised; this only tests the React component's own rendering
// and that it calls the mutation hooks with the right arguments.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const updateSettingsMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const runCycleMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const mockState = vi.hoisted(() => ({
  settings: undefined as unknown,
  settingsLoading: false,
  status: undefined as unknown,
  statusLoading: false,
  log: undefined as unknown,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetSettings: () => ({ data: mockState.settings, isLoading: mockState.settingsLoading }),
    useGetAutoExecutionStatus: () => ({ data: mockState.status, isLoading: mockState.statusLoading }),
    useGetAutoExecutionLog: () => ({ data: mockState.log }),
    useUpdateSettings: () => updateSettingsMock,
    useRunAutoExecutionCycle: () => runCycleMock,
  };
});

import AutoPilot from "./AutoPilot";

function status(over: Record<string, unknown> = {}) {
  return {
    armed: false,
    executionMode: "semi_auto",
    autoExecuteEnabled: false,
    blockReason: null,
    today: {
      tradesToday: 1,
      concurrentPositions: 2,
      remainingCapacity: 4,
      dailyRealizedPnl: 150,
      dailyLossLimit: 500,
    },
    guardrails: { maxTradesPerDay: 5, maxConcurrentPositions: 10 },
    ...over,
  };
}

describe("AutoPilot page", () => {
  beforeEach(() => {
    mockState.settings = undefined;
    mockState.settingsLoading = true;
    mockState.status = undefined;
    mockState.statusLoading = true;
    mockState.log = undefined;
    updateSettingsMock.mutate.mockReset();
    updateSettingsMock.isPending = false;
    runCycleMock.mutate.mockReset();
    runCycleMock.isPending = false;
  });

  it("shows a loading skeleton while settings and status resolve", () => {
    renderWithClient(<AutoPilot />);
    expect(screen.queryByText("AutoPilot")).not.toBeInTheDocument();
  });

  it("shows DISARMED and an honest empty decision log for a fresh, unarmed user", () => {
    mockState.settings = {};
    mockState.settingsLoading = false;
    mockState.status = status();
    mockState.statusLoading = false;
    mockState.log = [];
    renderWithClient(<AutoPilot />);
    expect(screen.getByText("AutoPilot")).toBeInTheDocument();
    expect(screen.getByText("○ DISARMED")).toBeInTheDocument();
    expect(screen.getByText(/no auto-execution activity yet/i)).toBeInTheDocument();
  });

  it("shows ARMED and real today's-stats when the kill switch is on", () => {
    mockState.settings = {};
    mockState.settingsLoading = false;
    mockState.status = status({ armed: true, executionMode: "full_auto", autoExecuteEnabled: true });
    mockState.statusLoading = false;
    mockState.log = [];
    renderWithClient(<AutoPilot />);
    expect(screen.getByText("● ARMED")).toBeInTheDocument();
    expect(screen.getByText("1 / 5")).toBeInTheDocument(); // Trades Today
    expect(screen.getByText("2 / 10")).toBeInTheDocument(); // Concurrent
  });

  it("renders real decision-log rows", () => {
    mockState.settings = {};
    mockState.settingsLoading = false;
    mockState.status = status();
    mockState.statusLoading = false;
    mockState.log = [
      { id: 1, createdAt: "2026-07-15T12:00:00.000Z", decision: "executed", symbol: "AAPL", strategy: "iron_condor", ravishScore: 82.3, reason: "Passed all guardrails." },
    ];
    renderWithClient(<AutoPilot />);
    expect(screen.getByText("executed")).toBeInTheDocument();
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("82.3")).toBeInTheDocument();
    expect(screen.getByText("Passed all guardrails.")).toBeInTheDocument();
  });

  it("flips the master kill switch by calling updateSettings with autoExecuteEnabled", async () => {
    mockState.settings = {};
    mockState.settingsLoading = false;
    mockState.status = status();
    mockState.statusLoading = false;
    mockState.log = [];
    renderWithClient(<AutoPilot />);

    const switches = screen.getAllByRole("switch");
    await userEvent.click(switches[1]); // the master kill switch, second of the two master-control switches
    expect(updateSettingsMock.mutate).toHaveBeenCalledWith(
      { data: { autoExecuteEnabled: true } },
      expect.anything(),
    );
  });

  it("triggers a manual cycle run", async () => {
    mockState.settings = {};
    mockState.settingsLoading = false;
    mockState.status = status();
    mockState.statusLoading = false;
    mockState.log = [];
    renderWithClient(<AutoPilot />);
    await userEvent.click(screen.getByRole("button", { name: /run cycle now/i }));
    expect(runCycleMock.mutate).toHaveBeenCalledWith(undefined, expect.anything());
  });
});
