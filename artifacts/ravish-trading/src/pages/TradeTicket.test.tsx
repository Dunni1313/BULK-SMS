// Phase 6, Sprint 72 — Frontend Legacy Page Test Coverage, Slice 2.
// Following the established mocked-generated-hook + wouter mocking pattern
// (see Login.test.tsx/Scanner.test.tsx for the useLocation precedent).
// useParams is mocked too, since this page reads scannerId/tradeId from the
// URL itself; each mutation hook's own onSuccess/onError is invoked directly
// from a configurable mockImplementation, matching this page's own
// "preview.mutate(..., { onSuccess })" usage pattern.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const setLocationMock = vi.hoisted(() => vi.fn());
const paramsMock = vi.hoisted(() => ({ current: {} as Record<string, string> }));

const previewMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false, isError: false }));
const submitMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const previewAdjMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false, isError: false }));
const submitAdjMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    usePreviewExecution: () => previewMock,
    useSubmitExecution: () => submitMock,
    usePreviewAdjustmentExecution: () => previewAdjMock,
    useSubmitAdjustmentExecution: () => submitAdjMock,
  };
});

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useLocation: () => ["/ticket", setLocationMock],
    useParams: () => paramsMock.current,
  };
});

import TradeTicket from "./TradeTicket";

function leg(over: Record<string, unknown> = {}) {
  return {
    side: "sell",
    ratioQty: 1,
    strike: 450,
    optionType: "put",
    positionIntent: "open_short",
    occSymbol: "SPY260821P00450000",
    price: 2.15,
    ...over,
  };
}

function ticket(over: Record<string, unknown> = {}) {
  return {
    symbol: "SPY",
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

function adjustmentTicket(over: Record<string, unknown> = {}) {
  return ticket({
    strategy: "iron_condor",
    adjustment: {
      kind: "roll",
      actionLabel: "Roll out and up",
      fromStrategy: "iron_condor",
      toStrategy: "iron_condor",
      closeDescription: "Close the current SPY iron condor before it tests the short put.",
      rationale: "Underlying has drifted toward the short strike with 10 days to expiry.",
      netCashflow: 45,
      source: {
        tradeId: 77,
        strategyLabel: "iron condor",
        expiration: "2026-07-24",
        daysToExpiry: 9,
        isCredit: true,
        credit: 150,
        maxProfit: 150,
        maxLoss: 350,
        pop: 65,
        costToClose: 90,
        currentPnl: 40,
        legs: [{ side: "sell", quantity: 1, strike: 440, optionType: "put" }],
      },
    },
    ...over,
  });
}

describe("TradeTicket page", () => {
  beforeEach(() => {
    paramsMock.current = {};
    setLocationMock.mockReset();
    previewMock.mutate.mockReset();
    previewMock.isPending = false;
    previewMock.isError = false;
    submitMock.mutate.mockReset();
    submitMock.isPending = false;
    previewAdjMock.mutate.mockReset();
    previewAdjMock.isPending = false;
    previewAdjMock.isError = false;
    submitAdjMock.mutate.mockReset();
    submitAdjMock.isPending = false;
  });

  it("shows an honest 'no candidate selected' message with no scannerId/tradeId in the URL", async () => {
    renderWithClient(<TradeTicket />);
    expect(screen.getByText("No candidate selected. Pick one from the Scanner.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /back to scanner/i }));
    expect(setLocationMock).toHaveBeenCalledWith("/scanner");
  });

  it("shows loading skeletons while the preview is pending", () => {
    paramsMock.current = { scannerId: "42" };
    previewMock.isPending = true;
    previewMock.mutate.mockImplementation(() => {}); // never resolves
    renderWithClient(<TradeTicket />);
    expect(screen.getByText("TRADE TICKET")).toBeInTheDocument();
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows an honest error message when the preview fails", () => {
    paramsMock.current = { scannerId: "42" };
    previewMock.isError = true;
    previewMock.mutate.mockImplementation(() => {}); // never calls onSuccess
    renderWithClient(<TradeTicket />);
    expect(screen.getByText("Couldn't build this ticket. The candidate may no longer be valid.")).toBeInTheDocument();
  });

  it("renders a real ticket once the preview resolves", () => {
    paramsMock.current = { scannerId: "42" };
    previewMock.mutate.mockImplementation((_vars, opts) => opts.onSuccess?.(ticket()));
    renderWithClient(<TradeTicket />);
    expect(screen.getByText("SPY")).toBeInTheDocument();
    // Net Credit and Max Profit both legitimately read $185 in this fixture.
    expect(screen.getAllByText("$185").length).toBe(2);
    expect(screen.getByText("$315")).toBeInTheDocument(); // Max Loss
    expect(screen.getByText("PASSED")).toBeInTheDocument();
    expect(screen.getByText("Portfolio risk within limits")).toBeInTheDocument();
    expect(screen.getByText("open short")).toBeInTheDocument();
    expect(screen.getByText("1× SPY 450 PUT")).toBeInTheDocument();
  });

  it("renders the Before → After roll/convert panel for an adjustment ticket", () => {
    paramsMock.current = { tradeId: "77" };
    previewAdjMock.mutate.mockImplementation((_vars, opts) => opts.onSuccess?.(adjustmentTicket()));
    renderWithClient(<TradeTicket />);
    expect(screen.getByText("ROLL / CONVERT TICKET")).toBeInTheDocument();
    expect(screen.getByText("Roll out and up")).toBeInTheDocument();
    expect(screen.getByText("Before → After")).toBeInTheDocument();
    expect(screen.getByText(/Closing · position #77/)).toBeInTheDocument();
    expect(screen.getByText("Opening · new")).toBeInTheDocument();
    expect(screen.getByText("+$45")).toBeInTheDocument(); // net cashflow, credit-side
  });

  it("submits the order after confirming and navigates to /trades", async () => {
    paramsMock.current = { scannerId: "42" };
    previewMock.mutate.mockImplementation((_vars, opts) => opts.onSuccess?.(ticket()));
    submitMock.mutate.mockImplementation((_vars, opts) =>
      opts.onSuccess?.({ message: "Order filled.", orderId: "ORD-1", broker: "simulated" }),
    );
    renderWithClient(<TradeTicket />);

    await userEvent.click(screen.getByRole("button", { name: /submit order/i }));
    expect(screen.getByText("Confirm order submission")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /confirm & submit/i }));

    expect(submitMock.mutate).toHaveBeenCalledWith(
      { data: { scannerResultId: 42, quantity: 1, confirm: true } },
      expect.anything(),
    );
    expect(setLocationMock).toHaveBeenCalledWith("/trades");
  });

  it("steps the quantity and re-previews with the updated count", async () => {
    paramsMock.current = { scannerId: "42" };
    previewMock.mutate.mockImplementation((_vars, opts) => opts.onSuccess?.(ticket()));
    renderWithClient(<TradeTicket />);

    await userEvent.click(screen.getByRole("button", { name: "+" }));

    expect(previewMock.mutate).toHaveBeenLastCalledWith(
      { data: { scannerResultId: 42, quantity: 2 } },
      expect.anything(),
    );
  });
});
