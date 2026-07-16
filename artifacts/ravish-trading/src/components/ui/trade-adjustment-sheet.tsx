import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { TradeAdjustment } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrench, AlertTriangle, Info, Loader2, RefreshCw, CheckCircle2, Activity, Repeat } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { streamCoach } from "@/lib/coach-stream";
import { Markdown } from "@/components/ui/markdown";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tradeId?: number;
}

type Source = "llm" | "template" | null;

const ROLLABLE_ACTIONS = new Set(["roll_threatened", "roll_untested", "convert"]);

export function TradeAdjustmentSheet({ open, onOpenChange, tradeId }: Props) {
  const [, setLocation] = useLocation();
  const [loaded, setLoaded] = useState(false);
  const [adjustment, setAdjustment] = useState<TradeAdjustment | null>(null);
  const [narrative, setNarrative] = useState("");
  const [source, setSource] = useState<Source>(null);
  const [streaming, setStreaming] = useState(false);
  const [errored, setErrored] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(() => {
    if (tradeId == null) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStreaming(true);
    setErrored(false);
    setNarrative("");

    streamCoach(
      `/trades/${tradeId}/adjustment/stream`,
      {},
      {
        onMeta: (data) => {
          setAdjustment(data as TradeAdjustment);
        },
        onDelta: (text) => setNarrative((prev) => prev + text),
        onDone: (data) => {
          const d = data as { text?: string; source?: Source; adjustment?: TradeAdjustment };
          if (typeof d.text === "string") setNarrative(d.text);
          if (d.source) setSource(d.source);
          if (d.adjustment) setAdjustment(d.adjustment);
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
  }, [tradeId]);

  useEffect(() => {
    if (!open || loaded) return;
    setLoaded(true);
    setAdjustment(null);
    setSource(null);
    run();
  }, [open, loaded, run]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleOpenChange = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      abortRef.current?.abort();
      setTimeout(() => {
        setLoaded(false);
        setAdjustment(null);
        setNarrative("");
        setSource(null);
        setErrored(false);
        setStreaming(false);
      }, 300);
    }
  };

  const showSkeleton = !adjustment && !errored;
  const showFullRetry = !adjustment && errored;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-md md:max-w-xl overflow-hidden flex flex-col bg-card border-l-border">
        <SheetHeader className="shrink-0 pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-indigo-400" />
            Adjustment Recommendation
          </SheetTitle>
          <SheetDescription>
            Deterministic monitoring signals narrated by DK Option Engine Coach.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {showSkeleton ? (
            <div className="space-y-6">
              <Skeleton className="h-24 w-full bg-secondary" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-16 w-full bg-secondary" />
                <Skeleton className="h-16 w-full bg-secondary" />
              </div>
              <Skeleton className="h-48 w-full bg-secondary" />
            </div>
          ) : showFullRetry ? (
            <RetryNotice message="Couldn't load the recommendation." onRetry={run} retrying={streaming} />
          ) : adjustment ? (
            <div className="space-y-6 pb-6">
              {/* Recommended action */}
              <div className={`p-4 rounded-lg border ${severityClasses(adjustment.severity)}`}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <ActionIcon severity={adjustment.severity} />
                    <span className="text-base font-bold">{adjustment.actionLabel}</span>
                  </div>
                  <SeverityBadge severity={adjustment.severity} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {adjustment.symbol} {adjustment.strategyLabel} @ ${adjustment.underlyingPrice.toFixed(2)} · {adjustment.daysToExpiry} DTE
                </p>
                {ROLLABLE_ACTIONS.has(adjustment.action) && tradeId != null && (
                  <Button
                    size="sm"
                    onClick={() => {
                      handleOpenChange(false);
                      setLocation(`/ticket/adjust/${tradeId}`);
                    }}
                    className="mt-3 bg-indigo-500 text-white hover:bg-indigo-600"
                  >
                    <Repeat className="w-3.5 h-3.5 mr-2" />
                    {adjustment.action === "convert" ? "Preview convert" : "Preview roll"}
                  </Button>
                )}
              </div>

              {/* Header badges */}
              <div className="flex flex-wrap gap-2 items-center">
                {adjustment.autoActionable && (
                  <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/10">
                    Auto-actionable
                  </Badge>
                )}
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

              {/* Narrative */}
              <div className="text-foreground/90 border-l-2 border-indigo-500/50 pl-4">
                {errored ? (
                  <RetryNotice message="Couldn't load the explanation." onRetry={run} retrying={streaming} />
                ) : narrative ? (
                  <Markdown>{narrative}</Markdown>
                ) : (
                  <span className="inline-flex items-center gap-2 text-muted-foreground/70">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Writing the rationale…
                  </span>
                )}
              </div>

              {/* Key metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <MetricCard label="POP now" value={`${adjustment.currentPop.toFixed(0)}%`} highlight />
                <MetricCard label="Entry POP" value={`${adjustment.entryPop.toFixed(0)}%`} />
                <MetricCard
                  label="Open P&L"
                  value={`$${adjustment.currentPnl.toFixed(0)}`}
                  success={adjustment.currentPnl >= 0}
                  error={adjustment.currentPnl < 0}
                />
                <MetricCard label="Max Loss" value={`$${adjustment.maxLoss.toFixed(0)}`} error />
              </div>

              {/* Signals */}
              <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  Monitoring Signals
                </h4>
                <ul className="space-y-2">
                  {adjustment.signals.map((s) => (
                    <li key={s.key} className="flex items-start gap-2 text-sm">
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s.triggered ? "bg-amber-400" : "bg-muted-foreground/30"}`}
                      />
                      <div>
                        <span className={s.triggered ? "font-medium text-foreground" : "text-muted-foreground"}>
                          {s.label}
                        </span>
                        <p className="text-xs text-muted-foreground">{s.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Greeks */}
              <div className="grid grid-cols-4 gap-4 p-4 rounded-lg bg-secondary/30 border border-border">
                {(["delta", "gamma", "theta", "vega"] as const).map((k) => (
                  <div key={k}>
                    <p className="text-xs text-muted-foreground uppercase">{k}</p>
                    <p className="font-mono text-sm">{adjustment.greeks[k].toFixed(3)}</p>
                  </div>
                ))}
              </div>

              {/* Assignment risk */}
              {adjustment.assignmentRisk && (
                <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <h4 className="text-sm font-semibold text-orange-400 mb-1 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Assignment Risk
                  </h4>
                  <p className="text-sm text-foreground/80">{adjustment.assignmentRisk}</p>
                </div>
              )}

              <Separator />

              <div className="flex items-start gap-2 text-xs text-muted-foreground/70">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{adjustment.disclaimer}</p>
              </div>
            </div>
          ) : null}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function severityClasses(severity: TradeAdjustment["severity"]): string {
  switch (severity) {
    case "critical":
      return "border-destructive/30 bg-destructive/10";
    case "warning":
      return "border-amber-500/30 bg-amber-500/10";
    case "info":
      return "border-indigo-500/30 bg-indigo-500/10";
    default:
      return "border-border bg-secondary/20";
  }
}

function ActionIcon({ severity }: { severity: TradeAdjustment["severity"] }) {
  if (severity === "critical") return <AlertTriangle className="w-4 h-4 text-destructive" />;
  if (severity === "warning") return <Wrench className="w-4 h-4 text-amber-400" />;
  if (severity === "info") return <Info className="w-4 h-4 text-indigo-400" />;
  return <CheckCircle2 className="w-4 h-4 text-success" />;
}

function SeverityBadge({ severity }: { severity: TradeAdjustment["severity"] }) {
  const map: Record<TradeAdjustment["severity"], string> = {
    critical: "border-destructive/30 text-destructive bg-destructive/10",
    warning: "border-amber-500/30 text-amber-400 bg-amber-500/10",
    info: "border-indigo-500/30 text-indigo-400 bg-indigo-500/10",
    none: "border-muted text-muted-foreground bg-muted/20",
  };
  return (
    <Badge variant="outline" className={map[severity]}>
      {severity}
    </Badge>
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
        {retrying ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
        Retry
      </Button>
    </div>
  );
}

function MetricCard({
  label,
  value,
  highlight,
  error,
  success,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
  error?: boolean;
  success?: boolean;
}) {
  return (
    <div
      className={`p-3 rounded-lg border ${highlight ? "border-indigo-500/30 bg-indigo-500/10" : error ? "border-destructive/30 bg-destructive/10" : success ? "border-success/30 bg-success/10" : "border-border bg-secondary/20"}`}
    >
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p
        className={`font-mono text-lg font-bold ${highlight ? "text-indigo-400" : error ? "text-destructive" : success ? "text-success" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}
