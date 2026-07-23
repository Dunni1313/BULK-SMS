// Phase 21 — Institutional AI Coach & Education Platform.
//
// A reusable Explanation Drawer, integrated across every named surface
// (Research Terminal, Decision Engine, Portfolio Optimisation, Investment
// Committee Workbench, Institutional Workspace, Portfolio Construction,
// Institutional Monitoring, Institutional Mentor, the standalone
// Institutional AI Coach page itself). Every field rendered here is a direct
// quote from GET /stock-analyst/coach/:coach/:symbol (lib/investingCoach.ts,
// server-side) — this component has no explanation logic of its own, exactly
// mirroring ExplainButton.tsx's own established "server computes, component
// only renders" discipline. Nothing here invents a recommendation, a score,
// or a forecast: quick-action buttons only change which section of the SAME
// already-fetched, already-deterministic explanation is emphasised.

import { useState } from "react";
import { Link } from "wouter";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCoachExplanation, type CoachType } from "@/hooks/use-coach-explanation";
import { useRecordLearningItemViewed } from "@workspace/api-client-react";
import { GraduationCap, HelpCircle } from "lucide-react";

export const COACH_TYPES: CoachType[] = [
  "investment",
  "portfolio",
  "decision",
  "valuation",
  "risk",
  "research",
  "monitoring",
  "committee",
];

export const COACH_TYPE_LABELS: Record<CoachType, string> = {
  investment: "Investment Coach",
  portfolio: "Portfolio Coach",
  decision: "Decision Coach",
  valuation: "Valuation Coach",
  risk: "Risk Coach",
  research: "Research Coach",
  monitoring: "Monitoring Coach",
  committee: "Committee Coach",
};

type FocusSection = "meaning" | "why" | "evidence" | "teach" | "beginner" | "sources";

const QUICK_ACTIONS: { key: FocusSection; label: string }[] = [
  { key: "meaning", label: "What does this mean?" },
  { key: "why", label: "Why?" },
  { key: "evidence", label: "Show the evidence" },
  { key: "teach", label: "Teach me" },
  { key: "beginner", label: "Explain like I'm new" },
  { key: "sources", label: "Show calculation sources" },
];

export function CoachDrawer({
  symbol,
  coach: initialCoach = "investment",
  portfolioId = null,
  allowCoachSwitch = true,
  trigger,
}: {
  symbol: string;
  coach?: CoachType;
  portfolioId?: number | null;
  allowCoachSwitch?: boolean;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [coach, setCoach] = useState<CoachType>(initialCoach);
  const [focus, setFocus] = useState<FocusSection>("meaning");
  const recordViewed = useRecordLearningItemViewed();

  const { data, isLoading, isError } = useCoachExplanation(coach, symbol, portfolioId);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setFocus("meaning");
      recordViewed.mutate({ data: { itemType: "coach", itemKey: `${coach}:${symbol}` } });
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {trigger ? (
        <span onClick={() => handleOpenChange(true)} data-testid={`trigger-coach-drawer-${coach}`}>
          {trigger}
        </span>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          data-testid={`button-open-coach-drawer-${coach}`}
          onClick={() => handleOpenChange(true)}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          Ask the AI Coach
        </Button>
      )}
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto" data-testid="sheet-coach-drawer">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <Badge variant="secondary" data-testid="badge-coach-permanent-label">
              Institutional AI Coach
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
          <SheetTitle data-testid="text-coach-drawer-title">
            {COACH_TYPE_LABELS[coach]} — {symbol}
          </SheetTitle>
          <SheetDescription>
            Every explanation below reuses an existing, already-computed engine output — never a new recommendation.
          </SheetDescription>
        </SheetHeader>

        {allowCoachSwitch && (
          <Select value={coach} onValueChange={(v) => setCoach(v as CoachType)}>
            <SelectTrigger className="mt-3" data-testid="select-coach-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COACH_TYPES.map((c) => (
                <SelectItem key={c} value={c}>
                  {COACH_TYPE_LABELS[c]}
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
              data-testid={`button-coach-quick-action-${a.key}`}
            >
              <HelpCircle className="w-3 h-3 mr-1" />
              {a.label}
            </Button>
          ))}
        </div>

        {isLoading && (
          <div className="space-y-2 mt-4" data-testid="text-coach-loading">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}

        {!isLoading && isError && (
          <p className="text-sm text-destructive mt-4" data-testid="text-coach-error">
            Could not load an explanation for {symbol}.
          </p>
        )}

        {!isLoading && !isError && data && (
          <div className="space-y-4 mt-4 text-sm" data-testid="content-coach-explanation">
            <p className="font-semibold text-foreground" data-testid="text-coach-headline">
              {data.headline}
            </p>

            {(focus === "meaning" || focus === "why") && (
              <section data-testid="section-coach-why">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Why this exists</h4>
                <p className="text-muted-foreground leading-relaxed">{data.whyThisExists}</p>
              </section>
            )}

            {focus === "evidence" && (
              <>
                <section data-testid="section-coach-metrics">
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
                <section data-testid="section-coach-supporting-evidence">
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
                  <section data-testid="section-coach-risks">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Risks that reduced confidence</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {data.risksReducingConfidence.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </section>
                )}
                {data.strengthsIncreasingConfidence.length > 0 && (
                  <section data-testid="section-coach-strengths">
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

            {(focus === "teach" || focus === "beginner") && (
              <>
                <section data-testid="section-coach-how-to-interpret">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">How to interpret the numbers</h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {data.howToInterpret.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </section>
                {focus === "teach" && (
                  <>
                    <section data-testid="section-coach-mistakes">
                      <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Common mistakes investors make</h4>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        {data.commonMistakes.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </section>
                    <section data-testid="section-coach-institutional-perspective">
                      <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">How institutional investors think about this</h4>
                      <p className="text-muted-foreground leading-relaxed">{data.institutionalPerspective}</p>
                    </section>
                  </>
                )}
              </>
            )}

            {focus === "sources" && (
              <section data-testid="section-coach-sources">
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
                    <Link key={k} href={`/learn/glossary/${k}`} data-testid={`link-coach-glossary-${k}`}>
                      <Badge variant="outline" className="text-[10px] cursor-pointer hover:border-indigo-500/40">
                        {k}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <Link
              href={`/learn/paths/institutional-investing`}
              className="block text-xs text-indigo-400 hover:underline"
              data-testid="link-coach-guided-learning"
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
