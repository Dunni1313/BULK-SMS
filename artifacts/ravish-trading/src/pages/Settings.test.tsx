// Phase 4, Sprint 56 — Alerts & Notifications. No Settings.test.tsx existed
// before this sprint; per the explicit "do not expand scope" instruction,
// this file covers only the new alertsEnabled toggle this sprint added,
// not a full regression suite for the rest of this large, pre-existing
// page. Follows this codebase's own established reliable test pattern
// (vi.hoisted() + top-level vi.mock() + a static import).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  settings: undefined as unknown,
  isLoading: false,
  updateMutate: vi.fn(),
  brokerHealth: undefined as unknown,
  brokerHealthFetching: false,
  brokerHealthRequestFailed: false,
  refetchBrokerHealth: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetSettings: () => ({ data: mockState.settings, isLoading: mockState.isLoading }),
    useUpdateSettings: () => ({ mutate: mockState.updateMutate, isPending: false }),
    useGetFundamentalsProviderStatus: () => ({ data: undefined }),
    useGetBrokerHealth: () => ({
      data: mockState.brokerHealth,
      isFetching: mockState.brokerHealthFetching,
      isError: mockState.brokerHealthRequestFailed,
      refetch: mockState.refetchBrokerHealth,
    }),
  };
});

import SettingsPage from "./Settings";

function settingsFixture(over: Record<string, unknown> = {}) {
  return {
    executionMode: "manual",
    maxRiskPerTrade: 1,
    maxPortfolioRisk: 10,
    profitTarget50: 50,
    profitTarget75: 75,
    profitTarget90: 90,
    stopLossMultiplier: 2,
    defaultDte: 45,
    shortDelta: 0.2,
    alpacaConnected: false,
    alpacaApiKey: null,
    scannerMode: "mock",
    marketDataProvider: "mock",
    eventRiskEnabled: true,
    eventRiskBlockEarningsShortPremium: true,
    eventRiskAutoBlockHigh: true,
    fundamentalsProvider: "simulated",
    fundamentalsConnected: false,
    fundamentalsStalenessHours: 24,
    fundamentalsAutoRefresh: true,
    alertsEnabled: true,
    ...over,
  };
}

describe("Settings — Alerts & Notifications toggle (Phase 4, Sprint 56)", () => {
  beforeEach(() => {
    mockState.settings = undefined;
    mockState.isLoading = false;
    mockState.updateMutate.mockReset();
    mockState.brokerHealth = undefined;
    mockState.brokerHealthFetching = false;
    mockState.brokerHealthRequestFailed = false;
    mockState.refetchBrokerHealth.mockReset();
  });

  it("reflects the fetched alertsEnabled value in the switch", () => {
    mockState.settings = settingsFixture({ alertsEnabled: true });
    renderWithClient(<SettingsPage />);
    expect(screen.getByTestId("switch-alerts-enabled")).toHaveAttribute("aria-checked", "true");
  });

  it("reflects a false alertsEnabled value in the switch", () => {
    mockState.settings = settingsFixture({ alertsEnabled: false });
    renderWithClient(<SettingsPage />);
    expect(screen.getByTestId("switch-alerts-enabled")).toHaveAttribute("aria-checked", "false");
  });

  it("toggling the switch and saving submits alertsEnabled in the update payload", async () => {
    mockState.settings = settingsFixture({ alertsEnabled: true });
    const user = userEvent.setup();
    renderWithClient(<SettingsPage />);

    await user.click(screen.getByTestId("switch-alerts-enabled"));
    await user.click(screen.getByRole("button", { name: /save settings/i }));

    expect(mockState.updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ alertsEnabled: false }) }),
      expect.anything(),
    );
  });
});

// Broker Connection UI (Phase 6, Broker Connection UI sprint) — the
// GET /api/broker/health-backed "Check Connection" panel. useGetBrokerHealth
// is mocked the same way every other hook on this page already is; since
// the mock is a plain function reading mockState (not real react-query
// state), each test that simulates a completed check drives
// refetchBrokerHealth to both mutate mockState.brokerHealth AND return
// { data } (mirroring the real hook's contract), then explicitly
// rerender()s — the same "update backing state, force a fresh render"
// technique required whenever a hook itself is fully mocked out.
describe("Settings — Broker Connection (Broker Health)", () => {
  const successFixture = {
    connected: true,
    authenticationSuccessful: true,
    accountStatus: "ACTIVE",
    buyingPower: 200000.5,
    cashBalance: 100000.25,
    portfolioValue: 150000.75,
    openPositionsCount: 3,
    openOrdersCount: 1,
    lastSuccessfulCheckAt: "2026-07-16T09:23:00.000Z",
    reason: "Connected — Alpaca Paper Trading account authenticated successfully",
    checkedAt: "2026-07-16T09:23:00.000Z",
  };

  const missingCredentialsFixture = {
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
    checkedAt: "2026-07-16T09:23:00.000Z",
  };

  const authFailureFixture = {
    ...missingCredentialsFixture,
    reason: "Alpaca rejected the configured credentials (authentication failed)",
  };

  const networkFailureFixture = {
    ...missingCredentialsFixture,
    reason: "Could not reach Alpaca: ECONNREFUSED",
  };

  beforeEach(() => {
    mockState.settings = settingsFixture();
    mockState.isLoading = false;
    mockState.updateMutate.mockReset();
    mockState.brokerHealth = undefined;
    mockState.brokerHealthFetching = false;
    mockState.brokerHealthRequestFailed = false;
    mockState.refetchBrokerHealth.mockReset();
  });

  function mockCheckResolvesTo(fixture: Record<string, unknown>) {
    mockState.refetchBrokerHealth.mockImplementation(async () => {
      mockState.brokerHealth = fixture;
      return { data: fixture };
    });
  }

  it("always shows the Paper Trading Only indicator, even before any check has run", () => {
    renderWithClient(<SettingsPage />);
    expect(screen.getByTestId("badge-paper-trading-environment")).toHaveTextContent(/paper trading only/i);
  });

  it("successful connection: displays Connected, all account fields, and the last successful check time", async () => {
    mockCheckResolvesTo(successFixture);
    const user = userEvent.setup();
    const { rerender } = renderWithClient(<SettingsPage />);

    await user.click(screen.getByTestId("button-check-broker-connection"));
    rerender(<SettingsPage />);

    expect(screen.getByTestId("text-broker-connection-status")).toHaveTextContent(/connected & active/i);
    expect(screen.getByTestId("text-broker-auth-status")).toHaveTextContent(/successful/i);
    expect(screen.getByTestId("text-broker-account-status")).toHaveTextContent("ACTIVE");
    expect(screen.getByTestId("text-broker-buying-power")).toHaveTextContent("$200,000.50");
    expect(screen.getByTestId("text-broker-cash-balance")).toHaveTextContent("$100,000.25");
    expect(screen.getByTestId("text-broker-portfolio-value")).toHaveTextContent("$150,000.75");
    expect(screen.getByTestId("text-broker-open-positions")).toHaveTextContent("3");
    expect(screen.getByTestId("text-broker-open-orders")).toHaveTextContent("1");
    expect(screen.getByTestId("text-broker-last-check")).not.toHaveTextContent("Never");
    expect(screen.queryByTestId("text-broker-failure-reason")).not.toBeInTheDocument();
  });

  it("missing credentials: shows Not Connected, the failure reason, and a friendly explanation of the required environment variables", async () => {
    mockCheckResolvesTo(missingCredentialsFixture);
    const user = userEvent.setup();
    const { rerender } = renderWithClient(<SettingsPage />);

    await user.click(screen.getByTestId("button-check-broker-connection"));
    rerender(<SettingsPage />);

    expect(screen.getByTestId("text-broker-connection-status")).toHaveTextContent(/not connected/i);
    expect(screen.getByTestId("text-broker-failure-reason")).toHaveTextContent(/no alpaca credentials configured/i);
    const help = screen.getByTestId("text-broker-missing-credentials-help");
    expect(help).toHaveTextContent("ALPACA_API_KEY");
    expect(help).toHaveTextContent("ALPACA_API_SECRET");
    // Every numeric field is honestly "—", never a fabricated 0.
    expect(screen.getByTestId("text-broker-buying-power")).toHaveTextContent("—");
    expect(screen.getByTestId("text-broker-last-check")).toHaveTextContent("Never");
  });

  it("authentication failure: shows Not Connected and the authentication-failed reason, with no missing-credentials help text", async () => {
    mockCheckResolvesTo(authFailureFixture);
    const user = userEvent.setup();
    const { rerender } = renderWithClient(<SettingsPage />);

    await user.click(screen.getByTestId("button-check-broker-connection"));
    rerender(<SettingsPage />);

    expect(screen.getByTestId("text-broker-connection-status")).toHaveTextContent(/not connected/i);
    expect(screen.getByTestId("text-broker-auth-status")).toHaveTextContent(/failed/i);
    expect(screen.getByTestId("text-broker-failure-reason")).toHaveTextContent(/authentication failed/i);
    expect(screen.queryByTestId("text-broker-missing-credentials-help")).not.toBeInTheDocument();
  });

  it("network failure: shows Not Connected and the unreachable reason, with no missing-credentials help text", async () => {
    mockCheckResolvesTo(networkFailureFixture);
    const user = userEvent.setup();
    const { rerender } = renderWithClient(<SettingsPage />);

    await user.click(screen.getByTestId("button-check-broker-connection"));
    rerender(<SettingsPage />);

    expect(screen.getByTestId("text-broker-connection-status")).toHaveTextContent(/not connected/i);
    expect(screen.getByTestId("text-broker-failure-reason")).toHaveTextContent(/could not reach alpaca/i);
    expect(screen.queryByTestId("text-broker-missing-credentials-help")).not.toBeInTheDocument();
  });

  it("loading state: shows a 'Checking...' label with a spinner while a check is in progress", () => {
    mockState.brokerHealthFetching = true;
    renderWithClient(<SettingsPage />);

    const button = screen.getByTestId("button-check-broker-connection");
    expect(button).toHaveTextContent(/checking/i);
  });

  it("disabled button state: the Check Connection button is disabled while a check is in progress", () => {
    mockState.brokerHealthFetching = true;
    renderWithClient(<SettingsPage />);

    expect(screen.getByTestId("button-check-broker-connection")).toBeDisabled();
  });

  it("the Check Connection button is enabled again once a check completes", async () => {
    mockCheckResolvesTo(successFixture);
    const user = userEvent.setup();
    const { rerender } = renderWithClient(<SettingsPage />);

    expect(screen.getByTestId("button-check-broker-connection")).not.toBeDisabled();
    await user.click(screen.getByTestId("button-check-broker-connection"));
    rerender(<SettingsPage />);

    expect(screen.getByTestId("button-check-broker-connection")).not.toBeDisabled();
  });

  it("the top connection indicator reflects the settings-loaded value before any check has run", () => {
    mockState.settings = settingsFixture({ alpacaConnected: false });
    renderWithClient(<SettingsPage />);
    expect(screen.getByTestId("text-broker-connection-status")).toHaveTextContent(/not connected/i);
  });

  it("the top connection indicator updates immediately from the check response, even if the stored settings value disagrees", async () => {
    // settings.alpacaConnected is stale/false; the fresh check says connected.
    mockState.settings = settingsFixture({ alpacaConnected: false });
    mockCheckResolvesTo(successFixture);
    const user = userEvent.setup();
    const { rerender } = renderWithClient(<SettingsPage />);

    await user.click(screen.getByTestId("button-check-broker-connection"));
    rerender(<SettingsPage />);

    expect(screen.getByTestId("text-broker-connection-status")).toHaveTextContent(/connected & active/i);
  });

  it("a genuine request-level failure (not an Alpaca-side result) shows a distinct error message", () => {
    mockState.brokerHealthRequestFailed = true;
    renderWithClient(<SettingsPage />);
    expect(screen.getByTestId("text-broker-health-request-error")).toBeInTheDocument();
  });
});
