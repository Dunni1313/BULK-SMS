// Phase 36 — Institutional Position Lifecycle Manager.
//
// PURE PRESENTATION LAYER over already-computed, already-tested backend
// data. This page introduces no new signal, score, prediction, or trading
// logic of its own — it is deterministic portfolio management workflows
// only. No live brokerage execution, no auto trading, no auto adjustments,
// no AI predictions, no direction forecasting, no position recommendations,
// no trade alerts, no automated rolling, no automated assignment handling.
//
// Every figure is a direct read from:
//   - GET /options-income/positions        — the position picker (reused,
//     unmodified, from the Options Income Workspace, Phase 35)
//   - GET/PATCH /options-lifecycle/:tradeId/state       — Lifecycle Status,
//     Review Schedule
//   - GET/POST /options-lifecycle/:tradeId/events        — Position
//     Timeline / Position History (unfiltered) and the Adjustment Journal /
//     Assignment Tracker (the same log, filtered client-side by eventType)
//   - GET/PATCH /options-lifecycle/:tradeId/checklist    — Position
//     Checklist
//   - GET /options-lifecycle/portfolio      — Portfolio Management
//     (position concentration, strategy/sector allocation, expiration
//     ladder, capital utilisation, buying power allocation, income
//     allocation), the Expiration Tracker, and the Portfolio Exposure
//     Timeline
//   - GET /options-lifecycle/coach          — the deterministic AI Coach
//   - GET /options-lifecycle/learning       — Learning Centre integration
//   - GET /reporting/options-portfolio-review,
//     GET /reporting/position-lifecycle-summary — Reporting Centre links

import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListOptionsIncomePositions,
  useGetOptionsLifecycleState,
  getGetOptionsLifecycleStateQueryKey,
  useUpdateOptionsLifecycleState,
  useGetOptionsLifecycleTimeline,
  getGetOptionsLifecycleTimelineQueryKey,
  useCreateOptionsLifecycleEvent,
  useGetOptionsLifecycleChecklist,
  getGetOptionsLifecycleChecklistQueryKey,
  useUpdateOptionsLifecycleChecklistItem,
  useGetOptionsStrategyLibrary,
  useGetOptionsLifecyclePortfolio,
  useListOptionsLifecycleCoachTopics,
  useListOptionsLifecycleLearning,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { GitBranch, ListChecks, PieChart, GraduationCap, FileBarChart2 } from "lucide-react";

const LIFECYCLE_STAGES = ["draft", "planned", "open", "monitoring", "near_expiration", "assignment_risk", "closed", "archived"] as const;
const REVIEW_CADENCES = ["daily", "weekly", "monthly", "expiration", "manual"] as const;

function fmtUsd(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function stageBadgeClass(stage: string): string {
  if (stage === "open" || stage === "monitoring") return "border-blue-500/40 text-blue-400";
  if (stage === "assignment_risk" || stage === "near_expiration") return "border-amber-500/40 text-amber-400";
  if (stage === "closed" || stage === "archived") return "border-muted-foreground/40 text-muted-foreground";
  return "border-border text-muted-foreground";
}

export default function OptionsLifecycleManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<string>("position");
  const [selectedTradeId, setSelectedTradeId] = useState<number | null>(null);
  const [eventFilter, setEventFilter] = useState<"all" | "adjustment_note" | "assignment_note" | "review" | "stage_change">("all");
  const [checklistStrategyKey, setChecklistStrategyKey] = useState<string>("");
  const [eventDraft, setEventDraft] = useState<{
    eventType: "review" | "adjustment_note" | "assignment_note";
    reviewType: (typeof REVIEW_CADENCES)[number];
    detail: string;
  }>({
    eventType: "adjustment_note",
    reviewType: "manual",
    detail: "",
  });

  const positionsQuery = useListOptionsIncomePositions({ status: "all" });
  const positions = positionsQuery.data ?? [];

  const stateQuery = useGetOptionsLifecycleState(selectedTradeId ?? 0, {
    query: { queryKey: getGetOptionsLifecycleStateQueryKey(selectedTradeId ?? 0), enabled: !!selectedTradeId },
  });
  const timelineQuery = useGetOptionsLifecycleTimeline(selectedTradeId ?? 0, {
    query: { queryKey: getGetOptionsLifecycleTimelineQueryKey(selectedTradeId ?? 0), enabled: !!selectedTradeId },
  });
  const checklistQuery = useGetOptionsLifecycleChecklist(selectedTradeId ?? 0, {
    query: { queryKey: getGetOptionsLifecycleChecklistQueryKey(selectedTradeId ?? 0), enabled: !!selectedTradeId },
  });
  const strategyLibraryQuery = useGetOptionsStrategyLibrary();
  const portfolioQuery = useGetOptionsLifecyclePortfolio();
  const coachQuery = useListOptionsLifecycleCoachTopics();
  const learningQuery = useListOptionsLifecycleLearning();

  const invalidatePosition = () => {
    if (!selectedTradeId) return;
    queryClient.invalidateQueries({ queryKey: getGetOptionsLifecycleStateQueryKey(selectedTradeId) });
    queryClient.invalidateQueries({ queryKey: getGetOptionsLifecycleTimelineQueryKey(selectedTradeId) });
    queryClient.invalidateQueries({ queryKey: ["/api/options-lifecycle/portfolio"] });
  };

  const updateState = useUpdateOptionsLifecycleState({
    mutation: {
      onSuccess: () => {
        invalidatePosition();
        toast({ title: "Lifecycle state updated" });
      },
      onError: () => toast({ title: "Could not update lifecycle state", variant: "destructive" }),
    },
  });

  const createEvent = useCreateOptionsLifecycleEvent({
    mutation: {
      onSuccess: () => {
        invalidatePosition();
        setEventDraft((d) => ({ ...d, detail: "" }));
        toast({ title: "Event recorded" });
      },
      onError: () => toast({ title: "Could not record event", variant: "destructive" }),
    },
  });

  const toggleChecklistItem = useUpdateOptionsLifecycleChecklistItem({
    mutation: {
      onSuccess: () => {
        if (selectedTradeId) queryClient.invalidateQueries({ queryKey: getGetOptionsLifecycleChecklistQueryKey(selectedTradeId) });
      },
      onError: () => toast({ title: "Could not update checklist item", variant: "destructive" }),
    },
  });

  async function instantiateChecklist() {
    if (!selectedTradeId || !checklistStrategyKey) return;
    const res = await fetch(`/api/options-lifecycle/${selectedTradeId}/checklist?strategyKey=${encodeURIComponent(checklistStrategyKey)}`);
    if (!res.ok) {
      toast({ title: "Could not build a checklist for that strategy", variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: getGetOptionsLifecycleChecklistQueryKey(selectedTradeId) });
  }

  const state = stateQuery.data;
  const timeline = timelineQuery.data ?? [];
  const filteredTimeline = eventFilter === "all" ? timeline : timeline.filter((e) => e.eventType === eventFilter);
  const checklist = checklistQuery.data;
  const portfolio = portfolioQuery.data;

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="options-lifecycle-manager">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <GitBranch className="w-6 h-6 text-emerald-400" /> Institutional Position Lifecycle Manager
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Deterministic portfolio management workflows for your own real positions — lifecycle stages, checklists,
          review schedules, the adjustment journal, the assignment tracker, and portfolio-wide allocation. No live
          brokerage execution, auto trading, auto adjustments, AI predictions, direction forecasting, position
          recommendations, trade alerts, automated rolling, or automated assignment handling.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2" data-testid="options-lifecycle-manager-labels">
          <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
            Position Lifecycle
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            Deterministic
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            No Automatic Transitions
          </Badge>
        </div>
      </div>

      <Card className="bg-card border-border" data-testid="panel-olm-position-picker">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Select a Position</CardTitle>
        </CardHeader>
        <CardContent>
          {positionsQuery.isLoading ? (
            <Skeleton className="h-9 w-64" />
          ) : positions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2" data-testid="position-picker-empty">
              No positions on record yet.
            </p>
          ) : (
            <Select
              value={selectedTradeId != null ? String(selectedTradeId) : undefined}
              onValueChange={(v) => setSelectedTradeId(Number(v))}
            >
              <SelectTrigger className="w-72" data-testid="position-picker-select">
                <SelectValue placeholder="Choose a position…" />
              </SelectTrigger>
              <SelectContent>
                {positions.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)} data-testid={`position-picker-option-${p.id}`}>
                    {p.underlying} — {p.strategyLabel ?? p.strategy} ({p.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="position" data-testid="tab-olm-position">
            <GitBranch className="w-4 h-4 mr-1" /> Position Workspace
          </TabsTrigger>
          <TabsTrigger value="checklist" data-testid="tab-olm-checklist">
            <ListChecks className="w-4 h-4 mr-1" /> Checklist
          </TabsTrigger>
          <TabsTrigger value="portfolio" data-testid="tab-olm-portfolio">
            <PieChart className="w-4 h-4 mr-1" /> Portfolio Management
          </TabsTrigger>
          <TabsTrigger value="learning" data-testid="tab-olm-learning">
            <GraduationCap className="w-4 h-4 mr-1" /> Coach & Learning
          </TabsTrigger>
          <TabsTrigger value="reporting" data-testid="tab-olm-reporting">
            <FileBarChart2 className="w-4 h-4 mr-1" /> Reporting
          </TabsTrigger>
        </TabsList>

        {/* ─── Position Workspace: Lifecycle Status, Review Schedule, Timeline/History, Adjustment Journal, Assignment Tracker ── */}
        <TabsContent value="position" className="space-y-4 mt-4">
          {!selectedTradeId ? (
            <p className="text-xs text-muted-foreground py-2" data-testid="position-workspace-no-selection">
              Select a position above to view its lifecycle status, timeline, and review schedule.
            </p>
          ) : (
            <>
              <Card className="bg-card border-border" data-testid="panel-olm-lifecycle-status">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Lifecycle Status & Review Schedule</CardTitle>
                  <CardDescription className="text-xs">
                    An explicit user action, never an automatic transition. Changing the stage or cadence below is
                    the only way either ever changes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {stateQuery.isLoading ? (
                    <Skeleton className="h-16" />
                  ) : state ? (
                    <>
                      <div className="flex items-center gap-2" data-testid="current-stage-badge">
                        <span className="text-xs text-muted-foreground">Current stage:</span>
                        <Badge variant="outline" className={`text-[11px] ${stageBadgeClass(state.stage)}`}>
                          {state.stage.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-xs text-muted-foreground ml-4">Review cadence:</span>
                        <Badge variant="outline" className="text-[11px]">
                          {state.reviewCadence}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5" data-testid="stage-selector">
                        {LIFECYCLE_STAGES.map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant={state.stage === s ? "default" : "outline"}
                            onClick={() => updateState.mutate({ tradeId: selectedTradeId, data: { stage: s } })}
                            data-testid={`stage-option-${s}`}
                          >
                            {s.replace(/_/g, " ")}
                          </Button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5" data-testid="cadence-selector">
                        {REVIEW_CADENCES.map((c) => (
                          <Button
                            key={c}
                            size="sm"
                            variant={state.reviewCadence === c ? "default" : "outline"}
                            onClick={() => updateState.mutate({ tradeId: selectedTradeId, data: { reviewCadence: c } })}
                            data-testid={`cadence-option-${c}`}
                          >
                            {c}
                          </Button>
                        ))}
                      </div>
                    </>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="bg-card border-border" data-testid="panel-olm-log-event">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Log a Review, Adjustment Note, or Assignment Note</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-1.5" data-testid="event-type-selector">
                    {(["adjustment_note", "assignment_note", "review"] as const).map((t) => (
                      <Button
                        key={t}
                        size="sm"
                        variant={eventDraft.eventType === t ? "default" : "outline"}
                        onClick={() => setEventDraft((d) => ({ ...d, eventType: t }))}
                        data-testid={`event-type-${t}`}
                      >
                        {t.replace(/_/g, " ")}
                      </Button>
                    ))}
                  </div>
                  {eventDraft.eventType === "review" && (
                    <Select
                      value={eventDraft.reviewType}
                      onValueChange={(v) => setEventDraft((d) => ({ ...d, reviewType: v as (typeof REVIEW_CADENCES)[number] }))}
                    >
                      <SelectTrigger className="w-48" data-testid="event-review-type-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REVIEW_CADENCES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Textarea
                    value={eventDraft.detail}
                    onChange={(e) => setEventDraft((d) => ({ ...d, detail: e.target.value }))}
                    placeholder="What did you check or decide?"
                    className="text-xs min-h-[3rem]"
                    data-testid="event-detail-input"
                  />
                  <Button
                    size="sm"
                    disabled={!eventDraft.detail.trim()}
                    onClick={() =>
                      createEvent.mutate({
                        tradeId: selectedTradeId,
                        data: {
                          eventType: eventDraft.eventType,
                          reviewType: eventDraft.eventType === "review" ? eventDraft.reviewType : undefined,
                          detail: eventDraft.detail.trim(),
                        },
                      })
                    }
                    data-testid="event-submit"
                  >
                    Record
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card border-border" data-testid="panel-olm-timeline">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Position Timeline / History</CardTitle>
                  <CardDescription className="text-xs">
                    Every stage change, review, adjustment note, and assignment note — newest first. The Adjustment
                    Journal and Assignment Tracker are this same log, filtered.
                  </CardDescription>
                  <div className="flex flex-wrap gap-1.5 mt-2" data-testid="timeline-filter">
                    {(["all", "adjustment_note", "assignment_note", "review", "stage_change"] as const).map((f) => (
                      <Button
                        key={f}
                        size="sm"
                        variant={eventFilter === f ? "default" : "outline"}
                        onClick={() => setEventFilter(f)}
                        data-testid={`timeline-filter-${f}`}
                      >
                        {f === "all" ? "All (History)" : f === "adjustment_note" ? "Adjustment Journal" : f === "assignment_note" ? "Assignment Tracker" : f.replace(/_/g, " ")}
                      </Button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  {timelineQuery.isLoading ? (
                    <Skeleton className="h-32" />
                  ) : filteredTimeline.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2" data-testid="timeline-empty">
                      No {eventFilter === "all" ? "" : eventFilter.replace(/_/g, " ") + " "}entries recorded yet.
                    </p>
                  ) : (
                    <ul className="space-y-2" data-testid="timeline-list">
                      {filteredTimeline.map((e) => (
                        <li key={e.id} className="border border-border rounded p-2 text-xs" data-testid={`timeline-event-${e.id}`}>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px]">
                              {e.eventType.replace(/_/g, " ")}
                            </Badge>
                            {e.reviewType && (
                              <Badge variant="outline" className="text-[9px]">
                                {e.reviewType}
                              </Badge>
                            )}
                            <span className="text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="mt-1">{e.detail}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ─── Checklist ────────────────────────────────────────────────────── */}
        <TabsContent value="checklist" className="space-y-4 mt-4">
          {!selectedTradeId ? (
            <p className="text-xs text-muted-foreground py-2" data-testid="checklist-no-selection">
              Select a position above to view or build its institutional checklist.
            </p>
          ) : (
            <Card className="bg-card border-border" data-testid="panel-olm-checklist">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Position Checklist</CardTitle>
                <CardDescription className="text-xs">
                  Checklist data only — completing every item never submits an order, triggers an adjustment, or
                  changes the position's lifecycle stage automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {checklistQuery.isLoading ? (
                  <Skeleton className="h-32" />
                ) : checklist ? (
                  <ul className="space-y-1.5" data-testid="checklist-items">
                    {checklist.items.map((item) => (
                      <li key={item.id} className="flex items-start gap-2 text-xs" data-testid={`checklist-item-${item.id}`}>
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={(e) =>
                            toggleChecklistItem.mutate({ tradeId: selectedTradeId, data: { itemId: item.id, checked: e.target.checked } })
                          }
                          data-testid={`checklist-item-checkbox-${item.id}`}
                        />
                        <span className={item.checked ? "line-through text-muted-foreground" : ""}>
                          {item.label} {item.required && <span className="text-amber-400">*</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="space-y-2" data-testid="checklist-build-form">
                    <p className="text-xs text-muted-foreground">
                      No checklist yet for this position. Choose the strategy it matches to build one from the
                      static institutional template.
                    </p>
                    <div className="flex items-center gap-2">
                      <Select value={checklistStrategyKey} onValueChange={setChecklistStrategyKey}>
                        <SelectTrigger className="w-56" data-testid="checklist-strategy-select">
                          <SelectValue placeholder="Choose a strategy…" />
                        </SelectTrigger>
                        <SelectContent>
                          {(strategyLibraryQuery.data ?? []).map((t) => (
                            <SelectItem key={t.key} value={t.key}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" disabled={!checklistStrategyKey} onClick={instantiateChecklist} data-testid="checklist-build-submit">
                        Build Checklist
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Portfolio Management ────────────────────────────────────────── */}
        <TabsContent value="portfolio" className="space-y-4 mt-4">
          {portfolioQuery.isLoading ? (
            <Skeleton className="h-64" />
          ) : portfolio ? (
            <>
              <Card className="bg-card border-border" data-testid="panel-olm-lifecycle-summary">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Position Lifecycle Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Positions</p>
                      <p className="text-lg font-semibold" data-testid="lifecycle-summary-total">
                        {portfolio.lifecycleSummary.totalPositions}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Awaiting Review</p>
                      <p className="text-lg font-semibold" data-testid="lifecycle-summary-awaiting-review">
                        {portfolio.lifecycleSummary.positionsAwaitingReview}
                      </p>
                    </div>
                  </div>
                  <ul className="space-y-1 text-xs text-muted-foreground" data-testid="lifecycle-summary-by-stage">
                    {portfolio.lifecycleSummary.byStage
                      .filter((s) => s.count > 0)
                      .map((s) => (
                        <li key={s.stage}>
                          {s.stage.replace(/_/g, " ")}: {s.count}
                        </li>
                      ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-card border-border" data-testid="panel-olm-capital-utilisation">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Capital & Buying Power</CardTitle>
                  <CardDescription className="text-xs">
                    Reused directly from the existing Portfolio Risk Dashboard — never recomputed here.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Portfolio Value</p>
                      <p className="text-lg font-semibold">{fmtUsd(portfolio.capitalUtilisation.portfolioValue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Risk</p>
                      <p className="text-lg font-semibold">{portfolio.capitalUtilisation.totalRiskPct.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Buying Power</p>
                      <p className="text-lg font-semibold">{fmtUsd(portfolio.buyingPowerAllocation.buyingPower)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-card border-border" data-testid="panel-olm-position-concentration">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Position Concentration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {portfolio.positionConcentration.length === 0 ? (
                      <p className="text-xs text-muted-foreground" data-testid="position-concentration-empty">No open positions.</p>
                    ) : (
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {portfolio.positionConcentration.map((b) => (
                          <li key={b.key}>
                            {b.label}: {b.weightPct.toFixed(1)}%
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-card border-border" data-testid="panel-olm-strategy-allocation">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Strategy Allocation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {portfolio.strategyAllocation.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No open positions.</p>
                    ) : (
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {portfolio.strategyAllocation.map((b) => (
                          <li key={b.key}>
                            {b.label}: {b.weightPct.toFixed(1)}%
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-card border-border" data-testid="panel-olm-sector-allocation">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Sector Allocation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {portfolio.sectorAllocation.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No open positions.</p>
                    ) : (
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {portfolio.sectorAllocation.map((b) => (
                          <li key={b.key}>
                            {b.label}: {b.weightPct.toFixed(1)}%
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-card border-border" data-testid="panel-olm-expiration-ladder">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Expiration Ladder</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {portfolio.expirationLadder.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No open positions.</p>
                    ) : (
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {portfolio.expirationLadder.map((b) => (
                          <li key={b.key}>
                            {b.label}: {b.weightPct.toFixed(1)}%
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-card border-border" data-testid="panel-olm-income-allocation">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Income Allocation</CardTitle>
                  <CardDescription className="text-xs">Reused directly from the Options Income Engine.</CardDescription>
                </CardHeader>
                <CardContent>
                  {portfolio.incomeAllocation.strategyMix.length === 0 ? (
                    <p className="text-xs text-muted-foreground" data-testid="income-allocation-empty">
                      No open positions currently generating income.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-xs text-muted-foreground" data-testid="income-allocation-list">
                      {portfolio.incomeAllocation.strategyMix.map((m) => (
                        <li key={m.strategy}>
                          {m.strategyLabel ?? m.strategy}: {m.positionCount} position(s) · {fmtUsd(m.capitalAllocated)}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card border-border" data-testid="panel-olm-expiration-tracker">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Expiration Tracker</CardTitle>
                </CardHeader>
                <CardContent>
                  {portfolio.expirationTracker.length === 0 ? (
                    <p className="text-xs text-muted-foreground" data-testid="expiration-tracker-empty">
                      No open positions with a recorded expiration date.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-xs text-muted-foreground" data-testid="expiration-tracker-list">
                      {portfolio.expirationTracker.map((g) => (
                        <li key={g.expiration}>
                          {g.expiration} ({g.daysToExpiry}d): {g.positions.length} position(s)
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card border-border" data-testid="panel-olm-exposure-timeline">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Portfolio Exposure Timeline</CardTitle>
                  <CardDescription className="text-xs">
                    Trailing month-end open-position counts, reconstructed from your own real trades — never a
                    fabricated snapshot.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-xs text-muted-foreground" data-testid="exposure-timeline-list">
                    {portfolio.exposureTimeline.map((p) => (
                      <li key={p.monthEnd}>
                        {p.monthEnd}: {p.openPositionsCount} open
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {/* ─── Coach & Learning ────────────────────────────────────────────── */}
        <TabsContent value="learning" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-olm-coach">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">AI Coach</CardTitle>
              <CardDescription className="text-xs">
                Deterministic explanations of lifecycle mechanics and process — never a trade recommendation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {coachQuery.isLoading ? (
                <Skeleton className="h-32" />
              ) : (
                <div className="space-y-3" data-testid="coach-topics">
                  {(coachQuery.data ?? []).map((t) => (
                    <div key={t.topic} data-testid={`coach-topic-${t.topic}`}>
                      <p className="text-sm font-semibold">{t.title}</p>
                      {t.explanation.map((p, i) => (
                        <p key={i} className="text-xs text-muted-foreground mt-1">
                          {p}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border" data-testid="panel-olm-learning">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Learning Centre — By Lifecycle Stage</CardTitle>
              <CardDescription className="text-xs">
                Existing Learning Centre content connected to each stage — lessons, strategy explanations, risk
                concepts, and assignment concepts. No duplicated content.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {learningQuery.isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <div className="space-y-3" data-testid="learning-by-stage">
                  {(learningQuery.data ?? []).map((bundle) => (
                    <div key={bundle.stage} data-testid={`learning-stage-${bundle.stage}`}>
                      <p className="text-xs font-semibold">{bundle.stage.replace(/_/g, " ")}</p>
                      <ul className="space-y-0.5">
                        {bundle.links.map((l) => (
                          <li key={`${l.pathKey}-${l.topicKey}`}>
                            <Link href={l.href} className="text-xs text-primary hover:underline" data-testid={`learning-link-${l.pathKey}-${l.topicKey}`}>
                              {l.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Reporting ───────────────────────────────────────────────────── */}
        <TabsContent value="reporting" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-olm-reporting">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Lifecycle Reporting</CardTitle>
              <CardDescription className="text-xs">
                Options Portfolio Review and Position Lifecycle Summary, reused from the platform's own
                Institutional Reporting Centre.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link
                href="/reporting-centre?reportType=options-portfolio-review"
                className="text-xs text-primary hover:underline block"
                data-testid="link-report-options-portfolio-review"
              >
                Generate Options Portfolio Review →
              </Link>
              <Link
                href="/reporting-centre?reportType=position-lifecycle-summary"
                className="text-xs text-primary hover:underline block"
                data-testid="link-report-position-lifecycle-summary"
              >
                Generate Position Lifecycle Summary →
              </Link>
              <Link href="/reporting-centre" className="text-xs text-primary hover:underline block" data-testid="link-reporting-centre">
                Open the Institutional Reporting Centre →
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
