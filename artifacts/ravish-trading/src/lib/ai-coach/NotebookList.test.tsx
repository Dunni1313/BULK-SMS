// v1.5.0 Sprint 8 — AI Research Notebooks. Rendering coverage for the pure
// list-rendering component — loading, empty, and populated states —
// independent of NotebookSidebar's own search/create-form plumbing.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotebookList } from "./NotebookList";
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

describe("NotebookList", () => {
  it("shows a loading message while isLoading is true", () => {
    render(<NotebookList notebooks={[]} isLoading activeNotebookId={null} onSelectNotebook={noop} />);
    expect(screen.getByTestId("notebook-list-loading")).toBeInTheDocument();
  });

  it("shows the empty state when there are no notebooks", () => {
    render(<NotebookList notebooks={[]} isLoading={false} activeNotebookId={null} onSelectNotebook={noop} />);
    expect(screen.getByTestId("notebook-list-empty")).toBeInTheDocument();
  });

  it("wires the empty state's action button to onCreateFirst when provided", () => {
    const onCreateFirst = vi.fn();
    render(<NotebookList notebooks={[]} isLoading={false} activeNotebookId={null} onSelectNotebook={noop} onCreateFirst={onCreateFirst} />);
    fireEvent.click(screen.getByTestId("notebook-list-empty-action"));
    expect(onCreateFirst).toHaveBeenCalled();
  });

  it("renders one card per notebook and marks the active one", () => {
    render(
      <NotebookList
        notebooks={[notebook({ id: 1, title: "Alpha" }), notebook({ id: 2, title: "Beta" })]}
        isLoading={false}
        activeNotebookId={2}
        onSelectNotebook={noop}
      />,
    );
    expect(screen.getByTestId("notebook-list-card-1")).toHaveAttribute("data-active", "false");
    expect(screen.getByTestId("notebook-list-card-2")).toHaveAttribute("data-active", "true");
  });

  it("calls onSelectNotebook when a card is clicked", () => {
    const onSelectNotebook = vi.fn();
    render(
      <NotebookList notebooks={[notebook({ id: 5, title: "Pick me" })]} isLoading={false} activeNotebookId={null} onSelectNotebook={onSelectNotebook} />,
    );
    fireEvent.click(screen.getByTestId("notebook-list-card-5-select"));
    expect(onSelectNotebook).toHaveBeenCalledWith(5);
  });
});
