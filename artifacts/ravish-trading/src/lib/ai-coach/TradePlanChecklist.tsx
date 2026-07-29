// v1.5.0 Sprint 10 — Institutional Trade Planner. The Checklist Engine's
// own persistent per-plan UI: required/optional items with a real,
// server-persisted completion checkbox (unlike the ephemeral,
// never-persisted AI-generated checklists rendered via the reused,
// generic StrategyChecklist component inside TradePlanSummary), a
// progress bar derived from computeChecklistProgress() server-side, an
// add-item form, and a dropdown to bulk-seed every item from a named
// coach-specific template (lib/tradePlanChecklistTemplates.ts). Deleting
// a completed item vs. an incomplete one is the same single action —
// there is no undo, matching every other delete affordance in this
// codebase.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ListChecks } from "lucide-react";
import type { TradePlanChecklistItem, ChecklistProgress, TradePlanChecklistTemplate } from "./tradePlansApi";

export interface TradePlanChecklistProps {
  items: TradePlanChecklistItem[];
  progress: ChecklistProgress;
  templates?: TradePlanChecklistTemplate[];
  onAddItem: (input: { label: string; required?: boolean }) => void | Promise<void>;
  onApplyTemplate: (templateId: string) => void | Promise<void>;
  onToggleCompleted: (itemId: number, completed: boolean) => void | Promise<void>;
  onDeleteItem: (itemId: number) => void | Promise<void>;
  testId?: string;
}

export function TradePlanChecklist({
  items,
  progress,
  templates,
  onAddItem,
  onApplyTemplate,
  onToggleCompleted,
  onDeleteItem,
  testId = "trade-plan-checklist",
}: TradePlanChecklistProps) {
  const [draftLabel, setDraftLabel] = useState("");
  const [draftRequired, setDraftRequired] = useState(true);

  async function submitAdd() {
    const label = draftLabel.trim();
    if (label.length === 0) return;
    await onAddItem({ label, required: draftRequired });
    setDraftLabel("");
    setDraftRequired(true);
  }

  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex items-center justify-between" data-testid={`${testId}-progress`}>
        <span className="flex items-center gap-1 text-xs font-medium text-foreground/80">
          <ListChecks className="h-3.5 w-3.5" />
          Readiness Checklist
        </span>
        <span
          className={`text-[10px] font-medium ${progress.readyForEntry ? "text-emerald-400" : "text-muted-foreground"}`}
          data-testid={`${testId}-progress-pct`}
        >
          {progress.progressPct}% · {progress.readyForEntry ? "Ready" : "Not ready"}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" data-testid={`${testId}-progress-bar`}>
        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${progress.progressPct}%` }} />
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground" data-testid={`${testId}-empty`}>
          No checklist items yet.
        </p>
      ) : (
        <ul className="space-y-1">
          {sorted.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1.5" data-testid={`${testId}-item-${item.id}`}>
              <label className="flex min-w-0 flex-1 items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={(e) => onToggleCompleted(item.id, e.target.checked)}
                  data-testid={`${testId}-item-${item.id}-checkbox`}
                />
                <span className={`truncate ${item.completed ? "text-muted-foreground line-through" : "text-foreground/90"}`}>{item.label}</span>
                {item.required && (
                  <span className="shrink-0 rounded bg-amber-500/10 px-1 text-[9px] uppercase text-amber-400" data-testid={`${testId}-item-${item.id}-required`}>
                    Required
                  </span>
                )}
              </label>
              <button type="button" onClick={() => onDeleteItem(item.id)} aria-label="Remove checklist item" data-testid={`${testId}-item-${item.id}-delete`}>
                <Trash2 className="h-3 w-3 shrink-0 text-muted-foreground hover:text-destructive" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-1.5">
        <Input
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          placeholder="Add a checklist item…"
          className="h-8 flex-1 text-xs"
          data-testid={`${testId}-add-input`}
        />
        <label className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
          <input type="checkbox" checked={draftRequired} onChange={(e) => setDraftRequired(e.target.checked)} data-testid={`${testId}-add-required`} />
          Required
        </label>
        <Button type="button" size="sm" className="h-8 shrink-0" onClick={submitAdd} data-testid={`${testId}-add-save`}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {templates && templates.length > 0 && (
        <Select onValueChange={(v) => onApplyTemplate(v)}>
          <SelectTrigger className="h-8 text-xs" data-testid={`${testId}-template-select`}>
            <SelectValue placeholder="Apply a checklist template…" />
          </SelectTrigger>
          <SelectContent>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
