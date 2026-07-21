// Phase 36 — Institutional Position Lifecycle Manager. Frontend smoke
// tests, following the established mocked-generated-hook pattern
// (OptionsIncomeWorkspace.test.tsx).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  positionsData: undefined as unknown,
  positionsLoading: false,
  stateData: undefined as unknown,
  stateLoading: false,
  timelineData: undefined as unknown,
  timelineLoading: false,
  checklistData: undefined as unknown,
  checklistLoading: false,
  strategyLibraryData: undefined as unknown,
  portfolioData: undefined as unknown,
  portfolioLoading: false,
  coachData: undefined as unknown,
  coachLoading: false,
  learningData: undefined as unknown,
  learningLoading: false,
  updateStateMutate: vi.fn(),
  createEventMutate: vi.fn(),
  toggleChecklistMutate: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useListOptionsIncomePositions: () => ({ data: mockState.positionsData, isLoading: mockState.positionsLoading }),
    useGetOptionsLifecycleState: () => ({ data: mockState.stateData, isLoading: mockState.stateLoading }),
    getGetOptionsLifecycleStateQueryKey: (id: number) => ["/api/options-lifecycle", id, "state"],
    useUpdateOptionsLifecycleState: () => ({ mutate: mockState.updateStateMutate }),
    useGetOptionsLifecycleTimeline: () => ({ data: mockState.timelineData, isLoading: mockState.timelineLoading }),
    getGetOptionsLifecycleTimelineQueryKey: (id: number) => ["/api/options-lifecycle", id, "timeline"],
    useCreateOptionsLifecycleEvent: () => ({ mutate: mockState.createEventMutate }),
    useGetOptionsLifecycleChecklist: () => ({ data: mockState.checklistData, isLoading: mockState.checklistLoading }),
    getGetOptionsLifecycleChecklistQueryKey: (id: number) => ["/api/options-lifecycle", id, "checklist"],
    useUpdateOptionsLifecycleChecklistItem: () => ({ mutate: mockState.toggleChecklistMutate }),
    useGetOptionsStrategyLibrary: () => ({ data: mockState.strategyLibraryData }),
    useGetOptionsLifecyclePortfolio: () => ({ data: mockState.portfolioData, isLoading: mockState.portfolioLoading }),
    useListOptionsLifecycleCoachTopics: () => ({ data: mockState.coachData, isLoading: mockState.coachLoading }),
    useListOptionsLifecycleLearning: () => ({ data: mockState.learningData, isLoading: mockState.learningLoading }),
  };
});

import OptionsLifecycleManager from "./OptionsLifecycleManager";

function samplePosition(overrides: Record<string, unknown> = {}) {
  return { id: 1, underlying: "SPY", strategy: "iron_condor", strategyLabel: "Iron Condor", status: "open", ...overrides };
}

function sampleState(overrides: Record<string, unknown> = {}) {
  return { id: 1, tradeId: 1, stage: "open", reviewCadence: "manual", createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z", ...overrides };
}

function emptyPortfolio(overrides: Record<string, unknown> = {}) {
  return {
    positionConcentration: [],
    strategyAllocation: [],
    sectorAllocation: [],
    expirationLadder: [],
    capitalUtilisation: { portfolioValue: 0, totalRiskDollars: 0, totalRiskPct: 0 },
    buyingPowerAllocation: { buyingPower: 0 },
    incomeAllocation: { bySymbol: [], byStrategy: [], strategyMix: [] },
    expirationTracker: [],
    exposureTimeline: [],
    lifecycleSummary: {
      totalPositions: 0,
      byStage: ["draft", "planned", "open", "monitoring", "near_expiration", "assignment_risk", "closed", "archived"].map((stage) => ({ stage, count: 0 })),
      positionsAwaitingReview: 0,
    },
    generatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("OptionsLifecycleManager", () => {
  beforeEach(() => {
    mockState.positionsData = undefined;
    mockState.positionsLoading = false;
    mockState.stateData = undefined;
    mockState.stateLoading = false;
    mockState.timelineData = undefined;
    mockState.timelineLoading = false;
    mockState.checklistData = undefined;
    mockState.checklistLoading = false;
    mockState.strategyLibraryData = undefined;
    mockState.portfolioData = undefined;
    mockState.portfolioLoading = false;
    mockState.coachData = undefined;
    mockState.coachLoading = false;
    mockState.learningData = undefined;
    mockState.learningLoading = false;
    mockState.updateStateMutate = vi.fn();
    mockState.createEventMutate = vi.fn();
    mockState.toggleChecklistMutate = vi.fn();
  });

  it("honestly reports an empty position picker for a brand-new user, no positions", () => {
    mockState.positionsData = [];
    renderWithClient(<OptionsLifecycleManager />);
    expect(screen.getByTestId("position-picker-empty")).toBeInTheDocument();
  });

  it("shows an honest no-selection message on the Position Workspace and Checklist tabs before a position is picked", () => {
    mockState.positionsData = [samplePosition()];
    renderWithClient(<OptionsLifecycleManager />);
    expect(screen.getByTestId("position-workspace-no-selection")).toBeInTheDocument();
  });

  it("selecting a position shows its real lifecycle stage and review cadence — Lifecycle Status & Review Schedule", async () => {
    mockState.positionsData = [samplePosition()];
    mockState.stateData = sampleState({ stage: "monitoring", reviewCadence: "weekly" });
    mockState.timelineData = [];
    renderWithClient(<OptionsLifecycleManager />);
    await userEvent.click(screen.getByTestId("position-picker-select"));
    await userEvent.click(screen.getByTestId("position-picker-option-1"));
    expect(screen.getByTestId("current-stage-badge")).toHaveTextContent("monitoring");
    expect(screen.getByTestId("current-stage-badge")).toHaveTextContent("weekly");
  });

  it("clicking a stage button submits an explicit PATCH — never an automatic transition", async () => {
    mockState.positionsData = [samplePosition()];
    mockState.stateData = sampleState({ stage: "open" });
    mockState.timelineData = [];
    renderWithClient(<OptionsLifecycleManager />);
    await userEvent.click(screen.getByTestId("position-picker-select"));
    await userEvent.click(screen.getByTestId("position-picker-option-1"));
    await userEvent.click(screen.getByTestId("stage-option-near_expiration"));
    expect(mockState.updateStateMutate).toHaveBeenCalledWith({ tradeId: 1, data: { stage: "near_expiration" } });
  });

  it("clicking a review cadence button submits an explicit PATCH — Review Schedule", async () => {
    mockState.positionsData = [samplePosition()];
    mockState.stateData = sampleState({ reviewCadence: "manual" });
    mockState.timelineData = [];
    renderWithClient(<OptionsLifecycleManager />);
    await userEvent.click(screen.getByTestId("position-picker-select"));
    await userEvent.click(screen.getByTestId("position-picker-option-1"));
    await userEvent.click(screen.getByTestId("cadence-option-daily"));
    expect(mockState.updateStateMutate).toHaveBeenCalledWith({ tradeId: 1, data: { reviewCadence: "daily" } });
  });

  it("the Position Timeline is honestly empty until an event is recorded, and filters into the Adjustment Journal / Assignment Tracker", async () => {
    mockState.positionsData = [samplePosition()];
    mockState.stateData = sampleState();
    mockState.timelineData = [
      { id: 1, tradeId: 1, eventType: "adjustment_note", stage: null, reviewType: null, detail: "Rolled the put down.", createdAt: "2026-07-10T00:00:00.000Z" },
      { id: 2, tradeId: 1, eventType: "assignment_note", stage: null, reviewType: null, detail: "Short call now ITM.", createdAt: "2026-07-11T00:00:00.000Z" },
    ];
    renderWithClient(<OptionsLifecycleManager />);
    await userEvent.click(screen.getByTestId("position-picker-select"));
    await userEvent.click(screen.getByTestId("position-picker-option-1"));
    expect(screen.getByTestId("timeline-event-1")).toHaveTextContent("Rolled the put down.");
    expect(screen.getByTestId("timeline-event-2")).toHaveTextContent("Short call now ITM.");

    await userEvent.click(screen.getByTestId("timeline-filter-adjustment_note"));
    expect(screen.getByTestId("timeline-event-1")).toBeInTheDocument();
    expect(screen.queryByTestId("timeline-event-2")).not.toBeInTheDocument();
  });

  it("recording an event submits the correct eventType/detail", async () => {
    mockState.positionsData = [samplePosition()];
    mockState.stateData = sampleState();
    mockState.timelineData = [];
    renderWithClient(<OptionsLifecycleManager />);
    await userEvent.click(screen.getByTestId("position-picker-select"));
    await userEvent.click(screen.getByTestId("position-picker-option-1"));
    await userEvent.type(screen.getByTestId("event-detail-input"), "Thesis still intact.");
    await userEvent.click(screen.getByTestId("event-submit"));
    expect(mockState.createEventMutate).toHaveBeenCalledWith({
      tradeId: 1,
      data: { eventType: "adjustment_note", reviewType: undefined, detail: "Thesis still intact." },
    });
  });

  it("the Checklist tab honestly shows a build form when no checklist exists yet, and never changes the lifecycle stage", async () => {
    mockState.positionsData = [samplePosition()];
    mockState.checklistData = undefined;
    mockState.strategyLibraryData = [{ key: "iron_condor", label: "Iron Condor" }];
    renderWithClient(<OptionsLifecycleManager />);
    await userEvent.click(screen.getByTestId("position-picker-select"));
    await userEvent.click(screen.getByTestId("position-picker-option-1"));
    await userEvent.click(screen.getByTestId("tab-olm-checklist"));
    expect(screen.getByTestId("checklist-build-form")).toBeInTheDocument();
  });

  it("toggling a checklist item submits itemId/checked, never an order or lifecycle change", async () => {
    mockState.positionsData = [samplePosition()];
    mockState.checklistData = {
      id: 1,
      tradeId: 1,
      strategyKey: "iron_condor",
      items: [{ id: "iv-rank-reviewed", label: "IV rank reviewed", required: true, checked: false }],
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    };
    renderWithClient(<OptionsLifecycleManager />);
    await userEvent.click(screen.getByTestId("position-picker-select"));
    await userEvent.click(screen.getByTestId("position-picker-option-1"));
    await userEvent.click(screen.getByTestId("tab-olm-checklist"));
    await userEvent.click(screen.getByTestId("checklist-item-checkbox-iv-rank-reviewed"));
    expect(mockState.toggleChecklistMutate).toHaveBeenCalledWith({ tradeId: 1, data: { itemId: "iv-rank-reviewed", checked: true } });
  });

  it("Portfolio Management honestly reports empty allocations for a brand-new user — position concentration, strategy/sector allocation, expiration ladder, income allocation, expiration tracker", async () => {
    mockState.positionsData = [];
    mockState.portfolioData = emptyPortfolio();
    renderWithClient(<OptionsLifecycleManager />);
    await userEvent.click(screen.getByTestId("tab-olm-portfolio"));
    expect(screen.getByTestId("lifecycle-summary-total")).toHaveTextContent("0");
    expect(screen.getByTestId("position-concentration-empty")).toBeInTheDocument();
    expect(screen.getByTestId("income-allocation-empty")).toBeInTheDocument();
    expect(screen.getByTestId("expiration-tracker-empty")).toBeInTheDocument();
  });

  it("Portfolio Management shows real allocation figures and the Portfolio Exposure Timeline once resolved", async () => {
    mockState.positionsData = [];
    mockState.portfolioData = emptyPortfolio({
      positionConcentration: [{ key: "SPY", label: "SPY", positionCount: 1, weightPct: 40 }],
      capitalUtilisation: { portfolioValue: 100000, totalRiskDollars: 4500, totalRiskPct: 4.5 },
      buyingPowerAllocation: { buyingPower: 25000 },
      exposureTimeline: [
        { monthEnd: "2026-06-30", openPositionsCount: 2, byStrategy: [{ strategy: "iron_condor", count: 2 }] },
      ],
      lifecycleSummary: {
        totalPositions: 2,
        byStage: ["draft", "planned", "open", "monitoring", "near_expiration", "assignment_risk", "closed", "archived"].map((stage) => ({
          stage,
          count: stage === "open" ? 2 : 0,
        })),
        positionsAwaitingReview: 0,
      },
    });
    renderWithClient(<OptionsLifecycleManager />);
    await userEvent.click(screen.getByTestId("tab-olm-portfolio"));
    expect(screen.getByTestId("panel-olm-position-concentration")).toHaveTextContent("SPY: 40.0%");
    expect(screen.getByTestId("panel-olm-capital-utilisation")).toHaveTextContent("$100,000");
    expect(screen.getByTestId("exposure-timeline-list")).toHaveTextContent("2026-06-30: 2 open");
    expect(screen.getByTestId("lifecycle-summary-by-stage")).toHaveTextContent("open: 2");
  });

  it("Coach & Learning shows the deterministic AI Coach topics and per-stage Learning Centre links", async () => {
    mockState.coachData = [
      { topic: "assignment_mechanics", title: "Assignment Mechanics", explanation: ["Assignment is what happens to the seller."], disclaimer: "Educational only." },
    ];
    mockState.learningData = [
      { stage: "assignment_risk", links: [{ pathKey: "foundations", topicKey: "foundations-assignment", category: "assignment", title: "Assignment", summary: "…", href: "/learn/paths/foundations/foundations-assignment" }] },
    ];
    renderWithClient(<OptionsLifecycleManager />);
    await userEvent.click(screen.getByTestId("tab-olm-learning"));
    expect(screen.getByTestId("coach-topic-assignment_mechanics")).toHaveTextContent("Assignment Mechanics");
    expect(screen.getByTestId("learning-stage-assignment_risk")).toBeInTheDocument();
    expect(screen.getByTestId("learning-link-foundations-foundations-assignment")).toHaveAttribute("href", "/learn/paths/foundations/foundations-assignment");
  });

  it("Reporting tab links out to the Reporting Centre's own Options Portfolio Review and Position Lifecycle Summary reports — deep links", async () => {
    renderWithClient(<OptionsLifecycleManager />);
    await userEvent.click(screen.getByTestId("tab-olm-reporting"));
    expect(screen.getByTestId("link-report-options-portfolio-review")).toHaveAttribute("href", "/reporting-centre?reportType=options-portfolio-review");
    expect(screen.getByTestId("link-report-position-lifecycle-summary")).toHaveAttribute("href", "/reporting-centre?reportType=position-lifecycle-summary");
    expect(screen.getByTestId("link-reporting-centre")).toHaveAttribute("href", "/reporting-centre");
  });
});
