// Phase 6, Sprint 71 — Frontend Legacy Page Test Coverage, Slice 1.
// Following the established mocked-generated-hook pattern. Rendered
// standalone (no <Route> ancestor), so wouter's useParams() resolves no
// symbol param and the page falls back to its own documented "SPY" default
// — exercising the same code path a direct visit to /options/SPY would.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  universe: undefined as unknown,
  chain: undefined as unknown,
  isLoading: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetUniverse: () => ({ data: mockState.universe }),
    useGetOptionChain: () => ({ data: mockState.chain, isLoading: mockState.isLoading }),
    useGetExpirations: () => ({ data: [] }),
  };
});

import OptionChain from "./OptionChain";

function optionLeg(over: Record<string, unknown> = {}) {
  return { delta: 0.35, theta: -0.045, iv: 0.28, bid: 2.1, ask: 2.3, mid: 2.2, ...over };
}

function chain(over: Record<string, unknown> = {}) {
  return {
    underlyingPrice: 195.5,
    ivRank: 62.3,
    calls: [{ ...optionLeg(), strike: 190 }, { ...optionLeg({ delta: 0.2 }), strike: 200 }],
    puts: [{ ...optionLeg({ delta: -0.35 }), strike: 190 }, { ...optionLeg({ delta: -0.2 }), strike: 200 }],
    ...over,
  };
}

describe("OptionChain page", () => {
  beforeEach(() => {
    mockState.universe = undefined;
    mockState.chain = undefined;
    mockState.isLoading = false;
  });

  it("defaults to SPY and shows loading skeletons while the chain resolves", () => {
    mockState.isLoading = true;
    renderWithClient(<OptionChain />);
    expect(screen.getByRole("combobox")).toHaveTextContent("SPY");
    expect(document.querySelectorAll("tbody tr").length).toBe(10);
  });

  it("renders the underlying price, IV rank, and both call/put sides of the chain once resolved", () => {
    mockState.chain = chain();
    renderWithClient(<OptionChain />);
    expect(screen.getByText("LAST:")).toBeInTheDocument();
    expect(screen.getByText("$195.50")).toBeInTheDocument();
    expect(screen.getByText("IVR:")).toBeInTheDocument();
    expect(screen.getByText("62.3")).toBeInTheDocument();
    // Both strikes render as their own row (190, 200).
    expect(screen.getByText("190.0")).toBeInTheDocument();
    expect(screen.getByText("200.0")).toBeInTheDocument();
  });

  it("never fabricates chain data before it resolves", () => {
    renderWithClient(<OptionChain />);
    expect(screen.queryByText("LAST:")).not.toBeInTheDocument();
    expect(document.querySelectorAll("tbody tr").length).toBe(0);
  });

  // v1.3.2 — regression test for a real operator-precedence bug: the IV
  // column previously rendered `(call?.iv || 0 * 100).toFixed(1)`, which
  // due to operator precedence evaluated as `(call?.iv || 0).toFixed(1)` —
  // the `* 100` never applied. A 0.28 (28%) IV silently rendered as "0.3%"
  // instead of "28.0%". Fixed to `((call?.iv || 0) * 100).toFixed(1)`.
  it("renders implied volatility as a correct percentage, not a raw decimal fraction", () => {
    mockState.chain = chain({
      calls: [{ ...optionLeg({ iv: 0.28 }), strike: 190 }],
      puts: [{ ...optionLeg({ iv: 0.41 }), strike: 190 }],
    });
    renderWithClient(<OptionChain />);
    // 0.28 -> "28.0%", not the pre-fix "0.3%".
    expect(screen.getByText("28.0%")).toBeInTheDocument();
    // 0.41 -> "41.0%", not the pre-fix "0.4%".
    expect(screen.getByText("41.0%")).toBeInTheDocument();
    expect(screen.queryByText("0.3%")).not.toBeInTheDocument();
    expect(screen.queryByText("0.4%")).not.toBeInTheDocument();
  });

  it("honestly shows 0.0% implied volatility when a leg's iv is genuinely zero, not a fabricated value", () => {
    mockState.chain = chain({
      calls: [{ ...optionLeg({ iv: 0 }), strike: 190 }],
      puts: [{ ...optionLeg({ iv: 0 }), strike: 190 }],
    });
    renderWithClient(<OptionChain />);
    const zeroIv = screen.getAllByText("0.0%");
    expect(zeroIv.length).toBe(2);
  });
});
