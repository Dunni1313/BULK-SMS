// v1.5.0 Sprint 10 — Institutional Trade Planner. The trade plan's AI
// actions panel — review, summarise, risk highlights, risk/reward
// review, executive summary, preparation notes (6 prose narration
// actions), plus a pre-trade checklist and verification questions
// (2 checklist-shaped actions, each rendered via the EXISTING, reused
// StrategyChecklist component — its {title, icon, onGenerate, testId}
// shape and {available, items} result shape are already fully generic,
// so this sprint introduces no second, duplicate checklist-rendering
// component for these two ephemeral, never-persisted AI outputs), plus
// the deterministic (never an LLM call) missing-information detector
// shown as a small always-visible strip at the top. Every action is an
// explicit button click; nothing here runs automatically, nothing here
// saves its own output back into the plan, and nothing here ever
// recommends actually executing the trade — mirroring
// StrategySummaryPanel.tsx's own established shape (Sprint 9).

import { useEffect, useState } from "react";
import { ClipboardList, Sparkles, ShieldAlert, Scale, FileText, NotebookPen, ClipboardCheck, HelpCircle } from "lucide-react";
import type { TradePlanNarration, TradePlanChecklistResult, MissingTradePlanInfoResult } from "./tradePlansApi";
import { StrategyChecklist } from "./StrategyChecklist";

export interface TradePlanSummaryProps {
  onLoadMissingInformation: () => Promise<MissingTradePlanInfoResult | null>;
  onReview: () => Promise<TradePlanNarration | null>;
  onSummarize: () => Promise<TradePlanNarration | null>;
  onGenerateRiskHighlights: () => Promise<TradePlanNarration | null>;
  onReviewRiskReward: () => Promise<TradePlanNarration | null>;
  onGenerateExecutiveSummary: () => Promise<TradePlanNarration | null>;
  onGeneratePreparationNotes: () => Promise<TradePlanNarration | null>;
  onGeneratePreTradeChecklist: () => Promise<TradePlanChecklistResult | null>;
  onGenerateVerificationQuestions: () => Promise<TradePlanChecklistResult | null>;
  testId?: string;
}

export function TradePlanSummary({
  onLoadMissingInformation,
  onReview,
  onSummarize,
  onGenerateRiskHighlights,
  onReviewRiskReward,
  onGenerateExecutiveSummary,
  onGeneratePreparationNotes,
  onGeneratePreTradeChecklist,
  onGenerateVerificationQuestions,
  testId = "trade-plan-summary",
}: TradePlanSummaryProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [missing, setMissing] = useState<MissingTradePlanInfoResult | null>(null);
  const [review, setReview] = useState<TradePlanNarration | null>(null);
  const [summary, setSummary] = useState<TradePlanNarration | null>(null);
  const [riskHighlights, setRiskHighlights] = useState<TradePlanNarration | null>(null);
  const [riskRewardReview, setRiskRewardReview] = useState<TradePlanNarration | null>(null);
  const [executiveSummary, setExecutiveSummary] = useState<TradePlanNarration | null>(null);
  const [preparationNotes, setPreparationNotes] = useState<TradePlanNarration | null>(null);

  useEffect(() => {
    let cancelled = false;
    onLoadMissingInformation().then((result) => {
      if (!cancelled) setMissing(result);
    });
    return () => {
      cancelled = true;
    };
    // Intentionally only re-runs when the caller's identity function
    // reference changes (which the containing page keys off the active
    // plan id) — never polled or refreshed automatically otherwise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onLoadMissingInformation]);

  async function run(kind: string, action: () => Promise<unknown>, onResult: (result: any) => void) {
    setBusy(kind);
    try {
      const result = await action();
      onResult(result);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3" data-testid={testId}>
      {missing && missing.completenessPct < 100 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2" data-testid={`${testId}-missing-information`}>
          <p className="text-[10px] font-medium uppercase text-amber-400" data-testid={`${testId}-completeness`}>
            {missing.completenessPct}% complete
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Missing: {missing.missing.join(", ")}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-border/60 text-xs hover:bg-muted/50 disabled:opacity-50"
          disabled={busy !== null}
          onClick={() => run("review", onReview, setReview)}
          data-testid={`${testId}-review-button`}
        >
          <ClipboardList className="h-3.5 w-3.5" />
          {busy === "review" ? "Working…" : "Review plan"}
        </button>
        <button
          type="button"
          className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-border/60 text-xs hover:bg-muted/50 disabled:opacity-50"
          disabled={busy !== null}
          onClick={() => run("summarize", onSummarize, setSummary)}
          data-testid={`${testId}-summarize-button`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {busy === "summarize" ? "Working…" : "Summarise"}
        </button>
        <button
          type="button"
          className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-border/60 text-xs hover:bg-muted/50 disabled:opacity-50"
          disabled={busy !== null}
          onClick={() => run("risk-highlights", onGenerateRiskHighlights, setRiskHighlights)}
          data-testid={`${testId}-risk-highlights-button`}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          {busy === "risk-highlights" ? "Working…" : "Highlight risks"}
        </button>
        <button
          type="button"
          className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-border/60 text-xs hover:bg-muted/50 disabled:opacity-50"
          disabled={busy !== null}
          onClick={() => run("risk-reward", onReviewRiskReward, setRiskRewardReview)}
          data-testid={`${testId}-risk-reward-button`}
        >
          <Scale className="h-3.5 w-3.5" />
          {busy === "risk-reward" ? "Working…" : "Review risk/reward"}
        </button>
        <button
          type="button"
          className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-border/60 text-xs hover:bg-muted/50 disabled:opacity-50"
          disabled={busy !== null}
          onClick={() => run("executive-summary", onGenerateExecutiveSummary, setExecutiveSummary)}
          data-testid={`${testId}-executive-summary-button`}
        >
          <FileText className="h-3.5 w-3.5" />
          {busy === "executive-summary" ? "Working…" : "Executive summary"}
        </button>
        <button
          type="button"
          className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-border/60 text-xs hover:bg-muted/50 disabled:opacity-50"
          disabled={busy !== null}
          onClick={() => run("preparation-notes", onGeneratePreparationNotes, setPreparationNotes)}
          data-testid={`${testId}-preparation-notes-button`}
        >
          <NotebookPen className="h-3.5 w-3.5" />
          {busy === "preparation-notes" ? "Working…" : "Preparation notes"}
        </button>
      </div>

      {review && (
        <div className="rounded-md border border-indigo-500/30 bg-indigo-500/5 p-2.5" data-testid={`${testId}-review-result`}>
          <p className="whitespace-pre-wrap text-xs text-foreground/90">{review.text}</p>
        </div>
      )}
      {summary && (
        <div className="rounded-md border border-indigo-500/30 bg-indigo-500/5 p-2.5" data-testid={`${testId}-summary-result`}>
          <p className="whitespace-pre-wrap text-xs text-foreground/90">{summary.text}</p>
        </div>
      )}
      {riskHighlights && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5" data-testid={`${testId}-risk-highlights-result`}>
          <p className="whitespace-pre-wrap text-xs text-foreground/90">{riskHighlights.text}</p>
        </div>
      )}
      {riskRewardReview && (
        <div className="rounded-md border border-indigo-500/30 bg-indigo-500/5 p-2.5" data-testid={`${testId}-risk-reward-result`}>
          <p className="whitespace-pre-wrap text-xs text-foreground/90">{riskRewardReview.text}</p>
        </div>
      )}
      {executiveSummary && (
        <div className="rounded-md border border-indigo-500/30 bg-indigo-500/5 p-2.5" data-testid={`${testId}-executive-summary-result`}>
          <p className="whitespace-pre-wrap text-xs text-foreground/90">{executiveSummary.text}</p>
        </div>
      )}
      {preparationNotes && (
        <div className="rounded-md border border-indigo-500/30 bg-indigo-500/5 p-2.5" data-testid={`${testId}-preparation-notes-result`}>
          <p className="whitespace-pre-wrap text-xs text-foreground/90">{preparationNotes.text}</p>
        </div>
      )}

      <div className="space-y-2 border-t border-border/60 pt-2">
        <StrategyChecklist title="Pre-trade checklist" icon={ClipboardCheck} onGenerate={onGeneratePreTradeChecklist} testId={`${testId}-pre-trade-checklist`} />
        <StrategyChecklist title="Verification questions" icon={HelpCircle} onGenerate={onGenerateVerificationQuestions} testId={`${testId}-verification-questions`} />
      </div>
    </div>
  );
}
