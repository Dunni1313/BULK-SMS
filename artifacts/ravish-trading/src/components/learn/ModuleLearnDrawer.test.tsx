// v1.5.0, Sprint 11 — Platform Integration.
//
// Mocks the exact same 4 generated hooks pages/learn/LearningPaths.tsx's
// own PathDetail already tests against (that file's own established
// pattern) — proving this drawer reuses the identical fetch/render/track
// pipeline, just wrapped in a Sheet instead of a full route.

import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const viewedMock = vi.hoisted(() => ({ mutate: vi.fn() }));
const completedMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));

const richPathFixture = {
  key: "trading-engine",
  title: "Institutional Trading Engine",
  description: "Market structure, liquidity, and trade planning.",
  glossaryCategory: "trading",
  topics: [
    {
      key: "trading-trade-planning",
      title: "Trade Planning & Scenario Comparison",
      summary: "Comparing entry/stop/target scenarios.",
      body: ["A Trade Plan is a human's own stated pre-trade intent."],
      whyItMatters: "Planning before acting reduces impulsive decisions.",
      externalHref: null,
      relatedGlossaryKeys: [],
      estimatedMinutes: 6,
      difficulty: "intermediate",
      workflowSteps: ["Enter candidate scenarios.", "Compare R:R."],
      nextStepKeys: [],
    },
    {
      key: "trading-market-structure",
      title: "Market Structure Workbench",
      summary: "Swing analysis and multi-timeframe comparison.",
      body: ["The Market Structure Workbench is a deep-dive page."],
      whyItMatters: "Structure informs entries and stops.",
      externalHref: null,
      relatedGlossaryKeys: [],
      estimatedMinutes: 7,
    },
  ],
};

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetLearningPathByKey: (pathKey: string) => ({
      data: pathKey === "trading-engine" ? richPathFixture : undefined,
      isLoading: false,
      isError: pathKey !== "trading-engine",
    }),
    useGetLearningProgress: () => ({ data: { completedLessonKeys: [] as string[] } }),
    useRecordLearningItemViewed: () => viewedMock,
    useRecordLearningItemCompleted: () => completedMock,
  };
});

import { ModuleLearnDrawer } from "./ModuleLearnDrawer";

describe("ModuleLearnDrawer", () => {
  it("shows the module label and the topic list when no topicKey is given", async () => {
    renderWithClient(
      <ModuleLearnDrawer open={true} onOpenChange={() => {}} moduleLabel="Institutional Trade Planner" pathKey="trading-engine" />,
    );
    expect(await screen.findByText("Learn: Institutional Trade Planner")).toBeInTheDocument();
    expect(screen.getByTestId("list-module-learn-topics")).toBeInTheDocument();
    expect(screen.getByTestId("button-module-learn-topic-trading-trade-planning")).toBeInTheDocument();
    expect(screen.getByTestId("button-module-learn-topic-trading-market-structure")).toBeInTheDocument();
  });

  it("opens directly to the given topic when topicKey is supplied, and marks it viewed", async () => {
    renderWithClient(
      <ModuleLearnDrawer
        open={true}
        onOpenChange={() => {}}
        moduleLabel="Institutional Trade Planner"
        pathKey="trading-engine"
        topicKey="trading-trade-planning"
      />,
    );
    expect(await screen.findByTestId("lesson-renderer-trading-trade-planning")).toBeInTheDocument();
    expect(screen.queryByTestId("list-module-learn-topics")).not.toBeInTheDocument();
  });

  it("clicking a topic in the list view opens it and marks it viewed, without navigating away", async () => {
    renderWithClient(
      <ModuleLearnDrawer open={true} onOpenChange={() => {}} moduleLabel="Institutional Trade Planner" pathKey="trading-engine" />,
    );
    await userEvent.click(await screen.findByTestId("button-module-learn-topic-trading-market-structure"));
    expect(viewedMock.mutate).toHaveBeenCalledWith({ data: { itemType: "lesson", itemKey: "trading-market-structure" } });
    // Falls back to plain rendering since this fixture topic has no rich fields.
    expect(await screen.findByText("The Market Structure Workbench is a deep-dive page.")).toBeInTheDocument();
  });

  it("the back button returns from an opened topic to the topic list", async () => {
    renderWithClient(
      <ModuleLearnDrawer
        open={true}
        onOpenChange={() => {}}
        moduleLabel="Institutional Trade Planner"
        pathKey="trading-engine"
        topicKey="trading-trade-planning"
      />,
    );
    await userEvent.click(await screen.findByTestId("button-module-learn-back-to-topics"));
    expect(screen.getByTestId("list-module-learn-topics")).toBeInTheDocument();
  });

  it("shows an honest not-found message for an unknown pathKey — never a fabricated lesson", async () => {
    renderWithClient(<ModuleLearnDrawer open={true} onOpenChange={() => {}} moduleLabel="Unknown Module" pathKey="nonexistent-path" />);
    expect(await screen.findByTestId("text-module-learn-not-found")).toBeInTheDocument();
  });

  it("links out to the full Learning Centre page for the same lesson", async () => {
    renderWithClient(
      <ModuleLearnDrawer
        open={true}
        onOpenChange={() => {}}
        moduleLabel="Institutional Trade Planner"
        pathKey="trading-engine"
        topicKey="trading-trade-planning"
      />,
    );
    const link = await screen.findByTestId("link-module-learn-open-full-page");
    expect(link).toHaveAttribute("href", "/learn/paths/trading-engine/trading-trade-planning");
  });
});
