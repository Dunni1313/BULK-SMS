// v1.5.0 Sprint 9 — AI Strategy Builder. A single strategy's summary
// card — title, strategy type, status, asset class/folder, tags,
// pinned/archived state, version — with pin/archive/delete quick actions,
// mirroring NotebookCard.tsx's own established shape (Sprint 8) so the
// two card families feel consistent. Reused by StrategyList's own
// rendering; kept as its own component so any future strategy-browsing
// surface (e.g. a cross-workspace "all strategies" grid) can reuse the
// exact same card.

import { Pin, Archive, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { AiStrategy, StrategyStatus } from "./strategiesApi";

const STATUS_LABELS: Record<StrategyStatus, string> = {
  draft: "Draft",
  active: "Active",
  retired: "Retired",
};

const STATUS_CLASSES: Record<StrategyStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-emerald-500/10 text-emerald-400",
  retired: "bg-slate-500/10 text-slate-400",
};

export interface StrategyCardProps {
  strategy: AiStrategy;
  isActive?: boolean;
  onSelect: (id: number) => void;
  onTogglePin?: (id: number, pinned: boolean) => void;
  onToggleArchive?: (id: number, archived: boolean) => void;
  onDelete?: (id: number) => void;
  testId?: string;
}

export function StrategyCard({
  strategy,
  isActive = false,
  onSelect,
  onTogglePin,
  onToggleArchive,
  onDelete,
  testId = `strategy-card-${strategy.id}`,
}: StrategyCardProps) {
  return (
    <div
      className={`group rounded-md border px-3 py-2 transition-colors ${
        isActive ? "border-indigo-500/50 bg-indigo-500/10" : "border-border/60 hover:border-border"
      }`}
      data-testid={testId}
      data-active={isActive ? "true" : "false"}
    >
      <div className="flex items-start justify-between gap-2">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(strategy.id)} data-testid={`${testId}-select`}>
          <div className="flex items-center gap-1.5">
            {strategy.pinned && <Pin className="h-3 w-3 shrink-0 text-amber-400" data-testid={`${testId}-pinned-icon`} />}
            <span className="truncate text-sm font-medium text-foreground/90">{strategy.title}</span>
            <span className={`shrink-0 rounded px-1 text-[9px] uppercase ${STATUS_CLASSES[strategy.status]}`} data-testid={`${testId}-status-badge`}>
              {STATUS_LABELS[strategy.status]}
            </span>
            {strategy.archived && (
              <span className="shrink-0 rounded bg-muted px-1 text-[9px] uppercase text-muted-foreground" data-testid={`${testId}-archived-badge`}>
                Archived
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {strategy.strategyType}
            {strategy.assetClass ? ` · ${strategy.assetClass}` : ""}
            {strategy.folder ? ` · ${strategy.folder}` : ""}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {strategy.tags.map((tag) => (
              <span key={tag} className="rounded bg-muted/70 px-1.5 py-0.5 text-[9px] text-muted-foreground" data-testid={`${testId}-tag-${tag}`}>
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span data-testid={`${testId}-version`}>v{strategy.currentVersion}</span>
            <span>{formatDistanceToNow(new Date(strategy.updatedAt), { addSuffix: true })}</span>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
          {onTogglePin && (
            <button
              type="button"
              onClick={() => onTogglePin(strategy.id, !strategy.pinned)}
              aria-label={strategy.pinned ? "Unpin strategy" : "Favourite strategy"}
              data-testid={`${testId}-pin-toggle`}
            >
              <Pin className={`h-3 w-3 ${strategy.pinned ? "text-amber-400" : "text-muted-foreground hover:text-foreground"}`} />
            </button>
          )}
          {onToggleArchive && (
            <button
              type="button"
              onClick={() => onToggleArchive(strategy.id, !strategy.archived)}
              aria-label={strategy.archived ? "Restore strategy" : "Archive strategy"}
              data-testid={`${testId}-archive-toggle`}
            >
              <Archive className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={() => onDelete(strategy.id)} aria-label="Delete strategy" data-testid={`${testId}-delete`}>
              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
