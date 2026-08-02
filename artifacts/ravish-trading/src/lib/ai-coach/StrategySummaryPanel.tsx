// v1.5.0 Sprint 9 — AI Strategy Builder. The strategy's AI actions panel —
// summarise, suggest improvements, executive summary, learning notes,
// risk highlights (5 prose narration actions), plus setup checklist/
// trade prep checklist/review questions (3 checklist-shaped actions, each
// rendered via the reusable StrategyChecklist component), plus the
// deterministic (never an LLM call) missing-sections detector shown as a
// small always-visible strip at the top. Every action is an explicit
// button click; nothing here runs automatically, and nothing here saves
// its own output back into the strategy — mirroring
// NotebookSummaryPanel.tsx's own established shape (Sprint 8) extended
// for Sprint 9's larger AI-feature surface.

import { useEffect, useState } from "react";
import { Sparkles, Lightbulb, FileText, GraduationCap, ShieldAlert, ListChecks, ClipboardCheck, HelpCircle } from "lucide-react";
import type { StrategyNarration, StrategyChecklistResult, MissingSectionsResult } from "./strategiesApi";
import { StrategyChecklist } from "./StrategyChecklist";

export interface StrategySummaryPanelProps {
  onLoadMissingSections: () => Promise<MissingSectionsResult | null>;
  onSummarize: () => Promise<StrategyNarration | null>;
  onSuggestImprovements: () => Promise<StrategyNarration | null>;
  onGenerateExecutiveSummary: () => Promise<StrategyNarration | null>;
  onGenerateLearningNotes: () => Promise<StrategyNarration | null>;
  onGenerateRiskHighlights: () => Promise<StrategyNarration | null>;
  onGenerateSetupChecklist: () => Promise<StrategyChecklistResult | null>;
  onGenerateTradePrepChecklist: () => Promise<StrategyChecklistResult | null>;
  onGenerateReviewQuestions: () => Promise<StrategyChecklistResult | null>;
  testId?: string;
}

export function StrategySummaryPanel({
  onLoadMissingSections,
  onSummarize,
  onSuggestImprovements,
  onGenerateExecutiveSummary,
  onGenerateLearningNotes,
  onGenerateRiskHighlights,
  onGenerateSetupChecklist,
  onGenerateTradePrepChecklist,
  onGenerateReviewQuestions,
  testId = "strategy-summary-panel",
}: StrategySummaryPanelProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [missing, setMissing] = useState<MissingSectionsResult | null>(null);
  const [summary, setSummary] = useState<StrategyNarration | null>(null);
  const [improvements, setImprovements] = useState<StrategyNarration | null>(null);
  const [executiveSummary, setExecutiveSummary] = useState<StrategyNarration | null>(null);
  const [learningNotes, setLearningNotes] = useState<StrategyNarration | null>(null);
  const [riskHighlights, setRiskHighlights] = useState<StrategyNarration | null>(null);

  useEffect(() => {
    let cancelled = false;
    onLoadMissingSections().then((result) => {
      if (!cancelled) setMissing(result);
    });
    return () => {
      cancelled = true;
    };
    // Intentionally only re-runs when the caller's identity function
    // reference changes (which the containing page keys off the active
    // strategy id) — never polled or refreshed automatically otherwise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onLoadMissingSections]);

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
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2" data-testid={`${testId}-missing-sections`}>
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
          onClick={() => run("improvements", onSuggestImprovements, setImprovements)}
          data-testid={`${testId}-improvements-button`}
        >
          <Lightbulb className="h-3.5 w-3.5" />
          {busy === "improvements" ? "Working…" : "Suggest improvements"}
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
          onClick={() => run("learning-notes", onGenerateLearningNotes, setLearningNotes)}
          data-testid={`${testId}-learning-notes-button`}
        >
          <GraduationCap className="h-3.5 w-3.5" />
          {busy === "learning-notes" ? "Working…" : "Learning notes"}
        </button>
        <button
          type="button"
          className="col-span-2 flex h-8 items-center justify-center gap-1.5 rounded-md border border-border/60 text-xs hover:bg-muted/50 disabled:opacity-50"
          disabled={busy !== null}
          onClick={() => run("risk-highlights", onGenerateRiskHighlights, setRiskHighlights)}
          data-testid={`${testId}-risk-highlights-button`}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          {busy === "risk-highlights" ? "Working…" : "Highlight risks"}
        </button>
      </div>

      {summary && (
        <div className="rounded-md border border-indigo-500/30 bg-indigo-500/5 p-2.5" data-testid={`${testId}-summary-result`}>
          <p className="whitespace-pre-wrap text-xs text-foreground/90">{summary.text}</p>
        </div>
      )}
      {improvements && (
        <div className="rounded-md border border-indigo-500/30 bg-indigo-500/5 p-2.5" data-testid={`${testId}-improvements-result`}>
          <p className="whitespace-pre-wrap text-xs text-foreground/90">{improvements.text}</p>
        </div>
      )}
      {executiveSummary && (
        <div className="rounded-md border border-indigo-500/30 bg-indigo-500/5 p-2.5" data-testid={`${testId}-executive-summary-result`}>
          <p className="whitespace-pre-wrap text-xs text-foreground/90">{executiveSummary.text}</p>
        </div>
      )}
      {learningNotes && (
        <div className="rounded-md border border-indigo-500/30 bg-indigo-500/5 p-2.5" data-testid={`${testId}-learning-notes-result`}>
          <p className="whitespace-pre-wrap text-xs text-foreground/90">{learningNotes.text}</p>
        </div>
      )}
      {riskHighlights && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5" data-testid={`${testId}-risk-highlights-result`}>
          <p className="whitespace-pre-wrap text-xs text-foreground/90">{riskHighlights.text}</p>
        </div>
      )}

      <div className="space-y-2 border-t border-border/60 pt-2">
        <StrategyChecklist title="Setup checklist" icon={ListChecks} onGenerate={onGenerateSetupChecklist} testId={`${testId}-setup-checklist`} />
        <StrategyChecklist title="Trade prep checklist" icon={ClipboardCheck} onGenerate={onGenerateTradePrepChecklist} testId={`${testId}-trade-prep-checklist`} />
        <StrategyChecklist title="Review questions" icon={HelpCircle} onGenerate={onGenerateReviewQuestions} testId={`${testId}-review-questions`} />
      </div>
    </div>
  );
}
