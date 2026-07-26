// AI Teacher & Learning Centre sprint — Contextual Explain Mode.
//
// A reusable widget dropped onto major metrics across the platform
// (Portfolio Health, Delta, Theta, Buying Power, Event Risk, Stress Test,
// Concentration, Probability of Profit, Maximum Profit, Maximum Loss,
// Expected Move…). Every value shown is resolved server-side from the
// calling user's own real, current data — this component never accepts
// or displays a client-supplied "explanation" for a fabricated number.
//
// Reuses the Institutional Intelligence Engine's own Explanation Engine
// (via metricExplainer.ts server-side) whenever a real Observation
// exists — this component itself has no explanation logic of its own,
// it only renders whatever the server returns.

import { useState } from "react";
import { Link } from "wouter";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMetricExplanation, type MetricExplanation, ExplainFetchError } from "@/lib/explain-fetch";
import { RelatedGlossaryBadges } from "./RelatedGlossaryBadges";
import { HelpCircle } from "lucide-react";

export type ExplainMetricCode =
  | "portfolio_health"
  | "buying_power"
  | "event_risk"
  | "concentration"
  | "stress_test"
  | "delta"
  | "theta"
  | "gamma"
  | "vega"
  | "probability_of_profit"
  | "max_profit"
  | "max_loss"
  | "expected_move";

const METRIC_LABELS: Record<ExplainMetricCode, string> = {
  portfolio_health: "Portfolio Health",
  buying_power: "Buying Power",
  event_risk: "Event Risk",
  concentration: "Concentration",
  stress_test: "Stress Test",
  delta: "Delta",
  theta: "Theta",
  gamma: "Gamma",
  vega: "Vega",
  probability_of_profit: "Probability of Profit",
  max_profit: "Maximum Profit",
  max_loss: "Maximum Loss",
  expected_move: "Expected Move",
};

export function ExplainButton({
  metrics,
  tradeId,
  label = "Explain",
  align = "start",
}: {
  metrics: ExplainMetricCode[];
  tradeId?: number;
  label?: string;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [metric, setMetric] = useState<ExplainMetricCode>(metrics[0]);
  const [data, setData] = useState<MetricExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = (m: ExplainMetricCode) => {
    setLoading(true);
    setError(null);
    fetchMetricExplanation(m, tradeId)
      .then((res) => setData(res))
      .catch((err) => setError(err instanceof ExplainFetchError ? err.message : "Failed to load explanation"))
      .finally(() => setLoading(false));
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && !data) load(metric);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={`button-explain-${metrics[0]}`}
          className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 hover:underline"
        >
          <HelpCircle className="w-3 h-3" /> {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-80 bg-popover border-border" data-testid="popover-explain">
        {metrics.length > 1 && (
          <Select
            value={metric}
            onValueChange={(v) => {
              const m = v as ExplainMetricCode;
              setMetric(m);
              setData(null);
              load(m);
            }}
          >
            <SelectTrigger className="h-8 mb-2 bg-background text-xs" data-testid="select-explain-metric">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {metrics.map((m) => (
                <SelectItem key={m} value={m}>
                  {METRIC_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {loading && (
          <div className="space-y-2" data-testid="text-explain-loading">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
          </div>
        )}
        {!loading && error && (
          <p className="text-xs text-destructive" data-testid="text-explain-error">
            {error}
          </p>
        )}
        {!loading && !error && data && (
          <div className="space-y-2" data-testid="content-explain">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">{data.label}</span>
              {data.reusedObservation && (
                <Badge variant="outline" className="text-[9px] border-indigo-500/30 text-indigo-400">
                  Live Observation
                </Badge>
              )}
            </div>
            <div className="text-sm font-mono text-foreground" data-testid="text-explain-current-value">
              {data.currentValue}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed" data-testid="text-explain-plain-english">
              {data.plainEnglish}
            </p>
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
              <span className="font-semibold">Source: </span>
              {data.sourceCalculation}
            </p>
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
              <span className="font-semibold">Why it matters: </span>
              {data.whyItMatters}
            </p>
            {data.relatedLessonHref && (
              <Link
                href={data.relatedLessonHref}
                className="block text-[11px] text-indigo-400 hover:underline"
                data-testid="link-explain-related-lesson"
              >
                Read the related lesson →
              </Link>
            )}
            {data.relatedGlossaryKeys.length > 0 && (
              <div className="pt-1">
                <RelatedGlossaryBadges keys={data.relatedGlossaryKeys} testIdPrefix="link-explain-glossary" />
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
