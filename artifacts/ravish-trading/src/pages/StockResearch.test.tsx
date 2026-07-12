import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";
import {
  makeValueReport,
  makeUnavailableValuationReport,
} from "@/test/fixtures/valueReport";

vi.mock("@/lib/coach-stream", () => ({
  streamCoach: vi.fn(),
}));

type HookResult = { data: unknown; isLoading?: boolean };

// Mutable state driving the one hook the page tests vary (the coverage
// universe). The watchlist/history hooks stay empty across every test.
const mockState = vi.hoisted(() => ({
  valueUniverse: { data: [] as unknown[], isLoading: false } as HookResult,
  settings: { data: { fundamentalsConnected: false } } as HookResult,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<
    typeof import("@workspace/api-client-react")
  >("@workspace/api-client-react");
  return {
    ...actual,
    useGetValueUniverse: () => mockState.valueUniverse,
    useGetValueWatchlist: () => ({ data: [] }),
    useGetValueHistory: () => ({ data: [] }),
    useAddValueWatchlist: () => ({ mutate: vi.fn(), isPending: false }),
    useDeleteValueWatchlist: () => ({ mutate: vi.fn(), isPending: false }),
    useGetSettings: () => mockState.settings,
  };
});

import StockResearch, { ReportView } from "./StockResearch";

describe("ReportView", () => {
  it("renders the valuation block when fair value is available", () => {
    const report = makeValueReport();
    renderWithClient(
      <ReportView report={report} commentary="" isStreaming={false} />,
    );

    expect(screen.getByText("Fair value (est.)")).toBeInTheDocument();
    // "Margin of safety" now labels the blended-model Valuation card, the
    // Graham Valuation card (Phase 2, Sprint 12), and the DCF Valuation card
    // (Phase 2, Sprint 13).
    expect(screen.getAllByText("Margin of safety")).toHaveLength(3);
    expect(screen.getByText("14.0%")).toBeInTheDocument();
    expect(
      screen.queryByText("Fair value unavailable"),
    ).not.toBeInTheDocument();
  });

  it("renders the honest 'fair value unavailable' box when valuation is missing", () => {
    const report = makeUnavailableValuationReport();
    renderWithClient(
      <ReportView report={report} commentary="" isStreaming={false} />,
    );

    expect(screen.getByText("Fair value unavailable")).toBeInTheDocument();
    expect(
      screen.getByText("No reliable earnings to anchor a valuation."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Fair value (est.)")).not.toBeInTheDocument();
  });

  it("shows the AI thesis prose once commentary streams in", () => {
    const report = makeValueReport();
    renderWithClient(
      <ReportView
        report={report}
        commentary="Apple is a wide-moat compounder."
        isStreaming={false}
      />,
    );

    expect(
      screen.getByText("Apple is a wide-moat compounder."),
    ).toBeInTheDocument();
  });
});

describe("StockResearch page (mocked hooks)", () => {
  beforeEach(() => {
    mockState.valueUniverse = { data: [], isLoading: false };
    mockState.settings = { data: { fundamentalsConnected: false } };
  });

  it("renders the coverage universe from a mocked query hook", async () => {
    mockState.valueUniverse = {
      data: [
        {
          symbol: "MSFT",
          name: "Microsoft Corp.",
          kind: "stock",
          price: 430,
          businessQualityScore: 90,
          businessQualityRating: "Wonderful",
          moatRating: "Wide",
          financialStrength: "Strong",
          valuationRating: "Fair",
          marginOfSafety: 0.1,
          decision: "HOLD",
          stockInvestmentScore: 78,
          optionsSuitabilityScore: 55,
          useCase: "Both",
          suggestedAction: "Hold",
          dataSource: "Simulated",
        },
      ],
      isLoading: false,
    };

    renderWithClient(<StockResearch />);

    expect(await screen.findByTestId("universe-MSFT")).toBeInTheDocument();
    expect(screen.getByText("Microsoft Corp.")).toBeInTheDocument();
    expect(
      screen.getByText("Select a company to begin research."),
    ).toBeInTheDocument();
  });

  it("shows skeletons (not the universe) while the coverage universe is loading", async () => {
    mockState.valueUniverse = { data: undefined, isLoading: true };

    const { container } = renderWithClient(<StockResearch />);

    await screen.findByText("Value Research");

    expect(
      container.querySelectorAll(".animate-pulse").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByTestId("universe-MSFT")).not.toBeInTheDocument();
  });

  it("shows the empty-state copy for the Value watchlist tab", async () => {
    mockState.valueUniverse = { data: [], isLoading: false };

    renderWithClient(<StockResearch />);

    await userEvent.click(screen.getByRole("tab", { name: /watchlist/i }));

    expect(
      await screen.findByText(
        "No names yet. Research a company and add it to your watchlist.",
      ),
    ).toBeInTheDocument();
  });

  it("flags the coverage universe as stale when live data is older than the threshold", async () => {
    const stale = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
    mockState.settings = { data: { fundamentalsConnected: true } };
    mockState.valueUniverse = {
      data: [
        {
          symbol: "AAPL",
          name: "Apple Inc.",
          kind: "stock",
          price: 230,
          businessQualityScore: 92,
          businessQualityRating: "Wonderful",
          moatRating: "Wide",
          financialStrength: "Strong",
          valuationRating: "Fair",
          marginOfSafety: 0.1,
          decision: "HOLD",
          dataSource: "Financial Modeling Prep",
          simulated: false,
          fetchedAt: stale,
        },
      ],
      isLoading: false,
    };

    renderWithClient(<StockResearch />);

    expect(await screen.findByTestId("universe-stale")).toHaveTextContent(
      /Stale — refresh recommended/i,
    );
  });

  it("honors a tighter configurable staleness threshold", async () => {
    // 6h old: fresh under the default 24h, but stale under a 4h threshold.
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    mockState.settings = { data: { fundamentalsConnected: true, fundamentalsStalenessHours: 4 } };
    mockState.valueUniverse = {
      data: [
        {
          symbol: "AAPL",
          name: "Apple Inc.",
          kind: "stock",
          price: 230,
          businessQualityScore: 92,
          businessQualityRating: "Wonderful",
          moatRating: "Wide",
          financialStrength: "Strong",
          valuationRating: "Fair",
          marginOfSafety: 0.1,
          decision: "HOLD",
          dataSource: "Financial Modeling Prep",
          simulated: false,
          fetchedAt: sixHoursAgo,
        },
      ],
      isLoading: false,
    };

    renderWithClient(<StockResearch />);

    expect(await screen.findByTestId("universe-stale")).toHaveTextContent(
      /Stale — refresh recommended/i,
    );
  });

  it("does not flag the universe as stale when live data is fresh", async () => {
    const fresh = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    mockState.settings = { data: { fundamentalsConnected: true } };
    mockState.valueUniverse = {
      data: [
        {
          symbol: "AAPL",
          name: "Apple Inc.",
          kind: "stock",
          price: 230,
          businessQualityScore: 92,
          businessQualityRating: "Wonderful",
          moatRating: "Wide",
          financialStrength: "Strong",
          valuationRating: "Fair",
          marginOfSafety: 0.1,
          decision: "HOLD",
          dataSource: "Financial Modeling Prep",
          simulated: false,
          fetchedAt: fresh,
        },
      ],
      isLoading: false,
    };

    renderWithClient(<StockResearch />);

    await screen.findByTestId("universe-AAPL");
    expect(screen.queryByTestId("universe-stale")).not.toBeInTheDocument();
    expect(screen.getByText(/Live · updated/i)).toBeInTheDocument();
  });

  it("does not flag simulated data as stale even when timestamps are old", async () => {
    const old = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
    mockState.valueUniverse = {
      data: [
        {
          symbol: "MSFT",
          name: "Microsoft Corp.",
          kind: "stock",
          price: 430,
          businessQualityScore: 90,
          businessQualityRating: "Wonderful",
          moatRating: "Wide",
          financialStrength: "Strong",
          valuationRating: "Fair",
          marginOfSafety: 0.1,
          decision: "HOLD",
          dataSource: "Simulated",
          simulated: true,
          fetchedAt: old,
        },
      ],
      isLoading: false,
    };

    renderWithClient(<StockResearch />);

    await screen.findByTestId("universe-MSFT");
    expect(screen.queryByTestId("universe-stale")).not.toBeInTheDocument();
  });

  it("shows the empty-state copy for the research history tab", async () => {
    mockState.valueUniverse = { data: [], isLoading: false };

    renderWithClient(<StockResearch />);

    await userEvent.click(screen.getByRole("tab", { name: /history/i }));

    expect(
      await screen.findByText("No research saved yet."),
    ).toBeInTheDocument();
  });
});
