// Phase 35 — Institutional Options Income Engine (Foundation). Frontend
// smoke tests for the Institutional Options Income Workspace page,
// following the established mocked-generated-hook pattern
// (CrossEngineWorkspace.test.tsx).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  dashboardData: undefined as unknown,
  dashboardLoading: false,
  dashboardError: false,
  positionsData: undefined as unknown,
  positionsLoading: false,
  strategyLibraryData: undefined as unknown,
  strategyLibraryLoading: false,
  portfolioDashboardData: undefined as unknown,
  portfolioDashboardLoading: false,
  reportData: undefined as unknown,
  reportLoading: false,
  updateNotesMutate: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetOptionsIncomeDashboard: () => ({
      data: mockState.dashboardData,
      isLoading: mockState.dashboardLoading,
      isError: mockState.dashboardError,
    }),
    useListOptionsIncomePositions: () => ({
      data: mockState.positionsData,
      isLoading: mockState.positionsLoading,
    }),
    useGetOptionsStrategyLibrary: () => ({
      data: mockState.strategyLibraryData,
      isLoading: mockState.strategyLibraryLoading,
    }),
    useGetPortfolioDashboard: () => ({
      data: mockState.portfolioDashboardData,
      isLoading: mockState.portfolioDashboardLoading,
    }),
    useGetOptionsIncomeSummaryReport: () => ({
      data: mockState.reportData,
      isLoading: mockState.reportLoading,
    }),
    useUpdateOptionsIncomePositionNotes: () => ({
      mutate: mockState.updateNotesMutate,
    }),
  };
});

import OptionsIncomeWorkspace from "./OptionsIncomeWorkspace";

function emptyDashboard(overrides: Record<string, unknown> = {}) {
  return {
    overview: {
      openPositionsCount: 0,
      closedPositionsCount: 0,
      totalCreditCollectedOpen: 0,
      totalRealizedPremium: 0,
      totalCapitalAllocated: 0,
      theta: { daily: 0, weekly: 0, monthly: 0, annualized: 0, bySymbol: [], byStrategy: [] },
      generatedAt: "2026-07-20T00:00:00.000Z",
    },
    strategyMix: [],
    upcomingExpirations: [],
    generatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

function populatedDashboard() {
  return emptyDashboard({
    overview: {
      openPositionsCount: 2,
      closedPositionsCount: 1,
      totalCreditCollectedOpen: 230,
      totalRealizedPremium: 120,
      totalCapitalAllocated: 550,
      theta: { daily: 3.5, weekly: 24.5, monthly: 105, annualized: 1277.5, bySymbol: [{ key: "SPY", theta: 2 }], byStrategy: [{ key: "iron_condor", theta: 2 }] },
      generatedAt: "2026-07-20T00:00:00.000Z",
    },
    strategyMix: [
      { strategy: "iron_condor", strategyLabel: "Iron Condor", positionCount: 1, capitalAllocated: 350 },
      { strategy: "calendar_spread", strategyLabel: "Calendar", positionCount: 1, capitalAllocated: 200 },
    ],
    upcomingExpirations: [
      { expiration: "2026-08-15", daysToExpiry: 26, positions: [{ id: 1, symbol: "SPY", strategy: "iron_condor", credit: 150 }] },
    ],
  });
}

function samplePosition(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    underlying: "SPY",
    strategy: "iron_condor",
    strategyLabel: "Iron Condor",
    expiration: "2026-08-15",
    premium: 150,
    collateral: 350,
    greeks: { delta: 0.12, gamma: 0.02, theta: 1.5, vega: -0.3 },
    status: "open",
    lifecycle: "open",
    notes: "Watching the call side.",
    openDate: "2026-07-01T00:00:00.000Z",
    closeDate: null,
    realizedPnl: null,
    ...overrides,
  };
}

describe("OptionsIncomeWorkspace", () => {
  beforeEach(() => {
    mockState.dashboardData = undefined;
    mockState.dashboardLoading = false;
    mockState.dashboardError = false;
    mockState.positionsData = undefined;
    mockState.positionsLoading = false;
    mockState.strategyLibraryData = undefined;
    mockState.strategyLibraryLoading = false;
    mockState.portfolioDashboardData = undefined;
    mockState.portfolioDashboardLoading = false;
    mockState.reportData = undefined;
    mockState.reportLoading = false;
    mockState.updateNotesMutate = vi.fn();
  });

  it("shows the loading state before the dashboard resolves", () => {
    mockState.dashboardLoading = true;
    mockState.dashboardData = undefined;
    renderWithClient(<OptionsIncomeWorkspace />);
    expect(screen.getByTestId("options-income-dashboard-loading")).toBeInTheDocument();
    mockState.dashboardLoading = false;
  });

  it("honestly reports all-zero KPIs and empty strategy mix for a brand-new user", () => {
    mockState.dashboardData = emptyDashboard();
    mockState.positionsData = [];
    mockState.strategyLibraryData = [];
    mockState.portfolioDashboardData = undefined;
    mockState.reportData = undefined;
    renderWithClient(<OptionsIncomeWorkspace />);
    expect(screen.getByTestId("kpi-oiw-open-positions")).toHaveTextContent("0");
    expect(screen.getByTestId("strategy-mix-empty")).toBeInTheDocument();
  });

  it("renders real dashboard KPIs, theta income, and strategy mix once resolved", () => {
    mockState.dashboardData = populatedDashboard();
    renderWithClient(<OptionsIncomeWorkspace />);
    expect(screen.getByTestId("kpi-oiw-open-positions")).toHaveTextContent("2");
    expect(screen.getByTestId("kpi-oiw-capital-allocated")).toHaveTextContent("$550");
    expect(screen.getByTestId("theta-monthly")).toHaveTextContent("$105");
    expect(screen.getByTestId("strategy-mix-iron_condor")).toHaveTextContent("Iron Condor");
    expect(screen.getByTestId("strategy-mix-calendar_spread")).toHaveTextContent("Calendar");
  });

  it("renders the Position Model (Positions tab) with lifecycle badge, Greeks, and an editable notes field, never fabricating a P/L for an open position", async () => {
    mockState.dashboardData = emptyDashboard();
    mockState.positionsData = [samplePosition()];
    renderWithClient(<OptionsIncomeWorkspace />);
    await userEvent.click(screen.getByTestId("tab-oiw-positions"));

    const row = screen.getByTestId("position-1");
    expect(within(row).getByText("SPY")).toBeInTheDocument();
    expect(screen.getByTestId("position-lifecycle-1")).toHaveTextContent("open");
    expect(screen.getByTestId("position-greeks-1")).toHaveTextContent("Δ 0.120");
    expect(row).not.toHaveTextContent("Realized:");

    const input = screen.getByTestId("position-notes-input-1") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "Updated note." } });
    fireEvent.click(screen.getByTestId("position-notes-save-1"));
    expect(mockState.updateNotesMutate).toHaveBeenCalledWith({ id: 1, data: { notes: "Updated note." } });
  });

  it("renders a closed position's honest lifecycle and realized P&L", async () => {
    mockState.dashboardData = emptyDashboard();
    mockState.positionsData = [samplePosition({ id: 2, status: "closed", lifecycle: "closed_expired", realizedPnl: 95 })];
    renderWithClient(<OptionsIncomeWorkspace />);
    await userEvent.click(screen.getByTestId("tab-oiw-positions"));
    expect(screen.getByTestId("position-lifecycle-2")).toHaveTextContent("closed expired");
    expect(screen.getByTestId("position-2")).toHaveTextContent("Realized: $95");
  });

  it("renders the Strategy Library as pure metadata — never a leg or credit field", async () => {
    mockState.dashboardData = emptyDashboard();
    mockState.positionsData = [];
    mockState.strategyLibraryData = [
      {
        key: "iron_condor",
        label: "Iron Condor",
        legCount: 4,
        incomeType: "credit",
        collateralType: "margin",
        collateralNote: "Max loss between the short and long strikes.",
        builtByThisEngine: true,
        summary: "A defined-risk, delta-neutral income strategy.",
        idealMarket: "Range-bound, low-to-moderate IV.",
        assignmentRisk: "Possible on either short leg near expiration.",
        executionStrategyKey: "iron_condor",
      },
    ];
    renderWithClient(<OptionsIncomeWorkspace />);
    await userEvent.click(screen.getByTestId("tab-oiw-strategy-library"));
    const card = screen.getByTestId("strategy-template-iron_condor");
    expect(card).toHaveTextContent("Iron Condor");
    expect(card).toHaveTextContent("Built by this engine");
    expect(card).not.toHaveTextContent("$");
  });

  it("groups the Income Calendar by real expiration date, honestly empty when there are none", async () => {
    mockState.dashboardData = emptyDashboard();
    mockState.positionsData = [];
    renderWithClient(<OptionsIncomeWorkspace />);
    await userEvent.click(screen.getByTestId("tab-oiw-calendar"));
    expect(screen.getByTestId("calendar-empty")).toBeInTheDocument();
  });

  it("shows real upcoming expiration groups on the Income Calendar", async () => {
    mockState.dashboardData = populatedDashboard();
    renderWithClient(<OptionsIncomeWorkspace />);
    await userEvent.click(screen.getByTestId("tab-oiw-calendar"));
    expect(screen.getByTestId("calendar-group-2026-08-15")).toHaveTextContent("26d");
  });

  it("shows portfolio net Greeks and per-position Greeks on the Greeks Overview tab, reused from the existing Portfolio Dashboard", async () => {
    mockState.dashboardData = emptyDashboard();
    mockState.positionsData = [samplePosition()];
    mockState.portfolioDashboardData = {
      netGreeks: { delta: 12.5, gamma: 0.3, theta: -4.2, vega: 8.1 },
      buyingPower: 25000,
      portfolioValue: 100000,
      totalRiskPct: 4.5,
      allocationBySymbol: [{ key: "SPY", label: "SPY", positionCount: 1, weightPct: 40 }],
    };
    renderWithClient(<OptionsIncomeWorkspace />);
    await userEvent.click(screen.getByTestId("tab-oiw-greeks"));
    expect(screen.getByTestId("portfolio-net-greeks")).toHaveTextContent("12.50");
    expect(screen.getByTestId("greeks-row-1")).toHaveTextContent("SPY");
  });

  it("shows Buying Power and Portfolio Exposure on the Risk & Exposure tab, with links out to the existing Portfolio Dashboard/Concentration/Stress Test pages", async () => {
    mockState.dashboardData = emptyDashboard();
    mockState.positionsData = [];
    mockState.portfolioDashboardData = {
      netGreeks: { delta: 0, gamma: 0, theta: 0, vega: 0 },
      buyingPower: 25000,
      portfolioValue: 100000,
      totalRiskPct: 4.5,
      allocationBySymbol: [{ key: "SPY", label: "SPY", positionCount: 1, weightPct: 40 }],
    };
    renderWithClient(<OptionsIncomeWorkspace />);
    await userEvent.click(screen.getByTestId("tab-oiw-risk-exposure"));
    expect(screen.getByTestId("kpi-oiw-buying-power")).toHaveTextContent("$25,000");
    expect(screen.getByTestId("link-portfolio-dashboard")).toHaveAttribute("href", "/portfolio-dashboard");
    expect(screen.getByTestId("link-concentration-risk")).toHaveAttribute("href", "/concentration-risk");
    expect(screen.getByTestId("link-stress-test")).toHaveAttribute("href", "/stress-test");
  });

  it("shows the Options Income Summary report and a link to the Reporting Centre", async () => {
    mockState.dashboardData = emptyDashboard();
    mockState.positionsData = [];
    mockState.portfolioDashboardData = undefined;
    mockState.reportData = {
      reportType: "options-income-summary",
      title: "Options Income Summary Report",
      subtitle: "0 open position(s)",
      symbol: null,
      portfolioId: null,
      generatedAt: "2026-07-20T00:00:00.000Z",
      dataSource: "MIXED",
      sections: [{ id: "executive-summary", title: "Income Overview", body: "No open or closed options-income positions on record yet." }],
      disclaimer: "Educational research only.",
    };
    renderWithClient(<OptionsIncomeWorkspace />);
    await userEvent.click(screen.getByTestId("tab-oiw-reporting"));
    expect(screen.getByTestId("options-income-report")).toHaveTextContent("Income Overview");
    expect(screen.getByTestId("link-reporting-centre")).toHaveAttribute("href", "/reporting-centre");
  });
});
