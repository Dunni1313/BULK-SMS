// Phase 6, Sprint 72 — Frontend Legacy Page Test Coverage, Slice 2.
// Following the established mocked-generated-hook pattern.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  events: undefined as unknown,
  isLoading: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetUpcomingEvents: () => ({ data: mockState.events, isLoading: mockState.isLoading }),
  };
});

import Events from "./Events";

function event(over: Record<string, unknown> = {}) {
  return {
    date: "2026-07-24",
    daysAway: 9,
    type: "earnings",
    label: "AAPL Q3 Earnings",
    symbol: "AAPL",
    scope: "symbol",
    impact: "high",
    ...over,
  };
}

describe("Events page", () => {
  beforeEach(() => {
    mockState.events = undefined;
    mockState.isLoading = false;
  });

  it("shows loading placeholders while events resolve", () => {
    mockState.isLoading = true;
    renderWithClient(<Events />);
    expect(screen.getByText("Economic Calendar")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBe(4);
  });

  it("shows an honest empty message when there are no upcoming events", () => {
    mockState.events = [];
    renderWithClient(<Events />);
    expect(screen.getByText("No upcoming events in the horizon.")).toBeInTheDocument();
    expect(screen.getAllByText("0").length).toBe(4); // all 4 stat cards honestly read zero
  });

  it("groups real events by date and renders summary counts", () => {
    mockState.events = [
      event(),
      event({ type: "fomc", label: "FOMC Meeting", symbol: undefined, scope: "market", impact: "medium" }),
    ];
    renderWithClient(<Events />);
    expect(screen.getByTestId("event-earnings-0")).toBeInTheDocument();
    expect(screen.getByText("AAPL Q3 Earnings")).toBeInTheDocument();
    expect(screen.getByText("FOMC Meeting")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // Total Events
    expect(screen.getByText("2026-07-24")).toBeInTheDocument();
    expect(screen.getByText("9d away")).toBeInTheDocument();
  });
});
