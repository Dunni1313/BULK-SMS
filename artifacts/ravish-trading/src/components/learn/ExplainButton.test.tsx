// AI Teacher & Learning Centre sprint — Contextual Explain Mode. Mocks
// lib/explain-fetch.ts directly (the same "mock the specific lib module"
// pattern StockResearch.test.tsx/TradingResearch.test.tsx already
// establish for their own streamCoach() SSE client), rather than a raw
// global fetch stub.

import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const fetchExplanationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/explain-fetch", async () => {
  const actual = await vi.importActual<typeof import("@/lib/explain-fetch")>("@/lib/explain-fetch");
  return {
    ...actual,
    fetchMetricExplanation: fetchExplanationMock,
  };
});

import { ExplainButton } from "./ExplainButton";

describe("ExplainButton", () => {
  it("fetches and shows a real explanation when opened, never before", async () => {
    fetchExplanationMock.mockResolvedValue({
      code: "portfolio_health",
      label: "Portfolio Health",
      currentValue: "72/100 (Moderate Risk)",
      plainEnglish: "Your portfolio health score is 72 out of 100.",
      sourceCalculation: "lib/portfolioDashboard.ts — healthScore",
      whyItMatters: "It summarizes overall risk posture.",
      relatedLessonHref: "/learn/paths/portfolio/portfolio-health",
      relatedGlossaryKeys: ["portfolio-health"],
      reusedObservation: false,
    });
    renderWithClient(<ExplainButton metrics={["portfolio_health"]} />);
    expect(fetchExplanationMock).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId("button-explain-portfolio_health"));
    expect(await screen.findByTestId("text-explain-current-value")).toHaveTextContent("72/100");
    expect(screen.getByTestId("text-explain-plain-english")).toHaveTextContent("72 out of 100");
    expect(screen.getByTestId("link-explain-related-lesson")).toBeInTheDocument();
    expect(screen.getByTestId("link-explain-glossary-portfolio-health")).toBeInTheDocument();
    expect(fetchExplanationMock).toHaveBeenCalledWith("portfolio_health", undefined);
  });

  it("passes tradeId through for trade-scoped metrics", async () => {
    fetchExplanationMock.mockResolvedValue({
      code: "max_profit",
      label: "Maximum Profit",
      currentValue: "$120.00",
      plainEnglish: "The maximum possible profit is $120.00.",
      sourceCalculation: "trades.max_profit",
      whyItMatters: "Knowing the maximum profit matters.",
      relatedLessonHref: null,
      relatedGlossaryKeys: [],
      reusedObservation: false,
    });
    renderWithClient(<ExplainButton metrics={["max_profit"]} tradeId={42} />);
    await userEvent.click(screen.getByTestId("button-explain-max_profit"));
    await screen.findByTestId("text-explain-current-value");
    expect(fetchExplanationMock).toHaveBeenCalledWith("max_profit", 42);
  });

  it("shows an honest error message when the fetch fails, never a fabricated explanation", async () => {
    fetchExplanationMock.mockRejectedValue(new Error("Failed to explain delta"));
    renderWithClient(<ExplainButton metrics={["delta"]} />);
    await userEvent.click(screen.getByTestId("button-explain-delta"));
    expect(await screen.findByTestId("text-explain-error")).toBeInTheDocument();
    expect(screen.queryByTestId("content-explain")).not.toBeInTheDocument();
  });

  it("with multiple metrics, switching the selector re-fetches the newly selected metric", async () => {
    fetchExplanationMock.mockImplementation((code: string) =>
      Promise.resolve({
        code,
        label: code,
        currentValue: `value-for-${code}`,
        plainEnglish: "explanation",
        sourceCalculation: "source",
        whyItMatters: "matters",
        relatedLessonHref: null,
        relatedGlossaryKeys: [],
        reusedObservation: false,
      }),
    );
    renderWithClient(<ExplainButton metrics={["probability_of_profit", "max_profit"]} tradeId={1} />);
    await userEvent.click(screen.getByTestId("button-explain-probability_of_profit"));
    expect(await screen.findByTestId("text-explain-current-value")).toHaveTextContent("value-for-probability_of_profit");
    expect(fetchExplanationMock).toHaveBeenCalledWith("probability_of_profit", 1);
  });
});
