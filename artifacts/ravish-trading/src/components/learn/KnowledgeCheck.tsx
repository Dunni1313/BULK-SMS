// v1.4.0, Sprint L2B — Learning Centre.
//
// A lightweight, lesson-level Knowledge Check: 5-10 multiple-choice
// questions rendered via the shared QuizCard (components/learn/QuizCard.tsx,
// itself extracted from DeltaMasterclass.tsx this same sprint) — no new quiz
// engine, per the approved scope. Self-contained, following BookmarkButton's
// own established pattern rather than LessonRenderer's prop-driven
// onMarkComplete: it owns its own useGetLearningProgress()/
// useRecordLearningItemCompleted() and reads/writes learning_progress
// directly via the existing itemType="knowledge-check" value
// (learningProgress.ts) — no new persistence layer, no new table.
//
// Completion is ungraded and ungated, consistent with QuizCard's own
// "client-side comprehension check, not a scored exam" design: once every
// question has been answered at least once (right or wrong — a "Try again"
// re-answer never un-completes it), the Knowledge Check is marked complete
// exactly once. A running "X of N correct on first try" score is shown for
// the learner's own benefit only; it never blocks or delays completion.

import { useEffect, useState } from "react";
import {
  useRecordLearningItemCompleted,
  useGetLearningProgress,
  getGetLearningProgressQueryKey,
  type LearningTopicQuizQuestion,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { QuizCard } from "./QuizCard";
import { BrainCircuit, CheckCircle2 } from "lucide-react";

export function KnowledgeCheck({ topicKey, questions }: { topicKey: string; questions: LearningTopicQuizQuestion[] }) {
  const { data: progress } = useGetLearningProgress();
  const queryClient = useQueryClient();
  const recordCompleted = useRecordLearningItemCompleted();
  const [answered, setAnswered] = useState<Record<number, boolean>>({});
  const [firedComplete, setFiredComplete] = useState(false);

  const alreadyCompleted = (progress?.completedKnowledgeCheckKeys ?? []).includes(topicKey);
  const answeredCount = Object.keys(answered).length;
  const correctCount = Object.values(answered).filter(Boolean).length;
  const allAnswered = answeredCount >= questions.length;

  const handleAnswered = (index: number, correct: boolean) => {
    setAnswered((prev) => {
      // Only the first answer per question counts toward "X of N correct" —
      // hitting "Try again" and re-answering never changes a question's
      // already-recorded first-attempt result.
      if (index in prev) return prev;
      return { ...prev, [index]: correct };
    });
  };

  useEffect(() => {
    if (firedComplete || alreadyCompleted || !allAnswered || questions.length === 0) return;
    setFiredComplete(true);
    recordCompleted.mutate(
      { data: { itemType: "knowledge-check", itemKey: topicKey } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetLearningProgressQueryKey() }) },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAnswered, alreadyCompleted, firedComplete, questions.length, topicKey]);

  const isComplete = alreadyCompleted || firedComplete;

  return (
    <div className="space-y-3" data-testid={`knowledge-check-${topicKey}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-medium text-foreground/90">
            {answeredCount} of {questions.length} answered
            {answeredCount > 0 && ` — ${correctCount} correct on first try`}
          </span>
        </div>
        {isComplete && (
          <Badge
            className="text-[9px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30 flex items-center gap-1"
            data-testid={`badge-knowledge-check-complete-${topicKey}`}
          >
            <CheckCircle2 className="w-2.5 h-2.5" /> Knowledge Check Complete
          </Badge>
        )}
      </div>
      <div className="space-y-3">
        {questions.map((q, i) => (
          <QuizCard key={i} question={q} index={i} onAnswered={(correct) => handleAnswered(i, correct)} />
        ))}
      </div>
    </div>
  );
}
