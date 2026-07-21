// Phase 34 — Cross-Engine Orchestration & Unified Workspace.
//
// PURE PRESENTATION LAYER. This page introduces no new signal, score, or
// prediction — every figure it renders is a direct read of
// GET /workspace/overview (lib/crossEngineWorkspace.ts's own composition,
// which itself reuses Phase 33's ExecutiveIntelligenceHub unmodified) or
// GET /workspace/search (deterministic substring search). No ICT, SMC,
// ASAD, Trader Bill, Tom Nash, or Dunni Framework logic; no automated
// entries/exits; no trading signals; no forecasting; no AI predictions; no
// probability engine; no broker execution.
//
// Five tabs, mapping the phase brief's 9 named provide-items onto
// ExecutiveIntelligence.tsx's own established "5 tabs" pattern:
//   Overview   — Workspace Overview (reused KPIs) + Cross-Engine Tasks +
//                Cross-Engine Context (the Research → Portfolio →
//                Committee → Trading → Strategy → Analytics → Reporting →
//                Learning → Executive Review workflow chain, pure
//                navigation links, no new business logic)
//   Search     — Cross-Engine Search (deterministic substring search)
//   Activity   — Recent Activity (the extended, merged timeline)
//   Recent     — Cross-Engine Recent Items (most-recently-touched per
//                category)
//   Shortcuts  — Workspace Shortcuts + Cross-Engine Quick Actions (both
//                pure static navigation lists, reused from lib/nav-items.ts
//                and lib/quick-actions.ts respectively)
//
// Workspace State: the active tab is deep-linkable via ?tab= (matching
// ExecutiveIntelligence.tsx's own precedent) AND persisted to
// localStorage, so returning to this page resumes the tab you were last
// on — a genuine, bounded "workspace state" with zero new backend table.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useGetCrossEngineWorkspaceOverview, useGetCrossEngineWorkspaceSearch, getGetCrossEngineWorkspaceSearchQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { QUICK_ACTIONS, CROSS_ENGINE_QUICK_ACTIONS } from "@/lib/quick-actions";
import type { LucideIcon } from "lucide-react";
import {
  LayoutPanelLeft,
  Search,
  Clock,
  History,
  Compass,
  ListChecks,
  ArrowRight,
  Telescope,
  Briefcase,
  Users2,
  Activity as ActivityIcon,
  Layers,
  BarChart3,
  FileBarChart2,
  GraduationCap,
  LayoutList,
  Waves,
  GitBranch,
  ShieldAlert,
  LineChart,
  AlertTriangle,
  Gauge,
  Scale,
  ShieldCheck,
} from "lucide-react";

const VALID_TABS = ["overview", "search", "activity", "recent", "shortcuts"];
const LAST_TAB_STORAGE_KEY = "cross-engine-workspace:last-tab";

function KpiCard({ label, value, testId }: { label: string; value: string | number; testId: string }) {
  return (
    <Card className="bg-card border-border" data-testid={testId}>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

// The literal "Research → Portfolio → Committee → Trading → Strategy →
// Analytics → Reporting → Learning → Executive Review" flow the Phase 34
// brief names — pure navigation, reusing each surface's own already-shipped
// route, never a new stateful orchestrator (matching lib/workflows.ts's
// own Phase 10 precedent and disclosed scope decision for exactly this
// kind of "ordered sequence of existing pages" feature).
const CROSS_ENGINE_CONTEXT_CHAIN: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Research", href: "/research-terminal", icon: Telescope },
  { label: "Portfolio", href: "/stock-analyst/portfolio-construction", icon: Briefcase },
  { label: "Committee", href: "/investment-committee-workbench", icon: Users2 },
  { label: "Trading", href: "/trade-workspace", icon: ActivityIcon },
  { label: "Strategy", href: "/strategy-framework", icon: Layers },
  { label: "Analytics", href: "/trading-analytics", icon: BarChart3 },
  { label: "Reporting", href: "/reporting-centre", icon: FileBarChart2 },
  { label: "Learning", href: "/learn", icon: GraduationCap },
  { label: "Executive Review", href: "/executive-intelligence", icon: LayoutList },
];

// Workspace Shortcuts — a static list of primary cross-engine surfaces,
// pure navigation, distinct from the action-oriented Quick Actions lists
// below (reused from lib/quick-actions.ts, never redefined here).
const WORKSPACE_SHORTCUTS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Research Terminal", href: "/research-terminal", icon: Telescope },
  { label: "Portfolio Construction", href: "/stock-analyst/portfolio-construction", icon: Briefcase },
  { label: "Investment Committee Workbench", href: "/investment-committee-workbench", icon: Users2 },
  { label: "Portfolio Optimiser", href: "/stock-analyst/portfolio-optimisation", icon: Layers },
  { label: "Trade Workspace", href: "/trade-workspace", icon: ActivityIcon },
  { label: "Trade Planning Studio", href: "/trade-planning-studio", icon: ListChecks },
  { label: "Strategy Workbench", href: "/strategy-workbench", icon: Layers },
  { label: "Trading Analytics", href: "/trading-analytics", icon: BarChart3 },
  { label: "Reporting Centre", href: "/reporting-centre", icon: FileBarChart2 },
  { label: "Learning Centre", href: "/learn", icon: GraduationCap },
  { label: "Options Income Workspace", href: "/options-income-workspace", icon: Waves },
  { label: "Position Lifecycle Manager", href: "/options-lifecycle-manager", icon: GitBranch },
  { label: "Risk & Exposure Engine", href: "/risk-exposure-engine", icon: ShieldAlert },
  { label: "Performance & Attribution Engine", href: "/performance-attribution-engine", icon: LineChart },
  { label: "Scenario & Stress Testing Engine", href: "/scenario-engine", icon: AlertTriangle },
  { label: "Decision Support Engine", href: "/decision-support-engine", icon: Gauge },
  { label: "Rebalancing Engine", href: "/rebalancing-engine", icon: Scale },
  { label: "Monitoring & Compliance Engine", href: "/monitoring-compliance-engine", icon: ShieldCheck },
];

export default function CrossEngineWorkspace() {
  const { data: hub, isLoading, isError } = useGetCrossEngineWorkspaceOverview();

  const [, navigate] = useLocation();
  const search = useSearch();
  const autoRanRef = useRef<string | null>(null);

  const [tab, setTabState] = useState<string>(() => {
    if (typeof window === "undefined") return "overview";
    return window.localStorage.getItem(LAST_TAB_STORAGE_KEY) || "overview";
  });

  function setTab(next: string) {
    setTabState(next);
    if (typeof window !== "undefined") window.localStorage.setItem(LAST_TAB_STORAGE_KEY, next);
  }

  // Deep-link support: ?tab=overview|search|activity|recent|shortcuts —
  // takes precedence over the persisted localStorage tab when present.
  useEffect(() => {
    if (autoRanRef.current === search) return;
    const params = new URLSearchParams(search);
    const t = params.get("tab");
    if (!t || !VALID_TABS.includes(t)) return;
    autoRanRef.current = search;
    setTabState(t);
  }, [search]);

  const [queryInput, setQueryInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(queryInput), 250);
    return () => clearTimeout(handle);
  }, [queryInput]);

  const {
    data: searchResult,
    isLoading: searchLoading,
  } = useGetCrossEngineWorkspaceSearch(
    { q: debouncedQuery },
    { query: { queryKey: getGetCrossEngineWorkspaceSearchQueryKey({ q: debouncedQuery }), enabled: debouncedQuery.trim().length > 0 } },
  );

  const allQuickActions = useMemo(() => [...CROSS_ENGINE_QUICK_ACTIONS, ...QUICK_ACTIONS.filter((a) => a.kind === "navigate")], []);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4" data-testid="cross-engine-workspace-loading">
        <Skeleton className="h-8 w-96" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || !hub) {
    return (
      <div className="p-4 md:p-6" data-testid="cross-engine-workspace-error">
        <p className="text-sm text-destructive">Could not load the Cross-Engine Workspace. Please try again.</p>
      </div>
    );
  }

  const { intelligence, recentActivity, recentItems, tasks } = hub;
  const { overview } = intelligence;

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="cross-engine-workspace">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <LayoutPanelLeft className="w-6 h-6 text-indigo-400" /> Cross-Engine Workspace
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          One unified workspace spanning the Institutional Investing Engine and the Institutional Trading Engine —
          global search, recent activity, cross-engine tasks, quick actions, and shortcuts. Every figure is a direct
          read, count, tally, or simple aggregate of data you already generated — never a new signal, score,
          forecast, or AI prediction.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2" data-testid="cross-engine-workspace-labels">
          <Badge variant="outline" className="text-[10px] border-indigo-500/40 text-indigo-400">
            Cross-Engine
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            Deterministic
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            No Predictions
          </Badge>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview" data-testid="tab-workspace-overview">
            <LayoutPanelLeft className="w-4 h-4 mr-1" /> Overview
          </TabsTrigger>
          <TabsTrigger value="search" data-testid="tab-workspace-search">
            <Search className="w-4 h-4 mr-1" /> Search
          </TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-workspace-activity">
            <Clock className="w-4 h-4 mr-1" /> Activity
          </TabsTrigger>
          <TabsTrigger value="recent" data-testid="tab-workspace-recent">
            <History className="w-4 h-4 mr-1" /> Recent Items
          </TabsTrigger>
          <TabsTrigger value="shortcuts" data-testid="tab-workspace-shortcuts">
            <Compass className="w-4 h-4 mr-1" /> Shortcuts
          </TabsTrigger>
        </TabsList>

        {/* ─── Overview ─────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard label="Portfolios" value={overview.portfoliosCreated} testId="kpi-workspace-portfolios" />
            <KpiCard label="Trades Reviewed" value={overview.tradesReviewed} testId="kpi-workspace-trades" />
            <KpiCard label="Strategies Registered" value={overview.strategiesRegistered} testId="kpi-workspace-strategies" />
            <KpiCard label="Reports Generated" value={overview.reportsGenerated} testId="kpi-workspace-reports" />
            <KpiCard label="AI Coach Views" value={overview.totalCoachViews} testId="kpi-workspace-coach-views" />
            <KpiCard label="Learning Topics" value={`${overview.learningTopicsCompleted}/${overview.learningTopicsTotal}`} testId="kpi-workspace-learning" />
          </div>

          <Card className="bg-card border-border" data-testid="panel-cross-engine-tasks">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-indigo-400" /> Cross-Engine Tasks
              </CardTitle>
              <CardDescription className="text-xs">
                Already-flagged items across both engines that may need your attention — never a new prediction, just
                an honest count.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2" data-testid="cross-engine-tasks-empty">
                  Nothing needs attention right now.
                </p>
              ) : (
                <ul className="space-y-1.5" data-testid="cross-engine-tasks-list">
                  {tasks.map((t) => (
                    <li key={t.code} className="flex items-center justify-between gap-2 text-xs" data-testid={`task-${t.code}`}>
                      <Link href={t.linkPath} className="text-primary hover:underline">
                        {t.label}
                      </Link>
                      <Badge variant="outline" className="text-[10px]">
                        {t.count}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border" data-testid="panel-cross-engine-context">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Compass className="w-4 h-4 text-indigo-400" /> Cross-Engine Context
              </CardTitle>
              <CardDescription className="text-xs">
                Move naturally between Research, Portfolio, Committee, Trading, Strategy, Analytics, Reporting,
                Learning, and Executive Review — without duplicated navigation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-1.5" data-testid="cross-engine-context-chain">
                {CROSS_ENGINE_CONTEXT_CHAIN.map((step, i) => (
                  <span key={step.href} className="flex items-center gap-1.5">
                    <Link
                      href={step.href}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-foreground/90 hover:bg-accent"
                      data-testid={`context-chain-${step.label.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <step.icon className="w-3.5 h-3.5" /> {step.label}
                    </Link>
                    {i < CROSS_ENGINE_CONTEXT_CHAIN.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Search ───────────────────────────────────────────────────── */}
        <TabsContent value="search" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-global-search">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Search className="w-4 h-4 text-indigo-400" /> Cross-Engine Search
              </CardTitle>
              <CardDescription className="text-xs">
                Deterministic, case-insensitive substring search over Portfolios, Holdings, Research Notes, Committee
                Snapshots, Trade Plans, Trading Journal, Strategies, Reports, and Learning Topics — never a semantic
                or AI search.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Search portfolios, holdings, notes, snapshots, plans, journal, strategies, reports, topics…"
                data-testid="input-global-search"
              />
              {queryInput.trim().length === 0 ? (
                <p className="text-xs text-muted-foreground" data-testid="global-search-idle">
                  Start typing to search across both engines.
                </p>
              ) : searchLoading ? (
                <Skeleton className="h-24" />
              ) : !searchResult || searchResult.results.length === 0 ? (
                <p className="text-xs text-muted-foreground" data-testid="global-search-no-results">
                  No results for &quot;{queryInput}&quot;.
                </p>
              ) : (
                <ul className="space-y-1.5" data-testid="global-search-results">
                  {searchResult.results.map((r) => (
                    <li key={`${r.category}-${r.id}`} className="text-xs border-b border-border/50 pb-1.5 last:border-0" data-testid={`search-result-${r.category}-${r.id}`}>
                      <div className="flex items-center justify-between gap-2">
                        <Link href={r.linkPath} className="text-primary hover:underline truncate">
                          {r.label}
                        </Link>
                        <Badge variant="outline" className="text-[9px] uppercase shrink-0">
                          {r.category.replace(/-/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-0.5">{r.detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Activity ─────────────────────────────────────────────────── */}
        <TabsContent value="activity" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-recent-activity">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recent Activity</CardTitle>
              <CardDescription className="text-xs">
                A chronological merge of committee snapshots, risk snapshots, optimisation reviews, research notes,
                trade plans, strategy registrations, learning completions, saved reports, journal entries, and
                notifications across both engines — newest first.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2" data-testid="recent-activity-empty">
                  No recent activity recorded yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {recentActivity.map((a, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 text-xs border-b border-border/50 pb-2 last:border-0" data-testid={`workspace-activity-entry-${i}`}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[9px] uppercase">
                            {a.engine}
                          </Badge>
                          <span className="font-medium text-foreground/90 truncate">{a.label}</span>
                        </div>
                        <p className="text-muted-foreground line-clamp-1 mt-0.5">{a.detail}</p>
                        {a.linkPath && (
                          <Link href={a.linkPath} className="text-primary hover:underline inline-block mt-0.5">
                            View →
                          </Link>
                        )}
                      </div>
                      <span className="text-muted-foreground shrink-0">{new Date(a.occurredAt).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Recent Items ─────────────────────────────────────────────── */}
        <TabsContent value="recent" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-recent-items">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Cross-Engine Recent Items</CardTitle>
              <CardDescription className="text-xs">
                The single most-recently-touched item per category — jump back into where you left off.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentItems.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2" data-testid="recent-items-empty">
                  Nothing to show yet — build a portfolio, save a research note, or register a strategy.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2" data-testid="recent-items-grid">
                  {recentItems.map((item) => (
                    <Link
                      key={`${item.category}-${item.label}`}
                      href={item.linkPath}
                      className="block text-xs border border-border rounded p-2 hover:bg-accent"
                      data-testid={`recent-item-${item.category}`}
                    >
                      <Badge variant="outline" className="text-[9px] uppercase mb-1">
                        {item.category.replace(/-/g, " ")}
                      </Badge>
                      <p className="font-medium text-foreground/90 truncate">{item.label}</p>
                      <p className="text-muted-foreground truncate">{item.detail}</p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Shortcuts & Quick Actions ────────────────────────────────── */}
        <TabsContent value="shortcuts" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-workspace-shortcuts">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Workspace Shortcuts</CardTitle>
              <CardDescription className="text-xs">Direct links to the primary cross-engine surfaces.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2" data-testid="workspace-shortcuts-grid">
                {WORKSPACE_SHORTCUTS.map((s) => (
                  <Link
                    key={s.href}
                    href={s.href}
                    className="flex items-center gap-1.5 text-xs px-2 py-2 rounded border border-border hover:bg-accent"
                    data-testid={`shortcut-${s.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <s.icon className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{s.label}</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border" data-testid="panel-cross-engine-quick-actions">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Cross-Engine Quick Actions</CardTitle>
              <CardDescription className="text-xs">
                Reused directly from the platform's own Quick Actions/Command Palette list — pure navigation, no new
                business logic.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2" data-testid="cross-engine-quick-actions-grid">
                {allQuickActions.map((a) => (
                  <Button
                    key={a.id}
                    variant="outline"
                    size="sm"
                    className="h-auto py-2 justify-start text-xs"
                    onClick={() => navigate(a.href)}
                    data-testid={`quick-action-${a.id}`}
                  >
                    <a.icon className="w-3.5 h-3.5 mr-1.5 shrink-0" /> <span className="truncate">{a.label}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
