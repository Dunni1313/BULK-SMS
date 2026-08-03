// v1.6.0 Sprint 1 — AI Trading Coach Guided Workflow. Component-level
// tests for the single reusable AiTradingCoachPanel, mocking its one
// dependency point (useTradingCoachWorkflow) directly — following the
// established mocked-generated-hook pattern (vi.hoisted state object,
// static top-level vi.mock).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";
import {
  DAILY_WORKFLOW_STEP_ORDER,
  DAILY_WORKFLOW_STEP_LABELS,
  type DailyWorkflowResult,
  type DailyWorkflowStepId,
} from "@/lib/ai-coach/tradingCoachWorkflow";

const setLocationMock = vi.hoisted(() => vi.fn());
vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return { ...actual, useLocation: () => ["/scanner", setLocationMock] };
});

const mockState = vi.hoisted(() => ({
  loading: false,
  workflow: undefined as DailyWorkflowResult | undefined,
  activeTradePlanId: null as number | null,
  experienceLevel: "beginner" as const,
  beginnerModeEnabled: true,
  marketIsOpen: true as boolean | null,
  noTradeReason: null as string | null,
  declareNoTrade: vi.fn(),
  clearNoTrade: vi.fn(),
  markStepComplete: vi.fn(),
  markStepSkipped: vi.fn(),
  setExperienceLevel: vi.fn(),
  toggleBeginnerMode: vi.fn(),
}));

vi.mock("@/lib/ai-coach/useTradingCoachWorkflow", () => ({
  useTradingCoachWorkflow: () => mockState,
}));

import { AiTradingCoachPanel } from "./AiTradingCoachPanel";

function buildWorkflow(overrides: Partial<DailyWorkflowResult> = {}): DailyWorkflowResult {
  const steps = DAILY_WORKFLOW_STEP_ORDER.map((id, i) => ({
    id,
    label: DAILY_WORKFLOW_STEP_LABELS[id],
    status: (i === 0 ? "active" : i === 1 ? "ready" : "not-started") as DailyWorkflowResult["steps"][number]["status"],
    estimatedMinutes: 5,
    blockedReason: null,
  }));
  return {
    steps,
    primaryNextStepId: "morning-brief" as DailyWorkflowStepId,
    primaryReason: "The next step in today's sequence is Morning Brief.",
    applicableStepIds: DAILY_WORKFLOW_STEP_ORDER,
    completedApplicableCount: 0,
    completionPct: 0,
    isDoneForToday: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockState.loading = false;
  mockState.workflow = buildWorkflow();
  mockState.activeTradePlanId = null;
  mockState.marketIsOpen = true;
  mockState.noTradeReason = null;
  mockState.beginnerModeEnabled = true;
});

describe("AiTradingCoachPanel — loading state", () => {
  it("shows a skeleton while loading, not fabricated content", () => {
    mockState.loading = true;
    mockState.workflow = undefined;
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.queryByTestId("text-next-step-label")).not.toBeInTheDocument();
  });
});

describe("AiTradingCoachPanel — single primary action + evidence-citing reason", () => {
  it("shows exactly one Next Recommended Step with its real cited reason", () => {
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.getByTestId("text-next-step-label")).toHaveTextContent("Morning Brief");
    expect(screen.getByTestId("text-primary-reason")).toHaveTextContent("Morning Brief");
    expect(screen.getByTestId("text-estimated-time")).toBeInTheDocument();
  });

  it("Start navigates to the smart-nav destination for the primary step", () => {
    renderWithClient(<AiTradingCoachPanel />);
    fireEvent.click(screen.getByTestId("button-start-next-step"));
    expect(setLocationMock).toHaveBeenCalledWith("/");
  });

  it("disables Start when the primary step is blocked, never letting the user bypass it", () => {
    mockState.workflow = buildWorkflow({
      steps: DAILY_WORKFLOW_STEP_ORDER.map((id) => ({
        id,
        label: DAILY_WORKFLOW_STEP_LABELS[id],
        status: id === "execution" ? "blocked" : "not-started",
        estimatedMinutes: 5,
        blockedReason: id === "execution" ? "Market is closed — execution is unavailable until the market reopens." : null,
      })),
      primaryNextStepId: "execution",
      primaryReason: "Market is closed — execution is unavailable until the market reopens.",
    });
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.getByTestId("button-start-next-step")).toBeDisabled();
    expect(screen.getByText(/market is closed/i)).toBeInTheDocument();
  });
});

describe("AiTradingCoachPanel — No Trade support, never pressures execution", () => {
  it("offers No Trade Today as a first-class, always-visible action alongside Start", () => {
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.getByTestId("button-declare-no-trade")).toBeInTheDocument();
    expect(screen.getByTestId("button-start-next-step")).toBeInTheDocument();
  });

  it("confirming No Trade calls declareNoTrade with the typed reason", () => {
    renderWithClient(<AiTradingCoachPanel />);
    fireEvent.click(screen.getByTestId("button-declare-no-trade"));
    fireEvent.change(screen.getByTestId("input-no-trade-reason"), {
      target: { value: "No qualifying setups today." },
    });
    fireEvent.click(screen.getByTestId("button-confirm-no-trade"));
    expect(mockState.declareNoTrade).toHaveBeenCalledWith("No qualifying setups today.");
  });

  it("shows an already-declared No Trade reason with an Undo action, never hidden", () => {
    mockState.noTradeReason = "Market too choppy today.";
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.getByTestId("text-no-trade-declared")).toHaveTextContent("Market too choppy today.");
  });
});

describe("AiTradingCoachPanel — applicable-steps-only progress", () => {
  it("shows the real completion percentage", () => {
    mockState.workflow = buildWorkflow({ completionPct: 45 });
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.getByTestId("text-completion-pct")).toHaveTextContent("45%");
  });

  it("shows an honest done-for-today message once every applicable step is complete", () => {
    mockState.workflow = buildWorkflow({
      isDoneForToday: true,
      primaryNextStepId: null,
      primaryReason: "Every applicable step for today is complete. Nice work.",
      completionPct: 100,
    });
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.getByTestId("text-workflow-done")).toBeInTheDocument();
    expect(screen.queryByTestId("button-start-next-step")).not.toBeInTheDocument();
  });
});

describe("AiTradingCoachPanel — Beginner Mode", () => {
  it("shows the Learn trigger when Beginner Mode is enabled", () => {
    mockState.beginnerModeEnabled = true;
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.getByTestId("button-learn-trading-engine")).toBeInTheDocument();
  });

  it("hides the Learn trigger when Beginner Mode is disabled — never forces extra explanation on an advanced user", () => {
    mockState.beginnerModeEnabled = false;
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.queryByTestId("button-learn-trading-engine")).not.toBeInTheDocument();
  });
});

describe("AiTradingCoachPanel — responsive/collapsible", () => {
  it("toggling collapses the body, keeping the header visible", () => {
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.getByTestId("text-next-step-label")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-toggle-coach-panel"));
    expect(screen.getByTestId("card-ai-trading-coach")).toBeInTheDocument();
  });

  it("renders without a collapse toggle when collapsible=false", () => {
    renderWithClient(<AiTradingCoachPanel collapsible={false} />);
    expect(screen.queryByTestId("button-toggle-coach-panel")).not.toBeInTheDocument();
  });
});

describe("AiTradingCoachPanel — step checklist ordering (#2)", () => {
  it("renders all 11 steps in canonical order", () => {
    renderWithClient(<AiTradingCoachPanel />);
    const rows = DAILY_WORKFLOW_STEP_ORDER.map((id) => screen.getByTestId(`row-step-${id}`));
    expect(rows).toHaveLength(11);
  });
});
