// AI Teacher & Learning Centre sprint — frontend smoke tests for the
// unified Learning Centre hub page (Overview, Simulations, My Portfolio
// Explained, Progress tabs).

import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const searchMock = vi.hoisted(() => ({ current: "" }));
const runSimulationMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false, isError: false, data: undefined as unknown }));

const pathsFixture = [
  { key: "foundations", title: "Foundations", description: "The basics.", glossaryCategory: "foundations", topics: [{ key: "a" }] },
];
const strategiesFixture = [{ key: "iron_condor", label: "Iron Condor", builtByThisEngine: true }];

const portfolioLessonFixture = {
  items: [
    {
      code: "portfolio_health",
      label: "Portfolio Health",
      currentValue: "72/100 (Moderate Risk)",
      plainEnglish: "Your portfolio health score is 72 out of 100.",
      sourceCalculation: "lib/portfolioDashboard.ts",
      whyItMatters: "It summarizes overall risk posture.",
      relatedLessonHref: "/learn/paths/portfolio/portfolio-health",
      relatedGlossaryKeys: ["portfolio-health"],
      reusedObservation: false,
    },
  ],
  generatedAt: "2026-07-17T00:00:00.000Z",
};

const progressFixture = {
  lessonsViewed: 3,
  lessonsCompleted: 1,
  glossaryTermsViewed: 2,
  strategiesViewed: 1,
  pathCompletion: [{ pathKey: "foundations", title: "Foundations", topicsTotal: 8, topicsCompleted: 1, percentComplete: 12.5 }],
  completedLessonKeys: ["foundations-stocks"],
  completedGlossaryKeys: [],
  completedStrategyKeys: [],
  greeksQuiz: { attempts: [], bestByTopic: [], totalAttempts: 4, averagePercent: 75, streak: 2, improvement: 10, firstPercent: 60, latestPercent: 70 },
  valueQuiz: { attempts: [], bestByTopic: [], totalAttempts: 0, averagePercent: 0, streak: 0, improvement: 0, firstPercent: 0, latestPercent: 0 },
  recentHistory: [{ itemType: "lesson", itemKey: "foundations-stocks", viewedAt: "2026-07-17T00:00:00.000Z", completedAt: "2026-07-17T00:00:00.000Z" }],
};

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetLearningPaths: () => ({ data: pathsFixture, isLoading: false }),
    useGetStrategyAcademy: () => ({ data: strategiesFixture, isLoading: false }),
    useGetPortfolioLesson: () => ({ data: portfolioLessonFixture, isLoading: false, isError: false }),
    useGetLearningProgress: () => ({ data: progressFixture, isLoading: false }),
    useRunLearningSimulation: () => runSimulationMock,
  };
});

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useSearch: () => searchMock.current,
  };
});

import LearningCentre from "./LearningCentre";

describe("LearningCentre", () => {
  it("renders the Overview tab by default with the always-visible Paper Trading / Educational Only badges", async () => {
    searchMock.current = "";
    renderWithClient(<LearningCentre />);
    expect(await screen.findByTestId("badge-paper-trading-mode")).toBeInTheDocument();
    expect(screen.getByTestId("badge-educational-only")).toBeInTheDocument();
    expect(screen.getByTestId("link-overview-paths")).toBeInTheDocument();
  });

  // Phase 33 — Institutional Executive Intelligence & Reporting Hub.
  it("Overview tab links out to the Executive Intelligence Hub's own Learning tab, never a duplicated feature", async () => {
    searchMock.current = "";
    renderWithClient(<LearningCentre />);
    const link = await screen.findByTestId("link-overview-executive-intelligence");
    expect(link).toHaveAttribute("href", "/executive-intelligence?tab=learning");
  });

  it("switching to the Simulations tab and running one shows the labeled, deterministic result", async () => {
    searchMock.current = "";
    runSimulationMock.data = {
      type: "delta",
      label: "Call Delta vs. Underlying Price",
      xLabel: "Underlying Price",
      yLabel: "Delta",
      points: [{ x: 90, y: 0.1 }, { x: 110, y: 0.9 }],
      summary: "Delta rises as the underlying approaches the strike.",
      educationalSimulation: true,
      notMarketData: true,
      noTradeRecommendation: true,
    };
    renderWithClient(<LearningCentre />);
    await userEvent.click(screen.getByRole("tab", { name: /Simulations/i }));
    await userEvent.click(screen.getByTestId("button-run-simulation"));
    expect(runSimulationMock.mutate).toHaveBeenCalled();
    expect(await screen.findByTestId("text-simulation-summary")).toHaveTextContent("Delta rises");
  });

  it("switching to My Portfolio, Explained shows a real explanation with a related lesson link", async () => {
    renderWithClient(<LearningCentre />);
    await userEvent.click(screen.getByRole("tab", { name: /My Portfolio, Explained/i }));
    const card = await screen.findByTestId("portfolio-lesson-portfolio_health");
    expect(within(card).getByText(/72 out of 100/)).toBeInTheDocument();
  });

  it("switching to Progress shows real lesson/glossary/strategy counts and quiz progress", async () => {
    renderWithClient(<LearningCentre />);
    await userEvent.click(screen.getByRole("tab", { name: /^Progress/i }));
    expect(await screen.findByTestId("text-lessons-viewed")).toHaveTextContent("3");
    expect(screen.getByTestId("text-lessons-completed")).toHaveTextContent("1");
    expect(screen.getByTestId("progress-path-foundations")).toBeInTheDocument();
  });

  it("a ?tab= deep link opens the requested tab directly (used by the Institutional Intelligence Engine's own learning links)", async () => {
    searchMock.current = "tab=portfolio";
    renderWithClient(<LearningCentre />);
    expect(await screen.findByTestId("portfolio-lesson-portfolio_health")).toBeInTheDocument();
  });
});
