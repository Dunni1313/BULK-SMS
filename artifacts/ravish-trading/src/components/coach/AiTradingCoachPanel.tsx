// v1.6.0 Sprint 1 — AI Trading Coach Guided Workflow.
//
// The ONE reusable AI Trading Coach panel — mounted on every major
// workflow page plus the Institutional Command Centre, never duplicated
// per-page. Composes useTradingCoachWorkflow() (which itself nests
// Scanner/Opportunity Pipeline/Decision Workflow/Trade Lifecycle/Trading
// Journal — never re-fetching or recomputing any of them) into a calm,
// concise, always-answers-6-questions status card:
//   Where am I?      -> the step checklist below, current step highlighted
//   What completed?  -> ☑ items in the checklist
//   What's next?     -> the "Next Recommended Step" line
//   Why?             -> workflow.primaryReason, cited verbatim from real data
//   How long?        -> the step's own estimatedMinutes
//   What's after?    -> the very next "ready" step in the checklist
//
// Deliberately distinct from, and never confused with, either existing
// "Trading Coach"-named surface in this codebase: /ai-trading-coach
// (AITradingCoach.tsx, "AI Trading Assistant" — a free-form conversational
// specialist coach) and /trading-ai-coach (TradingAICoach.tsx, Phase 29's
// deterministic per-symbol explanation coach). This panel does neither —
// it never answers open-ended questions and never explains a specific
// symbol's technicals; it only tracks and recommends the one next step in
// today's guided workflow.
//
// "No Trade" is always offered as a first-class, equally-weighted action —
// never buried — per the sprint's explicit "must never pressure the user
// to execute merely to complete the checklist" requirement.

import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ModuleLearnTrigger } from "@/components/learn/ModuleLearnTrigger";
import { useTradingCoachWorkflow } from "@/lib/ai-coach/useTradingCoachWorkflow";
import { resolveWorkflowNavigationTarget } from "@/lib/ai-coach/tradingCoachNavigation";
import { DAILY_WORKFLOW_STEP_LABELS, type DailyWorkflowStepStatus } from "@/lib/ai-coach/tradingCoachWorkflow";
import { CheckCircle2, Circle, Clock, ChevronDown, ChevronUp, ShieldAlert, MinusCircle, Compass } from "lucide-react";

const STATUS_ICON: Record<DailyWorkflowStepStatus, typeof CheckCircle2> = {
  completed: CheckCircle2,
  skipped: MinusCircle,
  "not-applicable": MinusCircle,
  active: Circle,
  ready: Circle,
  blocked: ShieldAlert,
  "not-started": Circle,
};

const STATUS_ICON_CLASS: Record<DailyWorkflowStepStatus, string> = {
  completed: "text-emerald-500",
  skipped: "text-muted-foreground",
  "not-applicable": "text-muted-foreground",
  active: "text-primary",
  ready: "text-primary/70",
  blocked: "text-amber-500",
  "not-started": "text-muted-foreground/50",
};

/** collapsible=false is used on pages where the panel is already the page's own primary content. */
export function AiTradingCoachPanel({ collapsible = true }: { collapsible?: boolean }) {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(true);
  const [noTradeDraft, setNoTradeDraft] = useState("");
  const [showNoTradeForm, setShowNoTradeForm] = useState(false);
  const coach = useTradingCoachWorkflow();

  if (coach.loading || !coach.workflow) {
    return (
      <Card data-testid="card-ai-trading-coach">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  const { workflow } = coach;
  const primaryStep = workflow.steps.find((s) => s.id === workflow.primaryNextStepId) ?? null;
  const nextAfterId =
    workflow.primaryNextStepId != null
      ? workflow.steps.find((s) => s.status === "ready" && s.id !== workflow.primaryNextStepId)?.id ?? null
      : null;
  const navTarget = primaryStep ? resolveWorkflowNavigationTarget(primaryStep.id, coach.activeTradePlanId) : null;

  const body = (
    <CardContent className="space-y-4">
      {coach.marketIsOpen != null && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="text-market-status">
          <Badge variant={coach.marketIsOpen ? "default" : "secondary"} className="text-[10px]">
            Market {coach.marketIsOpen ? "Open" : "Closed"}
          </Badge>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">Today's Progress</span>
          <span className="text-xs text-muted-foreground" data-testid="text-completion-pct">
            {workflow.completionPct}%
          </span>
        </div>
        <Progress value={workflow.completionPct} className="h-1.5 mb-3" />
        <ul className="space-y-1.5" data-testid="list-daily-workflow-steps">
          {workflow.steps.map((step) => {
            const Icon = STATUS_ICON[step.status];
            return (
              <li
                key={step.id}
                className="flex items-center gap-2 text-sm"
                data-testid={`row-step-${step.id}`}
                data-step-status={step.status}
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 ${STATUS_ICON_CLASS[step.status]}`} />
                <span className={step.status === "active" ? "font-medium text-foreground" : "text-muted-foreground"}>
                  {step.label}
                </span>
                {step.status === "blocked" && (
                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500">
                    Blocked
                  </Badge>
                )}
                {step.status === "not-applicable" && (
                  <Badge variant="outline" className="text-[10px]">
                    Not applicable today
                  </Badge>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {primaryStep && navTarget && (
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2" data-testid="section-next-recommended-step">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Compass className="h-3.5 w-3.5" /> Next Recommended Step
          </div>
          <div className="text-sm font-semibold text-foreground" data-testid="text-next-step-label">
            {primaryStep.label}
          </div>
          <p className="text-xs text-muted-foreground" data-testid="text-primary-reason">
            {workflow.primaryReason}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground" data-testid="text-estimated-time">
            <Clock className="h-3 w-3" /> ~{primaryStep.estimatedMinutes} min
          </div>
          {nextAfterId && (
            <p className="text-[11px] text-muted-foreground" data-testid="text-what-after">
              After this: {DAILY_WORKFLOW_STEP_LABELS[nextAfterId]}
            </p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              disabled={primaryStep.status === "blocked"}
              onClick={() => setLocation(navTarget.href)}
              data-testid="button-start-next-step"
            >
              Start
            </Button>
            {!showNoTradeForm && (
              <Button size="sm" variant="ghost" onClick={() => setShowNoTradeForm(true)} data-testid="button-declare-no-trade">
                No Trade Today
              </Button>
            )}
          </div>
        </div>
      )}

      {workflow.isDoneForToday && (
        <p className="text-sm text-muted-foreground" data-testid="text-workflow-done">
          {workflow.primaryReason}
        </p>
      )}

      {showNoTradeForm && (
        <div className="space-y-2 rounded-md border border-border p-3" data-testid="form-no-trade">
          <p className="text-xs text-muted-foreground">
            Choosing not to trade is a legitimate, disciplined outcome. What's the reason?
          </p>
          <textarea
            className="w-full rounded-md border border-input bg-background p-2 text-xs"
            rows={2}
            value={noTradeDraft}
            onChange={(e) => setNoTradeDraft(e.target.value)}
            placeholder="e.g. No qualifying setups met my criteria today."
            data-testid="input-no-trade-reason"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={noTradeDraft.trim().length === 0}
              onClick={() => {
                coach.declareNoTrade(noTradeDraft.trim());
                setShowNoTradeForm(false);
              }}
              data-testid="button-confirm-no-trade"
            >
              Confirm No Trade
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNoTradeForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {coach.noTradeReason && !showNoTradeForm && (
        <div className="flex items-start justify-between gap-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground" data-testid="text-no-trade-declared">
          <span>No Trade today: {coach.noTradeReason}</span>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={coach.clearNoTrade}>
            Undo
          </Button>
        </div>
      )}

      {coach.beginnerModeEnabled && (
        <div className="pt-1">
          <ModuleLearnTrigger moduleLabel="AI Trading Coach" pathKey="trading-engine" size="xs" />
        </div>
      )}
    </CardContent>
  );

  const header = (
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-semibold flex items-center gap-2">
        <Compass className="h-4 w-4 text-primary" /> AI Trading Coach
      </CardTitle>
      {collapsible && (
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" data-testid="button-toggle-coach-panel">
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </CollapsibleTrigger>
      )}
    </CardHeader>
  );

  if (!collapsible) {
    return (
      <Card data-testid="card-ai-trading-coach">
        {header}
        {body}
      </Card>
    );
  }

  return (
    <Card data-testid="card-ai-trading-coach">
      <Collapsible open={open} onOpenChange={setOpen}>
        {header}
        <CollapsibleContent>{body}</CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
