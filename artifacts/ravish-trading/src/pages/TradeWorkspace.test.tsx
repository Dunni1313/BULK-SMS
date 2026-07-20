// Phase 24 — Institutional Trading Engine Foundation. This page makes no
// API calls (a genuinely empty deterministic placeholder), so this test
// needs no generated-hook mocking — the established pattern for every
// other page test in this codebase.
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";
import TradeWorkspace from "./TradeWorkspace";

describe("TradeWorkspace", () => {
  it("renders the page header and permanent labels", () => {
    renderWithClient(<TradeWorkspace />);
    expect(screen.getByText("Trade Workspace")).toBeInTheDocument();
    const labels = screen.getByTestId("trade-workspace-permanent-labels");
    expect(labels).toHaveTextContent("Institutional Trading Engine");
    expect(labels).toHaveTextContent("Architecture Foundation");
    expect(labels).toHaveTextContent("No Signal Generation Yet");
  });

  it("renders all 4 new domain model cards with illustrative examples", () => {
    renderWithClient(<TradeWorkspace />);
    expect(screen.getByTestId("domain-card-order-block")).toBeInTheDocument();
    expect(screen.getByTestId("domain-card-fair-value-gap")).toBeInTheDocument();
    expect(screen.getByTestId("domain-card-session-data")).toBeInTheDocument();
    expect(screen.getByTestId("domain-card-trade-plan")).toBeInTheDocument();
    // each card discloses it's illustrative, never presented as live data
    expect(screen.getAllByText("Illustrative example — not live data")).toHaveLength(4);
  });

  it("links out to the 3 already-shipped Engine 2 pages, never duplicating them", () => {
    renderWithClient(<TradeWorkspace />);
    expect(screen.getByTestId("available-card-trading-research").querySelector("a")).toHaveAttribute(
      "href",
      "/trading-research",
    );
    expect(screen.getByTestId("available-card-trading-journal").querySelector("a")).toHaveAttribute(
      "href",
      "/trading-journal",
    );
    expect(screen.getByTestId("available-card-trading-backtest").querySelector("a")).toHaveAttribute(
      "href",
      "/trading-backtest",
    );
  });

  it("honestly lists deferred future work rather than implying it already exists", () => {
    renderWithClient(<TradeWorkspace />);
    const comingNext = screen.getByTestId("coming-next-card");
    expect(comingNext).toHaveTextContent("Strategy Framework");
    expect(comingNext).toHaveTextContent("Trading Watchlist");
    expect(comingNext).toHaveTextContent("Trade Plan persistence");
  });
});
