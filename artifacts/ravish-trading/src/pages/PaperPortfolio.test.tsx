// Paper Portfolio Dashboard & Position Monitoring sprint — frontend smoke
// tests, following the established mocked-generated-hook pattern (see
// Settings.test.tsx's Broker Connection block and
// PaperTradingReconciliation.test.tsx for the closest precedents). All
// three underlying hooks are mocked with `enabled: false`-shaped state
// (data/isFetching/refetch) since the page itself never auto-fetches —
// "Keep all refreshes user-initiated only" is this sprint's own explicit
// constraint, and these tests assert that literally: nothing is fetched
// until a button is clicked.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  health: undefined as unknown,
  healthFetching: false,
  refetchHealth: vi.fn(),
  portfolio: undefined as unknown,
  portfolioFetching: false,
  refetchPortfolio: vi.fn(),
  reconciliation: undefined as unknown,
  reconciliationFetching: false,
  refetchReconciliation: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetBrokerHealth: () => ({
      data: mockState.health,
      isFetching: mockState.healthFetching,
      refetch: mockState.refetchHealth,
    }),
    useGetBrokerPositions: () => ({
      data: mockState.portfolio,
      isFetching: mockState.portfolioFetching,
      refetch: mockState.refetchPortfolio,
    }),
    useGetBrokerReconciliation: () => ({
      data: mockState.reconciliation,
      isFetching: mockState.reconciliationFetching,
      refetch: mockState.refetchReconciliation,
    }),
  };
});

import PaperPortfolio from "./PaperPortfolio";

function healthFixture(over: Record<string, unknown> = {}) {
  return {
    connected: true,
    authenticationSuccessful: true,
    accountStatus: "ACTIVE",
    buyingPower: 200000.5,
    cashBalance: 100000.25,
    portfolioValue: 150000.75,
    openPositionsCount: 1,
    openOrdersCount: 0,
    lastSuccessfulCheckAt: "2026-07-16T09:23:00.000Z",
    reason: "Connected — Alpaca Paper Trading account authenticated successfully",
    checkedAt: "2026-07-16T09:23:00.000Z",
    ...over,
  };
}

function portfolioFixture(over: Record<string, unknown> = {}) {
  return {
    available: true,
    unavailableReason: null,
    positions: [],
    checkedAt: "2026-07-16T09:23:00.000Z",
    ...over,
  };
}

function reconciliationFixture(over: Record<string, unknown> = {}) {
  return {
    available: true,
    unavailableReason: null,
    generatedAt: "2026-07-16T09:23:00.000Z",
    localOrdersConsidered: 1,
    brokerOrdersConsidered: 1,
    orders: [],
    positions: [],
    issueCount: 0,
    fullyReconciled: true,
    ...over,
  };
}

describe("PaperPortfolio", () => {
  beforeEach(() => {
    mockState.health = undefined;
    mockState.healthFetching = false;
    mockState.refetchHealth.mockReset();
    mockState.portfolio = undefined;
    mockState.portfolioFetching = false;
    mockState.refetchPortfolio.mockReset();
    mockState.reconciliation = undefined;
    mockState.reconciliationFetching = false;
    mockState.refetchReconciliation.mockReset();
  });

  it("always shows the Paper Trading Mode badge", () => {
    renderWithClient(<PaperPortfolio />);
    expect(screen.getByTestId("badge-paper-trading-mode")).toHaveTextContent(/paper trading mode/i);
  });

  it("shows honest 'not yet checked' placeholders for all 3 sections before any refresh is clicked — nothing auto-fetches", () => {
    renderWithClient(<PaperPortfolio />);
    expect(screen.getByTestId("text-health-not-checked")).toBeInTheDocument();
    expect(screen.getByTestId("text-portfolio-not-checked")).toBeInTheDocument();
    expect(screen.getByTestId("text-reconciliation-not-checked")).toBeInTheDocument();
    // None of the three hooks' refetch was ever called automatically.
    expect(mockState.refetchHealth).not.toHaveBeenCalled();
    expect(mockState.refetchPortfolio).not.toHaveBeenCalled();
    expect(mockState.refetchReconciliation).not.toHaveBeenCalled();
  });

  it("Realized P/L always honestly reads 'Not available', with a disclosed reason — no endpoint fetches it", () => {
    renderWithClient(<PaperPortfolio />);
    expect(screen.getByTestId("text-realized-pl")).toHaveTextContent(/not available/i);
    expect(screen.getByTestId("text-realized-pl-reason")).toHaveTextContent(/portfolio history/i);
  });

  describe("Broker Health section", () => {
    it("shows account status, balances, and counts once loaded", () => {
      mockState.health = healthFixture();
      renderWithClient(<PaperPortfolio />);
      expect(screen.getByTestId("text-account-status")).toHaveTextContent("ACTIVE");
      expect(screen.getByTestId("text-buying-power")).toHaveTextContent("$200,000.50");
      expect(screen.getByTestId("text-cash-balance")).toHaveTextContent("$100,000.25");
      expect(screen.getByTestId("text-portfolio-value")).toHaveTextContent("$150,000.75");
      expect(screen.getByTestId("text-open-positions-count")).toHaveTextContent("1");
      expect(screen.getByTestId("text-open-orders-count")).toHaveTextContent("0");
      expect(screen.getByTestId("text-last-health-check")).not.toHaveTextContent("Never");
    });

    it("shows an honest reason when missing credentials", () => {
      mockState.health = healthFixture({
        connected: false,
        authenticationSuccessful: false,
        accountStatus: null,
        buyingPower: null,
        cashBalance: null,
        portfolioValue: null,
        openPositionsCount: null,
        openOrdersCount: null,
        lastSuccessfulCheckAt: null,
        reason: "No Alpaca credentials configured",
      });
      renderWithClient(<PaperPortfolio />);
      expect(screen.getByTestId("text-health-unavailable-reason")).toHaveTextContent(/no alpaca credentials configured/i);
      expect(screen.getByTestId("text-buying-power")).toHaveTextContent("—");
    });

    it("shows an honest reason on authentication failure", () => {
      mockState.health = healthFixture({
        connected: false,
        authenticationSuccessful: false,
        reason: "Alpaca rejected the configured credentials (authentication failed)",
      });
      renderWithClient(<PaperPortfolio />);
      expect(screen.getByTestId("text-health-unavailable-reason")).toHaveTextContent(/authentication failed/i);
    });

    it("shows an honest reason on network failure", () => {
      mockState.health = healthFixture({
        connected: false,
        authenticationSuccessful: false,
        reason: "Could not reach Alpaca: ECONNREFUSED",
      });
      renderWithClient(<PaperPortfolio />);
      expect(screen.getByTestId("text-health-unavailable-reason")).toHaveTextContent(/could not reach alpaca/i);
    });

    it("disables the Refresh Broker Health button while a check is in flight, with a spinner label", () => {
      mockState.healthFetching = true;
      renderWithClient(<PaperPortfolio />);
      const button = screen.getByTestId("button-refresh-broker-health");
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent(/refreshing/i);
    });

    it("clicking Refresh Broker Health calls its own refetch only", async () => {
      const user = userEvent.setup();
      renderWithClient(<PaperPortfolio />);
      await user.click(screen.getByTestId("button-refresh-broker-health"));
      expect(mockState.refetchHealth).toHaveBeenCalledTimes(1);
      expect(mockState.refetchPortfolio).not.toHaveBeenCalled();
      expect(mockState.refetchReconciliation).not.toHaveBeenCalled();
    });
  });

  describe("Portfolio section", () => {
    it("shows an honest empty-portfolio message when there are no open positions", () => {
      mockState.portfolio = portfolioFixture({ positions: [] });
      renderWithClient(<PaperPortfolio />);
      expect(screen.getByTestId("text-no-positions")).toBeInTheDocument();
      expect(screen.getByTestId("text-unrealized-pl")).toHaveTextContent(/not available/i);
    });

    it("shows a position card with symbol/quantity/average cost/side and sums the real Unrealized P/L", () => {
      mockState.portfolio = portfolioFixture({
        positions: [
          { symbol: "AAPL", qty: 10, side: "long", marketValue: 1750, avgEntryPrice: 170, unrealizedPl: 50 },
        ],
      });
      renderWithClient(<PaperPortfolio />);
      const card = screen.getByTestId("card-position-0");
      expect(card).toHaveTextContent("AAPL");
      expect(card).toHaveTextContent("10");
      expect(card).toHaveTextContent("$170.00");
      expect(screen.getByTestId("badge-position-status-0")).toHaveTextContent(/long/i);
      expect(screen.getByTestId("text-unrealized-pl")).toHaveTextContent("$50.00");
    });

    it("shows a short position distinctly", () => {
      mockState.portfolio = portfolioFixture({
        positions: [
          { symbol: "SPY", qty: -5, side: "short", marketValue: -900, avgEntryPrice: 180, unrealizedPl: -20 },
        ],
      });
      renderWithClient(<PaperPortfolio />);
      expect(screen.getByTestId("badge-position-status-0")).toHaveTextContent(/short/i);
    });

    it("shows an honest reason when missing credentials", () => {
      mockState.portfolio = portfolioFixture({
        available: false,
        unavailableReason: "No Alpaca credentials configured",
        positions: [],
      });
      renderWithClient(<PaperPortfolio />);
      expect(screen.getByTestId("text-portfolio-unavailable-reason")).toHaveTextContent(/no alpaca credentials configured/i);
    });

    it("shows an honest reason on authentication failure", () => {
      mockState.portfolio = portfolioFixture({
        available: false,
        unavailableReason: "Alpaca rejected the configured credentials (authentication failed)",
      });
      renderWithClient(<PaperPortfolio />);
      expect(screen.getByTestId("text-portfolio-unavailable-reason")).toHaveTextContent(/authentication failed/i);
    });

    it("shows an honest reason on network failure", () => {
      mockState.portfolio = portfolioFixture({
        available: false,
        unavailableReason: "Could not reach Alpaca: ECONNREFUSED",
      });
      renderWithClient(<PaperPortfolio />);
      expect(screen.getByTestId("text-portfolio-unavailable-reason")).toHaveTextContent(/could not reach alpaca/i);
    });

    it("disables the Refresh Portfolio button while a check is in flight", () => {
      mockState.portfolioFetching = true;
      renderWithClient(<PaperPortfolio />);
      const button = screen.getByTestId("button-refresh-portfolio");
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent(/refreshing/i);
    });

    it("clicking Refresh Portfolio calls its own refetch only", async () => {
      const user = userEvent.setup();
      renderWithClient(<PaperPortfolio />);
      await user.click(screen.getByTestId("button-refresh-portfolio"));
      expect(mockState.refetchPortfolio).toHaveBeenCalledTimes(1);
      expect(mockState.refetchHealth).not.toHaveBeenCalled();
      expect(mockState.refetchReconciliation).not.toHaveBeenCalled();
    });

    it("cross-references reconciliation status onto a position card once reconciliation has also been checked", () => {
      mockState.portfolio = portfolioFixture({
        positions: [
          { symbol: "AAPL", qty: 10, side: "long", marketValue: 1750, avgEntryPrice: 170, unrealizedPl: 50 },
        ],
      });
      mockState.reconciliation = reconciliationFixture({
        positions: [
          { occSymbol: "AAPL", tradeId: 1, localQuantity: 10, brokerQuantity: 10, mismatch: false, detail: "Local and broker positions agree." },
        ],
      });
      renderWithClient(<PaperPortfolio />);
      expect(screen.getByTestId("badge-position-reconciliation-0")).toHaveTextContent(/matched/i);
    });

    it("shows 'Not yet checked' reconciliation status on a position card before reconciliation has been run", () => {
      mockState.portfolio = portfolioFixture({
        positions: [
          { symbol: "AAPL", qty: 10, side: "long", marketValue: 1750, avgEntryPrice: 170, unrealizedPl: 50 },
        ],
      });
      renderWithClient(<PaperPortfolio />);
      expect(screen.getByTestId("badge-position-reconciliation-0")).toHaveTextContent(/not yet checked/i);
    });

    it("shows a mismatch badge on a position card when reconciliation found one", () => {
      mockState.portfolio = portfolioFixture({
        positions: [
          { symbol: "AAPL", qty: 10, side: "long", marketValue: 1750, avgEntryPrice: 170, unrealizedPl: 50 },
        ],
      });
      mockState.reconciliation = reconciliationFixture({
        fullyReconciled: false,
        issueCount: 1,
        positions: [
          { occSymbol: "AAPL", tradeId: 1, localQuantity: 8, brokerQuantity: 10, mismatch: true, detail: "Quantity mismatch: local 8, broker 10." },
        ],
      });
      renderWithClient(<PaperPortfolio />);
      expect(screen.getByTestId("badge-position-reconciliation-0")).toHaveTextContent(/mismatch/i);
    });
  });

  describe("Reconciliation section", () => {
    it("shows a Fully Reconciled summary and the last-run time once loaded", () => {
      mockState.reconciliation = reconciliationFixture();
      renderWithClient(<PaperPortfolio />);
      expect(screen.getByTestId("text-reconciliation-summary")).toHaveTextContent(/fully reconciled/i);
      expect(screen.getByTestId("text-last-reconciliation-run")).not.toHaveTextContent("Never");
    });

    it("shows an issue count when not fully reconciled", () => {
      mockState.reconciliation = reconciliationFixture({ fullyReconciled: false, issueCount: 2 });
      renderWithClient(<PaperPortfolio />);
      expect(screen.getByTestId("text-reconciliation-summary")).toHaveTextContent(/2 issues/i);
    });

    it("shows an honest reason when missing credentials", () => {
      mockState.reconciliation = reconciliationFixture({
        available: false,
        unavailableReason: "No Alpaca credentials configured",
        fullyReconciled: false,
      });
      renderWithClient(<PaperPortfolio />);
      expect(screen.getByTestId("text-reconciliation-unavailable-reason")).toHaveTextContent(/no alpaca credentials configured/i);
    });

    it("shows an honest reason on authentication failure", () => {
      mockState.reconciliation = reconciliationFixture({
        available: false,
        unavailableReason: "Alpaca rejected the configured credentials (authentication failed)",
        fullyReconciled: false,
      });
      renderWithClient(<PaperPortfolio />);
      expect(screen.getByTestId("text-reconciliation-unavailable-reason")).toHaveTextContent(/authentication failed/i);
    });

    it("shows an honest reason on network failure", () => {
      mockState.reconciliation = reconciliationFixture({
        available: false,
        unavailableReason: "Could not reach Alpaca: ECONNREFUSED",
        fullyReconciled: false,
      });
      renderWithClient(<PaperPortfolio />);
      expect(screen.getByTestId("text-reconciliation-unavailable-reason")).toHaveTextContent(/could not reach alpaca/i);
    });

    it("disables the Refresh Reconciliation button while a check is in flight", () => {
      mockState.reconciliationFetching = true;
      renderWithClient(<PaperPortfolio />);
      const button = screen.getByTestId("button-refresh-reconciliation");
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent(/refreshing/i);
    });

    it("clicking Refresh Reconciliation calls its own refetch only", async () => {
      const user = userEvent.setup();
      renderWithClient(<PaperPortfolio />);
      await user.click(screen.getByTestId("button-refresh-reconciliation"));
      expect(mockState.refetchReconciliation).toHaveBeenCalledTimes(1);
      expect(mockState.refetchHealth).not.toHaveBeenCalled();
      expect(mockState.refetchPortfolio).not.toHaveBeenCalled();
    });

    it("all three Refresh buttons are enabled again once their own refresh completes", () => {
      mockState.health = healthFixture();
      mockState.portfolio = portfolioFixture();
      mockState.reconciliation = reconciliationFixture();
      renderWithClient(<PaperPortfolio />);
      expect(screen.getByTestId("button-refresh-broker-health")).not.toBeDisabled();
      expect(screen.getByTestId("button-refresh-portfolio")).not.toBeDisabled();
      expect(screen.getByTestId("button-refresh-reconciliation")).not.toBeDisabled();
    });
  });
});
