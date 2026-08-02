// v1.5.0 Sprint 2 — AI Coach Framework. A generic, presentational
// "suggestion card" row: clickable pre-filled-question chips. Extracted
// from components/coach/TradingCoachSuggestedPrompts.tsx (which renders
// byte-identical markup for the AI Trading Assistant specifically) so a
// future specialist coach (Investing/Portfolio/Options AI Coach) can reuse
// this exact building block directly instead of hand-rolling its own copy.
//
// Deliberately new code, not a rewrite of the existing component —
// TradingCoachSuggestedPrompts.tsx is left completely untouched (it still
// owns its own `trading-coach-suggested-prompt*` test ids, verified by its
// own passing test suite) since this sprint's mandate is "keep existing
// behaviour identical." A future cleanup pass could turn it into a thin
// wrapper over this shared component; that is not required for this sprint
// and is not done here.

import { Badge } from "@/components/ui/badge";

export interface CoachSuggestionChipsProps {
  /** The suggestion strings to render as chips. Renders nothing when empty. */
  suggestions: string[];
  /** Called with the selected suggestion's exact text. */
  onSelect: (suggestion: string) => void;
  /** Disables selection (e.g. while a reply is already streaming). */
  disabled?: boolean;
  /** Base data-testid — the container gets this value; each chip gets
   * `${testId}-${suggestion}`. Defaults to "coach-suggestion-chips". */
  testId?: string;
}

export function CoachSuggestionChips({
  suggestions,
  onSelect,
  disabled,
  testId = "coach-suggestion-chips",
}: CoachSuggestionChipsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5" data-testid={testId}>
      {suggestions.map((suggestion) => (
        <Badge
          key={suggestion}
          variant="outline"
          className={`cursor-pointer border-indigo-500/30 px-2.5 py-1 text-[11px] text-indigo-400 hover:bg-indigo-500/10 ${
            disabled ? "pointer-events-none opacity-50" : ""
          }`}
          onClick={() => !disabled && onSelect(suggestion)}
          data-testid={`${testId}-${suggestion}`}
        >
          {suggestion}
        </Badge>
      ))}
    </div>
  );
}
