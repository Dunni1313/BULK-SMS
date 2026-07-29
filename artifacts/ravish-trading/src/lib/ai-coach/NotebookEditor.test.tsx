// v1.5.0 Sprint 8 — AI Research Notebooks. Rendering/interaction coverage
// for the notebook content editor — notes (add/list/delete) and linked
// conversations/files (list/unlink), mirroring WorkspaceHeader.test.tsx's
// own established notes/files coverage pattern (Sprint 7). Dropdown-based
// "link a conversation/file" selection is not simulated here, matching
// this codebase's own established convention of not driving shadcn/ui
// Select option-picking through jsdom (see OptionChain.test.tsx) — only
// the trigger's presence/absence is asserted.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotebookEditor } from "./NotebookEditor";
import type { AiNotebookDetail } from "./notebooksApi";

function detail(overrides: Partial<AiNotebookDetail> = {}): AiNotebookDetail {
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
    updatedAt: new Date().toISOString(),
    notes: [],
    links: [],
    ...overrides,
  };
}

const noop = () => {};
const noopAsync = async () => {};

describe("NotebookEditor — notes", () => {
  it("shows an honest empty message when there are no notes", () => {
    render(<NotebookEditor notebook={detail()} onAddNote={noopAsync} onDeleteNote={noopAsync} />);
    expect(screen.getByTestId("notebook-editor-notes-empty")).toBeInTheDocument();
  });

  it("renders existing notes with their kind label", () => {
    render(
      <NotebookEditor
        notebook={detail({ notes: [{ id: 1, notebookId: 1, kind: "finding", content: "A key finding", createdAt: new Date().toISOString() }] })}
        onAddNote={noopAsync}
        onDeleteNote={noopAsync}
      />,
    );
    expect(screen.getByTestId("notebook-editor-note-1")).toHaveTextContent("A key finding");
    expect(screen.getByTestId("notebook-editor-note-1")).toHaveTextContent("Key finding");
  });

  it("submits a note with the default kind ('note') and the typed content", () => {
    const onAddNote = vi.fn();
    render(<NotebookEditor notebook={detail()} onAddNote={onAddNote} onDeleteNote={noopAsync} />);
    fireEvent.change(screen.getByTestId("notebook-editor-note-input"), { target: { value: "Remember this" } });
    fireEvent.click(screen.getByTestId("notebook-editor-note-save"));
    expect(onAddNote).toHaveBeenCalledWith("note", "Remember this");
  });

  it("never submits an empty note", () => {
    const onAddNote = vi.fn();
    render(<NotebookEditor notebook={detail()} onAddNote={onAddNote} onDeleteNote={noopAsync} />);
    fireEvent.click(screen.getByTestId("notebook-editor-note-save"));
    expect(onAddNote).not.toHaveBeenCalled();
  });

  it("calls onDeleteNote with the note id", () => {
    const onDeleteNote = vi.fn();
    render(
      <NotebookEditor
        notebook={detail({ notes: [{ id: 42, notebookId: 1, kind: "note", content: "x", createdAt: new Date().toISOString() }] })}
        onAddNote={noopAsync}
        onDeleteNote={onDeleteNote}
      />,
    );
    fireEvent.click(screen.getByTestId("notebook-editor-note-delete-42"));
    expect(onDeleteNote).toHaveBeenCalledWith(42);
  });
});

describe("NotebookEditor — linked conversations", () => {
  it("shows an honest empty message when nothing is linked", () => {
    render(<NotebookEditor notebook={detail()} onAddNote={noopAsync} onDeleteNote={noopAsync} />);
    expect(screen.getByTestId("notebook-editor-conversations-empty")).toBeInTheDocument();
  });

  it("renders a linked conversation's title", () => {
    render(
      <NotebookEditor
        notebook={detail({
          links: [{ id: 1, notebookId: 1, linkType: "conversation", conversation: { id: 9, title: "Linked chat" }, file: null, createdAt: new Date().toISOString() }],
        })}
        onAddNote={noopAsync}
        onDeleteNote={noopAsync}
      />,
    );
    expect(screen.getByTestId("notebook-editor-conversation-link-1")).toHaveTextContent("Linked chat");
  });

  it("calls onRemoveLink with the link id when unlinking a conversation", () => {
    const onRemoveLink = vi.fn();
    render(
      <NotebookEditor
        notebook={detail({
          links: [{ id: 1, notebookId: 1, linkType: "conversation", conversation: { id: 9, title: "Linked chat" }, file: null, createdAt: new Date().toISOString() }],
        })}
        onAddNote={noopAsync}
        onDeleteNote={noopAsync}
        onRemoveLink={onRemoveLink}
      />,
    );
    fireEvent.click(screen.getByTestId("notebook-editor-conversation-unlink-1"));
    expect(onRemoveLink).toHaveBeenCalledWith(1);
  });

  it("shows a 'link a conversation' picker only when linkable conversations are available", () => {
    const { rerender } = render(
      <NotebookEditor notebook={detail()} onAddNote={noopAsync} onDeleteNote={noopAsync} onLinkConversation={noop} linkableConversations={[]} />,
    );
    expect(screen.queryByTestId("notebook-editor-link-conversation-select")).not.toBeInTheDocument();

    rerender(
      <NotebookEditor
        notebook={detail()}
        onAddNote={noopAsync}
        onDeleteNote={noopAsync}
        onLinkConversation={noop}
        linkableConversations={[{ id: 2, title: "Available chat" }]}
      />,
    );
    expect(screen.getByTestId("notebook-editor-link-conversation-select")).toBeInTheDocument();
  });

  it("excludes an already-linked conversation from the 'link a conversation' picker's availability", () => {
    render(
      <NotebookEditor
        notebook={detail({
          links: [{ id: 1, notebookId: 1, linkType: "conversation", conversation: { id: 9, title: "Already linked" }, file: null, createdAt: new Date().toISOString() }],
        })}
        onAddNote={noopAsync}
        onDeleteNote={noopAsync}
        onLinkConversation={noop}
        linkableConversations={[{ id: 9, title: "Already linked" }]}
      />,
    );
    expect(screen.queryByTestId("notebook-editor-link-conversation-select")).not.toBeInTheDocument();
  });
});

describe("NotebookEditor — linked files (references only)", () => {
  it("shows an honest empty message when nothing is linked", () => {
    render(<NotebookEditor notebook={detail()} onAddNote={noopAsync} onDeleteNote={noopAsync} />);
    expect(screen.getByTestId("notebook-editor-files-empty")).toBeInTheDocument();
  });

  it("renders a linked file as an external link", () => {
    render(
      <NotebookEditor
        notebook={detail({
          links: [
            {
              id: 1,
              notebookId: 1,
              linkType: "file",
              conversation: null,
              file: { id: 4, fileName: "10-K.pdf", fileUrl: "https://example.com/10-k.pdf" },
              createdAt: new Date().toISOString(),
            },
          ],
        })}
        onAddNote={noopAsync}
        onDeleteNote={noopAsync}
      />,
    );
    const link = screen.getByText("10-K.pdf").closest("a");
    expect(link).toHaveAttribute("href", "https://example.com/10-k.pdf");
  });

  it("calls onRemoveLink with the link id when unlinking a file", () => {
    const onRemoveLink = vi.fn();
    render(
      <NotebookEditor
        notebook={detail({
          links: [
            {
              id: 1,
              notebookId: 1,
              linkType: "file",
              conversation: null,
              file: { id: 4, fileName: "10-K.pdf", fileUrl: "https://example.com/10-k.pdf" },
              createdAt: new Date().toISOString(),
            },
          ],
        })}
        onAddNote={noopAsync}
        onDeleteNote={noopAsync}
        onRemoveLink={onRemoveLink}
      />,
    );
    fireEvent.click(screen.getByTestId("notebook-editor-file-unlink-1"));
    expect(onRemoveLink).toHaveBeenCalledWith(1);
  });
});
