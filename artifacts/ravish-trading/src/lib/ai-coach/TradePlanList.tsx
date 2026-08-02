// v1.5.0 Sprint 10 — Institutional Trade Planner. Pure list-rendering
// component — loading state, honest empty state, or a list of
// TradePlanCards — kept separate from TradePlannerSidebar (which
// additionally owns search/create-form/filter state), mirroring
// StrategyList.tsx's own established shape (Sprint 9).

import type { TradePlan } from "./tradePlansApi";
import { TradePlanCard } from "./TradePlanCard";
import { TradePlanEmptyState } from "./TradePlanEmptyState";

export interface TradePlanListProps {
  plans: TradePlan[];
  isLoading: boolean;
  activePlanId: number | null;
  onSelectPlan: (id: number) => void;
  onTogglePin?: (id: number, pinned: boolean) => void;
  onDeletePlan?: (id: number) => void;
  onCreateFirst?: () => void;
  testId?: string;
}

export function TradePlanList({
  plans,
  isLoading,
  activePlanId,
  onSelectPlan,
  onTogglePin,
  onDeletePlan,
  onCreateFirst,
  testId = "trade-plan-list",
}: TradePlanListProps) {
  if (isLoading) {
    return (
      <p className="px-1 py-2 text-xs text-muted-foreground" data-testid={`${testId}-loading`}>
        Loading trade plans…
      </p>
    );
  }

  if (plans.length === 0) {
    return (
      <TradePlanEmptyState
        actionLabel={onCreateFirst ? "Create your first trade plan" : undefined}
        onAction={onCreateFirst}
        testId={`${testId}-empty`}
      />
    );
  }

  return (
    <div className="space-y-1.5" data-testid={testId}>
      {plans.map((plan) => (
        <TradePlanCard
          key={plan.id}
          plan={plan}
          isActive={plan.id === activePlanId}
          onSelect={onSelectPlan}
          onTogglePin={onTogglePin}
          onDelete={onDeletePlan}
          testId={`${testId}-card-${plan.id}`}
        />
      ))}
    </div>
  );
}
