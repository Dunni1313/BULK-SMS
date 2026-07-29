// v1.5.0 Sprint 10 — Institutional Trade Planner. A small, standalone
// status badge — the approved scope names "TradePlanStatusBadge" as its
// own reusable component (unlike Strategy Builder's Sprint 9 precedent,
// which inlined its own status-badge rendering directly into
// StrategyCard/StrategyHeader) — so every surface showing a Trade Plan's
// lifecycle status (card, header, list row) renders it identically.

import type { TradePlanStatus } from "./tradePlansApi";

export const TRADE_PLAN_STATUS_LABELS: Record<TradePlanStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  watching: "Watching",
  executed: "Executed",
  cancelled: "Cancelled",
  archived: "Archived",
};

export const TRADE_PLAN_STATUS_CLASSES: Record<TradePlanStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  ready: "bg-sky-500/10 text-sky-400",
  watching: "bg-amber-500/10 text-amber-400",
  executed: "bg-emerald-500/10 text-emerald-400",
  cancelled: "bg-rose-500/10 text-rose-400",
  archived: "bg-slate-500/10 text-slate-400",
};

export interface TradePlanStatusBadgeProps {
  status: TradePlanStatus;
  testId?: string;
}

export function TradePlanStatusBadge({ status, testId = "trade-plan-status-badge" }: TradePlanStatusBadgeProps) {
  return (
    <span className={`shrink-0 rounded px-1 text-[9px] uppercase ${TRADE_PLAN_STATUS_CLASSES[status]}`} data-testid={testId}>
      {TRADE_PLAN_STATUS_LABELS[status]}
    </span>
  );
}
