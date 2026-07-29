// v1.5.0 Sprint 7 — AI Workspaces. A reusable workspace list sidebar — New
// Workspace (inline create form: name + optional description), search,
// pin/archive/delete quick actions, active-workspace highlight — driven
// entirely by the caller's own workspace state/actions, mirroring
// ConversationSidebar.tsx's own established shape (Sprint 6) so the two
// sidebars feel like the same family of component. Every specialist coach
// page (Trading/Investing/Options) can mount this exact same component;
// nothing here is coach-specific.

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Search, X } from "lucide-react";
import type { AiWorkspace } from "./workspacesApi";
import { WorkspaceCard } from "./WorkspaceCard";
import { WorkspaceEmptyState } from "./WorkspaceEmptyState";

export interface WorkspaceSidebarProps {
  workspaces: AiWorkspace[];
  isLoading: boolean;
  activeWorkspaceId: number | null;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onCreateWorkspace: (input: { name: string; description?: string }) => unknown;
  onSelectWorkspace: (id: number) => void;
  /** Clears the active workspace selection — returns to the top-level,
   * un-grouped conversation list. */
  onClearSelection: () => void;
  onTogglePin?: (id: number, pinned: boolean) => void;
  onToggleArchive?: (id: number, archived: boolean) => void;
  onDeleteWorkspace?: (id: number) => void;
  conversationCounts?: Record<number, number>;
  testId?: string;
}

export function WorkspaceSidebar({
  workspaces,
  isLoading,
  activeWorkspaceId,
  searchTerm,
  onSearchChange,
  onCreateWorkspace,
  onSelectWorkspace,
  onClearSelection,
  onTogglePin,
  onToggleArchive,
  onDeleteWorkspace,
  conversationCounts,
  testId = "workspace-sidebar",
}: WorkspaceSidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");

  async function submitCreate() {
    const name = draftName.trim();
    if (name.length === 0) return;
    await onCreateWorkspace({ name, description: draftDescription.trim() || undefined });
    setDraftName("");
    setDraftDescription("");
    setIsCreating(false);
  }

  return (
    <div className="flex w-64 shrink-0 flex-col gap-2 border-r border-border pr-3" data-testid={testId}>
      {isCreating ? (
        <div className="space-y-1.5 rounded-md border border-border/60 p-2" data-testid={`${testId}-create-form`}>
          <Input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Workspace name"
            className="h-8 text-xs"
            data-testid={`${testId}-create-name`}
          />
          <Textarea
            value={draftDescription}
            onChange={(e) => setDraftDescription(e.target.value)}
            placeholder="Description (optional)"
            className="min-h-14 text-xs"
            data-testid={`${testId}-create-description`}
          />
          <div className="flex gap-1.5">
            <Button type="button" size="sm" className="h-7 flex-1 text-xs" onClick={submitCreate} data-testid={`${testId}-create-save`}>
              Create
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => {
                setIsCreating(false);
                setDraftName("");
                setDraftDescription("");
              }}
              data-testid={`${testId}-create-cancel`}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-start gap-1.5"
          onClick={() => setIsCreating(true)}
          data-testid={`${testId}-new-workspace`}
        >
          <Plus className="h-3.5 w-3.5" />
          New Workspace
        </Button>
      )}

      <button
        type="button"
        className={`rounded-md px-2 py-1 text-left text-xs ${
          activeWorkspaceId === null ? "bg-indigo-500/10 font-medium text-indigo-300" : "text-muted-foreground hover:bg-muted/50"
        }`}
        onClick={onClearSelection}
        data-testid={`${testId}-all-conversations`}
      >
        All conversations
      </button>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search workspaces"
          className="h-8 pl-7 text-xs"
          data-testid={`${testId}-search`}
        />
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto" data-testid={`${testId}-list`}>
        {isLoading && (
          <p className="px-1 py-2 text-xs text-muted-foreground" data-testid={`${testId}-loading`}>
            Loading workspaces…
          </p>
        )}

        {!isLoading && workspaces.length === 0 && (
          <WorkspaceEmptyState
            title="No workspaces yet"
            description="Group your conversations, research, and notes into a reusable project."
            actionLabel="Create your first workspace"
            onAction={() => setIsCreating(true)}
            testId={`${testId}-empty`}
          />
        )}

        {!isLoading &&
          workspaces.map((workspace) => (
            <WorkspaceCard
              key={workspace.id}
              workspace={workspace}
              isActive={workspace.id === activeWorkspaceId}
              conversationCount={conversationCounts?.[workspace.id]}
              onSelect={onSelectWorkspace}
              onTogglePin={onTogglePin}
              onToggleArchive={onToggleArchive}
              onDelete={onDeleteWorkspace}
              testId={`${testId}-card-${workspace.id}`}
            />
          ))}
      </div>
    </div>
  );
}
