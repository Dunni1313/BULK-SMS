// v1.5.0 Sprint 8 — AI Research Notebooks. Rendering/interaction coverage
// for the single-notebook summary card, mirroring WorkspaceCard.test.tsx's
// own established pattern (Sprint 7).

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotebookCard } from "./NotebookCard";
import type { AiNotebook } from "./notebooksApi";

function notebook(overrides: Partial<AiNotebook> = {}): AiNotebook {
  return {
    id: 1,
    coachId: "trading",
    workspaceId: null,
    title: "Q3 earnings research",
    description: "Tracking earnings plays",
    pinned: false,
    archived: false,
    tags: ["earnings", "swing"],
    version: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const noop = () => {};

describe("NotebookCard — rendering", () => {
  it("renders the title, description, tags, and version", () => {
    render(<NotebookCard notebook={notebook()} onSelect={noop} />);
    expect(screen.getByText("Q3 earnings research")).toBeInTheDocument();
    expect(screen.getByText("Tracking earnings plays")).toBeInTheDocument();
    expect(screen.getByText("earnings")).toBeInTheDocument();
    expect(screen.getByText("swing")).toBeInTheDocument();
    expect(screen.getByTestId("notebook-card-1-version")).toHaveTextContent("v1");
  });

  it("shows a pin icon and no archived badge for a pinned (favourite) notebook", () => {
    render(<NotebookCard notebook={notebook({ pinned: true })} onSelect={noop} />);
    expect(screen.getByTestId("notebook-card-1-pinned-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("notebook-card-1-archived-badge")).not.toBeInTheDocument();
  });

  it("shows an archived badge for an archived notebook", () => {
    render(<NotebookCard notebook={notebook({ archived: true })} onSelect={noop} />);
    expect(screen.getByTestId("notebook-card-1-archived-badge")).toBeInTheDocument();
  });

  it("shows a note count when provided", () => {
    render(<NotebookCard notebook={notebook()} onSelect={noop} noteCount={4} />);
    expect(screen.getByTestId("notebook-card-1-note-count")).toHaveTextContent("4");
  });

  it("reflects isActive via a data-active attribute", () => {
    render(<NotebookCard notebook={notebook()} onSelect={noop} isActive />);
    expect(screen.getByTestId("notebook-card-1")).toHaveAttribute("data-active", "true");
  });
});

describe("NotebookCard — actions", () => {
  it("calls onSelect with the notebook id when clicked", () => {
    const onSelect = vi.fn();
    render(<NotebookCard notebook={notebook()} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("notebook-card-1-select"));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("calls onTogglePin with the toggled value", () => {
    const onTogglePin = vi.fn();
    render(<NotebookCard notebook={notebook({ pinned: false })} onSelect={noop} onTogglePin={onTogglePin} />);
    fireEvent.click(screen.getByTestId("notebook-card-1-pin-toggle"));
    expect(onTogglePin).toHaveBeenCalledWith(1, true);
  });

  it("calls onToggleArchive with the toggled value", () => {
    const onToggleArchive = vi.fn();
    render(<NotebookCard notebook={notebook({ archived: false })} onSelect={noop} onToggleArchive={onToggleArchive} />);
    fireEvent.click(screen.getByTestId("notebook-card-1-archive-toggle"));
    expect(onToggleArchive).toHaveBeenCalledWith(1, true);
  });

  it("calls onDelete with the notebook id", () => {
    const onDelete = vi.fn();
    render(<NotebookCard notebook={notebook()} onSelect={noop} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId("notebook-card-1-delete"));
    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it("renders no quick-action buttons when their handlers are omitted", () => {
    render(<NotebookCard notebook={notebook()} onSelect={noop} />);
    expect(screen.queryByTestId("notebook-card-1-pin-toggle")).not.toBeInTheDocument();
    expect(screen.queryByTestId("notebook-card-1-archive-toggle")).not.toBeInTheDocument();
    expect(screen.queryByTestId("notebook-card-1-delete")).not.toBeInTheDocument();
  });
});
