// v1.5.0 Sprint 8 — AI Research Notebooks. The notebook's AI actions
// panel — summarise the whole notebook, merge notes into one executive
// summary, generate key takeaways, generate action items. Every action is
// an explicit button click calling one of the 4 new
// POST /ai-notebooks/:id/ai/* endpoints; nothing here runs automatically,
// and none of these actions saves its own output into the notebook — that
// remains a separate, explicit "Save to notebook" step the caller performs
// via onSaveAsNote, per the approved scope's own "the AI remains an
// assistant, not an autonomous decision-maker" instruction.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, ListChecks, CheckSquare, Combine, Save } from "lucide-react";
import type { NotebookNarration, NotebookExtractionResult } from "./notebooksApi";

export interface NotebookSummaryPanelProps {
  onSummarize: () => Promise<NotebookNarration | null>;
  onMergeNotes: () => Promise<NotebookNarration | null>;
  onGenerateTakeaways: () => Promise<NotebookExtractionResult | null>;
  onGenerateActionItems: () => Promise<NotebookExtractionResult | null>;
  /** Saves a piece of AI-generated text back into the notebook as an
   * ordinary note (kind supplied by the caller) — always a separate,
   * explicit action from generating it. */
  onSaveAsNote?: (kind: "summary" | "finding" | "action_item", content: string) => void | Promise<void>;
  testId?: string;
}

export function NotebookSummaryPanel({
  onSummarize,
  onMergeNotes,
  onGenerateTakeaways,
  onGenerateActionItems,
  onSaveAsNote,
  testId = "notebook-summary-panel",
}: NotebookSummaryPanelProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [summary, setSummary] = useState<NotebookNarration | null>(null);
  const [merged, setMerged] = useState<NotebookNarration | null>(null);
  const [takeaways, setTakeaways] = useState<NotebookExtractionResult | null>(null);
  const [actionItems, setActionItems] = useState<NotebookExtractionResult | null>(null);

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
      <div className="grid grid-cols-2 gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={busy !== null}
          onClick={() => run("summarize", onSummarize, setSummary)}
          data-testid={`${testId}-summarize-button`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {busy === "summarize" ? "Summarising…" : "Summarise notebook"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={busy !== null}
          onClick={() => run("merge", onMergeNotes, setMerged)}
          data-testid={`${testId}-merge-button`}
        >
          <Combine className="h-3.5 w-3.5" />
          {busy === "merge" ? "Merging…" : "Merge notes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={busy !== null}
          onClick={() => run("takeaways", onGenerateTakeaways, setTakeaways)}
          data-testid={`${testId}-takeaways-button`}
        >
          <ListChecks className="h-3.5 w-3.5" />
          {busy === "takeaways" ? "Working…" : "Key takeaways"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={busy !== null}
          onClick={() => run("action-items", onGenerateActionItems, setActionItems)}
          data-testid={`${testId}-action-items-button`}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          {busy === "action-items" ? "Working…" : "Action items"}
        </Button>
      </div>

      {summary && (
        <div className="rounded-md border border-indigo-500/30 bg-indigo-500/5 p-2.5" data-testid={`${testId}-summary-result`}>
          <p className="whitespace-pre-wrap text-xs text-foreground/90">{summary.summary}</p>
          {onSaveAsNote && (
            <button
              type="button"
              className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-indigo-400 hover:text-indigo-300"
              onClick={() => onSaveAsNote("summary", summary.summary)}
              data-testid={`${testId}-summary-save`}
            >
              <Save className="h-3 w-3" />
              Save to notebook
            </button>
          )}
        </div>
      )}

      {merged && (
        <div className="rounded-md border border-indigo-500/30 bg-indigo-500/5 p-2.5" data-testid={`${testId}-merge-result`}>
          <p className="whitespace-pre-wrap text-xs text-foreground/90">{merged.summary}</p>
          {onSaveAsNote && (
            <button
              type="button"
              className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-indigo-400 hover:text-indigo-300"
              onClick={() => onSaveAsNote("summary", merged.summary)}
              data-testid={`${testId}-merge-save`}
            >
              <Save className="h-3 w-3" />
              Save to notebook
            </button>
          )}
        </div>
      )}

      {takeaways && (
        <div className="rounded-md border border-border/60 p-2.5" data-testid={`${testId}-takeaways-result`}>
          {takeaways.available && (takeaways.takeaways?.length ?? 0) > 0 ? (
            <ul className="list-disc space-y-1 pl-4 text-xs text-foreground/90">
              {takeaways.takeaways!.map((t, i) => (
                <li key={i} data-testid={`${testId}-takeaway-${i}`}>
                  {t}
                  {onSaveAsNote && (
                    <button
                      type="button"
                      className="ml-2 text-[10px] font-medium text-indigo-400 hover:text-indigo-300"
                      onClick={() => onSaveAsNote("finding", t)}
                      data-testid={`${testId}-takeaway-save-${i}`}
                    >
                      Save
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground" data-testid={`${testId}-takeaways-unavailable`}>
              Key takeaways are not available right now.
            </p>
          )}
        </div>
      )}

      {actionItems && (
        <div className="rounded-md border border-border/60 p-2.5" data-testid={`${testId}-action-items-result`}>
          {actionItems.available && (actionItems.actionItems?.length ?? 0) > 0 ? (
            <ul className="list-disc space-y-1 pl-4 text-xs text-foreground/90">
              {actionItems.actionItems!.map((t, i) => (
                <li key={i} data-testid={`${testId}-action-item-${i}`}>
                  {t}
                  {onSaveAsNote && (
                    <button
                      type="button"
                      className="ml-2 text-[10px] font-medium text-indigo-400 hover:text-indigo-300"
                      onClick={() => onSaveAsNote("action_item", t)}
                      data-testid={`${testId}-action-item-save-${i}`}
                    >
                      Save
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground" data-testid={`${testId}-action-items-unavailable`}>
              Action items are not available right now.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
