// v1.5.0 Sprint 10 — Institutional Trade Planner. A single trade plan's
// summary card — title, planned asset, direction, status (via the shared
// TradePlanStatusBadge), asset class, tags, pinned state, version — with
// pin/delete quick actions, mirroring StrategyCard.tsx's own established
// shape (Sprint 9) so the two card families feel consistent. Reused by
// TradePlanList's own rendering.

import { Pin, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { TradePlan } from "./tradePlansApi";
import { TradePlanStatusBadge } from "./TradePlanStatusBadge";

export interface TradePlanCardProps {
  plan: TradePlan;
  isActive?: boolean;
  onSelect: (id: number) => void;
  onTogglePin?: (id: number, pinned: boolean) => void;
  onDelete?: (id: number) => void;
  testId?: string;
}

export function TradePlanCard({ plan, isActive = false, onSelect, onTogglePin, onDelete, testId = `trade-plan-card-${plan.id}` }: TradePlanCardProps) {
  return (
    <div
      className={`group rounded-md border px-3 py-2 transition-colors ${
        isActive ? "border-indigo-500/50 bg-indigo-500/10" : "border-border/60 hover:border-border"
      }`}
      data-testid={testId}
      data-active={isActive ? "true" : "false"}
    >
      <div className="flex items-start justify-between gap-2">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(plan.id)} data-testid={`${testId}-select`}>
          <div className="flex items-center gap-1.5">
            {plan.pinned && <Pin className="h-3 w-3 shrink-0 text-amber-400" data-testid={`${testId}-pinned-icon`} />}
            <span className="truncate text-sm font-medium text-foreground/90">{plan.title}</span>
            <TradePlanStatusBadge status={plan.status} testId={`${testId}-status-badge`} />
          </div>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            {plan.direction === "long" && <ArrowUp className="h-3 w-3 shrink-0 text-emerald-400" />}
            {plan.direction === "short" && <ArrowDown className="h-3 w-3 shrink-0 text-rose-400" />}
            {plan.plannedAsset ?? "No asset set"}
            {plan.assetClass ? ` · ${plan.assetClass}` : ""}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {plan.tags.map((tag) => (
              <span key={tag} className="rounded bg-muted/70 px-1.5 py-0.5 text-[9px] text-muted-foreground" data-testid={`${testId}-tag-${tag}`}>
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span data-testid={`${testId}-version`}>v{plan.currentVersion}</span>
            <span>{formatDistanceToNow(new Date(plan.updatedAt), { addSuffix: true })}</span>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
          {onTogglePin && (
            <button
              type="button"
              onClick={() => onTogglePin(plan.id, !plan.pinned)}
              aria-label={plan.pinned ? "Unpin trade plan" : "Pin trade plan"}
              data-testid={`${testId}-pin-toggle`}
            >
              <Pin className={`h-3 w-3 ${plan.pinned ? "text-amber-400" : "text-muted-foreground hover:text-foreground"}`} />
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={() => onDelete(plan.id)} aria-label="Delete trade plan" data-testid={`${testId}-delete`}>
              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
