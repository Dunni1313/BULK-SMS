// v1.5.0 Sprint 9 — AI Strategy Builder. Pure list-rendering component —
// loading state, honest empty state, or a list of StrategyCards — kept
// separate from StrategySidebar (which additionally owns search/create-
// form/filter state), mirroring NotebookList.tsx's own established shape
// (Sprint 8) so any future strategy-browsing surface can reuse just the
// list-rendering logic without depending on the sidebar's own plumbing.

import type { AiStrategy } from "./strategiesApi";
import { StrategyCard } from "./StrategyCard";
import { StrategyEmptyState } from "./StrategyEmptyState";

export interface StrategyListProps {
  strategies: AiStrategy[];
  isLoading: boolean;
  activeStrategyId: number | null;
  onSelectStrategy: (id: number) => void;
  onTogglePin?: (id: number, pinned: boolean) => void;
  onToggleArchive?: (id: number, archived: boolean) => void;
  onDeleteStrategy?: (id: number) => void;
  onCreateFirst?: () => void;
  testId?: string;
}

export function StrategyList({
  strategies,
  isLoading,
  activeStrategyId,
  onSelectStrategy,
  onTogglePin,
  onToggleArchive,
  onDeleteStrategy,
  onCreateFirst,
  testId = "strategy-list",
}: StrategyListProps) {
  if (isLoading) {
    return (
      <p className="px-1 py-2 text-xs text-muted-foreground" data-testid={`${testId}-loading`}>
        Loading strategies…
      </p>
    );
  }

  if (strategies.length === 0) {
    return (
      <StrategyEmptyState
        actionLabel={onCreateFirst ? "Create your first strategy" : undefined}
        onAction={onCreateFirst}
        testId={`${testId}-empty`}
      />
    );
  }

  return (
    <div className="space-y-1.5" data-testid={testId}>
      {strategies.map((strategy) => (
        <StrategyCard
          key={strategy.id}
          strategy={strategy}
          isActive={strategy.id === activeStrategyId}
          onSelect={onSelectStrategy}
          onTogglePin={onTogglePin}
          onToggleArchive={onToggleArchive}
          onDelete={onDeleteStrategy}
          testId={`${testId}-card-${strategy.id}`}
        />
      ))}
    </div>
  );
}
