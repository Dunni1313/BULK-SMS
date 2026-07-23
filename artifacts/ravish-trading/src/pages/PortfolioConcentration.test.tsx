// Correlation & Concentration Risk Overlay sprint — frontend smoke
// tests for the Portfolio Concentration page.

import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    useGetPortfolioConcentration: () => ({
      data: mockState.data,
      isLoading: mockState.isLoading,
      isError: mockState.isError,
    }),
  };
});

import PortfolioConcentration from "./PortfolioConcentration";

function bucket(key: string, label: string, positionCount: number, weightPct: number) {
  return { key, label, positionCount, weightPct };
}

function breakdown(dimension: string, buckets: ReturnType<typeof bucket>[]) {
  const largestBucket = buckets.length > 0 ? [...buckets].sort((a, b) => b.weightPct - a.weightPct)[0] : null;
  const concentrationScore = buckets.length > 0 ? Math.round(buckets.reduce((s, b) => s + Math.pow(b.weightPct / 100, 2), 0) * 100) : 0;
  return { dimension, buckets, concentrationScore, largestBucket };
}

function resultFixture(over: Record<string, unknown> = {}) {
  const symbolBreakdown = breakdown("symbol", [bucket("AAPL", "AAPL", 1, 60), bucket("SPY", "SPY", 1, 40)]);
  return {
    totalPositions: 2,
    totalPortfolioValue: 125400,
    accountValue: 125000,
    netGreeks: { delta: -2.4, gamma: 0.08, theta: 24, vega: -12 },
    netBeta: null,
    netBetaUnavailableReason: "No beta figure exists anywhere in this engine's own data model — never approximated.",
    netDirectionalExposure: { longExposureDollars: 0, shortExposureDollars: 700, netExposureDollars: 700, netBiasLabel: "net_short" },
    breakdowns: {
      symbol: symbolBreakdown,
      underlying: symbolBreakdown,
      sector: breakdown("sector", [bucket("Technology", "Technology", 1, 60), bucket("Index ETF (S&P 500)", "Index ETF (S&P 500)", 1, 40)]),
      strategy: breakdown("strategy", [bucket("iron_condor", "iron condor", 2, 100)]),
      expiration: breakdown("expiration", [bucket("2026-08-21", "2026-08-21", 2, 100)]),
      assetClass: breakdown("asset_class", [bucket("Equity Option", "Equity Option", 2, 100)]),
      directionalBias: breakdown("directional_bias", [bucket("bearish", "Bearish", 2, 100)]),
    },
    longShort: { longExposureDollars: 0, shortExposureDollars: 700, longPct: 0, shortPct: 100 },
    callPut: { callNotional: 40000, putNotional: 40000, callPct: 50, putPct: 50 },
    greeksContributions: [
      { tradeId: 1, symbol: "AAPL", strategy: "iron_condor", delta: -1.5, gamma: 0.05, theta: 15, vega: -8, deltaSharePct: 62.5 },
      { tradeId: 2, symbol: "SPY", strategy: "iron_condor", delta: -0.9, gamma: 0.03, theta: 9, vega: -4, deltaSharePct: 37.5 },
    ],
    clusters: [
      { dimension: "strategy", key: "iron_condor", label: "iron condor", tradeIds: [1, 2], positionCount: 2 },
    ],
    summary: {
      largestConcentration: { dimension: "symbol", bucket: bucket("AAPL", "AAPL", 1, 60) },
      highestDirectionalExposure: { direction: "short", exposureDollars: 700, pct: 100 },
      highestGreeksContributor: { tradeId: 1, symbol: "AAPL", delta: -1.5 },
      mostDiversifiedArea: { dimension: "symbol", label: "Symbol", concentrationScore: 52 },
      leastDiversifiedArea: { dimension: "strategy", label: "Strategy", concentrationScore: 100 },
      concentrationScore: 52,
      diversificationScore: 48,
      portfolioHealthLabel: "Moderate Concentration",
    },
    riskGuidance: {
      code: "moderate_concentration",
      label: "Moderate Concentration",
      advisories: [],
    },
    credentialsConfigured: false,
    brokerConnected: null,
    lastBrokerCheckAt: null,
    sectorDataSource: "KNOWN_UNIVERSE_METADATA",
    generatedAt: "2026-07-16T12:00:00.000Z",
    ...over,
  };
}

describe("PortfolioConcentration page", () => {
  it("shows the Paper Trading Mode and Read-Only Portfolio Analysis badges", () => {
    renderWithClient(<PortfolioConcentration />);
    expect(screen.getByTestId("badge-paper-trading-mode")).toHaveTextContent("Paper Trading Mode");
    expect(screen.getByTestId("badge-read-only-portfolio-analysis")).toHaveTextContent("Read-Only Portfolio Analysis");
  });

  it("shows a loading state while the overlay resolves", () => {
    mockState.isLoading = true;
    renderWithClient(<PortfolioConcentration />);
    expect(screen.getByTestId("concentration-loading")).toBeInTheDocument();
    mockState.isLoading = false;
  });

  it("shows an error state when the overlay fails to load", () => {
    mockState.isError = true;
    renderWithClient(<PortfolioConcentration />);
    expect(screen.getByTestId("text-concentration-error")).toBeInTheDocument();
    mockState.isError = false;
  });

  it("shows the honest empty-portfolio state (no positions, no clusters, no highlights)", () => {
    mockState.data = resultFixture({
      totalPositions: 0,
      totalPortfolioValue: 125000,
      netGreeks: { delta: 0, gamma: 0, theta: 0, vega: 0 },
      breakdowns: {
        symbol: breakdown("symbol", []),
        underlying: breakdown("symbol", []),
        sector: breakdown("sector", []),
        strategy: breakdown("strategy", []),
        expiration: breakdown("expiration", []),
        assetClass: breakdown("asset_class", []),
        directionalBias: breakdown("directional_bias", []),
      },
      greeksContributions: [],
      clusters: [],
      summary: {
        largestConcentration: null,
        highestDirectionalExposure: null,
        highestGreeksContributor: null,
        mostDiversifiedArea: null,
        leastDiversifiedArea: null,
        concentrationScore: 0,
        diversificationScore: 100,
        portfolioHealthLabel: "Well Diversified",
      },
      riskGuidance: { code: "well_diversified", label: "Well Diversified", advisories: [] },
    });
    renderWithClient(<PortfolioConcentration />);
    expect(screen.getByTestId("text-largest-concentration-none")).toBeInTheDocument();
    expect(screen.getByTestId("text-no-breakdown-buckets")).toBeInTheDocument();
    expect(screen.getByTestId("text-no-greeks-contributions")).toBeInTheDocument();
    expect(screen.getByTestId("text-no-clusters")).toBeInTheDocument();
    expect(screen.getByTestId("text-no-heatmap")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("renders net portfolio value, Greeks, and the always-honest net beta unavailable disclosure", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioConcentration />);
    expect(screen.getByTestId("text-total-portfolio-value")).toHaveTextContent("$125,400.00");
    expect(screen.getByTestId("text-net-delta")).toHaveTextContent("-2.4");
    expect(screen.getByTestId("text-net-beta-unavailable")).toHaveTextContent(/no beta figure exists/i);
  });

  it("renders the portfolio summary highlights and portfolio health badge", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioConcentration />);
    expect(screen.getByTestId("text-largest-concentration")).toHaveTextContent("AAPL");
    expect(screen.getByTestId("text-highest-greeks-contributor")).toHaveTextContent("AAPL");
    expect(screen.getByTestId("text-least-diversified-area")).toHaveTextContent("Strategy");
    expect(screen.getByTestId("badge-portfolio-health")).toHaveTextContent("Moderate Concentration");
  });

  it("shows the sector concentration advisory when present", () => {
    mockState.data = resultFixture({
      riskGuidance: {
        code: "moderate_concentration",
        label: "Moderate Concentration",
        advisories: [
          { code: "monitor_sector_concentration", label: "Monitor Sector Concentration", detail: "The largest single sector..." },
        ],
      },
    });
    renderWithClient(<PortfolioConcentration />);
    expect(screen.getByTestId("advisory-monitor_sector_concentration")).toBeInTheDocument();
  });

  it("shows an honest no-advisories message when none apply", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioConcentration />);
    expect(screen.getByTestId("text-no-advisories")).toBeInTheDocument();
  });

  it("renders long/short and call/put exposure", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioConcentration />);
    expect(screen.getByTestId("text-long-short-exposure")).toHaveTextContent("Short $700.00");
    expect(screen.getByTestId("text-call-put-exposure")).toHaveTextContent("50.00%");
  });

  it("renders the symbol concentration breakdown by default, with a chart and bucket list", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioConcentration />);
    const list = screen.getByTestId("list-breakdown-buckets");
    expect(within(list).getByTestId("bucket-symbol-AAPL")).toHaveTextContent("60.00%");
    expect(within(list).getByTestId("bucket-symbol-SPY")).toHaveTextContent("40.00%");
    expect(screen.getByTestId("chart-allocation")).toBeInTheDocument();
  });

  it("switching the dimension selector shows the sector breakdown", async () => {
    const user = userEvent.setup();
    mockState.data = resultFixture();
    renderWithClient(<PortfolioConcentration />);
    await user.click(screen.getByTestId("select-dimension"));
    await user.click(await screen.findByText("Sector"));
    const list = screen.getByTestId("list-breakdown-buckets");
    expect(within(list).getByTestId("bucket-sector-Technology")).toBeInTheDocument();
  });

  it("sorting the breakdown by label re-orders the bucket list", async () => {
    const user = userEvent.setup();
    mockState.data = resultFixture();
    renderWithClient(<PortfolioConcentration />);
    await user.click(screen.getByTestId("select-sort-mode"));
    await user.click(await screen.findByText("Label (A–Z)"));
    const list = screen.getByTestId("list-breakdown-buckets");
    const items = within(list).getAllByRole("listitem");
    expect(items[0]).toHaveAttribute("data-testid", "bucket-symbol-AAPL");
    expect(items[1]).toHaveAttribute("data-testid", "bucket-symbol-SPY");
  });

  it("filtering by minimum position count hides buckets with fewer positions", async () => {
    const user = userEvent.setup();
    mockState.data = resultFixture();
    renderWithClient(<PortfolioConcentration />);
    await user.click(screen.getByTestId("select-min-positions"));
    await user.click(await screen.findByText("2+ positions"));
    // Both symbol buckets have only 1 position each in this fixture.
    expect(screen.getByTestId("text-no-breakdown-buckets")).toBeInTheDocument();
  });

  it("renders the Greeks contribution chart when positions exist", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioConcentration />);
    expect(screen.getByTestId("chart-greeks-contribution")).toBeInTheDocument();
  });

  it("renders the concentration heat map with per-symbol cells", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioConcentration />);
    expect(screen.getByTestId("heatmap-cell-AAPL")).toHaveTextContent("60.00%");
    expect(screen.getByTestId("heatmap-cell-SPY")).toHaveTextContent("40.00%");
  });

  it("renders correlation clusters when positions share a trait", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioConcentration />);
    expect(screen.getByTestId("cluster-strategy-iron_condor")).toHaveTextContent("2 positions");
  });

  it("always discloses net beta as unavailable, never a fabricated figure", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioConcentration />);
    expect(screen.queryByText(/^1\.\d+$/)).not.toBeInTheDocument();
    expect(screen.getByTestId("text-net-beta-unavailable")).toBeInTheDocument();
  });
});
