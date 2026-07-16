import { useCallback, useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ExplainTradeInput, ExplainTradeResult } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Lightbulb, AlertTriangle, Info, Loader2, RefreshCw, Square } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { streamCoach } from "@/lib/coach-stream";
import { Markdown } from "@/components/ui/markdown";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scannerResultId?: number;
  symbol?: string;
  strategy?: ExplainTradeInput["strategy"];
}

type Explanation = ExplainTradeResult["explanation"];

export function TradeExplanationSheet({ open, onOpenChange, scannerResultId, symbol, strategy }: Props) {
  const [explained, setExplained] = useState(false);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [narrative, setNarrative] = useState("");
  const [source, setSource] = useState<ExplainTradeResult["source"] | null>(null);
  // Streaming = a request is in flight. Errored = the stream failed.
  // Whether `explanation` is present disambiguates a pre-meta failure (full
  // retry card) from a narration failure after the numbers already arrived
  // (inline retry that keeps the deterministic numbers on screen).
  const [streaming, setStreaming] = useState(false);
  const [errored, setErrored] = useState(false);
  // True when the user aborted the in-flight stream — any partial narrative
  // stays on screen instead of the perpetual "writing…" loader.
  const [stopped, setStopped] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Run (or re-run) the SSE stream. On retry we keep the existing `explanation`
  // so the deterministic numbers stay visible while the prose reloads — the
  // `meta` event arrives almost immediately and refreshes them anyway.
  const run = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStreaming(true);
    setErrored(false);
    setStopped(false);
    setNarrative("");

    streamCoach(
      "/coach/explain-trade/stream",
      { scannerResultId, symbol, strategy },
      {
        onMeta: (data) => {
          const d = data as { explanation?: Explanation; source?: ExplainTradeResult["source"] };
          if (d.explanation) setExplanation(d.explanation);
          if (d.source) setSource(d.source);
        },
        onDelta: (text) => setNarrative((prev) => prev + text),
        onDone: (data) => {
          const d = data as { narrative?: string; source?: ExplainTradeResult["source"] };
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
  }, [scannerResultId, symbol, strategy]);

  // Auto-fetch via SSE when opened if we haven't yet
  useEffect(() => {
    if (!open || explained) return;
    setExplained(true);
    setExplanation(null);
    setSource(null);
    run();
  }, [open, explained, run]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Abort the in-flight stream, leaving any partial narrative on screen.
  const handleStop = () => {
    abortRef.current?.abort();
    setStreaming(false);
    setStopped(true);
  };

  // Reset when closed
  const handleOpenChange = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      abortRef.current?.abort();
      setTimeout(() => {
        setExplained(false);
        setExplanation(null);
        setNarrative("");
        setSource(null);
        setErrored(false);
        setStreaming(false);
        setStopped(false);
      }, 300);
    }
  };

  // Show the full skeleton only before the deterministic numbers arrive.
  const showSkeleton = !explanation && !errored;
  const showFullRetry = !explanation && errored;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-md md:max-w-xl overflow-hidden flex flex-col bg-card border-l-border">
        <SheetHeader className="shrink-0 pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-400" />
            AI Trade Breakdown
          </SheetTitle>
          <SheetDescription>
            Deterministic options math narrated by DK Option Engine Coach.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {showSkeleton ? (
            <div className="space-y-6">
              <Skeleton className="h-32 w-full bg-secondary" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-16 w-full bg-secondary" />
                <Skeleton className="h-16 w-full bg-secondary" />
              </div>
              <Skeleton className="h-48 w-full bg-secondary" />
            </div>
          ) : showFullRetry ? (
            <RetryNotice
              message="Couldn't load the explanation."
              onRetry={run}
              retrying={streaming}
            />
          ) : explanation ? (
            <div className="space-y-6 pb-6">
              {/* Header Info */}
              <div className="flex flex-wrap gap-2 items-center">
                <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10">
                  {explanation.strategyLabel}
                </Badge>
                <Badge variant="outline" className="border-border">
                  {explanation.symbol} @ ${explanation.underlyingPrice.toFixed(2)}
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

              {/* Narrative — loads separately from the deterministic numbers */}
              <div className="text-foreground/90 leading-relaxed border-l-2 border-indigo-500/50 pl-4">
                {errored ? (
                  <RetryNotice
                    message="Couldn't load the explanation."
                    onRetry={run}
                    retrying={streaming}
                  />
                ) : narrative ? (
                  <>
                    <Markdown>{narrative}</Markdown>
                    {streaming && (
                      <div className="mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleStop}
                          className="h-7 text-xs"
                        >
                          <Square className="w-3 h-3 mr-1.5" /> Stop
                        </Button>
                      </div>
                    )}
                    {stopped && (
                      <p className="not-prose text-[11px] text-muted-foreground/60 mt-2 flex items-center gap-1">
                        <Square className="w-3 h-3" /> Stopped
                      </p>
                    )}
                  </>
                ) : stopped ? (
                  <span className="inline-flex items-center gap-2 text-muted-foreground/70 not-prose">
                    <Square className="w-3.5 h-3.5" />
                    Explanation stopped.
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 text-muted-foreground/70 not-prose">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Writing the explanation…
                  </span>
                )}
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <MetricCard label="POP" value={`${explanation.pop.toFixed(0)}%`} highlight />
                <MetricCard label="Max Loss" value={`$${explanation.maxLoss.toFixed(0)}`} error />
                <MetricCard label="Max Profit" value={`$${explanation.maxProfit.toFixed(0)}`} success />
                <MetricCard label="EV" value={`$${explanation.ev.toFixed(2)}`} />
              </div>

              {/* Greeks Grid */}
              <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-indigo-400" />
                  Greeks Exposure
                </h4>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Delta</p>
                    <p className="font-mono text-sm">{explanation.greeks.delta.toFixed(3)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Gamma</p>
                    <p className="font-mono text-sm">{explanation.greeks.gamma.toFixed(3)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Theta</p>
                    <p className="font-mono text-sm">{explanation.greeks.theta.toFixed(3)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Vega</p>
                    <p className="font-mono text-sm">{explanation.greeks.vega.toFixed(3)}</p>
                  </div>
                </div>
                <div className="text-sm mt-3 text-muted-foreground border-t border-border pt-2 space-y-1">
                  <p>{explanation.greeksPlain.delta}</p>
                  <p>{explanation.greeksPlain.theta}</p>
                  <p>{explanation.greeksPlain.gamma}</p>
                  <p>{explanation.greeksPlain.vega}</p>
                </div>
              </div>

              {/* Assignment Risk */}
              {explanation.assignmentRisk && (
                <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <h4 className="text-sm font-semibold text-orange-400 mb-1 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Assignment Risk
                  </h4>
                  <p className="text-sm text-foreground/80">{explanation.assignmentRisk}</p>
                </div>
              )}

              {/* Key Points */}
              {explanation.keyPoints?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Key Takeaways</h4>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                    {explanation.keyPoints.map((pt, i) => (
                      <li key={i}>{pt}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Separator />

              {/* Disclaimer */}
              <div className="flex items-start gap-2 text-xs text-muted-foreground/70">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{explanation.disclaimer}</p>
              </div>

            </div>
          ) : null}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function RetryNotice({ message, onRetry, retrying }: { message: string; onRetry: () => void; retrying?: boolean }) {
  return (
    <div className="not-prose rounded-md border border-destructive/20 bg-destructive/10 p-4 flex flex-col items-start gap-3">
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

function MetricCard({ label, value, highlight, error, success }: { label: string, value: React.ReactNode, highlight?: boolean, error?: boolean, success?: boolean }) {
  return (
    <div className={`p-3 rounded-lg border ${highlight ? 'border-indigo-500/30 bg-indigo-500/10' : error ? 'border-destructive/30 bg-destructive/10' : success ? 'border-success/30 bg-success/10' : 'border-border bg-secondary/20'}`}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className={`font-mono text-lg font-bold ${highlight ? 'text-indigo-400' : error ? 'text-destructive' : success ? 'text-success' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}
