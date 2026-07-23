// Position Sizing & Portfolio Impact Calculator sprint — frontend smoke
// tests for the Position Sizing page.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  mutate: vi.fn(),
  data: undefined as unknown,
  isPending: false,
  isError: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    usePreviewPositionSizing: () => ({
      mutate: mockState.mutate,
      data: mockState.data,
      isPending: mockState.isPending,
      isError: mockState.isError,
    }),
  };
});

import PositionSizing from "./PositionSizing";

function ticketFixture(over: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    strategy: "iron_condor",
    quantity: 1,
    netCredit: 120,
    isCredit: true,
    maxProfit: 120,
    maxLoss: 380,
    buyingPowerRequired: 380,
    riskPct: 0.3,
    portfolioRiskBeforePct: 1.2,
    portfolioRiskAfterPct: 1.5,
    entryPricePerSpread: 120,
    notionalValue: 65000,
    marginImpact: 380,
    riskRewardRatio: 0.3158,
    ...over,
  };
}

function previewFixture(over: Record<string, unknown> = {}) {
  return {
    available: true,
    inputIssues: [],
    ticket: ticketFixture(),
    preTradeChecklist: [],
    credentialsConfigured: false,
    brokerConnected: null,
    lastBrokerCheckAt: null,
    accountValue: 125000,
    generatedAt: "2026-07-16T10:00:00.000Z",
    ...over,
  };
}

function greeksFixture(over: Record<string, unknown> = {}) {
  return { delta: 0, gamma: 0, theta: 0, vega: 0, ...over };
}

function snapshotFixture(over: Record<string, unknown> = {}) {
  return {
    openPositionsCount: 0,
    totalRiskDollars: 0,
    totalRiskPct: 0,
    exposureBySymbol: [],
    longExposureDollars: 0,
    shortExposureDollars: 0,
    greeks: greeksFixture(),
    ...over,
  };
}

function warningFixture(code: string, status: "ok" | "warning" | "blocked", detail: string, label?: string) {
  return { code, label: label ?? code, status, detail };
}

function resultFixture(over: Record<string, unknown> = {}) {
  return {
    preview: previewFixture(),
    positionSizing: {
      recommendedQuantity: 3,
      positionSizePctOfPortfolio: 0.3,
      buyingPowerUtilizationPct: 0.3,
      capitalAtRisk: 380,
      maxTheoreticalLoss: 380,
      maxTheoreticalGain: 120,
      breakEvens: [
        { label: "Lower", price: 190 },
        { label: "Upper", price: 200 },
      ],
      breakEvenUnavailableReason: null,
      riskRewardRatio: 0.3158,
      concentrationBeforePct: 1.2,
      concentrationAfterPct: 1.5,
    },
    portfolioImpact: {
      current: snapshotFixture(),
      hypothetical: snapshotFixture({ openPositionsCount: 1, totalRiskDollars: 380, exposureBySymbol: [{ symbol: "AAPL", riskDollars: 380, pctOfAccount: 0.3 }] }),
      sectorExposure: { available: false, reason: "No sector/industry classification is stored on options positions in this engine." },
      deltaImpact: 0.05,
      thetaImpact: -2.5,
      gammaImpact: 0.001,
      vegaImpact: 1.2,
    },
    riskWarnings: [
      warningFixture("oversized_position", "ok", "Per-trade risk within cap.", "Oversized position"),
      warningFixture("excess_concentration", "ok", "Portfolio risk within cap.", "Excess concentration"),
      warningFixture("buying_power_exhaustion", "ok", "Utilization is low.", "Buying power exhaustion"),
      warningFixture("excess_leverage", "ok", "Leverage within cap.", "Excess leverage"),
      warningFixture("position_conflict", "ok", "No open position exists in this symbol.", "Existing position conflict"),
      warningFixture("existing_order", "ok", "No pending order exists for this symbol.", "Existing open order conflict"),
      warningFixture(
        "missing_broker_data",
        "warning",
        "No successful Broker Health check exists this session — every portfolio figure below is computed from this platform's own local trade records, not live Alpaca account data.",
        "Missing broker data",
      ),
      warningFixture(
        "missing_credentials",
        "warning",
        "No Alpaca Paper Trading credentials are configured.",
        "Missing credentials",
      ),
    ],
    scenarios: [
      { label: "50%", quantity: 1, available: true, unavailableReason: null, capitalAtRisk: 190, buyingPowerRequired: 190, buyingPowerUtilizationPct: 0.15, concentrationAfterPct: 0.7 },
      { label: "75%", quantity: 2, available: true, unavailableReason: null, capitalAtRisk: 285, buyingPowerRequired: 285, buyingPowerUtilizationPct: 0.23, concentrationAfterPct: 1.1 },
      { label: "100% (Current)", quantity: 3, available: true, unavailableReason: null, capitalAtRisk: 380, buyingPowerRequired: 380, buyingPowerUtilizationPct: 0.3, concentrationAfterPct: 1.5 },
    ],
    generatedAt: "2026-07-16T10:00:00.000Z",
    ...over,
  };
}

describe("PositionSizing", () => {
  beforeEach(() => {
    mockState.mutate.mockReset();
    mockState.data = undefined;
    mockState.isPending = false;
    mockState.isError = false;
  });

  it("always shows the Paper Trading Mode and Preview Only badges", () => {
    renderWithClient(<PositionSizing />);
    expect(screen.getByTestId("badge-paper-trading-mode")).toHaveTextContent(/paper trading mode/i);
    expect(screen.getByTestId("badge-preview-only")).toHaveTextContent(/preview only.*no order will be submitted/i);
  });

  it("clicking Preview Only submits symbol, strategy, quantity, and customQuantity", async () => {
    const user = userEvent.setup();
    renderWithClient(<PositionSizing />);
    await user.type(screen.getByTestId("input-sizing-symbol"), "msft");
    await user.clear(screen.getByTestId("input-sizing-quantity"));
    await user.type(screen.getByTestId("input-sizing-quantity"), "4");
    await user.type(screen.getByTestId("input-sizing-custom-quantity"), "6");
    await user.click(screen.getByTestId("button-analyze-position-sizing"));
    expect(mockState.mutate).toHaveBeenCalledWith({
      data: { symbol: "MSFT", strategy: "iron_condor", quantity: 4, customQuantity: 6 },
    });
  });

  it("shows a loading state while analysis is in progress", () => {
    mockState.isPending = true;
    renderWithClient(<PositionSizing />);
    expect(screen.getByTestId("sizing-loading")).toBeInTheDocument();
  });

  it("shows an error state when analysis fails", () => {
    mockState.isError = true;
    renderWithClient(<PositionSizing />);
    expect(screen.getByTestId("text-sizing-error")).toBeInTheDocument();
  });

  it("shows honest validation errors when the preview itself is unavailable", () => {
    mockState.data = resultFixture({
      preview: previewFixture({
        available: false,
        ticket: null,
        inputIssues: [{ field: "symbol", code: "missing_field", message: "Symbol is required." }],
      }),
      positionSizing: null,
      portfolioImpact: {
        current: snapshotFixture(),
        hypothetical: null,
        sectorExposure: { available: false, reason: "No sector/industry classification is stored on options positions in this engine." },
        deltaImpact: null,
        thetaImpact: null,
        gammaImpact: null,
        vegaImpact: null,
      },
      scenarios: [],
    });
    renderWithClient(<PositionSizing />);
    expect(screen.getByTestId("list-sizing-input-issues")).toBeInTheDocument();
    expect(screen.getByTestId("text-sizing-input-issue-symbol")).toHaveTextContent(/symbol is required/i);
    expect(screen.queryByTestId("card-position-sizing")).not.toBeInTheDocument();
    expect(screen.getByTestId("text-hypothetical-unavailable")).toBeInTheDocument();
  });

  it("renders the full Position Sizing card for a valid preview", () => {
    mockState.data = resultFixture();
    renderWithClient(<PositionSizing />);
    expect(screen.getByTestId("card-position-sizing")).toBeInTheDocument();
    expect(screen.getByTestId("text-recommended-quantity")).toHaveTextContent("3");
    expect(screen.getByTestId("text-position-size-pct")).toHaveTextContent("0.30%");
    expect(screen.getByTestId("text-buying-power-utilization")).toHaveTextContent("0.30%");
    expect(screen.getByTestId("text-capital-at-risk")).toHaveTextContent("$380.00");
    expect(screen.getByTestId("text-max-theoretical-loss")).toHaveTextContent("$380.00");
    expect(screen.getByTestId("text-max-theoretical-gain")).toHaveTextContent("$120.00");
    expect(screen.getByTestId("text-sizing-risk-reward-ratio")).toHaveTextContent("1 : 0.32");
    expect(screen.getByTestId("text-concentration-before")).toHaveTextContent("1.20%");
    expect(screen.getByTestId("text-concentration-after")).toHaveTextContent("1.50%");
    expect(screen.getByTestId("text-break-even-lower")).toHaveTextContent("$190.00");
    expect(screen.getByTestId("text-break-even-upper")).toHaveTextContent("$200.00");
  });

  it("shows the honest break-even-unavailable message for a calendar spread", () => {
    mockState.data = resultFixture({
      positionSizing: {
        recommendedQuantity: 1,
        positionSizePctOfPortfolio: 0.1,
        buyingPowerUtilizationPct: 0.1,
        capitalAtRisk: 100,
        maxTheoreticalLoss: 100,
        maxTheoreticalGain: 150,
        breakEvens: [],
        breakEvenUnavailableReason: "Break-even is only computed for single-expiration credit spreads.",
        riskRewardRatio: 1.5,
        concentrationBeforePct: 0,
        concentrationAfterPct: 0.1,
      },
    });
    renderWithClient(<PositionSizing />);
    expect(screen.getByTestId("text-break-even-unavailable")).toHaveTextContent(/single-expiration credit spreads/i);
  });

  it("shows an honest empty-portfolio message for the current portfolio when there are no open positions", () => {
    mockState.data = resultFixture();
    renderWithClient(<PositionSizing />);
    expect(screen.getByTestId("text-current-empty")).toBeInTheDocument();
    expect(screen.getByTestId("text-current-open-positions")).toHaveTextContent("0");
  });

  it("shows multiple current positions grouped by symbol", () => {
    mockState.data = resultFixture({
      portfolioImpact: {
        current: snapshotFixture({
          openPositionsCount: 3,
          totalRiskDollars: 930,
          totalRiskPct: 0.74,
          exposureBySymbol: [
            { symbol: "MSFT", riskDollars: 430, pctOfAccount: 0.34 },
            { symbol: "NVDA", riskDollars: 500, pctOfAccount: 0.4 },
          ],
          longExposureDollars: 80,
          shortExposureDollars: 850,
        }),
        hypothetical: snapshotFixture({ openPositionsCount: 4 }),
        sectorExposure: { available: false, reason: "No sector/industry classification is stored on options positions in this engine." },
        deltaImpact: 0.02,
        thetaImpact: -1,
        gammaImpact: 0.001,
        vegaImpact: 0.5,
      },
    });
    renderWithClient(<PositionSizing />);
    expect(screen.getByTestId("text-current-open-positions")).toHaveTextContent("3");
    expect(screen.getByTestId("text-current-exposure-MSFT")).toHaveTextContent("$430.00");
    expect(screen.getByTestId("text-current-exposure-NVDA")).toHaveTextContent("$500.00");
    expect(screen.getByTestId("text-current-long-short")).toHaveTextContent("$80.00");
    expect(screen.getByTestId("text-current-long-short")).toHaveTextContent("$850.00");
  });

  it("clearly distinguishes current from hypothetical portfolio sections", () => {
    mockState.data = resultFixture();
    renderWithClient(<PositionSizing />);
    expect(screen.getByTestId("section-current-portfolio")).toHaveTextContent(/current portfolio/i);
    expect(screen.getByTestId("section-hypothetical-portfolio")).toHaveTextContent(/hypothetical post-preview portfolio/i);
    expect(screen.getByTestId("text-hypothetical-open-positions")).toHaveTextContent("1");
  });

  it("shows the estimated Greeks impact (delta/theta/gamma/vega)", () => {
    mockState.data = resultFixture();
    renderWithClient(<PositionSizing />);
    expect(screen.getByTestId("text-delta-impact")).toHaveTextContent("0.05");
    expect(screen.getByTestId("text-theta-impact")).toHaveTextContent("-2.5");
    expect(screen.getByTestId("text-gamma-impact")).toHaveTextContent("0.001");
    expect(screen.getByTestId("text-vega-impact")).toHaveTextContent("1.2");
  });

  it("always honestly discloses sector exposure as unavailable", () => {
    mockState.data = resultFixture();
    renderWithClient(<PositionSizing />);
    expect(screen.getByTestId("text-sector-exposure-unavailable")).toHaveTextContent(/sector/i);
  });

  it("shows an oversized-position / excess-concentration blocked warning for a large position", () => {
    mockState.data = resultFixture({
      riskWarnings: [
        warningFixture("oversized_position", "blocked", "Trade risk exceeds the 1% per-trade cap", "Oversized position"),
        warningFixture("excess_concentration", "blocked", "Opening this trade would raise portfolio risk above the cap", "Excess concentration"),
      ],
    });
    renderWithClient(<PositionSizing />);
    expect(screen.getByTestId("badge-warning-oversized_position")).toHaveTextContent("blocked");
    expect(screen.getByTestId("badge-warning-excess_concentration")).toHaveTextContent("blocked");
  });

  it("shows a buying-power-exhaustion blocked warning", () => {
    mockState.data = resultFixture({
      riskWarnings: [warningFixture("buying_power_exhaustion", "blocked", "This order would use 95% of local account value (cap 90%).", "Buying power exhaustion")],
    });
    renderWithClient(<PositionSizing />);
    expect(screen.getByTestId("badge-warning-buying_power_exhaustion")).toHaveTextContent("blocked");
    expect(screen.getByTestId("warning-item-buying_power_exhaustion")).toHaveTextContent(/95%/);
  });

  it("shows an honest missing-credentials warning", () => {
    mockState.data = resultFixture();
    renderWithClient(<PositionSizing />);
    expect(screen.getByTestId("badge-warning-missing_credentials")).toHaveTextContent("warning");
  });

  it("shows an honest missing-broker-data warning", () => {
    mockState.data = resultFixture();
    renderWithClient(<PositionSizing />);
    const item = screen.getByTestId("warning-item-missing_broker_data");
    expect(item).toHaveTextContent(/local trade records/i);
  });

  it("renders a scenario comparison table with 50%/75%/100% rows", () => {
    mockState.data = resultFixture();
    renderWithClient(<PositionSizing />);
    expect(screen.getByTestId("table-scenarios")).toBeInTheDocument();
    expect(screen.getByTestId("row-scenario-50-")).toHaveTextContent("$190.00");
    expect(screen.getByTestId("row-scenario-75-")).toHaveTextContent("$285.00");
    expect(screen.getByTestId("row-scenario-100-Current-")).toHaveTextContent("$380.00");
  });

  it("shows a 4th Custom scenario row when supplied", () => {
    mockState.data = resultFixture({
      scenarios: [
        { label: "50%", quantity: 2, available: true, unavailableReason: null, capitalAtRisk: 190, buyingPowerRequired: 190, buyingPowerUtilizationPct: 0.15, concentrationAfterPct: 0.7 },
        { label: "75%", quantity: 3, available: true, unavailableReason: null, capitalAtRisk: 285, buyingPowerRequired: 285, buyingPowerUtilizationPct: 0.23, concentrationAfterPct: 1.1 },
        { label: "100% (Current)", quantity: 4, available: true, unavailableReason: null, capitalAtRisk: 380, buyingPowerRequired: 380, buyingPowerUtilizationPct: 0.3, concentrationAfterPct: 1.5 },
        { label: "Custom", quantity: 6, available: true, unavailableReason: null, capitalAtRisk: 570, buyingPowerRequired: 570, buyingPowerUtilizationPct: 0.46, concentrationAfterPct: 2.3 },
      ],
    });
    renderWithClient(<PositionSizing />);
    expect(screen.getByTestId("row-scenario-Custom")).toHaveTextContent("$570.00");
  });

  it("shows an honest unavailable reason for a scenario that could not be computed", () => {
    mockState.data = resultFixture({
      scenarios: [
        { label: "50%", quantity: 1, available: false, unavailableReason: "Preview unavailable for this quantity.", capitalAtRisk: null, buyingPowerRequired: null, buyingPowerUtilizationPct: null, concentrationAfterPct: null },
      ],
    });
    renderWithClient(<PositionSizing />);
    expect(screen.getByTestId("text-scenario-unavailable-50-")).toHaveTextContent(/preview unavailable/i);
  });

  it("does not render the scenario table at all when the base preview is unavailable", () => {
    mockState.data = resultFixture({
      preview: previewFixture({ available: false, ticket: null, inputIssues: [{ field: "symbol", code: "missing_field", message: "Symbol is required." }] }),
      positionSizing: null,
      scenarios: [],
    });
    renderWithClient(<PositionSizing />);
    expect(screen.queryByTestId("table-scenarios")).not.toBeInTheDocument();
  });
});
