// AI Teacher & Learning Centre sprint — originally a private component
// inside pages/learn/DeltaMasterclass.tsx. Extracted here, unmodified in
// its own rendering logic, in v1.4.0 Sprint L2B so LessonRenderer.tsx's new
// Knowledge Check section could reuse the exact same instant-feedback
// quiz-card UI instead of re-implementing it — the same "reuse, don't
// duplicate" discipline this whole Learning Centre has followed since
// Sprint L1's own RelatedGlossaryBadges extraction.
//
// Client-side ungraded comprehension check — the answer key ships with the
// lesson content (this is study material, not a server-authoritative
// quiz). Typed structurally (prompt/options/correctIndex/explanation)
// rather than importing a single named generated type, so it accepts both
// the pre-existing LearnQuizQuestion (DeltaMasterclass's own quiz) and the
// new LearningTopicQuizQuestion (LessonRenderer's Knowledge Check) without
// coupling the two, otherwise-independent content domains together.

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

export interface QuizCardQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export function QuizCard({
  question,
  index,
  onAnswered,
}: {
  question: QuizCardQuestion;
  index: number;
  /** Fired once, the first time this question is answered — lets a caller
   * (e.g. a Knowledge Check's own completion tracking) observe progress
   * without this component knowing anything about progress tracking
   * itself. Never called again if the user picks "Try again". */
  onAnswered?: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;

  return (
    <Card className="bg-card/60 border-border" data-testid={`quiz-card-${index}`}>
      <CardContent className="pt-5 space-y-3">
        <p className="text-sm font-medium text-foreground">
          <span className="text-indigo-400 font-mono mr-2">Q{index + 1}.</span>
          {question.prompt}
        </p>
        <div className="grid grid-cols-1 gap-2">
          {question.options.map((opt, i) => {
            const isCorrect = i === question.correctIndex;
            const isPicked = i === selected;
            let cls = "border-border bg-background/50 hover:border-indigo-500/40";
            if (answered && isCorrect) cls = "border-success/50 bg-success/10 text-success";
            else if (answered && isPicked) cls = "border-destructive/50 bg-destructive/10 text-destructive";
            else if (answered) cls = "border-border bg-background/30 opacity-70";
            return (
              <button
                key={i}
                type="button"
                disabled={answered}
                onClick={() => {
                  setSelected(i);
                  onAnswered?.(i === question.correctIndex);
                }}
                data-testid={`quiz-card-${index}-option-${i}`}
                className={`flex items-center justify-between gap-2 text-left text-sm rounded-md border px-3 py-2 transition-colors disabled:cursor-default ${cls}`}
              >
                <span>{opt}</span>
                {answered && isCorrect && <Check className="w-4 h-4 shrink-0" />}
                {answered && isPicked && !isCorrect && <X className="w-4 h-4 shrink-0" />}
              </button>
            );
          })}
        </div>
        {answered && (
          <div className="rounded-md bg-indigo-500/5 border border-indigo-500/20 p-3 text-sm text-foreground/80" data-testid={`quiz-card-${index}-explanation`}>
            <p>{question.explanation}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(null)}
              className="mt-2 h-7 px-2 text-xs text-indigo-400 hover:bg-indigo-500/10"
            >
              Try again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
