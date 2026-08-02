// v1.5.0, Sprint 11 — Platform Integration.
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetLearningPathByKey: () => ({ data: undefined, isLoading: true, isError: false }),
    useGetLearningProgress: () => ({ data: undefined }),
    useRecordLearningItemViewed: () => ({ mutate: vi.fn() }),
    useRecordLearningItemCompleted: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

import { ModuleLearnTrigger } from "./ModuleLearnTrigger";

describe("ModuleLearnTrigger", () => {
  it("renders a Learn button and the drawer is closed until clicked", async () => {
    renderWithClient(<ModuleLearnTrigger moduleLabel="AI Strategy Builder" pathKey="ai-academy" topicKey="ai-team-overview" />);
    expect(screen.getByTestId("button-learn-ai-academy-ai-team-overview")).toBeInTheDocument();
    expect(screen.queryByTestId("sheet-module-learn")).not.toBeInTheDocument();
  });

  it("opens the drawer, showing this trigger's own module label, when clicked", async () => {
    renderWithClient(<ModuleLearnTrigger moduleLabel="AI Strategy Builder" pathKey="ai-academy" topicKey="ai-team-overview" />);
    await userEvent.click(screen.getByTestId("button-learn-ai-academy-ai-team-overview"));
    expect(await screen.findByTestId("sheet-module-learn")).toBeInTheDocument();
    expect(screen.getByText("Learn: AI Strategy Builder")).toBeInTheDocument();
  });

  it("works with no topicKey (path-level trigger), using a distinct testid", async () => {
    renderWithClient(<ModuleLearnTrigger moduleLabel="Performance Review" pathKey="performance" />);
    expect(screen.getByTestId("button-learn-performance")).toBeInTheDocument();
  });
});
