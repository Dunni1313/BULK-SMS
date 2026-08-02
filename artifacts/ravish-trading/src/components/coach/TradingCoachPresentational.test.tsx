// v1.3.1 — AI Trading Assistant (renamed from "AI Trading Coach" in
// v1.5.0 Sprint 1, label only), Frontend UI. Lightweight smoke tests for the
// small, purely presentational components (Header, Disclaimer, Empty/Error
// states) that have no logic of their own to exercise beyond "renders the
// right content and calls the right callback."

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TradingCoachHeader } from "./TradingCoachHeader";
import { TradingCoachDisclaimer } from "./TradingCoachDisclaimer";
import { TradingCoachEmptyState } from "./TradingCoachEmptyState";
import { TradingCoachErrorState } from "./TradingCoachErrorState";

describe("TradingCoachHeader", () => {
  it("renders the title and safety badges, with no close button by default", () => {
    render(<TradingCoachHeader />);
    expect(screen.getByText("AI Trading Assistant")).toBeInTheDocument();
    expect(screen.getByText("Educational")).toBeInTheDocument();
    expect(screen.getByText("Paper Trading Only")).toBeInTheDocument();
    expect(screen.queryByTestId("button-trading-coach-close")).not.toBeInTheDocument();
  });

  it("renders a close button that calls onClose when supplied", () => {
    const onClose = vi.fn();
    render(<TradingCoachHeader onClose={onClose} />);
    fireEvent.click(screen.getByTestId("button-trading-coach-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("TradingCoachDisclaimer", () => {
  it("renders a concise, non-financial-advice advisory line", () => {
    render(<TradingCoachDisclaimer />);
    const text = screen.getByTestId("text-trading-coach-disclaimer");
    expect(text).toHaveTextContent(/advisory and educational only/i);
    expect(text).toHaveTextContent(/never places, modifies, or closes an order/i);
    expect(text).toHaveTextContent(/cannot enable live trading/i);
  });
});

describe("TradingCoachEmptyState", () => {
  it("renders an honest first-open welcome message", () => {
    render(<TradingCoachEmptyState />);
    expect(screen.getByTestId("trading-coach-empty")).toBeInTheDocument();
    expect(screen.getByText(/education, not investment advice/i)).toBeInTheDocument();
  });
});

describe("TradingCoachErrorState", () => {
  it("renders an honest failure message with a working Retry button", () => {
    const onRetry = vi.fn();
    render(<TradingCoachErrorState onRetry={onRetry} />);
    expect(screen.getByTestId("trading-coach-error")).toHaveTextContent(/failed to get an answer/i);
    fireEvent.click(screen.getByTestId("button-trading-coach-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
