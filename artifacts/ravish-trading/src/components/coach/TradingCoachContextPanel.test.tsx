// v1.3.1 — AI Trading Coach, Frontend UI. Isolated tests for the context
// chip row — only the chips that genuinely apply render, the two
// always-shared signals are always present, and "Clear" only appears (and
// only fires) when there's an optional focus to remove.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";
import { TradingCoachContextPanel } from "./TradingCoachContextPanel";

beforeEach(() => {
  window.history.pushState(null, "", "/trading-research");
});

describe("TradingCoachContextPanel", () => {
  it("shows the current route and the two always-shared signals with no optional focus", () => {
    const onClearFocus = vi.fn();
    renderWithClient(<TradingCoachContextPanel focus={{}} onClearFocus={onClearFocus} />);
    expect(screen.getByText("Trading Research")).toBeInTheDocument();
    expect(screen.getByTestId("trading-coach-context-chip-risk")).toBeInTheDocument();
    expect(screen.getByTestId("trading-coach-context-chip-portfolio")).toBeInTheDocument();
    expect(screen.queryByTestId("trading-coach-context-chip-symbol")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-trading-coach-clear-context")).not.toBeInTheDocument();
  });

  it("renders only the chips that genuinely apply for a symbol-only focus", () => {
    renderWithClient(<TradingCoachContextPanel focus={{ symbol: "AAPL" }} onClearFocus={vi.fn()} />);
    expect(screen.getByTestId("trading-coach-context-chip-symbol")).toHaveTextContent("AAPL");
    expect(screen.queryByTestId("trading-coach-context-chip-candidate")).not.toBeInTheDocument();
    expect(screen.queryByTestId("trading-coach-context-chip-position")).not.toBeInTheDocument();
  });

  it("renders the scanner candidate and trading position chips when both are in focus", () => {
    renderWithClient(
      <TradingCoachContextPanel
        focus={{
          symbol: "AAPL",
          scannerCandidateId: 1,
          scannerCandidateLabel: "AAPL iron condor",
          tradingPositionId: 2,
          tradingPositionLabel: "AAPL long",
        }}
        onClearFocus={vi.fn()}
      />,
    );
    expect(screen.getByTestId("trading-coach-context-chip-candidate")).toHaveTextContent("AAPL iron condor");
    expect(screen.getByTestId("trading-coach-context-chip-position")).toHaveTextContent("AAPL long");
  });

  it("shows a Clear button when any optional focus is set, and clicking it calls onClearFocus", () => {
    const onClearFocus = vi.fn();
    renderWithClient(<TradingCoachContextPanel focus={{ symbol: "AAPL" }} onClearFocus={onClearFocus} />);
    const clearButton = screen.getByTestId("button-trading-coach-clear-context");
    expect(clearButton).toBeInTheDocument();
    fireEvent.click(clearButton);
    expect(onClearFocus).toHaveBeenCalledTimes(1);
  });

  it("falls back to the raw path for a route with no explicit label", () => {
    window.history.pushState(null, "", "/some-unlisted-route");
    renderWithClient(<TradingCoachContextPanel focus={{}} onClearFocus={vi.fn()} />);
    expect(screen.getByText("/some-unlisted-route")).toBeInTheDocument();
  });
});
