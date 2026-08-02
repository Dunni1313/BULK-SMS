// v1.5.0 Sprint 10 — Institutional Trade Planner. A reusable trade-plan
// library sidebar — New Trade Plan (inline create form: title + planned
// asset + direction + optional asset class), search, status filter, an
// "include archived" toggle, and TradePlanList's own list rendering —
// mirroring StrategySidebar.tsx's own established shape (Sprint 9) so the
// four sidebars (workspace/notebook/strategy/trade plan) feel like the
// same family of component. Every specialist coach page
// (Trading/Investing/Options) can mount this exact same component;
// nothing here is coach-specific.

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, X } from "lucide-react";
import type { TradePlanStatus, TradePlanDirection } from "./tradePlansApi";
import { TRADE_PLAN_STATUSES, TRADE_PLAN_DIRECTIONS } from "./tradePlansApi";
import { TRADE_PLAN_STATUS_LABELS } from "./TradePlanStatusBadge";
import { TradePlanList } from "./TradePlanList";
import type { TradePlan } from "./tradePlansApi";

export interface TradePlannerSidebarProps {
  plans: TradePlan[];
  isLoading: boolean;
  activePlanId: number | null;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: TradePlanStatus | null;
  onStatusFilterChange: (value: TradePlanStatus | null) => void;
  includeArchived: boolean;
  onIncludeArchivedChange: (value: boolean) => void;
  onCreatePlan: (input: { title: string; plannedAsset?: string; assetClass?: string; direction?: TradePlanDirection }) => unknown;
  onSelectPlan: (id: number) => void;
  onClearSelection: () => void;
  onTogglePin?: (id: number, pinned: boolean) => void;
  onDeletePlan?: (id: number) => void;
  testId?: string;
}

export function TradePlannerSidebar({
  plans,
  isLoading,
  activePlanId,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  includeArchived,
  onIncludeArchivedChange,
  onCreatePlan,
  onSelectPlan,
  onClearSelection,
  onTogglePin,
  onDeletePlan,
  testId = "trade-planner-sidebar",
}: TradePlannerSidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftAsset, setDraftAsset] = useState("");
  const [draftAssetClass, setDraftAssetClass] = useState("");
  const [draftDirection, setDraftDirection] = useState<TradePlanDirection | "">("");

  async function submitCreate() {
    const title = draftTitle.trim();
    if (title.length === 0) return;
    await onCreatePlan({
      title,
      ...(draftAsset.trim() ? { plannedAsset: draftAsset.trim() } : {}),
      ...(draftAssetClass.trim() ? { assetClass: draftAssetClass.trim() } : {}),
      ...(draftDirection ? { direction: draftDirection } : {}),
    });
    setDraftTitle("");
    setDraftAsset("");
    setDraftAssetClass("");
    setDraftDirection("");
    setIsCreating(false);
  }

  return (
    <div className="flex w-72 shrink-0 flex-col gap-2 border-r border-border pr-3" data-testid={testId}>
      {isCreating ? (
        <div className="space-y-1.5 rounded-md border border-border/60 p-2" data-testid={`${testId}-create-form`}>
          <Input
            autoFocus
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="Trade plan title"
            className="h-8 text-xs"
            data-testid={`${testId}-create-title`}
          />
          <div className="flex gap-1.5">
            <Input
              value={draftAsset}
              onChange={(e) => setDraftAsset(e.target.value)}
              placeholder="Planned asset (e.g. AAPL)"
              className="h-8 flex-1 text-xs"
              data-testid={`${testId}-create-asset`}
            />
            <Select value={draftDirection || "__none__"} onValueChange={(v) => setDraftDirection(v === "__none__" ? "" : (v as TradePlanDirection))}>
              <SelectTrigger className="h-8 w-24 text-xs" data-testid={`${testId}-create-direction`}>
                <SelectValue placeholder="Direction" />
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
          <Input
            value={draftAssetClass}
            onChange={(e) => setDraftAssetClass(e.target.value)}
            placeholder="Asset class (optional)"
            className="h-8 text-xs"
            data-testid={`${testId}-create-asset-class`}
          />
          <div className="flex gap-1.5">
            <Button type="button" size="sm" className="h-7 flex-1 text-xs" onClick={submitCreate} data-testid={`${testId}-create-save`}>
              Create
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => {
                setIsCreating(false);
                setDraftTitle("");
                setDraftAsset("");
                setDraftAssetClass("");
                setDraftDirection("");
              }}
              data-testid={`${testId}-create-cancel`}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-start gap-1.5"
          onClick={() => setIsCreating(true)}
          data-testid={`${testId}-new-plan`}
        >
          <Plus className="h-3.5 w-3.5" />
          New Trade Plan
        </Button>
      )}

      {activePlanId !== null && (
        <button
          type="button"
          className="rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted/50"
          onClick={onClearSelection}
          data-testid={`${testId}-clear-selection`}
        >
          ← All trade plans
        </button>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search trade plans"
          className="h-8 pl-7 text-xs"
          data-testid={`${testId}-search`}
        />
      </div>

      <Select value={statusFilter ?? "__all__"} onValueChange={(v) => onStatusFilterChange(v === "__all__" ? null : (v as TradePlanStatus))}>
        <SelectTrigger className="h-8 text-xs" data-testid={`${testId}-status-filter`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All statuses</SelectItem>
          {TRADE_PLAN_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {TRADE_PLAN_STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={includeArchived}
          onChange={(e) => onIncludeArchivedChange(e.target.checked)}
          data-testid={`${testId}-include-archived`}
        />
        Include archived
      </label>

      <div className="flex-1 overflow-y-auto" data-testid={`${testId}-list-container`}>
        <TradePlanList
          plans={plans}
          isLoading={isLoading}
          activePlanId={activePlanId}
          onSelectPlan={onSelectPlan}
          onTogglePin={onTogglePin}
          onDeletePlan={onDeletePlan}
          onCreateFirst={() => setIsCreating(true)}
          testId={`${testId}-list`}
        />
      </div>
    </div>
  );
}
