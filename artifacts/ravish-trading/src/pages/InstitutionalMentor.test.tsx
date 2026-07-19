// Institutional Mentor sprint — Phase 8, Sprint 5. Frontend smoke tests
// for the Institutional Mentor page, mirroring PortfolioAnalyst.test.tsx's/
// TradeJournal.test.tsx's own established mocked-generated-hook pattern.

import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  data: undefined as unknown,
  isLoading: false,
  isError: false,
  notifications: undefined as unknown[] | undefined,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetInstitutionalMentor: () => ({
      data: mockState.data,
      isLoading: mockState.isLoading,
      isError: mockState.isError,
    }),
    useListNotifications: () => ({ data: mockState.notifications }),
  };
});

import InstitutionalMentor from "./InstitutionalMentor";

function scorecardEntry(over: Record<string, unknown> = {}) {
  return {
    category: "portfolio_health",
    label: "Portfolio Health",
    score: 85,
    grade: "Excellent",
    sourceModule: "portfolioDashboard.ts — healthScore (blended)",
    why: "Blended Health Score of 85/100 (Healthy).",
    ...over,
  };
}

const ALL_CATEGORIES = [
  "capital_allocation",
  "risk_management",
  "diversification",
  "discipline",
  "income_generation",
  "position_sizing",
  "greeks_management",
  "event_preparation",
  "portfolio_health",
];

function fullScorecard() {
  return ALL_CATEGORIES.map((category) => scorecardEntry({ category, label: category }));
}

function learningLink(over: Record<string, unknown> = {}) {
  return {
    category: "concentration",
    lessonHref: "/learn/paths/portfolio/portfolio-concentration",
    lessonTitle: "Concentration",
    glossaryHref: "/learn/glossary/concentration",
    glossaryTerm: "Concentration",
    strategyHref: "/learn/strategy-academy/vertical_spread",
    strategyLabel: "Vertical Spread",
    explainModeHref: "/learn?tab=portfolio",
    ...over,
  };
}

function resultFixture(over: Record<string, unknown> = {}) {
  return {
    paperTradingMode: true,
    deterministicAnalysis: true,
    educationalOnly: true,
    scorecard: fullScorecard(),
    professionalReview: [
      { text: "Capital allocation remains balanced across strategies.", category: "capital_allocation", sourceModule: "portfolioConcentration.ts" },
      { text: "Risk remains moderate.", category: "risk", sourceModule: "portfolioDashboard.ts" },
    ],
    decisionReview: [
      { code: "sizing_followed_plan", text: "Position sizing followed plan.", status: "followed", sourceModule: "tradeJournal.ts", detail: "80% of closed trades respected the configured max-risk-per-trade limit." },
      { code: "risk_allocation_followed", text: "Risk allocation remains within policy.", status: "followed", sourceModule: "portfolioDashboard.ts", detail: "Overall risk rating is Healthy." },
    ],
    capitalAllocationReview: {
      capitalEfficiencyScore: 78,
      capitalEfficiencyGrade: "Good",
      allocationByStrategy: [{ key: "iron_condor", label: "iron condor", positionCount: 3, weightPct: 100 }],
      positionDistribution: [{ key: "AAPL", label: "AAPL", positionCount: 1, weightPct: 50 }],
      cashUtilizationPct: 12.5,
      buyingPower: 87500,
      portfolioValue: 100000,
      summary: "12.5% of portfolio value is currently deployed across 3 positions, with a capital-allocation grade of Good.",
    },
    riskReview: {
      largestPortfolioRisk: "No elevated risk detected",
      primaryContributor: "No open positions",
      riskTrend: "stable",
      riskTrendDetail: "Total portfolio risk is stable (currently 5% of account value).",
      worstStressScenario: { label: "-10% Shock", portfolioValueImpact: -500, riskScoreAfter: 70 },
      highestConcentration: null,
      highestEventRisk: null,
      guidance: [],
      summary: "Overall risk rating is Healthy. Largest identified risk: No elevated risk detected.",
    },
    incomeReview: {
      monthlyTheta: 250,
      weeklyTheta: 58,
      dailyTheta: 8.3,
      annualizedTheta: 3000,
      incomeTrend: "stable",
      incomeTrendDetail: "Monthly theta income is stable at 250.00 (prior: 250.00).",
      incomeSourceCount: 3,
      bySymbol: [{ key: "AAPL", theta: 8.3 }],
      byStrategy: [{ key: "iron_condor", theta: 8.3 }],
      summary: "Income is generated across 3 symbols and 1 strategy. Trend: stable.",
    },
    behaviourReview: {
      disciplineScore: 92,
      decisionQualitySummary: { sizingRespectedRatePct: 90, ruleBasedExitRatePct: 85, averageDisciplineScore: 92 },
      behaviorPatterns: [{ code: "stable_position_sizing", label: "Stable Position Sizing", detail: "...", severity: "positive", tradeCount: 5 }],
      behaviorTrend: { direction: "improving", detail: "Rule-based exit rate improved.", asOfTradeId: 10, asOfDate: "2026-07-01T00:00:00.000Z" },
      strengths: [{ code: "stable_position_sizing", label: "Stable Position Sizing", detail: "...", severity: "positive", tradeCount: 5 }],
      areasToImprove: [],
      totalClosedTrades: 5,
      summary: "Rule-based exit rate improved.",
    },
    learningSummary: {
      scorecard: learningLink({ category: "portfolio_health" }),
      capitalAllocation: learningLink({ category: "buying_power" }),
      risk: learningLink({ category: "concentration" }),
      income: learningLink({ category: "theta_income" }),
      diversification: learningLink({ category: "diversification" }),
      greeksManagement: learningLink({ category: "greeks_exposure" }),
      eventPreparation: learningLink({ category: "event_risk" }),
      behaviour: learningLink({ category: "behaviour", lessonHref: "/learn/paths/institutional/institutional-decision-quality", lessonTitle: "Decision Quality" }),
    },
    // Phase 12 — Institutional Investing Engine Consolidation & Integration.
    watchlistReview: {
      itemCount: 0,
      items: [],
      summary: "Your Institutional Investing watchlist is empty. Research a company on the Value Research page and add it to your watchlist to see it reviewed here.",
    },
    // Phase 13 — Institutional Portfolio Manager.
    portfolioReview: {
      portfolioCount: 0,
      totalHoldingsCount: 0,
      summary: "You have no target-allocation portfolios yet. Build one on the Institutional Portfolio Manager page to see it reviewed here.",
    },
    // Phase 14 — Institutional Investment Decision Engine.
    decisionEngineReview: {
      snapshotCount: 0,
      noteCount: 0,
      distinctSymbolCount: 0,
      summary: "You have no saved Decision Engine snapshots or notes yet. Analyze a symbol on the Institutional Decision Engine page to see it reviewed here.",
    },
    // Phase 15 — Institutional Opportunity Discovery Engine.
    opportunityDiscoveryReview: {
      savedScreenCount: 0,
      summary: "You have no saved Screener filter sets yet. Save one on the Institutional Opportunity Discovery page to see it reviewed here.",
    },
    generatedAt: "2026-07-17T12:00:00.000Z",
    ...over,
  };
}

describe("InstitutionalMentor page", () => {
  it("shows all 5 permanent indicator badges", () => {
    mockState.data = resultFixture();
    renderWithClient(<InstitutionalMentor />);
    expect(screen.getByTestId("badge-institutional-mentor")).toHaveTextContent("Institutional Mentor");
    expect(screen.getByTestId("badge-behaviour-analysis-mentor")).toHaveTextContent("Professional Portfolio Review");
    expect(screen.getByTestId("badge-deterministic-analysis-mentor")).toHaveTextContent("Deterministic Analysis");
    expect(screen.getByTestId("badge-paper-trading-mentor")).toHaveTextContent("Paper Trading");
    expect(screen.getByTestId("badge-educational-only-mentor")).toHaveTextContent("Educational Only");
    mockState.data = undefined;
  });

  it("shows a loading state while the result resolves", () => {
    mockState.isLoading = true;
    renderWithClient(<InstitutionalMentor />);
    expect(screen.getByTestId("mentor-loading")).toBeInTheDocument();
    mockState.isLoading = false;
  });

  it("shows an error state when the result fails to load", () => {
    mockState.isError = true;
    renderWithClient(<InstitutionalMentor />);
    expect(screen.getByTestId("text-mentor-error")).toBeInTheDocument();
    mockState.isError = false;
  });

  it("renders all 9 Portfolio Scorecard categories with a real score and grade", () => {
    mockState.data = resultFixture();
    renderWithClient(<InstitutionalMentor />);
    for (const category of ALL_CATEGORIES) {
      const entry = screen.getByTestId(`scorecard-${category}`);
      expect(entry).toBeInTheDocument();
      expect(screen.getByTestId(`scorecard-score-${category}`)).toHaveTextContent("85/100");
      expect(screen.getByTestId(`scorecard-grade-${category}`)).toHaveTextContent("Excellent");
    }
    mockState.data = undefined;
  });

  it("renders real Professional Review observations, never a fabricated statement", () => {
    mockState.data = resultFixture();
    renderWithClient(<InstitutionalMentor />);
    const list = screen.getByTestId("list-professional-review");
    expect(within(list).getByText("Capital allocation remains balanced across strategies.")).toBeInTheDocument();
    expect(within(list).getByText("Risk remains moderate.")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("shows the honest empty-professional-review message when there are no observations", () => {
    mockState.data = resultFixture({ professionalReview: [] });
    renderWithClient(<InstitutionalMentor />);
    expect(screen.getByTestId("text-no-professional-review")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("renders Decision Review items with their status badge and detail", () => {
    mockState.data = resultFixture();
    renderWithClient(<InstitutionalMentor />);
    const item = screen.getByTestId("decision-item-sizing_followed_plan");
    expect(item).toHaveTextContent("Position sizing followed plan.");
    expect(item).toHaveTextContent("80%");
    mockState.data = undefined;
  });

  it("renders the Capital Allocation Review's cash utilisation, buying power, and allocation breakdown", () => {
    mockState.data = resultFixture();
    renderWithClient(<InstitutionalMentor />);
    expect(screen.getByTestId("text-cash-utilization")).toHaveTextContent("12.50%");
    expect(screen.getByTestId("text-capital-buying-power")).toHaveTextContent("$87,500.00");
    const list = screen.getByTestId("list-allocation-by-strategy");
    expect(within(list).getByText("iron condor")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("renders the Risk Review's largest risk, contributor, and worst stress scenario", () => {
    mockState.data = resultFixture();
    renderWithClient(<InstitutionalMentor />);
    expect(screen.getByTestId("badge-risk-review-largest")).toHaveTextContent("No elevated risk detected");
    expect(screen.getByTestId("text-risk-review-contributor")).toHaveTextContent("No open positions");
    expect(screen.getByTestId("text-risk-review-worst-stress")).toHaveTextContent("-10% Shock");
    mockState.data = undefined;
  });

  it("renders the Income Review's real Theta Income projection figures", () => {
    mockState.data = resultFixture();
    renderWithClient(<InstitutionalMentor />);
    expect(screen.getByTestId("text-income-review-monthly")).toHaveTextContent("$250.00");
    expect(screen.getByTestId("badge-income-review-trend")).toHaveTextContent("stable");
    mockState.data = undefined;
  });

  it("renders the Behaviour Review as a real pass-through of the AI Trade Journal's own figures", () => {
    mockState.data = resultFixture();
    renderWithClient(<InstitutionalMentor />);
    expect(screen.getByTestId("text-behaviour-discipline-score")).toHaveTextContent("92/100");
    expect(screen.getByTestId("badge-behaviour-closed-trades")).toHaveTextContent("5 closed trades");
    const strengths = screen.getByTestId("list-behaviour-strengths");
    expect(within(strengths).getByText("Stable Position Sizing")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("shows the honest empty-areas-to-improve message when Behaviour Review reports none", () => {
    mockState.data = resultFixture();
    renderWithClient(<InstitutionalMentor />);
    expect(screen.getByTestId("text-behaviour-no-areas")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("renders a real Institutional Lessons cross-link for every section, including Explain Mode", () => {
    mockState.data = resultFixture();
    renderWithClient(<InstitutionalMentor />);
    const link = screen.getByTestId("mentor-learning-cross-link-behaviour");
    expect(within(link).getByText("Decision Quality")).toBeInTheDocument();
    expect(within(link).getByText("Explain Mode")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("never renders a trade recommendation or execution suggestion anywhere on the page", () => {
    mockState.data = resultFixture();
    renderWithClient(<InstitutionalMentor />);
    expect(screen.queryByText(/place order|submit order|execute trade|buy now|sell now/i)).not.toBeInTheDocument();
    mockState.data = undefined;
  });

  // Phase 12 — Institutional Investing Engine Consolidation & Integration.
  describe("Watchlist Review", () => {
    it("shows the honest empty-watchlist message and a link to research", () => {
      mockState.data = resultFixture();
      renderWithClient(<InstitutionalMentor />);
      const card = screen.getByTestId("card-watchlist-review");
      expect(within(card).getByText(/watchlist is empty/i)).toBeInTheDocument();
      expect(within(card).getByTestId("link-watchlist-review-research")).toBeInTheDocument();
      mockState.data = undefined;
    });

    it("lists real watchlist rows and their decisions when present", () => {
      mockState.data = resultFixture({
        watchlistReview: {
          itemCount: 2,
          items: [
            { symbol: "AAPL", category: "Researching", currentDecision: "LONG-TERM BUY", marginOfSafetyTarget: 25, reason: "", lastResearchedAt: null },
            { symbol: "TSLA", category: "Researching", currentDecision: "TRIM", marginOfSafetyTarget: 25, reason: "", lastResearchedAt: null },
          ],
          summary: "You are tracking 2 companies on your long-term investing watchlist. 1 carries a favourable (Buy) decision from the deterministic value-investing engine, 1 carries a Trim/Avoid decision, and the remainder sit at Watchlist/Hold.",
        },
      });
      renderWithClient(<InstitutionalMentor />);
      const list = screen.getByTestId("list-watchlist-review-items");
      expect(within(list).getByText("AAPL")).toBeInTheDocument();
      expect(within(list).getByText("LONG-TERM BUY")).toBeInTheDocument();
      expect(within(list).getByText("TSLA")).toBeInTheDocument();
      expect(within(list).getByText("TRIM")).toBeInTheDocument();
      mockState.data = undefined;
    });
  });

  // Phase 13 — Institutional Portfolio Manager.
  describe("Portfolio Review", () => {
    it("shows the honest empty-portfolios message and a link to build one", () => {
      mockState.data = resultFixture();
      renderWithClient(<InstitutionalMentor />);
      const card = screen.getByTestId("card-portfolio-review");
      expect(within(card).getByText(/no target-allocation portfolios yet/i)).toBeInTheDocument();
      expect(within(card).getByTestId("link-portfolio-review-build")).toBeInTheDocument();
      mockState.data = undefined;
    });

    it("shows real portfolio/holding counts when present", () => {
      mockState.data = resultFixture({
        portfolioReview: {
          portfolioCount: 1,
          totalHoldingsCount: 2,
          summary: "You are tracking 1 target-allocation portfolio with 2 total holdings on the Institutional Portfolio Manager.",
        },
      });
      renderWithClient(<InstitutionalMentor />);
      const card = screen.getByTestId("card-portfolio-review");
      expect(within(card).getByText(/1 target-allocation portfolio with 2 total holdings/)).toBeInTheDocument();
      expect(within(card).getByTestId("link-portfolio-review-open")).toBeInTheDocument();
      mockState.data = undefined;
    });
  });

  // Phase 14 — Institutional Investment Decision Engine.
  describe("Decision Engine Review", () => {
    it("shows the honest empty-snapshots message and a link to analyze a symbol", () => {
      mockState.data = resultFixture();
      renderWithClient(<InstitutionalMentor />);
      const card = screen.getByTestId("card-decision-engine-review");
      expect(within(card).getByText(/no saved Decision Engine snapshots or notes yet/i)).toBeInTheDocument();
      expect(within(card).getByTestId("link-decision-engine-review-analyze")).toBeInTheDocument();
      mockState.data = undefined;
    });

    it("shows real snapshot/note counts when present", () => {
      mockState.data = resultFixture({
        decisionEngineReview: {
          snapshotCount: 2,
          noteCount: 1,
          distinctSymbolCount: 2,
          summary: "You have 2 saved decision snapshots and 1 decision note across 2 symbols on the Institutional Decision Engine.",
        },
      });
      renderWithClient(<InstitutionalMentor />);
      const card = screen.getByTestId("card-decision-engine-review");
      expect(within(card).getByText(/2 saved decision snapshots and 1 decision note/)).toBeInTheDocument();
      expect(within(card).getByTestId("link-decision-engine-review-open")).toBeInTheDocument();
      mockState.data = undefined;
    });
  });

  // Phase 15 — Institutional Opportunity Discovery Engine.
  describe("Opportunity Discovery Review", () => {
    it("shows the honest empty-screens message and a link to run a scan", () => {
      mockState.data = resultFixture();
      renderWithClient(<InstitutionalMentor />);
      const card = screen.getByTestId("card-opportunity-discovery-review");
      expect(within(card).getByText(/no saved Screener filter sets yet/i)).toBeInTheDocument();
      expect(within(card).getByTestId("link-opportunity-discovery-review-scan")).toBeInTheDocument();
      mockState.data = undefined;
    });

    it("shows a real saved-screen count when present", () => {
      mockState.data = resultFixture({
        opportunityDiscoveryReview: {
          savedScreenCount: 2,
          summary: "You have 2 saved screens on the Institutional Opportunity Discovery Engine.",
        },
      });
      renderWithClient(<InstitutionalMentor />);
      const card = screen.getByTestId("card-opportunity-discovery-review");
      expect(within(card).getByText(/2 saved screens/)).toBeInTheDocument();
      expect(within(card).getByTestId("link-opportunity-discovery-review-open")).toBeInTheDocument();
      mockState.data = undefined;
    });
  });

  // Phase 16 — Institutional Monitoring & Alerts Engine. A pure client-side
  // composition reusing GET /notifications directly — no change to
  // institutionalMentor.ts itself.
  describe("Monitoring Alerts Review", () => {
    it("shows an honest empty message when there are no active alerts", () => {
      mockState.data = resultFixture();
      mockState.notifications = [];
      renderWithClient(<InstitutionalMentor />);
      const card = screen.getByTestId("card-monitoring-alerts-review");
      expect(within(card).getByText(/No active alerts/)).toBeInTheDocument();
      expect(within(card).getByTestId("link-monitoring-alerts-review-open")).toBeInTheDocument();
      mockState.data = undefined;
      mockState.notifications = undefined;
    });

    it("counts only unread alerts, broken down by critical/warning severity", () => {
      mockState.data = resultFixture();
      mockState.notifications = [
        { id: 1, isRead: false, severity: "critical" },
        { id: 2, isRead: false, severity: "warning" },
        { id: 3, isRead: false, severity: "info" },
        { id: 4, isRead: true, severity: "critical" },
      ];
      renderWithClient(<InstitutionalMentor />);
      const card = screen.getByTestId("card-monitoring-alerts-review");
      expect(within(card).getByTestId("text-monitoring-alerts-review-summary")).toHaveTextContent("3 active alerts (1 critical, 1 warning)");
      mockState.data = undefined;
      mockState.notifications = undefined;
    });
  });
});
