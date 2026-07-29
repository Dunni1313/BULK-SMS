// v1.5.0 Sprint 9 — AI Strategy Builder. Shown above the strategy editor
// once a strategy is active: title/description/strategy type/asset
// class/folder/status (inline-editable), tags, pin/archive/delete
// actions, and a version badge that opens version history — mirroring
// NotebookHeader.tsx's own established shape (Sprint 8).

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pin, Archive, Trash2, Pencil, Check, X, History } from "lucide-react";
import type { AiStrategyDetail, StrategyStatus } from "./strategiesApi";
import { STRATEGY_STATUSES } from "./strategiesApi";

const STATUS_LABELS: Record<StrategyStatus, string> = {
  draft: "Draft",
  active: "Active",
  retired: "Retired",
};

export interface StrategyHeaderProps {
  strategy: AiStrategyDetail;
  onUpdate: (input: {
    title?: string;
    description?: string;
    strategyType?: string;
    assetClass?: string;
    folder?: string;
    status?: StrategyStatus;
  }) => void | Promise<void>;
  onTogglePin: (pinned: boolean) => void;
  onToggleArchive: (archived: boolean) => void;
  onDelete: () => void;
  onOpenVersionHistory?: () => void;
  testId?: string;
}

export function StrategyHeader({
  strategy,
  onUpdate,
  onTogglePin,
  onToggleArchive,
  onDelete,
  onOpenVersionHistory,
  testId = "strategy-header",
}: StrategyHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(strategy.title);
  const [draftDescription, setDraftDescription] = useState(strategy.description ?? "");
  const [draftStrategyType, setDraftStrategyType] = useState(strategy.strategyType);
  const [draftAssetClass, setDraftAssetClass] = useState(strategy.assetClass ?? "");
  const [draftFolder, setDraftFolder] = useState(strategy.folder ?? "");
  const [draftStatus, setDraftStatus] = useState<StrategyStatus>(strategy.status);

  function beginEdit() {
    setDraftTitle(strategy.title);
    setDraftDescription(strategy.description ?? "");
    setDraftStrategyType(strategy.strategyType);
    setDraftAssetClass(strategy.assetClass ?? "");
    setDraftFolder(strategy.folder ?? "");
    setDraftStatus(strategy.status);
    setIsEditing(true);
  }

  async function submitEdit() {
    const title = draftTitle.trim();
    const strategyType = draftStrategyType.trim();
    if (title.length === 0 || strategyType.length === 0) return;
    await onUpdate({
      title,
      description: draftDescription.trim() || undefined,
      strategyType,
      assetClass: draftAssetClass.trim() || undefined,
      folder: draftFolder.trim() || undefined,
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
              <Textarea
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                placeholder="Description (optional)"
                className="min-h-14 text-xs"
                data-testid={`${testId}-edit-description`}
              />
              <div className="flex gap-1.5">
                <Input
                  value={draftStrategyType}
                  onChange={(e) => setDraftStrategyType(e.target.value)}
                  placeholder="Strategy type"
                  className="h-8 flex-1 text-xs"
                  data-testid={`${testId}-edit-strategy-type`}
                />
                <Input
                  value={draftAssetClass}
                  onChange={(e) => setDraftAssetClass(e.target.value)}
                  placeholder="Asset class"
                  className="h-8 flex-1 text-xs"
                  data-testid={`${testId}-edit-asset-class`}
                />
              </div>
              <div className="flex gap-1.5">
                <Input
                  value={draftFolder}
                  onChange={(e) => setDraftFolder(e.target.value)}
                  placeholder="Folder"
                  className="h-8 flex-1 text-xs"
                  data-testid={`${testId}-edit-folder`}
                />
                <Select value={draftStatus} onValueChange={(v) => setDraftStatus(v as StrategyStatus)}>
                  <SelectTrigger className="h-8 w-28 text-xs" data-testid={`${testId}-edit-status`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STRATEGY_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
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
                  {strategy.title}
                </span>
                <span className="shrink-0 rounded bg-muted px-1 text-[9px] uppercase text-muted-foreground" data-testid={`${testId}-status-badge`}>
                  {STATUS_LABELS[strategy.status]}
                </span>
                {strategy.archived && <span className="rounded bg-muted px-1 text-[9px] uppercase text-muted-foreground">Archived</span>}
                <button type="button" onClick={beginEdit} aria-label="Edit strategy" data-testid={`${testId}-edit-toggle`}>
                  <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
              {strategy.description && (
                <p className="mt-0.5 text-xs text-muted-foreground" data-testid={`${testId}-description`}>
                  {strategy.description}
                </p>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground" data-testid={`${testId}-meta`}>
                {strategy.strategyType}
                {strategy.assetClass ? ` · ${strategy.assetClass}` : ""}
                {strategy.folder ? ` · ${strategy.folder}` : ""}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {strategy.tags.map((tag) => (
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
                <span>v{strategy.currentVersion}</span>
                <span>· Updated {formatDistanceToNow(new Date(strategy.updatedAt), { addSuffix: true })}</span>
                <span>
                  · {strategy.sections.length} section{strategy.sections.length === 1 ? "" : "s"}
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
            onClick={() => onTogglePin(!strategy.pinned)}
            aria-label={strategy.pinned ? "Unpin strategy" : "Favourite strategy"}
            data-testid={`${testId}-pin-toggle`}
          >
            <Pin className={`h-3.5 w-3.5 ${strategy.pinned ? "text-amber-400" : "text-muted-foreground"}`} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onToggleArchive(!strategy.archived)}
            aria-label={strategy.archived ? "Restore strategy" : "Archive strategy"}
            data-testid={`${testId}-archive-toggle`}
          >
            <Archive className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete} aria-label="Delete strategy" data-testid={`${testId}-delete`}>
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}
