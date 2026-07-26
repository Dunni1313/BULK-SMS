// AI Teacher & Learning Centre sprint — frontend smoke tests for the
// Learning Paths page.

import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const paramsMock = vi.hoisted(() => ({ current: {} as Record<string, string> }));
const viewedMock = vi.hoisted(() => ({ mutate: vi.fn() }));
const completedMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
// v1.4.0, Sprint L1 — Learning Centre Foundation.
const bookmarkMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));

const pathsListFixture = [
  { key: "foundations", title: "Foundations", description: "The basics.", glossaryCategory: "foundations", topics: [{ key: "foundations-stocks" }, { key: "foundations-options" }] },
  { key: "greeks", title: "Options Greeks", description: "The five sensitivities.", glossaryCategory: "greeks", topics: [{ key: "greeks-delta" }] },
];

const greeksPathFixture = {
  key: "greeks",
  title: "Options Greeks",
  description: "The five sensitivities.",
  glossaryCategory: "greeks",
  topics: [
    {
      key: "greeks-delta",
      title: "Delta",
      summary: "Directional exposure.",
      body: ["Delta measures how much an option's price moves per $1 move in the underlying."],
      whyItMatters: "This platform's own scanner selects short strikes primarily by delta.",
      externalHref: "/learn/delta",
      relatedGlossaryKeys: ["delta", "gamma"],
      estimatedMinutes: 8,
    },
  ],
};

const progressFixture = {
  lessonsViewed: 0,
  lessonsCompleted: 0,
  glossaryTermsViewed: 0,
  strategiesViewed: 0,
  pathCompletion: [{ pathKey: "greeks", title: "Options Greeks", topicsTotal: 1, topicsCompleted: 0, percentComplete: 0 }],
  completedLessonKeys: [] as string[],
  completedGlossaryKeys: [] as string[],
  completedStrategyKeys: [] as string[],
  greeksQuiz: { attempts: [], bestByTopic: [], totalAttempts: 0, averagePercent: 0, streak: 0, improvement: 0, firstPercent: 0, latestPercent: 0 },
  valueQuiz: { attempts: [], bestByTopic: [], totalAttempts: 0, averagePercent: 0, streak: 0, improvement: 0, firstPercent: 0, latestPercent: 0 },
  recentHistory: [],
  // v1.4.0, Sprint L1 — Learning Centre Foundation.
  bookmarks: [] as { itemType: string; itemKey: string; bookmarkedAt: string }[],
};

// v1.4.0, Sprint L1 — Learning Centre Foundation. A "rich" topic exercising
// the shared LessonRenderer template (difficulty/workflow/metrics/worked
// example/mistakes/risks/best practices/next lesson) — the same optional
// fields the real platform-basics content populates.
const platformBasicsPathFixture = {
  key: "platform-basics",
  title: "Platform Basics",
  description: "Navigation and Command Centre.",
  glossaryCategory: "platform",
  topics: [
    {
      key: "platform-basics-navigation",
      title: "Platform Basics & Navigation",
      summary: "The sidebar and Command Palette.",
      body: ["The sidebar groups every page into named sections."],
      whyItMatters: "Navigation is the prerequisite for everything else.",
      externalHref: null,
      relatedGlossaryKeys: ["session"],
      estimatedMinutes: 5,
      difficulty: "beginner",
      whyItExists: "A platform this large needs fast navigation.",
      institutionalThinking: "Institutional users expect one fast way to reach any tool.",
      workflowSteps: ["Open the sidebar.", "Search the Command Palette."],
      metricsExplained: [{ term: "Session", explanation: "Your signed-in state." }],
      workedExample: { title: "Find a page", steps: ["Press Cmd+K.", "Type a page name."], note: "Try it now." },
      commonMistakes: ["Missing the Notification Centre."],
      riskWarnings: [],
      bestPractices: ["Pin your daily pages."],
      relatedModuleHrefs: ["/command-center"],
      aiCoachPrompts: ["Where do I find settings?"],
      nextStepKeys: ["command-centre-overview"],
      guidedTourRequired: true,
    },
    {
      key: "command-centre-overview",
      title: "Command Centre",
      summary: "One executive screen.",
      body: ["Command Centre aggregates every dashboard."],
      whyItMatters: "One screen saves time.",
      externalHref: "/command-center",
      relatedGlossaryKeys: [],
      estimatedMinutes: 4,
    },
  ],
};

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetLearningPaths: () => ({ data: pathsListFixture, isLoading: false }),
    useGetLearningPathByKey: (pathKey: string) => ({
      data:
        pathKey === "greeks" ? greeksPathFixture : pathKey === "platform-basics" ? platformBasicsPathFixture : undefined,
      isLoading: false,
      isError: pathKey !== "greeks" && pathKey !== "platform-basics",
    }),
    useGetLearningProgress: () => ({ data: progressFixture }),
    useRecordLearningItemViewed: () => viewedMock,
    useRecordLearningItemCompleted: () => completedMock,
    // v1.4.0, Sprint L1 — Learning Centre Foundation.
    useRecordLearningBookmark: () => bookmarkMock,
  };
});

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useParams: () => paramsMock.current,
  };
});

import LearningPaths from "./LearningPaths";

describe("LearningPaths", () => {
  it("renders the list of all learning paths with their own completion progress", async () => {
    paramsMock.current = {};
    renderWithClient(<LearningPaths />);
    expect(await screen.findByTestId("grid-learning-paths")).toBeInTheDocument();
    expect(screen.getByTestId("link-path-foundations")).toBeInTheDocument();
    expect(screen.getByTestId("link-path-greeks")).toBeInTheDocument();
  });

  it("a path detail page lists its own topics, collapsed by default", async () => {
    paramsMock.current = { pathKey: "greeks" };
    renderWithClient(<LearningPaths />);
    expect(await screen.findByTestId("topic-greeks-delta")).toBeInTheDocument();
    expect(screen.queryByText(/Delta measures how much/)).not.toBeInTheDocument();
  });

  it("expanding a topic shows its body, records it viewed, and offers a Mark Complete button", async () => {
    paramsMock.current = { pathKey: "greeks" };
    renderWithClient(<LearningPaths />);
    const topicCard = await screen.findByTestId("topic-greeks-delta");
    await userEvent.click(within(topicCard).getByText("Delta"));
    expect(screen.getByText(/Delta measures how much/)).toBeInTheDocument();
    expect(viewedMock.mutate).toHaveBeenCalledWith({ data: { itemType: "lesson", itemKey: "greeks-delta" } });
    expect(screen.getByTestId("button-mark-complete-greeks-delta")).toBeInTheDocument();
  });

  it("clicking Mark Complete calls the completion mutation", async () => {
    paramsMock.current = { pathKey: "greeks", topicKey: "greeks-delta" };
    renderWithClient(<LearningPaths />);
    const button = await screen.findByTestId("button-mark-complete-greeks-delta");
    await userEvent.click(button);
    expect(completedMock.mutate).toHaveBeenCalledWith(
      { data: { itemType: "lesson", itemKey: "greeks-delta" } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("a deep link to a specific topic (/learn/paths/:pathKey/:topicKey) opens that topic automatically", async () => {
    paramsMock.current = { pathKey: "greeks", topicKey: "greeks-delta" };
    renderWithClient(<LearningPaths />);
    expect(await screen.findByText(/Delta measures how much/)).toBeInTheDocument();
  });

  it("an unknown path shows an honest not-found message", async () => {
    paramsMock.current = { pathKey: "not-a-real-path" };
    renderWithClient(<LearningPaths />);
    expect(await screen.findByTestId("text-path-not-found")).toBeInTheDocument();
  });
});

// v1.4.0, Sprint L1 — Learning Centre Foundation.
describe("LearningPaths — rich lesson content (LessonRenderer)", () => {
  it("a topic with rich fields renders via the shared LessonRenderer, not the plain fallback", async () => {
    paramsMock.current = { pathKey: "platform-basics", topicKey: "platform-basics-navigation" };
    renderWithClient(<LearningPaths />);
    expect(await screen.findByTestId("lesson-renderer-platform-basics-navigation")).toBeInTheDocument();
    expect(screen.getByTestId("badge-difficulty-platform-basics-navigation")).toHaveTextContent("beginner");
    expect(screen.getByTestId("lesson-section-why-it-exists")).toBeInTheDocument();
    expect(screen.getByTestId("lesson-section-workflow")).toBeInTheDocument();
    expect(screen.getByTestId("lesson-worked-example")).toBeInTheDocument();
    expect(screen.getByTestId("button-bookmark-lesson-platform-basics-navigation")).toBeInTheDocument();
  });

  it("shows a Next Lesson link resolved from nextStepKeys within the same path", async () => {
    paramsMock.current = { pathKey: "platform-basics", topicKey: "platform-basics-navigation" };
    renderWithClient(<LearningPaths />);
    const link = await screen.findByTestId("link-next-lesson");
    expect(link).toHaveAttribute("href", "/learn/paths/platform-basics/command-centre-overview");
    expect(link).toHaveTextContent("Command Centre");
  });

  it("clicking the bookmark button records a bookmark via the reusable BookmarkButton", async () => {
    paramsMock.current = { pathKey: "platform-basics", topicKey: "platform-basics-navigation" };
    renderWithClient(<LearningPaths />);
    const button = await screen.findByTestId("button-bookmark-lesson-platform-basics-navigation");
    await userEvent.click(button);
    expect(bookmarkMock.mutate).toHaveBeenCalledWith(
      { data: { itemType: "lesson", itemKey: "platform-basics-navigation", bookmarked: true } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("a topic with none of the rich fields still renders the established plain fallback", async () => {
    paramsMock.current = { pathKey: "platform-basics", topicKey: "command-centre-overview" };
    renderWithClient(<LearningPaths />);
    expect(await screen.findByText(/Command Centre aggregates every dashboard/)).toBeInTheDocument();
    expect(screen.queryByTestId("lesson-renderer-command-centre-overview")).not.toBeInTheDocument();
  });
});
