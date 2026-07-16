import { useMemo } from "react";
import { useGetUpcomingEvents, type EventRiskEvent } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarClock,
  Landmark,
  TrendingUp,
  Briefcase,
  Newspaper,
  DollarSign,
  Building2,
} from "lucide-react";

const IMPACT_STYLES: Record<string, string> = {
  high: "border-destructive text-destructive",
  medium: "border-amber-500 text-amber-400",
  low: "border-sky-500 text-sky-400",
};

const TYPE_META: Record<
  string,
  { label: string; icon: typeof CalendarClock; color: string }
> = {
  earnings: { label: "Earnings", icon: Building2, color: "#f59e0b" },
  fomc: { label: "FOMC", icon: Landmark, color: "#ef4444" },
  cpi: { label: "CPI", icon: TrendingUp, color: "#ec4899" },
  jobs: { label: "Jobs / NFP", icon: Briefcase, color: "#8b5cf6" },
  economic: { label: "Economic", icon: TrendingUp, color: "#3b82f6" },
  news: { label: "News", icon: Newspaper, color: "#64748b" },
  dividend: { label: "Dividend", icon: DollarSign, color: "#22c55e" },
};

function typeMeta(t: string) {
  return TYPE_META[t] ?? { label: t, icon: CalendarClock, color: "#64748b" };
}

export default function Events() {
  const { data: events, isLoading } = useGetUpcomingEvents();

  const grouped = useMemo(() => {
    const map = new Map<string, EventRiskEvent[]>();
    for (const e of events ?? []) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [events]);

  const highCount = (events ?? []).filter((e) => e.impact === "high").length;
  const marketCount = (events ?? []).filter((e) => e.scope === "market").length;
  const symbolCount = (events ?? []).filter((e) => e.scope === "symbol").length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <CalendarClock className="h-6 w-6 text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Economic Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Forward-looking event risk — earnings, FOMC, CPI, jobs and dividends across the universe.
            Trades whose window crosses these events are penalized and short premium before earnings is blocked.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Events", value: events?.length ?? 0, color: "#3b82f6" },
          { label: "High Impact", value: highCount, color: "#ef4444" },
          { label: "Market-Wide", value: marketCount, color: "#f59e0b" },
          { label: "Symbol-Specific", value: symbolCount, color: "#22c55e" },
        ].map((s) => (
          <Card key={s.label} className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-mono font-black mt-1" style={{ color: s.color }}>
                {isLoading ? "—" : s.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
            Upcoming Events
          </CardTitle>
          <CardDescription>Next 45 days, grouped by date.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No upcoming events in the horizon.
            </p>
          ) : (
            grouped.map(([date, list]) => (
              <div key={date} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-white">{date}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {list[0].daysAway}d away
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {list.map((e, i) => {
                    const meta = typeMeta(e.type);
                    const Icon = meta.icon;
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2"
                        data-testid={`event-${e.type}-${i}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className="h-4 w-4 shrink-0" style={{ color: meta.color }} />
                          <div className="min-w-0">
                            <p className="text-sm text-white truncate">{e.label}</p>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              {meta.label}
                              {e.symbol ? ` · ${e.symbol}` : ` · ${e.scope}`}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`uppercase text-[10px] shrink-0 ${IMPACT_STYLES[e.impact] ?? ""}`}
                        >
                          {e.impact}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
