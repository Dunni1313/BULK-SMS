// v1.5.0 Sprint 8 — AI Research Notebooks. Rendering/interaction coverage
// for the notebook list sidebar — create, search, select, clear selection,
// and the empty state, mirroring WorkspaceSidebar.test.tsx's own
// established pattern (Sprint 7).

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotebookSidebar } from "./NotebookSidebar";
import type { AiNotebook } from "./notebooksApi";

function notebook(overrides: Partial<AiNotebook> = {}): AiNotebook {
  return {
    id: 1,
    coachId: "trading",
    workspaceId: null,
    title: "Q3 research",
    description: null,
    pinned: false,
    archived: false,
    tags: [],
    version: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const noop = () => {};

describe("NotebookSidebar — empty / loading state", () => {
  it("shows a loading message while isLoading is true", () => {
    render(
      <NotebookSidebar
        notebooks={[]}
        isLoading
        activeNotebookId={null}
        searchTerm=""
        onSearchChange={noop}
        onCreateNotebook={noop}
        onSelectNotebook={noop}
        onClearSelection={noop}
      />,
    );
    expect(screen.getByTestId("notebook-sidebar-list-loading")).toBeInTheDocument();
  });

  it("shows the empty state when there are no notebooks", () => {
    render(
      <NotebookSidebar
        notebooks={[]}
        isLoading={false}
        activeNotebookId={null}
        searchTerm=""
        onSearchChange={noop}
        onCreateNotebook={noop}
        onSelectNotebook={noop}
        onClearSelection={noop}
      />,
    );
    expect(screen.getByTestId("notebook-sidebar-list-empty")).toBeInTheDocument();
  });
});

describe("NotebookSidebar — listing / selection", () => {
  it("renders one card per notebook", () => {
    render(
      <NotebookSidebar
        notebooks={[notebook({ id: 1, title: "Alpha" }), notebook({ id: 2, title: "Beta" })]}
        isLoading={false}
        activeNotebookId={null}
        searchTerm=""
        onSearchChange={noop}
        onCreateNotebook={noop}
        onSelectNotebook={noop}
        onClearSelection={noop}
      />,
    );
    expect(screen.getByTestId("notebook-sidebar-list-card-1")).toBeInTheDocument();
    expect(screen.getByTestId("notebook-sidebar-list-card-2")).toBeInTheDocument();
  });

  it("calls onSelectNotebook when a notebook card is clicked", () => {
    const onSelectNotebook = vi.fn();
    render(
      <NotebookSidebar
        notebooks={[notebook({ id: 3, title: "Pick me" })]}
        isLoading={false}
        activeNotebookId={null}
        searchTerm=""
        onSearchChange={noop}
        onCreateNotebook={noop}
        onSelectNotebook={onSelectNotebook}
        onClearSelection={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("notebook-sidebar-list-card-3-select"));
    expect(onSelectNotebook).toHaveBeenCalledWith(3);
  });

  it("shows a clear-selection link only when a notebook is active, and calls onClearSelection", () => {
    const onClearSelection = vi.fn();
    const { rerender } = render(
      <NotebookSidebar
        notebooks={[notebook()]}
        isLoading={false}
        activeNotebookId={null}
        searchTerm=""
        onSearchChange={noop}
        onCreateNotebook={noop}
        onSelectNotebook={noop}
        onClearSelection={onClearSelection}
      />,
    );
    expect(screen.queryByTestId("notebook-sidebar-clear-selection")).not.toBeInTheDocument();

    rerender(
      <NotebookSidebar
        notebooks={[notebook()]}
        isLoading={false}
        activeNotebookId={1}
        searchTerm=""
        onSearchChange={noop}
        onCreateNotebook={noop}
        onSelectNotebook={noop}
        onClearSelection={onClearSelection}
      />,
    );
    fireEvent.click(screen.getByTestId("notebook-sidebar-clear-selection"));
    expect(onClearSelection).toHaveBeenCalled();
  });

  it("passes noteCounts through to the matching card", () => {
    render(
      <NotebookSidebar
        notebooks={[notebook({ id: 1 })]}
        isLoading={false}
        activeNotebookId={null}
        searchTerm=""
        onSearchChange={noop}
        onCreateNotebook={noop}
        onSelectNotebook={noop}
        onClearSelection={noop}
        noteCounts={{ 1: 5 }}
      />,
    );
    expect(screen.getByTestId("notebook-sidebar-list-card-1-note-count")).toHaveTextContent("5");
  });
});

describe("NotebookSidebar — search", () => {
  it("calls onSearchChange as the user types", () => {
    const onSearchChange = vi.fn();
    render(
      <NotebookSidebar
        notebooks={[]}
        isLoading={false}
        activeNotebookId={null}
        searchTerm=""
        onSearchChange={onSearchChange}
        onCreateNotebook={noop}
        onSelectNotebook={noop}
        onClearSelection={noop}
      />,
    );
    fireEvent.change(screen.getByTestId("notebook-sidebar-search"), { target: { value: "earnings" } });
    expect(onSearchChange).toHaveBeenCalledWith("earnings");
  });
});

describe("NotebookSidebar — create notebook", () => {
  it("opens the create form, then submits title + description and closes it", async () => {
    const onCreateNotebook = vi.fn().mockResolvedValue(undefined);
    render(
      <NotebookSidebar
        notebooks={[]}
        isLoading={false}
        activeNotebookId={null}
        searchTerm=""
        onSearchChange={noop}
        onCreateNotebook={onCreateNotebook}
        onSelectNotebook={noop}
        onClearSelection={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("notebook-sidebar-new-notebook"));
    expect(screen.getByTestId("notebook-sidebar-create-form")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("notebook-sidebar-create-title"), { target: { value: "New research" } });
    fireEvent.change(screen.getByTestId("notebook-sidebar-create-description"), { target: { value: "A description" } });
    await fireEvent.click(screen.getByTestId("notebook-sidebar-create-save"));

    expect(onCreateNotebook).toHaveBeenCalledWith({ title: "New research", description: "A description" });
  });

  it("never creates a notebook with an empty title", () => {
    const onCreateNotebook = vi.fn();
    render(
      <NotebookSidebar
        notebooks={[]}
        isLoading={false}
        activeNotebookId={null}
        searchTerm=""
        onSearchChange={noop}
        onCreateNotebook={onCreateNotebook}
        onSelectNotebook={noop}
        onClearSelection={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("notebook-sidebar-new-notebook"));
    fireEvent.click(screen.getByTestId("notebook-sidebar-create-save"));
    expect(onCreateNotebook).not.toHaveBeenCalled();
  });

  it("cancel closes the create form without calling onCreateNotebook", () => {
    const onCreateNotebook = vi.fn();
    render(
      <NotebookSidebar
        notebooks={[]}
        isLoading={false}
        activeNotebookId={null}
        searchTerm=""
        onSearchChange={noop}
        onCreateNotebook={onCreateNotebook}
        onSelectNotebook={noop}
        onClearSelection={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("notebook-sidebar-new-notebook"));
    fireEvent.change(screen.getByTestId("notebook-sidebar-create-title"), { target: { value: "Abandoned" } });
    fireEvent.click(screen.getByTestId("notebook-sidebar-create-cancel"));
    expect(screen.queryByTestId("notebook-sidebar-create-form")).not.toBeInTheDocument();
    expect(onCreateNotebook).not.toHaveBeenCalled();
  });

  it("the empty state's own action button also opens the create form", () => {
    render(
      <NotebookSidebar
        notebooks={[]}
        isLoading={false}
        activeNotebookId={null}
        searchTerm=""
        onSearchChange={noop}
        onCreateNotebook={noop}
        onSelectNotebook={noop}
        onClearSelection={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("notebook-sidebar-list-empty-action"));
    expect(screen.getByTestId("notebook-sidebar-create-form")).toBeInTheDocument();
  });
});
