// v1.5.0 Sprint 7 — AI Workspaces. A single workspace's summary card —
// name, description, tags, pin/archive state — with pin/archive/delete
// quick actions. Reused by WorkspaceSidebar's own list; kept as its own
// component (not inlined) so any future workspace-browsing surface (e.g. a
// dedicated "all my workspaces" grid) can reuse the exact same card without
// depending on WorkspaceSidebar's own search/list-state plumbing.

import { Pin, Archive, Trash2, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { AiWorkspace } from "./workspacesApi";

export interface WorkspaceCardProps {
  workspace: AiWorkspace;
  isActive?: boolean;
  conversationCount?: number;
  onSelect: (id: number) => void;
  onTogglePin?: (id: number, pinned: boolean) => void;
  onToggleArchive?: (id: number, archived: boolean) => void;
  onDelete?: (id: number) => void;
  testId?: string;
}

export function WorkspaceCard({
  workspace,
  isActive = false,
  conversationCount,
  onSelect,
  onTogglePin,
  onToggleArchive,
  onDelete,
  testId = `workspace-card-${workspace.id}`,
}: WorkspaceCardProps) {
  return (
    <div
      className={`group rounded-md border px-3 py-2 transition-colors ${
        isActive ? "border-indigo-500/50 bg-indigo-500/10" : "border-border/60 hover:border-border"
      }`}
      data-testid={testId}
      data-active={isActive ? "true" : "false"}
    >
      <div className="flex items-start justify-between gap-2">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(workspace.id)} data-testid={`${testId}-select`}>
          <div className="flex items-center gap-1.5">
            {workspace.pinned && <Pin className="h-3 w-3 shrink-0 text-amber-400" data-testid={`${testId}-pinned-icon`} />}
            <span className="truncate text-sm font-medium text-foreground/90">{workspace.name}</span>
            {workspace.archived && (
              <span className="shrink-0 rounded bg-muted px-1 text-[9px] uppercase text-muted-foreground" data-testid={`${testId}-archived-badge`}>
                Archived
              </span>
            )}
          </div>
          {workspace.description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{workspace.description}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {workspace.tags.map((tag) => (
              <span key={tag} className="rounded bg-muted/70 px-1.5 py-0.5 text-[9px] text-muted-foreground" data-testid={`${testId}-tag-${tag}`}>
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
            {typeof conversationCount === "number" && (
              <span className="flex items-center gap-0.5" data-testid={`${testId}-conversation-count`}>
                <MessageSquare className="h-2.5 w-2.5" />
                {conversationCount}
              </span>
            )}
            <span>{formatDistanceToNow(new Date(workspace.updatedAt), { addSuffix: true })}</span>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
          {onTogglePin && (
            <button
              type="button"
              onClick={() => onTogglePin(workspace.id, !workspace.pinned)}
              aria-label={workspace.pinned ? "Unpin workspace" : "Pin workspace"}
              data-testid={`${testId}-pin-toggle`}
            >
              <Pin className={`h-3 w-3 ${workspace.pinned ? "text-amber-400" : "text-muted-foreground hover:text-foreground"}`} />
            </button>
          )}
          {onToggleArchive && (
            <button
              type="button"
              onClick={() => onToggleArchive(workspace.id, !workspace.archived)}
              aria-label={workspace.archived ? "Unarchive workspace" : "Archive workspace"}
              data-testid={`${testId}-archive-toggle`}
            >
              <Archive className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={() => onDelete(workspace.id)} aria-label="Delete workspace" data-testid={`${testId}-delete`}>
              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
