import { Badge } from "@/components/ui/badge";
import { CalendarClock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { EventRiskEvent } from "@workspace/api-client-react";

type Level = "none" | "low" | "medium" | "high";

const LEVEL_STYLES: Record<Level, string> = {
  none: "border-muted text-muted",
  low: "border-sky-500 text-sky-400",
  medium: "border-amber-500 text-amber-400",
  high: "border-destructive text-destructive",
};

export function EventRiskBadge({
  level,
  penalty,
  events,
}: {
  level?: string | null;
  penalty?: number | null;
  events?: EventRiskEvent[] | null;
}) {
  const lvl = (level ?? "none") as Level;
  if (lvl === "none") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const list = events ?? [];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={`uppercase text-xs gap-1 ${LEVEL_STYLES[lvl] ?? LEVEL_STYLES.none}`}
          data-testid={`badge-event-risk-${lvl}`}
        >
          <CalendarClock className="w-3 h-3" />
          {lvl}
          {penalty ? ` -${penalty.toFixed(0)}` : ""}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-semibold mb-1">Event risk in trade window</p>
        {list.length === 0 ? (
          <p className="text-xs">Major event(s) detected before expiration.</p>
        ) : (
          <ul className="text-xs space-y-0.5">
            {list.slice(0, 6).map((e, i) => (
              <li key={i}>
                {e.date} · {e.label} ({e.impact})
              </li>
            ))}
          </ul>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
