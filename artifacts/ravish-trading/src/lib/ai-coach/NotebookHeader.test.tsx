// v1.5.0 Sprint 8 — AI Research Notebooks. Rendering/interaction coverage
// for the notebook header — title/description display and inline edit,
// pin/archive/delete actions, version badge, and content search.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotebookHeader } from "./NotebookHeader";
import type { AiNotebookDetail } from "./notebooksApi";

function detail(overrides: Partial<AiNotebookDetail> = {}): AiNotebookDetail {
  return {
    id: 1,
    coachId: "trading",
    workspaceId: null,
    title: "Q3 research",
    description: "Tracking earnings plays",
    pinned: false,
    archived: false,
    tags: ["earnings"],
    version: 2,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: new Date().toISOString(),
    notes: [],
    links: [],
    ...overrides,
  };
}

const noop = () => {};

describe("NotebookHeader — rendering", () => {
  it("renders the title, description, tags, and version", () => {
    render(<NotebookHeader notebook={detail()} onRename={noop} onTogglePin={noop} onToggleArchive={noop} onDelete={noop} />);
    expect(screen.getByTestId("notebook-header-title")).toHaveTextContent("Q3 research");
    expect(screen.getByTestId("notebook-header-description")).toHaveTextContent("Tracking earnings plays");
    expect(screen.getByText("earnings")).toBeInTheDocument();
    expect(screen.getByTestId("notebook-header-version")).toHaveTextContent("v2");
  });

  it("shows an archived badge for an archived notebook", () => {
    render(<NotebookHeader notebook={detail({ archived: true })} onRename={noop} onTogglePin={noop} onToggleArchive={noop} onDelete={noop} />);
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("renders no content-search box when onSearch is omitted", () => {
    render(<NotebookHeader notebook={detail()} onRename={noop} onTogglePin={noop} onToggleArchive={noop} onDelete={noop} />);
    expect(screen.queryByTestId("notebook-header-content-search")).not.toBeInTheDocument();
  });

  it("calls onSearch as the user types in the content-search box", () => {
    const onSearch = vi.fn();
    render(<NotebookHeader notebook={detail()} onRename={noop} onTogglePin={noop} onToggleArchive={noop} onDelete={noop} onSearch={onSearch} />);
    fireEvent.change(screen.getByTestId("notebook-header-content-search"), { target: { value: "support zone" } });
    expect(onSearch).toHaveBeenCalledWith("support zone");
  });
});

describe("NotebookHeader — actions", () => {
  it("calls onTogglePin with the toggled value", () => {
    const onTogglePin = vi.fn();
    render(<NotebookHeader notebook={detail({ pinned: false })} onRename={noop} onTogglePin={onTogglePin} onToggleArchive={noop} onDelete={noop} />);
    fireEvent.click(screen.getByTestId("notebook-header-pin-toggle"));
    expect(onTogglePin).toHaveBeenCalledWith(true);
  });

  it("calls onToggleArchive with the toggled value", () => {
    const onToggleArchive = vi.fn();
    render(<NotebookHeader notebook={detail({ archived: false })} onRename={noop} onTogglePin={noop} onToggleArchive={onToggleArchive} onDelete={noop} />);
    fireEvent.click(screen.getByTestId("notebook-header-archive-toggle"));
    expect(onToggleArchive).toHaveBeenCalledWith(true);
  });

  it("calls onDelete", () => {
    const onDelete = vi.fn();
    render(<NotebookHeader notebook={detail()} onRename={noop} onTogglePin={noop} onToggleArchive={noop} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId("notebook-header-delete"));
    expect(onDelete).toHaveBeenCalled();
  });
});

describe("NotebookHeader — inline rename", () => {
  it("opens the edit form pre-filled, then submits title + description", async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    render(<NotebookHeader notebook={detail()} onRename={onRename} onTogglePin={noop} onToggleArchive={noop} onDelete={noop} />);

    fireEvent.click(screen.getByTestId("notebook-header-edit-toggle"));
    expect(screen.getByTestId("notebook-header-edit-title")).toHaveValue("Q3 research");

    fireEvent.change(screen.getByTestId("notebook-header-edit-title"), { target: { value: "Renamed research" } });
    fireEvent.change(screen.getByTestId("notebook-header-edit-description"), { target: { value: "Updated description" } });
    await fireEvent.click(screen.getByTestId("notebook-header-edit-save"));

    expect(onRename).toHaveBeenCalledWith({ title: "Renamed research", description: "Updated description" });
  });

  it("never renames to an empty title", () => {
    const onRename = vi.fn();
    render(<NotebookHeader notebook={detail()} onRename={onRename} onTogglePin={noop} onToggleArchive={noop} onDelete={noop} />);
    fireEvent.click(screen.getByTestId("notebook-header-edit-toggle"));
    fireEvent.change(screen.getByTestId("notebook-header-edit-title"), { target: { value: "   " } });
    fireEvent.click(screen.getByTestId("notebook-header-edit-save"));
    expect(onRename).not.toHaveBeenCalled();
  });

  it("cancel closes the edit form without calling onRename", () => {
    const onRename = vi.fn();
    render(<NotebookHeader notebook={detail()} onRename={onRename} onTogglePin={noop} onToggleArchive={noop} onDelete={noop} />);
    fireEvent.click(screen.getByTestId("notebook-header-edit-toggle"));
    fireEvent.change(screen.getByTestId("notebook-header-edit-title"), { target: { value: "Abandoned" } });
    fireEvent.click(screen.getByTestId("notebook-header-edit-cancel"));
    expect(screen.queryByTestId("notebook-header-edit-form")).not.toBeInTheDocument();
    expect(onRename).not.toHaveBeenCalled();
  });
});
