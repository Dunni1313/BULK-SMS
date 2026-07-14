import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";
import {
  makeValueReport,
  makeUnavailableValuationReport,
} from "@/test/fixtures/valueReport";

const streamCoachMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach-stream", () => ({
  streamCoach: streamCoachMock,
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
    // Graham Valuation card (Phase 2, Sprint 12), the DCF Valuation card
    // (Phase 2, Sprint 13), and the Buffett Valuation card (Phase 2, Sprint 14).
    expect(screen.getAllByText("Margin of safety")).toHaveLength(4);
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

  // Phase 2, Sprint 30 — AI Investment Analyst free-form Q&A panel.
  it("submits a free-form question to the ask/stream endpoint", async () => {
    streamCoachMock.mockReset();
    streamCoachMock.mockResolvedValue(undefined);
    const report = makeValueReport();
    renderWithClient(
      <ReportView report={report} commentary="" isStreaming={false} />,
    );

    await userEvent.type(
      screen.getByTestId("ask-analyst-input"),
      "What does the Investment Committee conclude?",
    );
    await userEvent.click(screen.getByTestId("ask-analyst-submit"));

    expect(streamCoachMock).toHaveBeenCalledWith(
      "/stock-analyst/value-research/ask/stream",
      { symbol: report.symbol, question: "What does the Investment Committee conclude?" },
      expect.anything(),
    );
  });

  it("renders a streamed answer as a Q&A turn once the stream completes", async () => {
    streamCoachMock.mockReset();
    streamCoachMock.mockImplementation(async (_path, _body, handlers) => {
      handlers.onDone?.({ answer: "The Committee's consolidated verdict is Hold." });
    });
    const report = makeValueReport();
    renderWithClient(
      <ReportView report={report} commentary="" isStreaming={false} />,
    );

    await userEvent.type(screen.getByTestId("ask-analyst-input"), "What is the verdict?");
    await userEvent.click(screen.getByTestId("ask-analyst-submit"));

    expect(await screen.findByText(/Committee's consolidated verdict is Hold/i)).toBeInTheDocument();
    expect(screen.getByText("Q: What is the verdict?")).toBeInTheDocument();
  });

  // Phase 4, Sprint 61 — AI Investment Committee LLM-Narrated Synthesis.
  it("shows a 'Narrate this verdict' button on the Investment Committee card, alongside the deterministic summary/votes", () => {
    const report = makeValueReport();
    renderWithClient(
      <ReportView report={report} commentary="" isStreaming={false} />,
    );

    expect(screen.getByTestId("narrate-committee-button")).toHaveTextContent(/narrate this verdict/i);
    // The deterministic Sprint 17 output is always visible, regardless of
    // whether narration has ever been requested.
    expect(screen.getByText(report.investmentCommittee.summary)).toBeInTheDocument();
    expect(screen.getByText("Buy (65)")).toBeInTheDocument();
  });

  it("submits a narration request to the investment-committee/narrate/stream endpoint when clicked", async () => {
    streamCoachMock.mockReset();
    streamCoachMock.mockResolvedValue(undefined);
    const report = makeValueReport();
    renderWithClient(
      <ReportView report={report} commentary="" isStreaming={false} />,
    );

    await userEvent.click(screen.getByTestId("narrate-committee-button"));

    expect(streamCoachMock).toHaveBeenCalledWith(
      "/stock-analyst/investment-committee/narrate/stream",
      { symbol: report.symbol },
      expect.anything(),
    );
  });

  it("renders the narrated synthesis once the stream completes, without hiding the deterministic summary", async () => {
    streamCoachMock.mockReset();
    streamCoachMock.mockImplementation(async (_path, _body, handlers) => {
      handlers.onDone?.({ narrative: "The Committee leans Buy because Graham and Tom Nash both see value." });
    });
    const report = makeValueReport();
    renderWithClient(
      <ReportView report={report} commentary="" isStreaming={false} />,
    );

    await userEvent.click(screen.getByTestId("narrate-committee-button"));

    expect(await screen.findByText(/Committee leans Buy because Graham and Tom Nash/i)).toBeInTheDocument();
    // The deterministic reasoning stays visible — narration is additive, never
    // a replacement.
    expect(screen.getByText(report.investmentCommittee.summary)).toBeInTheDocument();
    // The button is replaced by the narration once it exists, not stacked
    // alongside it.
    expect(screen.queryByTestId("narrate-committee-button")).not.toBeInTheDocument();
  });

  it("honestly shows an error message when narration fails, never a fabricated synthesis", async () => {
    streamCoachMock.mockReset();
    streamCoachMock.mockImplementation(async (_path, _body, handlers) => {
      handlers.onError?.("narration failed");
    });
    const report = makeValueReport();
    renderWithClient(
      <ReportView report={report} commentary="" isStreaming={false} />,
    );

    await userEvent.click(screen.getByTestId("narrate-committee-button"));

    expect(await screen.findByTestId("narrate-committee-error")).toHaveTextContent(/failed to narrate/i);
    // The deterministic summary is still there — an LLM failure never blanks
    // the Committee's own already-computed verdict.
    expect(screen.getByText(report.investmentCommittee.summary)).toBeInTheDocument();
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
