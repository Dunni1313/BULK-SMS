// Phase 17 — Institutional Workspace & Unified Research Cockpit.
//
// This is a pure integration layer. It creates ZERO new valuation models,
// ZERO new scoring systems, and duplicates NO existing business logic —
// every section below reuses an already-shipped hook/component exactly as
// it exists elsewhere in this codebase:
//   - Main Research Area   → StockResearch.tsx's own exported <ReportView>,
//                             <InvestmentThesisCard>, <DecisionSummaryCard>
//                             (byte-identical imports, not re-implementations)
//   - Left sidebar          → Watchlists (useGetValueWatchlist), Portfolio
//                             (useGetPortfolios), Opportunities
//                             (useGetSavedScreens), Monitoring
//                             (useListNotifications), Notes
//                             (useGetAllResearchNotes — the one genuine
//                             backend gap this phase's audit found: a
//                             cross-symbol notes list did not exist before).
//   - Right sidebar         → Active Alerts (useListNotifications filtered
//                             by symbol), Research Notes (StockResearch's
//                             own <ResearchNotesCard>), Portfolio Impact
//                             (client-side aggregation over the user's own
//                             ConstructionPortfolioDetail holdings — no new
//                             math, just a symbol lookup), Related
//                             Opportunities (useGetIndustryComparison's own
//                             peerGroup), AI Mentor Guidance (the existing
//                             Institutional Mentor's own deterministic
//                             watchlistReview).
//
// The report itself is fetched via the same simpler, non-streaming
// useGetValueReport(symbol) hook InstitutionalDashboard.tsx already uses
// (Phase 4, Sprint 54) rather than replicating StockResearch's heavier
// SSE streamCoach() orchestration — this workspace is deterministic-only,
// consistent with "Keep all outputs deterministic." ReportView's own
// "AI Research Thesis" card would otherwise show a perpetual "thinking"
// placeholder for an empty commentary string, so a fixed, honest sentence
// is passed instead, pointing to the full Value Research page for
// AI-narrated commentary.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  useGetValueReport,
  useGetValueWatchlist,
  useAddValueWatchlist,
  useGetPortfolios,
  useGetPortfolio,
  useGetSavedScreens,
  useListNotifications,
  useGetAllResearchNotes,
  useGetIndustryComparison,
  useGetInstitutionalMentor,
  getGetValueReportQueryKey,
  getGetPortfolioQueryKey,
  getGetIndustryComparisonQueryKey,
  ValueResearchReport,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ReportView, InvestmentThesisCard, DecisionSummaryCard, ResearchNotesCard } from "./StockResearch";
import {
  Search,
  Star,
  Briefcase,
  Telescope,
  BellRing,
  NotebookPen,
  LayoutPanelLeft,
  ChevronsLeft,
  ChevronsRight,
  Bell,
  GitCompare,
  Landmark,
  Users2,
} from "lucide-react";
import { CoachDrawer } from "@/components/coach/CoachDrawer";

const RESEARCH_TABS = [
  { id: "overview", label: "Company Overview" },
  { id: "business-quality", label: "Business Quality" },
  { id: "financial-strength", label: "Financial Strength" },
  { id: "competitive-advantage", label: "Competitive Advantage" },
  { id: "valuation", label: "Valuation" },
  { id: "margin-of-safety", label: "Margin of Safety" },
  { id: "decision-engine", label: "Decision Engine" },
  { id: "investment-committee", label: "Investment Committee" },
  { id: "tom-nash", label: "Tom Nash Analysis" },
  { id: "historical-trends", label: "Historical Trends" },
] as const;

const FIXED_COMMENTARY =
  "This workspace shows deterministic, already-computed analysis only. For AI-narrated commentary and free-form Q&A, open the full Value Research page for this symbol.";

function useSymbolFromDeepLink(): [string, (s: string) => void] {
  const search = useSearch();
  const [, navigate] = useLocation();
  const initial = useMemo(() => new URLSearchParams(search).get("symbol")?.toUpperCase() ?? "", [search]);
  const [symbol, setSymbolState] = useState(initial);

  useEffect(() => {
    if (initial && initial !== symbol) setSymbolState(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  function setSymbol(next: string) {
    const upper = next.trim().toUpperCase();
    setSymbolState(upper);
    navigate(upper ? `/workspace?symbol=${upper}` : "/workspace");
  }

  return [symbol, setSymbol];
}

export default function InstitutionalWorkspace() {
  const [symbol, setSymbol] = useSymbolFromDeepLink();
  const [query, setQuery] = useState(symbol);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setQuery(symbol), [symbol]);

  // Phase 17 — Keyboard Shortcuts. "/" focuses the symbol search, "Escape"
  // blurs it, "[" / "]" collapse or expand the left/right sidebars. Chosen
  // deliberately to avoid the global Cmd+K Command Palette shortcut
  // AppLayout.tsx already owns.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape" && typing) {
        (target as HTMLElement).blur();
      } else if (e.key === "[" && !typing) {
        setLeftCollapsed((v) => !v);
      } else if (e.key === "]" && !typing) {
        setRightCollapsed((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (query.trim()) setSymbol(query.trim());
  }

  const {
    data: report,
    isLoading: reportLoading,
    isError: reportError,
  } = useGetValueReport(symbol, {
    query: { queryKey: getGetValueReportQueryKey(symbol), enabled: !!symbol },
  });

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] -m-6" data-testid="institutional-workspace">
      <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <LayoutPanelLeft className="w-5 h-5 text-indigo-400" /> Institutional Workspace
          </h1>
          <div className="flex flex-wrap gap-1.5 mt-1.5" data-testid="workspace-permanent-labels">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border">
              Unified Research Cockpit
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border">
              Educational
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border">
              Deterministic
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border">
              Data Driven
            </Badge>
          </div>
        </div>
        <form onSubmit={runSearch} className="flex items-center gap-2 w-full max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value.toUpperCase())}
              placeholder="Search a company (e.g. AAPL)…  Press / to focus"
              className="h-8 pl-8 text-xs"
              data-testid="workspace-symbol-search"
            />
          </div>
          <Button type="submit" size="sm" className="h-8 text-xs" data-testid="workspace-symbol-search-submit">
            Research
          </Button>
        </form>
      </div>

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" autoSaveId="institutional-workspace-layout">
          {!leftCollapsed && (
            <>
              <ResizablePanel defaultSize={18} minSize={12} maxSize={30} data-testid="workspace-left-sidebar">
                <WorkspaceLeftSidebar symbol={symbol} onSelectSymbol={setSymbol} />
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}

          <ResizablePanel defaultSize={leftCollapsed && rightCollapsed ? 100 : rightCollapsed ? 82 : leftCollapsed ? 82 : 64} minSize={30}>
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => setLeftCollapsed((v) => !v)}
                  aria-label="Toggle left sidebar"
                  data-testid="toggle-left-sidebar"
                >
                  {leftCollapsed ? <ChevronsRight className="w-3.5 h-3.5" /> : <ChevronsLeft className="w-3.5 h-3.5" />}
                </Button>
                {report && (
                  <ScrollArea className="max-w-full">
                    <nav className="flex items-center gap-1 text-[11px]">
                      {RESEARCH_TABS.map((t) => (
                        <a
                          key={t.id}
                          href={`#workspace-section-${t.id}`}
                          className="px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent whitespace-nowrap"
                        >
                          {t.label}
                        </a>
                      ))}
                    </nav>
                  </ScrollArea>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => setRightCollapsed((v) => !v)}
                  aria-label="Toggle right sidebar"
                  data-testid="toggle-right-sidebar"
                >
                  {rightCollapsed ? <ChevronsLeft className="w-3.5 h-3.5" /> : <ChevronsRight className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  <WorkspaceMainResearchArea symbol={symbol} report={report} loading={reportLoading} error={reportError} />
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>

          {!rightCollapsed && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={18} minSize={14} maxSize={32} data-testid="workspace-right-sidebar">
                <WorkspaceRightSidebar symbol={symbol} />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Left sidebar — Watchlists, Portfolio, Opportunities, Monitoring, Notes.
// ---------------------------------------------------------------------------

function SidebarSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-b border-border/60 py-3 px-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function WorkspaceLeftSidebar({ symbol, onSelectSymbol }: { symbol: string; onSelectSymbol: (s: string) => void }) {
  const { data: watchlist, isLoading: watchlistLoading } = useGetValueWatchlist();
  const { data: portfolios, isLoading: portfoliosLoading } = useGetPortfolios();
  const { data: savedScreens, isLoading: screensLoading } = useGetSavedScreens();
  const { data: notifications, isLoading: notificationsLoading } = useListNotifications();
  const { data: notes, isLoading: notesLoading } = useGetAllResearchNotes();

  const unread = (notifications ?? []).filter((n) => !n.isRead);

  return (
    <ScrollArea className="h-full" data-testid="left-sidebar-scroll">
      <SidebarSection title="Watchlists" icon={<Star className="w-3 h-3" />}>
        {watchlistLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : !watchlist || watchlist.length === 0 ? (
          <p className="text-xs text-muted-foreground">No watchlist symbols yet.</p>
        ) : (
          <div className="space-y-1" data-testid="workspace-watchlist-list">
            {watchlist.map((w) => (
              <button
                key={w.id}
                onClick={() => onSelectSymbol(w.symbol)}
                className={`w-full text-left px-2 py-1 rounded text-xs hover:bg-accent flex items-center justify-between ${
                  w.symbol === symbol ? "bg-accent text-foreground" : "text-muted-foreground"
                }`}
                data-testid={`workspace-watchlist-item-${w.symbol}`}
              >
                <span>{w.symbol}</span>
                {w.priceTargetCrossed && (
                  <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-400">
                    Target
                  </Badge>
                )}
              </button>
            ))}
          </div>
        )}
      </SidebarSection>

      <SidebarSection title="Investment Committee" icon={<Users2 className="w-3 h-3" />}>
        <Link
          href={symbol ? `/stock-analyst/investment-committee?symbol=${symbol}` : "/stock-analyst/investment-committee"}
          className="text-xs text-primary hover:underline block"
          data-testid="workspace-investment-committee-link"
        >
          Open Investment Committee →
        </Link>
        <Link
          href={symbol ? `/research-terminal?symbol=${symbol}` : "/research-terminal"}
          className="text-xs text-primary hover:underline block mt-1"
          data-testid="workspace-research-terminal-link"
        >
          Open Research Terminal →
        </Link>
      </SidebarSection>

      <SidebarSection title="Portfolio" icon={<Briefcase className="w-3 h-3" />}>
        {portfoliosLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : !portfolios || portfolios.length === 0 ? (
          <p className="text-xs text-muted-foreground">No portfolios yet.</p>
        ) : (
          <div className="space-y-1">
            {portfolios.map((p) => (
              <div key={p.id} className="flex items-center gap-1">
                <Link
                  href="/stock-analyst/portfolio-construction"
                  className="flex-1 block px-2 py-1 rounded text-xs text-muted-foreground hover:bg-accent hover:text-foreground truncate"
                  data-testid={`workspace-portfolio-item-${p.id}`}
                >
                  {p.name} <span className="text-[10px]">({p.holdingsCount} holdings)</span>
                </Link>
                <Link
                  href={`/stock-analyst/portfolio-optimisation?portfolioId=${p.id}`}
                  className="text-[10px] text-primary hover:underline shrink-0 pr-1"
                  data-testid={`workspace-portfolio-optimise-${p.id}`}
                >
                  Optimise
                </Link>
              </div>
            ))}
          </div>
        )}
      </SidebarSection>

      <SidebarSection title="Opportunities" icon={<Telescope className="w-3 h-3" />}>
        {screensLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : !savedScreens || savedScreens.length === 0 ? (
          <Link href="/opportunity-discovery" className="text-xs text-primary hover:underline">
            Open Opportunity Discovery →
          </Link>
        ) : (
          <div className="space-y-1">
            {savedScreens.map((s) => (
              <Link
                key={s.id}
                href="/opportunity-discovery"
                className="block px-2 py-1 rounded text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                data-testid={`workspace-screen-item-${s.id}`}
              >
                {s.name}
              </Link>
            ))}
          </div>
        )}
      </SidebarSection>

      <SidebarSection title="Monitoring" icon={<BellRing className="w-3 h-3" />}>
        {notificationsLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : unread.length === 0 ? (
          <p className="text-xs text-muted-foreground">No unread alerts.</p>
        ) : (
          <div className="space-y-1" data-testid="workspace-monitoring-list">
            {unread.slice(0, 6).map((n) => (
              <button
                key={n.id}
                onClick={() => n.relatedSymbol && onSelectSymbol(n.relatedSymbol)}
                className="w-full text-left px-2 py-1 rounded text-xs text-muted-foreground hover:bg-accent hover:text-foreground truncate"
                title={n.message}
              >
                {n.relatedSymbol ? `${n.relatedSymbol}: ` : ""}
                {n.title}
              </button>
            ))}
            <Link href="/monitoring-dashboard" className="text-xs text-primary hover:underline block mt-1">
              Open Institutional Monitoring →
            </Link>
          </div>
        )}
      </SidebarSection>

      <SidebarSection title="Notes" icon={<NotebookPen className="w-3 h-3" />}>
        {notesLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : !notes || notes.length === 0 ? (
          <p className="text-xs text-muted-foreground">No research notes yet.</p>
        ) : (
          <div className="space-y-1" data-testid="workspace-notes-list">
            {notes.slice(0, 6).map((n) => (
              <button
                key={n.id}
                onClick={() => onSelectSymbol(n.symbol)}
                className="w-full text-left px-2 py-1 rounded text-xs text-muted-foreground hover:bg-accent hover:text-foreground truncate"
                title={n.note}
              >
                {n.symbol}: {n.note}
              </button>
            ))}
          </div>
        )}
      </SidebarSection>
    </ScrollArea>
  );
}

// ---------------------------------------------------------------------------
// Main Research Area — reuses StockResearch.tsx's own <ReportView> and cards.
// ---------------------------------------------------------------------------

function WorkspaceMainResearchArea({
  symbol,
  report,
  loading,
  error,
}: {
  symbol: string;
  report: ValueResearchReport | undefined;
  loading: boolean;
  error: boolean;
}) {
  const { data: watchlist } = useGetValueWatchlist();
  const addToWatchlist = useAddValueWatchlist();
  const alreadyWatched = (watchlist ?? []).some((w) => w.symbol === symbol);

  if (!symbol) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Search a company above, or pick one from Watchlists / Notes / Monitoring on the left, to begin research.
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Unable to resolve a research report for &quot;{symbol}&quot;.
        </CardContent>
      </Card>
    );
  }

  return (
    <div id="workspace-section-overview" data-testid="workspace-report-view">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground" data-testid="workspace-report-heading">
            {report.name} <span className="text-muted-foreground text-sm">({report.symbol})</span>
          </h2>
          {report.sector && (
            <p className="text-xs text-muted-foreground">
              {report.sector} — {report.industry}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <CoachDrawer symbol={report.symbol} coach="investment" />
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={alreadyWatched || addToWatchlist.isPending}
            onClick={() => addToWatchlist.mutate({ data: { symbol: report.symbol } })}
            data-testid="workspace-add-to-watchlist"
          >
            <Star className="w-3.5 h-3.5 mr-1.5" /> {alreadyWatched ? "On Watchlist" : "Add to Watchlist"}
          </Button>
        </div>
      </div>
      <ReportView report={report} commentary={FIXED_COMMENTARY} isStreaming={false} />
      <div className="mt-4 space-y-4" id="workspace-section-decision-engine">
        <InvestmentThesisCard symbol={report.symbol} />
        <DecisionSummaryCard symbol={report.symbol} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right sidebar — Active Alerts, Research Notes, Portfolio Impact,
// Related Opportunities, AI Mentor Guidance (existing deterministic outputs).
// ---------------------------------------------------------------------------

function PortfolioImpactSection({ symbol }: { symbol: string }) {
  const { data: portfolios, isLoading: portfoliosLoading } = useGetPortfolios();
  const primaryId = portfolios?.[0]?.id ?? 0;
  const { data: primary, isLoading: primaryLoading } = useGetPortfolio(primaryId, {
    query: { queryKey: getGetPortfolioQueryKey(primaryId), enabled: !!primaryId },
  });

  if (portfoliosLoading || primaryLoading) return <Skeleton className="h-10 w-full" />;
  if (!portfolios || portfolios.length === 0) {
    return <p className="text-xs text-muted-foreground">No portfolios yet.</p>;
  }

  const holding = primary?.allocation.holdings.find((h) => h.symbol === symbol);

  return (
    <div className="space-y-1" data-testid="workspace-portfolio-impact">
      {!holding ? (
        <p className="text-xs text-muted-foreground">
          Not held in &quot;{primary?.name}&quot;{portfolios.length > 1 ? " (your primary portfolio)" : ""}.
        </p>
      ) : (
        <>
          <p className="text-xs text-foreground/90">
            Held in &quot;{primary?.name}&quot; — target {holding.targetWeightPct.toFixed(1)}%
            {holding.actualWeightPct != null && <>, actual {holding.actualWeightPct.toFixed(1)}%</>}
          </p>
          {holding.driftPct != null && (
            <p className="text-[11px] text-muted-foreground">Drift: {holding.driftPct.toFixed(1)}pp</p>
          )}
        </>
      )}
      {portfolios.length > 1 && (
        <Link href="/stock-analyst/portfolio-construction" className="text-xs text-primary hover:underline block mt-1">
          Compare across all portfolios →
        </Link>
      )}
    </div>
  );
}

function WorkspaceRightSidebar({
  symbol,
}: {
  symbol: string;
}) {
  const { data: notifications, isLoading: notificationsLoading } = useListNotifications();
  const { data: mentor, isLoading: mentorLoading } = useGetInstitutionalMentor();
  const { data: comparison, isLoading: comparisonLoading } = useGetIndustryComparison(symbol, {
    query: { queryKey: getGetIndustryComparisonQueryKey(symbol), enabled: !!symbol },
  });

  const relatedAlerts = (notifications ?? []).filter((n) => n.relatedSymbol === symbol && !n.isRead);

  return (
    <ScrollArea className="h-full" data-testid="right-sidebar-scroll">
      <SidebarSection title="Active Alerts" icon={<Bell className="w-3 h-3" />}>
        {notificationsLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : !symbol ? (
          <p className="text-xs text-muted-foreground">Search a company to see its alerts.</p>
        ) : relatedAlerts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active alerts for {symbol}.</p>
        ) : (
          <div className="space-y-1.5" data-testid="workspace-active-alerts">
            {relatedAlerts.map((n) => (
              <div key={n.id} className="text-xs rounded border border-border/60 px-2 py-1.5">
                <p className="font-medium text-foreground/90">{n.title}</p>
                <p className="text-muted-foreground">{n.message}</p>
              </div>
            ))}
          </div>
        )}
      </SidebarSection>

      {symbol && (
        <div className="border-b border-border/60 py-3 px-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
            <NotebookPen className="w-3 h-3" /> Research Notes
          </h3>
          <ResearchNotesCard symbol={symbol} />
        </div>
      )}

      <SidebarSection title="Portfolio Impact" icon={<Briefcase className="w-3 h-3" />}>
        {!symbol ? <p className="text-xs text-muted-foreground">Search a company first.</p> : <PortfolioImpactSection symbol={symbol} />}
      </SidebarSection>

      <SidebarSection title="Related Opportunities" icon={<GitCompare className="w-3 h-3" />}>
        {!symbol ? (
          <p className="text-xs text-muted-foreground">Search a company first.</p>
        ) : comparisonLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : !comparison || comparison.peerGroup.length === 0 ? (
          <p className="text-xs text-muted-foreground">No peer comparison available.</p>
        ) : (
          <div className="space-y-1" data-testid="workspace-related-opportunities">
            {comparison.peerGroup.slice(0, 5).map((p) => (
              <Link
                key={p.symbol}
                href={`/workspace?symbol=${p.symbol}`}
                className="block px-2 py-1 rounded text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {p.symbol} — {p.name}
              </Link>
            ))}
          </div>
        )}
      </SidebarSection>

      <SidebarSection title="AI Mentor Guidance" icon={<Landmark className="w-3 h-3" />}>
        {mentorLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : !mentor ? (
          <p className="text-xs text-muted-foreground">Unavailable.</p>
        ) : (
          <div className="space-y-1" data-testid="workspace-mentor-guidance">
            <p className="text-xs text-foreground/90">{mentor.watchlistReview.summary}</p>
            <Link href="/institutional-mentor" className="text-xs text-primary hover:underline block mt-1">
              Open Institutional Mentor →
            </Link>
          </div>
        )}
      </SidebarSection>
    </ScrollArea>
  );
}
