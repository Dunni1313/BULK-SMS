// v1.5.0 Sprint 9 — AI Strategy Builder. A reusable strategy library
// sidebar — New Strategy (inline create form: title + either a starter
// template or a free-text strategy type + optional folder), search,
// folder/status filters, an "include archived" toggle, and StrategyList's
// own list rendering — mirroring NotebookSidebar.tsx's own established
// shape (Sprint 8) so the three sidebars (workspace/notebook/strategy)
// feel like the same family of component. Every specialist coach page
// (Trading/Investing/Options) can mount this exact same component;
// nothing here is coach-specific. This component never fetches its own
// template list — the caller's page passes it in, since it's already
// shared, static, cross-coach content (GET /ai-strategy-templates).

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, X } from "lucide-react";
import type { AiStrategy, StrategyStatus, StrategyTemplateSummary } from "./strategiesApi";
import { STRATEGY_STATUSES } from "./strategiesApi";
import { StrategyList } from "./StrategyList";

const SCRATCH_TEMPLATE_VALUE = "__scratch__";

const STATUS_FILTER_LABELS: Record<StrategyStatus, string> = {
  draft: "Draft",
  active: "Active",
  retired: "Retired",
};

export interface StrategySidebarProps {
  strategies: AiStrategy[];
  isLoading: boolean;
  activeStrategyId: number | null;
  templates: StrategyTemplateSummary[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  folder: string | null;
  onFolderChange: (value: string | null) => void;
  statusFilter: StrategyStatus | null;
  onStatusFilterChange: (value: StrategyStatus | null) => void;
  includeArchived: boolean;
  onIncludeArchivedChange: (value: boolean) => void;
  onCreateStrategy: (input: { title: string; strategyType?: string; templateId?: string; folder?: string }) => unknown;
  onSelectStrategy: (id: number) => void;
  onClearSelection: () => void;
  onTogglePin?: (id: number, pinned: boolean) => void;
  onToggleArchive?: (id: number, archived: boolean) => void;
  onDeleteStrategy?: (id: number) => void;
  testId?: string;
}

export function StrategySidebar({
  strategies,
  isLoading,
  activeStrategyId,
  templates,
  searchTerm,
  onSearchChange,
  folder,
  onFolderChange,
  statusFilter,
  onStatusFilterChange,
  includeArchived,
  onIncludeArchivedChange,
  onCreateStrategy,
  onSelectStrategy,
  onClearSelection,
  onTogglePin,
  onToggleArchive,
  onDeleteStrategy,
  testId = "strategy-sidebar",
}: StrategySidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTemplateId, setDraftTemplateId] = useState<string>(SCRATCH_TEMPLATE_VALUE);
  const [draftStrategyType, setDraftStrategyType] = useState("");
  const [draftFolder, setDraftFolder] = useState("");

  const usingTemplate = draftTemplateId !== SCRATCH_TEMPLATE_VALUE;

  async function submitCreate() {
    const title = draftTitle.trim();
    if (title.length === 0) return;
    if (!usingTemplate && draftStrategyType.trim().length === 0) return;
    await onCreateStrategy({
      title,
      ...(usingTemplate ? { templateId: draftTemplateId } : { strategyType: draftStrategyType.trim() }),
      ...(draftFolder.trim() ? { folder: draftFolder.trim() } : {}),
    });
    setDraftTitle("");
    setDraftTemplateId(SCRATCH_TEMPLATE_VALUE);
    setDraftStrategyType("");
    setDraftFolder("");
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
            placeholder="Strategy title"
            className="h-8 text-xs"
            data-testid={`${testId}-create-title`}
          />
          <Select value={draftTemplateId} onValueChange={setDraftTemplateId}>
            <SelectTrigger className="h-8 text-xs" data-testid={`${testId}-create-template`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SCRATCH_TEMPLATE_VALUE}>Start from scratch</SelectItem>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!usingTemplate && (
            <Input
              value={draftStrategyType}
              onChange={(e) => setDraftStrategyType(e.target.value)}
              placeholder="Strategy type (e.g. Breakout)"
              className="h-8 text-xs"
              data-testid={`${testId}-create-strategy-type`}
            />
          )}
          <Input
            value={draftFolder}
            onChange={(e) => setDraftFolder(e.target.value)}
            placeholder="Folder (optional)"
            className="h-8 text-xs"
            data-testid={`${testId}-create-folder`}
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
                setDraftTemplateId(SCRATCH_TEMPLATE_VALUE);
                setDraftStrategyType("");
                setDraftFolder("");
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
          data-testid={`${testId}-new-strategy`}
        >
          <Plus className="h-3.5 w-3.5" />
          New Strategy
        </Button>
      )}

      {activeStrategyId !== null && (
        <button
          type="button"
          className="rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted/50"
          onClick={onClearSelection}
          data-testid={`${testId}-clear-selection`}
        >
          ← All strategies
        </button>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search strategies"
          className="h-8 pl-7 text-xs"
          data-testid={`${testId}-search`}
        />
      </div>

      <div className="flex gap-1.5">
        <Input
          value={folder ?? ""}
          onChange={(e) => onFolderChange(e.target.value.trim() ? e.target.value : null)}
          placeholder="Folder filter"
          className="h-8 flex-1 text-xs"
          data-testid={`${testId}-folder-filter`}
        />
        <Select value={statusFilter ?? "__all__"} onValueChange={(v) => onStatusFilterChange(v === "__all__" ? null : (v as StrategyStatus))}>
          <SelectTrigger className="h-8 w-28 text-xs" data-testid={`${testId}-status-filter`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            {STRATEGY_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_FILTER_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
        <StrategyList
          strategies={strategies}
          isLoading={isLoading}
          activeStrategyId={activeStrategyId}
          onSelectStrategy={onSelectStrategy}
          onTogglePin={onTogglePin}
          onToggleArchive={onToggleArchive}
          onDeleteStrategy={onDeleteStrategy}
          onCreateFirst={() => setIsCreating(true)}
          testId={`${testId}-list`}
        />
      </div>
    </div>
  );
}
