// AI Teacher & Learning Centre sprint — frontend smoke tests for the
// Strategy Academy page.

import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";

const paramsMock = vi.hoisted(() => ({ current: {} as Record<string, string> }));
const viewedMock = vi.hoisted(() => ({ mutate: vi.fn() }));

const listFixture = [
  { key: "iron_condor", label: "Iron Condor", builtByThisEngine: true, idealMarket: "Range-bound." },
  { key: "covered_call", label: "Covered Call", builtByThisEngine: false, idealMarket: "Flat to bullish." },
];

const liveEntryFixture = {
  key: "iron_condor",
  label: "Iron Condor",
  builtByThisEngine: true,
  construction: "A short put spread plus a short call spread.",
  idealMarket: "Range-bound.",
  maxProfit: "Net credit.",
  maxLoss: "Width minus credit.",
  greeksProfile: "Near-zero delta.",
  timeDecay: "Theta-positive.",
  volatilityBehavior: "Short vega.",
  assignmentRisk: "Rises near either short strike.",
  commonMistakes: ["Selling strikes too close to the money."],
  institutionalPerspective: "The workhorse of systematic premium selling.",
  paperExample: {
    available: true,
    unavailableReason: null,
    symbol: "SPY",
    detail: "A live SPY iron condor example.",
    greeks: { delta: 0.02, gamma: 0.01, theta: 5.5, vega: -3.2 },
  },
};

const unavailableEntryFixture = {
  key: "covered_call",
  label: "Covered Call",
  builtByThisEngine: false,
  construction: "Own shares, sell a call.",
  idealMarket: "Flat to bullish.",
  maxProfit: "Strike minus cost basis plus premium.",
  maxLoss: "Substantial.",
  greeksProfile: "Net long delta.",
  timeDecay: "Theta-positive.",
  volatilityBehavior: "Short vega on the call leg.",
  assignmentRisk: "Any time ITM.",
  commonMistakes: ["Selling calls on shares you don't want called away."],
  institutionalPerspective: "A yield-enhancement overlay.",
  paperExample: {
    available: false,
    unavailableReason: "Covered Call is not a strategy this platform's own scanner or execution engine builds.",
    symbol: null,
    detail: null,
    greeks: null,
  },
};

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetStrategyAcademy: () => ({ data: listFixture, isLoading: false }),
    useGetStrategyAcademyEntryByKey: (key: string) => ({
      data: key === "iron_condor" ? liveEntryFixture : key === "covered_call" ? unavailableEntryFixture : undefined,
      isLoading: false,
      isError: key !== "iron_condor" && key !== "covered_call",
    }),
    useRecordLearningItemViewed: () => viewedMock,
  };
});

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useParams: () => paramsMock.current,
  };
});

import StrategyAcademy from "./StrategyAcademy";

describe("StrategyAcademy", () => {
  it("renders the list of all strategies, with a Live Example badge only for built-by-this-engine strategies", async () => {
    paramsMock.current = {};
    renderWithClient(<StrategyAcademy />);
    const ironCondorCard = await screen.findByTestId("link-strategy-iron_condor");
    expect(within(ironCondorCard).getByText("Live Example")).toBeInTheDocument();
    const coveredCallCard = screen.getByTestId("link-strategy-covered_call");
    expect(within(coveredCallCard).queryByText("Live Example")).not.toBeInTheDocument();
  });

  it("a built-by-this-engine strategy detail shows a real, available paper example", async () => {
    paramsMock.current = { strategy: "iron_condor" };
    renderWithClient(<StrategyAcademy />);
    expect(await screen.findByTestId("text-paper-example-detail")).toHaveTextContent("A live SPY iron condor example.");
    expect(viewedMock.mutate).toHaveBeenCalledWith({ data: { itemType: "strategy", itemKey: "iron_condor" } });
  });

  it("a not-built-by-this-engine strategy detail honestly discloses the paper example as unavailable — never fabricated", async () => {
    paramsMock.current = { strategy: "covered_call" };
    renderWithClient(<StrategyAcademy />);
    expect(await screen.findByTestId("text-paper-example-unavailable")).toHaveTextContent(
      "not a strategy this platform's own scanner or execution engine builds",
    );
    expect(screen.queryByTestId("text-paper-example-detail")).not.toBeInTheDocument();
  });

  it("an unknown strategy key shows an honest not-found message", async () => {
    paramsMock.current = { strategy: "not-a-real-strategy" };
    renderWithClient(<StrategyAcademy />);
    expect(await screen.findByTestId("text-strategy-not-found")).toBeInTheDocument();
  });
});
