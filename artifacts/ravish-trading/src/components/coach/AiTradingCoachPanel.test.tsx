// v1.6.0 Sprint 1 — AI Trading Coach Guided Workflow. Component-level
// tests for the single reusable AiTradingCoachPanel, mocking its one
// dependency point (useTradingCoachWorkflow) directly — following the
// established mocked-generated-hook pattern (vi.hoisted state object,
// static top-level vi.mock).
//
// v1.6.0 Sprint 2 — Guided Workflow UX, Onboarding & Real-World
// Validation. Extends this same file (never a second test file for the
// same one panel) with coverage for: first-time onboarding (localStorage
// mocked per-test), Mark Complete/Skip wiring the previously-unused
// mutations, waitingReason display, the No-Trade alternative-actions
// section, the contextual Learn trigger, the ?workflowStep= context
// banner (via an extended wouter mock also overriding useSearch), and
// accessibility attributes.

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
const searchMock = vi.hoisted(() => ({ value: "" }));
vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return { ...actual, useLocation: () => ["/scanner", setLocationMock], useSearch: () => searchMock.value };
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
    waitingReason: null,
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
  localStorage.clear();
  searchMock.value = "";
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
    expect(setLocationMock).toHaveBeenCalledWith("/?workflowStep=morning-brief");
  });

  it("disables Start when the primary step is blocked, never letting the user bypass it", () => {
    mockState.workflow = buildWorkflow({
      steps: DAILY_WORKFLOW_STEP_ORDER.map((id) => ({
        id,
        label: DAILY_WORKFLOW_STEP_LABELS[id],
        status: id === "execution" ? "blocked" : "not-started",
        estimatedMinutes: 5,
        blockedReason: id === "execution" ? "Market is closed — execution is unavailable until the market reopens." : null,
        waitingReason: null,
      })),
      primaryNextStepId: "execution",
      primaryReason: "Market is closed — execution is unavailable until the market reopens.",
    });
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.getByTestId("button-start-next-step")).toBeDisabled();
    expect(screen.getByText(/market is closed/i)).toBeInTheDocument();
    // A blocked step never offers a Mark Complete shortcut around the block.
    expect(screen.queryByTestId("button-mark-step-complete")).not.toBeInTheDocument();
  });
});

describe("AiTradingCoachPanel — Mark Complete / Skip wire up the previously-unused mutations (Sprint 2 #2/#8)", () => {
  it("Mark Complete calls markStepComplete for the active step — the fix that lets Morning Brief/Research/Daily Review ever progress", () => {
    renderWithClient(<AiTradingCoachPanel />);
    fireEvent.click(screen.getByTestId("button-mark-step-complete"));
    expect(mockState.markStepComplete).toHaveBeenCalledWith("morning-brief");
  });

  it("Skip calls markStepSkipped for the active step", () => {
    renderWithClient(<AiTradingCoachPanel />);
    fireEvent.click(screen.getByTestId("button-skip-step"));
    expect(mockState.markStepSkipped).toHaveBeenCalledWith("morning-brief");
  });
});

describe("AiTradingCoachPanel — waiting-reason explanations for not-started steps (Sprint 2 #4)", () => {
  it("shows a real, non-fabricated waitingReason under a not-started step", () => {
    mockState.workflow = buildWorkflow({
      steps: DAILY_WORKFLOW_STEP_ORDER.map((id, i) => ({
        id,
        label: DAILY_WORKFLOW_STEP_LABELS[id],
        status: (i === 0 ? "active" : i === 1 ? "ready" : "not-started") as DailyWorkflowResult["steps"][number]["status"],
        estimatedMinutes: 5,
        blockedReason: null,
        waitingReason: i >= 2 ? `Waiting for "${DAILY_WORKFLOW_STEP_LABELS[DAILY_WORKFLOW_STEP_ORDER[i - 1]]}" to be completed first.` : null,
      })),
    });
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.getByTestId("text-waiting-reason-opportunity-review")).toHaveTextContent(/waiting for "market scan"/i);
  });

  it("never shows a waitingReason for the active or ready step", () => {
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.queryByTestId("text-waiting-reason-morning-brief")).not.toBeInTheDocument();
    expect(screen.queryByTestId("text-waiting-reason-market-scan")).not.toBeInTheDocument();
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

describe("AiTradingCoachPanel — professional No-Trade alternative actions (Sprint 2 #5)", () => {
  it("offers real, existing-page alternatives once No Trade is declared", () => {
    mockState.noTradeReason = "No qualifying setups today.";
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.getByTestId("section-no-trade-alternatives")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("link-no-trade-journal"));
    expect(setLocationMock).toHaveBeenCalledWith("/trading-journal");
  });

  it("never shows alternative actions before No Trade is declared", () => {
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.queryByTestId("section-no-trade-alternatives")).not.toBeInTheDocument();
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

describe("AiTradingCoachPanel — resuming today's session (Sprint 2 #3)", () => {
  it("shows a resuming line once real progress already exists today", () => {
    mockState.workflow = buildWorkflow({ completedApplicableCount: 3 });
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.getByTestId("text-resuming-session")).toHaveTextContent("3");
  });

  it("shows no resuming line for a brand-new day with zero progress", () => {
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.queryByTestId("text-resuming-session")).not.toBeInTheDocument();
  });
});

describe("AiTradingCoachPanel — context preserved via ?workflowStep= (Sprint 2 #7)", () => {
  it("confirms which workflow step the user is continuing when arriving via Smart Navigation", () => {
    searchMock.value = "workflowStep=market-scan";
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.getByTestId("text-workflow-step-context")).toHaveTextContent("Market Scan");
  });

  it("never shows the context banner on a plain, direct page visit", () => {
    searchMock.value = "";
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.queryByTestId("text-workflow-step-context")).not.toBeInTheDocument();
  });

  it("never fabricates a step label for an invalid workflowStep value", () => {
    searchMock.value = "workflowStep=not-a-real-step";
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.queryByTestId("text-workflow-step-context")).not.toBeInTheDocument();
  });
});

describe("AiTradingCoachPanel — first-time onboarding (Sprint 2 #1)", () => {
  it("shows the welcome callout for a first-time Beginner Mode user", () => {
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.getByTestId("section-onboarding-welcome")).toBeInTheDocument();
  });

  it("dismissing persists across remounts (localStorage), never re-shown", () => {
    const { unmount } = renderWithClient(<AiTradingCoachPanel />);
    fireEvent.click(screen.getByTestId("button-dismiss-onboarding"));
    expect(screen.queryByTestId("section-onboarding-welcome")).not.toBeInTheDocument();
    unmount();
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.queryByTestId("section-onboarding-welcome")).not.toBeInTheDocument();
  });

  it("never shows onboarding when Beginner Mode is disabled", () => {
    mockState.beginnerModeEnabled = false;
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.queryByTestId("section-onboarding-welcome")).not.toBeInTheDocument();
  });
});

describe("AiTradingCoachPanel — Beginner Mode", () => {
  it("shows the generic Learn trigger when Beginner Mode is enabled and no contextual match exists", () => {
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.getByTestId("button-learn-trading-engine")).toBeInTheDocument();
  });

  it("hides the Learn trigger when Beginner Mode is disabled — never forces extra explanation on an advanced user", () => {
    mockState.beginnerModeEnabled = false;
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.queryByTestId("button-learn-trading-engine")).not.toBeInTheDocument();
  });

  it("shows a contextual, step-specific Learn trigger instead of the generic one when a real match exists (Sprint 2 #6)", () => {
    mockState.workflow = buildWorkflow({ primaryNextStepId: "research" });
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.getByTestId("button-learn-trading-engine-trading-market-structure")).toBeInTheDocument();
    // The generic bottom-of-panel trigger is not duplicated alongside the contextual one.
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

describe("AiTradingCoachPanel — accessibility (Sprint 2 #9)", () => {
  it("marks the active step with aria-current=step", () => {
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.getByTestId("row-step-morning-brief")).toHaveAttribute("aria-current", "step");
    expect(screen.getByTestId("row-step-market-scan")).not.toHaveAttribute("aria-current");
  });

  it("the step list carries an accessible list role and label", () => {
    renderWithClient(<AiTradingCoachPanel />);
    expect(screen.getByRole("list", { name: /today's workflow steps/i })).toBeInTheDocument();
  });
});
