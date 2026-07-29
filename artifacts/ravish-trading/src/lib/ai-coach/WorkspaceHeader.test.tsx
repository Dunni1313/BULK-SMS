// v1.5.0 Sprint 7 — AI Workspaces. Rendering/interaction coverage for the
// workspace header — name/description/tags, pin/archive/delete, and the
// collapsible research panel (notes + file references).

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkspaceHeader } from "./WorkspaceHeader";
import type { AiWorkspaceDetail } from "./workspacesApi";

function detail(overrides: Partial<AiWorkspaceDetail> = {}): AiWorkspaceDetail {
  return {
    id: 1,
    coachId: "trading",
    name: "Q3 earnings research",
    description: "Tracking earnings plays",
    pinned: false,
    archived: false,
    tags: ["earnings"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: new Date().toISOString(),
    conversations: [],
    files: [],
    notes: [],
    ...overrides,
  };
}

const noop = () => {};
const noopAsync = async () => {};

describe("WorkspaceHeader — rendering", () => {
  it("renders the name, description, and tags", () => {
    render(
      <WorkspaceHeader
        workspace={detail()}
        onTogglePin={noop}
        onToggleArchive={noop}
        onDelete={noop}
        onAddNote={noopAsync}
        onDeleteNote={noopAsync}
        onAddFile={noopAsync}
        onDeleteFile={noopAsync}
      />,
    );
    expect(screen.getByTestId("workspace-header-name")).toHaveTextContent("Q3 earnings research");
    expect(screen.getByTestId("workspace-header-description")).toHaveTextContent("Tracking earnings plays");
    expect(screen.getByText("earnings")).toBeInTheDocument();
  });

  it("shows the conversation count", () => {
    render(
      <WorkspaceHeader
        workspace={detail({ conversations: [{ id: 1, title: "a", archived: false, favourite: false, updatedAt: new Date().toISOString() }] })}
        onTogglePin={noop}
        onToggleArchive={noop}
        onDelete={noop}
        onAddNote={noopAsync}
        onDeleteNote={noopAsync}
        onAddFile={noopAsync}
        onDeleteFile={noopAsync}
      />,
    );
    expect(screen.getByText(/1 conversation/)).toBeInTheDocument();
  });

  it("the research panel is collapsed by default", () => {
    render(
      <WorkspaceHeader
        workspace={detail()}
        onTogglePin={noop}
        onToggleArchive={noop}
        onDelete={noop}
        onAddNote={noopAsync}
        onDeleteNote={noopAsync}
        onAddFile={noopAsync}
        onDeleteFile={noopAsync}
      />,
    );
    expect(screen.queryByTestId("workspace-header-research-panel")).not.toBeInTheDocument();
  });

  it("clicking Research opens the panel, showing honest empty states", () => {
    render(
      <WorkspaceHeader
        workspace={detail()}
        onTogglePin={noop}
        onToggleArchive={noop}
        onDelete={noop}
        onAddNote={noopAsync}
        onDeleteNote={noopAsync}
        onAddFile={noopAsync}
        onDeleteFile={noopAsync}
      />,
    );
    fireEvent.click(screen.getByTestId("workspace-header-research-toggle"));
    expect(screen.getByTestId("workspace-header-research-panel")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-header-notes-empty")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-header-files-empty")).toBeInTheDocument();
  });
});

describe("WorkspaceHeader — pin / archive / delete", () => {
  it("calls onTogglePin with the toggled value", () => {
    const onTogglePin = vi.fn();
    render(
      <WorkspaceHeader
        workspace={detail({ pinned: false })}
        onTogglePin={onTogglePin}
        onToggleArchive={noop}
        onDelete={noop}
        onAddNote={noopAsync}
        onDeleteNote={noopAsync}
        onAddFile={noopAsync}
        onDeleteFile={noopAsync}
      />,
    );
    fireEvent.click(screen.getByTestId("workspace-header-pin-toggle"));
    expect(onTogglePin).toHaveBeenCalledWith(true);
  });

  it("calls onToggleArchive with the toggled value", () => {
    const onToggleArchive = vi.fn();
    render(
      <WorkspaceHeader
        workspace={detail({ archived: false })}
        onTogglePin={noop}
        onToggleArchive={onToggleArchive}
        onDelete={noop}
        onAddNote={noopAsync}
        onDeleteNote={noopAsync}
        onAddFile={noopAsync}
        onDeleteFile={noopAsync}
      />,
    );
    fireEvent.click(screen.getByTestId("workspace-header-archive-toggle"));
    expect(onToggleArchive).toHaveBeenCalledWith(true);
  });

  it("calls onDelete", () => {
    const onDelete = vi.fn();
    render(
      <WorkspaceHeader
        workspace={detail()}
        onTogglePin={noop}
        onToggleArchive={noop}
        onDelete={onDelete}
        onAddNote={noopAsync}
        onDeleteNote={noopAsync}
        onAddFile={noopAsync}
        onDeleteFile={noopAsync}
      />,
    );
    fireEvent.click(screen.getByTestId("workspace-header-delete"));
    expect(onDelete).toHaveBeenCalled();
  });
});

describe("WorkspaceHeader — notes", () => {
  it("renders existing notes with their kind label", () => {
    render(
      <WorkspaceHeader
        workspace={detail({ notes: [{ id: 1, workspaceId: 1, kind: "summary", content: "Bullish thesis", createdAt: new Date().toISOString() }] })}
        onTogglePin={noop}
        onToggleArchive={noop}
        onDelete={noop}
        onAddNote={noopAsync}
        onDeleteNote={noopAsync}
        onAddFile={noopAsync}
        onDeleteFile={noopAsync}
      />,
    );
    fireEvent.click(screen.getByTestId("workspace-header-research-toggle"));
    expect(screen.getByTestId("workspace-header-note-1")).toHaveTextContent("Bullish thesis");
    expect(screen.getByTestId("workspace-header-note-1")).toHaveTextContent("AI summary");
  });

  it("submits a note with the default kind ('note') and the typed content", () => {
    const onAddNote = vi.fn();
    render(
      <WorkspaceHeader
        workspace={detail()}
        onTogglePin={noop}
        onToggleArchive={noop}
        onDelete={noop}
        onAddNote={onAddNote}
        onDeleteNote={noopAsync}
        onAddFile={noopAsync}
        onDeleteFile={noopAsync}
      />,
    );
    fireEvent.click(screen.getByTestId("workspace-header-research-toggle"));
    fireEvent.change(screen.getByTestId("workspace-header-note-input"), { target: { value: "Remember this" } });
    fireEvent.click(screen.getByTestId("workspace-header-note-save"));
    expect(onAddNote).toHaveBeenCalledWith("note", "Remember this");
  });

  it("never submits an empty note", () => {
    const onAddNote = vi.fn();
    render(
      <WorkspaceHeader
        workspace={detail()}
        onTogglePin={noop}
        onToggleArchive={noop}
        onDelete={noop}
        onAddNote={onAddNote}
        onDeleteNote={noopAsync}
        onAddFile={noopAsync}
        onDeleteFile={noopAsync}
      />,
    );
    fireEvent.click(screen.getByTestId("workspace-header-research-toggle"));
    fireEvent.click(screen.getByTestId("workspace-header-note-save"));
    expect(onAddNote).not.toHaveBeenCalled();
  });

  it("calls onDeleteNote with the note id", () => {
    const onDeleteNote = vi.fn();
    render(
      <WorkspaceHeader
        workspace={detail({ notes: [{ id: 42, workspaceId: 1, kind: "note", content: "x", createdAt: new Date().toISOString() }] })}
        onTogglePin={noop}
        onToggleArchive={noop}
        onDelete={noop}
        onAddNote={noopAsync}
        onDeleteNote={onDeleteNote}
        onAddFile={noopAsync}
        onDeleteFile={noopAsync}
      />,
    );
    fireEvent.click(screen.getByTestId("workspace-header-research-toggle"));
    fireEvent.click(screen.getByTestId("workspace-header-note-delete-42"));
    expect(onDeleteNote).toHaveBeenCalledWith(42);
  });
});

describe("WorkspaceHeader — files", () => {
  it("renders existing file references as links", () => {
    render(
      <WorkspaceHeader
        workspace={detail({ files: [{ id: 1, workspaceId: 1, fileName: "10-K.pdf", fileUrl: "https://example.com/10-k.pdf", note: null, createdAt: new Date().toISOString() }] })}
        onTogglePin={noop}
        onToggleArchive={noop}
        onDelete={noop}
        onAddNote={noopAsync}
        onDeleteNote={noopAsync}
        onAddFile={noopAsync}
        onDeleteFile={noopAsync}
      />,
    );
    fireEvent.click(screen.getByTestId("workspace-header-research-toggle"));
    const link = screen.getByText("10-K.pdf").closest("a");
    expect(link).toHaveAttribute("href", "https://example.com/10-k.pdf");
  });

  it("submits a new file reference with name + url", () => {
    const onAddFile = vi.fn();
    render(
      <WorkspaceHeader
        workspace={detail()}
        onTogglePin={noop}
        onToggleArchive={noop}
        onDelete={noop}
        onAddNote={noopAsync}
        onDeleteNote={noopAsync}
        onAddFile={onAddFile}
        onDeleteFile={noopAsync}
      />,
    );
    fireEvent.click(screen.getByTestId("workspace-header-research-toggle"));
    fireEvent.change(screen.getByTestId("workspace-header-file-name-input"), { target: { value: "10-K.pdf" } });
    fireEvent.change(screen.getByTestId("workspace-header-file-url-input"), { target: { value: "https://example.com/10-k.pdf" } });
    fireEvent.click(screen.getByTestId("workspace-header-file-save"));
    expect(onAddFile).toHaveBeenCalledWith({ fileName: "10-K.pdf", fileUrl: "https://example.com/10-k.pdf" });
  });

  it("never submits a file reference missing a name or url", () => {
    const onAddFile = vi.fn();
    render(
      <WorkspaceHeader
        workspace={detail()}
        onTogglePin={noop}
        onToggleArchive={noop}
        onDelete={noop}
        onAddNote={noopAsync}
        onDeleteNote={noopAsync}
        onAddFile={onAddFile}
        onDeleteFile={noopAsync}
      />,
    );
    fireEvent.click(screen.getByTestId("workspace-header-research-toggle"));
    fireEvent.change(screen.getByTestId("workspace-header-file-name-input"), { target: { value: "10-K.pdf" } });
    fireEvent.click(screen.getByTestId("workspace-header-file-save"));
    expect(onAddFile).not.toHaveBeenCalled();
  });

  it("calls onDeleteFile with the file id", () => {
    const onDeleteFile = vi.fn();
    render(
      <WorkspaceHeader
        workspace={detail({ files: [{ id: 7, workspaceId: 1, fileName: "a.pdf", fileUrl: "https://example.com/a.pdf", note: null, createdAt: new Date().toISOString() }] })}
        onTogglePin={noop}
        onToggleArchive={noop}
        onDelete={noop}
        onAddNote={noopAsync}
        onDeleteNote={noopAsync}
        onAddFile={noopAsync}
        onDeleteFile={onDeleteFile}
      />,
    );
    fireEvent.click(screen.getByTestId("workspace-header-research-toggle"));
    fireEvent.click(screen.getByTestId("workspace-header-file-delete-7"));
    expect(onDeleteFile).toHaveBeenCalledWith(7);
  });
});
