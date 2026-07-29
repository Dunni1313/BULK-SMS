// v1.5.0 Sprint 9 — AI Strategy Builder. Side-by-side comparison of two
// strategies — a deterministic section-by-section view (from
// GET /ai-strategies/compare, fetched by the caller's own page) plus an
// explicit, user-triggered AI narrative comparison
// (POST /ai-strategies/compare/ai). This component owns only the A/B
// picker UI and rendering; it never fetches its own data, matching every
// other Sprint 9 component's "caller supplies data, component only
// renders + emits callbacks" discipline.

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Scale } from "lucide-react";
import type { AiStrategy, StrategyComparison, StrategyNarration } from "./strategiesApi";
import { QUALITATIVE_SECTION_KINDS, SECTION_LABELS } from "./strategiesApi";

export interface StrategyComparisonViewProps {
  strategies: AiStrategy[];
  selectedIdA: number | null;
  selectedIdB: number | null;
  onSelectA: (id: number) => void;
  onSelectB: (id: number) => void;
  comparison: StrategyComparison | null;
  isLoadingComparison?: boolean;
  onGenerateAiComparison: () => Promise<StrategyNarration | null>;
  testId?: string;
}

export function StrategyComparisonView({
  strategies,
  selectedIdA,
  selectedIdB,
  onSelectA,
  onSelectB,
  comparison,
  isLoadingComparison = false,
  onGenerateAiComparison,
  testId = "strategy-comparison-view",
}: StrategyComparisonViewProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiComparison, setAiComparison] = useState<StrategyNarration | null>(null);

  async function generate() {
    setIsGenerating(true);
    try {
      setAiComparison(await onGenerateAiComparison());
    } finally {
      setIsGenerating(false);
    }
  }

  function contentFor(strategy: (StrategyComparison["strategyA"] | StrategyComparison["strategyB"]) | undefined, kind: string) {
    return strategy?.sections.find((s) => s.kind === kind)?.content ?? null;
  }

  return (
    <div className="space-y-3" data-testid={testId}>
      <div className="flex gap-2">
        <Select value={selectedIdA != null ? String(selectedIdA) : undefined} onValueChange={(v) => onSelectA(Number(v))}>
          <SelectTrigger className="h-8 flex-1 text-xs" data-testid={`${testId}-select-a`}>
            <SelectValue placeholder="Strategy A" />
          </SelectTrigger>
          <SelectContent>
            {strategies.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedIdB != null ? String(selectedIdB) : undefined} onValueChange={(v) => onSelectB(Number(v))}>
          <SelectTrigger className="h-8 flex-1 text-xs" data-testid={`${testId}-select-b`}>
            <SelectValue placeholder="Strategy B" />
          </SelectTrigger>
          <SelectContent>
            {strategies.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoadingComparison && (
        <p className="text-xs text-muted-foreground" data-testid={`${testId}-loading`}>
          Loading comparison…
        </p>
      )}

      {comparison && !isLoadingComparison && (
        <>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border border-border/60 p-2" data-testid={`${testId}-strategy-a-header`}>
              <p className="font-medium text-foreground/90">{comparison.strategyA.title}</p>
              <p className="text-muted-foreground">{comparison.strategyA.strategyType}</p>
            </div>
            <div className="rounded-md border border-border/60 p-2" data-testid={`${testId}-strategy-b-header`}>
              <p className="font-medium text-foreground/90">{comparison.strategyB.title}</p>
              <p className="text-muted-foreground">{comparison.strategyB.strategyType}</p>
            </div>
          </div>

          <div className="space-y-1.5" data-testid={`${testId}-sections`}>
            {QUALITATIVE_SECTION_KINDS.map((kind) => {
              const a = contentFor(comparison.strategyA, kind);
              const b = contentFor(comparison.strategyB, kind);
              if (!a && !b) return null;
              return (
                <div key={kind} className="grid grid-cols-2 gap-2" data-testid={`${testId}-section-${kind}`}>
                  <div className="rounded bg-muted/30 p-1.5 text-xs">
                    <p className="mb-0.5 text-[9px] uppercase text-muted-foreground">{SECTION_LABELS[kind]}</p>
                    <p className="whitespace-pre-wrap text-foreground/90">{a ?? "—"}</p>
                  </div>
                  <div className="rounded bg-muted/30 p-1.5 text-xs">
                    <p className="mb-0.5 text-[9px] uppercase text-muted-foreground">{SECTION_LABELS[kind]}</p>
                    <p className="whitespace-pre-wrap text-foreground/90">{b ?? "—"}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <Button type="button" variant="outline" size="sm" className="h-8 w-full gap-1.5 text-xs" disabled={isGenerating} onClick={generate} data-testid={`${testId}-generate-ai`}>
            <Scale className="h-3.5 w-3.5" />
            {isGenerating ? "Comparing…" : "Generate AI comparison"}
          </Button>

          {aiComparison && (
            <div className="rounded-md border border-indigo-500/30 bg-indigo-500/5 p-2.5" data-testid={`${testId}-ai-result`}>
              <p className="whitespace-pre-wrap text-xs text-foreground/90">{aiComparison.text}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
