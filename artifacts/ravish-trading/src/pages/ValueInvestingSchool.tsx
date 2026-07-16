import { useState } from "react";
import {
  useGetValueLessons,
  useGenerateValueQuiz,
  useGradeValueQuiz,
  ValueLesson,
  ValueLessonLevel,
  GeneratedValueQuiz,
  ValueQuizGradeResult,
  ValueQuizInputTopic,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, BookOpen, BrainCircuit, CheckCircle2, XCircle, RotateCcw, Lightbulb } from "lucide-react";

function levelColor(level: ValueLessonLevel): string {
  switch (level) {
    case "beginner":
      return "border-emerald-500/30 text-emerald-400 bg-emerald-500/10";
    case "intermediate":
      return "border-sky-500/30 text-sky-400 bg-sky-500/10";
    case "advanced":
      return "border-amber-500/30 text-amber-400 bg-amber-500/10";
    default:
      return "border-border text-muted-foreground";
  }
}

function LessonCard({ lesson }: { lesson: ValueLesson }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3 cursor-pointer" onClick={() => setOpen((o) => !o)}>
        <CardTitle className="text-sm flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="flex-1">{lesson.title}</span>
          <Badge variant="outline" className={`text-[9px] uppercase ${levelColor(lesson.level)}`}>
            {lesson.level}
          </Badge>
        </CardTitle>
        <CardDescription className="text-[11px]">{lesson.summary}</CardDescription>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          {lesson.body.map((p, i) => (
            <p key={i} className="text-xs text-muted-foreground leading-relaxed">
              {p}
            </p>
          ))}
          <div className="rounded-md border border-indigo-500/20 bg-indigo-500/5 p-3 flex gap-2">
            <Lightbulb className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-xs text-foreground/90">
              <span className="font-semibold text-indigo-400">Takeaway: </span>
              {lesson.takeaway}
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function ValueInvestingSchool() {
  const { data: lessonsData, isLoading: lessonsLoading } = useGetValueLessons();
  const generateQuiz = useGenerateValueQuiz();
  const gradeQuiz = useGradeValueQuiz();
  const { toast } = useToast();

  const [topic, setTopic] = useState<ValueQuizInputTopic>(ValueQuizInputTopic.mixed);
  const [quiz, setQuiz] = useState<GeneratedValueQuiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<ValueQuizGradeResult | null>(null);

  const startQuiz = () => {
    setResult(null);
    setAnswers({});
    generateQuiz.mutate(
      { data: { topic, count: 5 } },
      {
        onSuccess: (data) => setQuiz(data),
        onError: () => toast({ title: "Failed to generate quiz", variant: "destructive" }),
      },
    );
  };

  const submitQuiz = () => {
    if (!quiz) return;
    const ordered = quiz.questions.map((q) => answers[q.id] ?? -1);
    gradeQuiz.mutate(
      { data: { quizId: quiz.quizId, answers: ordered } },
      {
        onSuccess: (data) => setResult(data),
        onError: () => toast({ title: "Failed to grade quiz", variant: "destructive" }),
      },
    );
  };

  const resetQuiz = () => {
    setQuiz(null);
    setAnswers({});
    setResult(null);
  };

  const allAnswered = quiz ? quiz.questions.every((q) => answers[q.id] != null) : false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-indigo-400" /> Value Investing School
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-amber-500/15 text-amber-400 border-amber-500/30">
            Education
          </Badge>
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Learn the long-term, business-first mindset behind value investing — moats, intrinsic value, margin of
          safety, and temperament. Education only; nothing here is a recommendation to buy or sell.
        </p>
      </div>

      <Tabs defaultValue="lessons">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="lessons" className="text-xs">
            Lessons
          </TabsTrigger>
          <TabsTrigger value="quiz" className="text-xs">
            Quiz
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lessons" className="mt-4">
          {lessonsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(lessonsData?.lessons ?? []).map((l) => (
                <LessonCard key={l.id} lesson={l} />
              ))}
              {lessonsData?.disclaimer && (
                <p className="text-[11px] text-muted-foreground/80 border-t border-border pt-3">
                  {lessonsData.disclaimer}
                </p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="quiz" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-indigo-400" /> Test Your Understanding
              </CardTitle>
              <CardDescription className="text-[11px]">
                A short quiz on value-investing concepts. Grading is server-authoritative.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!quiz ? (
                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Topic
                    </label>
                    <Select value={topic} onValueChange={(v) => setTopic(v as ValueQuizInputTopic)}>
                      <SelectTrigger className="h-9 w-[180px] bg-background text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ValueQuizInputTopic.mixed}>Mixed</SelectItem>
                        <SelectItem value={ValueQuizInputTopic.moats}>Moats</SelectItem>
                        <SelectItem value={ValueQuizInputTopic.valuation}>Valuation</SelectItem>
                        <SelectItem value={ValueQuizInputTopic.philosophy}>Philosophy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={startQuiz}
                    disabled={generateQuiz.isPending}
                    className="h-9 bg-indigo-600 hover:bg-indigo-700 text-sm"
                  >
                    {generateQuiz.isPending ? "Loading…" : "Start Quiz"}
                  </Button>
                </div>
              ) : result ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-background/50 p-4 text-center">
                    <div className="text-3xl font-bold text-foreground">
                      {result.score}/{result.total}
                    </div>
                    <div className="text-sm text-indigo-400 font-medium">{Math.round(result.percent)}%</div>
                    <p className="text-xs text-muted-foreground mt-1">{result.message}</p>
                  </div>
                  <div className="space-y-3">
                    {result.results.map((r, idx) => (
                      <div key={r.id} className="rounded-md border border-border/60 bg-background/40 p-3">
                        <div className="flex items-start gap-2">
                          {r.correct ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground">
                              {idx + 1}. {r.prompt}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">{r.explanation}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" onClick={resetQuiz} className="h-9 text-sm border-border">
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> New Quiz
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  {quiz.questions.map((q, idx) => (
                    <div key={q.id} className="space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        {idx + 1}. {q.prompt}
                      </p>
                      <RadioGroup
                        value={answers[q.id]?.toString() ?? ""}
                        onValueChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: Number(v) }))}
                        className="space-y-1.5"
                      >
                        {q.options.map((opt, oi) => (
                          <label
                            key={oi}
                            className="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-3 py-2 cursor-pointer hover:border-indigo-500/30"
                          >
                            <RadioGroupItem value={oi.toString()} id={`${q.id}-${oi}`} />
                            <span className="text-xs text-foreground/90">{opt}</span>
                          </label>
                        ))}
                      </RadioGroup>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={submitQuiz}
                      disabled={!allAnswered || gradeQuiz.isPending}
                      className="h-9 bg-indigo-600 hover:bg-indigo-700 text-sm"
                    >
                      {gradeQuiz.isPending ? "Grading…" : "Submit Answers"}
                    </Button>
                    <Button variant="outline" onClick={resetQuiz} className="h-9 text-sm border-border">
                      Cancel
                    </Button>
                  </div>
                  {quiz.disclaimer && (
                    <p className="text-[11px] text-muted-foreground/80 border-t border-border pt-3">{quiz.disclaimer}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
