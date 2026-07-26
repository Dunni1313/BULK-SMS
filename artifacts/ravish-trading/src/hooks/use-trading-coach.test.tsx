// v1.3.1 — AI Trading Coach, Frontend UI. Isolated unit tests for the
// TradingCoachProvider/useTradingCoach() context — open/close state,
// focus set/clear/openWithFocus, and the outside-provider error guard.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TradingCoachProvider, useTradingCoach } from "./use-trading-coach";

function Harness() {
  const { open, focus, setOpen, setFocus, openWithFocus, clearFocus, closePanel } = useTradingCoach();
  return (
    <div>
      <span data-testid="open-state">{String(open)}</span>
      <span data-testid="focus-symbol">{focus.symbol ?? ""}</span>
      <span data-testid="focus-candidate">{focus.scannerCandidateLabel ?? ""}</span>
      <button onClick={() => setOpen(true)} data-testid="set-open">
        open
      </button>
      <button onClick={closePanel} data-testid="close-panel">
        close
      </button>
      <button onClick={() => setFocus({ symbol: "AAPL" })} data-testid="set-focus">
        set focus
      </button>
      <button
        onClick={() => openWithFocus({ symbol: "TSLA", scannerCandidateId: 5, scannerCandidateLabel: "TSLA iron condor" })}
        data-testid="open-with-focus"
      >
        open with focus
      </button>
      <button onClick={clearFocus} data-testid="clear-focus">
        clear focus
      </button>
    </div>
  );
}

describe("useTradingCoach / TradingCoachProvider", () => {
  it("starts closed with no focus", () => {
    render(
      <TradingCoachProvider>
        <Harness />
      </TradingCoachProvider>,
    );
    expect(screen.getByTestId("open-state")).toHaveTextContent("false");
    expect(screen.getByTestId("focus-symbol")).toHaveTextContent("");
  });

  it("setOpen/closePanel toggle the panel without touching focus", () => {
    render(
      <TradingCoachProvider>
        <Harness />
      </TradingCoachProvider>,
    );
    fireEvent.click(screen.getByTestId("set-open"));
    expect(screen.getByTestId("open-state")).toHaveTextContent("true");
    fireEvent.click(screen.getByTestId("close-panel"));
    expect(screen.getByTestId("open-state")).toHaveTextContent("false");
  });

  it("setFocus updates focus without opening the panel", () => {
    render(
      <TradingCoachProvider>
        <Harness />
      </TradingCoachProvider>,
    );
    fireEvent.click(screen.getByTestId("set-focus"));
    expect(screen.getByTestId("focus-symbol")).toHaveTextContent("AAPL");
    expect(screen.getByTestId("open-state")).toHaveTextContent("false");
  });

  it("openWithFocus sets focus AND opens the panel in one step", () => {
    render(
      <TradingCoachProvider>
        <Harness />
      </TradingCoachProvider>,
    );
    fireEvent.click(screen.getByTestId("open-with-focus"));
    expect(screen.getByTestId("open-state")).toHaveTextContent("true");
    expect(screen.getByTestId("focus-symbol")).toHaveTextContent("TSLA");
    expect(screen.getByTestId("focus-candidate")).toHaveTextContent("TSLA iron condor");
  });

  it("clearFocus resets focus to empty without closing the panel", () => {
    render(
      <TradingCoachProvider>
        <Harness />
      </TradingCoachProvider>,
    );
    fireEvent.click(screen.getByTestId("open-with-focus"));
    fireEvent.click(screen.getByTestId("clear-focus"));
    expect(screen.getByTestId("focus-symbol")).toHaveTextContent("");
    expect(screen.getByTestId("open-state")).toHaveTextContent("true");
  });

  it("throws a clear error when used outside a TradingCoachProvider", () => {
    // Suppress React's own console.error noise for the expected render throw.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Harness />)).toThrow(/must be used within a TradingCoachProvider/i);
    spy.mockRestore();
  });
});
