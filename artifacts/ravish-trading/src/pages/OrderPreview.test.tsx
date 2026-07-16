// Paper Trading Order Preview & Risk Simulator sprint — frontend smoke
// tests for the Order Preview page.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  previewMutate: vi.fn(),
  previewData: undefined as unknown,
  previewPending: false,
  previewError: false,
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
    usePreviewOrder: () => ({
      mutate: mockState.previewMutate,
      data: mockState.previewData,
      isPending: mockState.previewPending,
      isError: mockState.previewError,
    }),
    useGetBrokerHealth: () => ({
      data: mockState.brokerHealth,
      isFetching: mockState.brokerHealthFetching,
      refetch: mockState.refetchBrokerHealth,
    }),
  };
});

import OrderPreview from "./OrderPreview";

function ticketFixture(over: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    strategy: "iron_condor",
    expiration: "2026-08-21",
    daysToExpiry: 30,
    quantity: 1,
    legs: [],
    netCredit: 120,
    isCredit: true,
    maxProfit: 120,
    maxLoss: 380,
    pop: 0.72,
    ev: 25,
    ravishScore: 74,
    ravishTier: "Elite",
    returnOnCapital: 0.31,
    buyingPowerRequired: 380,
    accountValue: 125000,
    riskPct: 0.3,
    portfolioRiskBeforePct: 1.2,
    portfolioRiskAfterPct: 1.5,
    executionMode: "manual",
    canSubmit: false,
    validation: { valid: true, checks: [], violations: [], warnings: [], riskDollars: 380, riskPct: 0.3, portfolioRiskBeforePct: 1.2, portfolioRiskAfterPct: 1.5 },
    warnings: [],
    adjustment: null,
    entryPricePerSpread: 120,
    notionalValue: 65000,
    marginImpact: 380,
    riskRewardRatio: 0.3158,
    ...over,
  };
}

function checklistFixture(over: Partial<Record<string, "ok" | "warning" | "blocked">> = {}) {
  const base: Record<string, "ok" | "warning" | "blocked"> = {
    required_fields: "ok",
    quantity_valid: "ok",
    symbol_valid: "ok",
    buying_power: "warning",
    broker_connection: "warning",
    credentials: "warning",
    position_conflict: "ok",
    existing_order: "ok",
    ...over,
  };
  const details: Record<string, Record<"ok" | "warning" | "blocked", string>> = {
    credentials: {
      ok: "Alpaca Paper Trading credentials are configured.",
      warning:
        "No Alpaca Paper Trading credentials are configured — this preview is fully computable without them, but no real order could ever be routed.",
      blocked: "",
    },
    buying_power: {
      ok: "Verified against the most recent Broker Health check.",
      warning:
        "No successful Broker Health check yet — the buying power impact shown is a local estimate only, not verified against a live Alpaca account.",
      blocked: "Local account value is not positive — buying power cannot be estimated.",
    },
    broker_connection: {
      ok: "The most recent Broker Health check reported a connected Alpaca Paper Trading account.",
      warning: "The most recent Broker Health check reported the broker as disconnected.",
      blocked: "",
    },
  };
  return Object.entries(base).map(([code, status]) => ({
    code,
    label: code,
    status,
    detail: details[code]?.[status] || `${code} detail (${status})`,
  }));
}

function resultFixture(over: Record<string, unknown> = {}) {
  return {
    available: true,
    inputIssues: [],
    ticket: ticketFixture(),
    preTradeChecklist: checklistFixture(),
    credentialsConfigured: false,
    brokerConnected: null,
    lastBrokerCheckAt: null,
    accountValue: 125000,
    generatedAt: "2026-07-16T10:00:00.000Z",
    ...over,
  };
}

describe("OrderPreview", () => {
  beforeEach(() => {
    mockState.previewMutate.mockReset();
    mockState.previewData = undefined;
    mockState.previewPending = false;
    mockState.previewError = false;
    mockState.brokerHealth = undefined;
    mockState.brokerHealthFetching = false;
    mockState.refetchBrokerHealth.mockReset();
  });

  it("always shows the Paper Trading Mode badge and the no-order-submitted notice", () => {
    renderWithClient(<OrderPreview />);
    expect(screen.getByTestId("badge-paper-trading-mode")).toHaveTextContent(/paper trading mode/i);
    expect(screen.getByTestId("text-no-order-submitted-notice")).toHaveTextContent(/no order will be submitted/i);
  });

  it("shows no result section before any preview has been requested (empty preview)", () => {
    renderWithClient(<OrderPreview />);
    expect(screen.queryByTestId("card-preview-result")).not.toBeInTheDocument();
    expect(screen.queryByTestId("list-pretrade-checklist")).not.toBeInTheDocument();
  });

  it("clicking Preview Only submits the entered symbol, strategy, and quantity", async () => {
    const user = userEvent.setup();
    renderWithClient(<OrderPreview />);
    await user.type(screen.getByTestId("input-preview-symbol"), "msft");
    await user.clear(screen.getByTestId("input-preview-quantity"));
    await user.type(screen.getByTestId("input-preview-quantity"), "3");
    await user.click(screen.getByTestId("button-preview-only"));
    expect(mockState.previewMutate).toHaveBeenCalledWith({
      data: { symbol: "MSFT", strategy: "iron_condor", quantity: 3 },
    });
  });

  it("shows a loading state while a preview is being generated", () => {
    mockState.previewPending = true;
    renderWithClient(<OrderPreview />);
    expect(screen.getByTestId("preview-loading")).toBeInTheDocument();
  });

  it("shows an error state when preview generation fails", () => {
    mockState.previewError = true;
    renderWithClient(<OrderPreview />);
    expect(screen.getByTestId("text-preview-error")).toBeInTheDocument();
  });

  it("shows honest validation errors for missing required fields", () => {
    mockState.previewData = resultFixture({
      available: false,
      ticket: null,
      inputIssues: [{ field: "symbol", code: "missing_field", message: "Symbol is required." }],
    });
    renderWithClient(<OrderPreview />);
    expect(screen.getByTestId("list-input-issues")).toBeInTheDocument();
    expect(screen.getByTestId("text-input-issue-symbol")).toHaveTextContent(/symbol is required/i);
    expect(screen.queryByTestId("card-preview-result")).not.toBeInTheDocument();
  });

  it("shows an honest invalid symbol message", () => {
    mockState.previewData = resultFixture({
      available: false,
      ticket: null,
      inputIssues: [{ field: "symbol", code: "unresolvable_symbol", message: "Unable to resolve a iron_condor quote for ZZZZZZ." }],
    });
    renderWithClient(<OrderPreview />);
    expect(screen.getByTestId("text-input-issue-symbol")).toHaveTextContent(/unable to resolve/i);
  });

  it("shows an honest invalid quantity message", () => {
    mockState.previewData = resultFixture({
      available: false,
      ticket: null,
      inputIssues: [{ field: "quantity", code: "invalid_quantity", message: "Quantity must be a positive whole number." }],
    });
    renderWithClient(<OrderPreview />);
    expect(screen.getByTestId("text-input-issue-quantity")).toHaveTextContent(/positive whole number/i);
  });

  it("renders a successful preview generation with every requested field", () => {
    mockState.previewData = resultFixture();
    renderWithClient(<OrderPreview />);
    const card = screen.getByTestId("card-preview-result");
    expect(card).toBeInTheDocument();
    expect(screen.getByTestId("text-preview-quantity")).toHaveTextContent("1");
    expect(screen.getByTestId("text-preview-entry-price")).toHaveTextContent("$120.00");
    expect(screen.getByTestId("text-preview-notional-value")).toHaveTextContent("$65,000.00");
    expect(screen.getByTestId("text-preview-buying-power-impact")).toHaveTextContent("-$380.00");
    expect(screen.getByTestId("text-preview-margin-impact")).toHaveTextContent("$380.00");
    expect(screen.getByTestId("text-preview-max-risk")).toHaveTextContent("$380.00");
    expect(screen.getByTestId("text-preview-max-reward")).toHaveTextContent("$120.00");
    expect(screen.getByTestId("text-preview-risk-reward-ratio")).toHaveTextContent("1 : 0.32");
    expect(screen.getByTestId("text-preview-account-value")).toHaveTextContent("$125,000.00");
    expect(screen.getByTestId("text-local-data-disclosure")).toBeInTheDocument();
    expect(screen.getByTestId("list-pretrade-checklist")).toBeInTheDocument();
  });

  it("shows an honest missing-credentials warning in the checklist", () => {
    mockState.previewData = resultFixture({ credentialsConfigured: false });
    renderWithClient(<OrderPreview />);
    const item = screen.getByTestId("checklist-item-credentials");
    expect(item).toHaveTextContent(/no alpaca paper trading credentials/i);
    expect(screen.getByTestId("badge-checklist-credentials")).toHaveTextContent("warning");
  });

  it("shows an honest broker-disconnected warning in the checklist", () => {
    mockState.previewData = resultFixture({
      brokerConnected: false,
      preTradeChecklist: checklistFixture({ broker_connection: "warning" }),
    });
    renderWithClient(<OrderPreview />);
    expect(screen.getByTestId("badge-checklist-broker_connection")).toHaveTextContent("warning");
  });

  it("shows an honest buying-power-unavailable (local estimate) warning in the checklist", () => {
    mockState.previewData = resultFixture({
      preTradeChecklist: checklistFixture({ buying_power: "warning" }),
    });
    renderWithClient(<OrderPreview />);
    const item = screen.getByTestId("checklist-item-buying_power");
    expect(item).toBeInTheDocument();
    expect(screen.getByTestId("badge-checklist-buying_power")).toHaveTextContent("warning");
  });

  it("shows a position-conflict warning when flagged", () => {
    mockState.previewData = resultFixture({
      preTradeChecklist: checklistFixture({ position_conflict: "warning", existing_order: "warning" }),
    });
    renderWithClient(<OrderPreview />);
    expect(screen.getByTestId("badge-checklist-position_conflict")).toHaveTextContent("warning");
    expect(screen.getByTestId("badge-checklist-existing_order")).toHaveTextContent("warning");
  });

  it("shows the Broker Connection Status card's not-yet-checked state before any manual check", () => {
    renderWithClient(<OrderPreview />);
    expect(screen.getByTestId("text-broker-health-not-checked")).toBeInTheDocument();
  });

  it("shows a real broker connection status once Refresh Broker Health has been checked", async () => {
    mockState.brokerHealth = { connected: false, reason: "No Alpaca credentials configured" };
    renderWithClient(<OrderPreview />);
    expect(screen.getByTestId("badge-broker-connection-status")).toHaveTextContent(/disconnected/i);
    expect(screen.getByTestId("text-broker-health-reason")).toHaveTextContent(/no alpaca credentials/i);
  });

  it("clicking Refresh Broker Health triggers its own refetch, independent of the preview mutation", async () => {
    const user = userEvent.setup();
    renderWithClient(<OrderPreview />);
    await user.click(screen.getByTestId("button-refresh-broker-health"));
    expect(mockState.refetchBrokerHealth).toHaveBeenCalledTimes(1);
    expect(mockState.previewMutate).not.toHaveBeenCalled();
  });
});
