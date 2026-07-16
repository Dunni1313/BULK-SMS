import { useState } from "react";
import { useGetDeltaMasterclass, getGetDeltaMasterclassQueryKey, LearnQuizQuestion } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Info, CheckCircle2, Calculator, BrainCircuit, Check, X } from "lucide-react";

export default function DeltaMasterclass() {
  const { data: lesson, isLoading, isError } = useGetDeltaMasterclass({ query: { queryKey: getGetDeltaMasterclassQueryKey() } });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-12 w-3/4 bg-secondary" />
        <Skeleton className="h-6 w-1/2 bg-secondary" />
        <div className="space-y-4 pt-8">
          <Skeleton className="h-32 w-full bg-secondary" />
          <Skeleton className="h-32 w-full bg-secondary" />
          <Skeleton className="h-32 w-full bg-secondary" />
        </div>
      </div>
    );
  }

  if (isError || !lesson) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Failed to load the masterclass. Please try again.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="mb-8 space-y-4">
        <Badge variant="outline" className="text-indigo-400 border-indigo-500/30 bg-indigo-500/10">
          <BookOpen className="w-3 h-3 mr-1" /> Core Concept
        </Badge>
        <h1 className="text-4xl font-bold text-foreground tracking-tight">{lesson.title}</h1>
        <p className="text-xl text-muted-foreground">{lesson.subtitle}</p>
      </div>

      <div className="space-y-12">
        {lesson.sections.map((section, idx) => (
          <section key={idx} className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <span className="text-indigo-500/50 text-xl font-mono">{String(idx + 1).padStart(2, '0')}</span>
              {section.heading}
            </h2>
            <div className="prose prose-invert prose-indigo max-w-none text-foreground/80 leading-relaxed">
              {section.body.split('\n').map((paragraph, pIdx) => (
                <p key={pIdx}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}

        {lesson.workedExamples && lesson.workedExamples.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <Calculator className="w-6 h-6 text-indigo-400" />
              Worked Examples
            </h2>
            <p className="text-sm text-muted-foreground">
              How strike-delta selection reshapes the same idea across four structures — using live deterministic numbers.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lesson.workedExamples.map((ex, i) => (
                <Card key={i} className="bg-card/60 border-border">
                  <CardContent className="pt-5">
                    <h3 className="text-sm font-bold text-indigo-400 mb-2">{ex.heading}</h3>
                    <p className="text-sm text-foreground/80 leading-relaxed">{ex.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {lesson.quiz && lesson.quiz.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <BrainCircuit className="w-6 h-6 text-indigo-400" />
              Check Your Understanding
            </h2>
            <div className="space-y-4">
              {lesson.quiz.map((q, i) => (
                <QuizCard key={i} question={q} index={i} />
              ))}
            </div>
          </section>
        )}

        <Card className="bg-indigo-500/5 border-indigo-500/20 mt-12">
          <CardContent className="pt-6">
            <h3 className="text-lg font-bold text-indigo-400 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Key Takeaways
            </h3>
            <ul className="space-y-3">
              {lesson.keyPoints.map((pt, i) => (
                <li key={i} className="flex items-start gap-3 text-foreground/90">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2" />
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="flex items-start gap-2 text-xs text-muted-foreground/60 p-4 rounded bg-secondary/20">
          <Info className="w-4 h-4 shrink-0" />
          <p>{lesson.disclaimer}</p>
        </div>
      </div>
    </div>
  );
}

// Client-side ungraded comprehension check — the answer key ships with the
// lesson content (this is study material, not a server-authoritative quiz).
function QuizCard({ question, index }: { question: LearnQuizQuestion; index: number }) {
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;

  return (
    <Card className="bg-card/60 border-border">
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
                onClick={() => setSelected(i)}
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
          <div className="rounded-md bg-indigo-500/5 border border-indigo-500/20 p-3 text-sm text-foreground/80">
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
