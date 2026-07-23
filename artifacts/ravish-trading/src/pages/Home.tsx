// Phase 10 — Institutional Platform Polish & Control Center.
//
// Institutional Home — the new landing page ("/"). A genuine Personal
// Dashboard: every section below is an independent, pinnable/hideable/
// reorderable/resizable "widget," with the current arrangement persisted
// server-side as the user's active Workspace (lib/dashboardWorkspaces.ts,
// backend). Switching workspaces (via the picker in the header) swaps the
// whole widget arrangement — the Workspace System and the Personal
// Dashboard are the same underlying mechanism, per this phase's own
// "unify, don't duplicate" design decision (see
// docs/Institutional-Control-Center.md).
//
// Deliberate, disclosed scope decision: "resize" is a binary Normal/
// Compact toggle per widget, not freeform drag-resize — a robust,
// keyboard-operable, easily-testable control, not a new drag-and-drop
// grid dependency. "Reorder" is Move Up/Move Down buttons in Edit Layout
// mode, not drag-and-drop, for the same reason.
//
// Every widget reuses an already-existing, already-tested generated hook
// — this page introduces ZERO new trading, execution, pricing, portfolio,
// or risk calculations. CommandCenter.tsx (still reachable at
// /command-center) remains the fuller, detail-oriented executive view;
// this page is the condensed, personalized, at-a-glance one — the same
// "distinct-but-related surfaces, deliberately not merged" precedent this
// platform already uses elsewhere (e.g. Institutional Dashboard vs.
// Trading Research).

import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetActiveWorkspace,
  useListWorkspaces,
  useUpdateWorkspace,
  useCreateWorkspace,
  useDuplicateWorkspace,
  useDeleteWorkspace,
  useActivateWorkspace,
  getListWorkspacesQueryKey,
  getGetActiveWorkspaceQueryKey,
  useGetPortfolioDashboard,
  useGetPortfolioSummary,
  useGetThetaIncome,
  useListTrades,
  useGetCrossEngineDailyReport,
  getGetCrossEngineDailyReportQueryKey,
  useGetInstitutionalMentor,
  useGetPortfolioEventRisk,
  useGetValueWatchlist,
  useGetPortfolios,
  useListJournalEntries,
  useListNotifications,
  getListNotificationsQueryKey,
  type CrossEngineDailyReport,
  type Trade,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { QUICK_ACTIONS } from "@/lib/quick-actions";
import { downloadPortfolioCsv } from "@/lib/portfolio-export";
import {
  Pencil,
  Check,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Minimize2,
  Maximize2,
  Plus,
  Copy,
  Trash2,
  Landmark,
} from "lucide-react";

interface WidgetConfigEntry {
  id: string;
  visible: boolean;
  size: "normal" | "compact";
  order: number;
}

const WIDGET_TITLES: Record<string, string> = {
  "portfolio-health": "Portfolio Health",
  "market-status": "Market Status",
  "open-positions": "Open Positions",
  "todays-pnl": "Today's P/L",
  "theta-income": "Theta Income",
  "buying-power": "Buying Power",
  risk: "Risk",
  "upcoming-events": "Upcoming Events",
  "ai-briefing": "AI Portfolio Briefing",
  "mentor-summary": "Institutional Mentor Summary",
  "recent-activity": "Recent Activity",
  "watchlist-summary": "Institutional Investing Watchlist",
  notifications: "Notifications",
  "quick-actions": "Quick Actions",
  "portfolio-summary": "Institutional Portfolio Manager",
  "decision-engine": "Institutional Decision Engine",
  "opportunity-discovery": "Institutional Opportunity Discovery",
};

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

function macroRegimeBadgeClass(regime: string): string {
  if (regime === "rising_rates") return "border-amber-500/40 text-amber-400";
  if (regime === "falling_rates") return "border-sky-500/40 text-sky-400";
  return "border-border text-muted-foreground";
}

// ─── Individual widgets — each reuses an already-existing hook ───────────

function PortfolioHealthWidget() {
  const { data, isLoading } = useGetPortfolioDashboard();
  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!data) return <p className="text-sm text-muted-foreground">Unavailable.</p>;
  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="widget-content-portfolio-health">
      <span className="font-mono text-2xl">{data.healthScore}/100</span>
      <Badge className={ratingBadgeClass(data.overallRiskRating.code)}>{data.overallRiskRating.label}</Badge>
    </div>
  );
}

function MarketStatusWidget({ report }: { report: CrossEngineDailyReport | undefined }) {
  if (!report) return <Skeleton className="h-12 w-full" />;
  return (
    <div className="space-y-1" data-testid="widget-content-market-status">
      <Badge variant="outline" className={macroRegimeBadgeClass(report.engine1.macro.regime)}>
        {report.engine1.macro.regimeLabel}
      </Badge>
      <p className="text-xs text-muted-foreground">{report.engine1.macro.summary}</p>
    </div>
  );
}

function OpenPositionsWidget({ trades }: { trades: Trade[] | undefined }) {
  if (!trades) return <Skeleton className="h-16 w-full" />;
  if (trades.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="widget-content-open-positions-empty">
        No open positions.
      </p>
    );
  }
  return (
    <div data-testid="widget-content-open-positions">
      <div className="font-mono text-2xl">{trades.length}</div>
      <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        {trades.slice(0, 5).map((t) => (
          <li key={t.id}>
            {t.symbol} — {t.strategy.replace(/_/g, " ")}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TodaysPnlWidget() {
  const { data, isLoading } = useGetPortfolioSummary();
  if (isLoading) return <Skeleton className="h-10 w-full" />;
  const pnl = data?.dayPnl ?? null;
  return (
    <div
      className={`font-mono text-2xl ${pnl !== null && pnl < 0 ? "text-destructive" : pnl !== null && pnl > 0 ? "text-emerald-400" : ""}`}
      data-testid="widget-content-todays-pnl"
    >
      {fmtUsd(pnl)}
    </div>
  );
}

function ThetaIncomeWidget() {
  const { data, isLoading } = useGetThetaIncome();
  if (isLoading) return <Skeleton className="h-10 w-full" />;
  return (
    <div className="font-mono text-2xl" data-testid="widget-content-theta-income">
      {fmtUsd(data?.monthly)} <span className="text-xs text-muted-foreground font-sans">/month</span>
    </div>
  );
}

function BuyingPowerWidget() {
  const { data, isLoading } = useGetPortfolioDashboard();
  if (isLoading) return <Skeleton className="h-10 w-full" />;
  return (
    <div className="font-mono text-2xl" data-testid="widget-content-buying-power">
      {fmtUsd(data?.buyingPower)}
    </div>
  );
}

function RiskWidget() {
  const { data, isLoading } = useGetPortfolioDashboard();
  if (isLoading) return <Skeleton className="h-12 w-full" />;
  if (!data) return <p className="text-sm text-muted-foreground">Unavailable.</p>;
  const elevated = data.guidance.filter((g) =>
    ["elevated_risk", "high_risk", "elevated_concentration", "elevated_event_risk"].includes(g.code),
  );
  return (
    <div data-testid="widget-content-risk">
      {elevated.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="text-risk-widget-clear">
          No elevated risk alerts.
        </p>
      ) : (
        <ul className="space-y-1 text-sm">
          {elevated.slice(0, 3).map((g) => (
            <li key={g.code}>
              <Badge className={ratingBadgeClass(data.overallRiskRating.code)}>{g.label}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UpcomingEventsWidget() {
  const { data, isLoading } = useGetPortfolioEventRisk();
  if (isLoading) return <Skeleton className="h-16 w-full" />;
  const withEvents = (data?.positions ?? [])
    .filter((p) => p.primaryEvent)
    .sort((a, b) => (a.primaryEvent!.daysAway ?? 0) - (b.primaryEvent!.daysAway ?? 0));
  if (withEvents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="widget-content-upcoming-events-empty">
        No known upcoming events across your open positions.
      </p>
    );
  }
  return (
    <ul className="space-y-1 text-sm" data-testid="widget-content-upcoming-events">
      {withEvents.slice(0, 5).map((p) => (
        <li key={p.tradeId}>
          <span className="font-mono">{p.symbol}</span> — {p.primaryEvent!.label} in {p.primaryEvent!.daysAway}d
        </li>
      ))}
    </ul>
  );
}

function AiBriefingWidget({ report }: { report: CrossEngineDailyReport | undefined }) {
  if (!report) return <Skeleton className="h-16 w-full" />;
  return (
    <div data-testid="widget-content-ai-briefing">
      <p className="text-sm text-muted-foreground">{report.summary}</p>
      <Link href="/daily-report" className="text-xs font-medium text-primary hover:underline">
        Open full daily report →
      </Link>
    </div>
  );
}

function MentorSummaryWidget() {
  const { data, isLoading } = useGetInstitutionalMentor();
  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!data) return <p className="text-sm text-muted-foreground">Unavailable.</p>;
  const topObservation = data.professionalReview[0];
  return (
    <div className="space-y-1" data-testid="widget-content-mentor-summary">
      {topObservation ? (
        <p className="text-sm">{topObservation.text}</p>
      ) : (
        <p className="text-sm text-muted-foreground">No notable observations right now.</p>
      )}
      <Link href="/institutional-mentor" className="text-xs font-medium text-primary hover:underline">
        Open full review →
      </Link>
    </div>
  );
}

function RecentActivityWidget() {
  const { data: journalEntries } = useListJournalEntries();
  const { data: closedTrades } = useListTrades({ status: "closed", limit: 5 });
  const items = useMemo(() => {
    const fromJournal = (journalEntries ?? []).slice(0, 5).map((j) => ({
      key: `journal-${j.id}`,
      text: `Journal: ${j.title}`,
      date: j.createdAt,
    }));
    const fromTrades = (closedTrades ?? []).slice(0, 5).map((t) => ({
      key: `trade-${t.id}`,
      text: `Closed ${t.symbol} (${t.strategy.replace(/_/g, " ")})`,
      date: t.closeDate ?? t.openDate,
    }));
    return [...fromJournal, ...fromTrades].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);
  }, [journalEntries, closedTrades]);

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="widget-content-recent-activity-empty">
        No recent activity yet.
      </p>
    );
  }
  return (
    <ul className="space-y-1 text-sm" data-testid="widget-content-recent-activity">
      {items.map((i) => (
        <li key={i.key}>{i.text}</li>
      ))}
    </ul>
  );
}

function NotificationsWidget() {
  const { data } = useListNotifications({ query: { queryKey: getListNotificationsQueryKey() } });
  const items = data ?? [];
  const unread = items.filter((n) => !n.isRead);
  if (unread.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="widget-content-notifications-empty">
        No unread notifications.
      </p>
    );
  }
  return (
    <div data-testid="widget-content-notifications">
      <ul className="space-y-1 text-sm">
        {unread.slice(0, 4).map((n) => (
          <li key={n.id}>{n.title}</li>
        ))}
      </ul>
      <Link href="/notifications" className="text-xs font-medium text-primary hover:underline">
        View all →
      </Link>
      {" · "}
      <Link href="/monitoring-dashboard" className="text-xs font-medium text-primary hover:underline" data-testid="link-monitoring-dashboard">
        Open Institutional Monitoring →
      </Link>
    </div>
  );
}

function QuickActionsWidget({ openTrades }: { openTrades: Trade[] | undefined }) {
  const { toast } = useToast();
  return (
    <div className="flex flex-wrap gap-2" data-testid="widget-content-quick-actions">
      {QUICK_ACTIONS.map((action) =>
        action.kind === "export" ? (
          <Button
            key={action.id}
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            data-testid={`quick-action-${action.id}`}
            onClick={() => {
              if (!openTrades || openTrades.length === 0) {
                toast({ title: "Nothing to export", description: "No open positions to export yet." });
                return;
              }
              downloadPortfolioCsv(openTrades);
              toast({ title: "Portfolio exported", description: `${openTrades.length} open position(s) downloaded.` });
            }}
          >
            <action.icon className="h-3.5 w-3.5" />
            {action.label}
          </Button>
        ) : (
          <Link key={action.id} href={action.href}>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" data-testid={`quick-action-${action.id}`}>
              <action.icon className="h-3.5 w-3.5" />
              {action.label}
            </Button>
          </Link>
        ),
      )}
    </div>
  );
}

// Phase 12 — Institutional Investing Engine Consolidation & Integration.
// Reuses the exact same GET /value-watchlist hook Engine 1's own
// StockResearch.tsx Watchlist tab already uses — zero new calculation.
function WatchlistSummaryWidget() {
  const { data, isLoading } = useGetValueWatchlist();
  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!data || data.length === 0) {
    return (
      <div className="space-y-1" data-testid="widget-content-watchlist-summary">
        <p className="text-sm text-muted-foreground">No names on your Institutional Investing watchlist yet.</p>
        <Link href="/stock-analyst" className="text-xs font-medium text-primary hover:underline">
          Research a company →
        </Link>
      </div>
    );
  }
  const top = data.slice(0, 3);
  return (
    <div className="space-y-1.5" data-testid="widget-content-watchlist-summary">
      {top.map((w) => (
        <div key={w.id} className="flex items-center justify-between text-sm">
          <span className="font-medium">{w.symbol}</span>
          <Badge variant="outline" className="text-[10px]">
            {w.currentDecision}
          </Badge>
        </div>
      ))}
      <Link href="/stock-analyst" className="text-xs font-medium text-primary hover:underline">
        View all {data.length} →
      </Link>
    </div>
  );
}

// Phase 13 — Institutional Portfolio Manager. Reuses the existing
// GET /portfolio-construction/portfolios list — the same one-request cost
// PortfolioConstruction.tsx's own sidebar already pays, zero new provider
// calls or analyzer composition just to show a count on the home page.
function PortfolioSummaryWidget() {
  const { data, isLoading } = useGetPortfolios();
  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!data || data.length === 0) {
    return (
      <div className="space-y-1" data-testid="widget-content-portfolio-summary">
        <p className="text-sm text-muted-foreground">No target-allocation portfolios yet.</p>
        <Link href="/stock-analyst/portfolio-construction" className="text-xs font-medium text-primary hover:underline">
          Build a portfolio →
        </Link>
      </div>
    );
  }
  const totalHoldings = data.reduce((s, p) => s + p.holdingsCount, 0);
  return (
    <div className="space-y-1.5" data-testid="widget-content-portfolio-summary">
      <p className="text-sm">
        {data.length} portfolio{data.length === 1 ? "" : "s"} · {totalHoldings} holding{totalHoldings === 1 ? "" : "s"}
      </p>
      {data.slice(0, 3).map((p) => (
        <div key={p.id} className="flex items-center justify-between text-sm">
          <span className="font-medium truncate">{p.name}</span>
          <Badge variant="outline" className="text-[10px]">
            {p.holdingsCount} holding{p.holdingsCount === 1 ? "" : "s"}
          </Badge>
        </div>
      ))}
      <Link href="/stock-analyst/portfolio-construction" className="text-xs font-medium text-primary hover:underline">
        Open Portfolio Manager →
      </Link>
      <p className="text-xs text-muted-foreground">
        Quality/diversification drift and concentration breaches are tracked in{" "}
        <Link href="/monitoring-dashboard" className="text-primary hover:underline" data-testid="link-portfolio-manager-monitoring">
          Institutional Monitoring
        </Link>
        .
      </p>
    </div>
  );
}

// Phase 14 — Institutional Investment Decision Engine. A pure navigation
// widget, deliberately zero new data fetch: the Decision Engine composes
// buildValueResearchReport() + optional Management Quality/Portfolio
// Intelligence per symbol, real non-trivial work, so it stays on-demand
// behind its own page rather than eagerly evaluated for every watchlist/
// portfolio symbol just to populate a home-page summary.
function DecisionEngineWidget() {
  const [, setLocation] = useLocation();
  const [symbol, setSymbol] = useState("");
  return (
    <div className="space-y-2" data-testid="widget-content-decision-engine">
      <p className="text-sm text-muted-foreground">
        Deterministic Buy/Accumulate/Hold/Reduce/Sell/Avoid recommendation, checklist, and evidence for any symbol.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const s = symbol.trim().toUpperCase();
          if (s) setLocation(`/decision-engine?symbol=${encodeURIComponent(s)}`);
        }}
      >
        <Input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="e.g. AAPL"
          className="h-8 text-sm"
          data-testid="input-decision-engine-symbol"
        />
        <Button type="submit" size="sm" disabled={!symbol.trim()} data-testid="button-decision-engine-go">
          Go
        </Button>
      </form>
      <Link href="/decision-engine" className="text-xs font-medium text-primary hover:underline">
        Open Decision Engine →
      </Link>
      <p className="text-xs text-muted-foreground">
        Recommendation changes on your watchlist/portfolio symbols are tracked in{" "}
        <Link href="/monitoring-dashboard" className="text-primary hover:underline" data-testid="link-decision-engine-monitoring">
          Institutional Monitoring
        </Link>
        .
      </p>
    </div>
  );
}

// Phase 15 — deliberately zero new data fetch, the same "navigation aid
// only" discipline the Decision Engine widget above already establishes: a
// full opportunity scan is real, non-trivial work (up to ~70 report builds)
// and stays on-demand behind its own page.
function OpportunityDiscoveryWidget() {
  return (
    <div className="space-y-2" data-testid="widget-content-opportunity-discovery">
      <p className="text-sm text-muted-foreground">
        Scan the known-symbol universe and rank opportunities by Business Quality, Valuation, Margin of Safety,
        the Investment Committee, and Tom Nash — deterministic, no new scoring.
      </p>
      <Link href="/opportunity-discovery" className="text-xs font-medium text-primary hover:underline">
        Open Opportunity Discovery →
      </Link>
      <p className="text-xs text-muted-foreground">
        New matches on a saved screen surface as opportunity alerts in{" "}
        <Link href="/monitoring-dashboard" className="text-primary hover:underline" data-testid="link-opportunity-discovery-monitoring">
          Institutional Monitoring
        </Link>
        .
      </p>
    </div>
  );
}

function renderWidgetContent(
  id: string,
  ctx: {
    report: CrossEngineDailyReport | undefined;
    openTrades: Trade[] | undefined;
  },
) {
  switch (id) {
    case "portfolio-health":
      return <PortfolioHealthWidget />;
    case "market-status":
      return <MarketStatusWidget report={ctx.report} />;
    case "open-positions":
      return <OpenPositionsWidget trades={ctx.openTrades} />;
    case "todays-pnl":
      return <TodaysPnlWidget />;
    case "theta-income":
      return <ThetaIncomeWidget />;
    case "buying-power":
      return <BuyingPowerWidget />;
    case "risk":
      return <RiskWidget />;
    case "upcoming-events":
      return <UpcomingEventsWidget />;
    case "ai-briefing":
      return <AiBriefingWidget report={ctx.report} />;
    case "mentor-summary":
      return <MentorSummaryWidget />;
    case "recent-activity":
      return <RecentActivityWidget />;
    case "watchlist-summary":
      return <WatchlistSummaryWidget />;
    case "portfolio-summary":
      return <PortfolioSummaryWidget />;
    case "decision-engine":
      return <DecisionEngineWidget />;
    case "opportunity-discovery":
      return <OpportunityDiscoveryWidget />;
    case "notifications":
      return <NotificationsWidget />;
    case "quick-actions":
      return <QuickActionsWidget openTrades={ctx.openTrades} />;
    default:
      return <p className="text-sm text-muted-foreground">Unknown widget.</p>;
  }
}

// ─── Workspace switcher ────────────────────────────────────────────────

function WorkspaceSwitcher({ activeId }: { activeId: number | undefined }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: workspaces } = useListWorkspaces();
  const activate = useActivateWorkspace();
  const create = useCreateWorkspace();
  const duplicate = useDuplicateWorkspace();
  const del = useDeleteWorkspace();
  const rename = useUpdateWorkspace();

  const [dialog, setDialog] = useState<"new" | "duplicate" | "rename" | null>(null);
  const [nameInput, setNameInput] = useState("");

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListWorkspacesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetActiveWorkspaceQueryKey() });
  }

  function closeDialog() {
    setDialog(null);
    setNameInput("");
  }

  function submitDialog() {
    const name = nameInput.trim();
    if (!name) return;
    if (dialog === "new") {
      create.mutate(
        { data: { name } },
        {
          onSuccess: (created) => {
            activate.mutate({ id: created.id }, { onSuccess: invalidate });
            closeDialog();
          },
          onError: () => toast({ title: "Could not create workspace", description: `"${name}" may already exist.` }),
        },
      );
    } else if (dialog === "duplicate" && activeId) {
      duplicate.mutate(
        { id: activeId, data: { name } },
        {
          onSuccess: (created) => {
            activate.mutate({ id: created.id }, { onSuccess: invalidate });
            closeDialog();
          },
          onError: () => toast({ title: "Could not duplicate workspace", description: `"${name}" may already exist.` }),
        },
      );
    } else if (dialog === "rename" && activeId) {
      rename.mutate(
        { id: activeId, data: { name } },
        {
          onSuccess: () => {
            invalidate();
            closeDialog();
          },
          onError: () => toast({ title: "Could not rename workspace", description: `"${name}" may already exist.` }),
        },
      );
    }
  }

  const active = (workspaces ?? []).find((w) => w.id === activeId);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select
        value={activeId ? String(activeId) : undefined}
        onValueChange={(v) => activate.mutate({ id: Number(v) }, { onSuccess: invalidate })}
      >
        <SelectTrigger className="h-8 w-48 text-xs" data-testid="select-workspace" aria-label="Workspace">
          <SelectValue placeholder="Workspace" />
        </SelectTrigger>
        <SelectContent>
          {(workspaces ?? []).map((w) => (
            <SelectItem key={w.id} value={String(w.id)} data-testid={`workspace-option-${w.id}`}>
              {w.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        data-testid="button-new-workspace"
        aria-label="New workspace"
        onClick={() => setDialog("new")}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        data-testid="button-rename-workspace"
        aria-label="Rename workspace"
        disabled={!active}
        onClick={() => {
          setNameInput(active?.name ?? "");
          setDialog("rename");
        }}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        data-testid="button-duplicate-workspace"
        aria-label="Duplicate workspace"
        disabled={!active}
        onClick={() => setDialog("duplicate")}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        data-testid="button-delete-workspace"
        aria-label="Delete workspace"
        disabled={!active || (workspaces ?? []).length <= 1}
        onClick={() => {
          if (!active) return;
          del.mutate(
            { id: active.id },
            {
              onSuccess: invalidate,
              onError: () => toast({ title: "Cannot delete this workspace", description: "You must keep at least one." }),
            },
          );
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent data-testid="dialog-workspace-name">
          <DialogHeader>
            <DialogTitle>
              {dialog === "new" ? "New Workspace" : dialog === "duplicate" ? "Duplicate Workspace" : "Rename Workspace"}
            </DialogTitle>
            <DialogDescription>Choose a name, e.g. Income Trading, Portfolio Review, Risk Management.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="input-workspace-name">Name</Label>
            <Input
              id="input-workspace-name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={60}
              data-testid="input-workspace-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={submitDialog} disabled={!nameInput.trim()} data-testid="button-submit-workspace-name">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────

export default function Home() {
  const queryClient = useQueryClient();
  const { data: activeWorkspace, isLoading: workspaceLoading } = useGetActiveWorkspace();
  const saveLayout = useUpdateWorkspace();

  const [layout, setLayout] = useState<WidgetConfigEntry[]>([]);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (!activeWorkspace) return;
    const stored = activeWorkspace.widgetConfig as WidgetConfigEntry[];
    // Phase 12 — a workspace saved before "watchlist-summary" existed
    // simply never had that id persisted. Reconcile by appending just this
    // one new widget id (visible by default) when missing, so it becomes
    // discoverable without requiring every existing workspace row to be
    // migrated. Phase 13 extends this same reconciliation to also cover the
    // new "portfolio-summary" widget, Phase 14 the new "decision-engine"
    // widget, and Phase 15 the new "opportunity-discovery" widget —
    // deliberately scoped to just these four ids, not a general
    // reconciliation of every possible future widget — narrower, and never
    // changes behavior for any widget id that isn't one of these four.
    const missing = (["watchlist-summary", "portfolio-summary", "decision-engine", "opportunity-discovery"] as const).filter(
      (id) => !stored.some((w) => w.id === id),
    );
    if (missing.length === 0) {
      setLayout(stored);
      return;
    }
    const maxOrder = stored.reduce((m, w) => Math.max(m, w.order), -1);
    setLayout([
      ...stored,
      ...missing.map((id, i) => ({ id, visible: true, size: "normal" as const, order: maxOrder + 1 + i })),
    ]);
  }, [activeWorkspace]);

  const { data: report } = useGetCrossEngineDailyReport({
    query: { queryKey: getGetCrossEngineDailyReportQueryKey() },
  });
  const { data: openTrades } = useListTrades({ status: "open" });

  const orderedVisible = useMemo(
    () => [...layout].sort((a, b) => a.order - b.order),
    [layout],
  );

  function moveWidget(id: string, direction: -1 | 1) {
    const sorted = [...layout].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((w) => w.id === id);
    const swapWith = index + direction;
    if (index < 0 || swapWith < 0 || swapWith >= sorted.length) return;
    const tmp = sorted[index].order;
    sorted[index].order = sorted[swapWith].order;
    sorted[swapWith].order = tmp;
    setLayout([...sorted]);
  }

  function toggleVisible(id: string) {
    setLayout((prev) => prev.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)));
  }

  function toggleSize(id: string) {
    setLayout((prev) =>
      prev.map((w) => (w.id === id ? { ...w, size: w.size === "normal" ? "compact" : "normal" } : w)),
    );
  }

  function handleSaveLayout() {
    if (!activeWorkspace) return;
    saveLayout.mutate(
      { id: activeWorkspace.id, data: { widgetConfig: layout } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetActiveWorkspaceQueryKey() });
          setEditMode(false);
        },
      },
    );
  }

  return (
    <div className="space-y-6 max-w-7xl" data-testid="page-institutional-home">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">Institutional Home</h1>
            <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30" data-testid="badge-institutional-home">
              <Landmark className="h-3 w-3 mr-1" /> Personal Dashboard
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Your own, personalized landing page — pin, hide, reorder, and resize widgets, and save the
            arrangement as a named workspace.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <WorkspaceSwitcher activeId={activeWorkspace?.id} />
          {editMode ? (
            <Button size="sm" className="h-8 gap-1.5" onClick={handleSaveLayout} data-testid="button-save-layout">
              <Check className="h-3.5 w-3.5" />
              Save Layout
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => setEditMode(true)}
              data-testid="button-edit-layout"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit Layout
            </Button>
          )}
        </div>
      </div>

      {workspaceLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="home-loading">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      )}

      {!workspaceLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="widget-grid">
          {orderedVisible.map((w) => {
            if (!editMode && !w.visible) return null;
            return (
              <Card
                key={w.id}
                className={`bg-card border-border ${w.size === "compact" ? "lg:col-span-1" : "sm:col-span-2 lg:col-span-1"} ${!w.visible ? "opacity-50" : ""}`}
                data-testid={`widget-${w.id}`}
              >
                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-sm">{WIDGET_TITLES[w.id] ?? w.id}</CardTitle>
                  {editMode && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveWidget(w.id, -1)}
                        aria-label={`Move ${WIDGET_TITLES[w.id] ?? w.id} up`}
                        data-testid={`button-move-up-${w.id}`}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveWidget(w.id, 1)}
                        aria-label={`Move ${WIDGET_TITLES[w.id] ?? w.id} down`}
                        data-testid={`button-move-down-${w.id}`}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => toggleSize(w.id)}
                        aria-label={`Toggle ${WIDGET_TITLES[w.id] ?? w.id} size`}
                        data-testid={`button-toggle-size-${w.id}`}
                      >
                        {w.size === "normal" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => toggleVisible(w.id)}
                        aria-label={`${w.visible ? "Hide" : "Show"} ${WIDGET_TITLES[w.id] ?? w.id}`}
                        data-testid={`button-toggle-visible-${w.id}`}
                      >
                        {w.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>{renderWidgetContent(w.id, { report, openTrades })}</CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
