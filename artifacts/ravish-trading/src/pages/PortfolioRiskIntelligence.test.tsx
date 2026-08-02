// v1.5.0, Sprint 15 — Institutional Portfolio & Risk Intelligence Engine.
// Smoke tests following the established mocked-generated-hook + mocked-
// plain-fetch pattern (see ExecutionLifecycleManager.test.tsx,
// InstitutionalCommandCentre.test.tsx). usePortfolioRiskIntelligence()'s
// own scoring/signal logic is already covered directly by
// portfolioRiskIntelligence.test.ts — these tests only prove the page
// renders the composed result correctly and honestly.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const listTradePlansMock = vi.hoisted(() => vi.fn(async (_coachId?: string) => [] as unknown[]));
const getTradePlanMock = vi.hoisted(() => vi.fn());
const getMissingTradePlanInformationMock = vi.hoisted(() => vi.fn(async () => ({ missing: [], present: [], completenessPct: 100 })));

vi.mock("@/lib/ai-coach/tradePlansApi", () => ({
  listTradePlans: listTradePlansMock,
  getTradePlan: getTradePlanMock,
  getMissingTradePlanInformation: getMissingTradePlanInformationMock,
}));

vi.mock("@/lib/ai-coach/strategiesApi", () => ({
  getStrategy: vi.fn(async () => null),
  getMissingSections: vi.fn(async () => null),
}));

const mockState = vi.hoisted(() => ({
  portfolioDashboard: undefined as unknown,
  portfolioConcentration: undefined as unknown,
  portfolios: [] as unknown[],
  portfolioRisk: undefined as unknown,
  tradingRisk: undefined as unknown,
  journalEntries: [] as unknown[],
  closedTrades: [] as unknown[],
  learningProgress: undefined as unknown,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetPortfolioDashboard: () => ({ data: mockState.portfolioDashboard, isLoading: false }),
    useGetPortfolioConcentration: () => ({ data: mockState.portfolioConcentration, isLoading: false }),
    useGetPortfolios: () => ({ data: mockState.portfolios, isLoading: false }),
    useGetPortfolioRisk: () => ({ data: mockState.portfolioRisk, isLoading: false }),
    useGetTradingRisk: () => ({ data: mockState.tradingRisk, isLoading: false }),
    useListJournalEntries: () => ({ data: mockState.journalEntries }),
    useListTrades: () => ({ data: mockState.closedTrades }),
    useGetLearningProgress: () => ({ data: mockState.learningProgress }),
  };
});

import PortfolioRiskIntelligence from "./PortfolioRiskIntelligence";

function portfolioDashboard(overrides: Record<string, unknown> = {}) {
  return {
    portfolioValue: 100000,
    buyingPower: 20000,
    totalRiskDollars: 5000,
    healthFactors: [
      { code: "diversification", label: "Diversification", score: 72, sourceModule: "x", detail: "Well diversified." },
    ],
    largestPosition: { symbol: "AAPL", riskDollars: 1000, pctOfAccount: 12.5 },
    allocationBySector: [{ key: "tech", label: "Technology", positionCount: 3, weightPct: 40 }],
    stressTestSummary: [],
    guidance: [],
    ...overrides,
  };
}

function readyToExecutePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    coachId: "trading",
    workspaceId: null,
    strategyId: null,
    title: "AAPL breakout",
    plannedAsset: "AAPL",
    assetClass: "equity",
    direction: "long",
    status: "draft",
    pinned: false,
    tags: [],
    currentVersion: 1,
    executedTradeRef: null,
    executedAt: null,
    createdAt: "2026-07-29T00:00:00Z",
    updatedAt: "2026-07-29T00:00:00Z",
    sections: [
      { id: 1, tradePlanId: 42, kind: "entry_zone", content: "Above 195", notebook: null, conversation: null, file: null, createdAt: "", updatedAt: "" },
    ],
    versions: [],
    checklistItems: [],
    checklistProgress: { totalItems: 2, completedItems: 2, requiredItems: 2, completedRequiredItems: 2, progressPct: 100, readyForEntry: true },
    ...overrides,
  };
}

describe("PortfolioRiskIntelligence", () => {
  beforeEach(() => {
    listTradePlansMock.mockReset().mockResolvedValue([]);
    getTradePlanMock.mockReset();
    getMissingTradePlanInformationMock.mockClear();
    mockState.portfolioDashboard = undefined;
    mockState.portfolioConcentration = undefined;
    mockState.portfolios = [];
    mockState.portfolioRisk = undefined;
    mockState.tradingRisk = undefined;
    mockState.journalEntries = [];
    mockState.closedTrades = [];
    mockState.learningProgress = { pathCompletion: [], recentHistory: [] };
    window.history.pushState({}, "", "/portfolio-risk-intelligence");
  });

  it("renders an honest, all-unavailable Health Score and Risk Intelligence report when no engine data exists yet", async () => {
    renderWithClient(<PortfolioRiskIntelligence />);
    expect(await screen.findByTestId("portfolio-health-card")).toBeInTheDocument();
    expect(screen.getByTestId("health-score-value")).toHaveTextContent("0");
    expect(screen.getByTestId("health-score-label")).toHaveTextContent("Poor");
    // Every factor is honestly unavailable — "N/A", never a fabricated number.
    for (const code of ["diversification", "cash_allocation", "portfolio_volatility", "correlation"]) {
      expect(screen.getByTestId(`health-factor-score-${code}`)).toHaveTextContent("N/A");
    }
    expect(screen.getByTestId("risk-intelligence-card")).toBeInTheDocument();
    expect(screen.getByTestId("risk-signal-headline-currency_exposure")).toHaveTextContent("Not tracked");
  });

  it("shows real, non-fabricated factor scores once Options Income and Trading data resolve", async () => {
    mockState.portfolioDashboard = portfolioDashboard();
    renderWithClient(<PortfolioRiskIntelligence />);
    expect(await screen.findByTestId("health-factor-score-diversification")).toHaveTextContent("72%");
    expect(screen.getByTestId("risk-signal-headline-portfolio_concentration")).toHaveTextContent(/AAPL: 12\.5%/);
  });

  it("shows an honest 'no trade plans ready' message on the What-If Analysis card when nothing is Ready to Execute", async () => {
    renderWithClient(<PortfolioRiskIntelligence />);
    expect(await screen.findByTestId("what-if-card")).toBeInTheDocument();
    expect(screen.getByTestId("what-if-none-ready")).toBeInTheDocument();
  });

  it("lets the user select a Ready-to-Execute plan and run a What-If Analysis against Trading's own risk cap", async () => {
    const plan = readyToExecutePlan();
    listTradePlansMock.mockImplementation(async (coachId: string) => (coachId === "trading" ? [plan] : []));
    getTradePlanMock.mockResolvedValue(plan);
    mockState.tradingRisk = {
      positionSizing: { score: 78, label: "Good", detail: "x", largestPositionSymbol: null, largestPositionRiskPct: null, capBreached: false, unpricedSymbols: [] },
      portfolioBudget: { score: 70, label: "Within budget", detail: "x", accountValue: 50000, totalRiskDollars: 2000, totalRiskUsedPct: 4, capBreached: false, perPosition: [] },
      accountValue: 50000,
      openPositionsCount: 0,
      positionContexts: [],
    };

    renderWithClient(<PortfolioRiskIntelligence />);

    await userEvent.click(await screen.findByTestId("what-if-select-42"));
    await userEvent.type(screen.getByTestId("what-if-risk-input"), "1000");
    await userEvent.click(screen.getByTestId("what-if-run"));

    expect(await screen.findByTestId("what-if-result")).toBeInTheDocument();
    expect(screen.getByTestId("what-if-current-vs-hypothetical")).toHaveTextContent("$2,000");
    expect(screen.getByTestId("what-if-cap-status")).toHaveTextContent(/6% portfolio-risk cap/);
  });

  it("renders the AI Portfolio Coach narrative and Continuous Learning card", async () => {
    renderWithClient(<PortfolioRiskIntelligence />);
    expect(await screen.findByTestId("ai-portfolio-coach-card")).toBeInTheDocument();
    expect(screen.getByTestId("coach-health-explanation")).toHaveTextContent(/No factors are scored yet/);
    expect(screen.getByTestId("portfolio-learning-card")).toBeInTheDocument();
  });

  it("links out to the Options Income Portfolio Dashboard and the Execution & Lifecycle Manager, never re-implementing either", async () => {
    renderWithClient(<PortfolioRiskIntelligence />);
    expect(await screen.findByTestId("link-to-portfolio-dashboard")).toHaveAttribute("href", "/portfolio-dashboard");
    expect(screen.getByTestId("link-to-execution-lifecycle")).toHaveAttribute("href", "/execution-lifecycle");
  });
});
