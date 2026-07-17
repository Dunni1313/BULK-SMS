// AI Teacher & Learning Centre sprint — Strategy Academy.
//
// Handles /learn/strategy-academy (all 8 entries) and
// /learn/strategy-academy/:strategy (one entry's full detail — the
// destination of learningPaths.ts's own STRATEGIES_PATH topics'
// externalHref). iron_condor/iron_fly/calendar_spread carry a real, live
// worked paper example (this platform's own engine actually builds
// those); the other 5 honestly disclose their paper example as
// unavailable rather than fabricating one.

import { useEffect } from "react";
import { Link, useParams } from "wouter";
import { useGetStrategyAcademy, useGetStrategyAcademyEntryByKey, useRecordLearningItemViewed } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GraduationCap, ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <p className="text-xs text-foreground/90 mt-0.5 leading-relaxed">{value}</p>
    </div>
  );
}

function StrategyList() {
  const { data: entries, isLoading } = useGetStrategyAcademy();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-indigo-400" /> Strategy Academy
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Construction, ideal market, Greeks profile, and common mistakes for every supported options strategy.
        </p>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="grid-strategy-academy">
          {(entries ?? []).map((e) => (
            <Link key={e.key} href={`/learn/strategy-academy/${e.key}`} data-testid={`link-strategy-${e.key}`}>
              <Card className="bg-card border-border hover:border-indigo-500/40 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {e.label}
                    {e.builtByThisEngine && (
                      <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">
                        Live Example
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-[11px] line-clamp-2">{e.idealMarket}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StrategyDetail({ strategy }: { strategy: string }) {
  const { data: e, isLoading, isError } = useGetStrategyAcademyEntryByKey(strategy);
  const recordViewed = useRecordLearningItemViewed();

  useEffect(() => {
    recordViewed.mutate({ data: { itemType: "strategy", itemKey: strategy } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategy]);

  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="text-strategy-loading">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (isError || !e) {
    return (
      <p className="text-sm text-destructive" data-testid="text-strategy-not-found">
        Unknown strategy.
      </p>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Link href="/learn/strategy-academy" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-3 h-3" /> All Strategies
      </Link>
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground">{e.label}</h1>
        {e.builtByThisEngine ? (
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Built by this engine</Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            Not built by this engine
          </Badge>
        )}
      </div>

      <Card className="bg-card border-border">
        <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DetailRow label="Construction" value={e.construction} />
          <DetailRow label="Ideal Market" value={e.idealMarket} />
          <DetailRow label="Maximum Profit" value={e.maxProfit} />
          <DetailRow label="Maximum Loss" value={e.maxLoss} />
          <DetailRow label="Greeks Profile" value={e.greeksProfile} />
          <DetailRow label="Time Decay" value={e.timeDecay} />
          <DetailRow label="Volatility Behavior" value={e.volatilityBehavior} />
          <DetailRow label="Assignment Risk" value={e.assignmentRisk} />
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> Common Mistakes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5 list-disc list-inside" data-testid="list-common-mistakes">
            {e.commonMistakes.map((m, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                {m}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Institutional Perspective</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground leading-relaxed">{e.institutionalPerspective}</p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border" data-testid="card-paper-example">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            {e.paperExample.available ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            )}
            Paper Trading Example
          </CardTitle>
        </CardHeader>
        <CardContent>
          {e.paperExample.available ? (
            <div className="space-y-2">
              <p className="text-xs text-foreground/90" data-testid="text-paper-example-detail">
                {e.paperExample.detail}
              </p>
              {e.paperExample.greeks && (
                <div className="grid grid-cols-4 gap-2 text-xs font-mono">
                  <div>Δ {e.paperExample.greeks.delta}</div>
                  <div>Γ {e.paperExample.greeks.gamma}</div>
                  <div>Θ {e.paperExample.greeks.theta}</div>
                  <div>V {e.paperExample.greeks.vega}</div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground" data-testid="text-paper-example-unavailable">
              {e.paperExample.unavailableReason}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function StrategyAcademy() {
  const { strategy } = useParams<{ strategy?: string }>();
  if (!strategy) return <StrategyList />;
  return <StrategyDetail strategy={strategy} />;
}
