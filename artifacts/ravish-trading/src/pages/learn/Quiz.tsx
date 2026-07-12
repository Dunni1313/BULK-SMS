import { useState } from "react";
import {
  useGenerateQuiz,
  useGradeQuiz,
  useGetQuizProgress,
  getGetQuizProgressQueryKey,
  QuizInputTopic,
  type QuizProgress,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BrainCircuit, CheckCircle2, XCircle, Info, RefreshCw, TrendingUp, History, Trophy, Flame, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const TOPIC_LABELS: Record<string, string> = {
  mixed: "Mixed Topics",
  greeks: "The Greeks",
  strategy: "Strategies",
  risk: "Risk Mgmt",
};

const topicLabel = (t: string) => TOPIC_LABELS[t] ?? t;

export default function Quiz() {
  const [topic, setTopic] = useState<QuizInputTopic>("mixed");
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const queryClient = useQueryClient();
  const generateQuiz = useGenerateQuiz();
  const gradeQuiz = useGradeQuiz();
  const progress = useGetQuizProgress();

  const handleGenerate = () => {
    setAnswers({});
    gradeQuiz.reset();
    generateQuiz.mutate({ data: { topic, count: 5 } });
  };

  const handleGrade = () => {
    if (!generateQuiz.data) return;
    
    // Convert answers map to array of selected indices in order
    const answerArray = generateQuiz.data.questions.map((q, i) => answers[i] ?? -1);
    
    gradeQuiz.mutate({ 
      data: { 
        quizId: generateQuiz.data.quizId,
        answers: answerArray
      } 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetQuizProgressQueryKey() });
      },
    });
  };

  const quiz = generateQuiz.data;
  const grade = gradeQuiz.data;

  const allAnswered = quiz ? Object.keys(answers).length === quiz.questions.length : false;

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Badge variant="outline" className="text-indigo-400 border-indigo-500/30 bg-indigo-500/10 mb-2">
            <BrainCircuit className="w-3 h-3 mr-1" /> Knowledge Check
          </Badge>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Trading Quiz</h1>
          <p className="text-muted-foreground mt-1">Test your options mechanics and strategy knowledge.</p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={topic} onValueChange={(v: QuizInputTopic) => setTopic(v)} disabled={generateQuiz.isPending}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Topic" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mixed">Mixed Topics</SelectItem>
              <SelectItem value="greeks">The Greeks</SelectItem>
              <SelectItem value="strategy">Strategies</SelectItem>
              <SelectItem value="risk">Risk Mgmt</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={handleGenerate} 
            disabled={generateQuiz.isPending}
            variant="outline"
            className="border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10"
          >
            {generateQuiz.isPending ? "Generating..." : <><RefreshCw className="w-4 h-4 mr-2" /> New Quiz</>}
          </Button>
        </div>
      </div>

      <ProgressPanel progress={progress.data} isLoading={progress.isLoading} />

      {!quiz && !generateQuiz.isPending && (
        <Card className="bg-card border-dashed border-border py-20">
          <CardContent className="flex flex-col items-center justify-center text-muted-foreground">
            <BrainCircuit className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg">Ready to test your knowledge?</p>
            <Button onClick={handleGenerate} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white">
              Start Quiz
            </Button>
          </CardContent>
        </Card>
      )}

      {generateQuiz.isPending && (
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {quiz && !grade && (
        <div className="space-y-6 animate-in fade-in duration-500">
          {quiz.questions.map((q, qIndex) => (
            <Card key={q.id} className="bg-card border-border shadow-md">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-medium leading-relaxed">
                  <span className="text-indigo-400 mr-2">{qIndex + 1}.</span>
                  {q.prompt}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup 
                  value={answers[qIndex]?.toString()} 
                  onValueChange={(val) => setAnswers(prev => ({...prev, [qIndex]: parseInt(val)}))}
                  className="space-y-3"
                >
                  {q.options.map((opt, oIndex) => (
                    <div key={oIndex} className={`flex items-center space-x-3 rounded-md border p-3 cursor-pointer transition-colors ${answers[qIndex] === oIndex ? 'bg-indigo-500/10 border-indigo-500/50' : 'border-border hover:bg-secondary/50'}`} onClick={() => setAnswers(prev => ({...prev, [qIndex]: oIndex}))}>
                      <RadioGroupItem value={oIndex.toString()} id={`q${qIndex}-o${oIndex}`} />
                      <Label htmlFor={`q${qIndex}-o${oIndex}`} className="flex-1 cursor-pointer leading-normal text-sm font-normal">
                        {opt}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-end pt-4">
            <Button 
              size="lg" 
              onClick={handleGrade} 
              disabled={!allAnswered || gradeQuiz.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto"
            >
              {gradeQuiz.isPending ? "Grading..." : "Submit Answers"}
            </Button>
          </div>
        </div>
      )}

      {grade && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
          <Card className={`border-2 ${grade.percent >= 80 ? 'border-success/50 bg-success/5' : grade.percent >= 60 ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-destructive/50 bg-destructive/5'}`}>
            <CardContent className="p-8 text-center space-y-4">
              <h2 className="text-5xl font-bold font-mono">
                <span className={grade.percent >= 80 ? 'text-success' : grade.percent >= 60 ? 'text-yellow-500' : 'text-destructive'}>
                  {grade.score}
                </span>
                <span className="text-muted-foreground text-3xl"> / {grade.total}</span>
              </h2>
              <p className="text-xl font-medium">{grade.message}</p>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {grade.results.map((res, i) => (
              <Card key={res.id} className={`bg-card border ${res.correct ? 'border-success/30' : 'border-destructive/30'}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 shrink-0">
                      {res.correct ? <CheckCircle2 className="w-5 h-5 text-success" /> : <XCircle className="w-5 h-5 text-destructive" />}
                    </div>
                    <CardTitle className="text-base font-medium leading-relaxed">{res.prompt}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pl-14 space-y-4">
                  {!res.correct && (
                    <div className="space-y-1">
                      <p className="text-xs uppercase text-muted-foreground tracking-wider">Your Answer</p>
                      <p className="text-sm text-destructive line-through opacity-80">{res.yourAnswer}</p>
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-xs uppercase text-muted-foreground tracking-wider">Correct Answer</p>
                    <p className="text-sm text-success font-medium">{res.correctAnswer}</p>
                  </div>
                  
                  <div className="p-3 bg-secondary/30 rounded-md border border-border text-sm text-foreground/80 leading-relaxed mt-4">
                    <span className="font-semibold text-indigo-400 mr-2">Explanation:</span>
                    {res.explanation}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground/60 p-4 rounded bg-secondary/20">
            <Info className="w-4 h-4 shrink-0" />
            <p>{grade.disclaimer}</p>
          </div>
          
          <div className="flex justify-center pt-4">
            <Button onClick={handleGenerate} variant="outline" className="border-indigo-500/50 text-indigo-400">
              <RefreshCw className="w-4 h-4 mr-2" /> Take Another Quiz
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const TOPIC_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "greeks", label: "The Greeks" },
  { value: "strategy", label: "Strategies" },
  { value: "risk", label: "Risk Mgmt" },
];

function ProgressPanel({ progress, isLoading }: { progress?: QuizProgress; isLoading: boolean }) {
  const [filter, setFilter] = useState<string>("all");

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!progress || progress.totalAttempts === 0) return null;

  // Narrow the attempt history to the selected topic (newest-first as returned).
  const filteredAttempts =
    filter === "all" ? progress.attempts : progress.attempts.filter((a) => a.topic === filter);

  // Header stats reflect the active filter so the trend reads true per subject.
  const filteredCount = filteredAttempts.length;
  const filteredAverage =
    filteredCount === 0 ? 0 : filteredAttempts.reduce((sum, a) => sum + a.percent, 0) / filteredCount;

  // Build the trend series in chronological order (attempts arrive newest-first).
  const trend = [...filteredAttempts]
    .reverse()
    .map((a, i) => ({
      idx: i + 1,
      percent: Math.round(a.percent),
      label: new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    }));

  const recent = filteredAttempts.slice(0, 8);

  const filterLabel = TOPIC_FILTERS.find((f) => f.value === filter)?.label ?? "All";

  // Motivational stats are global (all topics), so they read the same regardless
  // of the active topic filter.
  const streak = progress.streak ?? 0;
  const improvement = Math.round(progress.improvement ?? 0);
  const showImprovement = progress.totalAttempts >= 2;

  return (
    <Card className="bg-card border-border shadow-md">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" /> Your Progress
            </CardTitle>
            <CardDescription className="mt-1">
              {filter === "all" ? (
                <>
                  {progress.totalAttempts} {progress.totalAttempts === 1 ? "attempt" : "attempts"} logged · average{" "}
                  <span className="font-mono text-foreground">{Math.round(progress.averagePercent)}%</span>
                </>
              ) : (
                <>
                  {filteredCount} {filteredCount === 1 ? "attempt" : "attempts"} in {filterLabel} · average{" "}
                  <span className="font-mono text-foreground">{Math.round(filteredAverage)}%</span>
                </>
              )}
            </CardDescription>
          </div>

          {/* Motivational badges: day streak + improvement since first attempt */}
          <div className="flex items-center gap-2 shrink-0">
            <StreakBadge streak={streak} />
            {showImprovement && <ImprovementBadge improvement={improvement} />}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Topic filter */}
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => v && setFilter(v)}
          variant="outline"
          className="flex-wrap justify-start gap-2"
        >
          {TOPIC_FILTERS.map((f) => (
            <ToggleGroupItem
              key={f.value}
              value={f.value}
              size="sm"
              className="data-[state=on]:bg-indigo-500/15 data-[state=on]:text-indigo-300 data-[state=on]:border-indigo-500/50"
            >
              {f.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {/* Best score per topic */}
        <div>
          <p className="text-xs uppercase text-muted-foreground tracking-wider mb-3 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5" /> Best Score by Topic
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {progress.bestByTopic.map((t) => (
              <div key={t.topic} className="rounded-md border border-border bg-secondary/20 p-3">
                <p className="text-xs text-muted-foreground truncate">{topicLabel(t.topic)}</p>
                <p className="text-2xl font-bold font-mono text-foreground mt-1">{Math.round(t.bestPercent)}%</p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                  {t.attempts} {t.attempts === 1 ? "try" : "tries"}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Empty state for a topic with no logged attempts yet */}
        {filteredAttempts.length === 0 && (
          <div className="rounded-md border border-dashed border-border bg-secondary/10 p-6 text-center text-sm text-muted-foreground">
            No attempts in {filterLabel} yet. Take a {filterLabel} quiz to start tracking this topic.
          </div>
        )}

        {/* Trend */}
        {trend.length >= 2 && (
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wider mb-3">Score Trend</p>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [`${v}%`, "Score"]}
                  />
                  <Line type="monotone" dataKey="percent" stroke="#818cf8" strokeWidth={2} dot={{ r: 3, fill: "#818cf8" }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Recent attempts */}
        {recent.length > 0 && (
        <div>
          <p className="text-xs uppercase text-muted-foreground tracking-wider mb-3 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" /> Recent Attempts
          </p>
          <div className="space-y-1.5">
            {recent.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border border-border bg-secondary/10 px-3 py-2 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <Badge variant="outline" className="text-indigo-400 border-indigo-500/30 bg-indigo-500/10 shrink-0">
                    {topicLabel(a.topic)}
                  </Badge>
                  <span className="text-muted-foreground text-xs truncate">
                    {new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-muted-foreground text-xs font-mono">
                    {a.score}/{a.total}
                  </span>
                  <span
                    className={`font-mono font-semibold ${
                      a.percent >= 80 ? "text-success" : a.percent >= 60 ? "text-yellow-500" : "text-destructive"
                    }`}
                  >
                    {Math.round(a.percent)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}
      </CardContent>
    </Card>
  );
}

// Day-streak badge — consecutive calendar days with at least one quiz attempt.
function StreakBadge({ streak }: { streak: number }) {
  const active = streak > 0;
  return (
    <div
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 ${
        active
          ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
          : "border-border bg-secondary/20 text-muted-foreground"
      }`}
      title={
        active
          ? `${streak}-day quiz streak — come back tomorrow to keep it going!`
          : "No active streak. Take a quiz today to start one!"
      }
    >
      <Flame className={`w-4 h-4 ${active ? "" : "opacity-50"}`} />
      <span className="text-sm font-semibold font-mono">{streak}</span>
      <span className="text-xs">{streak === 1 ? "day" : "days"}</span>
    </div>
  );
}

// Improvement badge — percentage-point change since the learner's first attempt.
function ImprovementBadge({ improvement }: { improvement: number }) {
  const up = improvement > 0;
  const down = improvement < 0;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  const tone = up
    ? "border-success/40 bg-success/10 text-success"
    : down
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : "border-border bg-secondary/20 text-muted-foreground";
  const sign = up ? "+" : "";
  return (
    <div
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 ${tone}`}
      title={
        up
          ? `You've improved ${improvement}% since your first attempt — keep it up!`
          : down
            ? `Down ${Math.abs(improvement)}% from your first attempt. A quick review can turn it around.`
            : "Even with your first attempt. Take another quiz to move the needle."
      }
    >
      <Icon className="w-4 h-4" />
      <span className="text-sm font-semibold font-mono">
        {sign}
        {improvement}%
      </span>
      <span className="text-xs">since start</span>
    </div>
  );
}
