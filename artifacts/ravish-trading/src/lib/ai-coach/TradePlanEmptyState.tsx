// v1.5.0 Sprint 10 — Institutional Trade Planner. A thin, trade-plan-
// flavoured wrapper over Sprint 7's own WorkspaceEmptyState, per the
// approved scope's own "reuse existing architecture" instruction — this
// file adds no new presentational logic of its own, mirroring
// StrategyEmptyState.tsx's own established shape (Sprint 9).

import { WorkspaceEmptyState } from "./WorkspaceEmptyState";

export interface TradePlanEmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  testId?: string;
}

export function TradePlanEmptyState({
  title = "No trade plans yet",
  description = "Prepare a trade fully — thesis, entry, stop, targets, and a readiness checklist — before you ever consider acting on it.",
  actionLabel,
  onAction,
  testId = "trade-plan-empty-state",
}: TradePlanEmptyStateProps) {
  return <WorkspaceEmptyState title={title} description={description} actionLabel={actionLabel} onAction={onAction} testId={testId} />;
}
