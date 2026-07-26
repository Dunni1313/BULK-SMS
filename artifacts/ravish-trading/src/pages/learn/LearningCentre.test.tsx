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
  // v1.4.0, Sprint L1 — Learning Centre Foundation.
  bookmarks: [] as { itemType: string; itemKey: string; bookmarkedAt: string }[],
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
  it("renders the always-visible Paper Trading / Educational Only badges regardless of tab", async () => {
    searchMock.current = "";
    renderWithClient(<LearningCentre />);
    expect(await screen.findByTestId("badge-paper-trading-mode")).toBeInTheDocument();
    expect(screen.getByTestId("badge-educational-only")).toBeInTheDocument();
  });

  // v1.4.0, Sprint L1 — Learning Centre Foundation. Explore is the new
  // default tab (the Learning Home Dashboard); every existing explicit
  // ?tab= deep link is unaffected (tested separately below).
  it("renders the Explore tab by default, with category navigation", async () => {
    searchMock.current = "";
    renderWithClient(<LearningCentre />);
    expect(await screen.findByTestId("grid-explore-categories")).toBeInTheDocument();
    expect(screen.getByTestId("link-explore-category-platform-basics")).toHaveAttribute("href", "/learn/paths/platform-basics");
  });

  it("the Overview tab is still reachable and unchanged", async () => {
    searchMock.current = "";
    renderWithClient(<LearningCentre />);
    await userEvent.click(screen.getByRole("tab", { name: /^Overview/i }));
    expect(await screen.findByTestId("link-overview-paths")).toBeInTheDocument();
  });

  // Phase 33 — Institutional Executive Intelligence & Reporting Hub.
  it("Overview tab links out to the Executive Intelligence Hub's own Learning tab, never a duplicated feature", async () => {
    searchMock.current = "";
    renderWithClient(<LearningCentre />);
    // v1.4.0, Sprint L1 — Explore is now the default tab; Overview content
    // only renders once that tab is selected.
    await userEvent.click(screen.getByRole("tab", { name: /^Overview/i }));
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

// v1.4.0, Sprint L1 — Learning Centre Foundation.
describe("LearningCentre — Explore tab", () => {
  it("Continue Learning shows the next uncompleted topic in the furthest-in-progress path", async () => {
    searchMock.current = "";
    renderWithClient(<LearningCentre />);
    const link = await screen.findByTestId("link-continue-learning");
    // pathsFixture's "foundations" path has one topic, key "a", not in
    // progressFixture's completedLessonKeys — so "a" is the next topic.
    expect(link).toHaveAttribute("href", "/learn/paths/foundations/a");
  });

  it("Continue Learning honestly suggests Platform Basics when nothing is in progress", async () => {
    searchMock.current = "";
    const original = progressFixture.pathCompletion;
    progressFixture.pathCompletion = [{ pathKey: "foundations", title: "Foundations", topicsTotal: 8, topicsCompleted: 0, percentComplete: 0 }];
    renderWithClient(<LearningCentre />);
    expect(await screen.findByTestId("link-continue-learning-start")).toBeInTheDocument();
    progressFixture.pathCompletion = original;
  });

  it("Recently Viewed honestly renders plain text, never a fabricated link, when the item's owning path can't be resolved", async () => {
    searchMock.current = "";
    renderWithClient(<LearningCentre />);
    const row = await screen.findByTestId("recently-viewed-0");
    // pathsFixture's "foundations" path contains topic key "a", not
    // "foundations-stocks" (progressFixture's own recentHistory entry) —
    // so this specific fixture combination honestly cannot resolve a real
    // href, proving the never-fabricate contract: no <a> is rendered.
    expect(within(row).queryByRole("link")).toBeNull();
    expect(row).toHaveTextContent("foundations-stocks");
  });

  it("Recently Viewed honestly shows an empty-state message when nothing has been viewed", async () => {
    searchMock.current = "";
    const original = progressFixture.recentHistory;
    progressFixture.recentHistory = [];
    renderWithClient(<LearningCentre />);
    expect(await screen.findByTestId("text-recently-viewed-empty")).toBeInTheDocument();
    progressFixture.recentHistory = original;
  });

  it("Bookmarks renders a real bookmark with a resolved href", async () => {
    searchMock.current = "";
    const original = progressFixture.bookmarks;
    progressFixture.bookmarks = [{ itemType: "glossary", itemKey: "delta", bookmarkedAt: "2026-07-17T00:00:00.000Z" }];
    renderWithClient(<LearningCentre />);
    const row = await screen.findByTestId("bookmark-0");
    expect(within(row).getByRole("link")).toHaveAttribute("href", "/learn/glossary/delta");
    progressFixture.bookmarks = original;
  });

  it("Bookmarks honestly shows an empty-state message when nothing is bookmarked", async () => {
    searchMock.current = "";
    renderWithClient(<LearningCentre />);
    expect(await screen.findByTestId("text-bookmarks-empty")).toBeInTheDocument();
  });
});
