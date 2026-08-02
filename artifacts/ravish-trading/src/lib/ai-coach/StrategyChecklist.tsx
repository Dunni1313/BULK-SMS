// v1.5.0 Sprint 9 — AI Strategy Builder. A small, generic, reusable
// checklist-rendering component — an explicit "Generate" button calling
// whichever POST /ai-strategies/:id/ai/{setup-checklist,trade-prep-
// checklist,review-questions} action the caller supplies, then a
// checkable item list once generated. Checked state is local-only UI
// state (never persisted) — this component has no notion of "done" on
// the server, matching the approved scope's "AI remains advisory only"
// instruction. Used 3 times inside StrategySummaryPanel (one per
// checklist-shaped AI action), and kept standalone so any future surface
// needing a titled, generatable checklist can reuse it directly.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";
import type { StrategyChecklistResult } from "./strategiesApi";

export interface StrategyChecklistProps {
  title: string;
  icon: LucideIcon;
  onGenerate: () => Promise<StrategyChecklistResult | null>;
  testId?: string;
}

export function StrategyChecklist({ title, icon: Icon, onGenerate, testId = "strategy-checklist" }: StrategyChecklistProps) {
  const [isBusy, setIsBusy] = useState(false);
  const [result, setResult] = useState<StrategyChecklistResult | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  async function handleGenerate() {
    setIsBusy(true);
    try {
      const generated = await onGenerate();
      setResult(generated);
      setChecked(new Set());
    } finally {
      setIsBusy(false);
    }
  }

  function toggle(index: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className="space-y-1.5" data-testid={testId}>
      <Button type="button" variant="outline" size="sm" className="h-8 w-full gap-1.5 text-xs" disabled={isBusy} onClick={handleGenerate} data-testid={`${testId}-generate`}>
        <Icon className="h-3.5 w-3.5" />
        {isBusy ? "Generating…" : title}
      </Button>

      {result && (
        <div className="rounded-md border border-border/60 p-2" data-testid={`${testId}-result`}>
          {result.available && result.items.length > 0 ? (
            <ul className="space-y-1">
              {result.items.map((item, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/90" data-testid={`${testId}-item-${i}`}>
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={checked.has(i)}
                    onChange={() => toggle(i)}
                    data-testid={`${testId}-item-check-${i}`}
                  />
                  <span className={checked.has(i) ? "text-muted-foreground line-through" : ""}>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground" data-testid={`${testId}-unavailable`}>
              Not available right now.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
