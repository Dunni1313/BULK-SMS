// v1.3.1 — AI Trading Coach, Frontend UI. Deep-link-only "what to do next"
// chips, rendered after the Coach's most recent answer. Navigation via
// wouter's <Link> exclusively — never a mutation hook, never an execution
// call, matching the approved design doc's §8 rule 1 exactly ("Suggested
// actions are wouter navigation only, never a mutation hook call").

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import type { TradingCoachSuggestedAction } from "@/lib/trading-coach-context";

export function TradingCoachSuggestedActions({ actions }: { actions: TradingCoachSuggestedAction[] }) {
  if (actions.length === 0) return null;

  return (
    <div className="space-y-1 rounded-md border border-border bg-secondary/30 p-2" data-testid="trading-coach-suggested-actions">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Suggested actions</p>
      <div className="flex flex-col gap-1">
        {actions.map((action) => (
          <Link key={action.href} href={action.href}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-full justify-start gap-1.5 text-xs text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300"
              data-testid={`trading-coach-suggested-action-${action.href}`}
            >
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
              {action.label}
            </Button>
          </Link>
        ))}
      </div>
    </div>
  );
}
