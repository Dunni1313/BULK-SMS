// v1.5.0 Sprint 7 — AI Workspaces. A small, reusable empty state shown
// wherever a workspace-scoped list has nothing to show yet — no
// workspaces at all for this coach (WorkspaceSidebar), or (via the same
// component, a different message) a workspace with no conversations yet.
// Kept intentionally tiny and presentational — no data fetching, no
// workspace-specific logic — so any future workspace-adjacent surface can
// reuse it for its own honest "nothing here yet" moment.

import { FolderPlus } from "lucide-react";

export interface WorkspaceEmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  testId?: string;
}

export function WorkspaceEmptyState({
  title,
  description,
  actionLabel,
  onAction,
  testId = "workspace-empty-state",
}: WorkspaceEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border/60 px-4 py-6 text-center" data-testid={testId}>
      <FolderPlus className="h-6 w-6 text-muted-foreground/60" />
      <p className="text-sm font-medium text-foreground/80">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-1 text-xs font-medium text-indigo-400 hover:text-indigo-300"
          data-testid={`${testId}-action`}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
