// Phase 30/31 — Institutional Strategy Framework / Strategy Workbench.
//
// Shared Checklist Review panel: lists a strategy's own real, persisted
// checklist instances, lets the user create a new one (instantiated fresh
// from the strategy's own template server-side —
// instantiateChecklistItems(), never hardcoded here), toggle item
// completion, and record checklist-level notes. Zero strategy-specific
// content and zero derived math of its own — completion state comes back
// from the server (deriveChecklistStatus()) on every mutation.
//
// Originally built inline in StrategyFramework.tsx (Phase 30); extracted
// here, unmodified in behavior, so StrategyWorkbench.tsx (Phase 31) reuses
// the exact same checklist-review logic rather than a second, potentially
// drifting copy. StrategyFramework.tsx's own existing tests (Phase 30)
// continue to pass unmodified after this extraction.

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  useListTradingStrategyChecklists,
  getListTradingStrategyChecklistsQueryKey,
  useCreateTradingStrategyChecklist,
  useUpdateTradingStrategyChecklist,
  useDeleteTradingStrategyChecklist,
  type TradingStrategy,
  type TradingStrategyChecklist,
} from "@workspace/api-client-react";
import { ListChecks, Trash2 } from "lucide-react";

export function ChecklistReviewPanel({ strategy }: { strategy: TradingStrategy }) {
  const { data: checklists } = useListTradingStrategyChecklists(strategy.id, {
    query: { queryKey: getListTradingStrategyChecklistsQueryKey(strategy.id) },
  });
  const [symbol, setSymbol] = useState("");
  const createChecklist = useCreateTradingStrategyChecklist();
  const updateChecklist = useUpdateTradingStrategyChecklist();
  const deleteChecklist = useDeleteTradingStrategyChecklist();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState("");

  const selected = checklists?.find((c) => c.id === selectedId) ?? null;

  const toggleItem = (checklist: TradingStrategyChecklist, itemId: string) => {
    const items = checklist.items.map((i) => (i.id === itemId ? { ...i, completed: !i.completed } : i));
    updateChecklist.mutate({ id: checklist.id, data: { items } });
  };

  const saveNotes = (checklist: TradingStrategyChecklist) => {
    updateChecklist.mutate({ id: checklist.id, data: { notes: notesDraft } });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ListChecks className="w-4 h-4" /> Checklist Review
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3" data-testid="panel-checklist-viewer">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Optional symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="max-w-[160px]"
              data-testid="input-checklist-symbol"
            />
            <Button
              size="sm"
              data-testid="button-new-checklist"
              onClick={() =>
                createChecklist.mutate(
                  { strategyId: strategy.id, data: { symbol: symbol.trim() || undefined } },
                  { onSuccess: (created) => setSelectedId(created.id) },
                )
              }
            >
              New Checklist
            </Button>
          </div>

          {checklists?.length === 0 && (
            <p className="text-sm text-muted-foreground" data-testid="text-checklists-empty">
              No checklist instances yet for this strategy.
            </p>
          )}

          {checklists && checklists.length > 0 && (
            <ul className="space-y-1" data-testid="list-checklists">
              {checklists.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    data-testid={`button-select-checklist-${c.id}`}
                    onClick={() => {
                      setSelectedId(c.id);
                      setNotesDraft(c.notes);
                    }}
                    className={`w-full text-left text-sm p-2 rounded border ${selectedId === c.id ? "border-indigo-500" : "border-border"}`}
                  >
                    {c.symbol ?? "(no symbol)"} — <Badge variant={c.status === "complete" ? "default" : "secondary"}>{c.status}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selected && (
            <div className="space-y-2 border-t border-border pt-3" data-testid={`checklist-detail-${selected.id}`}>
              {selected.items.map((item) => (
                <div key={item.id} className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={item.completed}
                    onCheckedChange={() => toggleItem(selected, item.id)}
                    data-testid={`checkbox-checklist-item-${item.id}`}
                  />
                  <div>
                    <span>
                      {item.label} {item.required ? <Badge variant="outline" className="ml-1 text-[10px]">required</Badge> : null}
                    </span>
                    {item.evidenceLinks.length === 0 && (
                      <p className="text-xs text-muted-foreground" data-testid={`text-no-evidence-${item.id}`}>
                        No evidence link attached yet.
                      </p>
                    )}
                  </div>
                </div>
              ))}

              <div className="space-y-1">
                <Label htmlFor={`checklist-notes-${selected.id}`} className="text-xs">
                  Checklist Notes
                </Label>
                <Textarea
                  id={`checklist-notes-${selected.id}`}
                  data-testid={`input-checklist-notes-${selected.id}`}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  rows={2}
                />
                <Button size="sm" variant="outline" data-testid={`button-save-checklist-notes-${selected.id}`} onClick={() => saveNotes(selected)}>
                  Save Notes
                </Button>
              </div>

              <Button
                variant="destructive"
                size="sm"
                data-testid={`button-delete-checklist-${selected.id}`}
                onClick={() => {
                  deleteChecklist.mutate({ id: selected.id });
                  setSelectedId(null);
                }}
              >
                <Trash2 className="w-3 h-3 mr-1" /> Delete this checklist
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
