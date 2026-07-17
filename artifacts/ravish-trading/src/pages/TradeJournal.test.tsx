// AI Trade Journal sprint — Phase 8, Sprint 4. Frontend smoke tests for
// the AI Trade Journal page, mirroring PortfolioAnalyst.test.tsx's/
// InstitutionalIntelligence.test.tsx's own established mocked-generated-
// hook pattern.

import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  data: undefined as unknown,
  isLoading: false,
  isError: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetAITradeJournal: () => ({
      data: mockState.data,
      isLoading: mockState.isLoading,
      isError: mockState.isError,
    }),
  };
});

import TradeJournal from "./TradeJournal";

function tradeReview(over: Record<string, unknown> = {}) {
  return {
    tradeId: 1,
    symbol: "AAPL",
    strategy: "iron_condor",
    openDate: "2026-06-01T12:00:00.000Z",
    closeDate: "2026-06-20T12:00:00.000Z",
    holdingPeriodDays: 19,
    credit: 150,
    maxProfit: 150,
    maxLoss: 350,
    realizedPnl: 112.5,
    realizedPnlPercent: 75,
    positionSizeContracts: 1,
    positionSizePctOfAccount: 0.28,
    greeksAtEntry: { delta: 2.1, gamma: 0.05, theta: 4.2, vega: -3.1 },
    greeksAtExit: { delta: 0.5, gamma: 0.01, theta: 0.8, vega: -0.6 },
    eventRiskAtEntry: { level: "none", events: [] },
    exitReason: "Profit target reached (75%)",
    decisionQuality: [
      { code: "sizing_respected", label: "Position Sizing Respected", detail: "Within limit.", severity: "positive", ruleReference: "settings.maxRiskPerTrade" },
      { code: "exit_profit_target_rule", label: "Exited According to Plan (Profit Target)", detail: "Hit target.", severity: "positive", ruleReference: "settings.profitTarget75" },
    ],
    linkedJournalEntry: { id: 1, title: "Closed AAPL iron condor", content: "Profit target reached." },
    ...over,
  };
}

function resultFixture(over: Record<string, unknown> = {}) {
  return {
    paperTradingMode: true,
    deterministicAnalysis: true,
    educationalOnly: true,
    totalClosedTrades: 1,
    recentTrades: [tradeReview()],
    behaviorPatterns: [
      { code: "stable_position_sizing", label: "Stable Position Sizing", detail: "100% of closed trades (1/1) stayed within the configured max-risk-per-trade limit.", severity: "positive", tradeCount: 1 },
    ],
    behaviorTrend: null,
    disciplineScore: 100,
    decisionQualitySummary: { sizingRespectedRatePct: 100, ruleBasedExitRatePct: 100, averageDisciplineScore: 100 },
    strengths: [
      { code: "stable_position_sizing", label: "Stable Position Sizing", detail: "100% of closed trades (1/1) stayed within the configured max-risk-per-trade limit.", severity: "positive", tradeCount: 1 },
    ],
    areasToImprove: [],
    learningRecommendations: [],
    timeline: [
      { type: "trade_opened", label: "Opened AAPL iron condor", timestamp: "2026-06-01T12:00:00.000Z", tradeId: 1 },
      { type: "trade_closed", label: "Closed AAPL iron condor — review generated (Profit target reached (75%))", timestamp: "2026-06-20T12:00:00.000Z", tradeId: 1 },
    ],
    generatedAt: "2026-06-20T12:00:00.000Z",
    ...over,
  };
}

describe("TradeJournal page", () => {
  it("shows all 5 permanent indicator badges", () => {
    mockState.data = resultFixture();
    renderWithClient(<TradeJournal />);
    expect(screen.getByTestId("badge-ai-trade-journal")).toHaveTextContent("AI Trade Journal");
    expect(screen.getByTestId("badge-behaviour-analysis")).toHaveTextContent("Behaviour Analysis");
    expect(screen.getByTestId("badge-deterministic-review")).toHaveTextContent("Deterministic Review");
    expect(screen.getByTestId("badge-paper-trading-journal")).toHaveTextContent("Paper Trading");
    expect(screen.getByTestId("badge-educational-only")).toHaveTextContent("Educational Only");
    mockState.data = undefined;
  });

  it("shows a loading state while the result resolves", () => {
    mockState.isLoading = true;
    renderWithClient(<TradeJournal />);
    expect(screen.getByTestId("journal-loading")).toBeInTheDocument();
    mockState.isLoading = false;
  });

  it("shows an error state when the result fails to load", () => {
    mockState.isError = true;
    renderWithClient(<TradeJournal />);
    expect(screen.getByTestId("text-journal-error")).toBeInTheDocument();
    mockState.isError = false;
  });

  it("renders the Progress Dashboard's Closed Trades, Discipline Score, and rate figures", () => {
    mockState.data = resultFixture();
    renderWithClient(<TradeJournal />);
    expect(screen.getByTestId("text-total-closed-trades")).toHaveTextContent("1");
    expect(screen.getByTestId("text-discipline-score")).toHaveTextContent("100/100");
    expect(screen.getByTestId("text-sizing-respected-rate")).toHaveTextContent("100.0%");
    mockState.data = undefined;
  });

  it("renders a real Strength with its supporting trade count", () => {
    mockState.data = resultFixture();
    renderWithClient(<TradeJournal />);
    expect(screen.getByTestId("strength-stable_position_sizing")).toHaveTextContent("Stable Position Sizing");
    mockState.data = undefined;
  });

  it("shows the honest empty-strengths message when no pattern has emerged yet", () => {
    mockState.data = resultFixture({ strengths: [] });
    renderWithClient(<TradeJournal />);
    expect(screen.getByTestId("text-no-strengths")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("renders a real Area to Improve, referencing actual historical trade data", () => {
    mockState.data = resultFixture({
      areasToImprove: [
        { code: "excessive_concentration", label: "Excessive Concentration", detail: "NVDA accounts for 100% of closed trades (4/4).", severity: "elevated", tradeCount: 4 },
      ],
    });
    renderWithClient(<TradeJournal />);
    expect(screen.getByTestId("area-excessive_concentration")).toHaveTextContent("NVDA");
    mockState.data = undefined;
  });

  it("shows the honest empty-areas-to-improve message when nothing concerning was detected", () => {
    mockState.data = resultFixture({ areasToImprove: [] });
    renderWithClient(<TradeJournal />);
    expect(screen.getByTestId("text-no-areas-to-improve")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("renders real Learning Recommendations, never a fabricated link", () => {
    mockState.data = resultFixture({
      learningRecommendations: [
        { category: "concentration", lessonHref: "/learn/paths/institutional/institutional-decision-quality", lessonTitle: "Decision Quality", glossaryHref: "/learn/glossary/concentration", glossaryTerm: "Concentration", strategyHref: null, strategyLabel: null },
      ],
    });
    renderWithClient(<TradeJournal />);
    const list = screen.getByTestId("list-learning-recommendations");
    expect(within(list).getByText("Decision Quality")).toBeInTheDocument();
    expect(within(list).getByText("Concentration")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("shows the honest empty-learning-recommendations message when there are none", () => {
    mockState.data = resultFixture({ learningRecommendations: [] });
    renderWithClient(<TradeJournal />);
    expect(screen.getByTestId("text-no-learning-recommendations")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("renders a Recent Trades review with its symbol, P/L, holding period, and decision-quality tags", () => {
    mockState.data = resultFixture();
    renderWithClient(<TradeJournal />);
    const review = screen.getByTestId("trade-review-1");
    expect(review).toHaveTextContent("AAPL");
    expect(screen.getByTestId("trade-review-pnl-1")).toHaveTextContent("$112.50");
    const tags = screen.getByTestId("trade-review-tags-1");
    expect(within(tags).getByText("Position Sizing Respected")).toBeInTheDocument();
    expect(within(tags).getByText("Exited According to Plan (Profit Target)")).toBeInTheDocument();
  });

  it("renders the linked journal entry when one exists — reused, never fabricated", () => {
    mockState.data = resultFixture();
    renderWithClient(<TradeJournal />);
    expect(screen.getByTestId("trade-review-journal-1")).toHaveTextContent("Closed AAPL iron condor");
    mockState.data = undefined;
  });

  it("shows the honest empty-trades message when there is no closed-trade history", () => {
    mockState.data = resultFixture({ recentTrades: [], totalClosedTrades: 0 });
    renderWithClient(<TradeJournal />);
    expect(screen.getByTestId("text-no-trades")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("renders the Journal Timeline with real trade_opened and trade_closed entries", () => {
    mockState.data = resultFixture();
    renderWithClient(<TradeJournal />);
    const list = screen.getByTestId("list-timeline");
    expect(within(list).getByText(/Opened AAPL/)).toBeInTheDocument();
    expect(within(list).getByText(/Closed AAPL/)).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("renders a real Behaviour Trend badge when one is computed", () => {
    mockState.data = resultFixture({
      behaviorTrend: { direction: "improving", detail: "Rule-based exit rate over the last 5 closed trades: 80% (prior trades: 40%).", asOfTradeId: 10, asOfDate: "2026-06-20T12:00:00.000Z" },
    });
    renderWithClient(<TradeJournal />);
    expect(screen.getByTestId("behavior-trend")).toHaveTextContent("improving");
    mockState.data = undefined;
  });

  it("never renders a trade recommendation or execution suggestion anywhere on the page", () => {
    mockState.data = resultFixture({
      areasToImprove: [
        { code: "excessive_concentration", label: "Excessive Concentration", detail: "NVDA accounts for 100% of closed trades (4/4).", severity: "elevated", tradeCount: 4 },
      ],
    });
    renderWithClient(<TradeJournal />);
    expect(screen.queryByText(/place order|submit order|execute trade|buy now|sell now/i)).not.toBeInTheDocument();
    mockState.data = undefined;
  });
});
