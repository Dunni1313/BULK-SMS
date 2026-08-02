// v1.5.0 Sprint 7 — AI Workspaces. Rendering/interaction coverage for the
// single-workspace summary card.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkspaceCard } from "./WorkspaceCard";
import type { AiWorkspace } from "./workspacesApi";

function workspace(overrides: Partial<AiWorkspace> = {}): AiWorkspace {
  return {
    id: 1,
    coachId: "trading",
    name: "Q3 earnings research",
    description: "Tracking earnings plays",
    pinned: false,
    archived: false,
    tags: ["earnings", "swing"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const noop = () => {};

describe("WorkspaceCard — rendering", () => {
  it("renders the name, description, and tags", () => {
    render(<WorkspaceCard workspace={workspace()} onSelect={noop} />);
    expect(screen.getByText("Q3 earnings research")).toBeInTheDocument();
    expect(screen.getByText("Tracking earnings plays")).toBeInTheDocument();
    expect(screen.getByText("earnings")).toBeInTheDocument();
    expect(screen.getByText("swing")).toBeInTheDocument();
  });

  it("shows a pin icon and no archived badge for a pinned, active workspace", () => {
    render(<WorkspaceCard workspace={workspace({ pinned: true })} onSelect={noop} />);
    expect(screen.getByTestId("workspace-card-1-pinned-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("workspace-card-1-archived-badge")).not.toBeInTheDocument();
  });

  it("shows an archived badge for an archived workspace", () => {
    render(<WorkspaceCard workspace={workspace({ archived: true })} onSelect={noop} />);
    expect(screen.getByTestId("workspace-card-1-archived-badge")).toBeInTheDocument();
  });

  it("shows a conversation count when provided", () => {
    render(<WorkspaceCard workspace={workspace()} onSelect={noop} conversationCount={3} />);
    expect(screen.getByTestId("workspace-card-1-conversation-count")).toHaveTextContent("3");
  });

  it("reflects isActive via a data-active attribute", () => {
    render(<WorkspaceCard workspace={workspace()} onSelect={noop} isActive />);
    expect(screen.getByTestId("workspace-card-1")).toHaveAttribute("data-active", "true");
  });
});

describe("WorkspaceCard — actions", () => {
  it("calls onSelect with the workspace id when clicked", () => {
    const onSelect = vi.fn();
    render(<WorkspaceCard workspace={workspace()} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("workspace-card-1-select"));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("calls onTogglePin with the toggled value", () => {
    const onTogglePin = vi.fn();
    render(<WorkspaceCard workspace={workspace({ pinned: false })} onSelect={noop} onTogglePin={onTogglePin} />);
    fireEvent.click(screen.getByTestId("workspace-card-1-pin-toggle"));
    expect(onTogglePin).toHaveBeenCalledWith(1, true);
  });

  it("calls onToggleArchive with the toggled value", () => {
    const onToggleArchive = vi.fn();
    render(<WorkspaceCard workspace={workspace({ archived: false })} onSelect={noop} onToggleArchive={onToggleArchive} />);
    fireEvent.click(screen.getByTestId("workspace-card-1-archive-toggle"));
    expect(onToggleArchive).toHaveBeenCalledWith(1, true);
  });

  it("calls onDelete with the workspace id", () => {
    const onDelete = vi.fn();
    render(<WorkspaceCard workspace={workspace()} onSelect={noop} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId("workspace-card-1-delete"));
    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it("renders no quick-action buttons when their handlers are omitted", () => {
    render(<WorkspaceCard workspace={workspace()} onSelect={noop} />);
    expect(screen.queryByTestId("workspace-card-1-pin-toggle")).not.toBeInTheDocument();
    expect(screen.queryByTestId("workspace-card-1-archive-toggle")).not.toBeInTheDocument();
    expect(screen.queryByTestId("workspace-card-1-delete")).not.toBeInTheDocument();
  });
});
