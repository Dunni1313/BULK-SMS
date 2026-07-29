// v1.5.0 Sprint 8 — AI Research Notebooks. A thin, notebook-flavoured
// wrapper over Sprint 7's own WorkspaceEmptyState, per the approved scope's
// own "reuse existing Workspace... components where appropriate"
// instruction — this file adds no new presentational logic of its own, it
// only supplies notebook-specific copy/icon text to the already-generic,
// already-tested empty-state component.

import { WorkspaceEmptyState } from "./WorkspaceEmptyState";

export interface NotebookEmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  testId?: string;
}

export function NotebookEmptyState({
  title = "No notebooks yet",
  description = "Collect, organise, and refine your AI research in one place.",
  actionLabel,
  onAction,
  testId = "notebook-empty-state",
}: NotebookEmptyStateProps) {
  return <WorkspaceEmptyState title={title} description={description} actionLabel={actionLabel} onAction={onAction} testId={testId} />;
}
