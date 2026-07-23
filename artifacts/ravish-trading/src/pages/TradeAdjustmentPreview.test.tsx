// Trade Adjustment & Roll/Convert Preview Simulator sprint — frontend
// smoke tests for the Trade Adjustment Preview page.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  mutate: vi.fn(),
  data: undefined as unknown,
  isPending: false,
  isError: false,
  trades: undefined as unknown,
  tradesLoading: false,
  brokerHealth: undefined as unknown,
  brokerHealthFetching: false,
  refetchBrokerHealth: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    usePreviewTradeAdjustment: () => ({
      mutate: mockState.mutate,
      data: mockState.data,
      isPending: mockState.isPending,
      isError: mockState.isError,
    }),
    useListTrades: () => ({ data: mockState.trades, isLoading: mockState.tradesLoading }),
    useGetBrokerHealth: () => ({
      data: mockState.brokerHealth,
      isFetching: mockState.brokerHealthFetching,
      refetch: mockState.refetchBrokerHealth,
    }),
  };
});

import TradeAdjustmentPreview from "./TradeAdjustmentPreview";

function tradeFixture(over: Record<string, unknown> = {}) {
  return { id: 1, symbol: "AAPL", strategy: "iron_condor", status: "open", ...over };
}

function existingPositionFixture(over: Record<string, unknown> = {}) {
  return {
    tradeId: 1,
    symbol: "AAPL",
    strategy: "iron_condor",
    strategyLabel: "iron condor",
    expiration: "2026-08-21",
    daysToExpiry: 30,
    legs: [],
    credit: 100,
    maxProfit: 100,
    maxLoss: 380,
    pop: 70,
    costToClose: 80,
    currentPnl: 20,
    isCredit: true,
    ...over,
  };
}

function proposedPositionFixture(over: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    strategy: "iron_condor",
    expiration: "2026-09-21",
    daysToExpiry: 45,
    quantity: 1,
    legs: [
      { occSymbol: "x", side: "sell", optionType: "put", strike: 190, expiration: "2026-09-21", ratioQty: 1, positionIntent: "sell_to_open", price: 2 },
      { occSymbol: "x", side: "sell", optionType: "call", strike: 200, expiration: "2026-09-21", ratioQty: 1, positionIntent: "sell_to_open", price: 2 },
    ],
    netCredit: 130,
    isCredit: true,
    maxProfit: 130,
    maxLoss: 350,
    pop: 72,
    ev: 30,
    ravishScore: 76,
    ravishTier: "Elite",
    returnOnCapital: 0.37,
    buyingPowerRequired: 350,
    accountValue: 125000,
    riskPct: 0.28,
    portfolioRiskBeforePct: 0,
    portfolioRiskAfterPct: 0.28,
    executionMode: "manual",
    canSubmit: false,
    validation: { valid: true, checks: [], violations: [], warnings: [], riskDollars: 350, riskPct: 0.28, portfolioRiskBeforePct: 0, portfolioRiskAfterPct: 0.28 },
    warnings: [],
    adjustment: null,
    ...over,
  };
}

function snapshotFixture(over: Record<string, unknown> = {}) {
  return {
    openPositionsCount: 1,
    totalRiskDollars: 380,
    totalRiskPct: 0.3,
    exposureBySymbol: [{ symbol: "AAPL", riskDollars: 380, pctOfAccount: 0.3 }],
    longExposureDollars: 0,
    shortExposureDollars: 380,
    greeks: { delta: 0, gamma: 0, theta: 0, vega: 0 },
    ...over,
  };
}

function comparisonsFixture() {
  return [
    { code: "max_risk", label: "Maximum Risk", before: 380, after: 350, change: -30, direction: "improved" },
    { code: "max_reward", label: "Maximum Reward", before: 100, after: 130, change: 30, direction: "improved" },
    { code: "buying_power_impact", label: "Buying Power Impact", before: 380, after: 350, change: -30, direction: "improved" },
    { code: "margin_impact", label: "Margin Impact", before: 380, after: 350, change: -30, direction: "improved" },
    { code: "risk_reward_ratio", label: "Risk/Reward Ratio", before: 0.26, after: 0.37, change: 0.11, direction: "improved" },
    { code: "concentration", label: "Portfolio Concentration", before: 0.3, after: 0.28, change: -0.02, direction: "improved" },
  ];
}

function warningsFixture(over: Partial<Record<string, "ok" | "warning" | "blocked">> = {}) {
  const base: Record<string, "ok" | "warning" | "blocked"> = {
    missing_position: "ok",
    invalid_adjustment: "ok",
    buying_power_unavailable: "warning",
    broker_disconnected: "warning",
    missing_credentials: "warning",
    excess_concentration: "ok",
    excess_leverage: "ok",
    existing_conflicting_order: "ok",
    existing_conflicting_adjustment: "ok",
    ...over,
  };
  return Object.entries(base).map(([code, status]) => ({ code, label: code, status, detail: `${code} (${status})` }));
}

function resultFixture(over: Record<string, unknown> = {}) {
  return {
    available: true,
    inputIssues: [],
    intent: "roll_forward",
    intentLabel: "Roll Forward",
    intentAvailable: true,
    intentUnavailableReason: null,
    existingPosition: existingPositionFixture(),
    proposedPosition: proposedPositionFixture(),
    netCashflow: 50,
    greeksBefore: { delta: 0.05, gamma: 0.001, theta: -3, vega: 1.5 },
    greeksAfter: { delta: 0.03, gamma: 0.0009, theta: -2.5, vega: 1.3 },
    breakEvenBefore: [{ label: "Lower", price: 190 }, { label: "Upper", price: 200 }],
    breakEvenBeforeUnavailableReason: null,
    breakEvenAfter: [{ label: "Lower", price: 192 }, { label: "Upper", price: 202 }],
    breakEvenAfterUnavailableReason: null,
    portfolioExposureBefore: snapshotFixture(),
    portfolioExposureAfter: snapshotFixture({ totalRiskDollars: 350, totalRiskPct: 0.28 }),
    comparisons: comparisonsFixture(),
    riskWarnings: warningsFixture(),
    credentialsConfigured: false,
    brokerConnected: null,
    lastBrokerCheckAt: null,
    accountValue: 125000,
    generatedAt: "2026-07-16T10:00:00.000Z",
    ...over,
  };
}

describe("TradeAdjustmentPreview", () => {
  beforeEach(() => {
    mockState.mutate.mockReset();
    mockState.data = undefined;
    mockState.isPending = false;
    mockState.isError = false;
    mockState.trades = [tradeFixture()];
    mockState.tradesLoading = false;
    mockState.brokerHealth = undefined;
    mockState.brokerHealthFetching = false;
    mockState.refetchBrokerHealth.mockReset();
  });

  it("always shows the Paper Trading Mode and Preview Only badges", () => {
    renderWithClient(<TradeAdjustmentPreview />);
    expect(screen.getByTestId("badge-paper-trading-mode")).toHaveTextContent(/paper trading mode/i);
    expect(screen.getByTestId("badge-preview-only")).toHaveTextContent(/preview only.*no adjustment will be submitted/i);
  });

  it("shows an honest empty-positions message when there are no open trades", async () => {
    const user = userEvent.setup();
    mockState.trades = [];
    renderWithClient(<TradeAdjustmentPreview />);
    await user.click(screen.getByTestId("select-adjustment-position"));
    expect(await screen.findByTestId("text-no-open-positions")).toBeInTheDocument();
  });

  it("clicking Preview Only submits the selected position, intent, and quantity", async () => {
    const user = userEvent.setup();
    renderWithClient(<TradeAdjustmentPreview />);
    await user.click(screen.getByTestId("select-adjustment-position"));
    await user.click(await screen.findByText(/#1 · AAPL/i));
    await user.type(screen.getByTestId("input-adjustment-quantity"), "2");
    await user.click(screen.getByTestId("button-preview-adjustment"));
    expect(mockState.mutate).toHaveBeenCalledWith({
      data: { tradeId: 1, intent: "roll_forward", quantity: 2 },
    });
  });

  it("shows a loading state while a preview is being generated", () => {
    mockState.isPending = true;
    renderWithClient(<TradeAdjustmentPreview />);
    expect(screen.getByTestId("adjustment-loading")).toBeInTheDocument();
  });

  it("shows an error state when preview generation fails", () => {
    mockState.isError = true;
    renderWithClient(<TradeAdjustmentPreview />);
    expect(screen.getByTestId("text-adjustment-error")).toBeInTheDocument();
  });

  it("shows honest validation errors for missing required fields", () => {
    mockState.data = resultFixture({
      available: false,
      existingPosition: null,
      proposedPosition: null,
      inputIssues: [{ field: "tradeId", code: "missing_field", message: "A position (tradeId) is required." }],
      intentUnavailableReason: null,
    });
    renderWithClient(<TradeAdjustmentPreview />);
    expect(screen.getByTestId("list-adjustment-input-issues")).toBeInTheDocument();
    expect(screen.getByTestId("text-adjustment-input-issue-tradeId")).toHaveTextContent(/position.*required/i);
    expect(screen.queryByTestId("card-adjustment-comparison")).not.toBeInTheDocument();
  });

  it("shows an honest invalid-adjustment message for a strike-shift intent", () => {
    mockState.data = resultFixture({
      available: false,
      intent: "roll_up",
      intentLabel: "Roll Up",
      intentAvailable: false,
      intentUnavailableReason: "This simulator's reused engine always re-centers every strike...",
      existingPosition: existingPositionFixture(),
      proposedPosition: null,
    });
    renderWithClient(<TradeAdjustmentPreview />);
    expect(screen.getByTestId("text-intent-unavailable-reason")).toHaveTextContent(/re-centers every strike/i);
  });

  it("renders the full Roll Forward before/after comparison", () => {
    mockState.data = resultFixture();
    renderWithClient(<TradeAdjustmentPreview />);
    expect(screen.getByTestId("card-adjustment-comparison")).toBeInTheDocument();
    expect(screen.getByTestId("text-existing-max-risk")).toHaveTextContent("$380.00");
    expect(screen.getByTestId("text-proposed-max-risk")).toHaveTextContent("$350.00");
    expect(screen.getByTestId("text-net-cashflow")).toHaveTextContent("Credit $50.00");
  });

  it("renders a Convert Position comparison with a different proposed strategy", () => {
    mockState.data = resultFixture({
      intent: "convert",
      intentLabel: "Convert Position",
      proposedPosition: proposedPositionFixture({ strategy: "iron_fly" }),
    });
    renderWithClient(<TradeAdjustmentPreview />);
    expect(screen.getByTestId("text-proposed-symbol-strategy")).toHaveTextContent("iron fly");
  });

  it("renders a Close & Replace comparison with no adjustment context on the proposed position", () => {
    mockState.data = resultFixture({ intent: "close_replace", intentLabel: "Close & Replace" });
    renderWithClient(<TradeAdjustmentPreview />);
    expect(screen.getByTestId("card-adjustment-comparison")).toBeInTheDocument();
  });

  it("shows Greeks before and after", () => {
    mockState.data = resultFixture();
    renderWithClient(<TradeAdjustmentPreview />);
    expect(screen.getByTestId("text-greeks-before")).toHaveTextContent("0.05");
    expect(screen.getByTestId("text-greeks-after")).toHaveTextContent("0.03");
  });

  it("shows the honest break-even-unavailable message for a calendar spread", () => {
    mockState.data = resultFixture({
      breakEvenBefore: [],
      breakEvenBeforeUnavailableReason: "Break-even is only computed for single-expiration credit spreads.",
    });
    renderWithClient(<TradeAdjustmentPreview />);
    expect(screen.getByTestId("text-break-even-before-unavailable")).toHaveTextContent(/single-expiration credit spreads/i);
  });

  it("shows portfolio exposure before and after", () => {
    mockState.data = resultFixture();
    renderWithClient(<TradeAdjustmentPreview />);
    expect(screen.getByTestId("text-portfolio-before")).toHaveTextContent("$380.00");
    expect(screen.getByTestId("text-portfolio-after")).toHaveTextContent("$350.00");
  });

  it("renders all 6 metric comparisons with improved/worse/neutral direction badges", () => {
    mockState.data = resultFixture();
    renderWithClient(<TradeAdjustmentPreview />);
    for (const code of ["max_risk", "max_reward", "buying_power_impact", "margin_impact", "risk_reward_ratio", "concentration"]) {
      expect(screen.getByTestId(`badge-comparison-direction-${code}`)).toHaveTextContent("improved");
    }
  });

  it("shows a worse-direction badge honestly when a metric got worse", () => {
    mockState.data = resultFixture({
      comparisons: [{ code: "max_risk", label: "Maximum Risk", before: 380, after: 450, change: 70, direction: "worse" }],
    });
    renderWithClient(<TradeAdjustmentPreview />);
    expect(screen.getByTestId("badge-comparison-direction-max_risk")).toHaveTextContent("worse");
  });

  it("shows an excess-concentration blocked warning for a large adjustment", () => {
    mockState.data = resultFixture({ riskWarnings: warningsFixture({ excess_concentration: "blocked" }) });
    renderWithClient(<TradeAdjustmentPreview />);
    expect(screen.getByTestId("badge-adjustment-warning-excess_concentration")).toHaveTextContent("blocked");
  });

  it("shows a buying-power-unavailable warning", () => {
    mockState.data = resultFixture();
    renderWithClient(<TradeAdjustmentPreview />);
    expect(screen.getByTestId("badge-adjustment-warning-buying_power_unavailable")).toHaveTextContent("warning");
  });

  it("shows a missing-credentials warning", () => {
    mockState.data = resultFixture();
    renderWithClient(<TradeAdjustmentPreview />);
    expect(screen.getByTestId("badge-adjustment-warning-missing_credentials")).toHaveTextContent("warning");
  });

  it("shows the Broker Connection Status card's not-yet-checked state before any manual check", () => {
    renderWithClient(<TradeAdjustmentPreview />);
    expect(screen.getByTestId("text-broker-health-not-checked")).toBeInTheDocument();
  });

  it("shows a real broker-disconnected status once Refresh Broker Health has been checked", () => {
    mockState.brokerHealth = { connected: false, reason: "No Alpaca credentials configured" };
    mockState.data = resultFixture({ brokerConnected: false, riskWarnings: warningsFixture({ broker_disconnected: "warning" }) });
    renderWithClient(<TradeAdjustmentPreview />);
    expect(screen.getByTestId("badge-broker-connection-status")).toHaveTextContent(/disconnected/i);
    expect(screen.getByTestId("badge-adjustment-warning-broker_disconnected")).toHaveTextContent("warning");
  });

  it("clicking Refresh Broker Health triggers its own refetch, independent of the preview mutation", async () => {
    const user = userEvent.setup();
    renderWithClient(<TradeAdjustmentPreview />);
    await user.click(screen.getByTestId("button-refresh-broker-health"));
    expect(mockState.refetchBrokerHealth).toHaveBeenCalledTimes(1);
    expect(mockState.mutate).not.toHaveBeenCalled();
  });
});
