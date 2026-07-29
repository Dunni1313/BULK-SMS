// v1.5.0 Sprint 8 — AI Research Notebooks. Pure list-rendering component —
// loading state, honest empty state, or a list of NotebookCards — kept
// separate from NotebookSidebar (which additionally owns search/create-form
// state) so any future notebook-browsing surface (e.g. a "notebooks across
// all workspaces" grid) can reuse just the list-rendering logic without
// depending on the sidebar's own search/create plumbing.

import type { AiNotebook } from "./notebooksApi";
import { NotebookCard } from "./NotebookCard";
import { NotebookEmptyState } from "./NotebookEmptyState";

export interface NotebookListProps {
  notebooks: AiNotebook[];
  isLoading: boolean;
  activeNotebookId: number | null;
  onSelectNotebook: (id: number) => void;
  onTogglePin?: (id: number, pinned: boolean) => void;
  onToggleArchive?: (id: number, archived: boolean) => void;
  onDeleteNotebook?: (id: number) => void;
  noteCounts?: Record<number, number>;
  onCreateFirst?: () => void;
  testId?: string;
}

export function NotebookList({
  notebooks,
  isLoading,
  activeNotebookId,
  onSelectNotebook,
  onTogglePin,
  onToggleArchive,
  onDeleteNotebook,
  noteCounts,
  onCreateFirst,
  testId = "notebook-list",
}: NotebookListProps) {
  if (isLoading) {
    return (
      <p className="px-1 py-2 text-xs text-muted-foreground" data-testid={`${testId}-loading`}>
        Loading notebooks…
      </p>
    );
  }

  if (notebooks.length === 0) {
    return (
      <NotebookEmptyState
        actionLabel={onCreateFirst ? "Create your first notebook" : undefined}
        onAction={onCreateFirst}
        testId={`${testId}-empty`}
      />
    );
  }

  return (
    <div className="space-y-1.5" data-testid={testId}>
      {notebooks.map((notebook) => (
        <NotebookCard
          key={notebook.id}
          notebook={notebook}
          isActive={notebook.id === activeNotebookId}
          noteCount={noteCounts?.[notebook.id]}
          onSelect={onSelectNotebook}
          onTogglePin={onTogglePin}
          onToggleArchive={onToggleArchive}
          onDelete={onDeleteNotebook}
          testId={`${testId}-card-${notebook.id}`}
        />
      ))}
    </div>
  );
}
