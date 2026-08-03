// v1.5.0, Sprint 12 — Institutional Command Centre.
//
// The platform's new single daily starting point, mounted at "/". Per the
// approved scope: "orchestrates every existing module... does NOT replace
// existing modules, does NOT duplicate existing functionality." Every
// figure below is a direct, unmodified reuse of an already-existing
// generated hook or component this codebase already ships — this page
// introduces exactly one new piece of glue logic (useWorkflowSnapshot(),
// a client-side count over already-existing fetch functions) and zero new
// backend routes, database tables, or business calculations.
//
// Reused, not duplicated:
//   - components/briefing/DailyBriefingCard.tsx (itself extracted from
//     CrossEngineDailyReport.tsx this same sprint) — "AI Daily Briefing."
//   - components/layout/PlatformJourneyNav.tsx's own PLATFORM_JOURNEY_STAGES
//     — the canonical 9-stage id/label/href list (Sprint 11), extended
//     here with real status/pending-count data per stage.
//   - components/learn/AskCoachLauncher.tsx — the existing global AI
//     Coach panel, for the Coach Panel section.
//   - useGetLearningProgress() — Learning Centre progress (Sprint 11's
//     ModuleLearnDrawer already established this exact hook/shape).
//   - useGetPortfolioDashboard() — Portfolio Snapshot (same hook
//     CommandCenter.tsx/Home.tsx already use).
//   - useGetMarketBriefing()/useGetMacroContext()/useGetTopOpportunities()/
//     useGetUpcomingEvents()/useGetValueWatchlist() — Market Overview
//     (each already powers an existing page elsewhere in this codebase).
//   - useListNotifications() — the real, backend-generated notification
//     feed (Phase 4, Sprint 56), merged with a deterministic "Action
//     Items" list derived from the Workflow Panel's own already-computed
//     pending counts — never a fabricated second notification system.
//
// This page superseded pages/Home.tsx at the "/" route this sprint — Home
// itself is completely unmodified and fully preserved, just relocated to
// "/personal-dashboard" (see App.tsx/nav-items.ts), the same "move, cross-
// link, never delete" pattern this codebase already used once before when
// Home.tsx itself superseded the original CommandCenter.tsx at "/" (Phase 10).

import { useMemo } from "react";
import { Link } from "wouter";
import {
  useGetPortfolioDashboard,
  useGetLearningProgress,
  useGetMarketBriefing,
  useGetMacroContext,
  useGetTopOpportunities,
  useGetUpcomingEvents,
  useGetValueWatchlist,
  useListNotifications,
  getListNotificationsQueryKey,
  useListJournalEntries,
  useListTrades,
} from "@workspace/api-client-react";
import { useSession } from "@/lib/auth-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PLATFORM_JOURNEY_STAGES, type PlatformJourneyStageId } from "@/components/layout/PlatformJourneyNav";
import { DailyBriefingCard } from "@/components/briefing/DailyBriefingCard";
import { AiTradingCoachPanel } from "@/components/coach/AiTradingCoachPanel";
import { AskCoachLauncher } from "@/components/learn/AskCoachLauncher";
import { GuidedTourTrigger } from "@/components/tour/GuidedTourTrigger";
import { COMMAND_CENTRE_QUICK_ACTIONS } from "@/lib/quick-actions";
import { useWorkflowSnapshot } from "@/lib/useWorkflowSnapshot";
import { useActiveDecisionSummary } from "@/lib/useDecisionWorkflow";
import { useTradeLifecyclePipeline } from "@/lib/useTradeLifecycle";
import { PIPELINE_STAGES, type PipelineStageId } from "@/lib/tradeLifecycle";
import { usePortfolioRiskIntelligence } from "@/lib/usePortfolioRiskIntelligence";
import { useWorkflowAutomation } from "@/lib/useWorkflowAutomation";
import { useKnowledgeGraph } from "@/lib/useKnowledgeGraph";
import { buildKnowledgeInsights } from "@/lib/knowledgeGraph";
import { usePlaybooks } from "@/lib/usePlaybooks";
import { useDecisionQualityEngine } from "@/lib/useDecisionQualityEngine";
import { useMarketIntelligence } from "@/lib/useMarketIntelligence";
import { watchlistRelevantItems, priorityItems, todaysKeyEvents, upcomingEconomicReleases } from "@/lib/marketIntelligence";
import { useOpportunityPipeline } from "@/lib/useOpportunityPipeline";
import {
  Compass,
  ShieldAlert,
  Landmark,
  GraduationCap,
  Bell,
  Bot,
  CalendarClock,
  Newspaper,
  Milestone,
  Route,
  GaugeCircle,
  Workflow,
  PauseCircle,
  CheckCircle2,
  Network,
  BookMarked,
  BadgeCheck,
  TrendingUp,
  AlertTriangle,
  Globe,
  Flame,
  Eye,
  Sparkles,
  Lightbulb,
  Archive,
} from "lucide-react";

function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function ratingBadgeClass(code: string): string {
  if (code === "healthy") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (code === "moderate_risk") return "bg-sky-500/15 text-sky-400 border-sky-500/30";
  if (code === "elevated_risk") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
}

// Kept local, not merged into any shared vocabulary module — Engine 1's
// macro regime (rising_rates/falling_rates/stable_rates) and Engine 3's
// market briefing regime (risk_on/neutral/risk_off) are two different
// enums, the exact same "distinct engine vocabularies, deliberately kept
// local and unmerged" precedent InstitutionalDashboard.tsx and
// CrossEngineDailyReport.tsx already established for these same two
// fields (Phase 4/5, Sprints 55/68).
function macroRegimeBadgeClass(regime: string): string {
  if (regime === "rising_rates") return "border-amber-500/40 text-amber-400";
  if (regime === "falling_rates") return "border-sky-500/40 text-sky-400";
  return "border-border text-muted-foreground";
}

function briefingRegimeBadgeClass(regime: string): string {
  if (regime === "risk_on") return "border-emerald-500/40 text-emerald-400";
  if (regime === "risk_off") return "border-rose-500/40 text-rose-400";
  return "border-border text-muted-foreground";
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// ─── Workflow Panel ────────────────────────────────────────────────────

interface StageStatus {
  detail: string;
  pendingCount: number | null;
}

function useStageStatuses(
  snapshot: ReturnType<typeof useWorkflowSnapshot>,
  watchlistCount: number | undefined,
  journalOutstanding: number | null,
  performanceLabel: string,
  portfolioElevatedCount: number | undefined,
  learningInProgress: number | undefined,
  decisionSummary: ReturnType<typeof useActiveDecisionSummary>,
  pipeline: ReturnType<typeof useTradeLifecyclePipeline>,
  discoverPipeline: ReturnType<typeof useOpportunityPipeline>,
): Record<PlatformJourneyStageId, StageStatus> {
  const openPositionCount = pipeline.records.filter((r) => r.currentStage === "open-position").length;
  const managingCount = pipeline.records.filter((r) => r.currentStage === "managing").length;
  return {
    // v1.6.0, Sprint 3 — UX Transformation. Reuses useOpportunityPipeline()
    // directly (the exact same hook backing OpportunityPipelineCard below)
    // — never a second, duplicate discovery computation for this new stage.
    discover: {
      detail: discoverPipeline.loading
        ? "Loading…"
        : discoverPipeline.discovered.length === 0
          ? "Nothing new to discover right now"
          : `${discoverPipeline.discovered.length} discovered opportunit${discoverPipeline.discovered.length === 1 ? "y" : "ies"} to review`,
      pendingCount: discoverPipeline.loading ? null : discoverPipeline.discovered.length,
    },
    research: {
      detail: watchlistCount === undefined ? "Loading…" : `${watchlistCount} symbol${watchlistCount === 1 ? "" : "s"} on your watchlist`,
      pendingCount: watchlistCount ?? null,
    },
    notebook: {
      detail: snapshot.loading ? "Loading…" : `${snapshot.notebookCount} notebook${snapshot.notebookCount === 1 ? "" : "s"} across Trading, Investing, Options`,
      pendingCount: snapshot.loading ? null : snapshot.notebookCount,
    },
    strategy: {
      detail: snapshot.loading ? "Loading…" : `${snapshot.strategiesDraftCount} strateg${snapshot.strategiesDraftCount === 1 ? "y" : "ies"} in draft, awaiting review`,
      pendingCount: snapshot.loading ? null : snapshot.strategiesDraftCount,
    },
    "trade-plan": {
      detail: snapshot.loading ? "Loading…" : `${snapshot.tradePlansReadyCount} trade plan${snapshot.tradePlansReadyCount === 1 ? "" : "s"} marked Ready`,
      pendingCount: snapshot.loading ? null : snapshot.tradePlansReadyCount,
    },
    // v1.5.0, Sprint 13 — Institutional Decision Engine. Reuses
    // useActiveDecisionSummary() directly (the exact same hook backing the
    // "Decision in Progress" card below) — never a second, duplicate
    // scoring formula computed for this stage.
    decision: {
      detail: decisionSummary.loading
        ? "Loading…"
        : !decisionSummary.tradePlan
          ? "No decision in progress"
          : `${decisionSummary.score?.overall ?? 0}/100 — ${decisionSummary.score?.label ?? "Just Started"}`,
      pendingCount: null,
    },
    execute: {
      detail: "Executed manually at your own external broker — this platform never places, closes, or modifies a real order.",
      pendingCount: null,
    },
    // v1.5.0, Sprint 14 — Institutional Execution & Lifecycle Manager.
    // Reuses useTradeLifecyclePipeline() directly (the same hook backing
    // the Execution Pipeline card below) — never a second, duplicate
    // pipeline computation for these two stages.
    "open-position": {
      detail: pipeline.loading ? "Loading…" : openPositionCount === 0 ? "No freshly opened positions" : `${openPositionCount} freshly opened position${openPositionCount === 1 ? "" : "s"}`,
      pendingCount: pipeline.loading ? null : openPositionCount,
    },
    "trade-management": {
      detail: pipeline.loading ? "Loading…" : managingCount === 0 ? "No open positions being actively managed" : `${managingCount} open position${managingCount === 1 ? "" : "s"} being actively managed`,
      pendingCount: pipeline.loading ? null : managingCount,
    },
    "trade-journal": {
      detail:
        journalOutstanding === null
          ? "Loading…"
          : journalOutstanding === 0
            ? "No recent closed trades missing a journal entry"
            : `${journalOutstanding} recent closed trade${journalOutstanding === 1 ? "" : "s"} without a journal entry`,
      pendingCount: journalOutstanding,
    },
    performance: {
      detail: performanceLabel,
      pendingCount: null,
    },
    portfolio: {
      detail:
        portfolioElevatedCount === undefined
          ? "Loading…"
          : portfolioElevatedCount === 0
            ? "No elevated portfolio risk alerts"
            : `${portfolioElevatedCount} elevated risk alert${portfolioElevatedCount === 1 ? "" : "s"}`,
      pendingCount: portfolioElevatedCount ?? null,
    },
    learning: {
      detail:
        learningInProgress === undefined
          ? "Loading…"
          : learningInProgress === 0
            ? "No learning paths in progress"
            : `${learningInProgress} learning path${learningInProgress === 1 ? "" : "s"} in progress`,
      pendingCount: learningInProgress ?? null,
    },
  };
}

function WorkflowPanel({ statuses }: { statuses: Record<PlatformJourneyStageId, StageStatus> }) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-9 gap-2"
      data-testid="workflow-panel"
    >
      {PLATFORM_JOURNEY_STAGES.map((stage, i) => {
        const status = statuses[stage.id];
        const content = (
          <Card
            className={`h-full bg-card border-border ${stage.href ? "hover:border-primary/50 transition-colors cursor-pointer" : ""}`}
            data-testid={`workflow-stage-${stage.id}`}
          >
            <CardContent className="pt-4 pb-3 space-y-1.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {i + 1}. {stage.label}
                </span>
                {status.pendingCount !== null && status.pendingCount > 0 && (
                  <Badge className="h-4 px-1.5 text-[9px] bg-indigo-500/15 text-indigo-400 border-indigo-500/30">
                    {status.pendingCount}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-snug" data-testid={`workflow-stage-detail-${stage.id}`}>
                {status.detail}
              </p>
            </CardContent>
          </Card>
        );
        return stage.href ? (
          <Link key={stage.id} href={stage.href} data-testid={`workflow-stage-link-${stage.id}`}>
            {content}
          </Link>
        ) : (
          <div key={stage.id}>{content}</div>
        );
      })}
    </div>
  );
}

// ─── Market Overview ───────────────────────────────────────────────────

function MarketOverviewCard() {
  const { data: briefingResponse, isLoading: briefingLoading } = useGetMarketBriefing();
  const briefing = briefingResponse?.briefing;
  const { data: macro } = useGetMacroContext();
  const { data: topOpps } = useGetTopOpportunities();
  const { data: events } = useGetUpcomingEvents();
  const topPick = topOpps?.ironCondors?.[0] ?? topOpps?.calendarSpreads?.[0] ?? null;
  const upcoming = (events ?? []).slice(0, 3);

  return (
    <Card className="bg-card border-border" data-testid="card-market-overview">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Newspaper className="h-4 w-4" /> Market Overview
        </CardTitle>
        <CardDescription>
          Engine 3's market briefing + Engine 1's macro regime, reused from{" "}
          <Link href="/portfolio-ai" className="underline">Portfolio AI</Link> and{" "}
          <Link href="/institutional-dashboard" className="underline">Institutional Dashboard</Link>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {briefingLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : briefing ? (
          <div className="flex flex-wrap items-center gap-2" data-testid="market-overview-briefing">
            <Badge variant="outline" className={briefingRegimeBadgeClass(briefing.regime)}>
              {briefing.regimeLabel}
            </Badge>
            <Badge variant="outline" className="border-border text-muted-foreground">
              {briefing.vixLabel}
            </Badge>
            <p className="text-sm text-muted-foreground w-full">{briefing.headline}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Market briefing unavailable.</p>
        )}

        {macro && (
          <div data-testid="market-overview-macro">
            <Badge variant="outline" className={macroRegimeBadgeClass(macro.regime)}>
              {macro.regimeLabel}
            </Badge>
          </div>
        )}

        <div>
          <p className="text-xs text-muted-foreground mb-1">Top Scanner Opportunity</p>
          {topPick ? (
            <p className="text-sm" data-testid="market-overview-top-opportunity">
              <span className="font-mono">{topPick.symbol}</span> ({topPick.strategy.replace(/_/g, " ")}), Ravish score{" "}
              {topPick.ravishScore}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="market-overview-no-opportunity">
              No scanner opportunities currently ranked.
            </p>
          )}
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <CalendarClock className="h-3 w-3" /> Upcoming Events
          </p>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="market-overview-no-events">
              No known upcoming events.
            </p>
          ) : (
            <ul className="space-y-0.5 text-xs text-muted-foreground" data-testid="market-overview-events">
              {upcoming.map((e, i) => (
                <li key={i}>
                  {e.date} — {e.label ?? e.type}
                  {e.symbol ? ` (${e.symbol})` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link href="/events" className="text-xs font-medium text-primary hover:underline">
          Open Event Calendar →
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── Portfolio Snapshot ────────────────────────────────────────────────

function PortfolioSnapshotCard() {
  const { data: dash, isLoading } = useGetPortfolioDashboard();
  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }
  if (!dash) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground" data-testid="portfolio-snapshot-unavailable">
            Portfolio Snapshot unavailable.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="bg-card border-border" data-testid="card-portfolio-snapshot">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" /> Portfolio Snapshot
        </CardTitle>
        <CardDescription>
          Reused directly from{" "}
          <Link href="/portfolio-dashboard" className="underline">Portfolio Risk Dashboard</Link>.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Portfolio Value</div>
          <div className="font-mono" data-testid="portfolio-snapshot-value">{fmtUsd(dash.portfolioValue)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Health Score</div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono">{dash.healthScore}/100</span>
            <Badge className={ratingBadgeClass(dash.overallRiskRating.code)}>{dash.overallRiskRating.label}</Badge>
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Cash / Buying Power</div>
          <div className="font-mono" data-testid="portfolio-snapshot-buying-power">{fmtUsd(dash.buyingPower)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Open Risk Alerts</div>
          <div className="font-mono" data-testid="portfolio-snapshot-guidance-count">{dash.guidance.length}</div>
        </div>
        <div className="col-span-2">
          <div className="text-xs text-muted-foreground mb-1">Sector Allocation</div>
          {dash.allocationBySector.length === 0 ? (
            <p className="text-xs text-muted-foreground">No open positions.</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {dash.allocationBySector.slice(0, 4).map((b) => (
                <Badge key={b.label} variant="outline" className="text-[10px]">
                  {b.label} {b.weightPct.toFixed(0)}%
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Decision in Progress ──────────────────────────────────────────────
// v1.5.0, Sprint 13 — Institutional Decision Engine. Surfaces the user's
// single most recently updated in-progress decision (an existing Trade
// Plan, never a new entity — see lib/decisionWorkflow.ts's own header
// comment) via useActiveDecisionSummary(), a lightweight reuse of the same
// pure scoring functions the full /decision-workflow page uses — never a
// second, duplicate scoring formula computed here.

function DecisionInProgressCard() {
  const summary = useActiveDecisionSummary();

  if (summary.loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border" data-testid="card-decision-in-progress">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Milestone className="h-4 w-4" /> Decision in Progress
        </CardTitle>
        <CardDescription>
          Reused directly from{" "}
          <Link href="/decision-workflow" className="underline">
            Decision Workflow
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {!summary.tradePlan ? (
          <p className="text-sm text-muted-foreground" data-testid="decision-in-progress-none">
            No decision in progress right now.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium" data-testid="decision-in-progress-title">{summary.tradePlan.title}</p>
              {summary.score && (
                <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30" data-testid="decision-in-progress-score">
                  {summary.score.overall}/100 — {summary.score.label}
                </Badge>
              )}
            </div>
            {summary.weakestStage && (
              <p className="text-xs text-muted-foreground" data-testid="decision-in-progress-gap">
                Evidence gap: {summary.weakestStage.label}
                {summary.weakestStage.missingInfo.length > 0 ? ` — ${summary.weakestStage.missingInfo[0]}` : ""}
              </p>
            )}
            <Link
              href={`/decision-workflow?planId=${summary.tradePlan.id}`}
              className="text-xs font-medium text-primary hover:underline"
              data-testid="decision-in-progress-link"
            >
              {summary.weakestStage ? `Next step: ${summary.weakestStage.recommendedAction}` : "Continue this decision"} →
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Execution Pipeline (v1.5.0, Sprint 14) ────────────────────────────
// Reuses useTradeLifecyclePipeline() directly — the same hook backing the
// Workflow Panel's own "open-position"/"trade-management" stage statuses
// above and the /execution-lifecycle Pipeline board itself. Surfaces
// exactly what the approved scope named: trades requiring action, open
// positions, execution-ready trades, pipeline bottlenecks, portfolio
// impact, and recent completions — never a second, duplicate pipeline
// computation.

function bottleneckStage(records: ReturnType<typeof useTradeLifecyclePipeline>["records"]): { id: PipelineStageId; label: string; count: number } | null {
  const nonTerminal = records.filter((r) => r.currentStage !== "archived" && r.currentStage !== "reviewed");
  if (nonTerminal.length === 0) return null;
  const counts = new Map<PipelineStageId, number>();
  for (const r of nonTerminal) counts.set(r.currentStage, (counts.get(r.currentStage) ?? 0) + 1);
  let winner: { id: PipelineStageId; count: number } | null = null;
  for (const [id, count] of counts) {
    if (!winner || count > winner.count) winner = { id, count };
  }
  if (!winner) return null;
  const label = PIPELINE_STAGES.find((s) => s.id === winner!.id)?.label ?? winner.id;
  return { id: winner.id, label, count: winner.count };
}

function ExecutionPipelineCard({ pipeline }: { pipeline: ReturnType<typeof useTradeLifecyclePipeline> }) {
  if (pipeline.loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const { records } = pipeline;
  const requiringAction = records.filter((r) => r.outstandingTasks.length > 0 && r.currentStage !== "archived");
  const openPositions = records.filter((r) => r.currentStage === "open-position" || r.currentStage === "managing");
  const executionReady = records.filter((r) => r.currentStage === "ready-to-execute");
  const recentCompletions = records
    .filter((r) => r.currentStage === "reviewed")
    .sort((a, b) => new Date(b.tradePlan.updatedAt).getTime() - new Date(a.tradePlan.updatedAt).getTime())
    .slice(0, 3);
  const bottleneck = bottleneckStage(records);

  return (
    <Card className="bg-card border-border" data-testid="card-execution-pipeline">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Route className="h-4 w-4" /> Execution Pipeline
        </CardTitle>
        <CardDescription>
          Reused directly from{" "}
          <Link href="/execution-lifecycle" className="underline">
            Execution &amp; Lifecycle Manager
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Requiring Action</p>
            <p data-testid="pipeline-requiring-action">{requiringAction.length}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Open Positions</p>
            <p data-testid="pipeline-open-positions">{openPositions.length}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Execution-Ready</p>
            <p data-testid="pipeline-execution-ready">{executionReady.length}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Bottleneck</p>
            <p data-testid="pipeline-bottleneck">{bottleneck ? `${bottleneck.label} (${bottleneck.count})` : "None"}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Recent Completions</p>
          {recentCompletions.length === 0 ? (
            <p className="text-xs text-muted-foreground" data-testid="pipeline-recent-completions-none">None yet.</p>
          ) : (
            <ul className="text-xs space-y-0.5" data-testid="pipeline-recent-completions-list">
              {recentCompletions.map((r) => (
                <li key={r.tradePlan.id}>{r.tradePlan.title}</li>
              ))}
            </ul>
          )}
        </div>
        <Link href="/execution-lifecycle" className="text-xs font-medium text-primary hover:underline inline-block" data-testid="pipeline-view-link">
          Open the full Pipeline →
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── Portfolio & Risk Intelligence (v1.5.0, Sprint 15) ─────────────────
// Reuses usePortfolioRiskIntelligence() directly — the exact same hook
// backing the full /portfolio-risk-intelligence page. Surfaces exactly
// what the approved scope named: Portfolio Health, Risk Alerts, Exposure,
// Allocation, Pending Trade Impact, Portfolio Trends, and Recommended
// Review Tasks — never a second, duplicate health-scoring or risk-signal
// computation. "Portfolio Trends" is honestly disclosed as a point-in-time
// reading — no historical snapshot/trend-tracking table exists for this
// Health Score, and none was fabricated to fill the label.

function healthLabelBadgeClass(label: string): string {
  if (label === "Excellent" || label === "Strong") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (label === "Moderate") return "bg-sky-500/15 text-sky-400 border-sky-500/30";
  if (label === "Elevated Risk") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
}

function PortfolioIntelligenceCard() {
  const { health, risk, coachNarrative } = usePortfolioRiskIntelligence();

  if (!health || !risk || !coachNarrative) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  const exposure = risk.signals.find((s) => s.code === "sector_exposure");
  const allocationSignal = risk.signals.find((s) => s.code === "portfolio_concentration");
  const pendingImpact = risk.signals.find((s) => s.code === "pending_trade_impact");
  const alertSignals = risk.signals.filter((s) => s.available && (s.code === "single_position_risk" || s.code === "open_trade_risk" || s.code === "total_portfolio_risk")).slice(0, 2);
  const reviewTasks = coachNarrative.weakestFactors.slice(0, 3);

  return (
    <Card className="bg-card border-border" data-testid="card-portfolio-intelligence">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <GaugeCircle className="h-4 w-4" /> Portfolio &amp; Risk Intelligence
          </CardTitle>
          <Badge className={healthLabelBadgeClass(health.label)} data-testid="portfolio-intelligence-health-badge">
            {health.overall}/100 — {health.label}
          </Badge>
        </div>
        <CardDescription>
          Reused directly from{" "}
          <Link href="/portfolio-risk-intelligence" className="underline">
            Portfolio &amp; Risk Intelligence
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div>
          <p className="text-muted-foreground mb-1">Risk Alerts</p>
          {alertSignals.length === 0 ? (
            <p data-testid="portfolio-intelligence-no-alerts">No elevated risk signals currently available.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="portfolio-intelligence-alerts">
              {alertSignals.map((s) => (
                <li key={s.code}>
                  {s.label}: {s.headline}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-muted-foreground">Exposure</p>
            <p data-testid="portfolio-intelligence-exposure">{exposure?.headline ?? "Not available"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Allocation</p>
            <p data-testid="portfolio-intelligence-allocation">{allocationSignal?.headline ?? "Not available"}</p>
          </div>
        </div>
        <div>
          <p className="text-muted-foreground">Pending Trade Impact</p>
          <p data-testid="portfolio-intelligence-pending-impact">{pendingImpact?.headline ?? "Not available"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Portfolio Trends</p>
          <p data-testid="portfolio-intelligence-trends">Point-in-time reading — historical trend tracking is not yet built for this Health Score.</p>
        </div>
        <div>
          <p className="text-muted-foreground mb-1">Recommended Review Tasks</p>
          {reviewTasks.length === 0 ? (
            <p data-testid="portfolio-intelligence-no-review-tasks">Nothing needs review right now.</p>
          ) : (
            <ul className="list-disc list-inside" data-testid="portfolio-intelligence-review-tasks">
              {reviewTasks.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          )}
        </div>
        <Link href="/portfolio-risk-intelligence" className="text-xs font-medium text-primary hover:underline inline-block" data-testid="portfolio-intelligence-view-link">
          Open Portfolio &amp; Risk Intelligence →
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── My Workflow (v1.5.0, Sprint 16) ────────────────────────────────────
// Reuses useWorkflowAutomation() directly — the exact same hook backing
// the full /workflow-automation-engine page. Surfaces exactly what the
// approved scope named: Recommended next tasks, Blocked workflows, Items
// awaiting review, Recently completed actions, Upcoming portfolio
// reviews, and Learning recommendations — never a second, duplicate task
// computation.

function MyWorkflowCard() {
  const { loading, activeTasks, recentlyCompleted } = useWorkflowAutomation();

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const recommended = activeTasks.filter((t) => t.status === "pending").slice(0, 3);
  const blocked = activeTasks.filter((t) => t.status === "waiting");
  const awaitingReview = activeTasks.filter((t) => t.status === "in-progress").slice(0, 3);
  const portfolioReview = activeTasks.find((t) => t.automation === "portfolio-risk-to-review");
  const learningRecommendation = activeTasks.find((t) => t.automation === "learning-weakness-to-practice");
  const recent = recentlyCompleted.slice(0, 3);

  return (
    <Card className="bg-card border-border" data-testid="card-my-workflow">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Workflow className="h-4 w-4" /> My Workflow
        </CardTitle>
        <CardDescription>
          Reused directly from{" "}
          <Link href="/workflow-automation-engine" className="underline">
            Workflow Automation Engine
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div>
          <p className="text-muted-foreground mb-1">Recommended Next Tasks</p>
          {recommended.length === 0 ? (
            <p data-testid="my-workflow-no-recommended">Nothing pending right now.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="my-workflow-recommended-list">
              {recommended.map((t) => (
                <li key={t.id}>{t.title}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-muted-foreground mb-1 flex items-center gap-1">
            <PauseCircle className="h-3 w-3" /> Blocked Workflows
          </p>
          {blocked.length === 0 ? (
            <p data-testid="my-workflow-no-blocked">Nothing blocked.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="my-workflow-blocked-list">
              {blocked.map((t) => (
                <li key={t.id}>{t.title}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-muted-foreground mb-1">Items Awaiting Review</p>
          {awaitingReview.length === 0 ? (
            <p data-testid="my-workflow-no-awaiting-review">Nothing awaiting review.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="my-workflow-awaiting-review-list">
              {awaitingReview.map((t) => (
                <li key={t.id}>{t.title}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-muted-foreground mb-1">Upcoming Portfolio Review</p>
          <p data-testid="my-workflow-portfolio-review">{portfolioReview ? portfolioReview.title : "No portfolio review recommended right now."}</p>
        </div>
        <div>
          <p className="text-muted-foreground mb-1">Learning Recommendation</p>
          <p data-testid="my-workflow-learning-recommendation">{learningRecommendation ? learningRecommendation.title : "No specific practice recommended right now."}</p>
        </div>
        <div>
          <p className="text-muted-foreground mb-1 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Recently Completed
          </p>
          {recent.length === 0 ? (
            <p data-testid="my-workflow-no-recent">None yet.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="my-workflow-recent-list">
              {recent.map((t) => (
                <li key={t.id}>{t.title}</li>
              ))}
            </ul>
          )}
        </div>
        <Link href="/workflow-automation-engine" className="text-xs font-medium text-primary hover:underline inline-block" data-testid="my-workflow-view-link">
          Open Workflow Automation Engine →
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── Knowledge Insights (v1.5.0, Sprint 17) ─────────────────────────────
// Reuses useKnowledgeGraph() directly — the exact same hook backing the
// full /knowledge-graph page. Surfaces exactly what the approved scope
// named: Recent discoveries, Frequently connected entities, Repeated
// mistakes, Strongest learning improvements, Emerging themes — never a
// second, duplicate graph computation.

function KnowledgeInsightsCard() {
  const { loading, graph } = useKnowledgeGraph();
  const { data: journalEntries } = useListJournalEntries();
  const insights = useMemo(() => buildKnowledgeInsights(graph, journalEntries ?? [], null), [graph, journalEntries]);

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border" data-testid="card-knowledge-insights">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Network className="h-4 w-4" /> Knowledge Insights
        </CardTitle>
        <CardDescription>
          Reused directly from{" "}
          <Link href="/knowledge-graph" className="underline">
            Knowledge &amp; Intelligence Graph
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div>
          <p className="text-muted-foreground mb-1">Recent Discoveries</p>
          {insights.recentDiscoveries.length === 0 ? (
            <p data-testid="knowledge-insights-no-discoveries">Nothing new to report yet.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="knowledge-insights-discoveries-list">
              {insights.recentDiscoveries.map((p, i) => (
                <li key={i}>{p.title}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-muted-foreground mb-1">Frequently Connected Entities</p>
          {insights.frequentlyConnected.length === 0 ? (
            <p data-testid="knowledge-insights-no-connected">Not enough connections yet.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="knowledge-insights-connected-list">
              {insights.frequentlyConnected.slice(0, 3).map((r) => (
                <li key={r.node.id}>
                  {r.node.label} — {r.connections} connection{r.connections === 1 ? "" : "s"}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-muted-foreground mb-1">Repeated Mistakes</p>
          {insights.repeatedMistakes.length === 0 ? (
            <p data-testid="knowledge-insights-no-mistakes">None detected yet.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="knowledge-insights-mistakes-list">
              {insights.repeatedMistakes.map((p, i) => (
                <li key={i}>{p.title}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-muted-foreground mb-1">Strongest Learning Improvements</p>
          {insights.strongestLearningImprovements.length === 0 ? (
            <p data-testid="knowledge-insights-no-improvements">None recorded yet.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="knowledge-insights-improvements-list">
              {insights.strongestLearningImprovements.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-muted-foreground mb-1">Emerging Themes</p>
          {insights.emergingThemes.length === 0 ? (
            <p data-testid="knowledge-insights-no-themes">Nothing emerging yet.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="knowledge-insights-themes-list">
              {insights.emergingThemes.map((r) => (
                <li key={r.node.id}>{r.node.label}</li>
              ))}
            </ul>
          )}
        </div>
        <Link href="/knowledge-graph" className="text-xs font-medium text-primary hover:underline inline-block" data-testid="knowledge-insights-view-link">
          Open Knowledge &amp; Intelligence Graph →
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── Playbooks (v1.5.0, Sprint 18) ──────────────────────────────────────
// Reuses usePlaybooks() directly — the exact same hook backing the full
// /playbooks page. Surfaces exactly what the approved scope named:
// Current playbook, Progress, Blocked stages, Recently completed
// procedures, and Recommended next procedure — never a second, duplicate
// playbook computation.

function PlaybooksCard() {
  const { loading, current, recommendedNext, progresses } = usePlaybooks();

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const completed = progresses.filter((p) => p.overallStatus === "complete").slice(0, 3);
  const blockedAcrossAll = progresses.flatMap((p) => p.blockedStages.map((s) => ({ playbookName: p.playbook.name, stage: s })));

  return (
    <Card className="bg-card border-border" data-testid="card-playbooks">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BookMarked className="h-4 w-4" /> Playbooks
        </CardTitle>
        <CardDescription>
          Reused directly from{" "}
          <Link href="/playbooks" className="underline">
            Playbooks &amp; Operating Procedures
          </Link>
          . "Recently completed" reflects current completion state — no timestamped history is tracked.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div>
          <p className="text-muted-foreground mb-1">Current Playbook</p>
          {current ? (
            <p data-testid="playbooks-current">
              {current.playbook.name} — {current.completedCount}/{current.totalCount} stages ({current.progressPct}%)
            </p>
          ) : (
            <p data-testid="playbooks-no-current">No playbook currently in progress.</p>
          )}
        </div>
        <div>
          <p className="text-muted-foreground mb-1 flex items-center gap-1">
            <PauseCircle className="h-3 w-3" /> Blocked Stages
          </p>
          {blockedAcrossAll.length === 0 ? (
            <p data-testid="playbooks-no-blocked">Nothing blocked.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="playbooks-blocked-list">
              {blockedAcrossAll.slice(0, 3).map((b, i) => (
                <li key={i}>
                  {b.playbookName} — {b.stage.stage.title}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-muted-foreground mb-1 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Recently Completed Procedures
          </p>
          {completed.length === 0 ? (
            <p data-testid="playbooks-no-completed">None yet.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="playbooks-completed-list">
              {completed.map((p) => (
                <li key={p.playbook.id}>{p.playbook.name}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-muted-foreground mb-1">Recommended Next Procedure</p>
          <p data-testid="playbooks-recommended-next">{recommendedNext ? recommendedNext.playbook.name : "No further playbook recommended right now."}</p>
        </div>
        <Link href="/playbooks" className="text-xs font-medium text-primary hover:underline inline-block" data-testid="playbooks-view-link">
          Open Playbooks &amp; Operating Procedures →
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── Decision Quality ──────────────────────────────────────────────────
// v1.5.0, Sprint 19 — Institutional Decision Quality & Review Engine.
// Reused directly from useDecisionQualityEngine() — zero new calculation
// in this file. Keep concise, per the approved scope.

function DecisionQualityCard() {
  const { loading, reviews, pendingReviewCount, trends, recurringDeviations } = useDecisionQualityEngine();

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const recentlyReviewed = [...reviews].reverse().slice(0, 3);
  const improvements = trends.filter((t) => t.direction === "improving").slice(0, 2);
  const recurring = recurringDeviations.slice(0, 2);
  const pending = reviews.filter((r) => r.currentStage === "open-position" || r.currentStage === "managing" || r.currentStage === "closed" || r.currentStage === "journal-pending");
  const recommendedNext = pending[0] ?? null;

  return (
    <Card className="bg-card border-border" data-testid="card-decision-quality">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BadgeCheck className="h-4 w-4" /> Decision Quality
        </CardTitle>
        <CardDescription>
          Reused directly from{" "}
          <Link href="/decision-quality-review" className="underline">
            Decision Quality &amp; Review
          </Link>
          . Evaluates decision PROCESS, never trade outcome.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div>
          <p className="text-muted-foreground mb-1">Recently Reviewed Decisions</p>
          {recentlyReviewed.length === 0 ? (
            <p data-testid="decision-quality-no-reviews">No decisions reviewed yet.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="decision-quality-recent-list">
              {recentlyReviewed.map((r) => (
                <li key={r.tradePlanId}>
                  {r.tradePlanTitle} ({r.symbol}) — {r.processQuality.score}/100, {r.processQuality.label}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-muted-foreground mb-1 flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-emerald-400" /> Best Process Improvements
          </p>
          {improvements.length === 0 ? (
            <p data-testid="decision-quality-no-improvements">No confirmed improving trend yet.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="decision-quality-improvements-list">
              {improvements.map((t) => (
                <li key={t.id}>
                  {t.label}: {t.earlierAverage}% → {t.laterAverage}%
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-muted-foreground mb-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-400" /> Recurring Issues
          </p>
          {recurring.length === 0 ? (
            <p data-testid="decision-quality-no-recurring">No recurring deviations detected.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="decision-quality-recurring-list">
              {recurring.map((d) => (
                <li key={`${d.playbookId}:${d.stageTitle}`}>
                  {d.playbookName} — {d.stageTitle} ({d.occurrenceCount}x)
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-muted-foreground mb-1">Pending Reviews</p>
          <p data-testid="decision-quality-pending-count">{pendingReviewCount} decision{pendingReviewCount === 1 ? "" : "s"} awaiting review.</p>
        </div>
        <div>
          <p className="text-muted-foreground mb-1">Recommended Next Review</p>
          <p data-testid="decision-quality-recommended-next">
            {recommendedNext ? `${recommendedNext.tradePlanTitle} (${recommendedNext.symbol})` : "No decision recommended for review right now."}
          </p>
        </div>
        <Link href="/decision-quality-review" className="text-xs font-medium text-primary hover:underline inline-block" data-testid="decision-quality-view-link">
          Open Decision Quality &amp; Review →
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── Market Intelligence ───────────────────────────────────────────────
// v1.5.0, Sprint 20 — Institutional Market Intelligence Engine. Reused
// directly from useMarketIntelligence() — zero new calculation in this
// file. Distinct from MarketOverviewCard above (that card reuses Engine
// 3's market briefing + Engine 1's macro regime for a general snapshot;
// this card surfaces the classified, entity-linked Market Intelligence
// feed itself — today's key events, upcoming releases, watchlist/
// portfolio-relevant items, emerging themes, and priority items). Keep
// concise, per the approved scope.

function MarketIntelligenceCard() {
  const { loading, items, emergingThemes } = useMarketIntelligence();

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const todayIso = new Date().toISOString();
  const todaysEvents = todaysKeyEvents(items, todayIso).slice(0, 3);
  const releases = upcomingEconomicReleases(items).slice(0, 3);
  const watchlistIntel = watchlistRelevantItems(items).slice(0, 3);
  const priority = priorityItems(items).slice(0, 3);
  const themes = emergingThemes.slice(0, 3);

  return (
    <Card className="bg-card border-border" data-testid="card-market-intelligence">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="h-4 w-4" /> Market Intelligence
        </CardTitle>
        <CardDescription>
          Reused directly from{" "}
          <Link href="/market-intelligence" className="underline">
            Market Intelligence
          </Link>
          . External context, never a trading signal or price prediction.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div>
          <p className="text-muted-foreground mb-1 flex items-center gap-1">
            <CalendarClock className="h-3 w-3" /> Today's Key Events
          </p>
          {todaysEvents.length === 0 ? (
            <p data-testid="market-intelligence-card-no-todays-events">Nothing key today.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="market-intelligence-card-todays-events">
              {todaysEvents.map((e) => (
                <li key={e.id}>{e.headline}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-muted-foreground mb-1">Upcoming Economic Releases</p>
          {releases.length === 0 ? (
            <p data-testid="market-intelligence-card-no-releases">None upcoming.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="market-intelligence-card-releases">
              {releases.map((e) => (
                <li key={e.id}>{e.headline}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-muted-foreground mb-1 flex items-center gap-1">
            <Eye className="h-3 w-3" /> Watchlist Intelligence
          </p>
          {watchlistIntel.length === 0 ? (
            <p data-testid="market-intelligence-card-no-watchlist">Nothing relevant to your watchlist right now.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="market-intelligence-card-watchlist">
              {watchlistIntel.map((e) => (
                <li key={e.id}>{e.headline}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-muted-foreground mb-1 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Emerging Themes
          </p>
          {themes.length === 0 ? (
            <p data-testid="market-intelligence-card-no-themes">No emerging themes detected yet.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="market-intelligence-card-themes">
              {themes.map((t) => (
                <li key={t.node.id}>{t.node.label}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-muted-foreground mb-1 flex items-center gap-1">
            <Flame className="h-3 w-3 text-destructive" /> Priority Items
          </p>
          {priority.length === 0 ? (
            <p data-testid="market-intelligence-card-no-priority">Nothing flagged as priority right now.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="market-intelligence-card-priority">
              {priority.map((e) => (
                <li key={e.id}>{e.headline}</li>
              ))}
            </ul>
          )}
        </div>
        <Link href="/market-intelligence" className="text-xs font-medium text-primary hover:underline inline-block" data-testid="market-intelligence-view-link">
          Open Market Intelligence →
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── Opportunity Pipeline ──────────────────────────────────────────────
// v1.5.0, Sprint 21 — Institutional Opportunity Discovery Engine, built
// and named "Opportunity Pipeline" to avoid colliding with the
// pre-existing Phase 15 Opportunity Discovery scanner (see
// lib/opportunityPipeline.ts's own header comment for the disclosed
// reasoning). Reused directly from useOpportunityPipeline() — zero new
// calculation in this file. Keep concise, per the approved scope.

function OpportunityPipelineCard() {
  const { loading, discovered, captured } = useOpportunityPipeline();

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const capturedTitles = new Set(captured.map((c) => c.title));
  const newOpportunities = discovered.filter((o) => !capturedTitles.has(o.title)).slice(0, 3);
  const highPriority = discovered.filter((o) => o.priority === "high").slice(0, 3);
  const awaitingResearch = captured.filter((c) => c.stage === "research-candidate").slice(0, 3);
  const recentlyArchived = captured.filter((c) => c.stage === "archived").slice(0, 3);

  return (
    <Card className="bg-card border-border" data-testid="card-opportunity-pipeline">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="h-4 w-4" /> Opportunity Pipeline
        </CardTitle>
        <CardDescription>
          Reused directly from{" "}
          <Link href="/opportunity-pipeline" className="underline">
            Opportunity Pipeline
          </Link>
          . The disciplined front door to the platform — never a trading signal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div>
          <p className="text-muted-foreground mb-1">New Opportunities</p>
          {newOpportunities.length === 0 ? (
            <p data-testid="opportunity-pipeline-card-no-new">Nothing new right now.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="opportunity-pipeline-card-new">
              {newOpportunities.map((o) => (
                <li key={o.id}>{o.title}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-muted-foreground mb-1 flex items-center gap-1">
            <Flame className="h-3 w-3 text-destructive" /> High-Priority Candidates
          </p>
          {highPriority.length === 0 ? (
            <p data-testid="opportunity-pipeline-card-no-high-priority">None flagged high priority right now.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="opportunity-pipeline-card-high-priority">
              {highPriority.map((o) => (
                <li key={o.id}>{o.title}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-muted-foreground mb-1">Research Awaiting Initiation</p>
          {awaitingResearch.length === 0 ? (
            <p data-testid="opportunity-pipeline-card-no-awaiting">Nothing awaiting research right now.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="opportunity-pipeline-card-awaiting">
              {awaitingResearch.map((c) => (
                <li key={c.id}>{c.title}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-muted-foreground mb-1 flex items-center gap-1">
            <Archive className="h-3 w-3" /> Recently Archived Ideas
          </p>
          {recentlyArchived.length === 0 ? (
            <p data-testid="opportunity-pipeline-card-no-archived">None archived yet.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="opportunity-pipeline-card-archived">
              {recentlyArchived.map((c) => (
                <li key={c.id}>{c.title}</li>
              ))}
            </ul>
          )}
        </div>
        <Link href="/opportunity-pipeline" className="text-xs font-medium text-primary hover:underline inline-block" data-testid="opportunity-pipeline-view-link">
          Open Opportunity Pipeline →
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── Learning Panel ────────────────────────────────────────────────────

function LearningPanelCard() {
  const { data: progress, isLoading } = useGetLearningProgress();
  const inProgress = useMemo(
    () => (progress?.pathCompletion ?? []).filter((p) => p.percentComplete > 0 && p.percentComplete < 100),
    [progress],
  );
  const recentCompleted = useMemo(
    () => (progress?.recentHistory ?? []).filter((h) => h.completedAt !== null).slice(0, 3),
    [progress],
  );
  const mostAdvanced = useMemo(
    () => [...inProgress].sort((a, b) => b.percentComplete - a.percentComplete)[0] ?? null,
    [inProgress],
  );

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border" data-testid="card-learning-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <GraduationCap className="h-4 w-4" /> Learning Panel
        </CardTitle>
        <CardDescription>Reused directly from the existing Learning Centre progress.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {mostAdvanced ? (
          <div data-testid="learning-panel-current">
            <p className="text-xs text-muted-foreground">Current Lesson Path</p>
            <p className="text-sm">
              {mostAdvanced.title} — {mostAdvanced.topicsCompleted}/{mostAdvanced.topicsTotal} topics (
              {mostAdvanced.percentComplete.toFixed(0)}%)
            </p>
            <Link
              href={`/learn/paths/${mostAdvanced.pathKey}`}
              className="text-xs font-medium text-primary hover:underline"
              data-testid="learning-panel-recommended-link"
            >
              Recommended: Continue this path →
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="learning-panel-none-in-progress">
            No learning paths in progress yet.
          </p>
        )}

        <div>
          <p className="text-xs text-muted-foreground mb-1">Recently Completed</p>
          {recentCompleted.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="learning-panel-no-recent">
              Nothing completed yet.
            </p>
          ) : (
            <ul className="space-y-0.5 text-xs text-muted-foreground" data-testid="learning-panel-recent-list">
              {recentCompleted.map((h, i) => (
                <li key={i}>
                  {h.itemType}: {h.itemKey}
                </li>
              ))}
            </ul>
          )}
        </div>

        <Link href="/learn" className="text-xs font-medium text-primary hover:underline" data-testid="learning-panel-continue-link">
          Continue Learning →
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── Coach Panel ────────────────────────────────────────────────────────

function CoachPanelCard() {
  return (
    <Card className="bg-card border-border" data-testid="card-coach-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4" /> AI Coach
        </CardTitle>
        <CardDescription>
          Reuses the platform's existing AI Coach panel — never a new coach, never a new streaming pipeline.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Ask what deserves your attention today, why, a suggested workflow for the day, or institutional best
          practice for any module.
        </p>
        <AskCoachLauncher
          label="Ask the AI Coach"
          suggestedQuestion="What deserves my attention today, and what should my workflow be?"
        />
      </CardContent>
    </Card>
  );
}

// ─── Notifications ─────────────────────────────────────────────────────

function NotificationsCard({
  strategiesDraftCount,
  tradePlansReadyCount,
  journalOutstanding,
}: {
  strategiesDraftCount: number;
  tradePlansReadyCount: number;
  journalOutstanding: number | null;
}) {
  const { data: notifications } = useListNotifications({ query: { queryKey: getListNotificationsQueryKey() } });
  const unread = (notifications ?? []).filter((n) => !n.isRead);

  const actionItems = useMemo(() => {
    const items: { id: string; text: string; href: string }[] = [];
    if (tradePlansReadyCount > 0) {
      items.push({
        id: "trade-plans-ready",
        text: `${tradePlansReadyCount} trade plan${tradePlansReadyCount === 1 ? "" : "s"} ready for review`,
        href: "/assistant",
      });
    }
    if (strategiesDraftCount > 0) {
      items.push({
        id: "strategies-draft",
        text: `${strategiesDraftCount} strateg${strategiesDraftCount === 1 ? "y" : "ies"} in draft, need review`,
        href: "/assistant",
      });
    }
    if (journalOutstanding !== null && journalOutstanding > 0) {
      items.push({
        id: "journal-outstanding",
        text: `${journalOutstanding} recent closed trade${journalOutstanding === 1 ? "" : "s"} missing a journal entry`,
        href: "/trading-journal",
      });
    }
    return items;
  }, [strategiesDraftCount, tradePlansReadyCount, journalOutstanding]);

  const nothingAtAll = unread.length === 0 && actionItems.length === 0;

  return (
    <Card className="bg-card border-border" data-testid="card-notifications">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" /> Notifications
        </CardTitle>
        <CardDescription>
          Real alerts reused from{" "}
          <Link href="/notifications" className="underline">
            the platform's notification feed
          </Link>
          , plus workflow reminders derived from the Workflow Panel above — never a second, fabricated alert
          system.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {nothingAtAll ? (
          <p className="text-sm text-muted-foreground" data-testid="notifications-empty">
            Nothing needs your attention right now.
          </p>
        ) : (
          <ul className="space-y-1.5 text-sm" data-testid="notifications-list">
            {unread.slice(0, 4).map((n) => (
              <li key={`n-${n.id}`} data-testid={`notification-real-${n.id}`}>
                <Badge variant="outline" className="text-[10px] mr-1.5">
                  Alert
                </Badge>
                {n.title}
              </li>
            ))}
            {actionItems.map((item) => (
              <li key={item.id} data-testid={`notification-action-${item.id}`}>
                <Link href={item.href} className="hover:underline">
                  <Badge variant="outline" className="text-[10px] mr-1.5">
                    Action
                  </Badge>
                  {item.text}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/notifications" className="text-xs font-medium text-primary hover:underline mt-2 inline-block">
          View all notifications →
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────

export default function InstitutionalCommandCentre() {
  const { data: session } = useSession();
  const snapshot = useWorkflowSnapshot();
  const { data: watchlist } = useGetValueWatchlist();
  const { data: journalEntries } = useListJournalEntries();
  const { data: closedTrades } = useListTrades({ status: "closed", limit: 20 });
  const { data: dash } = useGetPortfolioDashboard();
  // Reused for the Workflow Panel's own "Decision" stage below, and again,
  // independently, by <DecisionInProgressCard /> further down the page —
  // the same intentional duplicate-fetch pattern this file already uses
  // for useGetPortfolioDashboard() (main component + <PortfolioSnapshotCard />).
  const decisionSummary = useActiveDecisionSummary();
  // v1.5.0, Sprint 14 — computed ONCE here (not duplicated inside
  // <ExecutionPipelineCard />, unlike the two hooks above) since this one
  // fetches full trade-plan detail per plan across all coachIds — a real,
  // disclosed cost not worth doubling for a second card on the same page.
  const pipeline = useTradeLifecyclePipeline();
  // v1.6.0, Sprint 3 — UX Transformation. Reused here (main component) AND
  // again inside <OpportunityPipelineCard /> further down — the same
  // intentional duplicate-fetch-for-a-second-card pattern this file
  // already established for useGetPortfolioDashboard()/useActiveDecisionSummary().
  const discoverPipeline = useOpportunityPipeline();

  const journalOutstanding = useMemo(() => {
    if (!closedTrades || !journalEntries) return null;
    const journaledTradeIds = new Set(journalEntries.map((j) => j.tradeId).filter((id): id is number => id !== null));
    return closedTrades.filter((t) => !journaledTradeIds.has(t.id)).length;
  }, [closedTrades, journalEntries]);

  const displayName = session?.user?.name || session?.user?.email || "there";

  const statuses = useStageStatuses(
    snapshot,
    watchlist?.length,
    journalOutstanding,
    "See full breakdown in Performance & Attribution",
    dash?.guidance.length,
    undefined,
    decisionSummary,
    pipeline,
    discoverPipeline,
  );

  return (
    <div className="space-y-6 max-w-7xl" data-testid="page-institutional-command-centre">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground" data-testid="command-centre-greeting">
            {greeting()}, {displayName}.
          </h1>
          <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30" data-testid="badge-command-centre">
            <Compass className="h-3 w-3 mr-1" /> Institutional Command Centre
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Your single starting point — orchestrating Research, Notebook, Strategy, Trade Plan, Trade Journal,
          Performance, Portfolio, and Learning into one connected workflow. Nothing here executes, adjusts, or
          modifies a real order.{" "}
          <Link href="/personal-dashboard" className="text-indigo-400 underline-offset-2 hover:underline" data-testid="link-to-personal-dashboard">
            Looking for your customizable widget dashboard? See Personal Dashboard.
          </Link>{" "}
          <Link href="/command-center" className="text-indigo-400 underline-offset-2 hover:underline" data-testid="link-to-options-command-center">
            Looking for the Options Income Engine's own executive view? See Command Center.
          </Link>
        </p>
      </div>

      <DailyBriefingCard compact />

      {/* v1.6.0 Sprint 1 — AI Trading Coach Guided Workflow. Surfaces the
          one primary recommended next action for today, ahead of the
          pre-existing, differently-scoped Workflow Automation Engine panel
          just below (WorkflowPanel tracks longer-horizon platform tasks,
          not this daily guided sequence) — never a second Command Centre,
          never a duplicate of that panel's own data. */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">AI Trading Coach</h2>
        <AiTradingCoachPanel collapsible={false} />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Your Workflow Today</h2>
        <WorkflowPanel statuses={statuses} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2">Quick Actions</h2>
        <div className="flex flex-wrap gap-2" data-testid="command-centre-quick-actions">
          {COMMAND_CENTRE_QUICK_ACTIONS.map((action) => (
            <Link key={action.id} href={action.href}>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" data-testid={`quick-action-${action.id}`}>
                <action.icon className="h-3.5 w-3.5" />
                {action.label}
              </Button>
            </Link>
          ))}
          <AskCoachLauncher label="Ask AI Coach" />
        </div>
      </div>

      {/* v1.6.0, Sprint 3 — UX Transformation. Guided Tours ("learn by
          doing") live here, alongside Quick Actions, reinforcing the
          Command Centre as the one place every workflow naturally begins. */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2">Guided Tours</h2>
        <div className="flex flex-wrap gap-2" data-testid="command-centre-guided-tours">
          <GuidedTourTrigger tourId="first-trade" />
          <GuidedTourTrigger tourId="first-research" />
          <GuidedTourTrigger tourId="first-journal" />
          <GuidedTourTrigger tourId="first-portfolio-review" />
        </div>
      </div>

      {/* v1.5.0, Sprint 22 (Release Candidate consolidation) — the ~16
          panels below were previously one long, undifferentiated stack in
          build/sprint-chronological order, flagged by the sprint's own
          audit as cluttered with no visible priority hierarchy. Regrouped
          into 4 labeled sections below (no panel removed, reordered, or
          changed internally) so a first-time user can scan section headers
          instead of 16 unlabeled cards to find what they need. */}

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2">Market &amp; Portfolio Snapshot</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <MarketOverviewCard />
          <PortfolioSnapshotCard />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2">Decisions &amp; Execution In Progress</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DecisionInProgressCard />
          <ExecutionPipelineCard pipeline={pipeline} />
        </div>
        <div className="mt-4">
          <MyWorkflowCard />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground mb-0">Research, Intelligence &amp; Opportunities</h2>
        <KnowledgeInsightsCard />
        <PlaybooksCard />
        <DecisionQualityCard />
        <MarketIntelligenceCard />
        <OpportunityPipelineCard />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2">Portfolio Intelligence, Learning &amp; Coaching</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <PortfolioIntelligenceCard />
          <LearningPanelCard />
          <CoachPanelCard />
        </div>
      </div>

      <NotificationsCard
        strategiesDraftCount={snapshot.loading ? 0 : snapshot.strategiesDraftCount}
        tradePlansReadyCount={snapshot.loading ? 0 : snapshot.tradePlansReadyCount}
        journalOutstanding={journalOutstanding}
      />

      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Landmark className="h-3.5 w-3.5" />
        Advisory/educational only. This is a composition layer over already-existing modules — nothing here
        executes, adjusts, or schedules a real trade.
      </div>
    </div>
  );
}
