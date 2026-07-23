// Phase 42 — Institutional Portfolio Monitoring & Compliance Engine.
// Frontend smoke tests, following the established mocked-generated-hook
// pattern (RebalancingEngine.test.tsx for the plain GET dashboard hook +
// useMutation-based create/update/delete hooks).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const createMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const updateMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const deleteMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const mockState = vi.hoisted(() => ({
  dashboardData: undefined as unknown,
  dashboardLoading: false,
  dashboardError: false,
  policyTypesData: undefined as unknown,
  policiesData: undefined as unknown,
  policiesLoading: false,
  coachData: undefined as unknown,
  coachLoading: false,
  learningData: undefined as unknown,
  learningLoading: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetMonitoringComplianceDashboard: () => ({ data: mockState.dashboardData, isLoading: mockState.dashboardLoading, isError: mockState.dashboardError }),
    useListCompliancePolicyTypes: () => ({ data: mockState.policyTypesData }),
    useListCompliancePolicies: () => ({ data: mockState.policiesData, isLoading: mockState.policiesLoading }),
    useCreateCompliancePolicy: () => createMock,
    useUpdateCompliancePolicy: () => updateMock,
    useDeleteCompliancePolicy: () => deleteMock,
    useListComplianceCoachTopics: () => ({ data: mockState.coachData, isLoading: mockState.coachLoading }),
    useListComplianceLearning: () => ({ data: mockState.learningData, isLoading: mockState.learningLoading }),
  };
});

import MonitoringComplianceEngine from "./MonitoringComplianceEngine";

function evaluation(over: Record<string, unknown> = {}) {
  return {
    policyId: 1,
    policyType: "position_allocation_max",
    category: "position",
    label: "AAPL Position Cap",
    targetKey: "AAPL",
    direction: "max",
    limitValue: 25,
    currentValue: 40,
    differenceValue: 15,
    status: "breach",
    detail: "AAPL Position Cap: current 40% exceeds the 25% limit.",
    enabled: true,
    ...over,
  };
}

function dashboard(overrides: Record<string, unknown> = {}) {
  return {
    complianceSummary: {
      totalPolicies: 1,
      enabledPolicies: 1,
      compliantCount: 0,
      breachCount: 1,
      unavailableCount: 0,
      overallStatus: "breach",
      summary: "1 policy(ies) evaluated — 0 compliant, 1 breach(es).",
    },
    evaluations: [evaluation()],
    allocationLimits: [evaluation()],
    sectorLimits: [],
    assetLimits: [],
    positionLimits: [evaluation()],
    strategyLimits: [],
    greeksLimits: [],
    buyingPowerLimits: [],
    incomeStabilityLimits: [],
    diversificationLimits: [],
    policyViolations: [evaluation()],
    complianceTimeline: [],
    complianceTimelineNote: "Reused directly from the Risk & Exposure Engine's own Concentration Timeline.",
    generatedAt: "2026-07-21T00:00:00.000Z",
    ...overrides,
  };
}

describe("MonitoringComplianceEngine", () => {
  beforeEach(() => {
    mockState.dashboardData = undefined;
    mockState.dashboardLoading = false;
    mockState.dashboardError = false;
    mockState.policyTypesData = undefined;
    mockState.policiesData = undefined;
    mockState.policiesLoading = false;
    mockState.coachData = undefined;
    mockState.coachLoading = false;
    mockState.learningData = undefined;
    mockState.learningLoading = false;
    createMock.mutate.mockReset();
    createMock.isPending = false;
    updateMock.mutate.mockReset();
    updateMock.isPending = false;
    deleteMock.mutate.mockReset();
    deleteMock.isPending = false;
  });

  it("renders the page header and disclosure labels", () => {
    renderWithClient(<MonitoringComplianceEngine />);
    expect(screen.getByText("Institutional Portfolio Monitoring & Compliance Engine")).toBeInTheDocument();
    expect(screen.getByTestId("mce-labels")).toBeInTheDocument();
  });

  it("shows a loading skeleton while the dashboard is loading", () => {
    mockState.dashboardLoading = true;
    renderWithClient(<MonitoringComplianceEngine />);
    expect(screen.queryByTestId("panel-mce-summary")).not.toBeInTheDocument();
  });

  it("shows an honest error message if the dashboard fails to load", () => {
    mockState.dashboardError = true;
    renderWithClient(<MonitoringComplianceEngine />);
    expect(screen.getByTestId("mce-dashboard-error")).toBeInTheDocument();
  });

  it("shows an honest empty dashboard when there are zero policies, never a fabricated status", () => {
    mockState.dashboardData = dashboard({
      complianceSummary: { totalPolicies: 0, enabledPolicies: 0, compliantCount: 0, breachCount: 0, unavailableCount: 0, overallStatus: "no_policies", summary: "No compliance policies configured yet." },
      evaluations: [],
      allocationLimits: [],
      positionLimits: [],
      policyViolations: [],
    });
    renderWithClient(<MonitoringComplianceEngine />);
    expect(screen.getByTestId("panel-mce-summary")).toHaveTextContent("No compliance policies configured yet.");
    expect(screen.getByTestId("mce-violations-empty")).toBeInTheDocument();
    expect(screen.getByTestId("panel-mce-position-limits-empty")).toBeInTheDocument();
  });

  it("renders the Compliance Summary with real counts, never fabricated", () => {
    mockState.dashboardData = dashboard();
    renderWithClient(<MonitoringComplianceEngine />);
    const summary = screen.getByTestId("panel-mce-summary");
    expect(summary).toHaveTextContent("1");
    expect(summary).toHaveTextContent("breach");
  });

  it("renders a real Policy Violation entry with current/limit/status, never a recommended action", () => {
    mockState.dashboardData = dashboard();
    renderWithClient(<MonitoringComplianceEngine />);
    const row = within(screen.getByTestId("panel-mce-violations")).getByTestId("evaluation-1");
    expect(row).toHaveTextContent("AAPL Position Cap");
    expect(row).toHaveTextContent("AAPL");
    expect(row).toHaveTextContent("40");
    expect(row).toHaveTextContent("25");
    expect(row).toHaveTextContent("breach");
    expect(row.textContent?.toLowerCase()).not.toMatch(/recommend|you should (buy|sell)/);
  });

  it("renders the Compliance Timeline honest-empty message when there is no history yet", () => {
    mockState.dashboardData = dashboard();
    renderWithClient(<MonitoringComplianceEngine />);
    expect(screen.getByTestId("mce-timeline-empty")).toBeInTheDocument();
  });

  it("Policy Configuration: selecting a type, entering a target/limit, and creating submits the correct payload", async () => {
    mockState.policyTypesData = [
      {
        policyType: "portfolio_delta_max",
        category: "greeks",
        label: "Maximum Portfolio Delta",
        description: "The absolute value of the Options book's net delta must not exceed this limit.",
        unit: "delta",
        direction: "max",
        requiresTargetKey: false,
        defaultLimitValue: 100,
        engine: "options",
      },
    ];
    createMock.mutate.mockImplementation((_vars: unknown, opts: { onSuccess: () => void }) => opts.onSuccess());

    const user = userEvent.setup();
    renderWithClient(<MonitoringComplianceEngine />);
    await user.click(screen.getByTestId("tab-mce-policies"));
    await user.click(screen.getByTestId("new-policy-type-select"));
    await user.click(await screen.findByText("Maximum Portfolio Delta"));

    expect(screen.getByTestId("new-policy-limit-value")).toHaveValue(100);

    await user.click(screen.getByTestId("new-policy-create-btn"));

    expect(createMock.mutate).toHaveBeenCalledWith(
      { data: { policyType: "portfolio_delta_max", label: "Maximum Portfolio Delta", targetKey: undefined, direction: "max", limitValue: 100 } },
      expect.anything(),
    );
  });

  it("Policy Configuration: shows an honest empty-policies message, and toggling/deleting an existing policy submits the correct payload", async () => {
    mockState.policiesData = [{ id: 7, policyType: "portfolio_delta_max", label: "Delta Cap", targetKey: null, direction: "max", limitValue: 100, enabled: true, createdAt: "2026-07-21T00:00:00.000Z", updatedAt: "2026-07-21T00:00:00.000Z" }];
    updateMock.mutate.mockImplementation((_vars: unknown, opts: { onSuccess: () => void }) => opts.onSuccess());
    deleteMock.mutate.mockImplementation((_vars: unknown, opts: { onSuccess: () => void }) => opts.onSuccess());

    const user = userEvent.setup();
    renderWithClient(<MonitoringComplianceEngine />);
    await user.click(screen.getByTestId("tab-mce-policies"));

    expect(screen.getByTestId("policy-row-7")).toHaveTextContent("Delta Cap");

    await user.click(screen.getByTestId("policy-enabled-7"));
    expect(updateMock.mutate).toHaveBeenCalledWith({ id: 7, data: { enabled: false } }, expect.anything());

    await user.click(screen.getByTestId("policy-delete-7"));
    expect(deleteMock.mutate).toHaveBeenCalledWith({ id: 7 }, expect.anything());
  });

  it("Policy Configuration: shows an honest empty-policies message when there are none", async () => {
    mockState.policiesData = [];
    const user = userEvent.setup();
    renderWithClient(<MonitoringComplianceEngine />);
    await user.click(screen.getByTestId("tab-mce-policies"));
    expect(screen.getByTestId("mce-policies-empty")).toBeInTheDocument();
  });

  it("renders the Coach & Learning tab with real topics and Learning Centre links, never a trade recommendation", async () => {
    const user = userEvent.setup();
    mockState.coachData = [{ topic: "governance", title: "Governance", explanation: ["Real explanation text."], disclaimer: "Educational only." }];
    mockState.learningData = [{ topic: "diversification", links: [{ pathKey: "portfolio", topicKey: "portfolio-diversification", title: "Portfolio Diversification", summary: "Summary.", href: "/learn/paths/portfolio/portfolio-diversification" }] }];
    renderWithClient(<MonitoringComplianceEngine />);
    await user.click(screen.getByTestId("tab-mce-learning"));
    expect(screen.getByTestId("mce-coach-topic-governance")).toBeInTheDocument();
    expect(screen.getByTestId("mce-learning-topic-diversification")).toBeInTheDocument();
    expect(screen.getByTestId("mce-learning-link-portfolio-portfolio-diversification")).toBeInTheDocument();
  });

  it("renders the Reporting tab with deep links to the Compliance Report and Policy Monitoring Report", async () => {
    const user = userEvent.setup();
    renderWithClient(<MonitoringComplianceEngine />);
    await user.click(screen.getByTestId("tab-mce-reporting"));
    expect(screen.getByTestId("link-report-compliance-report")).toHaveAttribute("href", "/reporting-centre?reportType=compliance-report");
    expect(screen.getByTestId("link-report-policy-monitoring-report")).toHaveAttribute("href", "/reporting-centre?reportType=policy-monitoring-report");
    expect(screen.getByTestId("link-reporting-centre")).toHaveAttribute("href", "/reporting-centre");
  });
});
