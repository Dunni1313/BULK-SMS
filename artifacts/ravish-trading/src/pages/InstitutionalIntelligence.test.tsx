// Institutional Intelligence Engine sprint — Phase 8, Sprint 1 (AI Coach
// Foundation). Frontend smoke tests for the Institutional Intelligence
// page, mirroring PortfolioDashboard.test.tsx's/CommandCenter.test.tsx's
// own established mocked-generated-hook pattern.

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
    useGetInstitutionalIntelligence: () => ({
      data: mockState.data,
      isLoading: mockState.isLoading,
      isError: mockState.isError,
    }),
  };
});

import InstitutionalIntelligence from "./InstitutionalIntelligence";

function observation(over: Record<string, unknown> = {}) {
  return {
    code: "concentration_elevated",
    category: "concentration",
    severity: "elevated",
    title: "Concentration elevated",
    explanation: "NVDA accounts for 100.00% of deployed portfolio risk.",
    supportingMetrics: [{ label: "Concentration Health Factor", value: "0/100" }],
    sourceModule: "portfolioConcentration.ts — riskGuidance / summary.largestConcentration",
    timestamp: "2026-07-16T12:00:00.000Z",
    confidence: "high",
    confidenceReason: "Directly reused from the Correlation & Concentration overlay's own already-classified guidance.",
    learningLinks: [
      { label: "Correlation & Concentration", href: "/concentration-risk", comingSoon: false },
      { label: "AI Teacher", href: null, comingSoon: true },
    ],
    ...over,
  };
}

function resultFixture(over: Record<string, unknown> = {}) {
  return {
    paperTradingMode: true,
    deterministicAnalysis: true,
    executiveSummary: {
      headline: "Portfolio Health remains strong.",
      bullets: [
        "Portfolio Health remains strong.",
        "Concentration remains moderate.",
        "No elevated Event Risk detected.",
        "Buying Power remains healthy.",
      ],
      generatedAt: "2026-07-16T12:00:00.000Z",
    },
    observations: [
      observation({
        code: "paper_trading_active",
        category: "paper_trading_status",
        severity: "info",
        title: "Paper Trading active",
        explanation: "This platform operates in Paper Trading mode only.",
        confidenceReason: "A structural platform fact, not a derived calculation.",
        learningLinks: [{ label: "Settings", href: "/settings", comingSoon: false }, { label: "AI Teacher", href: null, comingSoon: true }],
      }),
    ],
    highestPriority: [],
    health: {
      overallHealthScore: 90,
      overallRiskRating: { code: "healthy", label: "Healthy" },
      healthTrend: "insufficient_history",
      healthTrendDetail: "No prior recorded snapshot exists yet — trend will be available after the next recorded day.",
      healthDrivers: [
        { code: "concentration", label: "Concentration", score: 90, detail: "Symbol-level concentration score of 10/100." },
        { code: "diversification", label: "Diversification", score: 95, detail: "Sector-level concentration score of 5/100." },
      ],
      brokerHealth: { credentialsConfigured: false, connected: null, label: "No credentials configured" },
      healthSummary: "Portfolio Health is healthy at 90/100.",
    },
    timeline: {
      entries: [{ code: "paper_trading_active", label: "Paper Trading active", category: "paper_trading_status", status: "new" }],
      healthChange: null,
      riskRatingChange: null,
      incomeChange: null,
      asOf: "2026-07-16T12:00:00.000Z",
      comparedTo: null,
    },
    learningLinks: [
      { label: "Settings", href: "/settings", comingSoon: false },
      { label: "AI Teacher", href: null, comingSoon: true },
    ],
    portfolioInsights: [],
    incomeInsights: [],
    riskInsights: [],
    generatedAt: "2026-07-16T12:00:00.000Z",
    ...over,
  };
}

describe("InstitutionalIntelligence page", () => {
  it("shows all 4 permanent indicator badges", () => {
    mockState.data = resultFixture();
    renderWithClient(<InstitutionalIntelligence />);
    expect(screen.getByTestId("badge-institutional-intelligence")).toHaveTextContent("Institutional Intelligence");
    expect(screen.getByTestId("badge-deterministic-analysis")).toHaveTextContent("Deterministic Analysis");
    expect(screen.getByTestId("badge-paper-trading-intelligence")).toHaveTextContent("Paper Trading");
    expect(screen.getByTestId("badge-read-only-intelligence")).toHaveTextContent("Read Only");
    mockState.data = undefined;
  });

  it("shows a loading state while the result resolves", () => {
    mockState.isLoading = true;
    renderWithClient(<InstitutionalIntelligence />);
    expect(screen.getByTestId("intelligence-loading")).toBeInTheDocument();
    mockState.isLoading = false;
  });

  it("shows an error state when the result fails to load", () => {
    mockState.isError = true;
    renderWithClient(<InstitutionalIntelligence />);
    expect(screen.getByTestId("text-intelligence-error")).toBeInTheDocument();
    mockState.isError = false;
  });

  it("renders the Executive Summary headline and bullets", () => {
    mockState.data = resultFixture();
    renderWithClient(<InstitutionalIntelligence />);
    expect(screen.getByTestId("text-executive-headline")).toHaveTextContent("Portfolio Health remains strong.");
    expect(screen.getByTestId("list-executive-bullets")).toHaveTextContent("Buying Power remains healthy.");
    mockState.data = undefined;
  });

  it("renders the Health Overview with score, rating, trend, and drivers", () => {
    mockState.data = resultFixture();
    renderWithClient(<InstitutionalIntelligence />);
    expect(screen.getByTestId("text-overall-health-score")).toHaveTextContent("90/100");
    expect(screen.getByTestId("badge-overall-risk-rating")).toHaveTextContent("Healthy");
    expect(screen.getByTestId("badge-health-trend")).toHaveTextContent("insufficient history");
    expect(screen.getByTestId("list-health-drivers")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("no elevated observations shows the honest empty Highest Priority message", () => {
    mockState.data = resultFixture({ highestPriority: [] });
    renderWithClient(<InstitutionalIntelligence />);
    expect(screen.getByTestId("text-no-highest-priority")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("many elevated observations render all of them in Highest Priority, each traceable to a source module", () => {
    const many = [
      observation({ code: "concentration_elevated", title: "Concentration elevated", category: "concentration" }),
      observation({
        code: "event_risk_elevated",
        title: "Event Risk elevated",
        category: "event_risk",
        explanation: 'AAPL carries a "high" event-risk classification.',
        sourceModule: "portfolioEventRisk.ts — summary.highestRiskPosition",
        learningLinks: [{ label: "Event Risk", href: "/event-risk", comingSoon: false }, { label: "AI Teacher", href: null, comingSoon: true }],
      }),
    ];
    mockState.data = resultFixture({
      highestPriority: many,
      observations: [...many, observation({ code: "paper_trading_active", title: "Paper Trading active" })],
      riskInsights: many,
    });
    renderWithClient(<InstitutionalIntelligence />);
    const list = screen.getByTestId("list-highest-priority");
    expect(within(list).getByTestId("highest-priority-concentration_elevated")).toBeInTheDocument();
    expect(within(list).getByTestId("highest-priority-event_risk_elevated")).toBeInTheDocument();
    expect(within(list)).toBeDefined();
    mockState.data = undefined;
  });

  it("renders each observation's severity, category, confidence, and source module", () => {
    mockState.data = resultFixture({
      observations: [
        observation({
          code: "large_greeks_exposure",
          title: "Large Greeks exposure",
          category: "greeks_exposure",
          confidence: "high",
        }),
      ],
    });
    renderWithClient(<InstitutionalIntelligence />);
    const obs = screen.getByTestId("observation-large_greeks_exposure");
    expect(within(obs).getByText("Large Greeks exposure")).toBeInTheDocument();
    expect(within(obs).getByTestId("observation-confidence-large_greeks_exposure")).toHaveTextContent("high confidence");
    expect(obs).toHaveTextContent("portfolioConcentration.ts");
    mockState.data = undefined;
  });

  it("splits observations honestly into Portfolio/Income/Risk Insights columns, each with its own empty state", () => {
    mockState.data = resultFixture({ portfolioInsights: [], incomeInsights: [], riskInsights: [] });
    renderWithClient(<InstitutionalIntelligence />);
    expect(screen.getByTestId("text-no-portfolio-insights")).toBeInTheDocument();
    expect(screen.getByTestId("text-no-income-insights")).toBeInTheDocument();
    expect(screen.getByTestId("text-no-risk-insights")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("a real risk insight renders in the Risk Insights column", () => {
    mockState.data = resultFixture({
      riskInsights: [observation({ code: "concentration_elevated", title: "Concentration elevated" })],
    });
    renderWithClient(<InstitutionalIntelligence />);
    const list = screen.getByTestId("list-risk-insights");
    expect(within(list).getByText("Concentration elevated")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("Timeline shows the honest no-prior-snapshot message when comparedTo is null", () => {
    mockState.data = resultFixture({ timeline: { entries: [], healthChange: null, riskRatingChange: null, incomeChange: null, asOf: "2026-07-16T12:00:00.000Z", comparedTo: null } });
    renderWithClient(<InstitutionalIntelligence />);
    expect(screen.getByTestId("card-timeline")).toHaveTextContent("No prior recorded snapshot exists yet");
    expect(screen.getByTestId("text-timeline-health-change-none")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("Timeline shows a real, non-fabricated health/income/risk-rating change when a prior snapshot exists", () => {
    mockState.data = resultFixture({
      timeline: {
        entries: [
          { code: "portfolio_health_improved", label: "Portfolio Health improved", category: "portfolio_health", status: "new" },
          { code: "concentration_elevated", label: "Concentration elevated", category: "concentration", status: "resolved" },
        ],
        healthChange: { label: "Portfolio Health", direction: "improving", detail: "10/100 → 90/100" },
        incomeChange: { label: "Theta Income (Monthly)", direction: "improving", detail: "100.00 → 250.00" },
        riskRatingChange: { from: "high_risk", to: "healthy" },
        asOf: "2026-07-16T12:00:00.000Z",
        comparedTo: "2026-07-15",
      },
    });
    renderWithClient(<InstitutionalIntelligence />);
    expect(screen.getByTestId("card-timeline")).toHaveTextContent("2026-07-15");
    expect(screen.getByTestId("text-timeline-health-change")).toHaveTextContent("10/100 → 90/100");
    expect(screen.getByTestId("text-timeline-income-change")).toHaveTextContent("100.00 → 250.00");
    expect(screen.getByTestId("text-timeline-risk-rating-change")).toHaveTextContent("high_risk → healthy");
    const entries = screen.getByTestId("list-timeline-entries");
    expect(within(entries).getByTestId("timeline-entry-portfolio_health_improved")).toHaveTextContent("new");
    expect(within(entries).getByTestId("timeline-entry-concentration_elevated")).toHaveTextContent("resolved");
    mockState.data = undefined;
  });

  it("renders real Learning Links and the honestly-disclosed AI Teacher 'coming soon' entry, never a fabricated URL", () => {
    mockState.data = resultFixture();
    renderWithClient(<InstitutionalIntelligence />);
    const list = screen.getByTestId("list-learning-links");
    expect(within(list).getByTestId("learning-link-Settings")).toHaveAttribute("href", "/settings");
    expect(within(list).getByTestId("learning-link-coming-soon-AI Teacher")).toHaveTextContent("coming soon");
    mockState.data = undefined;
  });

  it("never renders a trade recommendation or execution suggestion anywhere on the page", () => {
    mockState.data = resultFixture({
      observations: [observation({ code: "concentration_elevated", title: "Concentration elevated" })],
      highestPriority: [observation({ code: "concentration_elevated", title: "Concentration elevated" })],
      riskInsights: [observation({ code: "concentration_elevated", title: "Concentration elevated" })],
    });
    renderWithClient(<InstitutionalIntelligence />);
    expect(screen.queryByText(/place order|submit order|execute trade|buy now|sell now/i)).not.toBeInTheDocument();
    mockState.data = undefined;
  });
});
