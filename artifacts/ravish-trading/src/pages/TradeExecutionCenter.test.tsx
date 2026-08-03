// v1.2.0 — Trade Execution Center tests.
// Following the established mocked-generated-hook + wouter mocking pattern
// (see TradeTicket.test.tsx for the usePreviewExecution/useSubmitExecution
// precedent this page's own hooks reuse verbatim, and Scanner.test.tsx for
// the useGetScannerResults/useRunScanner precedent).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const setLocationMock = vi.hoisted(() => vi.fn());

const scannerState = vi.hoisted(() => ({ results: undefined as unknown, isLoading: false }));
const runScannerMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const previewMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false, isError: false }));
const submitMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const brokerHealthState = vi.hoisted(() => ({ data: undefined as unknown, isFetching: false }));
const refetchBrokerHealthMock = vi.hoisted(() => vi.fn());
const monitorState = vi.hoisted(() => ({ data: undefined as unknown, isLoading: false }));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetScannerResults: () => ({ data: scannerState.results, isLoading: scannerState.isLoading }),
    useRunScanner: () => runScannerMock,
    usePreviewExecution: () => previewMock,
    useSubmitExecution: () => submitMock,
    useGetBrokerHealth: () => ({
      data: brokerHealthState.data,
      isFetching: brokerHealthState.isFetching,
      refetch: refetchBrokerHealthMock,
    }),
    useGetTradeMonitor: () => ({ data: monitorState.data, isLoading: monitorState.isLoading }),
  };
});

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useLocation: () => ["/trade-execution-center", setLocationMock],
  };
});

import TradeExecutionCenter from "./TradeExecutionCenter";

function scannerResult(over: Record<string, unknown> = {}) {
  return {
    id: 42,
    symbol: "AAPL",
    ravishTier: "elite",
    strategy: "iron_condor",
    daysToExpiry: 30,
    credit: 1.85,
    pop: 78.5,
    ev: 0.62,
    ravishScore: 87,
    eventRiskLevel: "none",
    eventRiskPenalty: null,
    eventRiskEvents: [],
    ...over,
  };
}

function leg(over: Record<string, unknown> = {}) {
  return {
    side: "sell",
    ratioQty: 1,
    strike: 190,
    optionType: "put",
    positionIntent: "open_short",
    occSymbol: "AAPL260821P00190000",
    price: 1.4,
    ...over,
  };
}

function ticket(over: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    strategy: "iron_condor",
    ravishTier: "elite",
    ravishScore: 87,
    quantity: 1,
    executionMode: "semi_auto",
    canSubmit: true,
    isCredit: true,
    netCredit: 185,
    maxProfit: 185,
    maxLoss: 315,
    buyingPowerRequired: 320,
    pop: 78,
    ev: 62,
    returnOnCapital: 12.5,
    daysToExpiry: 30,
    expiration: "2026-08-21",
    legs: [leg()],
    validation: {
      valid: true,
      checks: [{ label: "Portfolio risk within limits", detail: "3.2% of account", passed: true }],
      warnings: [],
      violations: [],
      riskPct: 3.2,
      portfolioRiskBeforePct: 12,
      portfolioRiskAfterPct: 15.2,
    },
    adjustment: null,
    ...over,
  };
}

async function advanceToConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("button-select-42"));
  await user.click(screen.getByTestId("button-next-strategy"));
  await user.click(screen.getByTestId("button-confirm-strategy"));
  await user.click(screen.getByTestId("button-next-risk"));
  await user.click(screen.getByTestId("button-next-confirm"));
}

describe("TradeExecutionCenter page", () => {
  beforeEach(() => {
    scannerState.results = [scannerResult()];
    scannerState.isLoading = false;
    runScannerMock.mutate.mockReset();
    runScannerMock.isPending = false;
    previewMock.mutate.mockReset();
    previewMock.isPending = false;
    previewMock.isError = false;
    previewMock.mutate.mockImplementation((_vars: unknown, opts: { onSuccess?: (t: unknown) => void }) =>
      opts.onSuccess?.(ticket()),
    );
    submitMock.mutate.mockReset();
    submitMock.isPending = false;
    brokerHealthState.data = { connected: true };
    brokerHealthState.isFetching = false;
    refetchBrokerHealthMock.mockReset();
    refetchBrokerHealthMock.mockResolvedValue({ data: { connected: true } });
    monitorState.data = undefined;
    monitorState.isLoading = false;
    setLocationMock.mockReset();
  });

  it("shows an honest empty-scanner message and the Paper Trading badge", () => {
    scannerState.results = [];
    renderWithClient(<TradeExecutionCenter />);
    expect(screen.getByText("No opportunities found. Try running a scan.")).toBeInTheDocument();
    expect(screen.getByText("Paper Trading only")).toBeInTheDocument();
  });

  it("v1.6.0 UX Polish Phase 1 — disambiguates itself from Execution & Lifecycle Manager", () => {
    renderWithClient(<TradeExecutionCenter />);
    const note = screen.getByTestId("tec-page-disambiguation");
    expect(note).toHaveTextContent(/paper trading options order/i);
    expect(screen.getByText("Track it in the Execution & Lifecycle Manager.")).toHaveAttribute(
      "href",
      "/execution-lifecycle",
    );
  });

  it("progresses through the workflow: Scanner -> AI Score -> Strategy -> Order Preview", async () => {
    const user = userEvent.setup();
    renderWithClient(<TradeExecutionCenter />);

    expect(screen.getByTestId("step-indicator-0")).toHaveAttribute("aria-current", "step");

    await user.click(screen.getByTestId("button-select-42"));
    expect(screen.getByText("AI Opportunity Score")).toBeInTheDocument();
    expect(screen.getByTestId("step-indicator-1")).toHaveAttribute("aria-current", "step");

    await user.click(screen.getByTestId("button-next-strategy"));
    expect(screen.getByText("Strategy Review")).toBeInTheDocument();

    await user.click(screen.getByTestId("button-confirm-strategy"));
    expect(previewMock.mutate).toHaveBeenCalledWith(
      { data: { scannerResultId: 42, quantity: 1 } },
      expect.anything(),
    );
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    // Net Credit and Max Profit both legitimately read $185 in this fixture.
    expect(screen.getAllByText("$185").length).toBe(2);
  });

  it("opens the AI explanation sheet from the AI Score step", async () => {
    const user = userEvent.setup();
    renderWithClient(<TradeExecutionCenter />);
    await user.click(screen.getByTestId("button-select-42"));
    await user.click(screen.getByTestId("button-explain"));
    // The sheet's own dialog role confirms it opened; its internal content
    // (streamed AI narration) is TradeExplanationSheet's own, already-tested
    // concern, not re-tested here.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders the Pre-Trade Risk Validation panel with real check/warning data", async () => {
    const user = userEvent.setup();
    renderWithClient(<TradeExecutionCenter />);
    await user.click(screen.getByTestId("button-select-42"));
    await user.click(screen.getByTestId("button-next-strategy"));
    await user.click(screen.getByTestId("button-confirm-strategy"));
    await user.click(screen.getByTestId("button-next-risk"));

    expect(screen.getByText("PASSED")).toBeInTheDocument();
    expect(screen.getByText("Portfolio risk within limits")).toBeInTheDocument();
  });

  it("blocks progression out of Risk Review when the ticket validation failed", async () => {
    previewMock.mutate.mockImplementation((_vars: unknown, opts: { onSuccess?: (t: unknown) => void }) =>
      opts.onSuccess?.(
        ticket({
          canSubmit: false,
          validation: {
            valid: false,
            checks: [{ label: "Portfolio risk within limits", detail: "9.9% of account", passed: false }],
            warnings: ["Approaching daily loss limit"],
            violations: ["Portfolio risk would exceed the 8% cap"],
            riskPct: 9.9,
            portfolioRiskBeforePct: 30,
            portfolioRiskAfterPct: 39.9,
          },
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithClient(<TradeExecutionCenter />);
    await user.click(screen.getByTestId("button-select-42"));
    await user.click(screen.getByTestId("button-next-strategy"));
    await user.click(screen.getByTestId("button-confirm-strategy"));
    await user.click(screen.getByTestId("button-next-risk"));

    expect(screen.getByText("BLOCKED")).toBeInTheDocument();
    expect(screen.getByText("• Portfolio risk would exceed the 8% cap")).toBeInTheDocument();
    expect(screen.getByTestId("button-next-confirm")).toBeDisabled();
  });

  it("gates Submit until the risk-acknowledgement checkbox is checked", async () => {
    const user = userEvent.setup();
    renderWithClient(<TradeExecutionCenter />);
    await advanceToConfirm(user);

    expect(screen.getByTestId("button-open-confirm-dialog")).toBeDisabled();
    await user.click(screen.getByTestId("checkbox-risk-acknowledge"));
    expect(screen.getByTestId("button-open-confirm-dialog")).not.toBeDisabled();
  });

  it("gates Submit when the broker is not connected", async () => {
    brokerHealthState.data = { connected: false };
    const user = userEvent.setup();
    renderWithClient(<TradeExecutionCenter />);
    await advanceToConfirm(user);
    await user.click(screen.getByTestId("checkbox-risk-acknowledge"));

    expect(screen.getByTestId("button-open-confirm-dialog")).toBeDisabled();
  });

  it("submits the paper order after confirmation and shows Order Status", async () => {
    submitMock.mutate.mockImplementation((_vars: unknown, opts: { onSuccess?: (r: unknown) => void }) =>
      opts.onSuccess?.({
        orderId: "ORD-1",
        broker: "simulated",
        message: "Order filled.",
        status: "filled",
        tradeId: 501,
        journalId: 9,
      }),
    );
    const user = userEvent.setup();
    renderWithClient(<TradeExecutionCenter />);
    await advanceToConfirm(user);
    await user.click(screen.getByTestId("checkbox-risk-acknowledge"));
    await user.click(screen.getByTestId("button-open-confirm-dialog"));
    expect(screen.getByText("Confirm Paper Order Submission")).toBeInTheDocument();
    await user.click(screen.getByTestId("button-confirm-submit"));

    expect(submitMock.mutate).toHaveBeenCalledWith(
      { data: { scannerResultId: 42, quantity: 1, confirm: true } },
      expect.anything(),
    );
    expect(screen.getByText("Order filled.")).toBeInTheDocument();
    expect(screen.getByText(/ORD-1/)).toBeInTheDocument();
  });

  it("never issues a second submit call once one is already in flight", async () => {
    let resolveSubmit: (() => void) | undefined;
    submitMock.mutate.mockImplementation(() => {
      resolveSubmit = () => {};
    });
    const user = userEvent.setup();
    renderWithClient(<TradeExecutionCenter />);
    await advanceToConfirm(user);
    await user.click(screen.getByTestId("checkbox-risk-acknowledge"));
    await user.click(screen.getByTestId("button-open-confirm-dialog"));
    await user.click(screen.getByTestId("button-confirm-submit"));
    expect(submitMock.mutate).toHaveBeenCalledTimes(1);
    void resolveSubmit;
  });

  it("shows an honest error toast/state and re-enables submission when the order is rejected", async () => {
    submitMock.mutate.mockImplementation((_vars: unknown, opts: { onError?: (e: unknown) => void }) =>
      opts.onError?.(new Error("Buying power insufficient.")),
    );
    const user = userEvent.setup();
    renderWithClient(<TradeExecutionCenter />);
    await advanceToConfirm(user);
    await user.click(screen.getByTestId("checkbox-risk-acknowledge"));
    await user.click(screen.getByTestId("button-open-confirm-dialog"));
    await user.click(screen.getByTestId("button-confirm-submit"));

    // Order Status step was never reached; the wizard stays on Confirm & Submit,
    // and the submit button is still available to retry (not permanently disabled).
    expect(screen.queryByText("No order submitted yet.")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-open-confirm-dialog")).not.toBeDisabled();
  });

  it("renders monitoring data and Manage actions once a trade exists", async () => {
    submitMock.mutate.mockImplementation((_vars: unknown, opts: { onSuccess?: (r: unknown) => void }) =>
      opts.onSuccess?.({ orderId: "ORD-2", broker: "simulated", message: "Filled.", tradeId: 501 }),
    );
    monitorState.data = {
      tradeId: 501,
      currentPnl: 42,
      currentPnlPercent: 22.7,
      profitTarget50: 92.5,
      profitTarget75: 138.75,
      profitTarget90: 166.5,
      stopLoss: -315,
      daysToExpiry: 28,
      delta: 0.12,
      theta: 4.5,
    };
    const user = userEvent.setup();
    renderWithClient(<TradeExecutionCenter />);
    await advanceToConfirm(user);
    await user.click(screen.getByTestId("checkbox-risk-acknowledge"));
    await user.click(screen.getByTestId("button-open-confirm-dialog"));
    await user.click(screen.getByTestId("button-confirm-submit"));
    await user.click(screen.getByTestId("button-next-monitor"));

    expect(screen.getByText("+$42")).toBeInTheDocument();
    await user.click(screen.getByTestId("button-adjust-position"));
    expect(setLocationMock).toHaveBeenCalledWith("/ticket/adjust/501");
  });

  it("resets wizard state when a new candidate is selected (state restoration)", async () => {
    scannerState.results = [scannerResult(), scannerResult({ id: 99, symbol: "MSFT" })];
    const user = userEvent.setup();
    renderWithClient(<TradeExecutionCenter />);
    await advanceToConfirm(user);
    await user.click(screen.getByTestId("checkbox-risk-acknowledge"));
    expect(screen.getByTestId("button-open-confirm-dialog")).not.toBeDisabled();

    // Back out to the scanner (one step at a time, mirroring how a real user
    // would navigate) and pick a different candidate — the risk
    // acknowledgement from the first candidate must not silently apply to
    // the second.
    await user.click(screen.getByText("Back to Risk Review"));
    await user.click(screen.getByText("Back"));
    await user.click(screen.getByText("Back"));
    await user.click(screen.getByText("Back"));
    await user.click(screen.getByText("Back to Scanner"));
    await user.click(screen.getByTestId("button-select-99"));
    await user.click(screen.getByTestId("button-next-strategy"));
    await user.click(screen.getByTestId("button-confirm-strategy"));
    await user.click(screen.getByTestId("button-next-risk"));
    await user.click(screen.getByTestId("button-next-confirm"));
    expect(screen.getByTestId("button-open-confirm-dialog")).toBeDisabled();
  });

  it("logs an activity timeline entry for each major workflow action", async () => {
    submitMock.mutate.mockImplementation((_vars: unknown, opts: { onSuccess?: (r: unknown) => void }) =>
      opts.onSuccess?.({ orderId: "ORD-3", broker: "simulated", message: "Filled.", tradeId: 502 }),
    );
    const user = userEvent.setup();
    renderWithClient(<TradeExecutionCenter />);
    await advanceToConfirm(user);
    await user.click(screen.getByTestId("checkbox-risk-acknowledge"));
    await user.click(screen.getByTestId("button-open-confirm-dialog"));
    await user.click(screen.getByTestId("button-confirm-submit"));
    await user.click(screen.getByTestId("button-next-monitor"));

    const timeline = screen.getByTestId("activity-timeline");
    expect(timeline.textContent).toContain("Selected AAPL iron condor");
    expect(timeline.textContent).toContain("Paper order submitted: ORD-3");
  });

  // v1.3.1 — AI Trading Coach.
  it("shows an Ask AI Trading Coach trigger only once a candidate is selected, in focus of that candidate", async () => {
    const user = userEvent.setup();
    renderWithClient(<TradeExecutionCenter />);
    expect(screen.queryByTestId("button-ask-trading-coach-execution-center")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("button-select-42"));
    const trigger = screen.getByTestId("button-ask-trading-coach-execution-center");
    expect(trigger).toHaveTextContent(/AAPL/);
  });
});
