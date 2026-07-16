import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";

// The Market Briefing card kicks off an SSE stream on mount; stub it so the
// page renders without touching the network.
vi.mock("@/lib/coach-stream", () => ({
  streamCoach: vi.fn(() => Promise.resolve()),
}));

type HookResult = { data: unknown; isLoading?: boolean };

// Mutable state driving the few hooks individual tests care about. The rest of
// the hooks return harmless empty/loaded shapes from the static mock below.
const mockState = vi.hoisted(() => ({
  portfolioHealth: { data: undefined, isLoading: false } as HookResult,
  marketBriefing: { data: undefined, isLoading: false } as HookResult,
  tradeAdjustments: { data: [] as unknown[], isLoading: false } as HookResult,
  dailyReports: { data: [] as unknown[] } as HookResult,
}));

// Shared mutation-hook stub shape (mutate/isPending/data/reset) used by the
// generate / delete / clear / restore daily-report hooks.
function mutationStub() {
  return { mutate: vi.fn(), isPending: false, data: undefined, reset: vi.fn() };
}

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<
    typeof import("@workspace/api-client-react")
  >("@workspace/api-client-react");
  return {
    ...actual,
    useGetPortfolioHealth: () => mockState.portfolioHealth,
    useGetMarketBriefing: () => ({
      ...mockState.marketBriefing,
      refetch: vi.fn(),
    }),
    useGetPortfolioSummary: () => ({ data: undefined }),
    useGetPortfolioGreeks: () => ({ data: undefined }),
    useGetThetaIncome: () => ({ data: undefined }),
    useGetRiskStatus: () => ({ data: undefined }),
    useListTradeAdjustments: () => mockState.tradeAdjustments,
    useListDailyReports: () => mockState.dailyReports,
    useGetDailyReport: () => ({ data: undefined, isFetching: false }),
    useGenerateDailyReport: () => mutationStub(),
    useDeleteDailyReport: () => mutationStub(),
    useClearDailyReports: () => mutationStub(),
    useRestoreDailyReports: () => mutationStub(),
  };
});

import PortfolioAI from "./PortfolioAI";

describe("PortfolioAI page (mocked hooks)", () => {
  beforeEach(() => {
    mockState.portfolioHealth = { data: undefined, isLoading: false };
    mockState.marketBriefing = { data: undefined, isLoading: false };
    mockState.tradeAdjustments = { data: [], isLoading: false };
    mockState.dailyReports = { data: [] };
  });

  it("shows the report-history empty state when no reports are saved", async () => {
    mockState.dailyReports = { data: [] };

    renderWithClient(<PortfolioAI />);

    expect(
      await screen.findByText(
        "No reports yet. Generate your first daily report.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the threat-radar empty state when there are no open positions", async () => {
    mockState.tradeAdjustments = { data: [], isLoading: false };

    renderWithClient(<PortfolioAI />);

    expect(
      await screen.findByText("No open positions to monitor."),
    ).toBeInTheDocument();
  });

  it("renders loading skeletons for the health gauges and briefing while they load", async () => {
    mockState.portfolioHealth = { data: undefined, isLoading: true };
    mockState.marketBriefing = { data: undefined, isLoading: true };

    const { container } = renderWithClient(<PortfolioAI />);

    await screen.findByText("Portfolio AI");

    expect(
      container.querySelectorAll(".animate-pulse").length,
    ).toBeGreaterThan(0);
  });
});
