// v1.5.0 Sprint 10 — Institutional Trade Planner. Rendering/interaction
// component for the side-by-side comparison view — this component owns
// only the A/B picker UI and rendering, never fetches its own data (the
// caller's page fetches via GET /trade-plans/compare and passes the
// result in). Select-based A/B picking is not simulated in this
// codebase's own tests, matching the established convention of not
// driving shadcn/ui Select option-picking through jsdom, mirroring
// StrategyComparisonView.tsx's own established shape (Sprint 9).

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import type { TradePlan, TradePlanComparison as TradePlanComparisonResult, TradePlanNarration } from "./tradePlansApi";
import { QUALITATIVE_TRADE_PLAN_SECTION_KINDS, TRADE_PLAN_SECTION_LABELS } from "./tradePlansApi";

export interface TradePlanComparisonProps {
  plans: TradePlan[];
  selectedIdA: number | null;
  selectedIdB: number | null;
  onSelectA: (id: number) => void;
  onSelectB: (id: number) => void;
  comparison: TradePlanComparisonResult | null;
  isLoadingComparison?: boolean;
  onGenerateAiComparison: () => Promise<TradePlanNarration | null>;
  testId?: string;
}

export function TradePlanComparison({
  plans,
  selectedIdA,
  selectedIdB,
  onSelectA,
  onSelectB,
  comparison,
  isLoadingComparison = false,
  onGenerateAiComparison,
  testId = "trade-plan-comparison",
}: TradePlanComparisonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<TradePlanNarration | null>(null);

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const result = await onGenerateAiComparison();
      setAiResult(result);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-3" data-testid={testId}>
      <div className="grid grid-cols-2 gap-2">
        <Select value={selectedIdA != null ? String(selectedIdA) : undefined} onValueChange={(v) => onSelectA(Number(v))}>
          <SelectTrigger className="h-8 text-xs" data-testid={`${testId}-select-a`}>
            <SelectValue placeholder="Plan A" />
          </SelectTrigger>
          <SelectContent>
            {plans.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedIdB != null ? String(selectedIdB) : undefined} onValueChange={(v) => onSelectB(Number(v))}>
          <SelectTrigger className="h-8 text-xs" data-testid={`${testId}-select-b`}>
            <SelectValue placeholder="Plan B" />
          </SelectTrigger>
          <SelectContent>
            {plans.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.title}
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

      {comparison && (
        <>
          <div className="grid grid-cols-2 gap-3" data-testid={`${testId}-sections`}>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground/90" data-testid={`${testId}-plan-a-header`}>
                {comparison.planA.title}
              </p>
              {QUALITATIVE_TRADE_PLAN_SECTION_KINDS.map((kind) => {
                const section = comparison.planA.sections.find((s) => s.kind === kind);
                if (!section?.content) return null;
                return (
                  <div key={kind} className="rounded bg-muted/40 p-1.5" data-testid={`${testId}-section-${kind}`}>
                    <p className="text-[10px] font-medium uppercase text-muted-foreground">{TRADE_PLAN_SECTION_LABELS[kind]}</p>
                    <p className="text-xs text-foreground/90">{section.content}</p>
                  </div>
                );
              })}
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground/90" data-testid={`${testId}-plan-b-header`}>
                {comparison.planB.title}
              </p>
              {QUALITATIVE_TRADE_PLAN_SECTION_KINDS.map((kind) => {
                const section = comparison.planB.sections.find((s) => s.kind === kind);
                if (!section?.content) return null;
                return (
                  <div key={`b-${kind}`} className="rounded bg-muted/40 p-1.5">
                    <p className="text-[10px] font-medium uppercase text-muted-foreground">{TRADE_PLAN_SECTION_LABELS[kind]}</p>
                    <p className="text-xs text-foreground/90">{section.content}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 text-xs" disabled={isGenerating} onClick={handleGenerate} data-testid={`${testId}-generate-ai`}>
            <Sparkles className="h-3.5 w-3.5" />
            {isGenerating ? "Comparing…" : "Compare with AI"}
          </Button>

          {aiResult && (
            <div className="rounded-md border border-indigo-500/30 bg-indigo-500/5 p-2.5" data-testid={`${testId}-ai-result`}>
              <p className="whitespace-pre-wrap text-xs text-foreground/90">{aiResult.text}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
