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
import { AskCoachLauncher } from "@/components/learn/AskCoachLauncher";
import { COMMAND_CENTRE_QUICK_ACTIONS } from "@/lib/quick-actions";
import { useWorkflowSnapshot } from "@/lib/useWorkflowSnapshot";
import {
  Compass,
  ShieldAlert,
  Landmark,
  GraduationCap,
  Bell,
  Bot,
  CalendarClock,
  Newspaper,
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
): Record<PlatformJourneyStageId, StageStatus> {
  return {
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
    execute: {
      detail: "Executed manually at your own external broker — this platform never places, closes, or modifies a real order.",
      pendingCount: null,
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MarketOverviewCard />
        <PortfolioSnapshotCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LearningPanelCard />
        <CoachPanelCard />
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
