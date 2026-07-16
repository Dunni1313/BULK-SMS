// Phase 6, Sprint 71 — Frontend Legacy Page Test Coverage, Slice 1.
// Following the established mocked-generated-hook pattern (see
// TradingResearch.test.tsx, InstitutionalDashboard.test.tsx).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  leaderboard: undefined as unknown,
  isLoading: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetScoringLeaderboard: () => ({
      data: mockState.leaderboard,
      isLoading: mockState.isLoading,
    }),
  };
});

import Scoring from "./Scoring";

function score(over: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    strategy: "iron_condor",
    tier: "elite",
    popScore: 82,
    evScore: 74,
    thetaScore: 91,
    totalScore: 83.5,
    ...over,
  };
}

describe("Scoring page", () => {
  beforeEach(() => {
    mockState.leaderboard = undefined;
    mockState.isLoading = false;
  });

  it("shows loading skeletons while the leaderboard resolves", () => {
    mockState.isLoading = true;
    renderWithClient(<Scoring />);
    expect(screen.getByText("Ravish Score Leaderboard")).toBeInTheDocument();
    // 10 skeleton rows x 7 cells = 70 skeleton placeholders; assert at least the row count.
    expect(document.querySelectorAll("tbody tr").length).toBe(10);
  });

  it("shows an honest empty message when there are no scored opportunities", () => {
    mockState.leaderboard = [];
    renderWithClient(<Scoring />);
    expect(screen.getByText("No scored opportunities.")).toBeInTheDocument();
  });

  it("renders real scored rows once the leaderboard resolves", () => {
    mockState.leaderboard = [score(), score({ symbol: "MSFT", strategy: "iron_fly", tier: "good", totalScore: 61.2 })];
    renderWithClient(<Scoring />);
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("iron condor")).toBeInTheDocument();
    expect(screen.getByText("ELITE")).toBeInTheDocument();
    expect(screen.getByText("83.5")).toBeInTheDocument();
    expect(screen.getByText("MSFT")).toBeInTheDocument();
    expect(screen.getByText("GOOD")).toBeInTheDocument();
  });
});
