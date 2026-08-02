// v1.5.0 Sprint 9 — AI Strategy Builder. A thin, strategy-flavoured
// wrapper over Sprint 7's own WorkspaceEmptyState, per the approved
// scope's own "reuse Workspace and Notebook components wherever possible"
// instruction — this file adds no new presentational logic of its own, it
// only supplies strategy-specific copy/icon text to the already-generic,
// already-tested empty-state component (the same pattern
// NotebookEmptyState.tsx already established in Sprint 8).

import { WorkspaceEmptyState } from "./WorkspaceEmptyState";

export interface StrategyEmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  testId?: string;
}

export function StrategyEmptyState({
  title = "No strategies yet",
  description = "Build a reusable, structured playbook you can refine and reuse across every trade or thesis.",
  actionLabel,
  onAction,
  testId = "strategy-empty-state",
}: StrategyEmptyStateProps) {
  return <WorkspaceEmptyState title={title} description={description} actionLabel={actionLabel} onAction={onAction} testId={testId} />;
}
