// Phase 29 — Institutional Trading AI Coach.
//
// A reusable Evidence Explorer drawer for Engine 2, mirroring Phase 21's own
// CoachDrawer.tsx (Engine 1) visual/interaction pattern exactly — a
// deliberate parallel component, not a shared generalization, matching this
// codebase's "engines never depend on each other's internals" convention.
// Every field rendered here is a direct quote from
// GET /trading/coach/{coach}/{symbol} or GET /trading/coach/{coach}
// (lib/tradingCoach.ts, server-side, zero LLM calls) — this component has
// no explanation logic of its own. Nothing here creates a trading signal,
// predicts price, recommends buying/selling, or invents a probability.

import { useState } from "react";
import { Link } from "wouter";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTradingCoachExplanation, isAccountScopedTradingCoach, type TradingCoachType } from "@/hooks/use-trading-coach-explanation";
import { useRecordLearningItemViewed } from "@workspace/api-client-react";
import { GraduationCap, HelpCircle } from "lucide-react";

export const TRADING_COACH_TYPES: TradingCoachType[] = ["structure", "liquidity", "session", "risk", "trade-plan", "journal", "psychology"];

export const TRADING_COACH_TYPE_LABELS: Record<TradingCoachType, string> = {
  structure: "Structure Coach",
  liquidity: "Liquidity Coach",
  session: "Session Coach",
  risk: "Risk Coach",
  "trade-plan": "Trade Plan Coach",
  journal: "Journal Coach",
  psychology: "Psychology & Discipline Coach",
};

type FocusSection = "meaning" | "why" | "evidence" | "teach" | "sources";

const QUICK_ACTIONS: { key: FocusSection; label: string }[] = [
  { key: "meaning", label: "What does this mean?" },
  { key: "why", label: "Why?" },
  { key: "evidence", label: "Show the evidence" },
  { key: "teach", label: "Teach me" },
  { key: "sources", label: "Show calculation sources" },
];

export function TradingCoachDrawer({
  symbol,
  coach: initialCoach = "structure",
  allowCoachSwitch = true,
  trigger,
}: {
  symbol: string;
  coach?: TradingCoachType;
  allowCoachSwitch?: boolean;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [coach, setCoach] = useState<TradingCoachType>(initialCoach);
  const [focus, setFocus] = useState<FocusSection>("meaning");
  const recordViewed = useRecordLearningItemViewed();

  const { data, isLoading, isError } = useTradingCoachExplanation(coach, symbol);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setFocus("meaning");
      recordViewed.mutate({ data: { itemType: "coach", itemKey: `${coach}:${isAccountScopedTradingCoach(coach) ? "account" : symbol}` } });
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {trigger ? (
        <span onClick={() => handleOpenChange(true)} data-testid={`trigger-trading-coach-drawer-${coach}`}>
          {trigger}
        </span>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          data-testid={`button-open-trading-coach-drawer-${coach}`}
          onClick={() => handleOpenChange(true)}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          Ask the AI Coach
        </Button>
      )}
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto" data-testid="sheet-trading-coach-drawer">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <Badge variant="secondary" data-testid="badge-trading-coach-permanent-label">
              Institutional Trading AI Coach
            </Badge>
            <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
              Educational
            </Badge>
            <Badge variant="outline" className="text-indigo-400 border-indigo-500/30">
              Deterministic
            </Badge>
            <Badge variant="outline" className="text-amber-500 border-amber-500/30">
              Evidence Based
            </Badge>
          </div>
          <SheetTitle data-testid="text-trading-coach-drawer-title">
            {TRADING_COACH_TYPE_LABELS[coach]}
            {!isAccountScopedTradingCoach(coach) ? ` — ${symbol}` : ""}
          </SheetTitle>
          <SheetDescription>
            Every explanation below reuses an existing, already-computed engine output — never a new signal, prediction, or recommendation.
          </SheetDescription>
        </SheetHeader>

        {allowCoachSwitch && (
          <Select value={coach} onValueChange={(v) => setCoach(v as TradingCoachType)}>
            <SelectTrigger className="mt-3" data-testid="select-trading-coach-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRADING_COACH_TYPES.map((c) => (
                <SelectItem key={c} value={c}>
                  {TRADING_COACH_TYPE_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex flex-wrap gap-1.5 mt-3">
          {QUICK_ACTIONS.map((a) => (
            <Button
              key={a.key}
              type="button"
              size="sm"
              variant={focus === a.key ? "default" : "outline"}
              className="text-[11px] h-7"
              onClick={() => setFocus(a.key)}
              data-testid={`button-trading-coach-quick-action-${a.key}`}
            >
              <HelpCircle className="w-3 h-3 mr-1" />
              {a.label}
            </Button>
          ))}
        </div>

        {isLoading && (
          <div className="space-y-2 mt-4" data-testid="text-trading-coach-loading">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}

        {!isLoading && isError && (
          <p className="text-sm text-destructive mt-4" data-testid="text-trading-coach-error">
            Could not load an explanation{!isAccountScopedTradingCoach(coach) ? ` for ${symbol}` : ""}.
          </p>
        )}

        {!isLoading && !isError && data && (
          <div className="space-y-4 mt-4 text-sm" data-testid="content-trading-coach-explanation">
            <p className="font-semibold text-foreground" data-testid="text-trading-coach-headline">
              {data.headline}
            </p>

            {(focus === "meaning" || focus === "why") && (
              <section data-testid="section-trading-coach-why">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Why this exists</h4>
                <p className="text-muted-foreground leading-relaxed">{data.whyThisExists}</p>
              </section>
            )}

            {focus === "evidence" && (
              <>
                <section data-testid="section-trading-coach-metrics">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Metrics used</h4>
                  <ul className="space-y-1">
                    {data.metricsUsed.map((m, i) => (
                      <li key={i} className="text-muted-foreground">
                        <span className="font-medium text-foreground">{m.label}:</span> {m.detail}{" "}
                        <span className="text-[10px] text-muted-foreground/70">({m.source})</span>
                      </li>
                    ))}
                    {data.metricsUsed.length === 0 && <li className="text-muted-foreground/70 italic">No metrics available for this reading.</li>}
                  </ul>
                </section>
                <section data-testid="section-trading-coach-supporting-evidence">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Supporting evidence</h4>
                  <ul className="space-y-1">
                    {data.supportingEvidence.map((e, i) => (
                      <li key={i} className="text-muted-foreground">
                        <span className="font-medium text-foreground">{e.label}:</span> {e.detail}
                      </li>
                    ))}
                    {data.supportingEvidence.length === 0 && <li className="text-muted-foreground/70 italic">No evidence recorded for this reading.</li>}
                  </ul>
                </section>
                {data.risksReducingConfidence.length > 0 && (
                  <section data-testid="section-trading-coach-risks">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Risks that reduced confidence</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {data.risksReducingConfidence.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </section>
                )}
                {data.strengthsIncreasingConfidence.length > 0 && (
                  <section data-testid="section-trading-coach-strengths">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Strengths that increased confidence</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {data.strengthsIncreasingConfidence.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}

            {focus === "teach" && (
              <>
                <section data-testid="section-trading-coach-how-to-interpret">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">How to interpret the numbers</h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {data.howToInterpret.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </section>
                <section data-testid="section-trading-coach-mistakes">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Common mistakes traders make</h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {data.commonMistakes.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </section>
                <section data-testid="section-trading-coach-institutional-perspective">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">How institutional desks think about this</h4>
                  <p className="text-muted-foreground leading-relaxed">{data.institutionalPerspective}</p>
                </section>
              </>
            )}

            {focus === "sources" && (
              <section data-testid="section-trading-coach-sources">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Calculation sources</h4>
                <div className="flex flex-wrap gap-1.5">
                  {data.calculationSources.map((s, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">
                      {s}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {data.relatedGlossaryKeys.length > 0 && (
              <section>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Related glossary terms</h4>
                <div className="flex flex-wrap gap-1.5">
                  {data.relatedGlossaryKeys.map((k) => (
                    <Link key={k} href={`/learn/glossary/${k}`} data-testid={`link-trading-coach-glossary-${k}`}>
                      <Badge variant="outline" className="text-[10px] cursor-pointer hover:border-indigo-500/40">
                        {k}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <Link
              href={`/learn/paths/trading-engine`}
              className="block text-xs text-indigo-400 hover:underline"
              data-testid="link-trading-coach-guided-learning"
            >
              Continue with Guided Learning →
            </Link>

            <p className="text-[10px] text-muted-foreground/70 leading-relaxed border-t pt-2">{data.disclaimer}</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
