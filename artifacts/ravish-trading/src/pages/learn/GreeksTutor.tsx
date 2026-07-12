import { useCallback, useEffect, useRef, useState } from "react";
import { useGetGreeksOverview, getGetGreeksOverviewQueryKey, TeachGreekInputGreek, TeachGreekResult } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Lightbulb, Info, Loader2, RefreshCw, AlertTriangle, Square } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { streamCoach } from "@/lib/coach-stream";
import { Markdown } from "@/components/ui/markdown";

type Lesson = TeachGreekResult["lesson"];

export default function GreeksTutor() {
  const { data: overview, isLoading: overviewLoading } = useGetGreeksOverview({ query: { queryKey: getGetGreeksOverviewQueryKey() } });
  
  const [selectedGreek, setSelectedGreek] = useState<TeachGreekInputGreek | "">("");
  const [symbol, setSymbol] = useState<string>("SPY");

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [narrative, setNarrative] = useState("");
  const [source, setSource] = useState<TeachGreekResult["source"] | null>(null);
  // Streaming = a request is in flight. Errored = the stream failed. Whether
  // `lesson` is present tells a pre-meta failure (full retry card) apart from a
  // narration failure after the deterministic lesson already rendered (inline
  // retry that keeps the lesson on screen).
  const [streaming, setStreaming] = useState(false);
  const [errored, setErrored] = useState(false);
  // True when the user aborted the in-flight stream — any partial narrative
  // stays on screen instead of the perpetual "writing…" loader.
  const [stopped, setStopped] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Run (or re-run) the SSE stream. On retry the existing `lesson` stays on
  // screen — the `meta` event refreshes it almost immediately while the prose
  // reloads separately.
  const run = useCallback(() => {
    if (!selectedGreek) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStreaming(true);
    setErrored(false);
    setStopped(false);
    setNarrative("");

    streamCoach(
      "/coach/teach-greek/stream",
      { greek: selectedGreek, symbol },
      {
        onMeta: (data) => {
          const d = data as { lesson?: Lesson; source?: TeachGreekResult["source"] };
          if (d.lesson) setLesson(d.lesson);
          if (d.source) setSource(d.source);
        },
        onDelta: (text) => setNarrative((prev) => prev + text),
        onDone: (data) => {
          const d = data as { narrative?: string; source?: TeachGreekResult["source"] };
          if (typeof d.narrative === "string") setNarrative(d.narrative);
          if (d.source) setSource(d.source);
          setStreaming(false);
        },
        onError: () => {
          setErrored(true);
          setStreaming(false);
        },
      },
      controller.signal,
    ).catch(() => {
      if (controller.signal.aborted) return;
      setErrored(true);
      setStreaming(false);
    });
  }, [selectedGreek, symbol]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // New selection: clear the previous lesson so the skeleton shows, then stream.
  const handleTeach = () => {
    if (!selectedGreek) return;
    setLesson(null);
    setSource(null);
    run();
  };

  // Abort the in-flight stream, leaving any partial narrative on screen.
  const handleStop = () => {
    abortRef.current?.abort();
    setStreaming(false);
    setStopped(true);
  };

  const teachGreek = {
    isPending: streaming,
    data: lesson && source ? { lesson, narrative, source } : null,
  };

  // Full skeleton only before the deterministic lesson arrives.
  const showSkeleton = streaming && !lesson && !errored;
  const showFullRetry = errored && !lesson;
  const showEmpty = !lesson && !streaming && !errored;

  const SYMBOLS = ["SPY", "QQQ", "IWM", "NVDA", "META", "AAPL", "AMZN", "MSFT", "GOOGL", "TSLA"];

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 pb-12">
      {/* Sidebar Overview */}
      <div className="lg:col-span-4 space-y-6">
        <div>
          <Badge variant="outline" className="text-indigo-400 border-indigo-500/30 bg-indigo-500/10 mb-3">
            <Bot className="w-3 h-3 mr-1" /> Greeks Tutor
          </Badge>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">The Greeks</h1>
          <p className="text-muted-foreground mt-2 text-sm">Master the engines of options pricing.</p>
        </div>

        {overviewLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full bg-secondary" />
            <Skeleton className="h-24 w-full bg-secondary" />
          </div>
        ) : overview ? (
          <div className="prose prose-sm prose-invert text-muted-foreground">
            {overview.sections.map((sec, i) => (
              <div key={i} className="mb-4">
                <h3 className="text-foreground font-semibold text-base mb-1">{sec.heading}</h3>
                <p>{sec.body}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Interactive Tutor */}
      <div className="lg:col-span-8">
        <Card className="bg-card border-border shadow-lg">
          <CardHeader className="bg-secondary/20 border-b border-border pb-6">
            <CardTitle>Interactive Tutor</CardTitle>
            <CardDescription>Select a Greek and a symbol to get a personalized, real-world breakdown.</CardDescription>
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <Select value={selectedGreek} onValueChange={(v: TeachGreekInputGreek) => setSelectedGreek(v)}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Select a Greek..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="delta">Delta (Δ)</SelectItem>
                  <SelectItem value="gamma">Gamma (Γ)</SelectItem>
                  <SelectItem value="theta">Theta (Θ)</SelectItem>
                  <SelectItem value="vega">Vega (V)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Symbol..." />
                </SelectTrigger>
                <SelectContent>
                  {SYMBOLS.map(sym => (
                    <SelectItem key={sym} value={sym}>{sym}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {teachGreek.isPending ? (
                <Button
                  onClick={handleStop}
                  variant="destructive"
                  title="Stop generating"
                >
                  <Square className="w-4 h-4 mr-2" /> Stop
                </Button>
              ) : (
                <Button
                  onClick={handleTeach}
                  disabled={!selectedGreek}
                  className="bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Teach Me
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6 min-h-[400px]">
            {showEmpty && (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 py-20">
                <Lightbulb className="w-12 h-12 mb-4" />
                <p>Select a Greek and symbol above to begin the lesson.</p>
              </div>
            )}

            {showSkeleton && (
              <div className="space-y-6">
                <Skeleton className="h-8 w-1/3 bg-secondary" />
                <Skeleton className="h-4 w-full bg-secondary" />
                <Skeleton className="h-4 w-5/6 bg-secondary" />
                <div className="p-4 bg-secondary rounded-lg">
                  <Skeleton className="h-20 w-full bg-background/50" />
                </div>
              </div>
            )}

            {showFullRetry && (
              <div className="py-12 flex justify-center">
                <RetryNotice message="Couldn't load the lesson." onRetry={run} retrying={streaming} />
              </div>
            )}

            {lesson && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-3xl font-bold text-foreground capitalize">
                    {lesson.greek}
                  </h2>
                  <Badge variant="outline" className="border-indigo-500/30 text-indigo-400">
                    {lesson.symbol} Example
                  </Badge>
                  {source === "template" && (
                    <Badge variant="outline" className="border-muted text-muted-foreground bg-muted/20">
                      Built-in
                    </Badge>
                  )}
                  {source === "llm" && (
                    <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10">
                      AI
                    </Badge>
                  )}
                </div>
                
                <p className="text-xl text-foreground/80 font-serif italic border-l-4 border-indigo-500 pl-4 py-1">
                  "{lesson.oneLiner}"
                </p>

                <div>
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Formal Definition</h4>
                  <p className="text-foreground/90">{lesson.definition}</p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">For Premium Sellers</h4>
                  <p className="text-foreground/90">{lesson.forPremiumSellers}</p>
                </div>

                <div className="p-5 rounded-lg bg-indigo-500/5 border border-indigo-500/20">
                  <h4 className="text-sm font-semibold text-indigo-400 mb-2 flex items-center gap-2">
                    <Bot className="w-4 h-4" /> Example: {lesson.symbol}
                  </h4>
                  <div className="mb-4">
                    <p className="text-3xl font-mono font-bold text-foreground">
                      {lesson.exampleValue}
                    </p>
                  </div>
                  <p className="text-sm text-foreground/80">{lesson.example}</p>
                </div>

                {/* Narrative — loads separately from the deterministic lesson */}
                <div>
                  {errored ? (
                    <RetryNotice message="Couldn't load the explanation." onRetry={run} retrying={streaming} />
                  ) : narrative ? (
                    <div className="text-muted-foreground">
                      <Markdown>{narrative}</Markdown>
                      {stopped && (
                        <p className="text-[11px] text-muted-foreground/60 mt-2 flex items-center gap-1">
                          <Square className="w-3 h-3" /> Stopped
                        </p>
                      )}
                    </div>
                  ) : stopped ? (
                    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground/70">
                      <Square className="w-3.5 h-3.5" />
                      Explanation stopped.
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground/70">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Writing the explanation…
                    </span>
                  )}
                </div>

                <Separator />

                <div className="flex items-start gap-2 text-xs text-muted-foreground/60 p-4 rounded bg-secondary/20">
                  <Info className="w-4 h-4 shrink-0" />
                  <p>{lesson.disclaimer}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RetryNotice({ message, onRetry, retrying }: { message: string; onRetry: () => void; retrying?: boolean }) {
  return (
    <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 flex flex-col items-start gap-3">
      <div className="flex items-center gap-2 text-sm text-destructive">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>{message}</span>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onRetry}
        disabled={retrying}
        className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        {retrying ? (
          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
        ) : (
          <RefreshCw className="w-3.5 h-3.5 mr-2" />
        )}
        Retry
      </Button>
    </div>
  );
}
