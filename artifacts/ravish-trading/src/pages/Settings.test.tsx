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
