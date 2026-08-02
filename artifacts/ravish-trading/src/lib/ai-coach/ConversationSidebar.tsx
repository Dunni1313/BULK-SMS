// v1.5.0 Sprint 6 — AI Coach Memory. A reusable conversation list sidebar —
// New Chat, search, rename, delete, last-updated, active-conversation
// highlight — driven entirely by useCoachConversations()'s own state and
// actions. Every specialist coach page (Trading/Investing/Options) mounts
// this exact same component; nothing here is coach-specific.
//
// Delete uses an inline confirm-in-place (click Delete once to reveal
// Confirm/Cancel, click Confirm to actually delete) rather than a modal —
// simple to reason about and to test, no extra dialog component wiring
// needed for a first-cut shared sidebar.

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Search, Pencil, Trash2, Check, X } from "lucide-react";
import type { CoachConversation } from "./coachConversationsApi";

export interface ConversationSidebarProps {
  conversations: CoachConversation[];
  isLoading: boolean;
  activeConversationId: number | null;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onNewConversation: () => void;
  onSelectConversation: (id: number) => void;
  onRenameConversation: (id: number, title: string) => void | Promise<void>;
  onDeleteConversation: (id: number) => void | Promise<void>;
  /** Base data-testid — defaults to "conversation-sidebar". */
  testId?: string;
}

export function ConversationSidebar({
  conversations,
  isLoading,
  activeConversationId,
  searchTerm,
  onSearchChange,
  onNewConversation,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  testId = "conversation-sidebar",
}: ConversationSidebarProps) {
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);

  function beginRename(conversation: CoachConversation) {
    setRenamingId(conversation.id);
    setRenameDraft(conversation.title);
  }

  function commitRename(id: number) {
    const trimmed = renameDraft.trim();
    if (trimmed.length > 0) onRenameConversation(id, trimmed);
    setRenamingId(null);
  }

  return (
    <div className="flex w-64 shrink-0 flex-col gap-2 border-r border-border pr-3" data-testid={testId}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-start gap-1.5"
        onClick={onNewConversation}
        data-testid={`${testId}-new-chat`}
      >
        <Plus className="h-3.5 w-3.5" />
        New Chat
      </Button>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search conversations"
          className="h-8 pl-7 text-xs"
          data-testid={`${testId}-search`}
        />
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto" data-testid={`${testId}-list`}>
        {isLoading && (
          <p className="px-1 py-2 text-xs text-muted-foreground" data-testid={`${testId}-loading`}>
            Loading conversations…
          </p>
        )}

        {!isLoading && conversations.length === 0 && (
          <p className="px-1 py-2 text-xs text-muted-foreground" data-testid={`${testId}-empty`}>
            No conversations yet — start a New Chat.
          </p>
        )}

        {!isLoading &&
          conversations.map((conversation) => {
            const isActive = conversation.id === activeConversationId;
            const isRenaming = renamingId === conversation.id;
            const isConfirmingDelete = confirmingDeleteId === conversation.id;

            return (
              <div
                key={conversation.id}
                className={`group rounded-md px-2 py-1.5 text-xs ${
                  isActive ? "bg-indigo-500/10 text-indigo-300" : "text-foreground/90 hover:bg-muted/50"
                }`}
                data-testid={`${testId}-item-${conversation.id}`}
                data-active={isActive ? "true" : "false"}
              >
                {isRenaming ? (
                  <div className="flex items-center gap-1">
                    <Input
                      autoFocus
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(conversation.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="h-6 text-xs"
                      data-testid={`${testId}-rename-input-${conversation.id}`}
                    />
                    <button
                      type="button"
                      onClick={() => commitRename(conversation.id)}
                      aria-label="Save name"
                      data-testid={`${testId}-rename-save-${conversation.id}`}
                    >
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingId(null)}
                      aria-label="Cancel rename"
                      data-testid={`${testId}-rename-cancel-${conversation.id}`}
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left"
                      onClick={() => onSelectConversation(conversation.id)}
                      data-testid={`${testId}-select-${conversation.id}`}
                    >
                      <span className="block truncate font-medium">{conversation.title}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })}
                      </span>
                    </button>

                    {isConfirmingDelete ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteConversation(conversation.id);
                            setConfirmingDeleteId(null);
                          }}
                          aria-label="Confirm delete"
                          data-testid={`${testId}-delete-confirm-${conversation.id}`}
                        >
                          <Check className="h-3.5 w-3.5 text-destructive" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteId(null)}
                          aria-label="Cancel delete"
                          data-testid={`${testId}-delete-cancel-${conversation.id}`}
                        >
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => beginRename(conversation)}
                          aria-label="Rename conversation"
                          data-testid={`${testId}-rename-${conversation.id}`}
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteId(conversation.id)}
                          aria-label="Delete conversation"
                          data-testid={`${testId}-delete-${conversation.id}`}
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
