// v1.5.0 Sprint 7 — AI Workspaces. Rendering/interaction coverage for the
// workspace list sidebar — create, search, select, clear selection, and
// the empty state.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import type { AiWorkspace } from "./workspacesApi";

function workspace(overrides: Partial<AiWorkspace> = {}): AiWorkspace {
  return {
    id: 1,
    coachId: "trading",
    name: "Q3 research",
    description: null,
    pinned: false,
    archived: false,
    tags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const noop = () => {};

describe("WorkspaceSidebar — empty / loading state", () => {
  it("shows a loading message while isLoading is true", () => {
    render(
      <WorkspaceSidebar
        workspaces={[]}
        isLoading
        activeWorkspaceId={null}
        searchTerm=""
        onSearchChange={noop}
        onCreateWorkspace={noop}
        onSelectWorkspace={noop}
        onClearSelection={noop}
      />,
    );
    expect(screen.getByTestId("workspace-sidebar-loading")).toBeInTheDocument();
  });

  it("shows the empty state when there are no workspaces", () => {
    render(
      <WorkspaceSidebar
        workspaces={[]}
        isLoading={false}
        activeWorkspaceId={null}
        searchTerm=""
        onSearchChange={noop}
        onCreateWorkspace={noop}
        onSelectWorkspace={noop}
        onClearSelection={noop}
      />,
    );
    expect(screen.getByTestId("workspace-sidebar-empty")).toBeInTheDocument();
  });
});

describe("WorkspaceSidebar — listing / selection", () => {
  it("renders one card per workspace", () => {
    render(
      <WorkspaceSidebar
        workspaces={[workspace({ id: 1, name: "Alpha" }), workspace({ id: 2, name: "Beta" })]}
        isLoading={false}
        activeWorkspaceId={null}
        searchTerm=""
        onSearchChange={noop}
        onCreateWorkspace={noop}
        onSelectWorkspace={noop}
        onClearSelection={noop}
      />,
    );
    expect(screen.getByTestId("workspace-sidebar-card-1")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-sidebar-card-2")).toBeInTheDocument();
  });

  it("calls onSelectWorkspace when a workspace card is clicked", () => {
    const onSelectWorkspace = vi.fn();
    render(
      <WorkspaceSidebar
        workspaces={[workspace({ id: 3, name: "Pick me" })]}
        isLoading={false}
        activeWorkspaceId={null}
        searchTerm=""
        onSearchChange={noop}
        onCreateWorkspace={noop}
        onSelectWorkspace={onSelectWorkspace}
        onClearSelection={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("workspace-sidebar-card-3-select"));
    expect(onSelectWorkspace).toHaveBeenCalledWith(3);
  });

  it("calls onClearSelection when 'All conversations' is clicked", () => {
    const onClearSelection = vi.fn();
    render(
      <WorkspaceSidebar
        workspaces={[workspace()]}
        isLoading={false}
        activeWorkspaceId={1}
        searchTerm=""
        onSearchChange={noop}
        onCreateWorkspace={noop}
        onSelectWorkspace={noop}
        onClearSelection={onClearSelection}
      />,
    );
    fireEvent.click(screen.getByTestId("workspace-sidebar-all-conversations"));
    expect(onClearSelection).toHaveBeenCalled();
  });

  it("passes conversationCounts through to the matching card", () => {
    render(
      <WorkspaceSidebar
        workspaces={[workspace({ id: 1 })]}
        isLoading={false}
        activeWorkspaceId={null}
        searchTerm=""
        onSearchChange={noop}
        onCreateWorkspace={noop}
        onSelectWorkspace={noop}
        onClearSelection={noop}
        conversationCounts={{ 1: 4 }}
      />,
    );
    expect(screen.getByTestId("workspace-sidebar-card-1-conversation-count")).toHaveTextContent("4");
  });
});

describe("WorkspaceSidebar — search", () => {
  it("calls onSearchChange as the user types", () => {
    const onSearchChange = vi.fn();
    render(
      <WorkspaceSidebar
        workspaces={[]}
        isLoading={false}
        activeWorkspaceId={null}
        searchTerm=""
        onSearchChange={onSearchChange}
        onCreateWorkspace={noop}
        onSelectWorkspace={noop}
        onClearSelection={noop}
      />,
    );
    fireEvent.change(screen.getByTestId("workspace-sidebar-search"), { target: { value: "earnings" } });
    expect(onSearchChange).toHaveBeenCalledWith("earnings");
  });
});

describe("WorkspaceSidebar — create workspace", () => {
  it("opens the create form, then submits name + description and closes it", async () => {
    const onCreateWorkspace = vi.fn().mockResolvedValue(undefined);
    render(
      <WorkspaceSidebar
        workspaces={[]}
        isLoading={false}
        activeWorkspaceId={null}
        searchTerm=""
        onSearchChange={noop}
        onCreateWorkspace={onCreateWorkspace}
        onSelectWorkspace={noop}
        onClearSelection={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("workspace-sidebar-new-workspace"));
    expect(screen.getByTestId("workspace-sidebar-create-form")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("workspace-sidebar-create-name"), { target: { value: "New project" } });
    fireEvent.change(screen.getByTestId("workspace-sidebar-create-description"), { target: { value: "A description" } });
    await fireEvent.click(screen.getByTestId("workspace-sidebar-create-save"));

    expect(onCreateWorkspace).toHaveBeenCalledWith({ name: "New project", description: "A description" });
  });

  it("never creates a workspace with an empty name", () => {
    const onCreateWorkspace = vi.fn();
    render(
      <WorkspaceSidebar
        workspaces={[]}
        isLoading={false}
        activeWorkspaceId={null}
        searchTerm=""
        onSearchChange={noop}
        onCreateWorkspace={onCreateWorkspace}
        onSelectWorkspace={noop}
        onClearSelection={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("workspace-sidebar-new-workspace"));
    fireEvent.click(screen.getByTestId("workspace-sidebar-create-save"));
    expect(onCreateWorkspace).not.toHaveBeenCalled();
  });

  it("cancel closes the create form without calling onCreateWorkspace", () => {
    const onCreateWorkspace = vi.fn();
    render(
      <WorkspaceSidebar
        workspaces={[]}
        isLoading={false}
        activeWorkspaceId={null}
        searchTerm=""
        onSearchChange={noop}
        onCreateWorkspace={onCreateWorkspace}
        onSelectWorkspace={noop}
        onClearSelection={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("workspace-sidebar-new-workspace"));
    fireEvent.change(screen.getByTestId("workspace-sidebar-create-name"), { target: { value: "Abandoned" } });
    fireEvent.click(screen.getByTestId("workspace-sidebar-create-cancel"));
    expect(screen.queryByTestId("workspace-sidebar-create-form")).not.toBeInTheDocument();
    expect(onCreateWorkspace).not.toHaveBeenCalled();
  });

  it("the empty state's own action button also opens the create form", () => {
    render(
      <WorkspaceSidebar
        workspaces={[]}
        isLoading={false}
        activeWorkspaceId={null}
        searchTerm=""
        onSearchChange={noop}
        onCreateWorkspace={noop}
        onSelectWorkspace={noop}
        onClearSelection={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("workspace-sidebar-empty-action"));
    expect(screen.getByTestId("workspace-sidebar-create-form")).toBeInTheDocument();
  });
});
