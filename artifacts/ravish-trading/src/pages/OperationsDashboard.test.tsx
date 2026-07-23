// Phase 11 — Live Market Operations & Production Validation. Smoke tests
// for the (administrator-only) Operations Dashboard, following the
// established mocked-generated-hook pattern. The real security boundary
// is server-side (routes/ops.route.test.ts's own requireAdmin proof) —
// these tests only prove the page's own client-side gate and rendering.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  session: undefined as unknown,
  monitoring: undefined as unknown,
  broker: undefined as unknown,
  validation: undefined as unknown,
  reports: undefined as unknown,
  createReportMutate: vi.fn(),
}));

vi.mock("@/lib/auth-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth-client")>("@/lib/auth-client");
  return { ...actual, useSession: () => ({ data: mockState.session }) };
});

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetMonitoringStatus: () => ({ data: mockState.monitoring, isLoading: false }),
    useGetBrokerHealth: () => ({ data: mockState.broker, isLoading: false }),
    useGetMarketDataValidation: () => ({ data: mockState.validation, isLoading: false }),
    useListReconciliationReports: () => ({ data: mockState.reports, isLoading: false }),
    useCreateReconciliationReport: () => ({ mutate: mockState.createReportMutate, isPending: false }),
  };
});

import OperationsDashboard from "./OperationsDashboard";

const adminSession = { user: { id: "u1", email: "admin@example.test", role: "admin" } };
const userSession = { user: { id: "u2", email: "user@example.test", role: "user" } };

beforeEach(() => {
  mockState.session = adminSession;
  mockState.monitoring = {
    status: "ok",
    timestamp: new Date().toISOString(),
    database: { connected: true, latencyMs: 5, error: null },
    jobs: [
      { job: "auto-execution", lastRunAt: new Date().toISOString(), lastDurationMs: 12, lastStatus: "ok", lastError: null, consecutiveFailures: 0, totalRuns: 10, totalFailures: 0 },
    ],
    requestMetrics: { total: 100, byStatusClass: { "2xx": 90, "3xx": 0, "4xx": 8, "5xx": 2, other: 0 } },
    auditSignals: { guardrailBlocksLastHour: 0, authFailuresLastHour: 0, computedAt: new Date().toISOString() },
    alerts: [],
  };
  mockState.broker = { connected: false, authenticationSuccessful: false, accountStatus: null, buyingPower: null, cashBalance: null, portfolioValue: null, openPositionsCount: null, openOrdersCount: null, lastSuccessfulCheckAt: null, reason: "No Alpaca credentials configured", checkedAt: new Date().toISOString() };
  mockState.validation = {
    generatedAt: new Date().toISOString(),
    marketClock: { source: "static_approximation", isOpen: false, currentTimeEt: "22:00", nextOpen: null, nextClose: null, reason: "Static approximation: outside standard 9:30am-4:00pm ET hours." },
    optionsEngine: { engine: "options", source: "mock", connected: false, keyPresent: null, lastSuccessAt: null, staleMinutes: null, stale: false, missingData: false, message: "Mock provider selected." },
    investingEngine: [
      { engine: "investing", source: "FMP", connected: false, keyPresent: false, lastSuccessAt: null, staleMinutes: null, stale: false, missingData: false, message: "FMP is not configured." },
    ],
    tradingEngine: { engine: "trading", source: "simulated", connected: false, keyPresent: null, lastSuccessAt: null, staleMinutes: null, stale: false, missingData: false, message: "Engine 2 has no live market data provider today." },
    conflictingProviderDetection: { applicable: false, reason: "Each engine selects and queries exactly one active provider at a time." },
    overallStale: false,
    overallMissingData: false,
  };
  mockState.reports = { reports: [] };
  mockState.createReportMutate = vi.fn();
});

describe("OperationsDashboard", () => {
  it("shows an honest 'administrators only' message for a non-admin session", () => {
    mockState.session = userSession;
    renderWithClient(<OperationsDashboard />);
    expect(screen.getByTestId("text-ops-admin-only")).toBeInTheDocument();
  });

  it("shows the same message when there is no session at all", () => {
    mockState.session = null;
    renderWithClient(<OperationsDashboard />);
    expect(screen.getByTestId("text-ops-admin-only")).toBeInTheDocument();
  });

  it("renders the full dashboard for a real admin session", () => {
    renderWithClient(<OperationsDashboard />);
    expect(screen.getByText("API Health")).toBeInTheDocument();
    expect(screen.getByText("Broker Health")).toBeInTheDocument();
    expect(screen.getByText(/Background Job Scheduler/)).toBeInTheDocument();
    expect(screen.getByText(/Live Market Data Validation/)).toBeInTheDocument();
  });

  it("shows the honest no-active-alerts message when there are none", () => {
    renderWithClient(<OperationsDashboard />);
    expect(screen.getByTestId("text-alerts-empty")).toBeInTheDocument();
  });

  it("shows real job health rows", () => {
    renderWithClient(<OperationsDashboard />);
    expect(screen.getByText("auto-execution")).toBeInTheDocument();
  });

  it("shows the honest empty-reconciliation-history message", () => {
    renderWithClient(<OperationsDashboard />);
    expect(screen.getByTestId("text-reconciliation-reports-empty")).toBeInTheDocument();
  });

  it("clicking 'Run Reconciliation Now' triggers the mutation", () => {
    renderWithClient(<OperationsDashboard />);
    fireEvent.click(screen.getByTestId("button-run-reconciliation"));
    expect(mockState.createReportMutate).toHaveBeenCalled();
  });
});
