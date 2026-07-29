// v1.5.0 Sprint 10 — Institutional Trade Planner. Shown above the trade
// plan editor once a plan is active: title/planned asset/asset
// class/direction/status (inline-editable) via the shared
// TradePlanStatusBadge, tags, pin/delete actions, and a version badge
// that opens version history — mirroring StrategyHeader.tsx's own
// established shape (Sprint 9).

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pin, Trash2, Pencil, Check, X, History } from "lucide-react";
import type { TradePlanDetail, TradePlanStatus, TradePlanDirection } from "./tradePlansApi";
import { TRADE_PLAN_STATUSES, TRADE_PLAN_DIRECTIONS } from "./tradePlansApi";
import { TRADE_PLAN_STATUS_LABELS, TradePlanStatusBadge } from "./TradePlanStatusBadge";

export interface TradePlanHeaderProps {
  plan: TradePlanDetail;
  onUpdate: (input: {
    title?: string;
    plannedAsset?: string;
    assetClass?: string;
    direction?: TradePlanDirection;
    status?: TradePlanStatus;
  }) => void | Promise<void>;
  onTogglePin: (pinned: boolean) => void;
  onDelete: () => void;
  onOpenVersionHistory?: () => void;
  testId?: string;
}

export function TradePlanHeader({ plan, onUpdate, onTogglePin, onDelete, onOpenVersionHistory, testId = "trade-plan-header" }: TradePlanHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(plan.title);
  const [draftAsset, setDraftAsset] = useState(plan.plannedAsset ?? "");
  const [draftAssetClass, setDraftAssetClass] = useState(plan.assetClass ?? "");
  const [draftDirection, setDraftDirection] = useState<TradePlanDirection | "">(plan.direction ?? "");
  const [draftStatus, setDraftStatus] = useState<TradePlanStatus>(plan.status);

  function beginEdit() {
    setDraftTitle(plan.title);
    setDraftAsset(plan.plannedAsset ?? "");
    setDraftAssetClass(plan.assetClass ?? "");
    setDraftDirection(plan.direction ?? "");
    setDraftStatus(plan.status);
    setIsEditing(true);
  }

  async function submitEdit() {
    const title = draftTitle.trim();
    if (title.length === 0) return;
    await onUpdate({
      title,
      plannedAsset: draftAsset.trim() || undefined,
      assetClass: draftAssetClass.trim() || undefined,
      ...(draftDirection ? { direction: draftDirection } : {}),
      status: draftStatus,
    });
    setIsEditing(false);
  }

  return (
    <div className="mb-2 rounded-md border border-border/60 bg-card/50" data-testid={testId}>
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <div className="space-y-1.5" data-testid={`${testId}-edit-form`}>
              <Input
                autoFocus
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="h-8 text-sm font-semibold"
                data-testid={`${testId}-edit-title`}
              />
              <div className="flex gap-1.5">
                <Input
                  value={draftAsset}
                  onChange={(e) => setDraftAsset(e.target.value)}
                  placeholder="Planned asset"
                  className="h-8 flex-1 text-xs"
                  data-testid={`${testId}-edit-asset`}
                />
                <Select value={draftDirection || "__none__"} onValueChange={(v) => setDraftDirection(v === "__none__" ? "" : (v as TradePlanDirection))}>
                  <SelectTrigger className="h-8 w-24 text-xs" data-testid={`${testId}-edit-direction`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unset</SelectItem>
                    {TRADE_PLAN_DIRECTIONS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d === "long" ? "Long" : "Short"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-1.5">
                <Input
                  value={draftAssetClass}
                  onChange={(e) => setDraftAssetClass(e.target.value)}
                  placeholder="Asset class"
                  className="h-8 flex-1 text-xs"
                  data-testid={`${testId}-edit-asset-class`}
                />
                <Select value={draftStatus} onValueChange={(v) => setDraftStatus(v as TradePlanStatus)}>
                  <SelectTrigger className="h-8 w-28 text-xs" data-testid={`${testId}-edit-status`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRADE_PLAN_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {TRADE_PLAN_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-1.5">
                <Button type="button" size="sm" className="h-7 text-xs" onClick={submitEdit} data-testid={`${testId}-edit-save`}>
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Save
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setIsEditing(false)}
                  data-testid={`${testId}-edit-cancel`}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-foreground" data-testid={`${testId}-title`}>
                  {plan.title}
                </span>
                <TradePlanStatusBadge status={plan.status} testId={`${testId}-status-badge`} />
                <button type="button" onClick={beginEdit} aria-label="Edit trade plan" data-testid={`${testId}-edit-toggle`}>
                  <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground" data-testid={`${testId}-meta`}>
                {plan.plannedAsset ?? "No asset set"}
                {plan.direction ? ` · ${plan.direction === "long" ? "Long" : "Short"}` : ""}
                {plan.assetClass ? ` · ${plan.assetClass}` : ""}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {plan.tags.map((tag) => (
                  <span key={tag} className="rounded bg-muted/70 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
              <button
                type="button"
                className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={onOpenVersionHistory}
                disabled={!onOpenVersionHistory}
                data-testid={`${testId}-version`}
              >
                <History className="h-2.5 w-2.5" />
                <span>v{plan.currentVersion}</span>
                <span>· Updated {formatDistanceToNow(new Date(plan.updatedAt), { addSuffix: true })}</span>
                <span>
                  · {plan.sections.length} section{plan.sections.length === 1 ? "" : "s"}
                </span>
              </button>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onTogglePin(!plan.pinned)}
            aria-label={plan.pinned ? "Unpin trade plan" : "Pin trade plan"}
            data-testid={`${testId}-pin-toggle`}
          >
            <Pin className={`h-3.5 w-3.5 ${plan.pinned ? "text-amber-400" : "text-muted-foreground"}`} />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete} aria-label="Delete trade plan" data-testid={`${testId}-delete`}>
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}
