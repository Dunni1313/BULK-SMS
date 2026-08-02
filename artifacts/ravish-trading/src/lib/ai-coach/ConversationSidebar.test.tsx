// v1.5.0 Sprint 6 — AI Coach Memory. Rendering/interaction coverage for the
// shared, generic conversation sidebar component.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConversationSidebar } from "./ConversationSidebar";
import type { CoachConversation } from "./coachConversationsApi";

function conversation(overrides: Partial<CoachConversation> = {}): CoachConversation {
  return {
    id: 1,
    coachId: "trading",
    title: "AAPL earnings review",
    archived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const noop = () => {};

describe("ConversationSidebar — empty / loading state", () => {
  it("shows a loading message while isLoading is true", () => {
    render(
      <ConversationSidebar
        conversations={[]}
        isLoading
        activeConversationId={null}
        searchTerm=""
        onSearchChange={noop}
        onNewConversation={noop}
        onSelectConversation={noop}
        onRenameConversation={noop}
        onDeleteConversation={noop}
      />,
    );
    expect(screen.getByTestId("conversation-sidebar-loading")).toBeInTheDocument();
  });

  it("shows an honest empty-state message when there are zero conversations", () => {
    render(
      <ConversationSidebar
        conversations={[]}
        isLoading={false}
        activeConversationId={null}
        searchTerm=""
        onSearchChange={noop}
        onNewConversation={noop}
        onSelectConversation={noop}
        onRenameConversation={noop}
        onDeleteConversation={noop}
      />,
    );
    expect(screen.getByTestId("conversation-sidebar-empty")).toBeInTheDocument();
  });
});

describe("ConversationSidebar — list rendering + active highlight", () => {
  it("renders one item per conversation, marking only the active one", () => {
    render(
      <ConversationSidebar
        conversations={[conversation({ id: 1, title: "First" }), conversation({ id: 2, title: "Second" })]}
        isLoading={false}
        activeConversationId={2}
        searchTerm=""
        onSearchChange={noop}
        onNewConversation={noop}
        onSelectConversation={noop}
        onRenameConversation={noop}
        onDeleteConversation={noop}
      />,
    );
    expect(screen.getByTestId("conversation-sidebar-item-1")).toHaveAttribute("data-active", "false");
    expect(screen.getByTestId("conversation-sidebar-item-2")).toHaveAttribute("data-active", "true");
  });
});

describe("ConversationSidebar — actions", () => {
  it("calls onNewConversation when New Chat is clicked", () => {
    const onNewConversation = vi.fn();
    render(
      <ConversationSidebar
        conversations={[]}
        isLoading={false}
        activeConversationId={null}
        searchTerm=""
        onSearchChange={noop}
        onNewConversation={onNewConversation}
        onSelectConversation={noop}
        onRenameConversation={noop}
        onDeleteConversation={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("conversation-sidebar-new-chat"));
    expect(onNewConversation).toHaveBeenCalledTimes(1);
  });

  it("calls onSearchChange with the typed value", () => {
    const onSearchChange = vi.fn();
    render(
      <ConversationSidebar
        conversations={[]}
        isLoading={false}
        activeConversationId={null}
        searchTerm=""
        onSearchChange={onSearchChange}
        onNewConversation={noop}
        onSelectConversation={noop}
        onRenameConversation={noop}
        onDeleteConversation={noop}
      />,
    );
    fireEvent.change(screen.getByTestId("conversation-sidebar-search"), { target: { value: "earnings" } });
    expect(onSearchChange).toHaveBeenCalledWith("earnings");
  });

  it("calls onSelectConversation with the clicked conversation's id", () => {
    const onSelectConversation = vi.fn();
    render(
      <ConversationSidebar
        conversations={[conversation({ id: 9 })]}
        isLoading={false}
        activeConversationId={null}
        searchTerm=""
        onSearchChange={noop}
        onNewConversation={noop}
        onSelectConversation={onSelectConversation}
        onRenameConversation={noop}
        onDeleteConversation={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("conversation-sidebar-select-9"));
    expect(onSelectConversation).toHaveBeenCalledWith(9);
  });

  it("rename: entering edit mode, typing a new title, and confirming calls onRenameConversation with the trimmed title", () => {
    const onRenameConversation = vi.fn();
    render(
      <ConversationSidebar
        conversations={[conversation({ id: 4, title: "Old title" })]}
        isLoading={false}
        activeConversationId={null}
        searchTerm=""
        onSearchChange={noop}
        onNewConversation={noop}
        onSelectConversation={noop}
        onRenameConversation={onRenameConversation}
        onDeleteConversation={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("conversation-sidebar-rename-4"));
    const input = screen.getByTestId("conversation-sidebar-rename-input-4");
    fireEvent.change(input, { target: { value: "  New title  " } });
    fireEvent.click(screen.getByTestId("conversation-sidebar-rename-save-4"));
    expect(onRenameConversation).toHaveBeenCalledWith(4, "New title");
  });

  it("rename: cancel leaves the title unchanged and calls no callback", () => {
    const onRenameConversation = vi.fn();
    render(
      <ConversationSidebar
        conversations={[conversation({ id: 4, title: "Old title" })]}
        isLoading={false}
        activeConversationId={null}
        searchTerm=""
        onSearchChange={noop}
        onNewConversation={noop}
        onSelectConversation={noop}
        onRenameConversation={onRenameConversation}
        onDeleteConversation={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("conversation-sidebar-rename-4"));
    fireEvent.change(screen.getByTestId("conversation-sidebar-rename-input-4"), { target: { value: "Discarded" } });
    fireEvent.click(screen.getByTestId("conversation-sidebar-rename-cancel-4"));
    expect(onRenameConversation).not.toHaveBeenCalled();
    expect(screen.getByText("Old title")).toBeInTheDocument();
  });

  it("delete requires confirmation — a single click alone never calls onDeleteConversation", () => {
    const onDeleteConversation = vi.fn();
    render(
      <ConversationSidebar
        conversations={[conversation({ id: 5 })]}
        isLoading={false}
        activeConversationId={null}
        searchTerm=""
        onSearchChange={noop}
        onNewConversation={noop}
        onSelectConversation={noop}
        onRenameConversation={noop}
        onDeleteConversation={onDeleteConversation}
      />,
    );
    fireEvent.click(screen.getByTestId("conversation-sidebar-delete-5"));
    expect(onDeleteConversation).not.toHaveBeenCalled();
    expect(screen.getByTestId("conversation-sidebar-delete-confirm-5")).toBeInTheDocument();
  });

  it("delete: clicking Delete then Confirm calls onDeleteConversation with the right id", () => {
    const onDeleteConversation = vi.fn();
    render(
      <ConversationSidebar
        conversations={[conversation({ id: 5 })]}
        isLoading={false}
        activeConversationId={null}
        searchTerm=""
        onSearchChange={noop}
        onNewConversation={noop}
        onSelectConversation={noop}
        onRenameConversation={noop}
        onDeleteConversation={onDeleteConversation}
      />,
    );
    fireEvent.click(screen.getByTestId("conversation-sidebar-delete-5"));
    fireEvent.click(screen.getByTestId("conversation-sidebar-delete-confirm-5"));
    expect(onDeleteConversation).toHaveBeenCalledWith(5);
  });

  it("delete: clicking Cancel after Delete never calls onDeleteConversation", () => {
    const onDeleteConversation = vi.fn();
    render(
      <ConversationSidebar
        conversations={[conversation({ id: 5 })]}
        isLoading={false}
        activeConversationId={null}
        searchTerm=""
        onSearchChange={noop}
        onNewConversation={noop}
        onSelectConversation={noop}
        onRenameConversation={noop}
        onDeleteConversation={onDeleteConversation}
      />,
    );
    fireEvent.click(screen.getByTestId("conversation-sidebar-delete-5"));
    fireEvent.click(screen.getByTestId("conversation-sidebar-delete-cancel-5"));
    expect(onDeleteConversation).not.toHaveBeenCalled();
  });

  it("supports a caller-supplied testId prefix", () => {
    render(
      <ConversationSidebar
        conversations={[]}
        isLoading={false}
        activeConversationId={null}
        searchTerm=""
        onSearchChange={noop}
        onNewConversation={noop}
        onSelectConversation={noop}
        onRenameConversation={noop}
        onDeleteConversation={noop}
        testId="trading-coach-sidebar"
      />,
    );
    expect(screen.getByTestId("trading-coach-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("trading-coach-sidebar-new-chat")).toBeInTheDocument();
  });
});
