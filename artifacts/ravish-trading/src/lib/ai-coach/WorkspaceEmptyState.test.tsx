// v1.5.0 Sprint 7 — AI Workspaces. Rendering/interaction coverage for the
// small, reusable workspace empty state.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkspaceEmptyState } from "./WorkspaceEmptyState";

describe("WorkspaceEmptyState", () => {
  it("renders the title and description", () => {
    render(<WorkspaceEmptyState title="No workspaces yet" description="Group your research into a project." />);
    expect(screen.getByText("No workspaces yet")).toBeInTheDocument();
    expect(screen.getByText("Group your research into a project.")).toBeInTheDocument();
  });

  it("renders no action button when actionLabel/onAction are omitted", () => {
    render(<WorkspaceEmptyState title="Empty" description="Nothing here." />);
    expect(screen.queryByTestId("workspace-empty-state-action")).not.toBeInTheDocument();
  });

  it("renders and wires up an action button when provided", () => {
    const onAction = vi.fn();
    render(<WorkspaceEmptyState title="Empty" description="Nothing here." actionLabel="Create one" onAction={onAction} />);
    fireEvent.click(screen.getByTestId("workspace-empty-state-action"));
    expect(onAction).toHaveBeenCalled();
  });

  it("supports a caller-supplied testId prefix", () => {
    render(<WorkspaceEmptyState title="Empty" description="Nothing here." testId="custom-empty" />);
    expect(screen.getByTestId("custom-empty")).toBeInTheDocument();
  });
});
