// Phase 20 — Institutional Research Terminal.
//
// This is a pure integration/UX layer. It creates ZERO new valuation
// models, ZERO new scoring systems, and duplicates NO existing business
// logic — every figure below reuses an already-shipped hook/component
// exactly as it exists elsewhere in this codebase:
//   - Overview / Business Quality / Competitive Advantage / Historical
//     Trends  → StockResearch.tsx's own exported <ReportView> (the exact
//               same anchor-linked sections Institutional Workspace's own
//               quick-nav strip already targets).
//   - Financial Statement Explorer → useGetFinancialStatements (Phase 2,
//               Sprint 19), rendered as a compact table over the same
//               already-fetched years — no new math.
//   - Decision Engine summary → StockResearch.tsx's own exported
//               <DecisionSummaryCard>.
//   - Investment Committee summary → report.investmentCommittee (already
//               on the ValueResearchReport ReportView renders) plus a
//               link into the Investment Committee Workbench (Phase 19).
//   - Investment Memo viewer → GET /stock-analyst/investment-memo/:symbol
//               (Phase 19), the exact same section-rendering the
//               Workbench's own Memo Viewer tab already uses.
//   - Portfolio Impact → GET /stock-analyst/decision/:symbol's own
//               portfolioFit (Phase 14), read via the same undocumented
//               ?portfolioId= pattern the Decision Engine/Investment
//               Committee pages already use.
//   - Monitoring summary → useListNotifications, filtered by symbol —
//               the same filter Institutional Workspace's own right
//               sidebar already applies.
//   - Evidence Panel → decision.supportingEvidence/.contradictingEvidence/
//               .checklist — the same fields the Investment Committee
//               Workbench's own Evidence Panel tab already renders.
//   - Research Notes → StockResearch.tsx's own exported
//               <ResearchNotesCard> (byte-identical import).
//   - Multi-company comparison / side-by-side valuation / opportunity
//     comparison → GET /opportunity-discovery/compare (Phase 15's own
//               compareOpportunities()), extended here to show every
//               already-computed OpportunityRow field for N symbols, not
//               just the 2-symbol star-only view PortfolioOptimisation.tsx
//               already has — a UI enhancement over the same endpoint,
//               never a new calculation.
//   - Saved Layouts → deliberately NOT the existing dashboard_workspaces
//               table (Phase 10) — that table's `isActive` is a single
//               per-user flag scoped to the Institutional Home page's own
//               widget config; reusing it here would silently corrupt
//               that invariant for a completely different concern (which
//               symbols/mode/tab this terminal has open, not financial
//               data). Implemented instead as named, client-side
//               (localStorage) layouts — no new table, no new endpoint.
//   - Split-screen mode → the exact same per-symbol panel below, rendered
//               twice, side by side. Zero new data, zero new logic.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  useGetValueReport,
  useGetFinancialStatements,
  useGetPortfolios,
  useListNotifications,
  useCompareOpportunitiesRoute,
  getGetValueReportQueryKey,
  getGetFinancialStatementsQueryKey,
  getCompareOpportunitiesRouteQueryKey,
} from "@workspace/api-client-react";
import type { ValueResearchReport } from "@workspace/api-client-react";
import { useInstitutionalDecision, useInvestmentMemo } from "@/hooks/use-institutional-decision";
import { recommendationBadgeClass, checklistBadgeClass, fmtPct } from "@/lib/investing-format";
import { ReportView, DecisionSummaryCard, ResearchNotesCard } from "./StockResearch";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import {
  Terminal,
  Search,
  Columns2,
  GitCompare,
  Save,
  X,
  ScrollText,
} from "lucide-react";
import { CoachDrawer } from "@/components/coach/CoachDrawer";

type Mode = "single" | "compare" | "split";

interface SavedLayout {
  name: string;
  mode: Mode;
  symbols: string[];
  portfolioId: number | null;
  activeTab: string;
}

const LAYOUTS_STORAGE_KEY = "research-terminal-layouts";

function loadLayouts(): SavedLayout[] {
  try {
    const raw = localStorage.getItem(LAYOUTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLayouts(layouts: SavedLayout[]) {
  try {
    localStorage.setItem(LAYOUTS_STORAGE_KEY, JSON.stringify(layouts));
  } catch {
    // localStorage unavailable (private browsing, quota) — layouts simply
    // don't persist this session; never a fatal error for a UI preference.
  }
}

function useSavedLayouts() {
  const [layouts, setLayouts] = useState<SavedLayout[]>([]);
  useEffect(() => setLayouts(loadLayouts()), []);

  const save = useCallback((layout: SavedLayout) => {
    setLayouts((prev) => {
      const next = [...prev.filter((l) => l.name !== layout.name), layout];
      saveLayouts(next);
      return next;
    });
  }, []);

  const remove = useCallback((name: string) => {
    setLayouts((prev) => {
      const next = prev.filter((l) => l.name !== name);
      saveLayouts(next);
      return next;
    });
  }, []);

  return { layouts, save, remove };
}

const FIXED_COMMENTARY =
  "This terminal shows deterministic, already-computed analysis only. For AI-narrated commentary and free-form Q&A, open the full Value Research page for this symbol.";

function fmt(n: number | null | undefined, dp = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toFixed(dp);
}

// ─── Financial Statement Explorer — compact revenue/net-income table over
// the same already-fetched years, no new math. ─────────────────────────
function StatementsPanel({ symbol }: { symbol: string }) {
  const { data, isLoading, isError } = useGetFinancialStatements(symbol, {
    query: { queryKey: getGetFinancialStatementsQueryKey(symbol), enabled: !!symbol },
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (isError || !data) return <p className="text-sm text-muted-foreground">Financial statements unavailable for this symbol.</p>;

  return (
    <div className="space-y-2" data-testid="terminal-statements-content">
      <Badge variant="outline" className="text-[10px]">{data.dataSource}</Badge>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-border">
              <th className="text-left py-1.5 pr-3">Year</th>
              <th className="text-right py-1.5 pr-3">Revenue</th>
              <th className="text-right py-1.5 pr-3">Gross Profit</th>
              <th className="text-right py-1.5 pr-3">Operating Income</th>
              <th className="text-right py-1.5 pr-3">Net Income</th>
            </tr>
          </thead>
          <tbody>
            {data.incomeStatement.map((y) => (
              <tr key={y.year} className="border-b border-border/40">
                <td className="py-1.5 pr-3">{y.year}</td>
                <td className="py-1.5 pr-3 text-right">{fmt(y.revenue, 0)}</td>
                <td className="py-1.5 pr-3 text-right">{fmt(y.grossProfit, 0)}</td>
                <td className="py-1.5 pr-3 text-right">{fmt(y.operatingIncome, 0)}</td>
                <td className="py-1.5 pr-3 text-right">{fmt(y.netIncome, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Single-symbol panel: 9 tabs, every one a reuse of an already-shipped
// hook/component. Used directly in Single mode, and twice (independently)
// in Split-screen mode. ─────────────────────────────────────────────────
function SymbolPanel({
  symbol,
  portfolioId,
  activeTab,
  onActiveTabChange,
  onClose,
}: {
  symbol: string;
  portfolioId: number | null;
  activeTab: string;
  onActiveTabChange: (tab: string) => void;
  onClose?: () => void;
}) {
  const { data: report, isLoading: reportLoading, isError: reportError } = useGetValueReport(symbol, {
    query: { queryKey: getGetValueReportQueryKey(symbol), enabled: !!symbol },
  });
  const { data: decision } = useInstitutionalDecision(symbol, portfolioId);
  const { data: memo, isLoading: memoLoading } = useInvestmentMemo(symbol, portfolioId);
  const { data: notifications } = useListNotifications();
  const relatedAlerts = (notifications ?? []).filter((n) => n.relatedSymbol === symbol);

  if (reportLoading) {
    return (
      <div className="space-y-3 p-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (reportError || !report) {
    return (
      <Card className="bg-card border-border m-3">
        <CardContent className="py-8 text-center text-sm text-muted-foreground" data-testid={`terminal-panel-error-${symbol}`}>
          Unable to resolve a research report for &quot;{symbol}&quot;.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col" data-testid={`terminal-panel-${symbol}`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
        <span className="text-sm font-semibold">
          {report.name} <span className="text-muted-foreground font-normal">({report.symbol})</span>
        </span>
        <div className="flex items-center gap-2">
          <CoachDrawer symbol={report.symbol} coach="investment" portfolioId={portfolioId} />
          <Link href={`/workspace?symbol=${report.symbol}`} className="text-xs text-primary hover:underline" data-testid={`open-workspace-${symbol}`}>
            Open Workspace →
          </Link>
          <Link
            href={`/reporting-centre?reportType=company-research&symbol=${report.symbol}${portfolioId ? `&portfolioId=${portfolioId}` : ""}`}
            className="text-xs text-primary hover:underline"
            data-testid={`link-generate-report-${symbol}`}
          >
            Generate Report →
          </Link>
          {onClose && (
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose} aria-label={`Close ${symbol}`} data-testid={`close-panel-${symbol}`}>
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={onActiveTabChange} className="flex-1 min-h-0 flex flex-col">
        <TabsList className="flex-wrap h-auto shrink-0 mx-3 mt-2 justify-start" data-testid={`terminal-tabs-${symbol}`}>
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="statements" className="text-xs">Statements</TabsTrigger>
          <TabsTrigger value="decision" className="text-xs">Decision Engine</TabsTrigger>
          <TabsTrigger value="committee" className="text-xs">Investment Committee</TabsTrigger>
          <TabsTrigger value="memo" className="text-xs">Investment Memo</TabsTrigger>
          <TabsTrigger value="portfolio" className="text-xs">Portfolio Impact</TabsTrigger>
          <TabsTrigger value="monitoring" className="text-xs">Monitoring</TabsTrigger>
          <TabsTrigger value="evidence" className="text-xs">Evidence</TabsTrigger>
          <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
        </TabsList>
        <div className="flex-1 overflow-y-auto p-3">
          <TabsContent value="overview" className="mt-0">
            <ReportView report={report as ValueResearchReport} commentary={FIXED_COMMENTARY} isStreaming={false} />
          </TabsContent>
          <TabsContent value="statements" className="mt-0">
            <StatementsPanel symbol={symbol} />
          </TabsContent>
          <TabsContent value="decision" className="mt-0">
            <DecisionSummaryCard symbol={symbol} />
          </TabsContent>
          <TabsContent value="committee" className="mt-0 space-y-2" data-testid="terminal-committee-content">
            <p className="text-sm">
              Consolidated verdict: <Badge className={recommendationBadgeClass(report.investmentCommittee.consolidatedVerdict)}>{report.investmentCommittee.consolidatedVerdict}</Badge>{" "}
              <span className="text-xs text-muted-foreground">confidence {report.investmentCommittee.confidenceScore.toFixed(0)}/100, agreement &quot;{report.investmentCommittee.agreement}&quot;</span>
            </p>
            <p className="text-sm text-muted-foreground">{report.investmentCommittee.summary}</p>
            <Link
              href={`/stock-analyst/investment-committee?symbol=${symbol}${portfolioId ? `&portfolioId=${portfolioId}` : ""}`}
              className="text-xs text-primary hover:underline block"
              data-testid="open-investment-committee"
            >
              Open Investment Committee Workbench →
            </Link>
          </TabsContent>
          <TabsContent value="memo" className="mt-0" data-testid="terminal-memo-content">
            {memoLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : !memo ? (
              <p className="text-sm text-muted-foreground">Investment memo unavailable for this symbol.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={recommendationBadgeClass(memo.recommendation)}>{memo.recommendation}</Badge>
                  <span className="text-xs text-muted-foreground">Confidence {memo.confidence}/100</span>
                  <Badge variant="outline" className="ml-auto text-[10px] flex items-center gap-1"><ScrollText className="w-3 h-3" /> Deterministic</Badge>
                </div>
                <p className="text-sm text-foreground/90">{memo.overview}</p>
                {memo.sections.map((s) => (
                  <div key={s.heading}>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{s.heading}</h4>
                    {s.paragraphs.map((p, i) => (
                      <p key={i} className="text-sm text-foreground/80 mb-1.5">{p}</p>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="portfolio" className="mt-0 space-y-2" data-testid="terminal-portfolio-impact-content">
            {!decision ? (
              <Skeleton className="h-10 w-full" />
            ) : !decision.portfolioFit.available ? (
              <p className="text-sm text-muted-foreground">{decision.portfolioFit.reason ?? "No portfolio context supplied."}</p>
            ) : (
              <>
                <p className="text-sm">
                  {decision.portfolioFit.alreadyHeld
                    ? `Already held — current weight ${decision.portfolioFit.currentWeightPct?.toFixed(1) ?? "unknown"}%.`
                    : "Not currently held in the selected portfolio."}
                </p>
                {decision.portfolioFit.sectorExposurePct != null && (
                  <p className="text-sm text-muted-foreground">Sector exposure: {decision.portfolioFit.sectorExposurePct.toFixed(1)}% of portfolio.</p>
                )}
              </>
            )}
          </TabsContent>
          <TabsContent value="monitoring" className="mt-0" data-testid="terminal-monitoring-content">
            {relatedAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No monitoring alerts for {symbol}.</p>
            ) : (
              <div className="space-y-1.5">
                {relatedAlerts.map((n) => (
                  <div key={n.id} className="text-xs rounded border border-border/60 px-2 py-1.5">
                    <p className="font-medium text-foreground/90">{n.title}</p>
                    <p className="text-muted-foreground">{n.message}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="evidence" className="mt-0 space-y-3" data-testid="terminal-evidence-content">
            {!decision ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Supporting Evidence</p>
                    {decision.supportingEvidence.length === 0 && <p className="text-xs text-muted-foreground">None.</p>}
                    {decision.supportingEvidence.map((e, i) => (
                      <p key={i} className="text-sm"><span className="font-medium">{e.label}:</span> <span className="text-muted-foreground">{e.detail}</span></p>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Contradicting Evidence</p>
                    {decision.contradictingEvidence.length === 0 && <p className="text-xs text-muted-foreground">None.</p>}
                    {decision.contradictingEvidence.map((e, i) => (
                      <p key={i} className="text-sm"><span className="font-medium">{e.label}:</span> <span className="text-muted-foreground">{e.detail}</span></p>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {decision.checklist.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                      <span>{item.label}</span>
                      <Badge className={checklistBadgeClass(item.status)}>{item.status}</Badge>
                    </div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
          <TabsContent value="notes" className="mt-0">
            <ResearchNotesCard symbol={symbol} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ─── Compare mode: N-symbol side-by-side over the same already-computed
// OpportunityRow fields GET /opportunity-discovery/compare returns — a UI
// enhancement (full values, not just a star) over an existing endpoint. ──
function CompareTable({ symbols }: { symbols: string[] }) {
  const joined = symbols.join(",");
  const { data, isLoading, isError } = useCompareOpportunitiesRoute(
    { symbols: joined },
    { query: { queryKey: getCompareOpportunitiesRouteQueryKey({ symbols: joined }), enabled: symbols.length >= 2 } },
  );

  if (symbols.length < 2) {
    return <p className="text-sm text-muted-foreground" data-testid="compare-empty">Add at least 2 symbols above to compare.</p>;
  }
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isError || !data || data.rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Unable to compare the selected symbols.</p>;
  }

  const rows = data.rows;
  const dimensions: { label: string; get: (r: (typeof rows)[number]) => string }[] = [
    { label: "Decision Engine Synthesis Score", get: (r) => r.rankScore.toFixed(0) },
    { label: "Decision", get: (r) => r.decisionRecommendation },
    { label: "Business Quality", get: (r) => r.businessQualityScore.toFixed(0) },
    { label: "Investment Quality", get: (r) => fmt(r.investmentQualityScore, 0) },
    { label: "Margin of Safety", get: (r) => fmtPct(r.marginOfSafety) },
    { label: "Investment Committee", get: (r) => `${r.investmentCommitteeVerdict} (${r.investmentCommitteeConfidence.toFixed(0)})` },
    { label: "Tom Nash Conviction", get: (r) => r.tomNashConvictionScore.toFixed(0) },
    { label: "Revenue Growth (5y)", get: (r) => fmtPct(r.revenueGrowth5y) },
    { label: "ROIC", get: (r) => fmtPct(r.roic) },
    { label: "ROE", get: (r) => fmtPct(r.roe) },
    { label: "Debt/Equity", get: (r) => fmt(r.debtToEquity) },
    { label: "Dividend Yield", get: (r) => fmtPct(r.dividendYield) },
  ];

  return (
    <div className="overflow-x-auto" data-testid="terminal-compare-table">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b border-border">
            <th className="text-left font-medium py-2 pr-3">Dimension</th>
            {data.rows.map((r) => (
              <th key={r.symbol} className="text-right font-medium py-2 pr-3">{r.symbol}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dimensions.map((dim) => {
            const best = data.bestBy[dim.label];
            return (
              <tr key={dim.label} className="border-b border-border/40">
                <td className="py-2 pr-3 text-muted-foreground">{dim.label}</td>
                {data.rows.map((r) => (
                  <td
                    key={r.symbol}
                    className={`py-2 pr-3 text-right ${r.symbol === best ? "text-emerald-400 font-medium" : ""}`}
                    data-testid={`compare-cell-${dim.label}-${r.symbol}`}
                  >
                    {dim.get(r)} {r.symbol === best ? "★" : ""}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ResearchTerminal() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const [mode, setMode] = useState<Mode>("single");
  const [symbols, setSymbols] = useState<string[]>([]);
  const [symbolInput, setSymbolInput] = useState("");
  const [portfolioId, setPortfolioId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [layoutName, setLayoutName] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { data: portfolios } = useGetPortfolios();
  const { layouts, save: saveLayout, remove: removeLayout } = useSavedLayouts();

  const initialisedRef = useRef(false);
  useEffect(() => {
    if (initialisedRef.current) return;
    initialisedRef.current = true;
    const params = new URLSearchParams(search);
    const symbolsParam = params.get("symbols");
    const symbolParam = params.get("symbol");
    const modeParam = params.get("mode");
    const pid = params.get("portfolioId");
    if (symbolsParam) setSymbols(symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean));
    else if (symbolParam) setSymbols([symbolParam.toUpperCase()]);
    if (modeParam === "compare" || modeParam === "split" || modeParam === "single") setMode(modeParam);
    if (pid && Number.isInteger(Number(pid))) setPortfolioId(Number(pid));
  }, [search]);

  const syncUrl = useCallback(
    (next: { symbols: string[]; mode: Mode; portfolioId: number | null }) => {
      const params = new URLSearchParams();
      if (next.symbols.length > 0) params.set("symbols", next.symbols.join(","));
      params.set("mode", next.mode);
      if (next.portfolioId != null) params.set("portfolioId", String(next.portfolioId));
      navigate(`/research-terminal?${params.toString()}`, { replace: true });
    },
    [navigate],
  );

  function addSymbol(raw: string) {
    const s = raw.trim().toUpperCase();
    if (!s) return;
    setSymbols((prev) => {
      const next = prev.includes(s) ? prev : [...prev, s];
      syncUrl({ symbols: next, mode, portfolioId });
      return next;
    });
    setSymbolInput("");
  }

  function removeSymbol(s: string) {
    setSymbols((prev) => {
      const next = prev.filter((x) => x !== s);
      syncUrl({ symbols: next, mode, portfolioId });
      return next;
    });
  }

  function changeMode(next: Mode) {
    setMode(next);
    syncUrl({ symbols, mode: next, portfolioId });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    addSymbol(symbolInput);
  }

  // Keyboard shortcuts, mirroring Institutional Workspace's own precedent:
  // "/" focuses the symbol search, "Escape" blurs it.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape" && typing) {
        (target as HTMLElement).blur();
      } else if (e.key === "1" && !typing) changeMode("single");
      else if (e.key === "2" && !typing) changeMode("compare");
      else if (e.key === "3" && !typing) changeMode("split");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols, mode, portfolioId]);

  function handleSaveLayout() {
    if (!layoutName.trim()) return;
    saveLayout({ name: layoutName.trim(), mode, symbols, portfolioId, activeTab });
    setLayoutName("");
  }

  function handleLoadLayout(l: SavedLayout) {
    setMode(l.mode);
    setSymbols(l.symbols);
    setPortfolioId(l.portfolioId);
    setActiveTab(l.activeTab);
    syncUrl({ symbols: l.symbols, mode: l.mode, portfolioId: l.portfolioId });
  }

  const primarySymbol = symbols[0] ?? "";
  const splitSymbols = useMemo(() => symbols.slice(0, 2), [symbols]);

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] -m-6" data-testid="research-terminal">
      <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-border shrink-0 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-400" /> Institutional Research Terminal
          </h1>
          <div className="flex flex-wrap gap-1.5 mt-1.5" data-testid="terminal-permanent-labels">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border">Institutional Research Terminal</Badge>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border">Educational</Badge>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border">Deterministic</Badge>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border">Evidence Based</Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={symbolInput}
                onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                placeholder="Search a company…  Press / to focus"
                className="h-8 pl-8 text-xs w-56"
                data-testid="terminal-symbol-search"
              />
            </div>
            <Button type="submit" size="sm" className="h-8 text-xs" data-testid="terminal-symbol-search-submit">
              Add
            </Button>
          </form>

          <div className="flex items-center gap-1 border border-border rounded-md p-0.5">
            <Button size="sm" variant={mode === "single" ? "secondary" : "ghost"} className="h-7 text-xs gap-1" onClick={() => changeMode("single")} data-testid="mode-single">
              Analyse
            </Button>
            <Button size="sm" variant={mode === "compare" ? "secondary" : "ghost"} className="h-7 text-xs gap-1" onClick={() => changeMode("compare")} data-testid="mode-compare">
              <GitCompare className="w-3.5 h-3.5" /> Compare
            </Button>
            <Button size="sm" variant={mode === "split" ? "secondary" : "ghost"} className="h-7 text-xs gap-1" onClick={() => changeMode("split")} data-testid="mode-split">
              <Columns2 className="w-3.5 h-3.5" /> Split
            </Button>
          </div>

          <Select value={portfolioId ? String(portfolioId) : "none"} onValueChange={(v) => setPortfolioId(v === "none" ? null : Number(v))}>
            <SelectTrigger className="h-8 w-[180px] text-xs" data-testid="terminal-portfolio-select">
              <SelectValue placeholder="No portfolio context" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No portfolio context</SelectItem>
              {(portfolios ?? []).map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {symbols.length > 0 && (
        <div className="flex items-center gap-1.5 px-6 py-1.5 border-b border-border/60 flex-wrap" data-testid="terminal-open-symbols">
          {symbols.map((s) => (
            <Badge
              key={s}
              variant={s === primarySymbol ? "secondary" : "outline"}
              className="text-[11px] flex items-center gap-1 cursor-pointer"
              onClick={() => setSymbols((prev) => [s, ...prev.filter((x) => x !== s)])}
              data-testid={`open-symbol-${s}`}
            >
              {s}
              <X className="w-3 h-3 hover:text-destructive" onClick={(e) => { e.stopPropagation(); removeSymbol(s); }} />
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 px-6 py-1.5 border-b border-border/60 flex-wrap text-xs" data-testid="terminal-saved-layouts">
        <Input
          value={layoutName}
          onChange={(e) => setLayoutName(e.target.value)}
          placeholder="Layout name…"
          className="h-7 w-40 text-xs"
          data-testid="layout-name-input"
        />
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleSaveLayout} data-testid="save-layout">
          <Save className="w-3.5 h-3.5" /> Save Layout
        </Button>
        {layouts.length === 0 ? (
          <span className="text-muted-foreground">No saved layouts yet.</span>
        ) : (
          layouts.map((l) => (
            <div key={l.name} className="flex items-center gap-1 rounded border border-border/60 px-1.5 py-0.5">
              <button className="hover:underline" onClick={() => handleLoadLayout(l)} data-testid={`load-layout-${l.name}`}>
                {l.name}
              </button>
              <X className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => removeLayout(l.name)} data-testid={`delete-layout-${l.name}`} />
            </div>
          ))
        )}
      </div>

      <div className="flex-1 min-h-0">
        {symbols.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12" data-testid="terminal-empty">
            Search a company above to begin. Add multiple symbols to Compare or Split-screen.
          </p>
        ) : mode === "single" ? (
          <SymbolPanel symbol={primarySymbol} portfolioId={portfolioId} activeTab={activeTab} onActiveTabChange={setActiveTab} />
        ) : mode === "compare" ? (
          <div className="p-4 space-y-3 h-full overflow-y-auto">
            <p className="text-xs text-muted-foreground">Side-by-side valuation and opportunity comparison — every open symbol above.</p>
            <CompareTable symbols={symbols} />
          </div>
        ) : (
          <ResizablePanelGroup direction="horizontal" autoSaveId="research-terminal-split">
            <ResizablePanel defaultSize={50} minSize={25}>
              {splitSymbols[0] ? (
                <SymbolPanel symbol={splitSymbols[0]} portfolioId={portfolioId} activeTab={activeTab} onActiveTabChange={setActiveTab} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">Add a symbol to fill this panel.</p>
              )}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={50} minSize={25}>
              {splitSymbols[1] ? (
                <SymbolPanel symbol={splitSymbols[1]} portfolioId={portfolioId} activeTab={activeTab} onActiveTabChange={setActiveTab} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">Add a second symbol to fill this panel.</p>
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
    </div>
  );
}
